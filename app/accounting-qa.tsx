import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { AppButton, AppText } from "@/src/components/common";
import { calculateHoldings, calculateCashBalance } from "@/src/domain/calculations";
import { SellRedeemScreen } from "@/src/features/sellRedeem";
import { TradeHistoryScreen } from "@/src/features/trades";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";
import { canUseVisualQaHarness } from "@/src/testing/visualQaSeed";

const now = new Date("2026-09-10T12:00:00Z");

function EnabledAccountingQa() {
  const [store] = useState(() => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage(), now: () => now });
    store.getState().addAsset({ id: "qa", name: "Accounting QA", symbol: "QA", ticker: "QA.NS", currency: "INR", assetClass: "stock" });
    store.getState().addOpeningPosition({ id: "opening", assetId: "qa", date: "2026-01-01", quantity: 10, averageCostPrice: 50, currentPrice: 150 });
    store.getState().addTrade({ id: "buy", assetId: "qa", date: "2026-01-02", type: "buy", quantity: 10, pricePerUnit: 100, fees: 10, totalValue: 1010 });
    return store;
  });
  const [history, setHistory] = useState(false);
  const [masked, setMasked] = useState(false);
  const snapshot = store.getState();
  const holding = calculateHoldings({ ...snapshot, now })[0];
  return <View style={{ flex: 1, paddingTop: 40 }}>
    <AppText testID="accounting-qa-screen">Synthetic accounting QA: in-memory only</AppText>
    <AppText testID="accounting-qa-result">{masked ? "Values masked" : `Units ${holding?.totalUnits ?? 0}; basis ${holding?.totalInvested ?? 0}; cash ${calculateCashBalance(snapshot.cashEntries, now)}`}</AppText>
    <AppButton testID="accounting-qa-toggle" title={history ? "Record another sale" : "View transactions"} onPress={() => setHistory(!history)} />
    <AppButton testID="accounting-qa-mask" title={masked ? "Show values" : "Hide values"} onPress={() => {
      store.getState().updatePreferences({ maskWealthValues: !masked });
      setMasked(!masked);
    }} />
    {history ? <TradeHistoryScreen assetId="" now={now} store={store} onBack={() => setHistory(false)} onReviewTrade={() => {}} /> :
      <SellRedeemScreen key={snapshot.trades.length} assetId="qa" now={now} store={store} onCancel={() => setHistory(true)} onSaved={() => setHistory(true)} />}
  </View>;
}

export default function AccountingQaRoute() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  if (!canUseVisualQaHarness({ isDevelopment: __DEV__, token })) return <AppText testID="accounting-qa-blocked">Accounting QA is unavailable.</AppText>;
  return <EnabledAccountingQa />;
}
