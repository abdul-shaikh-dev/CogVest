import { useMemo, useState } from "react";
import {
  useWindowDimensions,
  View,
} from "react-native";
import type { StoreApi } from "zustand/vanilla";

import {
  AppButton,
  AppText,
  CategoryIcon,
  DisclosureButton,
  EmptyState,
  GroupedListRow,
  IconButton,
  MASKED_INR_VALUE,
  MaskedValue,
  PremiumCard,
  ScreenContainer,
  ScreenHeader,
  SectionHeader,
  SensitiveValueReveal,
  getAdaptiveLayoutMode,
  useSensitiveValueReveal,
} from "@/src/components/common";
import { formatLocalCalendarDate } from "@/src/domain/dates";
import { isEpfAccountMove, type EpfAccount } from "@/src/domain/epf";
import { summarizeEpfForReporting } from "@/src/domain/epf/reporting";
import { formatDate, formatINR } from "@/src/domain/formatters";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import { createId } from "@/src/utils";
import {
  epfProviderLabel,
  epfStatusLabel,
} from "./epfAccountForm";
import { eventAmountLabel, eventTitle } from "./epfEntryForm";
import { compareCodeUnits } from "@/src/domain/ordering";
import { usePortfolioFields } from "@/src/hooks";
import { EpfAccountForm } from "./EpfAccountEditor";
import { useStyles } from "./epfAccountStyles";
import { applyEpfChange } from "./epfChange";

type EpfAccountScreenProps = {
  accountId?: string;
  now?: Date;
  onBack: () => void;
  onComplete: (accountId: string) => void;
  onUpdateBalance: (accountId: string) => void;
  onOpenEntry?: (accountId: string, entryId?: string) => void;
  /** Offered on a new account: import EPFO passbooks instead of typing a balance (#740). */
  onImportPassbooks?: () => void;
  store?: StoreApi<PortfolioStoreState>;
};

export function EpfAccountScreen({
  accountId,
  now = new Date(),
  onBack,
  onComplete,
  onUpdateBalance,
  onOpenEntry,
  onImportPassbooks,
  store = getPortfolioStore(),
}: EpfAccountScreenProps) {
  const styles = useStyles();
  const snapshot = usePortfolioFields(store, ["assets", "epf", "preferences"]);
  const [savedAccountId, setSavedAccountId] = useState<string>();
  const resolvedId = accountId ?? savedAccountId;
  const existing = snapshot.epf.accounts.find((account) => account.id === resolvedId);
  const [isEditing, setIsEditing] = useState(!existing);
  const { isRevealed, reveal } = useSensitiveValueReveal(snapshot.preferences.maskWealthValues);

  if (accountId && !existing) {
    return (
      <ScreenContainer testID="epf-account-screen">
        <EmptyState actionLabel="Back to Holdings" message="It may have already been removed on another screen."
          onAction={onBack} title="EPF account unavailable" />
      </ScreenContainer>
    );
  }

  if (isEditing) {
    if (existing && !isRevealed) {
      return (
        <ScreenContainer testID="epf-account-form-screen">
          <View style={styles.content}>
            <ScreenHeader title="Edit EPF account" subtitle={`${existing.nickname} · values masked`} />
            <PremiumCard><SensitiveValueReveal onReveal={reveal} testID="reveal-epf-account" /></PremiumCard>
            <AppButton onPress={() => setIsEditing(false)} title="Back" variant="secondary" />
          </View>
        </ScreenContainer>
      );
    }
    return (
      <EpfAccountForm
        key={existing?.id ?? "new"}
        account={existing}
        now={now}
        onBack={() => (existing ? setIsEditing(false) : onBack())}
        onImportPassbooks={existing ? undefined : onImportPassbooks}
        onComplete={(id) => {
          setSavedAccountId(id);
          setIsEditing(false);
          onComplete(id);
        }}
        store={store}
      />
    );
  }

  return (
    <EpfAccountDetail account={existing as EpfAccount} now={now} onBack={onBack}
      onEdit={() => setIsEditing(true)} onUpdateBalance={() => onUpdateBalance((existing as EpfAccount).id)}
      onOpenEntry={onOpenEntry ? (entryId) => onOpenEntry((existing as EpfAccount).id, entryId) : undefined} store={store} />
  );
}

function EpfAccountDetail({ account, now, onBack, onEdit, onUpdateBalance, onOpenEntry, store }: {
  account: EpfAccount;
  now: Date;
  onBack: () => void;
  onEdit: () => void;
  onUpdateBalance: () => void;
  onOpenEntry?: (entryId?: string) => void;
  store: StoreApi<PortfolioStoreState>;
}) {
  const styles = useStyles();
  const snapshot = usePortfolioFields(store, ["assets", "epf", "preferences"]);
  const { fontScale, width } = useWindowDimensions();
  const stacked = width < 360 || getAdaptiveLayoutMode(fontScale) !== "standard";
  const masked = snapshot.preferences.maskWealthValues;
  const today = formatLocalCalendarDate(now);
  const summary = useMemo(() => summarizeEpfForReporting(snapshot.epf, today), [snapshot.epf, today]);
  const value = summary.accounts.find((item) => item.accountId === account.id);
  const events = snapshot.epf.events
    .filter((event) => isEpfAccountMove(event)
      ? event.sourceId === account.id || event.destinationId === account.id : event.accountId === account.id)
    .sort((left, right) => compareCodeUnits(right.effectiveDate, left.effectiveDate) || compareCodeUnits(right.recordedAt, left.recordedAt));
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const components = value?.balance.components ?? null;
  const reversedIds = new Set(events.flatMap((event) => event.type === "reversal" ? [event.reversesId] : []));
  // A final settlement or a claim that moved the balance away closes the account.
  const settlement = events.find((event) => (event.type === "withdrawal" && event.settlement && !reversedIds.has(event.id)) ||
    (event.type === "claimTransfer" && event.sourceId === account.id));
  const movedTo = settlement?.type === "claimTransfer"
    ? snapshot.epf.accounts.find((item) => item.id === settlement.destinationId)?.nickname ?? "another EPF account" : null;

  return (
    <ScreenContainer scroll testID="epf-account-screen">
      <View style={styles.content}>
        <ScreenHeader
          action={<IconButton accessibilityLabel="Edit EPF account" icon="create-outline" onPress={onEdit} testID="edit-epf-account" />}
          leading={<IconButton accessibilityLabel="Back to Holdings" icon="arrow-back" onPress={onBack} testID="epf-account-back" />}
          subtitle={[epfProviderLabel(account.provider), account.employerLabel,
            settlement ? `${movedTo ? "Moved" : "Settled"} on ${formatDate(settlement.effectiveDate)}` : epfStatusLabel(account.status)].filter(Boolean).join(" · ")}
          title={account.nickname}
        />

        <PremiumCard section style={styles.balanceCard} testID="epf-balance-card">
          <View style={styles.balanceHeading}>
            <CategoryIcon assetClass="debt" size={22} />
            <AppText color="secondary">Recorded balance</AppText>
          </View>
          {value ? (
            <MaskedValue exactValue={formatINR(value.balance.total)} masked={masked} style={styles.balanceValue}
              testID="epf-account-total" value={formatINR(value.balance.total)} weight="bold" />
          ) : (
            <AppText style={styles.balanceValue} testID="epf-account-total" weight="bold">Unavailable</AppText>
          )}
          <AppText color="secondary" variant="caption" testID="epf-account-evidence">
            {settlement ? movedTo ? `Moved in full to ${movedTo} on ${formatDate(settlement.effectiveDate)}`
              : `Paid out in full on ${formatDate(settlement.effectiveDate)}`
              : value
                ? `As of ${formatDate(value.lastEvidenceDate)} · ${value.historyComplete ? "all activity recorded" : "later activity not confirmed"}`
                : "This account's records need review before a balance can be shown."}
          </AppText>
          {account.status !== "active" && value && value.balance.total > 0 ? (
            <AppText color="secondary" variant="caption">
              {epfStatusLabel(account.status)} accounts keep their balance in your portfolio until it is withdrawn or moved.
            </AppText>
          ) : null}
          {settlement ? null : <AppButton onPress={onUpdateBalance} testID="update-epf-balance" title="Update balance" />}
        </PremiumCard>

        <PremiumCard section>
          <DisclosureButton expanded={breakdownOpen} onPress={() => setBreakdownOpen((open) => !open)}
            testID="epf-breakdown-toggle" title="Employee and employer balances" />
          {breakdownOpen ? (
            <View testID="epf-breakdown">
              {components ? (
                <>
                  <Row label="Employee EPF" masked={masked} stacked={stacked} testID="epf-employee-balance" value={formatINR(components.employee)} />
                  <Row label="Employer EPF" masked={masked} stacked={stacked} testID="epf-employer-balance" value={formatINR(components.employer)} />
                </>
              ) : (
                <AppText color="secondary" variant="caption">The split is unknown for this balance. Update the balance with both statement figures to record it.</AppText>
              )}
              <AppText color="secondary" variant="caption">
                EPS pension contributions are not part of this balance.
              </AppText>
            </View>
          ) : null}
          <View style={styles.separator} />
          {value && value.capital !== null ? (
            <>
              <Row label="Invested capital" masked={masked} stacked={stacked} testID="epf-capital" value={formatINR(value.capital)} />
              <AppText color="secondary" variant="caption">
                {settlement ? movedTo ? `Nothing remains invested here; it moved to ${movedTo}.` : "Nothing remains invested after the final settlement."
                  : "Contributions recorded since this account started from ₹0. Interest is return, not invested capital."}
              </AppText>
            </>
          ) : (
            <>
              <Row label="Invested capital" stacked={stacked} testID="epf-capital" value="Unknown" />
              <AppText color="secondary" variant="caption">
                A statement balance includes past interest, so it does not show how much was contributed.
              </AppText>
            </>
          )}
        </PremiumCard>

        <PremiumCard section>
          <DisclosureButton expanded={activityOpen} onPress={() => setActivityOpen((open) => !open)}
            testID="epf-activity-toggle" title={`Activity (${events.length})`} />
          {activityOpen ? (
            <View testID="epf-activity">
              <GroupedListRow meta={formatDate(account.checkpoint.date)} title="Starting balance"
                value={masked ? MASKED_INR_VALUE : formatINR(account.checkpoint.balance.total)} />
              {events.map((event) => (
                <GroupedListRow key={event.id} meta={formatDate(event.effectiveDate)} testID={`epf-event-${event.id}`}
                  accessibilityLabel={`${eventTitle(event)}, ${formatDate(event.effectiveDate)}${masked ? "" : `, ${eventAmountLabel(event, account.id)}`}`}
                  onPress={onOpenEntry ? () => onOpenEntry(event.id) : undefined} showChevron title={eventTitle(event)}
                  value={masked ? MASKED_INR_VALUE : eventAmountLabel(event, account.id)} />
              ))}
            </View>
          ) : null}
          {onOpenEntry && !settlement ? (
            <AppButton onPress={() => onOpenEntry()} testID="add-epf-entry" title="Add entry" variant="secondary" />
          ) : null}
        </PremiumCard>

        <LegacyHoldingSection account={account} store={store} />
        <DeleteSection account={account} onDeleted={onBack} store={store} />
      </View>
    </ScreenContainer>
  );
}

function Row({ label, masked = false, stacked, testID, value }: {
  label: string; masked?: boolean; stacked: boolean; testID?: string; value: string;
}) {
  const styles = useStyles();
  return (
    <View style={[styles.row, stacked && styles.stacked]}>
      <AppText color="secondary">{label}</AppText>
      <MaskedValue exactValue={value} masked={masked} testID={testID} value={value} weight="bold" />
    </View>
  );
}

function LegacyHoldingSection({ account, store }: {
  account: EpfAccount; store: StoreApi<PortfolioStoreState>;
}) {
  const styles = useStyles();
  const snapshot = usePortfolioFields(store, ["assets", "epf", "preferences"]);
  const [choosing, setChoosing] = useState(false);
  const [pendingAssetId, setPendingAssetId] = useState<string>();
  const [error, setError] = useState("");
  const linkedElsewhere = new Set(snapshot.epf.accounts.flatMap((item) => item.id !== account.id && item.legacyAssetId ? [item.legacyAssetId] : []));
  const candidates = snapshot.assets.filter((asset) => asset.currency === "INR" && !linkedElsewhere.has(asset.id) &&
    (asset.instrumentType === undefined ? asset.assetClass === "debt" : asset.instrumentType === "debt" || asset.instrumentType === "other"));
  const linked = snapshot.assets.find((asset) => asset.id === account.legacyAssetId);
  const pending = candidates.find((asset) => asset.id === pendingAssetId);

  function save(legacyAssetId: string | undefined) {
    const { legacyAssetId: _previous, ...rest } = account;
    const next: EpfAccount = legacyAssetId ? { ...rest, legacyAssetId } : rest;
    const failure = applyEpfChange(store, { commandId: createId("epf-link"),
      reason: legacyAssetId ? "Link older holding" : "Remove older holding link",
      change: { type: "accountPut", account: next } }, store.getState().getBackupRevision());
    setError(failure ?? "");
    if (!failure) { setPendingAssetId(undefined); setChoosing(false); }
  }

  if (!linked && candidates.length === 0) return null;
  return (
    <PremiumCard section testID="epf-legacy-section">
      <SectionHeader title="Older holding" />
      {linked ? (
        <>
          <AppText testID="epf-legacy-linked">Replaces {linked.name} from {formatDate(account.checkpoint.date)}.</AppText>
          <AppText color="secondary" variant="caption">The original holding is kept for reference but no longer counted in portfolio totals from that date.</AppText>
          <AppButton onPress={() => save(undefined)} testID="epf-legacy-unlink" title="Remove link" variant="ghost" />
        </>
      ) : pending ? (
        <View testID="epf-legacy-confirm">
          <AppText weight="bold">Link {pending.name}?</AppText>
          <AppText color="secondary" variant="caption">
            From {formatDate(account.checkpoint.date)}, this EPF account replaces that holding in portfolio totals so EPF is counted once. The holding and its records stay unchanged.
          </AppText>
          <AppButton onPress={() => save(pending.id)} testID="epf-legacy-confirm-link" title="Link holding" />
          <AppButton onPress={() => setPendingAssetId(undefined)} title="Cancel" variant="secondary" />
        </View>
      ) : choosing ? (
        <View testID="epf-legacy-choices">
          <AppText color="secondary" variant="caption">Only rupee debt or other holdings can be linked.</AppText>
          {candidates.map((asset) => (
            <GroupedListRow key={asset.id} onPress={() => setPendingAssetId(asset.id)} showChevron
              testID={`epf-legacy-option-${asset.id}`} title={asset.name} />
          ))}
          <AppButton onPress={() => setChoosing(false)} title="Cancel" variant="secondary" />
        </View>
      ) : (
        <>
          <AppText color="secondary" variant="caption">
            If you tracked this EPF as a holding before, link it so it is not counted twice.
          </AppText>
          <AppButton onPress={() => setChoosing(true)} testID="epf-legacy-choose" title="Link an older holding" variant="secondary" />
        </>
      )}
      {error ? <AppText selectable style={styles.error}>{error}</AppText> : null}
    </PremiumCard>
  );
}

function DeleteSection({ account, onDeleted, store }: {
  account: EpfAccount; onDeleted: () => void; store: StoreApi<PortfolioStoreState>;
}) {
  const styles = useStyles();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [commandId] = useState(() => createId("epf-delete"));
  if (!confirming) {
    return <AppButton onPress={() => setConfirming(true)} testID="delete-epf-account" title="Delete EPF account" variant="ghost" />;
  }
  const preview = store.getState().previewEpfAccountDeletion(account.id);
  const transfers = store.getState().epf.events.filter((event) => preview.eventIds.includes(event.id) && isEpfAccountMove(event));

  function remove() {
    // Each step is a complete, validated state; a retry resumes safely by command ID.
    for (const eventId of preview.eventIds) {
      const failure = applyEpfChange(store, { commandId: `${commandId}-${eventId}`, reason: "Delete EPF account",
        change: { type: "eventRemove", id: eventId } }, store.getState().getBackupRevision());
      if (failure) { setError(failure); return; }
    }
    const failure = applyEpfChange(store, { commandId, reason: "Delete EPF account",
      change: { type: "accountRemove", id: account.id } }, store.getState().getBackupRevision());
    if (failure) setError(failure);
    else onDeleted();
  }

  return (
    <PremiumCard testID="delete-epf-confirmation">
      <AppText weight="bold">Delete this EPF account?</AppText>
      {transfers.length > 0 ? (
        <AppText color="secondary" variant="caption" testID="delete-epf-blocked">
          This account has {transfers.length} transfer{transfers.length === 1 ? "" : "s"} with another EPF account. Remove those transfers first so the other account stays correct.
        </AppText>
      ) : (
        <AppText color="secondary" variant="caption" testID="delete-epf-impact">
          This removes the account{preview.eventIds.length ? ` and its ${preview.eventIds.length} recorded entr${preview.eventIds.length === 1 ? "y" : "ies"}` : ""}
          {preview.cashEntryIds.length ? `, including ${preview.cashEntryIds.length} linked Cash entr${preview.cashEntryIds.length === 1 ? "y" : "ies"}` : ""}. Its value leaves your portfolio totals.
        </AppText>
      )}
      {error ? <AppText selectable style={styles.error}>{error}</AppText> : null}
      <View style={styles.actions}>
        {transfers.length === 0 ? (
          <AppButton onPress={remove} testID="confirm-delete-epf-account" title="Delete account" variant="destructive" />
        ) : null}
        <AppButton onPress={() => { setConfirming(false); setError(""); }} title="Keep account" variant="secondary" />
      </View>
    </PremiumCard>
  );
}
