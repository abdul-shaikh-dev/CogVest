import { buildGeneratedMonthEndSnapshot } from "@/src/domain/calculations/monthEndSnapshots";
import { validateBackupPayload, type BackupPayload } from "@/src/domain/portfolioBackup";
import { stockSplitCatalog } from "@/src/domain/stockSplitCatalog";
import type { DailyPriceEntry } from "@/src/services/quotes/dailyPriceCache";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createDefaultPreferences, createPortfolioStore, portfolioSchemaVersion } from "@/src/store";
import type { RawPortfolioSnapshot } from "@/src/store";
import {
  historicalQuoteCacheKey,
  type Asset,
  type CashEntry,
  type DistributionCoverage,
  type HistoricalQuoteCache,
  type MonthlySnapshot,
  type OpeningPosition,
  type Quote,
  type QuoteCache,
  type Trade,
} from "@/src/types";

/**
 * Synthetic, real-shaped portfolio for #843: a long-held, fund-heavy Indian
 * portfolio with the awkward cases that bit real users (#824, #833, #823).
 * Every name, identifier and amount is made up. Records stop at
 * `realShapedRecordsEnd`, so values do not depend on the day the fixture is
 * built; only the snapshot months and quote timestamps follow `now`.
 *
 * There is no USD holding: backups accept INR assets only until #762.
 */
export const realShapedFirstMonth = "2019-01";
export const realShapedLastRecordMonth = "2026-10";
export const realShapedRecordsEnd = "2026-10-31";

type FundSpec = {
  key: string;
  name: string;
  annualRate: number;
  assetClass: Asset["assetClass"];
  instrumentType: NonNullable<Asset["instrumentType"]>;
  sectorType?: Asset["sectorType"];
  sectorBasis?: Asset["sectorBasis"];
  international?: boolean;
  sip: number;
  /** Months from January 2019 the SIP runs, inclusive. */
  from: number;
  to: number;
  baseNav: number;
};

const lastMonthIndex = monthIndex(realShapedLastRecordMonth);

/** Twenty-two schemes across six fictional fund houses. */
export const realShapedFunds: readonly FundSpec[] = [
  fund("aster-large", "Aster Large Cap Fund - Direct Plan - Growth", 0.12, 5000, 0, lastMonthIndex, 42.5),
  fund("aster-elss", "Aster Tax Saver (ELSS) Fund - Direct Plan - Growth", 0.135, 1500, 0, 50, 68.2),
  fund("banyan-flexi", "Banyan Flexi Cap Fund - Direct Plan - Growth", 0.14, 7500, 0, lastMonthIndex, 31.75),
  fund("banyan-mid", "Banyan Mid Cap Opportunities Fund - Direct Plan - Growth", 0.17, 4000, 6, lastMonthIndex, 54.1),
  fund("cedar-small", "Cedar Small Cap Fund - Direct Plan - Growth", 0.19, 3000, 12, lastMonthIndex, 21.4),
  fund("cedar-nifty", "Cedar Nifty 50 Index Fund - Direct Plan - Growth", 0.125, 10000, 0, lastMonthIndex, 102.3),
  fund("cedar-next50", "Cedar Nifty Next 50 Index Fund - Direct Plan - Growth", 0.13, 2500, 24, lastMonthIndex, 15.9),
  fund("deodar-bank", "Deodar Banking and Financial Services Fund - Direct Plan - Growth", 0.11, 2000, 18, 70, 12.6,
    { sectorType: "financialServices" }),
  fund("deodar-tech", "Deodar Technology Fund - Direct Plan - Growth", 0.15, 2000, 30, lastMonthIndex, 88.8,
    { sectorType: "technology" }),
  fund("deodar-pharma", "Deodar Healthcare Fund - Direct Plan - Growth", 0.13, 1500, 20, lastMonthIndex, 26.35,
    { sectorType: "healthcare" }),
  fund("elm-us", "Elm US Equity Fund of Fund - Direct Plan - Growth", 0.16, 3000, 10, 64, 18.05,
    { international: true }),
  fund("elm-baf", "Elm Balanced Advantage Fund - Direct Plan - Growth", 0.11, 3000, 0, lastMonthIndex, 47.6),
  fund("elm-multi", "Elm Multi Asset Allocation Fund - Direct Plan - Growth", 0.115, 2000, 36, lastMonthIndex, 33.3),
  fund("fern-value", "Fern Value Fund - Direct Plan - Growth", 0.15, 2500, 8, lastMonthIndex, 72.9),
  fund("fern-focused", "Fern Focused Equity Fund - Direct Plan - Growth", 0.13, 2000, 0, 40, 29.15),
  fund("fern-infra", "Fern Infrastructure Fund - Direct Plan - Growth", 0.16, 1500, 28, lastMonthIndex, 19.7,
    { sectorType: "industrial" }),
  // The provider listed no sector and the scheme name gives none (#823).
  fund("fern-special", "Fern Special Situations Fund - Direct Plan - Growth", 0.12, 1000, 44, lastMonthIndex, 11.2,
    { sectorBasis: "providerHadNone", sectorType: "other" }),
  fund("aster-bond", "Aster Corporate Bond Fund - Direct Plan - Growth", 0.075, 3000, 0, lastMonthIndex, 23.05,
    { assetClass: "debt", sectorType: "fixedIncome" }),
  fund("banyan-gilt", "Banyan Gilt Fund - Direct Plan - Growth", 0.07, 1500, 12, 80, 61.4,
    { assetClass: "debt", sectorType: "fixedIncome" }),
  fund("cedar-liquid", "Cedar Liquid Fund - Direct Plan - Growth", 0.065, 0, 0, 0, 2150.5,
    { assetClass: "debt", instrumentType: "liquidFund", sectorType: "liquidity" }),
  fund("deodar-arb", "Deodar Arbitrage Fund - Direct Plan - Growth", 0.07, 0, 0, 0, 25.85,
    { assetClass: "debt", instrumentType: "arbitrageFund", sectorType: "liquidity" }),
  // Merged into "aster-large" in June 2022: units move out, the target receives them.
  fund("aster-bluechip", "Aster Bluechip Fund - Direct Plan - Growth", 0.12, 2000, 0, 41, 36.8),
];

type StockSpec = {
  key: string;
  name: string;
  ticker: string;
  assetClass: "stock" | "etf";
  sectorType: NonNullable<Asset["sectorType"]>;
  annualRate: number;
  basePrice: number;
  /** [monthIndex, quantity] buys; a negative quantity is a sale. */
  lots: Array<[number, number]>;
  isin?: string;
};

export const realShapedStocks: readonly StockSpec[] = [
  stock("synbank", "Synthetic Bank Ltd", "SYNBANK.NS", "financialServices", 0.1, 1210, [[2, 10], [14, 5], [40, -4], [70, 6]]),
  stock("synsoft", "Synthetic Softworks Ltd", "SYNSOFT.NS", "technology", 0.14, 1640, [[5, 8], [29, 4], [61, 3]]),
  stock("synpower", "Synthetic Power Grid Ltd", "SYNPOWER.NS", "utilities", 0.12, 190, [[9, 120], [45, 60], [88, -50]]),
  stock("synfmcg", "Synthetic Consumer Goods Ltd", "SYNFMCG.NS", "consumer", 0.09, 2280, [[20, 6], [55, 4]]),
  stock("synauto", "Synthetic Motors Ltd", "SYNAUTO.NS", "consumer", 0.15, 7020, [[33, 2], [66, 1]]),
  stock("synpharma", "Synthetic Pharma Ltd", "SYNPHARMA.NS", "healthcare", 0.11, 640, [[16, 25], [50, 15]]),
  // Bought before a verified 1:5 split (28 October 2021), so held units are pre-split x 5 (#833).
  stock("synrail", "Synthetic Rail Catering Ltd", "SYNRAIL.NS", "industrial", 0.13, 1390, [[14, 10], [26, 4], [60, 20]],
    stockSplitCatalog[0].newIsin),
  stock("synniftyetf", "Synthetic Nifty 50 ETF", "SYNNIFTYETF.NS", "diversified", 0.125, 118, [[1, 100], [25, 80], [73, 60]], undefined, "etf"),
  stock("syngoldetf", "Synthetic Gold ETF", "SYNGOLDETF.NS", "commodities", 0.11, 38.5, [[12, 300], [48, 250], [84, -150]], undefined, "etf"),
];

function fund(
  key: string, name: string, annualRate: number, sip: number, from: number, to: number, baseNav: number,
  overrides: Partial<FundSpec> = {},
): FundSpec {
  return {
    annualRate, assetClass: "stock", baseNav, from, instrumentType: "mutualFund", key, name,
    sectorBasis: "schemeName", sectorType: "diversified", sip, to, ...overrides,
  };
}

function stock(
  key: string, name: string, ticker: string, sectorType: StockSpec["sectorType"], annualRate: number,
  basePrice: number, lots: StockSpec["lots"], isin?: string, assetClass: StockSpec["assetClass"] = "stock",
): StockSpec {
  return { annualRate, assetClass, basePrice, isin, key, lots, name, sectorType, ticker };
}

function monthIndex(month: string) {
  const [year, value] = month.split("-").map(Number);
  return (year - 2019) * 12 + value - 1;
}

export function monthAt(index: number) {
  const date = new Date(Date.UTC(2019, index, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function round(value: number, places: number) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

/** Deterministic compounding: the price `months` after January 2019. */
export function syntheticPrice(base: number, annualRate: number, months: number) {
  return round(base * (1 + annualRate) ** (months / 12), 4);
}

/** Synthetic ISIN in the real shape: two letters, nine alphanumerics, one digit. */
function syntheticIsin(index: number) {
  return `INFSYN${String(index).padStart(5, "0")}0`;
}

export const realShapedIds = {
  fund: (key: string) => `rs-fund-${key}`,
  stock: (key: string) => `rs-stock-${key}`,
  manual: "rs-manual-unlisted",
  crypto: "rs-crypto-synth",
  ppf: "rs-ppf",
  epf: "rs-epf",
} as const;

function fundAssets(): Asset[] {
  return realShapedFunds.map((spec, index) => {
    const isin = syntheticIsin(index + 1);
    return {
      assetClass: spec.assetClass,
      currency: "INR",
      id: realShapedIds.fund(spec.key),
      instrumentType: spec.instrumentType,
      isin,
      name: spec.name,
      quoteSourceId: isin,
      sectorBasis: spec.sectorBasis,
      sectorType: spec.sectorType,
      symbol: isin,
      ticker: isin,
      ...(spec.international ? { international: true } : {}),
    };
  });
}

function stockAssets(): Asset[] {
  return realShapedStocks.map((spec) => {
    const split = spec.isin === stockSplitCatalog[0].newIsin ? stockSplitCatalog[0] : undefined;
    return {
      assetClass: spec.assetClass,
      currency: "INR",
      exchange: "NSE",
      id: realShapedIds.stock(spec.key),
      instrumentType: spec.assetClass === "etf" ? "etf" : "stock",
      name: spec.name,
      sectorBasis: "user",
      sectorType: spec.sectorType,
      symbol: spec.ticker.replace(".NS", ""),
      ticker: spec.ticker,
      ...(spec.isin ? { isin: spec.isin } : {}),
      ...(split ? { stockSplits: [{ ...split, evidence: { ...split.evidence } }] } : {}),
    };
  });
}

const otherAssets: Asset[] = [
  {
    assetClass: "stock", currency: "INR", id: realShapedIds.manual, instrumentType: "other",
    name: "Synthetic Unlisted Pvt Ltd", sectorBasis: "user", sectorType: "technology",
    symbol: "SYNUNLISTED", ticker: "SYNUNLISTED",
  },
  {
    assetClass: "crypto", currency: "INR", exchange: "CRYPTO", id: realShapedIds.crypto, instrumentType: "crypto",
    name: "Synthetic Coin", quoteSourceId: "synthetic-coin", sectorType: "digitalAsset", symbol: "SYNC",
    ticker: "synthetic-coin",
  },
];

const split = stockSplitCatalog[0];
const splitMonth = monthIndex(split.effectiveDate.slice(0, 7));
export const realShapedSplitRatio = split.newShares / split.oldShares;

function fundPrice(spec: FundSpec, month: number) {
  return syntheticPrice(spec.baseNav, spec.annualRate, month);
}

/** Lots before the split are in pre-split shares; prices from the split month are per post-split share. */
function stockPrice(spec: StockSpec, month: number) {
  const factor = spec.isin === split.newIsin && month >= splitMonth ? realShapedSplitRatio : 1;
  return syntheticPrice(spec.basePrice / factor, spec.annualRate, month);
}

/** December 2018: the PPF checkpoint is dated 31 December 2018, so the app expects that month too. */
export const firstSnapshotMonth = -1;

const mergerMonth = 41;

function fundTrades(): Trade[] {
  const trades: Trade[] = [];
  for (const spec of realShapedFunds) {
    const assetId = realShapedIds.fund(spec.key);
    let units = 0;
    if (spec.sip > 0) {
      for (let month = spec.from; month <= spec.to; month += 1) {
        const price = fundPrice(spec, month);
        const quantity = round(spec.sip / price, 3);
        units = round(units + quantity, 3);
        trades.push({
          assetId, date: `${monthAt(month)}-05`, fundingSource: "external", id: `${assetId}-sip-${monthAt(month)}`,
          // Units are rounded to three places, so the debit is a few paise off the SIP amount, as on a statement.
          pricePerUnit: price, quantity, totalValue: round(quantity * price, 2), type: "buy",
        });
      }
    }
    if (spec.key === "aster-bluechip") {
      const price = fundPrice(spec, mergerMonth);
      const target = realShapedFunds.find((item) => item.key === "aster-large")!;
      const targetPrice = fundPrice(target, mergerMonth);
      const received = round((units * price) / targetPrice, 3);
      trades.push({ assetId, date: `${monthAt(mergerMonth)}-24`, id: `${assetId}-merger-out`, quantity: units,
        notes: "Scheme merged into Aster Large Cap Fund", type: "transferOut" });
      trades.push({ acquisitionCostPerUnit: round((units * averageCost(trades, assetId)) / received, 4),
        assetId: realShapedIds.fund("aster-large"), date: `${monthAt(mergerMonth)}-24`, id: `${assetId}-merger-in`,
        notes: "Units received from the Aster Bluechip Fund merger", quantity: received, type: "transferIn" });
    }
  }
  // Partial redemptions: rebalancing out of small cap, and the ELSS after lock-in.
  // Each sale reads the units held before it, so add them one at a time.
  const add = (make: () => Trade) => trades.push(make());
  add(() => sell("cedar-small", 62, 0.25));
  add(() => sell("aster-elss", 74, 0.5));
  add(() => sell("banyan-flexi", 86, 0.1));
  // Liquid and arbitrage funds hold parked money: lump sums in, partial redemptions out.
  add(() => lump("cedar-liquid", 3, 150000));
  add(() => lump("cedar-liquid", 27, 80000));
  add(() => sell("cedar-liquid", 35, 0.4));
  add(() => lump("cedar-liquid", 59, 120000));
  add(() => sell("cedar-liquid", 79, 0.3));
  add(() => lump("deodar-arb", 38, 100000));
  add(() => lump("deodar-arb", 76, 60000));
  add(() => sell("deodar-arb", 90, 0.5));
  return trades;

  function averageCost(list: Trade[], assetId: string) {
    const buys = list.filter((trade) => trade.assetId === assetId && trade.type === "buy");
    const cost = buys.reduce((sum, trade) => sum + (trade.type === "buy" ? trade.totalValue : 0), 0);
    const quantity = buys.reduce((sum, trade) => sum + trade.quantity, 0);
    return cost / quantity;
  }

  function lump(key: string, month: number, amount: number): Trade {
    const spec = realShapedFunds.find((item) => item.key === key)!;
    const price = fundPrice(spec, month);
    return { assetId: realShapedIds.fund(key), date: `${monthAt(month)}-12`, fundingSource: "external",
      id: `${realShapedIds.fund(key)}-lump-${monthAt(month)}`, pricePerUnit: price,
      quantity: round(amount / price, 3), totalValue: round(round(amount / price, 3) * price, 2), type: "buy" };
  }

  function sell(key: string, month: number, share: number): Trade {
    const spec = realShapedFunds.find((item) => item.key === key)!;
    const assetId = realShapedIds.fund(key);
    const date = `${monthAt(month)}-18`;
    const held = trades.filter((trade) => trade.assetId === assetId && trade.date < date)
      .reduce((sum, trade) => sum + (trade.type === "buy" || trade.type === "transferIn" ? trade.quantity : -trade.quantity), 0);
    const price = fundPrice(spec, month);
    const quantity = round(held * share, 3);
    return { assetId, date, fundingSource: "external", id: `${assetId}-sell-${monthAt(month)}`, pricePerUnit: price,
      quantity, totalValue: round(quantity * price, 2), type: "sell" };
  }
}

function stockTrades(): Trade[] {
  return realShapedStocks.flatMap((spec) => spec.lots.map(([month, quantity]) => {
    const assetId = realShapedIds.stock(spec.key);
    const price = stockPrice(spec, month);
    const units = Math.abs(quantity);
    const fees = round(units * price * 0.0012, 2);
    const gross = round(units * price, 2);
    return {
      assetId, date: `${monthAt(month)}-14`, fees, fundingSource: "external" as const,
      id: `${assetId}-${quantity > 0 ? "buy" : "sell"}-${monthAt(month)}`, pricePerUnit: price, quantity: units,
      totalValue: quantity > 0 ? round(gross + fees, 2) : round(gross - fees, 2), type: quantity > 0 ? "buy" as const : "sell" as const,
    };
  }));
}

function otherTrades(): Trade[] {
  return [
    { assetId: realShapedIds.crypto, date: "2021-11-02", fundingSource: "external", id: "rs-crypto-buy-2021",
      pricePerUnit: 41000, quantity: 0.5, totalValue: 20500, type: "buy" },
  ];
}

function openingPositions(): OpeningPosition[] {
  return [
    // Held before tracking started; the purchase date is unknown and the value is entered by hand.
    { assetId: realShapedIds.manual, averageCostPrice: 250, date: null, id: "rs-manual-opening",
      manualValuation: { asOf: "2026-09-30T12:00:00.000Z", currency: "INR", price: 410, provenance: "user", source: "manual" },
      quantity: 200, recordedAt: "2026-11-01T09:00:00.000Z", recordedOn: "2026-11-01" },
  ];
}

function cashEntries(): CashEntry[] {
  const entries: CashEntry[] = [];
  for (let month = 0; month <= lastMonthIndex; month += 3) {
    entries.push({ amount: 15000 + (month % 12) * 500, date: `${monthAt(month)}-01`, id: `rs-cash-add-${monthAt(month)}`,
      institution: "Synthetic Savings Bank", label: "Emergency fund top-up", purpose: "capitalContribution", type: "addition" });
  }
  for (const month of [17, 44, 71]) {
    entries.push({ amount: 30000, date: `${monthAt(month)}-20`, id: `rs-cash-withdraw-${monthAt(month)}`,
      institution: "Synthetic Savings Bank", label: "Planned expense", purpose: "withdrawal", type: "withdrawal" });
  }
  return entries;
}

function coverage(assets: Asset[]): DistributionCoverage[] {
  // Growth plans and the listed holdings pay nothing that is not recorded: confirmed from the first record.
  return assets.filter((asset) => asset.assetClass !== "crypto").map((asset) => ({
    assetId: asset.id, confirmedAt: "2026-11-01T09:00:00.000Z", from: "2018-12-01",
  }));
}

function currentQuotes(assets: Asset[], now: Date): QuoteCache {
  const asOf = now.toISOString();
  const quotes: Quote[] = [
    ...realShapedFunds.map((spec) => ({ assetId: realShapedIds.fund(spec.key), asOf, currency: "INR" as const,
      price: fundPrice(spec, lastMonthIndex), source: "amfi" as const })),
    ...realShapedStocks.map((spec) => ({ assetId: realShapedIds.stock(spec.key), asOf, currency: "INR" as const,
      price: stockPrice(spec, lastMonthIndex), source: "yahoo" as const })),
    { assetId: realShapedIds.crypto, asOf, currency: "INR", price: 52500, source: "coingecko" },
  ];
  const ids = new Set(assets.map((asset) => asset.id));
  return Object.fromEntries(quotes.filter((quote) => ids.has(quote.assetId)).map((quote) => [quote.assetId, quote]));
}

function historicalQuotes(lastMonth: number, now: Date): HistoricalQuoteCache {
  const fetchedAt = now.toISOString();
  const cache: HistoricalQuoteCache = {};
  for (let month = firstSnapshotMonth; month <= lastMonth; month += 1) {
    const priceMonth = Math.min(month, lastMonthIndex);
    const asOfMonth = monthAt(month);
    for (const spec of realShapedFunds) {
      const assetId = realShapedIds.fund(spec.key);
      cache[historicalQuoteCacheKey(assetId, asOfMonth)] = { asOfMonth, assetId, basis: "historical-close",
        currency: "INR", fetchedAt, price: fundPrice(spec, priceMonth), source: "amfi" };
    }
    for (const spec of realShapedStocks) {
      const assetId = realShapedIds.stock(spec.key);
      // Before the split the app keeps Yahoo's close converted back to pre-split shares.
      const basis = spec.isin === split.newIsin && month < splitMonth ? "reconciled-historical-close" : "historical-close";
      cache[historicalQuoteCacheKey(assetId, asOfMonth)] = { asOfMonth, assetId, basis,
        currency: "INR", fetchedAt, price: stockPrice(spec, priceMonth), source: "yahoo" };
    }
    cache[historicalQuoteCacheKey(realShapedIds.crypto, asOfMonth)] = { asOfMonth, assetId: realShapedIds.crypto,
      basis: "historical-close", currency: "INR", fetchedAt, price: round(30000 + priceMonth * 260, 2), source: "coingecko" };
  }
  return cache;
}

/** Daily NAVs on weekdays only, with one long provider gap that keeps the entry partial (#838). */
function dailyEntries(now: Date): DailyPriceEntry[] {
  const spec = realShapedFunds.find((item) => item.key === "cedar-nifty")!;
  const points: DailyPriceEntry["points"] = [];
  const cursor = new Date(Date.UTC(2019, 0, 1));
  const end = new Date(`${realShapedRecordsEnd}T00:00:00Z`);
  for (let day = 0; cursor <= end; day += 1, cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const date = cursor.toISOString().slice(0, 10);
    const weekday = cursor.getUTCDay();
    if (weekday === 0 || weekday === 6) continue;
    if (date >= "2023-03-01" && date <= "2023-03-12") continue;
    points.push({ close: syntheticPrice(spec.baseNav, spec.annualRate, day / 30.4375), date });
  }
  return [{
    basis: "close", complete: false, currency: "INR", fetchedAt: now.toISOString(), from: "2019-01-01",
    points, provider: "amfi", providerId: syntheticIsin(realShapedFunds.indexOf(spec) + 1), to: realShapedRecordsEnd,
  }];
}

function previousCompletedMonthIndex(now: Date) {
  return (now.getUTCFullYear() - 2019) * 12 + now.getUTCMonth() - 1;
}

export type RealShapedFixture = {
  dailyPriceEntries: DailyPriceEntry[];
  now: Date;
  payload: BackupPayload;
};

/**
 * Builds the payload through the production restore and account commands, then
 * saves one generated snapshot per completed month the way the app does.
 */
export function createRealShapedFixture(now = new Date("2026-11-15T06:00:00.000Z")): RealShapedFixture {
  const assets = [...fundAssets(), ...stockAssets(), ...otherAssets];
  const lastMonth = previousCompletedMonthIndex(now);
  if (lastMonth < lastMonthIndex) throw new Error("The real-shaped fixture needs a date after October 2026.");
  const portfolio: RawPortfolioSnapshot = {
    assets,
    cashEntries: cashEntries(),
    distributionCoverage: coverage(assets),
    distributions: [],
    epf: { accounts: [], audit: [], cashLinks: [], events: [] },
    futuresAccounts: [],
    measurementBasis: null,
    monthlySnapshots: [],
    openingPositions: openingPositions(),
    ppfAccounts: [],
    ppfLedgerEntries: [],
    preferences: { ...createDefaultPreferences(), hasCompletedOnboarding: true,
      nudgeVersions: { insights: 1, metadata: 1, minimal: 1 } },
    savingsGoals: [],
    schemaVersion: portfolioSchemaVersion,
    sipTemplates: [],
    trades: [...fundTrades(), ...stockTrades(), ...otherTrades()].sort((a, b) => a.date.localeCompare(b.date)),
  };
  const quoteCache = currentQuotes(assets, now);
  const historicalQuoteCache = historicalQuotes(lastMonth, now);

  const store = createPortfolioStore({ now: () => now, storage: createMemoryJsonStorage() });
  const state = () => store.getState();
  state().replaceFromBackup({ casFolioSalt: null, historicalQuoteCache, portfolio, quoteCache }, state().getBackupRevision());
  addAccounts(store);

  const records = state().captureBackup().payload;
  const monthlySnapshots: MonthlySnapshot[] = [];
  for (let month = firstSnapshotMonth; month <= lastMonth; month += 1) {
    const targetMonth = monthAt(month);
    const result = buildGeneratedMonthEndSnapshot({
      assets: records.portfolio.assets,
      cashEntries: records.portfolio.cashEntries,
      distributions: records.portfolio.distributions,
      existingSnapshots: monthlySnapshots,
      historicalQuotes: records.historicalQuoteCache,
      now,
      openingPositions: records.portfolio.openingPositions,
      ppfAccounts: records.portfolio.ppfAccounts,
      ppfLedgerEntries: records.portfolio.ppfLedgerEntries,
      quoteCache: records.quoteCache,
      targetMonth,
      trades: records.portfolio.trades,
    });
    if (!result.snapshot) throw new Error(`No snapshot for ${targetMonth}: ${result.status} ${result.warnings.join(" | ")}`);
    monthlySnapshots.push(result.snapshot);
  }
  const payload = validateBackupPayload({ ...records, portfolio: { ...records.portfolio, monthlySnapshots } });
  return { dailyPriceEntries: dailyEntries(now), now, payload };
}

function addAccounts(store: ReturnType<typeof createPortfolioStore>) {
  const recordedAt = "2026-11-01T09:00:00.000Z";
  const ppf = store.getState().addPpfAccount({
    balanceAsOf: "2018-12-31", confirmedBalance: 185000, createdAt: recordedAt, id: realShapedIds.ppf,
    nickname: "PPF", opening: { financialYearStart: 2012, kind: "financialYear" }, provider: "Synthetic Post Office",
    status: "active",
  });
  if (ppf.status === "rejected") {
    throw new Error(`PPF account was not added: ${JSON.stringify(ppf)}`);
  }
  const addLedger = (entry: Parameters<ReturnType<typeof store.getState>["addPpfLedgerEntry"]>[0]) => {
    const result = store.getState().addPpfLedgerEntry(entry);
    if (result.status === "rejected") throw new Error(`PPF entry ${entry.id} was rejected: ${JSON.stringify(result)}`);
  };
  let balance = 185000;
  for (let year = 2019; year <= 2026; year += 1) {
    const amount = 60000 + (year - 2019) * 5000;
    addLedger({ accountId: realShapedIds.ppf, amount, date: `${year}-04-04`,
      fundingSource: "external", id: `rs-ppf-contribution-${year}`, recordedAt, type: "contribution" });
    balance += amount;
    if (year < 2026) {
      const interest = round(balance * 0.071, 0);
      addLedger({ accountId: realShapedIds.ppf, amount: interest, date: `${year + 1}-03-31`,
        financialYearStart: year, id: `rs-ppf-interest-${year}`, recordedAt, type: "interestCredit" });
      balance += interest;
    }
  }
  store.getState().applyEpfCommand({ change: { account: {
    checkpoint: { balance: { components: null, total: 640000 }, capital: null, date: "2026-03-31",
      recordedAt, source: "epfoStatement" },
    currency: "INR", historyCompleteThrough: null, id: realShapedIds.epf, nickname: "EPF", provider: "epfo",
    status: "active",
  }, type: "accountPut" }, commandId: "rs-epf-setup", reason: "Synthetic statement" }, store.getState().getBackupRevision());
}
