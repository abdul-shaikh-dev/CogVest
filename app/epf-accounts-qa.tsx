import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { createMMKV } from "react-native-mmkv";

import { AppButton, AppText, ScreenContainer } from "@/src/components/common";
import { formatLocalCalendarDate } from "@/src/domain/dates";
import { calculateEpfLedger } from "@/src/domain/epf";
import { DashboardScreen } from "@/src/features/dashboard";
import { EpfAccountScreen, EpfBalanceUpdateScreen, EpfEntryScreen } from "@/src/features/epf";
import { HoldingsScreen } from "@/src/features/holdings";
import { ProgressScreen } from "@/src/features/progress";
import { createMmkvJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";
import { canUseVisualQaHarness } from "@/src/testing/visualQaSeed";
import { ThemeProvider } from "@/src/theme";
import type { AppearancePreference, DisplayMode } from "@/src/types/preferences";

// Store validation uses the device date, so the journey is anchored to it:
// the starting balance is 30 days old and the update is dated today.
const updateNow = () => new Date();
const addNow = () => new Date(Date.now() - 30 * 86_400_000);
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

type MatrixOptions = { appearance: AppearancePreference; mode: DisplayMode; masked: boolean; screen: string };

function EnabledQa({ page, matrix }: { page?: string; matrix: MatrixOptions }) {
  // This synthetic database is never the user's default MMKV database.
  const [native] = useState(() => createMMKV({ id: "cogvest-epf-accounts-qa" }));
  const [store] = useState(() => createPortfolioStore({ storage: createMmkvJsonStorage(native), now: updateNow }));
  const [view, setView] = useState<{ kind: "account"; id?: string } | { kind: "update"; id: string }
    | { kind: "entry"; id: string; entryId?: string }>(() => ({
    kind: "account", id: store.getState().epf.accounts[0]?.id,
  }));
  const [status, setStatus] = useState("Ready");

  function seed(withEntries: boolean) {
    const checkpointDate = formatLocalCalendarDate(addNow());
    const apply = (commandId: string, change: Parameters<ReturnType<typeof store.getState>["applyEpfCommand"]>[0]["change"]) =>
      store.getState().applyEpfCommand({ commandId, reason: "Synthetic statement", change }, store.getState().getBackupRevision());
    for (const [id, nickname, total] of [["acme", "Acme", 140000], ["beta", "Beta", 0]] as const) {
      apply(`seed-${id}`, { type: "accountPut", account: {
        id, nickname, provider: "epfo", status: "active", currency: "INR", historyCompleteThrough: null,
        checkpoint: { date: checkpointDate, balance: { total, components: { employee: total === 0 ? 0 : 100000, employer: total === 0 ? 0 : 40000 } },
          capital: null, source: "epfoStatement", recordedAt: addNow().toISOString() } } });
    }
    if (!withEntries) return;
    const today = formatLocalCalendarDate(updateNow());
    const base = { accountId: "acme", effectiveDate: today, postedDate: today, recordedAt: updateNow().toISOString(), evidence: "EPFO passbook" };
    apply("seed-employee", { type: "eventPut", cash: null, event: { ...base, id: "employee", type: "contribution", party: "employee", amount: 1200 } });
    apply("seed-employer", { type: "eventPut", cash: null, event: { ...base, id: "employer", type: "contribution", party: "employer", amount: 367 } });
    apply("seed-interest", { type: "eventPut", cash: null, event: { ...base, id: "interest", type: "interest", amount: { total: 1000, components: null } } });
    apply("seed-transfer", { type: "eventPut", cash: null, event: { id: "transfer", type: "transfer", sourceId: "acme", destinationId: "beta",
      amount: { total: 50000, components: null }, capital: null, status: "inTransit", creditDate: null,
      effectiveDate: today, postedDate: today, recordedAt: updateNow().toISOString(), evidence: "Transfer claim" } });
  }

  if (page === "matrix") {
    return <QaMatrix options={matrix} store={store} />;
  }

  if (page === "check" || page === "cleanup" || page === "seed-entries" || page === "check-entries" || page === "state" || page === "seed-matrix") {
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
            seed(false);
            setStatus("PASS: seeded Acme 140000 and Beta 0");
          } catch (error) { setStatus(`FAIL: ${error instanceof Error ? error.message : "Unknown error"}`); }
        }} />
        <AppButton testID="epf-accounts-qa-seed-matrix" title="Seed accounts with entries" onPress={() => {
          try {
            seed(true);
            setStatus("PASS: seeded EPF 142567 with 50000 moving");
          } catch (error) { setStatus(`FAIL: ${error instanceof Error ? error.message : "Unknown error"}`); }
        }} />
        <AppButton testID="epf-accounts-qa-state" title="Read saved state" onPress={() => {
          try {
            // A fresh store re-reads persisted bytes rather than in-memory state.
            const state = createPortfolioStore({ storage: createMmkvJsonStorage(native), now: updateNow }).getState();
            const today = formatLocalCalendarDate(updateNow());
            const result = calculateEpfLedger({ accounts: state.epf.accounts, events: state.epf.events }, today, today);
            assert(result.ok, "Ledger invalid");
            const cash = state.cashEntries.reduce((sum, entry) => sum + (entry.type === "addition" ? entry.amount : -entry.amount), 0);
            setStatus(`STATE: EPF ${result.total}; moving ${result.inTransit}; entries ${state.epf.events.length}; Cash ${cash}; links ${state.epf.cashLinks.length}`);
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

/** Renders EPF surfaces on the isolated store under one appearance/mode/masking combination. */
function QaMatrix({ options, store }: { options: MatrixOptions; store: ReturnType<typeof createPortfolioStore> }) {
  useState(() => store.getState().updatePreferences({ displayMode: options.mode, maskWealthValues: options.masked }));
  const noop = () => {};
  const screen = options.screen === "holdings"
    ? <HoldingsScreen destinationRequest={{ destination: "epf" }} store={store} />
    : options.screen === "dashboard"
      ? <DashboardScreen store={store} />
      : options.screen === "progress"
        ? <ProgressScreen store={store} historicalPriceFetcher={async () => ({ ok: false, error: "Synthetic fixture has no provider" })} />
        : <EpfAccountScreen accountId="acme" now={updateNow()} store={store} onBack={noop} onComplete={noop} onUpdateBalance={noop} onOpenEntry={noop} />;
  return <ThemeProvider preference={options.appearance}>{screen}</ThemeProvider>;
}

export default function EpfAccountsQaRoute() {
  const params = useLocalSearchParams<{ token?: string; page?: string; appearance?: string; mode?: string; masked?: string; screen?: string }>();
  if (!canUseVisualQaHarness({ isDevelopment: __DEV__, token: params.token })) return <AppText>EPF QA unavailable.</AppText>;
  const matrix: MatrixOptions = {
    appearance: params.appearance === "light" ? "light" : "dark",
    mode: params.mode === "minimal" ? "minimal" : "standard",
    masked: params.masked === "1",
    screen: params.screen ?? "detail",
  };
  return <EnabledQa key={[params.page ?? "flow", matrix.appearance, matrix.mode, matrix.masked, matrix.screen].join(":")} matrix={matrix} page={params.page} />;
}
