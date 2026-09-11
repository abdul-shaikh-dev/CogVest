import { createHash } from "node:crypto";

import {
  createPortfolioBackup,
  parsePortfolioBackup,
  validateBackupPayload,
  backupMaxBytes,
  type BackupPayload,
} from "@/src/domain/portfolioBackup";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";
import { seedVisualQaPortfolio } from "@/src/testing/visualQaSeed";
import { bonusShareCatalog } from "@/src/domain/stockSplitCatalog";

const digest = async (text: string) => {
  return createHash("sha256").update(text, "utf8").digest("hex");
};

function payload(): BackupPayload {
  const stock = {
    assetClass: "stock" as const, currency: "INR" as const, exchange: "NSE" as const,
    id: "asset-stock", instrumentType: "stock" as const, name: "Example Stock", sectorType: "technology" as const, symbol: "EXAMPLE", ticker: "EXAMPLE.NS",
  };
  const crypto = {
    assetClass: "crypto" as const, currency: "INR" as const, exchange: "CRYPTO" as const,
    id: "asset-crypto", instrumentType: "crypto" as const, name: "Example Coin", sectorType: "digitalAsset" as const, symbol: "EXC", ticker: "EXC-USD",
  };
  const etf = {
    assetClass: "etf" as const, currency: "INR" as const, exchange: "NSE" as const,
    id: "asset-etf", instrumentType: "etf" as const, name: "Example ETF", sectorType: "diversified" as const, symbol: "ETF", ticker: "ETF.NS",
  };
  const fund = {
    assetClass: "debt" as const, currency: "INR" as const, id: "asset-fund", instrumentType: "mutualFund" as const,
    name: "Example Fund", sectorType: "fixedIncome" as const, symbol: "FUND", ticker: "FUND",
  };
  const ppf = {
    assetClass: "debt" as const, currency: "INR" as const, id: "asset-ppf", instrumentType: "ppf" as const,
    name: "PPF", sectorType: "fixedIncome" as const, symbol: "PPF", ticker: "PPF",
  };
  return {
    casFolioSalt: "a".repeat(64),
    historicalQuoteCache: {
      "asset-stock:2026-08": { assetId: "asset-stock", asOfMonth: "2026-08", basis: "manual-fallback", currency: "INR", fetchedAt: "2026-08-31T10:00:00.000Z", price: 120, source: "manual" },
    },
    portfolio: {
      assets: [stock, crypto, etf, fund, ppf],
      cashEntries: [
        { amount: 1000, date: "2026-01-01", id: "cash-deposit", label: "Opening cash", purpose: "capitalContribution", type: "addition" },
        { amount: 202, date: "2026-01-02", id: "cash-buy", label: "Funded buy", linkedTradeId: "trade-buy", purpose: "purchaseFunding", type: "withdrawal" },
        { amount: 118, date: "2026-01-03", id: "cash-sell", label: "Sale proceeds", linkedTradeId: "trade-sell", purpose: "saleProceeds", type: "addition" },
      ],
      monthlySnapshots: [{ cashValue: 916, cryptoValue: 100, debtValue: 500, equityValue: 120, id: "snapshot-2026-01", investedValue: 1000, month: "2026-01", monthlyInvestment: 1000, portfolioValue: 1636 }],
      openingPositions: [{ assetId: "asset-crypto", averageCostPrice: 100, date: "2025-12-31", id: "opening-crypto", manualValuation: { asOf: "2026-01-04T10:00:00.000Z", currency: "INR", price: 110, provenance: "user", source: "manual" }, measuredAsOf: "2025-12-31", quantity: 1 }],
      ppfAccounts: [{ balanceAsOf: "2026-01-01", confirmedBalance: 0, createdAt: "2026-01-01T10:00:00.000Z", id: "ppf-account", legacyAssetId: "asset-ppf", nickname: "Primary", opening: { kind: "financialYear" as const, financialYearStart: 2025 }, provider: "India Post", status: "active" as const }],
      ppfLedgerEntries: [{ accountId: "ppf-account", amount: 500, date: "2026-01-02", id: "ppf-contribution", recordedAt: "2026-01-02T10:00:00.000Z", type: "contribution" as const }],
      preferences: { defaultChartRange: "ALL", displayMode: "standard", hasCompletedOnboarding: true, maskWealthValues: false },
      schemaVersion: 11,
      trades: [
        { assetId: "asset-stock", date: "2026-01-02", fees: 2, id: "trade-buy", importProvenance: { fingerprint: "synthetic-fingerprint", importBatchId: "batch-cas", originalRowNumber: 1, sourceFormat: "cams-kfin-cas", sourceVersion: "1" }, pricePerUnit: 100, quantity: 2, totalValue: 202, type: "buy" as const },
        { assetId: "asset-stock", date: "2026-01-03", fees: 2, id: "trade-sell", pricePerUnit: 120, quantity: 1, totalValue: 118, type: "sell" as const },
      ],
    },
    quoteCache: {
      "asset-crypto": { assetId: "asset-crypto", asOf: "2026-01-04T10:00:00.000Z", currency: "INR", price: 110, source: "manual" },
      "asset-stock": { assetId: "asset-stock", asOf: "2026-01-04T10:00:00.000Z", currency: "INR", price: 120, source: "manual" },
    },
  };
}

async function backup() {
  return createPortfolioBackup(payload(), { appVersion: "1.0.1", createdAt: "2026-09-10T10:00:00.000Z" }, digest);
}

function bonusPayload(): BackupPayload {
  const value = payload();
  const event = bonusShareCatalog[0];
  if (!event || event.kind !== "bonus" || !event.creditedDate) throw new Error("A reviewed bonus fixture with a credit date is required.");
  value.portfolio.assets.push({
    assetClass: "stock", currency: "INR", exchange: "NSE", id: "asset-bonus",
    name: "Berger Paints", symbol: "BERGEPAINT", ticker: "BERGEPAINT.NS",
    isin: event.newIsin, stockSplits: [{ ...event, evidence: { ...event.evidence } }],
  });
  value.portfolio.trades.push(
    { assetId: "asset-bonus", id: "before-bonus", date: "2023-09-01", type: "buy", quantity: event.oldShares, pricePerUnit: 100, totalValue: event.oldShares * 100 },
    { assetId: "asset-bonus", id: "after-bonus", date: event.creditedDate, type: "sell", quantity: event.oldShares + event.newShares, pricePerUnit: 100, totalValue: (event.oldShares + event.newShares) * 100 },
  );
  return value;
}

describe("portable portfolio backup", () => {
  it("round trips catalog bonus credits in schema11 with additional-share inventory semantics", async () => {
    const original = bonusPayload();
    const text = await createPortfolioBackup(original, { appVersion: "1", createdAt: "2026-09-11T10:00:00.000Z" }, digest);
    expect(JSON.parse(text).payload.portfolio.schemaVersion).toBe(11);
    expect((await parsePortfolioBackup(text, digest)).payload).toEqual(original);
  });

  it.each(["ratio", "identity", "evidence", "duplicate", "fractional", "pre-credit sale"])("rejects bonus backup with %s corruption", (scenario) => {
    const value = bonusPayload();
    const event = value.portfolio.assets.at(-1)!.stockSplits![0];
    if (scenario === "ratio") event.newShares += 1;
    if (scenario === "identity") event.oldIsin = "INE040A01034";
    if (scenario === "evidence") event.evidence.url = "https://example.com/unverified.pdf";
    if (scenario === "duplicate") value.portfolio.assets.at(-1)!.stockSplits!.push({ ...event });
    if (scenario === "pre-credit sale") value.portfolio.trades.at(-1)!.date = event.effectiveDate;
    if (scenario === "fractional") {
      const buy = value.portfolio.trades.at(-2)!;
      if (buy.type !== "buy") throw new Error("Bonus fixture purchase is missing.");
      buy.quantity = 1;
      buy.totalValue = 100;
    }
    expect(() => validateBackupPayload(value)).toThrow();
  });

  it.each([9, 10])("upgrades a genuinely signed V%s backup to V11 without changing records", async (schemaVersion) => {
    const source = JSON.parse(await backup());
    delete source.checksum;
    source.payload.portfolio.schemaVersion = schemaVersion;
    function canonical(value: unknown): string {
      if (value === null || typeof value !== "object") return JSON.stringify(value);
      if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
      const record = value as Record<string, unknown>;
      return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
    }
    const signed = { ...source, checksum: await digest(canonical(source)) };
    expect((await parsePortfolioBackup(JSON.stringify(signed), digest)).payload).toEqual(payload());
    expect(validateBackupPayload(source.payload).portfolio.schemaVersion).toBe(11);
    signed.payload.portfolio.preferences.maskWealthValues = true;
    await expect(parsePortfolioBackup(JSON.stringify(signed), digest)).rejects.toThrow("checksum");
  });

  it.each([8, 12])("rejects unsupported portfolio schema %s", (schemaVersion) => {
    const current = payload();
    expect(() => validateBackupPayload({ ...current, portfolio: { ...current.portfolio, schemaVersion } })).toThrow("supported snapshot");
  });

  it("captures and round trips the visual QA seed before file selection", async () => {
    const store = createPortfolioStore({
      now: () => new Date("2026-09-10T10:00:00.000Z"),
      storage: createMemoryJsonStorage(),
    });
    seedVisualQaPortfolio(store);

    const captured = store.getState().captureBackup();
    const text = await createPortfolioBackup(
      captured.payload,
      { appVersion: "1.0.1", createdAt: "2026-09-10T10:00:00.000Z" },
      digest,
    );
    expect((await parsePortfolioBackup(text, digest)).payload).toEqual(
      captured.payload,
    );
  });

  it("round trips a mixed portfolio with manual provenance, CAS, and PPF", async () => {
    const decoded = await parsePortfolioBackup(await backup(), digest);
    expect(decoded.payload).toEqual(payload());
    expect(Object.isFrozen(decoded.payload)).toBe(true);
    expect(Object.isFrozen(decoded.payload.portfolio.assets)).toBe(true);
    expect(decoded.payload.quoteCache["asset-stock"]?.source).toBe("manual");
  });

  it("uses deterministic canonical bytes independent of input key order", async () => {
    const first = await backup();
    const second = await createPortfolioBackup(JSON.parse(JSON.stringify(payload())) as BackupPayload, { createdAt: "2026-09-10T10:00:00.000Z", appVersion: "1.0.1" }, digest);
    expect(second).toBe(first);
  });

  it.each([["corrupt JSON", "{"], ["wrong format", JSON.stringify({ format: "other" })]])("rejects %s", async (_label, text) => {
    await expect(parsePortfolioBackup(text, digest)).rejects.toThrow("Invalid CogVest backup");
  });

  it("rejects checksum corruption, unknown fields, and unsupported versions", async () => {
    const parsed = JSON.parse(await backup()) as Record<string, unknown>;
    parsed.appVersion = "tampered";
    await expect(parsePortfolioBackup(JSON.stringify(parsed), digest)).rejects.toThrow("checksum");
    const valid = JSON.parse(await backup()) as Record<string, unknown>;
    valid.unrecognized = true;
    await expect(parsePortfolioBackup(JSON.stringify(valid), digest)).rejects.toThrow("fields");
    const unsupported = JSON.parse(await backup()) as Record<string, unknown>;
    unsupported.formatVersion = 2;
    await expect(parsePortfolioBackup(JSON.stringify(unsupported), digest)).rejects.toThrow("format version");
  });

  it("rejects graph corruption and a CAS payload without its identity salt", async () => {
    const invalid = payload();
    const sale = invalid.portfolio.trades[1];
    if (!sale || sale.type !== "sell") throw new Error("Fixture sale is missing.");
    invalid.portfolio.trades[1] = { ...sale, quantity: 3, totalValue: 358 };
    invalid.portfolio.cashEntries[2] = { ...invalid.portfolio.cashEntries[2], amount: 358 };
    await expect(createPortfolioBackup(invalid, { appVersion: "1", createdAt: "2026-09-10T10:00:00.000Z" }, digest)).rejects.toThrow("oversells");
    const noSalt = payload();
    noSalt.casFolioSalt = null;
    await expect(createPortfolioBackup(noSalt, { appVersion: "1", createdAt: "2026-09-10T10:00:00.000Z" }, digest)).rejects.toThrow("CAS provenance");
  });

  it("rejects nested unknown records and oversized input", async () => {
    const invalid = JSON.parse(await backup()) as { payload: { portfolio: { assets: Array<Record<string, unknown>> } } };
    invalid.payload.portfolio.assets[0].unsupported = true;
    await expect(parsePortfolioBackup(JSON.stringify(invalid), digest)).rejects.toThrow("unsupported field");
    await expect(parsePortfolioBackup(" ".repeat(backupMaxBytes + 1), digest)).rejects.toThrow("size");
  });

  it.each([
    ["missing required array", (value: BackupPayload) => { delete (value.portfolio as unknown as Record<string, unknown>).trades; }],
    ["duplicate asset ID", (value: BackupPayload) => { value.portfolio.assets.push({ ...value.portfolio.assets[0]!, ticker: "COPY.NS" }); }],
    ["invalid calendar date", (value: BackupPayload) => { value.portfolio.cashEntries[0]!.date = "2026-02-30"; }],
    ["invalid timestamp date", (value: BackupPayload) => { value.quoteCache["asset-stock"]!.asOf = "2026-02-30T10:00:00.000Z"; }],
    ["invalid planned holding period", (value: BackupPayload) => { value.portfolio.trades[0] = { ...value.portfolio.trades[0]!, intendedHoldDays: 1.5 }; }],
    ["duplicate scoped import fingerprint", (value: BackupPayload) => { const trade = value.portfolio.trades[1]; if (!trade || trade.type !== "sell") throw new Error("Fixture sale is missing."); value.portfolio.trades[1] = { ...trade, importProvenance: { ...value.portfolio.trades[0]!.importProvenance!, originalRowNumber: 2 } }; }],
    ["invalid snapshot total", (value: BackupPayload) => { value.portfolio.monthlySnapshots[0]!.portfolioValue += 1; }],
    ["invalid native currency", (value: BackupPayload) => { value.portfolio.assets[1]!.currency = "USD"; }],
  ])("rejects %s", async (_label, mutate) => {
    const invalid = payload();
    mutate(invalid);
    await expect(createPortfolioBackup(invalid, { appVersion: "1", createdAt: "2026-09-10T10:00:00.000Z" }, digest)).rejects.toThrow();
  });

  it("rejects parser normalization and catches invalid nudge fields", async () => {
    const invalid = payload();
    (invalid.portfolio.preferences as unknown as { nudgeVersions?: unknown }).nudgeVersions = { metadata: "not-a-version" };
    await expect(createPortfolioBackup(invalid, { appVersion: "1", createdAt: "2026-09-10T10:00:00.000Z" }, digest)).rejects.toThrow("not canonical");
    const normalized = payload();
    normalized.portfolio.assets[0] = { ...normalized.portfolio.assets[0]!, isin: " ine040a01034 " };
    await expect(createPortfolioBackup(normalized, { appVersion: "1", createdAt: "2026-09-10T10:00:00.000Z" }, digest)).rejects.toThrow("not canonical");
  });

  it("accepts a missing CAS salt only when the exact CAS source is absent", async () => {
    const noCas = payload();
    noCas.casFolioSalt = null;
    const trade = noCas.portfolio.trades[0];
    if (!trade || trade.type !== "buy") throw new Error("Fixture buy is missing.");
    noCas.portfolio.trades[0] = { ...trade, importProvenance: { ...trade.importProvenance!, sourceFormat: "not-a-cas-source" } };
    await expect(createPortfolioBackup(noCas, { appVersion: "1", createdAt: "2026-09-10T10:00:00.000Z" }, digest)).resolves.toContain("checksum");
  });

  it("bounds deeply nested input, financial magnitude, and CAS salt encoding", async () => {
    const tooDeep = payload();
    let nested: unknown[] = [];
    for (let index = 0; index <= 24; index += 1) nested = [nested];
    (tooDeep.portfolio.assets[0] as unknown as { name: unknown }).name = nested;
    await expect(createPortfolioBackup(tooDeep, { appVersion: "1", createdAt: "2026-09-10T10:00:00.000Z" }, digest)).rejects.toThrow("deep");
    const tooLarge = payload();
    tooLarge.portfolio.cashEntries[0]!.amount = 1_000_000_000_000_001;
    await expect(createPortfolioBackup(tooLarge, { appVersion: "1", createdAt: "2026-09-10T10:00:00.000Z" }, digest)).rejects.toThrow("bounds");
    const malformedSalt = payload();
    malformedSalt.casFolioSalt = "f".repeat(63);
    await expect(createPortfolioBackup(malformedSalt, { appVersion: "1", createdAt: "2026-09-10T10:00:00.000Z" }, digest)).rejects.toThrow("malformed");
    const malformedNoCasSalt = payload();
    const trade = malformedNoCasSalt.portfolio.trades[0];
    if (!trade || trade.type !== "buy") throw new Error("Fixture buy is missing.");
    malformedNoCasSalt.portfolio.trades[0] = { ...trade, importProvenance: { ...trade.importProvenance!, sourceFormat: "cogvest-transactions" } };
    malformedNoCasSalt.casFolioSalt = "f".repeat(63);
    await expect(createPortfolioBackup(malformedNoCasSalt, { appVersion: "1", createdAt: "2026-09-10T10:00:00.000Z" }, digest)).rejects.toThrow("malformed");
  });

  it("round trips a bounded large portfolio and rejects an oversized collection", async () => {
    const large = payload();
    large.casFolioSalt = null;
    large.portfolio.assets = Array.from({ length: 500 }, (_, index) => ({
      assetClass: "stock" as const,
      currency: "INR" as const,
      exchange: "NSE" as const,
      id: `asset-${index}`,
      instrumentType: "stock" as const,
      name: `Asset ${index}`,
      sectorType: "other" as const,
      symbol: `ASSET${index}`,
      ticker: `ASSET${index}.NS`,
    }));
    large.portfolio.openingPositions = large.portfolio.assets.map((asset, index) => ({
      assetId: asset.id,
      averageCostPrice: 100 + index,
      date: "2020-01-01",
      id: `opening-${index}`,
      quantity: 1,
    }));
    large.portfolio.trades = [];
    large.portfolio.cashEntries = [];
    large.portfolio.ppfAccounts = [];
    large.portfolio.ppfLedgerEntries = [];
    large.portfolio.monthlySnapshots = Array.from({ length: 120 }, (_, index) => {
      const month = new Date(Date.UTC(2016, index, 1)).toISOString().slice(0, 7);
      return { cashValue: 0, cryptoValue: 0, debtValue: 0, equityValue: 0, id: `snapshot-${month}`, investedValue: 0, month, monthlyInvestment: 0, portfolioValue: 0 };
    });
    large.quoteCache = {};
    large.historicalQuoteCache = {};
    const text = await createPortfolioBackup(large, { appVersion: "1", createdAt: "2026-09-10T10:00:00.000Z" }, digest);
    expect((await parsePortfolioBackup(text, digest)).payload.portfolio.assets).toHaveLength(500);
    expect((await parsePortfolioBackup(text, digest)).payload.portfolio.monthlySnapshots).toHaveLength(120);
    const oversized = payload();
    oversized.portfolio.assets = Array.from({ length: 10_001 }, (_, index) => ({ ...oversized.portfolio.assets[0]!, id: `oversized-${index}`, ticker: `OVERSIZED${index}.NS` }));
    expect(() => validateBackupPayload(oversized)).toThrow("collection is too large");
  });
});
