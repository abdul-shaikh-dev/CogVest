import { createContext, useContext, useRef, useState, useSyncExternalStore, type ComponentProps } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View, type TextInput } from "react-native";
import type { StoreApi } from "zustand/vanilla";

import { AppButton, AppText, IconButton, PremiumCard, ScreenContainer, ScreenHeader, SectionHeader } from "@/src/components/common";
import { useDraftExit } from "./useDraftExit";
import { DateTimeField, FormTextField } from "@/src/components/forms";
import { futuresEntryErrors, type FuturesEntryField } from "@/src/domain/futuresEntry";
import { decimal } from "@/src/domain/precision";
import {
  calculateUsdmPortfolioContribution,
  replayUsdmFutures,
  type UsdmEventRate,
  type UsdmFuturesAccount,
  type UsdmFuturesEvent,
  type UsdmMark,
} from "@/src/domain/usdmFutures";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import { spacing, useTheme, createThemedStyles } from "@/src/theme";
import { createId } from "@/src/utils";

type EventKind = "execution" | "funding" | "transfer";
type EntryTarget = { layout: View | null; input?: TextInput | null };
const EntryErrors = createContext<{ errors: Record<string, string>; refs: Record<string, EntryTarget>; clear: (id: string) => void }>({ errors: {}, refs: {}, clear: () => {} });
function EntryField(props: ComponentProps<typeof FormTextField>) {
  const { errors, refs, clear } = useContext(EntryErrors);
  const target = useRef<EntryTarget>({ layout: null, input: null });
  return <View collapsable={false} ref={(node) => {
    target.current.layout = node;
    if (props.testID) refs[props.testID] = target.current;
  }}><FormTextField {...props} error={props.testID ? errors[props.testID] : undefined}
    inputRef={(node) => { target.current.input = node; }}
    onChangeText={(value) => { if (props.testID) clear(props.testID); props.onChangeText(value); }} /></View>;
}
function TimeField(props: ComponentProps<typeof DateTimeField>) {
  const { errors, refs, clear } = useContext(EntryErrors);
  return <DateTimeField {...props} error={errors[props.testID]}
    fieldRef={(node) => { refs[props.testID] = { layout: node }; }}
    onChange={(value) => { clear(props.testID); props.onChange(value); }} />;
}
type EventDraft = {
  id: string;
  type: EventKind;
  at: string;
  contract: string;
  side: "buy" | "sell";
  quantity: string;
  price: string;
  feeUsdt: string;
  leverage: string;
  amountUsdt: string;
  transferBoundary: "internal" | "external";
  inrPerUsdt: string;
  rateObservedAt: string;
  rateSource: string;
};

type CashFundingDraft = {
  eventId: string;
  cashEntryId: string;
  direction: "toFutures" | "toCash";
  at: string;
  usdt: string;
  cashInr: string;
  feeInr: string;
  rate: string;
  rateAt: string;
  rateSource: string;
  notes: string;
};

const blankCashFunding = (): CashFundingDraft => ({
  eventId: "", cashEntryId: "", direction: "toFutures", at: isoNow(), usdt: "",
  cashInr: "", feeInr: "0", rate: "", rateAt: "", rateSource: "", notes: "",
});

const ACCOUNT_ID = "binance-usdm-main";
const isoNow = () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
const blankEvent = (): EventDraft => ({
  id: "", type: "execution", at: isoNow(), contract: "BTCUSDT", side: "buy",
  quantity: "", price: "", feeUsdt: "0", leverage: "", amountUsdt: "",
  transferBoundary: "external", inrPerUsdt: "", rateObservedAt: "", rateSource: "",
});

function Choice({ label, selected, onPress, testID, checkbox = false }: { label: string; selected: boolean; onPress: () => void; testID?: string; checkbox?: boolean }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return <Pressable accessibilityRole={checkbox ? "checkbox" : "radio"} accessibilityLabel={label} accessibilityState={{ checked: selected }} onPress={onPress} style={[styles.choice, checkbox && styles.checkbox, selected && styles.selected]} testID={testID}>
    {checkbox ? <Ionicons name={selected ? "checkbox" : "square-outline"} size={22} color={selected ? colors.primary : colors.text.secondary} accessible={false} /> : null}
    <AppText weight={selected ? "bold" : "regular"} style={checkbox ? styles.choiceLabel : undefined}>{label}</AppText>
  </Pressable>;
}

function Money({ value, masked, prominent = false }: { value: string; masked: boolean; prominent?: boolean }) {
  return <AppText variant={prominent ? "title" : "body"} weight="bold">{masked ? "••••" : value}</AppText>;
}

function displayTime(value: string) {
  return new Date(value).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const valuationLabels: Record<ReturnType<typeof replayUsdmFutures>["valuationStatus"], string> = {
  ready: "Verified at the saved observation time",
  "missing-mark": "Mark price needed",
  "stale-mark": "Mark price is old",
  "missing-rate": "INR rate needed",
  "stale-rate": "INR rate is old",
  unreconciled: "Confirm wallet and position coverage",
  "stale-wallet": "Wallet balance is old",
  "wallet-mismatch": "Wallet balance does not match activity",
};

export function FuturesScreen({ onBack, store = getPortfolioStore() }: { onBack: () => void; store?: StoreApi<PortfolioStoreState> }) {
  const styles = useStyles();
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const account = state.futuresAccounts.find((item) => item.id === ACCOUNT_ID);
  const scrollRef = useRef<ScrollView>(null);
  const contentRef = useRef<View>(null);
  const fieldRefs = useRef<Record<string, EntryTarget>>({});
  const masked = state.preferences.maskWealthValues;
  const [openingAt, setOpeningAt] = useState(account?.openingAt ?? isoNow());
  const [openingWallet, setOpeningWallet] = useState(account?.openingWalletUsdt ?? "0");
  const [openingRate, setOpeningRate] = useState(account?.openingRate?.inrPerUsdt ?? "");
  const [openingRateAt, setOpeningRateAt] = useState(account?.openingRate?.observedAt ?? "");
  const [openingRateSource, setOpeningRateSource] = useState(account?.openingRate?.source ?? "");
  const [editingAccount, setEditingAccount] = useState(!account);
  const [draft, setDraft] = useState<EventDraft>(blankEvent);
  const [editingEvent, setEditingEvent] = useState(false);
  const [cashFunding, setCashFunding] = useState<CashFundingDraft>(blankCashFunding);
  const [editingCashFunding, setEditingCashFunding] = useState(false);
  const [error, setError] = useState("");
  const [deletion, setDeletion] = useState<{ kind: "wallet" } | { kind: "event"; id: string } | null>(null);
  const deletionPending = useRef(false);
  const cancelDeletion = () => { deletionPending.current = false; setDeletion(null); };
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const clearFieldError = (id: string) => setFieldErrors((current) => {
    if (!(id in current)) return current;
    const next = { ...current }; delete next[id]; return next;
  });
  const [valuationAt, setValuationAt] = useState(account?.valuation?.asOf ?? isoNow());
  const [observedWallet, setObservedWallet] = useState(account?.valuation?.reconciliation.observedWalletUsdt ?? "");
  const [observedWalletAt, setObservedWalletAt] = useState(account?.valuation?.reconciliation.observedAt ?? "");
  const [walletSource, setWalletSource] = useState(account?.valuation?.reconciliation.source ?? "");
  const [rate, setRate] = useState(account?.valuation?.inrRate.inrPerUsdt ?? "");
  const [rateAt, setRateAt] = useState(account?.valuation?.inrRate.observedAt ?? "");
  const [rateSource, setRateSource] = useState(account?.valuation?.inrRate.source ?? "");
  const [markPrices, setMarkPrices] = useState<Record<string, string>>(Object.fromEntries(account?.valuation?.marks.map((mark) => [mark.contract, mark.priceUsdt]) ?? []));
  const [markMargins, setMarkMargins] = useState<Record<string, string>>(Object.fromEntries(account?.valuation?.marks.map((mark) => [mark.contract, mark.reportedMarginUsdt ?? ""]) ?? []));
  const [markSource, setMarkSource] = useState(account?.valuation?.marks[0]?.source ?? "");
  const [markAt, setMarkAt] = useState(account?.valuation?.marks[0]?.observedAt ?? "");
  const [positionsConfirmed, setPositionsConfirmed] = useState(account?.valuation?.reconciliation.allOpenPositionsConfirmed ?? false);
  const [eventsConfirmed, setEventsConfirmed] = useState(account?.valuation?.reconciliation.allWalletEventsConfirmed ?? false);
  const [boundaryConfirmed, setBoundaryConfirmed] = useState(account?.valuation?.reconciliation.portfolioBoundaryConfirmed ?? false);

  const walletSnapshot = JSON.stringify([openingAt, openingWallet, openingRate, openingRateAt, openingRateSource]);
  const valuationSnapshot = JSON.stringify([valuationAt, observedWallet, observedWalletAt, walletSource, rate, rateAt, rateSource, markPrices, markMargins, markSource, markAt, positionsConfirmed, eventsConfirmed, boundaryConfirmed]);
  const walletBaseline = useRef(walletSnapshot);
  const valuationBaseline = useRef(valuationSnapshot);
  const eventBaseline = useRef(JSON.stringify(draft));
  const cashBaseline = useRef(JSON.stringify(cashFunding));
  const eventDirty = editingEvent && JSON.stringify(draft) !== eventBaseline.current;
  const cashDirty = editingCashFunding && JSON.stringify(cashFunding) !== cashBaseline.current;
  const dirty = (editingAccount && walletSnapshot !== walletBaseline.current) || eventDirty || cashDirty || (Boolean(account) && valuationSnapshot !== valuationBaseline.current);
  const exit = useDraftExit(dirty, onBack);
  const startEvent = (next: EventDraft) => { eventBaseline.current = JSON.stringify(next); setDraft(next); setEditingEvent(true); };
  const startCash = (next: CashFundingDraft) => { cashBaseline.current = JSON.stringify(next); setCashFunding(next); setEditingCashFunding(true); };

  const setField = <K extends keyof EventDraft>(key: K, value: EventDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const report = (cause: unknown) => {
    setError(cause instanceof Error ? cause.message : "Could not save the futures record.");
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };
  const checkFields = (fields: Record<string, FuturesEntryField>) => {
    const errors = futuresEntryErrors(fields);
    setFieldErrors(errors);
    const first = Object.keys(errors)[0];
    if (first) {
      setError("Check the highlighted fields.");
      Keyboard.dismiss();
      requestAnimationFrame(() => {
        const node = fieldRefs.current[first];
        const content = contentRef.current;
        if (node?.layout && content) node.layout.measureLayout(content, (_x, y) => {
          scrollRef.current?.scrollTo({ y: Math.max(0, y - spacing.md), animated: true });
          node.input?.focus();
        }, () => scrollRef.current?.scrollTo({ y: 0, animated: true }));
      });
      return false;
    }
    return true;
  };
  const saveAccount = () => {
    if (!checkFields({
      "futures-opening-at": { value: openingAt, label: "Starting wallet time", timestamp: true },
      "futures-opening-wallet": { value: openingWallet, label: "Starting wallet balance" },
      ...(openingRate ? {
        "futures-opening-rate-at": { value: openingRateAt, label: "Rate observation time", timestamp: true },
        "futures-opening-rate-source": { value: openingRateSource, label: "Rate source" },
      } : {}),
    })) return;
    try {
      const next: UsdmFuturesAccount = account
        ? { ...account, openingAt, openingWalletUsdt: openingWallet, valuation: undefined }
        : { id: ACCOUNT_ID, settlementAsset: "USDT", marginMode: "cross", positionMode: "one-way", openingAt, openingWalletUsdt: openingWallet, events: [] };
      next.openingRate = openingRate ? { inrPerUsdt: openingRate, observedAt: openingRateAt, source: openingRateSource.trim() } : undefined;
      store.getState().saveFuturesAccount(next);
      setEditingAccount(false);
      setError("");
    } catch (cause) { report(cause); }
  };
  const editEvent = (event: UsdmFuturesEvent) => {
    if (event.type === "transfer" && event.linkedCashEntryId) {
      const cash = state.cashEntries.find((item) => item.id === event.linkedCashEntryId);
      const existingRate = account?.eventRates?.find((item) => item.eventId === event.id);
      if (!cash || !existingRate) return report(new Error("Linked Cash funding is incomplete. Restore a complete backup."));
      startCash({ eventId: event.id, cashEntryId: cash.id,
        direction: decimal(event.amountUsdt).isPositive() ? "toFutures" : "toCash",
        at: event.at, usdt: decimal(event.amountUsdt).abs().toString(), cashInr: String(cash.amount),
        feeInr: event.conversionFeeInr ?? "0", rate: existingRate.inrPerUsdt,
        rateAt: existingRate.observedAt, rateSource: existingRate.source, notes: cash.notes ?? "" });
      setEditingCashFunding(true);
      setError("");
      return;
    }
    const existingRate = account?.eventRates?.find((item) => item.eventId === event.id);
    startEvent({ ...blankEvent(), ...event, inrPerUsdt: existingRate?.inrPerUsdt ?? "", rateObservedAt: existingRate?.observedAt ?? "", rateSource: existingRate?.source ?? "" });
    setEditingEvent(true);
    setError("");
  };
  const saveEvent = () => {
    if (!account) return;
    if (!checkFields({
      "futures-event-at": { value: draft.at, label: "Activity time", timestamp: true },
      ...(draft.type === "execution" ? {
        "futures-quantity": { value: draft.quantity, label: "Quantity" },
        "futures-price": { value: draft.price, label: "Execution price" },
        "futures-leverage": { value: draft.leverage, label: "Reported leverage" },
      } : { "futures-amount": { value: draft.amountUsdt, label: "Signed amount" } }),
      ...(draft.inrPerUsdt ? {
        "futures-event-rate-at": { value: draft.rateObservedAt, label: "Rate observation time", timestamp: true },
        "futures-event-rate-source": { value: draft.rateSource, label: "Rate source" },
      } : {}),
    })) return;
    try {
      const id = draft.id || createId("futures-event");
      let event: UsdmFuturesEvent;
      if (draft.type === "execution") {
        if (!draft.leverage) throw new Error("Enter the leverage shown for this execution.");
        event = { type: "execution", id, at: draft.at, contract: draft.contract.trim().toUpperCase(),
          side: draft.side, quantity: draft.quantity, price: draft.price, feeUsdt: draft.feeUsdt, leverage: draft.leverage };
      } else if (draft.type === "funding") {
        event = { type: "funding", id, at: draft.at, contract: draft.contract.trim().toUpperCase(), amountUsdt: draft.amountUsdt };
      } else {
        event = { type: "transfer", id, at: draft.at, amountUsdt: draft.amountUsdt, transferBoundary: draft.transferBoundary };
      }
      if (draft.inrPerUsdt && !draft.rateSource.trim()) throw new Error("Enter the source of the historical USDT/INR rate.");
      const eventRates: UsdmEventRate[] = [...(account.eventRates ?? []).filter((item) => item.eventId !== id)];
      if (draft.inrPerUsdt) eventRates.push({ eventId: id, inrPerUsdt: draft.inrPerUsdt, observedAt: draft.rateObservedAt, source: draft.rateSource.trim() });
      store.getState().saveFuturesAccount({ ...account, events: [...account.events.filter((item) => item.id !== id), event], eventRates, valuation: undefined });
      setDraft(blankEvent());
      setEditingEvent(false);
      setError("");
    } catch (cause) { report(cause); }
  };
  const deleteEvent = (id: string) => {
    if (!account) return;
    try {
      const linked = account.events.find((item) => item.id === id);
      if (linked?.type === "transfer" && linked.linkedCashEntryId) {
        store.getState().deleteFuturesCashTransfer(account.id, id);
        if (cashFunding.eventId === id) setEditingCashFunding(false);
        setError("");
        return;
      }
      store.getState().saveFuturesAccount({ ...account, events: account.events.filter((item) => item.id !== id), eventRates: account.eventRates?.filter((item) => item.eventId !== id), valuation: undefined });
      if (draft.id === id) setEditingEvent(false);
      setError("");
    } catch (cause) { report(cause); }
  };
  const confirmDeleteEvent = (id: string) => {
    Keyboard.dismiss();
    deletionPending.current = true;
    setDeletion({ kind: "event", id });
  };
  const saveCashFunding = () => {
    if (!account) return;
    if (!checkFields({
      "futures-cash-at": { value: cashFunding.at, label: "Movement time", timestamp: true },
      "futures-cash-usdt": { value: cashFunding.usdt, label: "USDT amount" },
      "futures-cash-inr": { value: cashFunding.cashInr, label: "Cash amount" },
      "futures-cash-rate": { value: cashFunding.rate, label: "INR per USDT" },
      "futures-cash-rate-at": { value: cashFunding.rateAt, label: "Rate observation time", timestamp: true },
      "futures-cash-rate-source": { value: cashFunding.rateSource, label: "Rate source" },
    })) return;
    try {
      store.getState().saveFuturesCashTransfer({
        accountId: account.id,
        cashEntryId: cashFunding.cashEntryId || createId("cash"),
        eventId: cashFunding.eventId || createId("futures-event"),
        at: cashFunding.at,
        amountUsdt: cashFunding.direction === "toFutures" ? cashFunding.usdt : `-${cashFunding.usdt}`,
        cashAmountInr: Number(cashFunding.cashInr), conversionFeeInr: cashFunding.feeInr,
        inrPerUsdt: cashFunding.rate, rateObservedAt: cashFunding.rateAt,
        rateSource: cashFunding.rateSource, notes: cashFunding.notes,
      });
      setCashFunding(blankCashFunding());
      setEditingCashFunding(false);
      setError("");
    } catch (cause) { report(cause); }
  };
  const confirmDeleteAccount = () => {
    Keyboard.dismiss();
    deletionPending.current = true;
    setDeletion({ kind: "wallet" });
  };
  const applyDeletion = () => {
    if (!deletion || !deletionPending.current) return;
    deletionPending.current = false;
    setDeletion(null);
    if (deletion.kind === "event") {
      deleteEvent(deletion.id);
      return;
    }
    try {
      store.getState().deleteFuturesAccount(ACCOUNT_ID);
      exit.request(onBack, true, false);
    } catch (cause) { report(cause); }
  };
  const saveValuation = () => {
    if (!account) return;
    if (!checkFields({
      "futures-valuation-at": { value: valuationAt, label: "Valuation time", timestamp: true },
      "futures-observed-wallet": { value: observedWallet, label: "Observed wallet balance" },
      "futures-observed-wallet-at": { value: observedWalletAt, label: "Wallet observation time", timestamp: true },
      "futures-wallet-source": { value: walletSource, label: "Wallet source" },
      "futures-current-rate": { value: rate, label: "INR per USDT" },
      "futures-current-rate-at": { value: rateAt, label: "Rate observation time", timestamp: true },
      "futures-current-rate-source": { value: rateSource, label: "Rate source" },
      ...(openPositions.length ? {
        ...Object.fromEntries(openPositions.map((position) => [`futures-mark-${position.contract}`, {
          value: markPrices[position.contract] ?? "", label: `${position.contract} mark price`,
        }])),
        "futures-mark-at": { value: markAt, label: "Mark observation time", timestamp: true },
        "futures-mark-source": { value: markSource, label: "Mark source" },
      } : {}),
    })) return;
    try {
      const replay = replayUsdmFutures(account, { asOf: valuationAt, marks: [], eventRates: account.eventRates });
      const marks: UsdmMark[] = replay.positions.filter((position) => position.signedQuantity !== "0").map((position) => ({
        contract: position.contract, priceUsdt: markPrices[position.contract] ?? "", observedAt: markAt, source: markSource.trim(),
        ...(markMargins[position.contract] ? { reportedMarginUsdt: markMargins[position.contract] } : {}),
      }));
      store.getState().saveFuturesAccount({ ...account, valuation: {
        asOf: valuationAt, marks, inrRate: { inrPerUsdt: rate, observedAt: rateAt, source: rateSource.trim() },
        reconciliation: { observedWalletUsdt: observedWallet, observedAt: observedWalletAt, source: walletSource.trim(),
          allOpenPositionsConfirmed: positionsConfirmed, allWalletEventsConfirmed: eventsConfirmed,
          portfolioBoundaryConfirmed: boundaryConfirmed },
      } });
      valuationBaseline.current = valuationSnapshot;
      setError("");
    } catch (cause) { report(cause); }
  };

  let replay: ReturnType<typeof replayUsdmFutures> | undefined;
  let contribution: ReturnType<typeof calculateUsdmPortfolioContribution> | undefined;
  if (account) {
    try {
      contribution = calculateUsdmPortfolioContribution(account, isoNow(), state.cashEntries);
      replay = replayUsdmFutures(account, {
        asOf: isoNow(), marks: account.valuation?.marks ?? [],
        inrRate: account.valuation?.inrRate, reconciliation: account.valuation?.reconciliation,
        eventRates: account.eventRates,
      });
    } catch { /* The store validates on write; surface the form error below. */ }
  }
  const openPositions = replay?.positions.filter((position) => position.signedQuantity !== "0") ?? [];

  const walletEditor = (
        <PremiumCard section>
          <SectionHeader title={account ? "Starting wallet" : "Create Futures wallet"} />
          {account && !editingAccount ? <>
            <AppText color="secondary">{displayTime(account.openingAt)}</AppText>
            <Money value={`${account.openingWalletUsdt} USDT`} masked={masked} />
            <AppButton title="Correct starting wallet" variant="secondary" onPress={() => { walletBaseline.current = walletSnapshot; setEditingAccount(true); }} />
          </> : <>
            <EntryField label="Observed starting wallet (USDT)" keyboardType="decimal-pad" secureTextEntry={masked} value={openingWallet} onChangeText={setOpeningWallet} testID="futures-opening-wallet" />
            <TimeField label="Starting wallet time" value={openingAt} onChange={setOpeningAt} error={fieldErrors["futures-opening-at"]} testID="futures-opening-at" />
            <View style={styles.conversionGroup} testID="futures-opening-conversion">
              <SectionHeader title="INR conversion" />
              <EntryField label="INR per USDT at starting wallet date" keyboardType="decimal-pad" value={openingRate} onChangeText={setOpeningRate} testID="futures-opening-rate" />
              {openingRate ? <TimeField label="Rate observed at" value={openingRateAt} onChange={setOpeningRateAt} suggestedAt={openingAt} suggestedLabel="Observed at wallet time" error={fieldErrors["futures-opening-rate-at"]} testID="futures-opening-rate-at" /> : null}
              {openingRate ? <EntryField label="Starting rate source" value={openingRateSource} onChangeText={setOpeningRateSource} testID="futures-opening-rate-source" /> : null}
            </View>
            <AppButton title={account ? "Save corrected wallet" : "Create futures wallet"} onPress={saveAccount} testID="futures-save-account" />
          </>}
        </PremiumCard>
  );

  return <EntryErrors.Provider value={{ errors: fieldErrors, refs: fieldRefs.current, clear: clearFieldError }}><KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.fill}>
    <ScreenContainer scroll scrollRef={scrollRef} testID="futures-screen">
      <View ref={contentRef} collapsable={false} style={styles.content}>
        <ScreenHeader title="USDT Futures" subtitle="Manual · Binance · Cross · One-way" leading={<IconButton accessibilityLabel="Back to Settings" icon="arrow-back" onPress={exit.back} testID="futures-back" />} />
        {error ? <AppText accessibilityLiveRegion="polite" style={styles.error} testID="futures-error">{error}</AppText> : null}
        {!account ? walletEditor : null}
        {account ? <>
          <PremiumCard section testID="futures-position-summary">
            <AppText color="secondary">Wallet from recorded activity</AppText>
            <Money prominent value={`${replay?.walletUsdt ?? "Unavailable"} USDT`} masked={masked} />
            <View style={styles.metric}>
              <AppText color="secondary">Realized P&L since starting wallet</AppText><Money value={`${replay?.realizedPnlUsdt ?? "Unavailable"} USDT`} masked={masked} />
            </View>
            <View style={styles.metric}>
              <AppText color="secondary">Account equity {account.valuation ? `· ${displayTime(account.valuation.asOf)}` : ""}</AppText><Money value={replay?.equityInr ? `₹${replay.equityInr}` : "Not verified in INR"} masked={masked} />
            </View>
            <AppText color="secondary">{replay ? valuationLabels[replay.valuationStatus] : "Check account records"} · Since-start INR rates: {replay?.eventRateStatus === "complete" ? "ready" : replay?.eventRateStatus ?? "unknown"}</AppText>
            {contribution?.status === "ready" ? <View style={styles.breakdown} testID="futures-inr-breakdown">
              <AppText weight="bold">INR contribution breakdown</AppText>
              <AppText>Invested basis · opening wallet + external flows + linked Cash</AppText><Money value={`₹${contribution.investedInr}`} masked={masked} />
              <AppText>Net P&L</AppText><Money value={`₹${contribution.pnlInr}`} masked={masked} />
              <AppText>Trading and funding, net of fees</AppText><Money value={`₹${contribution.tradingPnlInr}`} masked={masked} />
              <AppText>FX, conversion costs and rounding</AppText><Money value={`₹${contribution.fxPnlInr}`} masked={masked} />
              <AppText color="secondary">Fees {masked ? "••••" : `${replay?.feesUsdt} USDT`} · Funding {masked ? "••••" : `${replay?.fundingUsdt} USDT`} · External flows {masked ? "••••" : `${replay?.externalTransfersUsdt} USDT`}</AppText>
            </View> : <AppText color="secondary">Portfolio inclusion pending: {contribution?.reason ?? "Check account records."}</AppText>}
            {replay && replay.historicalRealizedPnlUsdt !== "0" ? <AppText color="secondary">Older realized P&L: {masked ? "••••" : `${replay.historicalRealizedPnlUsdt} USDT · ${replay.historicalRealizedPnlInr === null ? "INR rate pending" : `₹${replay.historicalRealizedPnlInr}`}`} (already reflected in starting wallet, not added again)</AppText> : null}
            <AppText color="secondary">Only verified wallet equity enters portfolio totals. Notional and margin are never added.</AppText>
          </PremiumCard>
          <PremiumCard section testID="futures-open-positions">
            <SectionHeader title="Open positions" />
            {!openPositions.length ? <AppText color="secondary">No open positions in recorded activity.</AppText> : null}
            {openPositions.map((position) => <View key={position.contract} style={styles.row}>
              <AppText weight="bold">{position.contract} · {position.signedQuantity.startsWith("-") ? "Short" : "Long"}</AppText>
              <AppText>Qty {masked ? "••••" : position.signedQuantity} · Entry {masked ? "••••" : position.entryPriceUsdt} USDT · {position.leverage ?? "?"}× reported</AppText>
              <View style={styles.metric}><AppText color="secondary">Notional exposure</AppText><Money masked={masked} value={position.notionalUsdt === null ? "Mark price needed" : `${position.notionalUsdt} USDT`} /></View>
              <View style={styles.metric}><AppText color="secondary">Indicative margin at mark</AppText><Money masked={masked} value={position.notionalUsdt && position.leverage ? `${decimal(position.notionalUsdt).dividedBy(position.leverage).toFixed(2)} USDT` : "Leverage and mark needed"} /></View>
              {position.reportedMarginUsdt !== null ? <AppText>Binance-reported position margin: {masked ? "••••" : `${position.reportedMarginUsdt} USDT`}</AppText> : null}
              <AppText>Unrealized: {masked ? "••••" : `${position.unrealizedPnlUsdt ?? "mark needed"} USDT`}</AppText>
            </View>)}
            <AppText color="secondary">Indicative margin is not Binance maintenance margin or liquidation risk. It is already part of wallet funds, never added to equity.</AppText>
          </PremiumCard>
          <PremiumCard section>
            <SectionHeader title="Activity" />
            <AppText color="secondary">Add every fill and its fee. Enter funding and transfers separately. Use the linked Cash form below for recorded INR Cash; an unlinked Binance Spot movement remains outside portfolio totals.</AppText>
            {account.events.map((event) => <View key={event.id} style={styles.row}>
              <AppText weight="bold">{event.type === "execution" ? `${event.side.toUpperCase()} ${event.contract}` : event.type === "funding" ? `Funding ${event.contract}` : event.linkedCashEntryId ? "Linked Cash transfer" : event.transferBoundary === "internal" ? "Unlinked Spot transfer" : "External transfer"}</AppText>
              <AppText color="secondary">{displayTime(event.at)} · {masked ? "••••" : event.type === "execution" ? `${event.quantity} @ ${event.price} USDT` : `${event.amountUsdt} USDT`}</AppText>
              <View style={styles.choices}>
                <AppButton title="Edit" variant="secondary" onPress={() => exit.request(() => editEvent(event), false, event.type === "transfer" && event.linkedCashEntryId ? cashDirty : eventDirty)} testID={`edit-futures-${event.id}`} />
                <Pressable accessibilityRole="button" onPress={() => confirmDeleteEvent(event.id)} style={styles.eventDelete} testID={`delete-futures-${event.id}`}><AppText style={styles.error}>Delete</AppText></Pressable>
              </View>
            </View>)}
            {replay?.closedCycles.length ? <>
              <SectionHeader title="Closed trades" />
              {replay.closedCycles.map((cycle) => <View key={cycle.closingExecutionId} style={styles.row}>
                <AppText weight="bold">{cycle.contract} · {cycle.side}</AppText>
                <AppText color="secondary">{displayTime(cycle.openedAt)} → {displayTime(cycle.closedAt)}</AppText>
                <AppText>Gross realized: {masked ? "••••" : `${cycle.realizedPnlUsdt} USDT`} · Fees: {masked ? "••••" : `${cycle.feesUsdt} USDT`}</AppText>
                {cycle.beforeWalletCutover ? <AppText color="secondary">Before starting wallet; not added again.</AppText> : null}
              </View>)}
            </> : null}
            {!editingEvent ? <AppButton title="Add activity" onPress={() => startEvent(blankEvent())} testID="futures-add-event" /> : <>
              <View style={styles.choices} accessibilityRole="radiogroup">
                {(["execution", "funding", "transfer"] as const).map((type) => <Choice key={type} label={type} selected={draft.type === type} onPress={() => setField("type", type)} testID={`futures-type-${type}`} />)}
              </View>
              <TimeField label="Activity time" value={draft.at} onChange={(value) => setField("at", value)} error={fieldErrors["futures-event-at"]} testID="futures-event-at" />
              {draft.type !== "transfer" ? <EntryField label="USDT perpetual contract (e.g. BTCUSDT)" value={draft.contract} onChangeText={(value) => setField("contract", value)} testID="futures-contract" /> : null}
              {draft.type === "execution" ? <>
                <View style={styles.choices} accessibilityRole="radiogroup"><Choice label="Buy" selected={draft.side === "buy"} onPress={() => setField("side", "buy")} /><Choice label="Sell" selected={draft.side === "sell"} onPress={() => setField("side", "sell")} /></View>
                <EntryField label="Base-asset quantity" keyboardType="decimal-pad" value={draft.quantity} onChangeText={(value) => setField("quantity", value)} testID="futures-quantity" />
                <EntryField label="Execution price (USDT per unit)" keyboardType="decimal-pad" value={draft.price} onChangeText={(value) => setField("price", value)} testID="futures-price" />
                <EntryField label="Fee (USDT)" keyboardType="decimal-pad" secureTextEntry={masked} value={draft.feeUsdt} onChangeText={(value) => setField("feeUsdt", value)} testID="futures-fee" />
                <EntryField label="Reported leverage (1–125×)" keyboardType="number-pad" value={draft.leverage} onChangeText={(value) => setField("leverage", value)} testID="futures-leverage" />
              </> : <EntryField label={draft.type === "funding" ? "Signed funding (USDT)" : "Signed transfer (USDT)"} keyboardType="numbers-and-punctuation" secureTextEntry={masked} value={draft.amountUsdt} onChangeText={(value) => setField("amountUsdt", value)} testID="futures-amount" />}
              {draft.type === "transfer" ? <View style={styles.choices} accessibilityRole="radiogroup"><Choice label="External funding" selected={draft.transferBoundary === "external"} onPress={() => setField("transferBoundary", "external")} /><Choice label="Unlinked Binance Spot" selected={draft.transferBoundary === "internal"} onPress={() => setField("transferBoundary", "internal")} /></View> : null}
              <EntryField label="Historical INR per USDT (optional until verified)" keyboardType="decimal-pad" value={draft.inrPerUsdt} onChangeText={(value) => setField("inrPerUsdt", value)} testID="futures-event-rate" />
              {draft.inrPerUsdt ? <TimeField label="Rate observed at" value={draft.rateObservedAt} onChange={(value) => setField("rateObservedAt", value)} suggestedAt={draft.at} suggestedLabel="Observed at activity time" error={fieldErrors["futures-event-rate-at"]} testID="futures-event-rate-at" /> : null}
              {draft.inrPerUsdt ? <EntryField label="Historical rate source" value={draft.rateSource} onChangeText={(value) => setField("rateSource", value)} testID="futures-event-rate-source" /> : null}
              <AppButton title="Save activity" onPress={saveEvent} testID="futures-save-event" />
              <AppButton title="Cancel" variant="ghost" onPress={() => exit.request(() => setEditingEvent(false), false, eventDirty)} testID="futures-cancel-event" />
            </>}
          </PremiumCard>
          <PremiumCard section testID="futures-cash-funding">
            <SectionHeader title="Move Cash and USDT" />
            <AppText color="secondary">Record a movement you already made between recorded INR Cash and your Binance USDT Futures wallet. This does not transfer funds or open a trade on Binance. Enter executions separately.</AppText>
            {!editingCashFunding ? <AppButton title="Record Cash funding or withdrawal" variant="secondary" onPress={() => startCash(blankCashFunding())} testID="futures-add-cash-funding" /> : <>
              <View style={styles.choices} accessibilityRole="radiogroup">
                <Choice label="Cash to Futures" selected={cashFunding.direction === "toFutures"} onPress={() => setCashFunding((current) => ({ ...current, direction: "toFutures" }))} />
                <Choice label="Futures to Cash" selected={cashFunding.direction === "toCash"} onPress={() => setCashFunding((current) => ({ ...current, direction: "toCash" }))} />
              </View>
              <TimeField label="Movement time" value={cashFunding.at} onChange={(at) => setCashFunding((current) => ({ ...current, at }))} error={fieldErrors["futures-cash-at"]} testID="futures-cash-at" />
              <EntryField label="USDT actually credited or withdrawn" keyboardType="decimal-pad" value={cashFunding.usdt} onChangeText={(usdt) => setCashFunding((current) => ({ ...current, usdt }))} testID="futures-cash-usdt" />
              <EntryField label="INR actually debited or credited in Cash" keyboardType="decimal-pad" secureTextEntry={masked} value={cashFunding.cashInr} onChangeText={(cashInr) => setCashFunding((current) => ({ ...current, cashInr }))} testID="futures-cash-inr" />
              <EntryField label="Conversion fee in INR (0 if included in effective rate)" keyboardType="decimal-pad" value={cashFunding.feeInr} onChangeText={(feeInr) => setCashFunding((current) => ({ ...current, feeInr }))} testID="futures-cash-fee" />
              <EntryField label="INR per USDT for this movement" keyboardType="decimal-pad" value={cashFunding.rate} onChangeText={(rate) => setCashFunding((current) => ({ ...current, rate }))} testID="futures-cash-rate" />
              <TimeField label="Rate observed at" value={cashFunding.rateAt} onChange={(rateAt) => setCashFunding((current) => ({ ...current, rateAt }))} suggestedAt={cashFunding.at} suggestedLabel="Observed at movement time" error={fieldErrors["futures-cash-rate-at"]} testID="futures-cash-rate-at" />
              <EntryField label="Rate source" value={cashFunding.rateSource} onChangeText={(rateSource) => setCashFunding((current) => ({ ...current, rateSource }))} testID="futures-cash-rate-source" />
              <EntryField label="Reference or notes (optional)" value={cashFunding.notes} onChangeText={(notes) => setCashFunding((current) => ({ ...current, notes }))} />
              <AppText color="secondary">Cash amount must equal USDT × recorded rate plus the INR fee when funding, or minus the fee when withdrawing. A linked transfer is not an external contribution.</AppText>
              <AppButton title={cashFunding.eventId ? "Save corrected movement" : "Save linked movement"} onPress={saveCashFunding} testID="futures-save-cash-funding" />
              <AppButton title="Cancel" variant="ghost" onPress={() => exit.request(() => setEditingCashFunding(false), false, cashDirty)} testID="futures-cancel-cash" />
            </>}
          </PremiumCard>
          {walletEditor}
          <PremiumCard>
            <SectionHeader title="Verify current value" />
            <AppText color="secondary">Use the Futures wallet balance (not total equity), current mark prices, and an observed USDT/INR rate. Their sources and times stay with the record. Re-enter after changing activity.</AppText>
            <TimeField label="Valuation time" value={valuationAt} onChange={setValuationAt} error={fieldErrors["futures-valuation-at"]} testID="futures-valuation-at" />
            <EntryField label="Observed Futures wallet (USDT)" keyboardType="decimal-pad" secureTextEntry={masked} value={observedWallet} onChangeText={setObservedWallet} testID="futures-observed-wallet" />
            <TimeField label="Wallet observed at" value={observedWalletAt} onChange={setObservedWalletAt} suggestedAt={valuationAt} suggestedLabel="Observed at valuation time" error={fieldErrors["futures-observed-wallet-at"]} testID="futures-observed-wallet-at" />
            <EntryField label="Wallet balance source" value={walletSource} onChangeText={setWalletSource} testID="futures-wallet-source" />
            {openPositions.map((position) => <EntryField key={position.contract} label={`${position.contract} mark price (USDT)`} keyboardType="decimal-pad" value={markPrices[position.contract] ?? ""} onChangeText={(value) => setMarkPrices((current) => ({ ...current, [position.contract]: value }))} testID={`futures-mark-${position.contract}`} />)}
            {openPositions.map((position) => <EntryField key={`margin-${position.contract}`} label={`${position.contract} Binance-reported position margin (USDT, optional)`} keyboardType="decimal-pad" secureTextEntry={masked} value={markMargins[position.contract] ?? ""} onChangeText={(value) => setMarkMargins((current) => ({ ...current, [position.contract]: value }))} testID={`futures-margin-${position.contract}`} />)}
            {openPositions.length ? <EntryField label="Mark price source" value={markSource} onChangeText={setMarkSource} testID="futures-mark-source" /> : null}
            {openPositions.length ? <TimeField label="Marks observed at" value={markAt} onChange={setMarkAt} suggestedAt={valuationAt} suggestedLabel="Observed at valuation time" error={fieldErrors["futures-mark-at"]} testID="futures-mark-at" /> : null}
            <EntryField label="INR per USDT" keyboardType="decimal-pad" value={rate} onChangeText={setRate} testID="futures-current-rate" />
            <TimeField label="Rate observed at" value={rateAt} onChange={setRateAt} suggestedAt={valuationAt} suggestedLabel="Observed at valuation time" error={fieldErrors["futures-current-rate-at"]} testID="futures-current-rate-at" />
            <EntryField label="INR rate source" value={rateSource} onChangeText={setRateSource} testID="futures-current-rate-source" />
            <Choice checkbox label="All open positions checked against Binance" selected={positionsConfirmed} onPress={() => setPositionsConfirmed((value) => !value)} testID="futures-positions-confirmed" />
            <Choice checkbox label="All wallet events since starting balance entered" selected={eventsConfirmed} onPress={() => setEventsConfirmed((value) => !value)} testID="futures-events-confirmed" />
            <Choice checkbox label="Wallet is not already counted in Spot, Cash or another holding" selected={boundaryConfirmed} onPress={() => setBoundaryConfirmed((value) => !value)} testID="futures-boundary-confirmed" />
            <AppButton title="Save valuation" onPress={saveValuation} testID="futures-save-valuation" />
          </PremiumCard>
          <Pressable accessibilityRole="button" onPress={confirmDeleteAccount} style={styles.deleteAction} testID="futures-delete-account"><AppText style={styles.error}>Delete Futures wallet</AppText></Pressable>
        </> : null}
      </View>
    </ScreenContainer>
    <Modal visible={deletion !== null} transparent onRequestClose={cancelDeletion} testID="futures-delete-modal">
      <ScreenContainer scroll testID="futures-delete-confirmation">
        <View accessibilityViewIsModal><PremiumCard>
          <SectionHeader title={deletion?.kind === "wallet" ? "Delete Futures wallet?" : "Delete this activity?"} />
          <AppText color="secondary">{deletion?.kind === "wallet"
            ? "This permanently removes the wallet, all executions, rates and valuation evidence from this device. Make a backup first if you need the history."
            : "Balances and P&L will be recalculated from the remaining records. Linked Cash movements are removed together. This cannot be undone without a backup."}</AppText>
          <AppButton title="Cancel" variant="secondary" onPress={cancelDeletion} testID="futures-cancel-delete" />
          <AppButton title={deletion?.kind === "wallet" ? "Delete wallet" : "Delete activity"} variant="destructive" onPress={applyDeletion} testID="futures-confirm-delete" />
        </PremiumCard></View>
      </ScreenContainer>
    </Modal>
    <Modal visible={exit.prompt} transparent onRequestClose={exit.keepEditing}>
      <View style={styles.modal} accessibilityViewIsModal><PremiumCard>
        <SectionHeader title="Discard unsaved changes?" />
        <AppText color="secondary">These draft edits have not been saved. Existing wallet and activity records will not be deleted.</AppText>
        <AppButton title="Keep editing" onPress={exit.keepEditing} testID="futures-keep-editing" />
        <AppButton title="Discard changes" variant="secondary" onPress={exit.discard} testID="futures-discard" />
      </PremiumCard></View>
    </Modal>
  </KeyboardAvoidingView></EntryErrors.Provider>;
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  conversionGroup: { gap: spacing.md, paddingTop: spacing.sm },
  fill: { flex: 1 },
  modal: { flex: 1, justifyContent: "center", padding: spacing.screenHorizontal, backgroundColor: colors.background },
  breakdown: { borderTopColor: colors.border.subtle, borderTopWidth: 1, gap: spacing.xs, paddingTop: spacing.md },
  metric: { gap: spacing.xs, paddingVertical: spacing.xs },
  deleteAction: { alignSelf: "center", minHeight: 48, justifyContent: "center", paddingHorizontal: spacing.md },
  eventDelete: { minHeight: 48, justifyContent: "center", paddingHorizontal: spacing.md },
  content: { gap: spacing.cardGap, paddingTop: spacing.md, paddingBottom: spacing.xl },
  row: { borderTopColor: colors.border.subtle, borderTopWidth: 1, gap: spacing.xs, paddingTop: spacing.md },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  choice: { minHeight: 48, justifyContent: "center", borderColor: colors.border.strong, borderWidth: 1, borderRadius: 12, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  selected: { borderColor: colors.primary, backgroundColor: colors.surface.elevated },
  checkbox: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  choiceLabel: { flex: 1 },
  error: { color: colors.loss },
}));
