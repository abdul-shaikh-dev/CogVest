import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { createMMKV } from "react-native-mmkv";

import { AppButton, AppText, ScreenContainer } from "@/src/components/common";
import { formatLocalCalendarDate } from "@/src/domain/dates";
import { calculateEpfLedger } from "@/src/domain/epf";
import { EpfAccountScreen, EpfBalanceUpdateScreen, EpfEntryScreen } from "@/src/features/epf";
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
  const [view, setView] = useState<{ kind: "account"; id?: string } | { kind: "update"; id: string }
    | { kind: "entry"; id: string; entryId?: string }>(() => ({
    kind: "account", id: store.getState().epf.accounts[0]?.id,
  }));
  const [status, setStatus] = useState("Ready");

  if (page === "check" || page === "cleanup" || page === "seed-entries" || page === "check-entries") {
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
        <AppButton testID="epf-accounts-qa-seed-entries" title="Seed two synthetic accounts" onPress={() => {
          try {
            const checkpointDate = formatLocalCalendarDate(addNow());
            for (const [id, nickname, total] of [["acme", "Acme", 140000], ["beta", "Beta", 0]] as const) {
              store.getState().applyEpfCommand({ commandId: `seed-${id}`, reason: "Synthetic statement", change: { type: "accountPut", account: {
                id, nickname, provider: "epfo", status: "active", currency: "INR", historyCompleteThrough: null,
                checkpoint: { date: checkpointDate, balance: { total, components: { employee: total === 0 ? 0 : 100000, employer: total === 0 ? 0 : 40000 } },
                  capital: null, source: "epfoStatement", recordedAt: addNow().toISOString() } } } }, store.getState().getBackupRevision());
            }
            setStatus("PASS: seeded Acme 140000 and Beta 0");
          } catch (error) { setStatus(`FAIL: ${error instanceof Error ? error.message : "Unknown error"}`); }
        }} />
        <AppButton testID="epf-accounts-qa-check-entries" title="Check saved entries" onPress={() => {
          try {
            const state = createPortfolioStore({ storage: createMmkvJsonStorage(native), now: updateNow }).getState();
            const today = formatLocalCalendarDate(updateNow());
            const types = state.epf.events.map((event) => event.type === "contribution" ? `${event.type}:${event.party}` : event.type).sort();
            assert(JSON.stringify(types) === JSON.stringify(["contribution:employee", "contribution:employer", "interest", "transfer"]), `Unexpected entries ${types.join()}`);
            const result = calculateEpfLedger({ accounts: state.epf.accounts, events: state.epf.events }, today, today);
            assert(result.ok && result.total === 142567 && result.inTransit === 50000 && result.capital === null, "Combined EPF or transit mismatch");
            const balances = result.ok ? result.accounts.map((item) => `${item.accountId}:${item.balance.total}`).join() : "";
            assert(balances === "acme:92567,beta:0", `Unexpected balances ${balances}`);
            assert(state.cashEntries.length === 0, "Cash changed");
            setStatus("PASS: EPF 142567; Acme 92567; Beta 0; 50000 moving; Cash unchanged");
          } catch (error) { setStatus(`FAIL: ${error instanceof Error ? error.message : "Unknown error"}`); }
        }} />
        <AppButton testID="epf-accounts-qa-cleanup" title="Remove synthetic QA data" onPress={() => {
          native.clearAll();
          setStatus("PASS: synthetic database cleared");
        }} />
      </ScreenContainer>
    );
  }
  if (view.kind === "entry") {
    return <EpfEntryScreen accountId={view.id} entryId={view.entryId} now={updateNow()} store={store}
      onBack={() => setView({ kind: "account", id: view.id })} onComplete={() => setView({ kind: "account", id: view.id })} />;
  }
  if (view.kind === "update") {
    return <EpfBalanceUpdateScreen accountId={view.id} now={updateNow()} store={store}
      onBack={() => setView({ kind: "account", id: view.id })} onComplete={() => setView({ kind: "account", id: view.id })} />;
  }
  return <EpfAccountScreen key={view.id ?? "new"} accountId={view.id} now={view.id ? updateNow() : addNow()} store={store}
    onBack={() => setView({ kind: "account", id: view.id })}
    onComplete={(id) => setView({ kind: "account", id })}
    onUpdateBalance={(id) => setView({ kind: "update", id })}
    onOpenEntry={(id, entryId) => setView({ kind: "entry", id, entryId })} />;
}

export default function EpfAccountsQaRoute() {
  const { token, page } = useLocalSearchParams<{ token?: string; page?: string }>();
  if (!canUseVisualQaHarness({ isDevelopment: __DEV__, token })) return <AppText>EPF QA unavailable.</AppText>;
  return <EnabledQa key={page ?? "flow"} page={page} />;
}
