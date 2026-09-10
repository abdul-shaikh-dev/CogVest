import { hasCanonicalAssetConflict } from "@/src/domain/assets";
import { camsKfinCasSourceFormat } from "@/src/domain/camsKfinCas";
import { getCalendarDatePart, parseCalendarDate } from "@/src/domain/dates";
import { getOpeningPositionHistoryDate, isTransactionAfterOpeningCutover } from "@/src/domain/openingPositions";
import { decimal, isWithinQuantum, moneyQuantum } from "@/src/domain/precision";
import { comparePpfLedgerEntries, calculatePpfConfirmedBalance, validatePpfAccount, validatePpfLedgerEntryForAccount } from "@/src/domain/ppf";
import { getV1AssetCurrencyIssue } from "@/src/domain/portfolioCurrency";
import { getTradeQuantityDelta, isTradeAcquisition } from "@/src/domain/transactionSemantics";
import { parsePersistedHistoricalQuoteCache, parsePersistedPortfolio, parsePersistedQuoteCache } from "@/src/store/persistedPortfolioSchema";
import type { RawPortfolioSnapshot } from "@/src/store";
import type { CashEntry, HistoricalQuoteCache, QuoteCache, Trade } from "@/src/types";

export const portfolioBackupFormat = "cogvest-portfolio-backup";
export const portfolioBackupFormatVersion = 1;
export const backupMaxBytes = 5 * 1024 * 1024;
export const portfolioBackupMaxDepth = 24;
export const portfolioBackupMaxRecords = 10_000;
export const portfolioBackupMaxTotalRecords = 50_000;
const maximumFinancialMagnitude = 1_000_000_000_000_000;

export type BackupPayload = {
  casFolioSalt: string | null;
  historicalQuoteCache: HistoricalQuoteCache;
  portfolio: RawPortfolioSnapshot;
  quoteCache: QuoteCache;
};

export type BackupDigest = (canonicalText: string) => Promise<string>;

type BackupEnvelopeWithoutChecksum = {
  appVersion: string;
  createdAt: string;
  format: typeof portfolioBackupFormat;
  formatVersion: typeof portfolioBackupFormatVersion;
  payload: BackupPayload;
};

function fail(message: string): never {
  throw new Error(`Invalid CogVest backup: ${message}`);
}

function utf8Length(value: string) {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x7f) bytes += 1;
    else if (code <= 0x7ff) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length && (value.charCodeAt(index + 1) & 0xfc00) === 0xdc00) {
      bytes += 4;
      index += 1;
    } else bytes += 3;
  }
  return bytes;
}

function inspectBounds(value: unknown, depth = 0, seen = { count: 0 }) {
  if (depth > portfolioBackupMaxDepth) fail("nested data is too deep");
  seen.count += 1;
  if (seen.count > portfolioBackupMaxTotalRecords * 10) fail("data contains too many values");
  if (Array.isArray(value)) {
    if (value.length > portfolioBackupMaxRecords) fail("a record collection is too large");
    value.forEach((item) => inspectBounds(item, depth + 1, seen));
  } else if (value !== null && typeof value === "object") {
    Object.values(value).forEach((item) => inspectBounds(item, depth + 1, seen));
  }
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
    .join(",")}}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Zod's persisted parser intentionally strips unknown legacy fields. Backups must not. */
function assertNoDiscardedFields(raw: unknown, parsed: unknown) {
  if (Array.isArray(raw)) {
    if (!Array.isArray(parsed) || raw.length !== parsed.length) fail("array shape is unsupported");
    raw.forEach((item, index) => assertNoDiscardedFields(item, parsed[index]));
    return;
  }
  if (!isPlainObject(raw)) {
    if (!Object.is(raw, parsed)) fail("record values are not canonical");
    return;
  }
  if (!isPlainObject(parsed)) fail("record shape is unsupported");
  for (const key of Object.keys(raw)) {
    if (!Object.hasOwn(parsed, key)) {
      // Live state may retain an explicitly undefined optional field; JSON cannot.
      if (raw[key] === undefined) continue;
      fail(`unsupported field '${key}'`);
    }
    assertNoDiscardedFields(raw[key], parsed[key]);
  }
}

function requireExactKeys(value: Record<string, unknown>, keys: readonly string[], label: string) {
  const actual = Object.keys(value);
  if (actual.length !== keys.length || actual.some((key) => !keys.includes(key))) {
    fail(`${label} fields are unsupported`);
  }
}

function requireDate(value: string, label: string) {
  if (value !== getCalendarDatePart(value) && !isIsoTimestamp(value)) fail(`${label} is not a valid date`);
}

function isIsoTimestamp(value: string) {
  const match = /^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/u.exec(value);
  return match !== null && parseCalendarDate(match[1]) !== null && Number.isFinite(new Date(value).getTime());
}

function requireIsoTimestamp(value: string, label: string) {
  if (!isIsoTimestamp(value)) fail(`${label} is not a valid timestamp`);
}

function requireFinancialValue(value: number, label: string, minimum?: number) {
  if (!Number.isFinite(value) || Math.abs(value) > maximumFinancialMagnitude || (minimum !== undefined && value < minimum)) fail(`${label} is outside supported financial bounds`);
}

function uniqueIds(records: readonly { id: string }[], label: string) {
  if (new Set(records.map((record) => record.id)).size !== records.length) fail(`duplicate ${label} IDs`);
}

function validateCashLinks(cashEntries: CashEntry[], trades: Trade[]) {
  const tradesById = new Map(trades.map((trade) => [trade.id, trade]));
  const links = new Set<string>();
  for (const entry of cashEntries) {
    if (!entry.linkedTradeId) {
      if (
        (entry.purpose === "purchaseFunding" && entry.type !== "withdrawal") ||
        (entry.purpose === "saleProceeds" && entry.type !== "addition")
      ) fail("legacy trade cash entry has an invalid direction");
      continue;
    }
    const trade = tradesById.get(entry.linkedTradeId);
    if (!trade || (trade.type !== "buy" && trade.type !== "sell") || links.has(entry.linkedTradeId)) fail("invalid linked cash entry");
    links.add(entry.linkedTradeId);
    const isBuy = trade.type === "buy";
    if (entry.date !== trade.date || !isWithinQuantum(entry.amount, trade.totalValue, moneyQuantum) ||
      entry.type !== (isBuy ? "withdrawal" : "addition") || entry.purpose !== (isBuy ? "purchaseFunding" : "saleProceeds")) {
      fail("linked cash entry does not match its trade");
    }
  }
}

function validateInventory(portfolio: RawPortfolioSnapshot) {
  for (const asset of portfolio.assets) {
    const openings = portfolio.openingPositions.filter((position) => position.assetId === asset.id);
    const events: Array<{ date: string; delta: number; id: string; importBatchId?: string; originalRowNumber?: number; priority: number }> = [];
    for (const position of openings) {
      const date = getOpeningPositionHistoryDate(position);
      if (date !== null) events.push({ date, delta: position.quantity, id: position.id, priority: 0 });
    }
    for (const trade of portfolio.trades) {
      if (trade.assetId !== asset.id || !isTransactionAfterOpeningCutover(trade.date, openings)) continue;
      const date = getCalendarDatePart(trade.date);
      if (date !== null) events.push({ date, delta: getTradeQuantityDelta(trade), id: trade.id, importBatchId: trade.importProvenance?.importBatchId, originalRowNumber: trade.importProvenance?.originalRowNumber, priority: isTradeAcquisition(trade) ? 1 : 2 });
    }
    events.sort((left, right) => left.date.localeCompare(right.date) ||
      (left.importBatchId !== undefined && left.importBatchId === right.importBatchId && left.originalRowNumber !== undefined && right.originalRowNumber !== undefined ? left.originalRowNumber - right.originalRowNumber : left.priority - right.priority || left.id.localeCompare(right.id)));
    let quantity = decimal(0);
    for (const event of events) {
      quantity = quantity.plus(event.delta);
      if (quantity.lessThan(0)) fail(`inventory oversells asset '${asset.id}'`);
    }
  }
}

function validateGraph(payload: BackupPayload) {
  const { portfolio } = payload;
  const sections: Array<readonly unknown[]> = [portfolio.assets, portfolio.cashEntries, portfolio.monthlySnapshots, portfolio.openingPositions, portfolio.ppfAccounts, portfolio.ppfLedgerEntries, portfolio.trades];
  if (sections.some((section) => section.length > portfolioBackupMaxRecords) || sections.reduce((sum, section) => sum + section.length, 0) > portfolioBackupMaxTotalRecords) fail("too many records");
  uniqueIds(portfolio.assets, "asset"); uniqueIds(portfolio.cashEntries, "cash entry"); uniqueIds(portfolio.monthlySnapshots, "snapshot");
  uniqueIds(portfolio.openingPositions, "opening position"); uniqueIds(portfolio.ppfAccounts, "PPF account"); uniqueIds(portfolio.ppfLedgerEntries, "PPF ledger entry"); uniqueIds(portfolio.trades, "trade");
  const assetIds = new Set(portfolio.assets.map((asset) => asset.id));
  if (portfolio.assets.some((asset) => getV1AssetCurrencyIssue(asset) || hasCanonicalAssetConflict(portfolio.assets, asset))) fail("asset identity or currency is invalid");
  for (const position of portfolio.openingPositions) {
    if (!assetIds.has(position.assetId)) fail("opening position has a dangling asset");
    requireFinancialValue(position.quantity, "opening position quantity", Number.MIN_VALUE);
    requireFinancialValue(position.averageCostPrice, "opening position cost", Number.MIN_VALUE);
    if (position.date !== null) requireDate(position.date, "opening position date");
    if (position.measuredAsOf) requireDate(position.measuredAsOf, "opening position measured date");
    if (position.recordedOn) requireDate(position.recordedOn, "opening position recorded date");
    if (position.recordedAt) requireIsoTimestamp(position.recordedAt, "opening position recorded time");
    if (position.manualValuation && position.manualValuation.currency !== portfolio.assets.find((asset) => asset.id === position.assetId)?.currency) fail("manual valuation currency is invalid");
    if (position.date !== null && position.measuredAsOf && getCalendarDatePart(position.measuredAsOf)! < getCalendarDatePart(position.date)!) fail("opening position cutover precedes acquisition");
  }
  for (const trade of portfolio.trades) {
    if (!assetIds.has(trade.assetId)) fail("trade has a dangling asset");
    requireFinancialValue(trade.quantity, "trade quantity", Number.MIN_VALUE);
    requireDate(trade.date, "trade date");
    if (trade.intendedHoldDays !== undefined && (!Number.isInteger(trade.intendedHoldDays) || trade.intendedHoldDays <= 0)) fail("trade planned holding period is invalid");
    if (trade.type === "buy" || trade.type === "sell") {
      requireFinancialValue(trade.pricePerUnit, "trade price", Number.MIN_VALUE);
      requireFinancialValue(trade.totalValue, "trade total", Number.MIN_VALUE);
      if (trade.fees !== undefined) requireFinancialValue(trade.fees, "trade fees", 0);
      const gross = decimal(trade.quantity).times(trade.pricePerUnit);
      const expected = trade.type === "buy" ? gross.plus(trade.fees ?? 0) : gross.minus(trade.fees ?? 0);
      if (!isWithinQuantum(trade.totalValue, expected, moneyQuantum)) fail("trade total is inconsistent");
    }
  }
  const importFingerprints = new Set<string>();
  for (const trade of portfolio.trades) {
    const provenance = trade.importProvenance;
    if (!provenance?.fingerprint) continue;
    const identity = `${provenance.sourceFormat}\u0000${provenance.account?.trim().toUpperCase() ?? ""}\u0000${provenance.fingerprint}`;
    if (importFingerprints.has(identity)) fail("duplicate import fingerprint");
    importFingerprints.add(identity);
  }
  for (const entry of portfolio.cashEntries) {
    requireFinancialValue(entry.amount, "cash amount", Number.MIN_VALUE);
    requireDate(entry.date, "cash entry date");
    if (!entry.linkedTradeId &&
      entry.purpose !== "purchaseFunding" &&
      entry.purpose !== "saleProceeds" &&
      (entry.type === "withdrawal" ? entry.purpose !== "withdrawal" : !["capitalContribution", "income", "legacyUncategorized"].includes(entry.purpose))) fail("cash entry purpose is invalid");
  }
  validateCashLinks(portfolio.cashEntries, portfolio.trades);
  const months = new Set<string>();
  for (const snapshot of portfolio.monthlySnapshots) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/u.test(snapshot.month) || months.has(snapshot.month)) fail("monthly snapshots must have unique valid months");
    months.add(snapshot.month);
    for (const [label, value] of Object.entries({ cashValue: snapshot.cashValue, cryptoValue: snapshot.cryptoValue, debtValue: snapshot.debtValue, equityValue: snapshot.equityValue, investedValue: snapshot.investedValue, monthlyInvestment: snapshot.monthlyInvestment, portfolioValue: snapshot.portfolioValue })) requireFinancialValue(value, `snapshot ${label}`);
    if (snapshot.monthlyExpense !== undefined) requireFinancialValue(snapshot.monthlyExpense, "snapshot monthly expense", 0);
    if (snapshot.salary !== undefined) requireFinancialValue(snapshot.salary, "snapshot salary", 0);
    if (!isWithinQuantum(snapshot.portfolioValue, decimal(snapshot.cashValue).plus(snapshot.cryptoValue).plus(snapshot.debtValue).plus(snapshot.equityValue), moneyQuantum)) fail("snapshot total is inconsistent");
    if (snapshot.generated) requireIsoTimestamp(snapshot.generated.generatedAt, "snapshot generation time");
    snapshot.generated?.priceEvidence?.forEach((evidence) => { if (!assetIds.has(evidence.assetId)) fail("snapshot evidence has a dangling asset"); });
  }
  for (const account of portfolio.ppfAccounts) {
    if (!validatePpfAccount(account).isValid || (account.legacyAssetId !== undefined && portfolio.assets.find((asset) => asset.id === account.legacyAssetId)?.instrumentType !== "ppf")) fail("PPF account is invalid");
    const entries = portfolio.ppfLedgerEntries.filter((entry) => entry.accountId === account.id).sort(comparePpfLedgerEntries);
    for (let index = 0; index < entries.length; index += 1) {
      if (!validatePpfLedgerEntryForAccount(account, entries[index]).isValid || calculatePpfConfirmedBalance(account, entries.slice(0, index + 1), entries[index].date).confirmedBalance < 0) fail("PPF ledger is invalid");
    }
  }
  if (portfolio.ppfLedgerEntries.some((entry) => !portfolio.ppfAccounts.some((account) => account.id === entry.accountId))) fail("PPF ledger has a dangling account");
  for (const [key, quote] of Object.entries(payload.quoteCache)) {
    const asset = portfolio.assets.find((candidate) => candidate.id === quote.assetId);
    if (key !== quote.assetId || !asset || asset.currency !== quote.currency) fail("current quote cache is invalid");
    requireFinancialValue(quote.price, "current quote price", Number.MIN_VALUE);
    requireIsoTimestamp(quote.asOf, "current quote timestamp");
  }
  for (const [key, quote] of Object.entries(payload.historicalQuoteCache)) {
    const asset = portfolio.assets.find((candidate) => candidate.id === quote.assetId);
    if (key !== `${quote.assetId}:${quote.asOfMonth}` || !asset || asset.currency !== quote.currency || quote.asOfMonth !== getCalendarDatePart(`${quote.asOfMonth}-01`)?.slice(0, 7)) fail("historical quote cache is invalid");
    requireFinancialValue(quote.price, "historical quote price", Number.MIN_VALUE);
    requireIsoTimestamp(quote.fetchedAt, "historical quote timestamp");
  }
  if (payload.casFolioSalt !== null && !/^[a-f0-9]{64}$/u.test(payload.casFolioSalt)) fail("CAS identity salt is malformed");
  const hasCasProvenance = portfolio.trades.some((trade) => trade.importProvenance?.sourceFormat === camsKfinCasSourceFormat);
  if (hasCasProvenance && payload.casFolioSalt === null) fail("CAS provenance requires a 32-byte identity salt");
  validateInventory(portfolio);
}

function parsePayload(raw: unknown): BackupPayload {
  if (!isPlainObject(raw)) fail("payload is not an object");
  requireExactKeys(raw, ["portfolio", "quoteCache", "historicalQuoteCache", "casFolioSalt"], "payload");
  if (!isPlainObject(raw.portfolio) || !isPlainObject(raw.quoteCache) || !isPlainObject(raw.historicalQuoteCache) || (raw.casFolioSalt !== null && typeof raw.casFolioSalt !== "string")) fail("payload shape is invalid");
  const portfolioRaw = raw.portfolio;
  requireExactKeys(portfolioRaw, ["assets", "cashEntries", "monthlySnapshots", "openingPositions", "ppfAccounts", "ppfLedgerEntries", "preferences", "schemaVersion", "trades"], "portfolio");
  if (portfolioRaw.schemaVersion !== 9 || !isPlainObject(portfolioRaw.preferences) || !["assets", "cashEntries", "monthlySnapshots", "openingPositions", "ppfAccounts", "ppfLedgerEntries", "trades"].every((key) => Array.isArray(portfolioRaw[key]))) fail("portfolio must be a complete schema-9 snapshot");
  requireExactKeys(portfolioRaw.preferences, ["defaultChartRange", "displayMode", "hasCompletedOnboarding", "maskWealthValues", ...(Object.hasOwn(portfolioRaw.preferences, "nudgeVersions") ? ["nudgeVersions"] : [])], "preferences");
  const parsed = parsePersistedPortfolio(JSON.stringify(portfolioRaw));
  if (!parsed.success || parsed.data.schemaVersion !== 9) fail("portfolio records are invalid");
  assertNoDiscardedFields(portfolioRaw, parsed.data);
  const quoteCache = parsePersistedQuoteCache(JSON.stringify(raw.quoteCache));
  const historicalQuoteCache = parsePersistedHistoricalQuoteCache(JSON.stringify(raw.historicalQuoteCache));
  if (!quoteCache.success || !historicalQuoteCache.success) fail("quote cache records are invalid");
  assertNoDiscardedFields(raw.quoteCache, quoteCache.data);
  assertNoDiscardedFields(raw.historicalQuoteCache, historicalQuoteCache.data);
  const portfolio = parsed.data as RawPortfolioSnapshot;
  const payload: BackupPayload = { casFolioSalt: raw.casFolioSalt, historicalQuoteCache: historicalQuoteCache.data, portfolio, quoteCache: quoteCache.data };
  validateGraph(payload);
  return payload;
}

/** Validates a detached live snapshot before the store can stage a replacement. */
export function validateBackupPayload(input: unknown): BackupPayload {
  inspectBounds(input);
  const checked = parsePayload(input);
  return JSON.parse(JSON.stringify(checked)) as BackupPayload;
}

function freeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
  return value;
}

async function checksum(body: BackupEnvelopeWithoutChecksum, digest: BackupDigest) {
  const value = await digest(canonicalJson(body));
  if (!/^[a-f0-9]{64}$/u.test(value)) throw new Error("Backup digest must return lowercase SHA-256 hexadecimal.");
  return value;
}

export async function createPortfolioBackup(payload: BackupPayload, metadata: { appVersion: string; createdAt: string }, digest: BackupDigest): Promise<string> {
  if (typeof metadata.appVersion !== "string" || metadata.appVersion.trim().length === 0) throw new Error("Backup app version is required.");
  requireIsoTimestamp(metadata.createdAt, "backup creation time");
  const checkedPayload = validateBackupPayload(payload);
  const body: BackupEnvelopeWithoutChecksum = { appVersion: metadata.appVersion, createdAt: metadata.createdAt, format: portfolioBackupFormat, formatVersion: portfolioBackupFormatVersion, payload: checkedPayload };
  const text = canonicalJson({ ...body, checksum: await checksum(body, digest) });
  if (utf8Length(text) > backupMaxBytes) throw new Error("Backup exceeds the supported file size.");
  return text;
}

export async function parsePortfolioBackup(text: string, digest: BackupDigest): Promise<{ appVersion: string; createdAt: string; payload: BackupPayload }> {
  if (typeof text !== "string" || utf8Length(text) > backupMaxBytes) fail("file exceeds the supported size");
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { fail("file is not valid JSON"); }
  inspectBounds(raw);
  if (!isPlainObject(raw)) fail("envelope is not an object");
  requireExactKeys(raw, ["format", "formatVersion", "createdAt", "appVersion", "payload", "checksum"], "envelope");
  if (raw.format !== portfolioBackupFormat || raw.formatVersion !== portfolioBackupFormatVersion) fail("format version is unsupported");
  if (typeof raw.createdAt !== "string" || typeof raw.appVersion !== "string" || raw.appVersion.trim().length === 0 || typeof raw.checksum !== "string") fail("envelope metadata is invalid");
  requireIsoTimestamp(raw.createdAt, "backup creation time");
  const payload = validateBackupPayload(raw.payload);
  const body: BackupEnvelopeWithoutChecksum = { appVersion: raw.appVersion, createdAt: raw.createdAt, format: portfolioBackupFormat, formatVersion: portfolioBackupFormatVersion, payload };
  if (raw.checksum !== await checksum(body, digest)) fail("checksum does not match");
  return freeze({ appVersion: raw.appVersion, createdAt: raw.createdAt, payload: JSON.parse(JSON.stringify(payload)) as BackupPayload });
}
