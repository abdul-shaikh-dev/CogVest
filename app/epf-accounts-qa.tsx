import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { createMMKV } from "react-native-mmkv";

import { AppButton, AppText, ScreenContainer } from "@/src/components/common";
import { formatLocalCalendarDate } from "@/src/domain/dates";
import { calculateEpfLedger } from "@/src/domain/epf";
import { EpfAccountScreen, EpfBalanceUpdateScreen } from "@/src/features/epf";
import { createMmkvJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";
import { canUseVisualQaHarness } from "@/src/testing/visualQaSeed";

// Store validation uses the device date, so the journey is anchored to it:
// the starting balance is 30 days old and the update is dated today.
const updateNow = () => new Date();
const addNow = () => new Date(Date.now() - 30 * 86_400_000);
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

function EnabledQa({ page }: { page?: string }) {
  // This synthetic database is never the user's default MMKV database.
  const [native] = useState(() => createMMKV({ id: "cogvest-epf-accounts-qa" }));
  const [store] = useState(() => createPortfolioStore({ storage: createMmkvJsonStorage(native), now: updateNow }));
  const [view, setView] = useState<{ kind: "account"; id?: string } | { kind: "update"; id: string }>(() => ({
    kind: "account", id: store.getState().epf.accounts[0]?.id,
  }));
  const [status, setStatus] = useState("Ready");

  if (page === "check" || page === "cleanup") {
    return (
      <ScreenContainer scroll>
        <AppText variant="title">EPF accounts QA</AppText>
        <AppText>Isolated synthetic MMKV database</AppText>
        <AppText testID="epf-accounts-qa-status">{status}</AppText>
        <AppButton testID="epf-accounts-qa-check" title="Check saved records" onPress={() => {
          try {
            // A fresh store re-reads persisted bytes, proving the UI saved real records.
            const state = createPortfolioStore({ storage: createMmkvJsonStorage(native), now: updateNow }).getState();
            const today = formatLocalCalendarDate(updateNow());
            const [account] = state.epf.accounts;
            assert(state.epf.accounts.length === 1 && account.nickname === "Acme", "Account missing");
            assert(account.checkpoint.balance.total === 140000 && account.checkpoint.capital === null, "Checkpoint changed");
            const [event] = state.epf.events;
            assert(state.epf.events.length === 1 && event.type === "reconciliation" &&
              event.balance.total === 145567 && event.capital === null, "Balance update missing");
            assert(account.historyCompleteThrough === today && event.effectiveDate === today, "Update date or coverage missing");
            const result = calculateEpfLedger({ accounts: state.epf.accounts, events: state.epf.events }, today, today);
            assert(result.ok && result.total === 145567 && result.capital === null, "Ledger value mismatch");
            assert(state.cashEntries.length === 0 && state.epf.audit.length === 3, "Unexpected Cash or audit records");
            setStatus("PASS: EPF 145567; capital unknown; 1 reconciliation; audit 3");
          } catch (error) { setStatus(`FAIL: ${error instanceof Error ? error.message : "Unknown error"}`); }
        }} />
        <AppButton testID="epf-accounts-qa-cleanup" title="Remove synthetic QA data" onPress={() => {
          native.clearAll();
          setStatus("PASS: synthetic database cleared");
        }} />
      </ScreenContainer>
    );
  }
  if (view.kind === "update") {
    return <EpfBalanceUpdateScreen accountId={view.id} now={updateNow()} store={store}
      onBack={() => setView({ kind: "account", id: view.id })} onComplete={() => setView({ kind: "account", id: view.id })} />;
  }
  return <EpfAccountScreen key={view.id ?? "new"} accountId={view.id} now={view.id ? updateNow() : addNow()} store={store}
    onBack={() => setView({ kind: "account", id: view.id })}
    onComplete={(id) => setView({ kind: "account", id })}
    onUpdateBalance={(id) => setView({ kind: "update", id })} />;
}

export default function EpfAccountsQaRoute() {
  const { token, page } = useLocalSearchParams<{ token?: string; page?: string }>();
  if (!canUseVisualQaHarness({ isDevelopment: __DEV__, token })) return <AppText>EPF QA unavailable.</AppText>;
  return <EnabledQa key={page ?? "flow"} page={page} />;
}
