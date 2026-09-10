import {
  createMmkvJsonStorage,
  type JsonStorage,
} from "@/src/services/storage";

export const dailyPriceCacheStorageKey = "cogvest:v3:daily-price-cache";

const version = 1;
const maxBytes = 8 * 1024 * 1024;
const maxEntries = 64;
const maxPoints = 50_000;
const maxEntryPoints = 4_000;
const freshnessMs = 24 * 60 * 60 * 1000;
const refreshTimeoutMs = 10_000;
let generationCounter = 0;

export type DailyPriceRequest = {
  basis: "close" | "adjusted-close";
  currency: "INR" | "USD";
  from: string;
  provider: "yahoo" | "coingecko";
  providerId: string;
  to: string;
};

export type DailyPricePoint = { close: number; date: string };
export type DailyPriceEntry = DailyPriceRequest & {
  complete: boolean;
  fetchedAt: string;
  points: DailyPricePoint[];
};

type Envelope = { entries: DailyPriceEntry[]; generation: string; version: number };
type EnvelopeMemo = {
  clockMs: number;
  day: string;
  envelope: Envelope;
  raw: string;
};
type InvalidReason = "invalid" | "corrupt" | "incompatible" | "unavailable";

export type DailyPriceReadResult =
  | { coverage: "complete" | "partial"; entry: DailyPriceEntry; freshness: "current" | "stale"; status: "hit" }
  | { status: "missing" }
  | { reason: "corrupt"; status: "corrupt" }
  | { reason: "incompatible"; status: "incompatible" }
  | { status: "unavailable" }
  | { reason: "invalid"; status: "invalid" };
export type DailyPriceWriteResult =
  | { entry: DailyPriceEntry; status: "stored" }
  | { reason: "rejected" | "incompatible"; status: "rejected" }
  | { status: "unavailable" };
export type DailyPriceRefreshResult =
  | { entry: DailyPriceEntry; status: "refreshed" }
  | { entry?: DailyPriceEntry; reason: "failed" | "timeout" | "mismatch" | "invalidated" | "rejected"; status: "failed" }
  | { status: "unavailable" };
export type DailyPriceClearResult = { status: "cleared" } | { status: "unavailable" };

function bytes(value: string) {
  let total = 0;
  for (const character of value) {
    const code = character.codePointAt(0)!;
    total += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
  }
  return total;
}

function isDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function today(now: Date) {
  return now.toISOString().slice(0, 10);
}

function requestKey(request: DailyPriceRequest) {
  return JSON.stringify([request.provider, request.providerId, request.currency, request.basis, request.from, request.to]);
}

function identityKey(entry: DailyPriceRequest) {
  return JSON.stringify([entry.provider, entry.providerId, entry.currency, entry.basis]);
}

function nextGeneration() {
  generationCounter += 1;
  return `${Date.now().toString(36)}-${generationCounter.toString(36)}`;
}

function validRequest(request: DailyPriceRequest, now: Date) {
  if (!request || typeof request !== "object" ||
    (request.provider !== "yahoo" && request.provider !== "coingecko") ||
    (request.currency !== "INR" && request.currency !== "USD") ||
    (request.basis !== "close" && request.basis !== "adjusted-close") ||
    typeof request.providerId !== "string" || typeof request.from !== "string" || typeof request.to !== "string") return false;
  if (!isDate(request.from) || !isDate(request.to) || request.from > request.to || request.to > today(now)) return false;
  const [fromYear, fromMonth, fromDay] = request.from.split("-").map(Number);
  const anniversaryMonthEnd = new Date(Date.UTC(fromYear + 10, fromMonth, 0)).getUTCDate();
  const anniversary = `${String(fromYear + 10).padStart(4, "0")}-${String(fromMonth).padStart(2, "0")}-${String(Math.min(fromDay, anniversaryMonthEnd)).padStart(2, "0")}`;
  if (request.to > anniversary) return false;
  return request.providerId.length > 0 && request.providerId.length <= 160 && request.providerId.trim() === request.providerId;
}

function validEntry(entry: DailyPriceEntry, now: Date) {
  if (!entry || typeof entry !== "object" || !validRequest(entry, now) || typeof entry.complete !== "boolean" || typeof entry.fetchedAt !== "string" || !Array.isArray(entry.points) || entry.points.length > maxEntryPoints) return false;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(entry.fetchedAt)) return false;
  const fetchedAt = new Date(entry.fetchedAt);
  if (!Number.isFinite(fetchedAt.getTime()) || fetchedAt.toISOString() !== entry.fetchedAt || fetchedAt.getTime() > now.getTime()) return false;
  const currentDay = today(now);
  let previous = "";
  for (const point of entry.points) {
    if (!point || typeof point !== "object" || typeof point.date !== "string" || typeof point.close !== "number") return false;
    const valid = isDate(point.date) && point.date > previous && point.date >= entry.from && point.date <= entry.to && point.date <= currentDay && Number.isFinite(point.close) && point.close > 0;
    previous = point.date;
    if (!valid) return false;
  }
  return true;
}

function sameRequest(left: DailyPriceRequest, right: DailyPriceRequest) {
  return requestKey(left) === requestKey(right);
}

function persistedEntry(entry: DailyPriceEntry): DailyPriceEntry {
  return {
    basis: entry.basis,
    complete: entry.complete,
    currency: entry.currency,
    fetchedAt: entry.fetchedAt,
    from: entry.from,
    points: entry.points.map((point) => ({ close: point.close, date: point.date })),
    provider: entry.provider,
    providerId: entry.providerId,
    to: entry.to,
  };
}

function loadEnvelope(
  storage: JsonStorage | undefined,
  now: Date,
  memo: { current: EnvelopeMemo | undefined },
): Envelope | { reason: "corrupt" | "incompatible" | "unavailable" } {
  if (!storage) return { reason: "unavailable" };
  let raw: string | null;
  try { raw = storage.getRawItem(dailyPriceCacheStorageKey); } catch { return { reason: "unavailable" }; }
  if (!raw) return { entries: [], generation: "initial", version };
  const clockMs = now.getTime();
  const validationDay = today(now);
  const cached = memo.current;
  if (cached && cached.raw === raw && cached.day === validationDay && clockMs >= cached.clockMs) {
    cached.clockMs = clockMs;
    return cached.envelope;
  }
  // Character length is a safe lower bound; calculate UTF-8 only near the cap.
  if (raw.length > maxBytes || (raw.length > maxBytes / 4 && bytes(raw) > maxBytes)) return { reason: "corrupt" };
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return { reason: "corrupt" }; }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { reason: "corrupt" };
  const envelope = parsed as Partial<Envelope>;
  if (envelope.version !== version) return { reason: "incompatible" };
  const generation = envelope.generation;
  if (typeof generation !== "string" || generation.length === 0 || generation.length > 128 || !Array.isArray(envelope.entries) || envelope.entries.length > maxEntries || !envelope.entries.every((entry) => validEntry(entry as DailyPriceEntry, now))) return { reason: "corrupt" };
  if (envelope.entries.reduce((count, entry) => count + entry.points.length, 0) > maxPoints) return { reason: "corrupt" };
  const validEnvelope = { entries: envelope.entries as DailyPriceEntry[], generation, version };
  memo.current = { clockMs, day: validationDay, envelope: validEnvelope, raw };
  return validEnvelope;
}

function sliceEntry(entry: DailyPriceEntry, request: DailyPriceRequest): DailyPriceEntry {
  return { ...entry, from: request.from, to: request.to, points: entry.points.filter((point) => point.date >= request.from && point.date <= request.to).map((point) => ({ ...point })) };
}

export function createDailyPriceCache({ storage, now = () => new Date() }: { now?: () => Date; storage?: JsonStorage } = {}) {
  let activeStorage = storage;
  if (!activeStorage) {
    try { activeStorage = createMmkvJsonStorage(); } catch { activeStorage = undefined; }
  }
  const inFlight = new Map<string, Promise<DailyPriceRefreshResult>>();
  const envelopeMemo: { current: EnvelopeMemo | undefined } = { current: undefined };
  const load = (clock: Date) => loadEnvelope(activeStorage, clock, envelopeMemo);

  function read(request: DailyPriceRequest): DailyPriceReadResult {
    const clock = now();
    if (!validRequest(request, clock)) return { reason: "invalid", status: "invalid" };
    const envelope = load(clock);
    if ("reason" in envelope) {
      if (envelope.reason === "unavailable") return { status: "unavailable" };
      if (envelope.reason === "corrupt") return { reason: "corrupt", status: "corrupt" };
      return { reason: "incompatible", status: "incompatible" };
    }
    const entry = envelope.entries
      .filter((candidate) => identityKey(candidate) === identityKey(request) && candidate.from <= request.from && candidate.to >= request.to)
      .sort((left, right) => Number(right.complete) - Number(left.complete) || new Date(right.fetchedAt).getTime() - new Date(left.fetchedAt).getTime())[0];
    if (!entry) return { status: "missing" };
    const fetchedAt = new Date(entry.fetchedAt).getTime();
    return { coverage: entry.complete ? "complete" : "partial", entry: sliceEntry(entry, request), freshness: clock.getTime() - fetchedAt <= freshnessMs ? "current" : "stale", status: "hit" };
  }

  function write(entry: DailyPriceEntry): DailyPriceWriteResult {
    const clock = now();
    if (!validEntry(entry, clock)) return { reason: "rejected", status: "rejected" };
    const cleanEntry = persistedEntry(entry);
    const envelope = load(clock);
    if ("reason" in envelope) {
      if (envelope.reason === "unavailable") return { status: "unavailable" };
      if (envelope.reason === "incompatible") return { reason: "incompatible", status: "rejected" };
    }
    const base = "reason" in envelope ? { entries: [], generation: nextGeneration(), version } : envelope;
    const matched = base.entries.find((candidate) => sameRequest(candidate, cleanEntry));
    if (matched?.complete && !cleanEntry.complete) return { reason: "rejected", status: "rejected" };
    if (matched && new Date(matched.fetchedAt).getTime() > new Date(cleanEntry.fetchedAt).getTime()) {
      return { reason: "rejected", status: "rejected" };
    }
    let entries = [...base.entries.filter((item) => !sameRequest(item, cleanEntry)).map(persistedEntry), cleanEntry];
    let serialized: string | undefined;
    while (true) {
      try { serialized = JSON.stringify({ entries, generation: base.generation, version }); } catch { return { reason: "rejected", status: "rejected" }; }
      if (entries.length <= maxEntries && entries.reduce((count, item) => count + item.points.length, 0) <= maxPoints && bytes(serialized) <= maxBytes) break;
      const oldest = [...entries].sort((left, right) => new Date(left.fetchedAt).getTime() - new Date(right.fetchedAt).getTime() || requestKey(left).localeCompare(requestKey(right)))[0];
      // The incoming entry is pinned: never report it stored after evicting it.
      if (oldest === cleanEntry) return { reason: "rejected", status: "rejected" };
      entries = entries.filter((item) => item !== oldest);
    }
    try { activeStorage?.setRawItem(dailyPriceCacheStorageKey, serialized!); } catch { return { status: "unavailable" }; }
    if (!activeStorage) return { status: "unavailable" };
    envelopeMemo.current = {
      clockMs: clock.getTime(),
      day: today(clock),
      envelope: { entries, generation: base.generation, version },
      raw: serialized!,
    };
    return { entry: persistedEntry(cleanEntry), status: "stored" };
  }

  async function refresh(request: DailyPriceRequest, loader: (input: DailyPriceRequest, signal: AbortSignal) => Promise<DailyPriceEntry>): Promise<DailyPriceRefreshResult> {
    if (!validRequest(request, now())) return { reason: "rejected", status: "failed" };
    const key = requestKey(request);
    const active = inFlight.get(key);
    if (active) return active;
    const task: Promise<DailyPriceRefreshResult> = (async (): Promise<DailyPriceRefreshResult> => {
      const clock = now();
      const envelope = load(clock);
      if ("reason" in envelope) return envelope.reason === "unavailable" ? { status: "unavailable" } : { reason: "rejected", status: "failed" };
      const old = read(request);
      const fallback = (reason: "failed" | "timeout" | "mismatch" | "rejected"): DailyPriceRefreshResult => {
        const current = load(now());
        if ("reason" in current || current.generation !== envelope.generation) {
          return { reason: "invalidated", status: "failed" };
        }
        return { entry: old.status === "hit" ? old.entry : undefined, reason, status: "failed" };
      };
      const controller = new AbortController();
      let timedOut = false;
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const deadline = new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => { timedOut = true; controller.abort(); reject(new Error("timeout")); }, refreshTimeoutMs);
      });
      try {
        const entry = await Promise.race([loader(request, controller.signal), deadline]);
        if (timedOut) return fallback("timeout");
        if (!validEntry(entry, now()) || !sameRequest(entry, request)) return fallback("mismatch");
        const current = load(now());
        if ("reason" in current || current.generation !== envelope.generation) return { reason: "invalidated", status: "failed" };
        const result = write(entry);
        return result.status === "stored" ? { entry: result.entry, status: "refreshed" } : result.status === "unavailable" ? { status: "unavailable" } : fallback("rejected");
      } catch {
        return fallback(timedOut ? "timeout" : "failed");
      } finally { if (timeout !== undefined) clearTimeout(timeout); }
    })();
    inFlight.set(key, task);
    try { return await task; } finally { if (inFlight.get(key) === task) inFlight.delete(key); }
  }

  function clear(): DailyPriceClearResult {
    const clock = now();
    const loaded = load(clock);
    if ("reason" in loaded && loaded.reason === "unavailable") return { status: "unavailable" };
    const generation = nextGeneration();
    const raw = JSON.stringify({ entries: [], generation, version });
    try { activeStorage?.setRawItem(dailyPriceCacheStorageKey, raw); } catch { return { status: "unavailable" }; }
    inFlight.clear();
    envelopeMemo.current = { clockMs: clock.getTime(), day: today(clock), envelope: { entries: [], generation, version }, raw };
    return activeStorage ? { status: "cleared" } : { status: "unavailable" };
  }

  return { clear, read, refresh, write };
}
