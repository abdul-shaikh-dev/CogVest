import type { StoreApi } from "zustand/vanilla";

import type { AssetLookupResult } from "@/src/services/assetLookup";
import type { PortfolioStoreState } from "@/src/store";
import type {
  Asset,
  CashEntry,
  MonthlySnapshot,
  OpeningPosition,
  Quote,
} from "@/src/types";

declare const process: {
  env: Record<string, string | undefined>;
};

export const visualQaSeedToken = "cogvest-local-visual-qa";

export function canUseVisualQaHarness(token?: string) {
  return (
    __DEV__ ||
    (process.env.EXPO_PUBLIC_COGVEST_VISUAL_QA === "1" &&
      token === visualQaSeedToken)
  );
}

export const visualQaAssets: Asset[] = [
  {
    assetClass: "stock",
    currency: "INR",
    exchange: "NSE",
    id: "visual-qa-asset-hdfc",
    instrumentType: "stock",
    name: "HDFC Bank",
    quoteSourceId: "HDFCBANK.NS",
    sectorType: "financialServices",
    symbol: "HDFCBANK",
    ticker: "HDFCBANK.NS",
  },
  {
    assetClass: "etf",
    currency: "INR",
    exchange: "NSE",
    id: "visual-qa-asset-niftybees",
    instrumentType: "etf",
    name: "Nifty 50 ETF",
    quoteSourceId: "NIFTYBEES.NS",
    sectorType: "diversified",
    symbol: "NIFTYBEES",
    ticker: "NIFTYBEES.NS",
  },
  {
    assetClass: "debt",
    currency: "INR",
    exchange: "NSE",
    id: "visual-qa-asset-sgb",
    instrumentType: "bond",
    name: "Sovereign Gold Bond",
    quoteSourceId: "SGBJUN30.NS",
    sectorType: "fixedIncome",
    symbol: "SGBJUN30",
    ticker: "SGBJUN30.NS",
  },
  {
    assetClass: "crypto",
    currency: "INR",
    exchange: "CRYPTO",
    id: "visual-qa-asset-bitcoin",
    instrumentType: "crypto",
    name: "Bitcoin",
    quoteSourceId: "bitcoin",
    sectorType: "digitalAsset",
    symbol: "BTC",
    ticker: "bitcoin",
  },
];

export const visualQaOpeningPositions: OpeningPosition[] = [
  {
    assetId: "visual-qa-asset-hdfc",
    averageCostPrice: 1450,
    conviction: 4,
    currentPrice: 1678.25,
    date: "2024-04-15T00:00:00.000Z",
    id: "visual-qa-opening-hdfc",
    notes: "Core banking allocation",
    quantity: 25,
  },
  {
    assetId: "visual-qa-asset-niftybees",
    averageCostPrice: 244.2,
    currentPrice: 255.32,
    date: "2025-02-03T00:00:00.000Z",
    id: "visual-qa-opening-niftybees",
    notes: "Index fund exposure",
    quantity: 198,
  },
  {
    assetId: "visual-qa-asset-sgb",
    averageCostPrice: 5295,
    currentPrice: 5711,
    date: "2025-09-10T00:00:00.000Z",
    id: "visual-qa-opening-sgb",
    notes: "Debt and gold hedge",
    quantity: 10,
  },
  {
    assetId: "visual-qa-asset-bitcoin",
    averageCostPrice: 1100000,
    currentPrice: 1390400,
    date: "2026-01-20T00:00:00.000Z",
    id: "visual-qa-opening-bitcoin",
    notes: "Small crypto sleeve",
    quantity: 1,
  },
];

export const visualQaCashEntries: CashEntry[] = [
  {
    amount: 70000,
    date: "2026-05-03T00:00:00.000Z",
    id: "visual-qa-cash-salary",
    label: "Salary added",
    purpose: "income",
    type: "addition",
  },
  {
    amount: 15000,
    date: "2026-05-08T00:00:00.000Z",
    id: "visual-qa-cash-sip-index",
    label: "SIP transfer - Index Fund",
    purpose: "purchaseFunding",
    type: "withdrawal",
  },
  {
    amount: 10000,
    date: "2026-05-16T00:00:00.000Z",
    id: "visual-qa-cash-emergency",
    label: "Emergency fund top-up",
    purpose: "capitalContribution",
    type: "addition",
  },
  {
    amount: 15000,
    date: "2026-05-22T00:00:00.000Z",
    id: "visual-qa-cash-sip-large-cap",
    label: "SIP transfer - Large Cap",
    purpose: "purchaseFunding",
    type: "withdrawal",
  },
];

export const visualQaMonthlySnapshots: MonthlySnapshot[] = [
  {
    cashValue: 230000,
    cryptoValue: 104000,
    debtValue: 238000,
    equityValue: 868000,
    id: "visual-qa-snapshot-2025-11",
    investedValue: 1240000,
    month: "2025-11",
    monthlyExpense: 50000,
    monthlyInvestment: 58000,
    notes: "November warm-up trend seed",
    performanceBasis: {
      netExternalFlow: 58000,
      status: "complete",
      warnings: [],
      weightedExternalFlow: 29000,
    },
    portfolioValue: 1440000,
    salary: 165000,
  },
  {
    cashValue: 232000,
    cryptoValue: 110000,
    debtValue: 248000,
    equityValue: 910000,
    id: "visual-qa-snapshot-2025-12",
    investedValue: 1300000,
    month: "2025-12",
    monthlyExpense: 52000,
    monthlyInvestment: 62000,
    notes: "December opening trend seed",
    performanceBasis: {
      netExternalFlow: 62000,
      status: "complete",
      warnings: [],
      weightedExternalFlow: 31000,
    },
    portfolioValue: 1500000,
    salary: 165000,
  },
  {
    cashValue: 256000,
    cryptoValue: 112000,
    debtValue: 260000,
    equityValue: 952000,
    id: "visual-qa-snapshot-2026-01",
    investedValue: 1375000,
    month: "2026-01",
    monthlyExpense: 56000,
    monthlyInvestment: 70000,
    notes: "January steady contribution",
    performanceBasis: {
      netExternalFlow: 70000,
      status: "complete",
      warnings: [],
      weightedExternalFlow: 35000,
    },
    portfolioValue: 1580000,
    salary: 170000,
  },
  {
    cashValue: 301000,
    cryptoValue: 115000,
    debtValue: 274000,
    equityValue: 995000,
    id: "visual-qa-snapshot-2026-02",
    investedValue: 1460000,
    month: "2026-02",
    monthlyExpense: 58000,
    monthlyInvestment: 76000,
    notes: "February market lift",
    performanceBasis: {
      netExternalFlow: 76000,
      status: "complete",
      warnings: [],
      weightedExternalFlow: 38000,
    },
    portfolioValue: 1685000,
    salary: 170000,
  },
  {
    cashValue: 351000,
    cryptoValue: 118000,
    debtValue: 286000,
    equityValue: 1035000,
    id: "visual-qa-snapshot-2026-03",
    investedValue: 1555000,
    month: "2026-03",
    monthlyExpense: 54000,
    monthlyInvestment: 85000,
    notes: "March baseline",
    performanceBasis: {
      netExternalFlow: 85000,
      status: "complete",
      warnings: [],
      weightedExternalFlow: 42500,
    },
    portfolioValue: 1790000,
    salary: 170000,
  },
  {
    cashValue: 311450,
    cryptoValue: 121000,
    debtValue: 310000,
    equityValue: 1187000,
    id: "visual-qa-snapshot-2026-04",
    investedValue: 1676000,
    month: "2026-04",
    monthlyExpense: 62000,
    monthlyInvestment: 121000,
    notes: "April allocation lift",
    performanceBasis: {
      netExternalFlow: 121000,
      status: "complete",
      warnings: [],
      weightedExternalFlow: 60500,
    },
    portfolioValue: 1929450,
    salary: 170000,
  },
  {
    cashValue: 300450,
    cryptoValue: 120000,
    debtValue: 322000,
    equityValue: 1245000,
    id: "visual-qa-snapshot-2026-05",
    investedValue: 1721000,
    month: "2026-05",
    monthlyExpense: 68000,
    monthlyInvestment: 45000,
    notes: "May parity seed",
    performanceBasis: {
      netExternalFlow: 45000,
      status: "complete",
      warnings: [],
      weightedExternalFlow: 22500,
    },
    portfolioValue: 1987450,
    salary: 205000,
  },
];

export const visualQaQuotes: Quote[] = [
  {
    asOf: "2026-05-29T10:15:00.000Z",
    assetId: "visual-qa-asset-hdfc",
    currency: "INR",
    dayChangeAbs: 18.15,
    dayChangePct: 1.09,
    price: 1678.25,
    source: "yahoo",
  },
  {
    asOf: "2026-05-29T10:15:00.000Z",
    assetId: "visual-qa-asset-niftybees",
    currency: "INR",
    dayChangeAbs: 6.45,
    dayChangePct: 2.59,
    price: 255.32,
    source: "yahoo",
  },
  {
    asOf: "2026-05-29T10:15:00.000Z",
    assetId: "visual-qa-asset-sgb",
    currency: "INR",
    dayChangeAbs: 4.6,
    dayChangePct: 0.08,
    price: 5711,
    source: "manual",
  },
  {
    asOf: "2026-05-29T10:15:00.000Z",
    assetId: "visual-qa-asset-bitcoin",
    currency: "INR",
    dayChangeAbs: -8500,
    dayChangePct: -0.61,
    price: 1390400,
    source: "coingecko",
  },
];

export const visualQaAssetLookupResults: AssetLookupResult[] = [
  {
    assetClass: "stock",
    currency: "INR",
    exchange: "NSE",
    id: "visual-qa-lookup-hdfc",
    instrumentType: "stock",
    instrumentTypeConfidence: "inferred",
    metadataReviewMessage: "Sector needs review. Yahoo did not provide a sector.",
    name: "HDFC Bank",
    provider: "yahoo",
    quoteSourceId: "HDFCBANK.NS",
    sectorType: "other",
    sectorTypeConfidence: "reviewRequired",
    sourceLabel: "Visual QA seed",
    symbol: "HDFCBANK",
    ticker: "HDFCBANK.NS",
  },
  {
    assetClass: "etf",
    currency: "INR",
    exchange: "NSE",
    id: "visual-qa-lookup-niftybees",
    instrumentType: "etf",
    instrumentTypeConfidence: "inferred",
    metadataReviewMessage: "Provider details look ready. Confirm before saving.",
    name: "Nifty 50 ETF",
    provider: "yahoo",
    quoteSourceId: "NIFTYBEES.NS",
    sectorType: "diversified",
    sectorTypeConfidence: "inferred",
    sourceLabel: "Visual QA seed",
    symbol: "NIFTYBEES",
    ticker: "NIFTYBEES.NS",
  },
];

export function resetPortfolioStoreForVisualQa(
  store: StoreApi<PortfolioStoreState>,
) {
  const state = store.getState();

  state.trades.forEach((trade) => state.removeTrade(trade.id));
  state.openingPositions.forEach((position) =>
    state.removeOpeningPosition(position.id),
  );
  state.assets.forEach((asset) => state.removeAsset(asset.id));
  state.cashEntries.forEach((entry) => state.removeCashEntry(entry.id));
  state.monthlySnapshots.forEach((snapshot) =>
    state.removeMonthlySnapshot(snapshot.id),
  );
  state.clearQuoteCache();
  state.updatePreferences({
    hasCompletedOnboarding: true,
    maskWealthValues: false,
  });
}

export function seedVisualQaPortfolio(store: StoreApi<PortfolioStoreState>) {
  resetPortfolioStoreForVisualQa(store);

  const state = store.getState();

  visualQaAssets.forEach((asset) => state.addAsset(asset));
  visualQaOpeningPositions.forEach((position) =>
    state.addOpeningPosition(position),
  );
  visualQaCashEntries.forEach((entry) => state.addCashEntry(entry));
  visualQaMonthlySnapshots.forEach((snapshot) =>
    state.addMonthlySnapshot(snapshot),
  );
  visualQaQuotes.forEach((quote) => state.upsertQuote(quote));
}
