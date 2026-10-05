import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert } from "react-native";
import { createMMKV } from "react-native-mmkv";
import { AppButton, AppText, ScreenContainer } from "@/src/components/common";
import { calculateCashBalance } from "@/src/domain/calculations";
import { CashScreen, ReviewCashEntryScreen } from "@/src/features/cash";
import { DashboardScreen } from "@/src/features/dashboard";
import { ProgressScreen } from "@/src/features/progress";
import { ReviewSnapshotScreen } from "@/src/features/progress/ReviewSnapshotScreen";
import { createMemoryJsonStorage, createMmkvJsonStorage } from "@/src/services/storage";
import { createPortfolioStore, portfolioStorageKey, quoteCacheStorageKey, historicalQuoteCacheStorageKey } from "@/src/store";
import { canUseVisualQaHarness, seedVisualQaPortfolio } from "@/src/testing/visualQaSeed";

const now = new Date("2026-08-01T10:00:00Z");
const expectedKey = "investing-cash-qa:expected";
function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
}

function EnabledQa({ page }: { page?: string }) {
  // A separate MMKV database never replaces the user's portfolio.
  const [storage] = useState(() => createMmkvJsonStorage(createMMKV({ id: "investing-cash-qa" })));
  const [store] = useState(() => createPortfolioStore({ storage, now: () => now }));
  const [staged, setStaged] = useState(false);
  const expected = storage.getRawItem(expectedKey);
  const [reviewId, setReviewId] = useState<string>();
  function stageLegacy() {
    Alert.alert("Stage synthetic legacy data?", "Only the isolated investing-Cash QA database is replaced. Restart the app after staging.", [
      { text: "Cancel", style: "cancel" },
      { text: "Stage legacy data", onPress: () => {
        const memory = createMemoryJsonStorage();
        let fixture = createPortfolioStore({ storage: memory, now: () => now });
        seedVisualQaPortfolio(fixture);
        fixture = createPortfolioStore({ storage: memory, now: () => now });
        fixture.getState().addCashEntry({ id: "qa-unknown", date: "2026-05-03", amount: 200, label: "Unclassified cash", purpose: "legacyUncategorized", type: "addition" });
        fixture.getState().saveFuturesAccount({ id: "qa-wallet", marginMode: "cross", positionMode: "one-way", settlementAsset: "USDT", openingAt: "2026-05-01T00:00:00Z", openingWalletUsdt: "0", events: [] });
        fixture.getState().saveFuturesCashTransfer({ accountId: "qa-wallet", eventId: "qa-funding", cashEntryId: "qa-cash-funding", at: "2026-05-04T10:00:00Z", amountUsdt: "100", cashAmountInr: 9000, inrPerUsdt: "90", rateObservedAt: "2026-05-04T10:00:00Z", rateSource: "Synthetic receipt", conversionFeeInr: "0" });
        const payload = fixture.getState().captureBackup().payload;
        storage.setRawItem(expectedKey, canonical(payload));
        const legacy = JSON.parse(JSON.stringify(payload.portfolio));
        legacy.schemaVersion = 14;
        delete legacy.epf;
        legacy.cashEntries[0].purpose = "income";
        legacy.monthlySnapshots.forEach((snapshot: Record<string, unknown>) => { snapshot.salary = 165000; snapshot.monthlyExpense = 50000; });
        storage.setRawItem(portfolioStorageKey, JSON.stringify(legacy));
        storage.setRawItem(quoteCacheStorageKey, JSON.stringify(payload.quoteCache));
        storage.setRawItem(historicalQuoteCacheStorageKey, JSON.stringify(payload.historicalQuoteCache));
        setStaged(true);
      } },
    ]);
  }
  if (page === "cash") return reviewId
    ? <ReviewCashEntryScreen entryId={reviewId} now={now} store={store} onCancel={() => setReviewId(undefined)} onComplete={() => setReviewId(undefined)} />
    : <CashScreen now={now} store={store} onCorrectEntry={setReviewId} />;
  if (page === "dashboard") return <DashboardScreen now={now} store={store} />;
  if (page === "progress") return <ProgressScreen now={now} store={store} />;
  if (page === "snapshot") return <ReviewSnapshotScreen now={now} store={store} onCancel={() => router.back()} onComplete={() => router.back()} />;
  const state = store.getState();
  let identical = false;
  try { identical = expected !== null && canonical(state.captureBackup().payload) === expected; } catch { /* Show failure, never hide a recovery incident. */ }
  return <ScreenContainer scroll>
    <AppText variant="title">Investing Cash migration QA</AppText>
    <AppText testID="qa-migration-result">{staged ? "Legacy schema 14 staged; cold restart required" : identical ? "PASS: full payload preserved; schema 16" : "No verified migrated payload"}</AppText>
    <AppText testID="qa-migration-cash">Cash balance: {calculateCashBalance(state.cashEntries, now)}</AppText>
    <AppText testID="qa-migration-futures">Futures: {state.futuresAccounts[0]?.events.length ?? 0} linked transfer</AppText>
    <AppButton title="Stage synthetic legacy data" testID="qa-stage-legacy" onPress={stageLegacy} />
    <AppButton title="Minimal mode" onPress={() => state.updatePreferences({ displayMode: "minimal" })} />
    <AppButton title="Standard mode" onPress={() => state.updatePreferences({ displayMode: "standard" })} />
    <AppButton title="Mask values" onPress={() => state.updatePreferences({ maskWealthValues: true })} />
    <AppButton title="Show values" onPress={() => state.updatePreferences({ maskWealthValues: false })} />
  </ScreenContainer>;
}

export default function InvestingCashQa() {
  const params = useLocalSearchParams<{ token?: string; page?: string }>();
  if (!canUseVisualQaHarness({ isDevelopment: __DEV__, token: params.token })) return <ScreenContainer><AppText>Unavailable</AppText></ScreenContainer>;
  return <EnabledQa key={params.page ?? "config"} page={params.page} />;
}
