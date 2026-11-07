import { router, useLocalSearchParams } from "expo-router";
import { useState, useSyncExternalStore } from "react";
import { createMMKV } from "react-native-mmkv";

import { AppButton, AppText, ScreenContainer } from "@/src/components/common";
import { DashboardScreen } from "@/src/features/dashboard";
import { HoldingsScreen } from "@/src/features/holdings";
import { PayoutCoverageScreen, PayoutsScreen } from "@/src/features/payouts";
import { MeasurementBasisScreen } from "@/src/features/wholePortfolio";
import type { RefreshQuotesInput } from "@/src/services/quotes";
import { createMmkvJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";
import { canUseVisualQaHarness } from "@/src/testing/visualQaSeed";

// Fixed clock and price so the expected rate is the independently verified
// one-year case: -10,000 on 1 Jan 2025 and +11,000 on 1 Jan 2026 is 10%. A
// December 2024 snapshot worth nothing gives the portfolio return its
// automatic start (#610) without adding a flow.
const now = new Date("2026-01-01T12:00:00");
const token = "cogvest-local-visual-qa";
const noRefresh = async ({ cachedQuotes }: RefreshQuotesInput) => ({ failed: [], quoteCache: cachedQuotes ?? {}, timedOut: [], updated: [] });

// One store shared by every QA page, in a separate MMKV database that never
// replaces the user's portfolio.
let sharedStore: ReturnType<typeof createPortfolioStore> | undefined;
function qaStore() {
  sharedStore ??= createPortfolioStore({ storage: createMmkvJsonStorage(createMMKV({ id: "xirr-qa" })), now: () => now });
  return sharedStore;
}

function EnabledQa({ page }: { page?: string }) {
  const store = qaStore();
  const [ready, setReady] = useState(false);
  const coverage = useSyncExternalStore(store.subscribe, () => store.getState().distributionCoverage);
  const open = (next: string, assetId?: string) =>
    router.push({ pathname: "/xirr-qa", params: { token, page: next, ...(assetId ? { assetId } : {}) } });

  if (page === "holdings") {
    return <HoldingsScreen isActive now={now} onReviewPayouts={(assetId) => open("payouts", assetId)}
      onReviewTrades={() => undefined} refreshQuotes={noRefresh} store={store} />;
  }
  if (page === "dashboard") {
    return <DashboardScreen now={now} onConfirmPayouts={() => open("coverage")} onReviewPayouts={(assetId) => open("payouts", assetId)}
      onSetBasis={() => open("basis")}
      refreshQuotes={noRefresh} store={store} />;
  }
  if (page === "coverage") {
    return <PayoutCoverageScreen now={now} onBack={() => router.back()} onReviewHolding={(assetId) => open("payouts", assetId)} store={store} />;
  }
  if (page === "basis") return <MeasurementBasisScreen now={now} onBack={() => router.back()} store={store} />;
  if (page === "payouts") {
    return <PayoutsScreen assetId="xirr-qa-stock" now={now} onAddPayout={() => undefined}
      onBack={() => router.back()} onReviewPayout={() => undefined} store={store} />;
  }
  function reset(payoutsConfirmed = false, manyHoldings = false) {
    const state = store.getState();
    store.setState({ assets: [], cashEntries: [], distributionCoverage: [], distributions: [], measurementBasis: null,
      monthlySnapshots: [{ id: "xirr-qa-dec", month: "2024-12", portfolioValue: 0, equityValue: 0, debtValue: 0, cryptoValue: 0,
        cashValue: 0, investedValue: 0, monthlyInvestment: 0 }], openingPositions: [], trades: [] });
    state.clearQuoteCache();
    state.updatePreferences({ hasCompletedOnboarding: true, maskWealthValues: false, displayMode: "standard" });
    state.addAsset({ id: "xirr-qa-stock", name: "Synthetic Return Co", symbol: "SYNRET", ticker: "SYNRET.NS",
      currency: "INR", assetClass: "stock", exchange: "NSE" });
    state.addTrade({ id: "xirr-qa-buy", assetId: "xirr-qa-stock", type: "buy", date: "2025-01-01", quantity: 100, pricePerUnit: 100, totalValue: 10000 });
    state.upsertQuote({ asOf: "2026-01-01T10:00:00.000Z", assetId: "xirr-qa-stock", currency: "INR", price: 110, source: "yahoo" });
    if (payoutsConfirmed) state.setDistributionCoverage("xirr-qa-stock", "2025-01-01");
    if (manyHoldings) {
      // Three holdings without payout confirmation (#619); one has a recorded payout.
      for (const [id, name] of [["xirr-qa-alpha", "Synthetic Alpha Ltd"], ["xirr-qa-beta", "Synthetic Beta Ltd"]]) {
        state.addAsset({ id, name, symbol: id.toUpperCase(), ticker: `${id.toUpperCase()}.NS`, currency: "INR", assetClass: "stock", exchange: "NSE" });
        state.addTrade({ id: `${id}-buy`, assetId: id, type: "buy", date: "2025-01-01", quantity: 10, pricePerUnit: 100, totalValue: 1000 });
        state.upsertQuote({ asOf: "2026-01-01T10:00:00.000Z", assetId: id, currency: "INR", price: 105, source: "yahoo" });
      }
      state.saveDistribution({ id: "xirr-qa-payout", assetId: "xirr-qa-stock", grossAmount: 200, taxWithheld: 0,
        paidOn: "2025-06-02", treatment: "paidOutside" });
    }
    setReady(true);
  }
  return (
    <ScreenContainer scroll>
      <AppText variant="title">XIRR QA</AppText>
      <AppText testID="xirr-qa-status">{ready ? "Fixture ready" : "Isolated synthetic fixture"}</AppText>
      <AppButton testID="xirr-qa-reset" title="Reset fixture" onPress={() => reset()} />
      <AppButton testID="xirr-qa-reset-covered" title="Reset with payouts confirmed" onPress={() => reset(true)} />
      <AppButton testID="xirr-qa-reset-many" title="Reset with three unconfirmed holdings" onPress={() => reset(false, true)} />
      <AppText testID="xirr-qa-coverage">
        Coverage: {coverage.map((item) => `${item.assetId} from ${item.from}`).sort().join("; ") || "none"}
      </AppText>
      <AppButton testID="xirr-qa-open-holdings" title="Open holdings" onPress={() => open("holdings")} />
      <AppButton testID="xirr-qa-open-dashboard" title="Open dashboard" onPress={() => open("dashboard")} />
    </ScreenContainer>
  );
}

export default function XirrQa() {
  const params = useLocalSearchParams<{ token?: string; page?: string }>();
  if (!canUseVisualQaHarness({ token: params.token })) return <ScreenContainer><AppText>Unavailable</AppText></ScreenContainer>;
  return <EnabledQa key={params.page ?? "config"} page={params.page} />;
}
