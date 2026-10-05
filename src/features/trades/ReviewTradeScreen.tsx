import { useRef, useState, useSyncExternalStore } from "react";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import type { StoreApi } from "zustand/vanilla";

import {
  AppButton,
  AppText,
  EmptyState,
  PremiumCard,
  ScreenContainer,
  ScreenHeader,
  SensitiveValueReveal,
  SectionHeader,
  getAdaptiveLayoutMode,
  useSensitiveValueReveal,
} from "@/src/components/common";
import { DatePickerField, FormTextField } from "@/src/components/forms";
import { getCalendarDatePart, isFutureCalendarDate } from "@/src/domain/dates";
import { formatCurrency, formatINR } from "@/src/domain/formatters";
import { isManualTrade } from "@/src/domain/transactionSemantics";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import { interaction, radii, spacing, createThemedStyles } from "@/src/theme";
import type { ConvictionScore } from "@/src/types";

type ReviewTradeScreenProps = {
  backLabel?: string;
  now?: Date;
  onCancel: () => void;
  onComplete: (message: string) => void;
  store?: StoreApi<PortfolioStoreState>;
  tradeId: string;
};

type Errors = Partial<Record<"conviction" | "date" | "fees" | "holdDays" | "price" | "quantity" | "save", string>>;
const convictionScores: ConvictionScore[] = [1, 2, 3, 4, 5];

function parsePositive(value: string) {
  const parsed = Number(value.trim());
  return value.trim() && Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function failureMessage(reason?: string) {
  if (reason === "notFound") return "This transaction is no longer available.";
  if (reason === "insufficientCash") return "Cash available on this date is not enough for the corrected purchase.";
  if (reason === "oversold") return "This correction would sell more units than were held on that date.";
  if (reason === "inconsistentLink") return "The linked cash movement is inconsistent. The transaction was not changed.";
  if (reason === "assetMismatch" || reason === "typeMismatch") return "Transaction identity changed. Return to Holdings and try again.";
  return "This transaction could not be saved safely. Review it and try again.";
}

export function ReviewTradeScreen({
  backLabel = "Back to Holdings",
  now = new Date(),
  onCancel,
  onComplete,
  store = getPortfolioStore(),
  tradeId,
}: ReviewTradeScreenProps) {
  const styles = useStyles();
  const snapshot = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const currentTrade = snapshot.trades.find((item) => item.id === tradeId);
  const initialTradeRef = useRef(currentTrade);
  const trade = initialTradeRef.current;
  const editableTrade = trade && isManualTrade(trade) ? trade : undefined;
  const asset = trade ? snapshot.assets.find((item) => item.id === trade.assetId) : undefined;
  const [quantity, setQuantity] = useState(() => editableTrade ? String(editableTrade.quantity) : "");
  const [price, setPrice] = useState(() => editableTrade ? String(editableTrade.pricePerUnit) : "");
  const [fees, setFees] = useState(() => editableTrade?.fees !== undefined ? String(editableTrade.fees) : "0");
  const [date, setDate] = useState(() => getCalendarDatePart(trade?.date ?? "") ?? "");
  const [notes, setNotes] = useState(() => trade?.notes ?? "");
  const [conviction, setConviction] = useState(() => trade?.conviction?.toString() ?? "");
  const [holdDays, setHoldDays] = useState(() => trade?.intendedHoldDays?.toString() ?? "");
  const [rationale, setRationale] = useState(() => trade?.whyThisTrade ?? "");
  const [isContextExpanded, setIsContextExpanded] = useState(() => Boolean(
    trade?.notes || trade?.conviction || trade?.intendedHoldDays || trade?.whyThisTrade,
  ));
  const { fontScale } = useWindowDimensions();
  const stackFields = getAdaptiveLayoutMode(fontScale) !== "standard";
  const [errors, setErrors] = useState<Errors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const { isRevealed, reveal } = useSensitiveValueReveal(
    snapshot.preferences.maskWealthValues,
  );
  const actionInFlightRef = useRef(false);

  if (!currentTrade || !trade || !asset) {
    return (
      <ScreenContainer testID="review-trade-screen">
        <EmptyState
          actionLabel={backLabel}
          message="It may have already been removed or its holding may have changed."
          title="Transaction unavailable"
          onAction={onCancel}
        />
      </ScreenContainer>
    );
  }

  if (!isRevealed) {
    return (
      <ScreenContainer testID="review-trade-screen">
        <View style={styles.content}>
          <ScreenHeader
            title="Review Transaction"
            subtitle={`${asset.name} · values masked`}
          />
          <PremiumCard>
            <SensitiveValueReveal
              onReveal={reveal}
              testID="reveal-trade"
            />
          </PremiumCard>
          <AppButton title={backLabel} variant="secondary" onPress={onCancel} />
        </View>
      </ScreenContainer>
    );
  }

  if (!editableTrade) {
    const transferLabel = trade.type === "transferIn" ? "Transfer in" : "Transfer out";
    const provenance = trade.importProvenance;

    return (
      <ScreenContainer scroll testID="review-trade-screen">
        <View style={styles.content}>
          <ScreenHeader title="Review Transaction" subtitle={`${asset.name} · imported record`} />
          <PremiumCard>
            <SectionHeader title="Read-only transaction" />
            <AppText color="secondary">
              {transferLabel} records preserve ownership movement without inventing an execution price or cash value.
            </AppText>
            <View style={styles.identityRow}>
              <View><AppText color="secondary" variant="caption">Type</AppText><AppText weight="bold">{transferLabel}</AppText></View>
              <View><AppText color="secondary" variant="caption">Quantity</AppText><AppText weight="bold">{trade.quantity}</AppText></View>
            </View>
            <View style={styles.identityRow}>
              <View><AppText color="secondary" variant="caption">Date</AppText><AppText weight="bold">{getCalendarDatePart(trade.date) ?? trade.date}</AppText></View>
              {trade.type === "transferIn" && trade.acquisitionCostPerUnit !== undefined ? (
                <View><AppText color="secondary" variant="caption">Acquisition basis</AppText><AppText weight="bold">{formatCurrency(trade.acquisitionCostPerUnit, asset.currency)} / unit</AppText></View>
              ) : null}
            </View>
            {provenance ? (
              <AppText color="secondary" variant="caption">
                Imported from {provenance.sourceFormat} · batch {provenance.importBatchId}
              </AppText>
            ) : null}
          </PremiumCard>
          <AppButton title={backLabel} variant="secondary" onPress={onCancel} />
        </View>
      </ScreenContainer>
    );
  }

  const stableTrade = editableTrade;
  const linkedCashEntry = snapshot.cashEntries.find(
    (entry) => entry.linkedTradeId === stableTrade.id,
  );

  const parsedQuantity = parsePositive(quantity);
  const parsedPrice = parsePositive(price);
  const parsedFees = fees.trim() === "" ? 0 : Number(fees);
  const previewTotal = parsedQuantity && parsedPrice && Number.isFinite(parsedFees)
    ? (parsedQuantity * parsedPrice) + (stableTrade.type === "buy" ? parsedFees : -parsedFees)
    : null;

  function validate() {
    const nextErrors: Errors = {};
    if (!parsedQuantity) nextErrors.quantity = "Quantity must be greater than zero.";
    if (!parsedPrice) nextErrors.price = "Price must be greater than zero.";
    if (!Number.isFinite(parsedFees) || parsedFees < 0) nextErrors.fees = "Fees cannot be negative.";
    if (!getCalendarDatePart(date)) nextErrors.date = "Choose a valid date.";
    else if (isFutureCalendarDate(date, now)) nextErrors.date = "Date cannot be in the future.";
    const parsedConviction = conviction.trim() === "" ? undefined : Number(conviction);
    if (parsedConviction !== undefined && (!Number.isInteger(parsedConviction) || parsedConviction < 1 || parsedConviction > 5)) {
      nextErrors.conviction = "Conviction must be between 1 and 5.";
    }
    const parsedHoldDays =
      stableTrade.type === "buy" && holdDays.trim() !== ""
        ? Number(holdDays)
        : undefined;
    if (parsedHoldDays !== undefined && (!Number.isInteger(parsedHoldDays) || parsedHoldDays <= 0)) {
      nextErrors.holdDays = "Holding period must be a whole number of days.";
    }
    if (previewTotal !== null && previewTotal <= 0) nextErrors.fees = "Fees must be lower than sale proceeds.";
    setErrors(nextErrors);
    if (nextErrors.conviction || nextErrors.holdDays) setIsContextExpanded(true);
    if (Object.keys(nextErrors).length > 0 || !parsedQuantity || !parsedPrice) return null;
    return { parsedConviction, parsedFees, parsedHoldDays };
  }

  async function save() {
    if (actionInFlightRef.current) return;
    const valid = validate();
    if (!valid) return;
    actionInFlightRef.current = true;
    setIsSaving(true);
    let completed = false;
    try {
      const result = store.getState().correctTrade({
        ...stableTrade,
        conviction: valid.parsedConviction as ConvictionScore | undefined,
        date,
        fees: valid.parsedFees,
        intendedHoldDays:
          stableTrade.type === "buy"
            ? valid.parsedHoldDays
            : stableTrade.intendedHoldDays,
        notes: notes.trim() || undefined,
        pricePerUnit: parsedPrice!,
        quantity: parsedQuantity!,
        whyThisTrade: rationale.trim() || undefined,
      });
      if (result.status === "rejected") {
        setErrors({ save: failureMessage(result.reason) });
        return;
      }
      await Promise.resolve();
      completed = true;
      onComplete(result.pendingMonths.length > 0
        ? "Transaction saved. Portfolio history will refresh automatically."
        : "Transaction saved. Portfolio and cash records updated.");
    } catch {
      setErrors({ save: failureMessage() });
    } finally {
      if (!completed) {
        actionInFlightRef.current = false;
        setIsSaving(false);
      }
    }
  }

  async function deleteTransaction() {
    if (actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    setIsSaving(true);
    let completed = false;
    try {
      const result = store.getState().deleteTrade(stableTrade.id);
      if (result.status === "rejected") {
        setErrors({ save: failureMessage(result.reason) });
        return;
      }
      await Promise.resolve();
      completed = true;
      onComplete(result.pendingMonths.length > 0
        ? "Transaction removed. Portfolio history will refresh automatically."
        : "Transaction removed. Portfolio and cash records updated.");
    } catch {
      setErrors({ save: "This transaction could not be removed safely. Try again." });
    } finally {
      if (!completed) {
        actionInFlightRef.current = false;
        setIsSaving(false);
      }
    }
  }

  return (
    <ScreenContainer scroll testID="review-trade-screen">
      <View style={styles.content}>
        <ScreenHeader title="Review Transaction" subtitle={asset.name} />
        <PremiumCard section>
          <SectionHeader title={trade.type === "buy" ? "Purchase" : "Sale"} />
          <View style={[styles.row, stackFields && styles.stacked]}>
            <View style={styles.flex}><FormTextField error={errors.quantity} keyboardType="decimal-pad" label="Quantity" onChangeText={setQuantity} testID="trade-correction-quantity-input" value={quantity} /></View>
            <View style={styles.flex}><FormTextField error={errors.price} keyboardType="decimal-pad" label="Price per unit" onChangeText={setPrice} testID="trade-correction-price-input" value={price} /></View>
          </View>
          <FormTextField error={errors.fees} keyboardType="decimal-pad" label="Fees" onChangeText={setFees} testID="trade-correction-fees-input" value={fees} />
          <DatePickerField error={errors.date} label="Transaction date" maximumDate={now} onChange={setDate} testID="trade-correction-date-input" value={date} />
        </PremiumCard>
        <PremiumCard elevated>
          <AppText color="secondary" variant="caption">{stableTrade.type === "buy" ? "Corrected purchase total" : "Corrected net proceeds"}</AppText>
          <AppText testID="trade-correction-total" variant="title" weight="bold">{previewTotal === null ? "Not available" : formatINR(previewTotal)}</AppText>
          <AppText color="secondary" variant="caption">
            {linkedCashEntry
              ? "The linked cash movement updates with this transaction."
              : "No cash movement is linked to this legacy transaction."}
          </AppText>
        </PremiumCard>
        <PremiumCard section>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: isContextExpanded }}
            onPress={() => setIsContextExpanded((expanded) => !expanded)}
            style={({ pressed }) => [styles.contextToggle, pressed && styles.pressed]}
            testID="trade-correction-context-toggle"
          >
            <View style={styles.flex}>
              <AppText weight="bold">Investment context</AppText>
              <AppText color="secondary" variant="caption">Optional notes and investment plan</AppText>
            </View>
            <AppText color="secondary">{isContextExpanded ? "Hide" : "Show"}</AppText>
          </Pressable>
          {isContextExpanded ? <>
          <FormTextField label="Notes" multiline onChangeText={setNotes} testID="trade-correction-notes-input" value={notes} />
          <SectionHeader title="Conviction (optional)" />
          <View style={styles.convictionRow}>
            {convictionScores.map((score) => {
              const selected = conviction === String(score);
              return <Pressable accessibilityLabel={`Conviction ${score}`} accessibilityRole="button" accessibilityState={{ selected }} key={score} onPress={() => setConviction(selected ? "" : String(score))} style={({ pressed }) => [styles.convictionChip, selected && styles.convictionChipActive, pressed && styles.pressed]} testID={`trade-correction-conviction-${score}`}><AppText color={selected ? "inverse" : "secondary"} weight="bold">{score}</AppText></Pressable>;
            })}
          </View>
          {errors.conviction ? <AppText style={styles.errorText} variant="caption">{errors.conviction}</AppText> : null}
          {stableTrade.type === "buy" ? (
            <FormTextField error={errors.holdDays} keyboardType="number-pad" label="Planned holding period (days)" onChangeText={setHoldDays} value={holdDays} />
          ) : null}
          <FormTextField label="Why this investment?" multiline onChangeText={setRationale} value={rationale} />
          </> : null}
        </PremiumCard>
        {errors.save ? <AppText accessibilityLiveRegion="polite" selectable style={styles.errorText} variant="caption">{errors.save}</AppText> : null}
        <View style={styles.actions}>
          <AppButton accessibilityState={{ busy: isSaving, disabled: isSaving }} disabled={isSaving} title={isSaving ? "Saving..." : "Save changes"} testID="save-trade-correction-button" onPress={save} />
          <AppButton disabled={isSaving} title="Cancel" variant="secondary" onPress={onCancel} />
        </View>
        <View style={styles.removalSection}>
          {isConfirmingDelete ? (
            <PremiumCard>
              <SectionHeader title="Remove this transaction?" />
              <AppText color="secondary" variant="caption">
                {linkedCashEntry
                  ? "Its linked cash funding or sale proceeds will be removed at the same time."
                  : "No cash movement is linked to this legacy transaction."}
              </AppText>
              <AppText color="secondary" variant="caption">Portfolio totals and automatic history will be recalculated. This cannot be undone.</AppText>
              <View style={styles.actions}>
                <AppButton disabled={isSaving} title="Keep transaction" variant="secondary" onPress={() => setIsConfirmingDelete(false)} />
                <AppButton disabled={isSaving} title={isSaving ? "Removing..." : "Remove transaction"} variant="destructive" testID="confirm-delete-trade-button" onPress={deleteTransaction} />
              </View>
            </PremiumCard>
          ) : <AppButton title="Remove transaction" variant="ghost" testID="delete-trade-button" onPress={() => setIsConfirmingDelete(true)} />}
        </View>
      </View>
    </ScreenContainer>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  actions: { gap: spacing.sm },
  content: { gap: spacing.cardGap, paddingTop: spacing.md, paddingBottom: spacing.lg },
  contextToggle: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: interaction.minimumTouchTarget },
  convictionChip: { alignItems: "center", backgroundColor: colors.surface.elevated, borderRadius: radii.button, flex: 1, justifyContent: "center", minHeight: interaction.minimumTouchTarget },
  convictionChipActive: { backgroundColor: colors.primary },
  convictionRow: { flexDirection: "row", gap: spacing.sm },
  removalSection: { borderTopColor: colors.border.subtle, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.md },
  errorText: { color: colors.loss },
  flex: { flex: 1 },
  identityRow: { flexDirection: "row", gap: spacing.xl, justifyContent: "space-between" },
  pressed: { opacity: interaction.pressedOpacity },
  row: { flexDirection: "row", gap: spacing.sm },
  stacked: { flexDirection: "column" },
}));
