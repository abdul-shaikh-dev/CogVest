import type { Dispatch, SetStateAction } from "react";
import { Pressable, View } from "react-native";

import { AppButton, AppText, CategoryIcon, PremiumCard, SectionHeader } from "@/src/components/common";
import { DatePickerField, FormTextField } from "@/src/components/forms";
import { ContextualNudge } from "@/src/features/onboarding/ContextualNudge";

import { useStyles } from "./addHoldingStyles";
import {
  convictionScores,
  type AddOpeningPositionController,
  type AddOpeningPositionControllerInput,
} from "./useAddOpeningPosition";

/** Step 3: units, cost, current price, first purchase date and optional plan. */
export function AddHoldingPositionPhase({
  holding,
  now,
  quickSetup,
  setArePositionOptionsExpanded,
  showPositionOptions,
  store,
}: {
  holding: AddOpeningPositionController;
  now: AddOpeningPositionControllerInput["now"];
  quickSetup: boolean;
  setArePositionOptionsExpanded: Dispatch<SetStateAction<boolean>>;
  showPositionOptions: boolean;
  store: AddOpeningPositionControllerInput["store"];
}) {
  const styles = useStyles();
  const {
    assetClass,
    assetName,
    averageCostPrice,
    conviction,
    currentPrice,
    date,
    dateUnknown,
    errors,
    intendedHoldDays,
    notes,
    quantity,
    resetReview,
    setAverageCostPrice,
    setConviction,
    setCurrentPrice,
    setDate,
    setDateUnknown,
    setIntendedHoldDays,
    setNotes,
    setQuantity,
    symbol,
    ticker,
  } = holding;
  return (
      <PremiumCard section testID="add-holding-phase-position">
        <SectionHeader title="Position Details" />
        <View style={styles.positionIdentity} testID="position-asset-context">
          <CategoryIcon assetClass={assetClass} size={20} />
          <View style={styles.summaryCopy}>
            <AppText weight="bold">{assetName}</AppText>
            <AppText color="secondary" variant="caption">{symbol}{ticker !== symbol ? ` • ${ticker}` : ""}</AppText>
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.flex}>
            <FormTextField
              error={errors.quantity}
              keyboardType="decimal-pad"
              label="Quantity"
              onChangeText={(value) => {
                setQuantity(value);
                resetReview();
              }}
              placeholder="25"
              testID="quantity-input"
              value={quantity}
            />
          </View>
          <View style={styles.flex}>
            <FormTextField
              error={errors.averageCostPrice}
              keyboardType="decimal-pad"
              label="Average cost"
              onChangeText={(value) => {
                setAverageCostPrice(value);
                resetReview();
              }}
              placeholder="1450"
              testID="average-cost-input"
              value={averageCostPrice}
            />
          </View>
        </View>
        <View style={styles.secondaryPositionFields}>
          <View>
            <FormTextField
              error={errors.currentPrice}
              keyboardType="decimal-pad"
              label="Current price"
              onChangeText={(value) => {
                setCurrentPrice(value);
                resetReview();
              }}
              placeholder="1678.25"
              testID="price-input"
              value={currentPrice}
            />
            <AppText color="secondary" variant="caption">
              If unavailable, save now and refresh or enter a manual price later.
            </AppText>
          </View>
          <View>
            {dateUnknown ? (
              <View style={styles.unknownDateSummary}>
                <AppText color="secondary" variant="caption">
                  First purchase date (optional)
                </AppText>
                <AppText weight="bold">Unknown</AppText>
              </View>
            ) : (
              <DatePickerField
                error={errors.date}
                label="First purchase date (optional)"
                maximumDate={now}
                onChange={(value) => {
                  setDate(value);
                  resetReview();
                }}
                testID="date-input"
                value={date}
              />
            )}
            <Pressable
              accessibilityLabel="First purchase date unknown"
              accessibilityRole="checkbox"
              accessibilityState={{ checked: dateUnknown }}
              onPress={() => {
                setDateUnknown(!dateUnknown);
                setDate("");
                resetReview();
              }}
              style={({ pressed }) => [
                styles.unknownDateControl,
                dateUnknown && styles.unknownDateControlSelected,
                pressed && styles.pressed,
              ]}
              testID="first-purchase-date-unknown"
            >
              <AppText
                color={dateUnknown ? "primary" : "secondary"}
                variant="caption"
                weight="bold"
              >
                I don't know
              </AppText>
            </Pressable>
          </View>
        </View>
        {!quickSetup ? (
          <AppButton
            accessibilityState={{ expanded: showPositionOptions }}
            onPress={() => setArePositionOptionsExpanded((expanded) => !expanded)}
            testID="toggle-position-options"
            title={showPositionOptions ? "Hide optional details" : "Add notes or a holding plan"}
            variant="ghost"
          />
        ) : null}
        {!quickSetup && showPositionOptions ? <View style={styles.convictionGroup}>
          <ContextualNudge kind="metadata" store={store} hasConviction={Boolean(conviction)} hasPlan={Boolean(intendedHoldDays.trim())} />
          <AppText color="secondary" variant="caption" weight="medium">
            Conviction optional
          </AppText>
          <View style={styles.convictionRow}>
            {convictionScores.map((score) => {
              const scoreValue = score.toString();
              const isSelected = conviction === scoreValue;

              return (
                <Pressable
                  accessibilityLabel={`Conviction ${score}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  key={score}
                  onPress={() => {
                    setConviction(isSelected ? "" : scoreValue);
                    resetReview();
                  }}
                  style={({ pressed }) => [
                    styles.convictionChip,
                    isSelected && styles.convictionChipActive,
                    pressed && styles.pressed,
                  ]}
                  testID={`conviction-${score}`}
                >
                  <AppText
                    color={isSelected ? "inverse" : "secondary"}
                    weight="bold"
                  >
                    {score}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
          {errors.conviction ? (
            <AppText selectable style={styles.errorText} variant="caption">
              {errors.conviction}
            </AppText>
          ) : null}
        </View> : null}
        {!quickSetup && showPositionOptions ? (
          <FormTextField
            error={errors.intendedHoldDays}
            keyboardType="number-pad"
            label="Planned holding period (days)"
            onChangeText={(value) => {
              setIntendedHoldDays(value);
              resetReview();
            }}
            placeholder="Optional"
            testID="intended-hold-days-input"
            value={intendedHoldDays}
          />
        ) : null}
        {!quickSetup && showPositionOptions ? <FormTextField
          label="Note"
          multiline
          onChangeText={(value) => {
            setNotes(value);
            resetReview();
          }}
          placeholder="Optional note"
          testID="notes-input"
          value={notes}
        /> : null}
      </PremiumCard>
  );
}
