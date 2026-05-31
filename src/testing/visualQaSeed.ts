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
    type: "addition",
  },
  {
    amount: 15000,
    date: "2026-05-08T00:00:00.000Z",
    id: "visual-qa-cash-sip-index",
    label: "SIP transfer - Index Fund",
    type: "withdrawal",
  },
  {
    amount: 10000,
    date: "2026-05-16T00:00:00.000Z",
    id: "visual-qa-cash-emergency",
    label: "Emergency fund top-up",
    type: "addition",
  },
  {
    amount: 15000,
    date: "2026-05-22T00:00:00.000Z",
    id: "visual-qa-cash-sip-large-cap",
    label: "SIP transfer - Large Cap",
    type: "withdrawal",
  },
];

export const visualQaMonthlySnapshots: MonthlySnapshot[] = [
  {
    cashValue: 185000,
    cryptoValue: 98000,
    debtValue: 286000,
    equityValue: 1035000,
    id: "visual-qa-snapshot-2026-03",
    investedValue: 1290000,
    month: "2026-03",
    monthlyExpense: 54000,
    monthlyInvestment: 85000,
    notes: "March baseline",
    portfolioValue: 1604000,
    salary: 170000,
  },
  {
    cashValue: 255470,
    cryptoValue: 120000,
    debtValue: 322000,
    equityValue: 1172000,
    id: "visual-qa-snapshot-2026-04",
    investedValue: 1400000,
    month: "2026-04",
    monthlyExpense: 62000,
    monthlyInvestment: 98000,
    notes: "April allocation reset",
    portfolioValue: 1869470,
    salary: 170000,
  },
  {
    cashValue: 325470,
    cryptoValue: 1390400,
    debtValue: 57110,
    equityValue: 224806,
    id: "visual-qa-snapshot-2026-05",
    investedValue: 1532000,
    month: "2026-05",
    monthlyExpense: 68000,
    monthlyInvestment: 140000,
    notes: "May parity seed",
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
    name: "HDFC Bank",
    provider: "yahoo",
    quoteSourceId: "HDFCBANK.NS",
    sectorType: "financialServices",
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
    name: "Nifty 50 ETF",
    provider: "yahoo",
    quoteSourceId: "NIFTYBEES.NS",
    sectorType: "diversified",
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
