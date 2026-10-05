import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { createMMKV } from "react-native-mmkv";
import * as Crypto from "expo-crypto";

import { AppButton, AppText, ScreenContainer } from "@/src/components/common";
import { calculateEpfLedger } from "@/src/domain/epf";
import { createPortfolioBackup, parsePortfolioBackup } from "@/src/domain/portfolioBackup";
import { ReviewCashEntryScreen } from "@/src/features/cash";
import { createMmkvJsonStorage } from "@/src/services/storage";
import { createEmptyPortfolioSnapshot, createPortfolioStore, portfolioStorageKey } from "@/src/store";
import { canUseVisualQaHarness } from "@/src/testing/visualQaSeed";

const now = () => new Date("2026-10-05T10:00:00Z");
const expectedKey = "epf-qa:expected-raw";
const digest = (text: string) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text);
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

function EnabledQa({ page }: { page?: string }) {
  // This synthetic database is never the user's default MMKV database.
  const [native] = useState(() => createMMKV({ id: "cogvest-epf-persistence-qa" }));
  const [storage] = useState(() => createMmkvJsonStorage(native));
  const [status, setStatus] = useState("Ready");
  const [busy, setBusy] = useState(false);
  const [store] = useState(() => createPortfolioStore({ storage, now }));
  function checkValues() {
    const restarted = createPortfolioStore({ storage, now });
    assert(!restarted.getState().storageRecovery, "Unexpected recovery state");
    const state = restarted.getState();
    const result = calculateEpfLedger({ accounts: state.epf.accounts, events: state.epf.events }, "2026-10-05", "2026-10-05");
    assert(result.ok && result.total === 135000 && result.capital === null, "EPF balance or unknown capital changed");
    assert(state.cashEntries.reduce((sum, item) => sum + (item.type === "addition" ? item.amount : -item.amount), 0) === 7000, "Cash mismatch");
    assert(state.epf.audit.length === 2 && state.epf.cashLinks.length === 1, "Audit/link mismatch");
    assert(storage.getRawItem(portfolioStorageKey) === storage.getRawItem(expectedKey), "Persisted bytes changed");
  }
  async function run() {
    setBusy(true);
    try {
      const testStore = createPortfolioStore({ storage, now });
      assert(testStore.getState().schemaVersion === 16 && testStore.getState().epf.accounts.length === 0, "Migration failed or fixture not reset");
      assert(testStore.getState().cashEntries[0]?.amount === 2000, "Legacy Cash changed");
      testStore.getState().applyEpfCommand({ commandId: "setup", reason: "Synthetic statement", change: { type: "accountPut", account: {
        id: "epf", nickname: "Synthetic EPF", provider: "epfo", status: "active", currency: "INR", historyCompleteThrough: null,
        checkpoint: { date: "2026-01-01", capital: null, source: "epfoStatement", recordedAt: "2026-01-02T00:00:00Z",
          balance: { total: 140000, components: { employee: 100000, employer: 40000 } } },
      } } }, testStore.getState().getBackupRevision());
      testStore.getState().applyEpfCommand({ commandId: "withdraw", reason: "Synthetic transfer", change: { type: "eventPut", cash: { id: "epf-cash", label: "From EPF" }, event: {
        id: "withdrawal", accountId: "epf", type: "withdrawal", amount: { total: 5000, components: { employee: 5000, employer: 0 } },
        capitalReduction: null, destination: "unknown", effectiveDate: "2026-02-01", postedDate: "2026-02-01",
        recordedAt: "2026-02-02T00:00:00Z", evidence: "Synthetic receipt",
      } } }, testStore.getState().getBackupRevision());
      const captured = testStore.getState().captureBackup().payload;
      const text = await createPortfolioBackup(captured, { appVersion: "EPF local QA", createdAt: now().toISOString() }, digest);
      const parsed = await parsePortfolioBackup(text, digest);
      testStore.getState().applyEpfCommand({ commandId: "remove", reason: "Restore check", change: { type: "eventRemove", id: "withdrawal" } }, testStore.getState().getBackupRevision());
      testStore.getState().replaceFromBackup(parsed.payload, testStore.getState().getBackupRevision());
      const before = storage.getRawItem(portfolioStorageKey);
      const corrupt = JSON.parse(JSON.stringify(parsed.payload));
      corrupt.portfolio.cashEntries[1].amount += 1;
      let rejected = false;
      try { testStore.getState().replaceFromBackup(corrupt, testStore.getState().getBackupRevision()); }
      catch { rejected = true; }
      assert(rejected && storage.getRawItem(portfolioStorageKey) === before, "Corrupt restore changed data");
      storage.setRawItem(expectedKey, before!);
      checkValues();
      setStatus("PASS: EPF 135000; Cash 7000; audit 2; corrupt restore blocked");
    } catch (error) { setStatus(`FAIL: ${error instanceof Error ? error.message : "Unknown error"}`); }
    finally { setBusy(false); }
  }
  if (page === "review") return <ReviewCashEntryScreen entryId="epf-cash" store={store} now={now()} onCancel={() => {}} onComplete={() => {}} />;
  return <ScreenContainer scroll>
    <AppText variant="title">EPF persistence QA</AppText>
    <AppText>Isolated synthetic MMKV database</AppText>
    <AppText testID="epf-qa-status">{status}</AppText>
    <AppButton testID="epf-qa-stage" title="Stage legacy fixture" disabled={busy} onPress={() => {
      native.clearAll();
      const { epf: _epf, ...legacy } = createEmptyPortfolioSnapshot();
      storage.setRawItem(portfolioStorageKey, JSON.stringify({ ...legacy, schemaVersion: 15,
        cashEntries: [{ id: "opening", amount: 2000, date: "2026-01-01", type: "addition", purpose: "capitalContribution", label: "Synthetic Cash" }] }));
      setStatus("Legacy staged; restart required");
    }} />
    <AppButton testID="epf-qa-run" title="Check migration and restore" disabled={busy} onPress={() => void run()} />
    <AppButton testID="epf-qa-check" title="Check cold restart" disabled={busy} onPress={() => {
      try { checkValues(); setStatus("PASS: cold restart preserved exact records"); }
      catch (error) { setStatus(`FAIL: ${error instanceof Error ? error.message : "Unknown error"}`); }
    }} />
    <AppButton testID="epf-qa-cleanup" title="Remove synthetic QA data" disabled={busy} onPress={() => {
      native.clearAll(); setStatus("PASS: synthetic database cleared");
    }} />
  </ScreenContainer>;
}

export default function EpfPersistenceQaRoute() {
  const { token, page } = useLocalSearchParams<{ token?: string; page?: string }>();
  if (!canUseVisualQaHarness({ isDevelopment: __DEV__, token })) return <AppText>EPF QA unavailable.</AppText>;
  return <EnabledQa key={page ?? "proof"} page={page} />;
}
