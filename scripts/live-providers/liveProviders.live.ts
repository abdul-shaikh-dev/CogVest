/**
 * Live data-provider check (#825). Calls the real AMFI and Yahoo endpoints
 * through the app's own fetch, chunking, parsing and cache modules, over long
 * and old ranges that unit tests and emulator flows don't reach.
 *
 * Run before a release with `npm run check:live-providers`. It needs the
 * network, so it is not part of `test:verify` or CI. A case fails when the
 * provider answer is incomplete or rejected, or when a response size, row
 * count or duration reaches 80% of the app's own limit.
 *
 * Only public, fixed identifiers are used: no holdings, backups or personal data.
 */
import { benchmarkFund } from "@/src/domain/benchmarkXirr";
import { amfiDailyNavMaxResponseCharacters } from "@/src/services/mutualFunds/amfiDailyNav";
import {
  amfiNavReportTimeoutMs,
  clearAmfiHistoricalNavCacheForTests,
  loadAmfiFundHouseIds,
  maxAmfiResponseCharacters,
} from "@/src/services/mutualFunds/amfiHistoricalNav";
import {
  amfiCatalogTimeoutMs,
  clearAmfiSchemeCatalogCacheForTests,
  lookupAmfiSchemeClassifications,
} from "@/src/services/mutualFunds/amfiSchemeCatalog";
import {
  assetHistoryMaxResponseBytes,
  fetchAssetHistory,
  getAssetHistoryRequest,
  maxYahooRows,
} from "@/src/services/quotes/assetHistoryProvider";
import { benchmarkRequest, benchmarkWindows } from "@/src/services/quotes/benchmarkNav";
import {
  amfiDailyPriceRefreshTimeoutMs,
  createDailyPriceCache,
  dailyPriceMaxEntryPoints,
  dailyPriceRefreshTimeoutMs,
} from "@/src/services/quotes/dailyPriceCache";
import { createMemoryJsonStorage } from "@/src/services/storage";
import type { Asset, DailyPriceRequest } from "@/src/types";

const warnAt = 0.8;
const benchmarkFrom = "2019-01-01";
// A second large fund house, in an old year when its reports were biggest.
const secondFund = { from: "2019-01-01", isin: "INF200K01TE8", name: "SBI Nifty Index Fund (Direct, Growth)", to: "2019-12-31" };
// Listed history across a split is refused as a corporate action, so these have
// had no split in ten years (checked 2026-11-28). If one splits, pick another.
const listed: Asset[] = [
  { assetClass: "stock", currency: "INR", exchange: "NSE", id: "maruti", instrumentType: "stock", name: "Maruti Suzuki India", symbol: "MARUTI", ticker: "MARUTI.NS" },
  { assetClass: "etf", currency: "INR", exchange: "NSE", id: "juniorbees", instrumentType: "etf", name: "Nippon India ETF Nifty Next 50 Junior BeES", symbol: "JUNIORBEES", ticker: "JUNIORBEES.NS" },
];

type Measured = { bytes: number; characters: number; requests: number; slowestMs: number };
type Usage = { label: string; limit: number; used: number };
type Row = { detail: string; failure?: string; name: string; usages: Usage[] };

const rows: Row[] = [];

function measuringFetcher(measured: Measured) {
  return async (input: string, init?: RequestInit) => {
    const started = Date.now();
    const response = await fetch(input, init);
    const text = await response.text();
    measured.requests += 1;
    measured.slowestMs = Math.max(measured.slowestMs, Date.now() - started);
    measured.characters = Math.max(measured.characters, text.length);
    measured.bytes = Math.max(measured.bytes, Buffer.byteLength(text, "utf8"));
    return new Response(text, { headers: response.headers, status: response.status, statusText: response.statusText });
  };
}

function freshMeasure(): Measured {
  return { bytes: 0, characters: 0, requests: 0, slowestMs: 0 };
}

function utcToday() {
  return new Date().toISOString().slice(0, 10);
}

function tenYearsBack(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year - 10, month - 1, day + 1)).toISOString().slice(0, 10);
}

function record(row: Row) {
  rows.push(row);
  const near = row.usages.filter((usage) => usage.used >= usage.limit * warnAt);
  const problems = [
    ...(row.failure ? [row.failure] : []),
    ...near.map((usage) => `${usage.label} at ${percent(usage)} of its limit`),
  ];
  if (problems.length > 0) throw new Error(`${row.name}: ${problems.join("; ")}`);
}

function percent(usage: Usage) {
  return `${Math.round((usage.used / usage.limit) * 100)}%`;
}

async function refreshThroughCache(request: DailyPriceRequest, measured: Measured) {
  const cache = createDailyPriceCache({ storage: createMemoryJsonStorage() });
  const fetcher = measuringFetcher(measured);
  let errorKind: string | undefined;
  const started = Date.now();
  const result = await cache.refresh(request, async (input, signal) => {
    try {
      return await fetchAssetHistory(input, signal, fetcher);
    } catch (error) {
      errorKind = (error as { kind?: string }).kind ?? "unknown";
      throw error;
    }
  });
  return { errorKind, elapsedMs: Date.now() - started, result };
}

async function checkDailyHistory(name: string, request: DailyPriceRequest | null) {
  if (!request) {
    record({ detail: "", failure: "the app builds no history request", name, usages: [] });
    return;
  }
  const measured = freshMeasure();
  const { elapsedMs, errorKind, result } = await refreshThroughCache(request, measured);
  const amfi = request.provider === "amfi";
  const usages: Usage[] = [
    { label: "duration", limit: amfi ? amfiDailyPriceRefreshTimeoutMs : dailyPriceRefreshTimeoutMs, used: elapsedMs },
    amfi
      ? { label: "largest report", limit: amfiDailyNavMaxResponseCharacters, used: measured.characters }
      : { label: "response size", limit: assetHistoryMaxResponseBytes, used: measured.bytes },
  ];
  if (result.status !== "refreshed") {
    const reason = "reason" in result ? result.reason : result.status;
    record({ detail: `${measured.requests} requests`, failure: `not loaded (${reason}${errorKind ? `, ${errorKind}` : ""})`, name, usages });
    return;
  }
  const points = result.entry.points.length;
  usages.push({ label: "points", limit: amfi ? dailyPriceMaxEntryPoints : Math.min(maxYahooRows, dailyPriceMaxEntryPoints), used: points });
  record({
    detail: `${points} points, ${measured.requests} requests`,
    failure: result.entry.complete ? undefined : "incomplete",
    name,
    usages,
  });
}

describe("live data providers", () => {
  beforeAll(() => {
    clearAmfiSchemeCatalogCacheForTests();
    clearAmfiHistoricalNavCacheForTests();
  });

  afterAll(() => {
    const lines = rows.map((row) => [
      row.failure ? "FAIL" : row.usages.some((usage) => usage.used >= usage.limit * warnAt) ? "NEAR" : "ok  ",
      row.name,
      row.detail,
      row.usages.map((usage) => `${usage.label} ${percent(usage)}`).join(", "),
      row.failure ?? "",
    ].filter(Boolean).join(" | "));
    process.stdout.write(`\nLive provider check, ${new Date().toISOString()}\n${lines.join("\n")}\n`);
  });

  it("AMFI scheme catalog", async () => {
    const measured = freshMeasure();
    const started = Date.now();
    const lookup = await lookupAmfiSchemeClassifications({ fetcher: measuringFetcher(measured), isins: [benchmarkFund.isin, secondFund.isin] });
    const found = Object.keys(lookup.classifications).length;
    record({
      detail: `${measured.characters} characters, ${found} of 2 funds found`,
      failure: lookup.failure ? "catalog unavailable" : found < 2 ? "a fixed fund is missing" : undefined,
      name: "AMFI scheme catalog",
      usages: [{ label: "duration", limit: amfiCatalogTimeoutMs, used: Date.now() - started }],
    });
  });

  it("AMFI fund-house list", async () => {
    const measured = freshMeasure();
    const started = Date.now();
    let failure: string | undefined;
    try {
      const ids = await loadAmfiFundHouseIds(measuringFetcher(measured));
      const houses = await lookupAmfiSchemeClassifications({ isins: [benchmarkFund.isin, secondFund.isin] });
      const missing = Object.values(houses.classifications).filter((fund) => !fund.fundHouse || !ids[fund.fundHouse]);
      if (missing.length > 0) failure = "a fixed fund's house has no NAV history id";
    } catch (error) {
      failure = `not loaded (${(error as Error).message})`;
    }
    record({
      detail: `${measured.characters} characters`,
      failure,
      name: "AMFI fund-house list",
      usages: [
        { label: "duration", limit: amfiNavReportTimeoutMs, used: Date.now() - started },
        { label: "size", limit: maxAmfiResponseCharacters, used: measured.characters },
      ],
    });
  });

  for (const window of benchmarkWindows(benchmarkFrom, utcToday())) {
    it(`AMFI daily NAV, ${benchmarkFund.shortName}, ${window.from} to ${window.to}`, async () => {
      await checkDailyHistory(`AMFI ${benchmarkFund.shortName} ${window.from}..${window.to}`, benchmarkRequest(window));
    });
  }

  it(`AMFI daily NAV, ${secondFund.name}, ${secondFund.from} to ${secondFund.to}`, async () => {
    const fund: Asset = { assetClass: "stock", currency: "INR", id: "sbi-nifty", instrumentType: "mutualFund", isin: secondFund.isin, name: secondFund.name, symbol: secondFund.isin, ticker: secondFund.isin };
    await checkDailyHistory(`AMFI ${secondFund.name} ${secondFund.from}..${secondFund.to}`, getAssetHistoryRequest(fund, secondFund.from, secondFund.to));
  });

  for (const asset of listed) {
    it(`Yahoo daily history, ${asset.ticker}, ten years`, async () => {
      const to = utcToday();
      const from = tenYearsBack(to);
      await checkDailyHistory(`Yahoo ${asset.ticker} ${from}..${to}`, getAssetHistoryRequest(asset, from, to));
    });
  }
});
