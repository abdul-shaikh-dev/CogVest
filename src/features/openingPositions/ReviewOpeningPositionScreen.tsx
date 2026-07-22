import { useRef, useState, useSyncExternalStore } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { StoreApi } from "zustand/vanilla";

import {
  AppButton,
  AppText,
  EmptyState,
  PremiumCard,
  ScreenContainer,
  ScreenHeader,
  SectionHeader,
} from "@/src/components/common";
import { DatePickerField, FormTextField } from "@/src/components/forms";
import { getCalendarDatePart } from "@/src/domain/dates";
import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";
import { colors, interaction, radii, spacing } from "@/src/theme";
import type { ConvictionScore, OpeningPosition } from "@/src/types";

import {
  type OpeningPositionFormValues,
  validateOpeningPositionForm,
} from "./openingPositionForm";

type ReviewOpeningPositionScreenProps = {
  now?: Date;
  onCancel: () => void;
  onComplete: (message: string) => void;
  openingPositionId: string;
  store?: StoreApi<PortfolioStoreState>;
};

type CorrectionErrors = Partial<
  Record<
    "averageCostPrice" | "conviction" | "currentPrice" | "date" | "quantity" | "save",
    string
  >
>;

const convictionScores: ConvictionScore[] = [1, 2, 3, 4, 5];

function usePortfolioSnapshot(store: StoreApi<PortfolioStoreState>) {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

function saveFailureMessage(reason?: string) {
  if (reason === "notFound") {
    return "This opening position is no longer available.";
  }

  if (reason === "assetMismatch") {
    return "The holding identity changed. Return to Holdings and try again.";
  }

  return "This opening position could not be saved safely. Review it and try again.";
}

export function ReviewOpeningPositionScreen({
  now = new Date(),
  onCancel,
  onComplete,
  openingPositionId,
  store = getPortfolioStore(),
}: ReviewOpeningPositionScreenProps) {
  const snapshot = usePortfolioSnapshot(store);
  const currentPosition = snapshot.openingPositions.find(
    (position) => position.id === openingPositionId,
  );
  const initialPositionRef = useRef(currentPosition);
  const initialPosition = initialPositionRef.current;
  const asset = initialPosition
    ? snapshot.assets.find((item) => item.id === initialPosition.assetId)
    : undefined;
  const [quantity, setQuantity] = useState(() =>
    initialPosition ? String(initialPosition.quantity) : "",
  );
  const [averageCostPrice, setAverageCostPrice] = useState(() =>
    initialPosition ? String(initialPosition.averageCostPrice) : "",
  );
  const [currentPrice, setCurrentPrice] = useState(() =>
    initialPosition?.currentPrice !== undefined
      ? String(initialPosition.currentPrice)
      : "",
  );
  const [date, setDate] = useState(
    () => getCalendarDatePart(initialPosition?.date ?? "") ?? "",
  );
  const [notes, setNotes] = useState(() => initialPosition?.notes ?? "");
  const [conviction, setConviction] = useState(
    () => initialPosition?.conviction?.toString() ?? "",
  );
  const [errors, setErrors] = useState<CorrectionErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const actionInFlightRef = useRef(false);

  if (!currentPosition || !initialPosition || !asset) {
    return (
      <ScreenContainer testID="review-opening-position-screen">
        <EmptyState
          actionLabel="Back to Holdings"
          message="It may have already been removed or the holding identity may have changed."
          title="Opening position unavailable"
          onAction={onCancel}
        />
      </ScreenContainer>
    );
  }

  const position = initialPosition;
  const positionAsset = asset;

  function validate() {
    const values: OpeningPositionFormValues = {
      assetClass: positionAsset.assetClass,
      assetName: positionAsset.name,
      averageCostPrice,
      conviction,
      currentPrice,
      date,
      instrumentType: positionAsset.instrumentType ?? "other",
      notes,
      quoteSourceId: positionAsset.quoteSourceId,
      quantity,
      sectorType: positionAsset.sectorType ?? "other",
      symbol: positionAsset.symbol,
      ticker: positionAsset.ticker,
    };
    const result = validateOpeningPositionForm(values, now);

    if (!result.isValid) {
      setErrors(result.errors);
      return null;
    }

    return result.value;
  }

  async function save() {
    if (actionInFlightRef.current) {
      return;
    }

    const value = validate();

    if (!value) {
      return;
    }

    actionInFlightRef.current = true;
    setIsSaving(true);
    let completed = false;

    try {
      const result = store.getState().correctOpeningPosition({
        ...position,
        averageCostPrice: value.averageCostPrice,
        conviction: value.conviction,
        currentPrice: value.currentPrice,
        date: value.date,
        notes: value.notes,
        quantity: value.quantity,
      });

      if (result.status === "rejected") {
        setErrors({ save: saveFailureMessage(result.reason) });
        return;
      }

      await Promise.resolve();
      completed = true;
      onComplete(
        result.pendingMonths.length > 0
          ? "Saved. Portfolio history will refresh automatically."
          : "Portfolio history updated.",
      );
    } catch {
      setErrors({ save: saveFailureMessage() });
    } finally {
      if (!completed) {
        actionInFlightRef.current = false;
        setIsSaving(false);
      }
    }
  }

  async function deletePosition() {
    if (actionInFlightRef.current) {
      return;
    }

    actionInFlightRef.current = true;
    setIsSaving(true);
    let completed = false;

    try {
      const result = store
        .getState()
        .deleteOpeningPosition(position.id);

      if (result.status === "rejected") {
        setErrors({ save: saveFailureMessage(result.reason) });
        return;
      }

      await Promise.resolve();
      completed = true;
      onComplete(
        result.pendingMonths.length > 0
          ? "Opening position removed. History will refresh automatically."
          : "Opening position removed. Portfolio history updated.",
      );
    } catch {
      setErrors({
        save: "This opening position could not be removed safely. Try again.",
      });
    } finally {
      if (!completed) {
        actionInFlightRef.current = false;
        setIsSaving(false);
      }
    }
  }

  return (
    <ScreenContainer scroll testID="review-opening-position-screen">
      <View style={styles.content}>
        <ScreenHeader
          title="Review Opening Position"
          subtitle={`${positionAsset.name} · local record`}
        />

        <PremiumCard>
          <SectionHeader title="Position details" />
          <FormTextField
            error={errors.quantity}
            keyboardType="decimal-pad"
            label="Quantity"
            onChangeText={setQuantity}
            testID="opening-correction-quantity-input"
            value={quantity}
          />
          <FormTextField
            error={errors.averageCostPrice}
            keyboardType="decimal-pad"
            label="Average cost"
            onChangeText={setAverageCostPrice}
            testID="opening-correction-average-cost-input"
            value={averageCostPrice}
          />
          <FormTextField
            error={errors.currentPrice}
            keyboardType="decimal-pad"
            label="Stored fallback price"
            onChangeText={setCurrentPrice}
            testID="opening-correction-current-price-input"
            value={currentPrice}
          />
          <AppText color="secondary" variant="caption">
            Live quotes remain managed at the holding level. This value is used
            when a live quote is unavailable.
          </AppText>
          <DatePickerField
            error={errors.date}
            label="Date acquired"
            maximumDate={now}
            onChange={setDate}
            testID="opening-correction-date-input"
            value={date}
          />
          <FormTextField
            label="Notes"
            multiline
            onChangeText={setNotes}
            testID="opening-correction-notes-input"
            value={notes}
          />
        </PremiumCard>

        <PremiumCard>
          <SectionHeader title="Conviction (optional)" />
          <View style={styles.convictionRow}>
            {convictionScores.map((score) => {
              const scoreValue = String(score);
              const selected = conviction === scoreValue;

              return (
                <Pressable
                  accessibilityLabel={`Conviction ${score}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  key={score}
                  onPress={() => {
                    setConviction(selected ? "" : scoreValue);
                    setErrors((current) => ({
                      ...current,
                      conviction: undefined,
                    }));
                  }}
                  style={({ pressed }) => [
                    styles.convictionChip,
                    selected && styles.convictionChipActive,
                    pressed && styles.pressed,
                  ]}
                  testID={`opening-correction-conviction-${score}`}
                >
                  <AppText
                    color={selected ? "inverse" : "secondary"}
                    weight="bold"
                  >
                    {score}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
          {errors.conviction ? (
            <AppText style={styles.errorText} variant="caption">
              {errors.conviction}
            </AppText>
          ) : null}
        </PremiumCard>

        {errors.save ? (
          <AppText
            accessibilityLiveRegion="polite"
            selectable
            style={styles.errorText}
            variant="caption"
          >
            {errors.save}
          </AppText>
        ) : null}

        <View style={styles.actions}>
          <AppButton
            disabled={isSaving}
            title="Cancel"
            variant="secondary"
            onPress={onCancel}
          />
          <AppButton
            accessibilityState={{ busy: isSaving, disabled: isSaving }}
            disabled={isSaving}
            title={isSaving ? "Saving..." : "Save changes"}
            testID="save-opening-correction-button"
            onPress={save}
          />
        </View>

        <PremiumCard>
          <SectionHeader title="Remove opening position" />
          <AppText color="secondary" variant="caption">
            This removes the original position record. Later buy and sell
            records for this holding stay unchanged.
          </AppText>
          {isConfirmingDelete ? (
            <View style={styles.deleteConfirmation}>
              <AppText weight="bold">Remove this opening position?</AppText>
              <AppText color="secondary" variant="caption">
                Portfolio totals and automatic history will be recalculated.
                This cannot be undone.
              </AppText>
              <View style={styles.actions}>
                <AppButton
                  disabled={isSaving}
                  title="Keep position"
                  variant="secondary"
                  onPress={() => setIsConfirmingDelete(false)}
                />
                <AppButton
                  accessibilityState={{ busy: isSaving, disabled: isSaving }}
                  disabled={isSaving}
                  title={isSaving ? "Removing..." : "Remove position"}
                  variant="destructive"
                  testID="confirm-delete-opening-position-button"
                  onPress={deletePosition}
                />
              </View>
            </View>
          ) : (
            <AppButton
              title="Remove opening position"
              variant="ghost"
              testID="delete-opening-position-button"
              onPress={() => setIsConfirmingDelete(true)}
            />
          )}
        </PremiumCard>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "flex-end",
  },
  content: {
    gap: spacing.lg,
    paddingVertical: spacing.lg,
  },
  convictionChip: {
    alignItems: "center",
    backgroundColor: colors.surface.elevated,
    borderRadius: radii.button,
    flex: 1,
    justifyContent: "center",
    minHeight: interaction.minimumTouchTarget,
  },
  convictionChipActive: {
    backgroundColor: colors.primary,
  },
  convictionRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  deleteConfirmation: {
    backgroundColor: colors.surface.elevated,
    borderRadius: radii.button,
    gap: spacing.sm,
    padding: spacing.md,
  },
  errorText: {
    color: colors.loss,
  },
  pressed: {
    opacity: interaction.pressedOpacity,
  },
});
