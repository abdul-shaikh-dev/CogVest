import { Pressable, View } from "react-native";

import { AppText, assetClassLabel, CategoryIcon, PremiumCard, SectionHeader } from "@/src/components/common";
import { SelectionField } from "@/src/components/forms";

import { useStyles } from "./addHoldingStyles";
import { getInstrumentOptions, getSectorOptions } from "./addHoldingViewModel";
import { assetClasses, type AddOpeningPositionController } from "./useAddOpeningPosition";

/** Step 2: confirm the asset class, instrument and sector suggested for the asset. */
export function AddHoldingClassPhase({ holding }: { holding: AddOpeningPositionController }) {
  const styles = useStyles();
  const {
    assetClass,
    assetName,
    errors,
    instrumentType,
    instrumentTypeConfidence,
    metadataReviewMessage,
    resetReview,
    sectorType,
    sectorTypeConfidence,
    setInstrumentType,
    setSectorType,
    symbol,
    ticker,
    updateAssetClass,
  } = holding;
  const instrumentOptions = getInstrumentOptions(assetClass, instrumentType);
  const sectorOptions = getSectorOptions(sectorType);
  return (
      <PremiumCard section testID="add-holding-phase-class">
        <SectionHeader title="Confirm details" />
        <AppText
          color="secondary"
          testID="provider-metadata-review-copy"
          variant="caption"
        >
          Suggested details. Confirm anything marked for review.
        </AppText>
        <View style={styles.summaryCard}>
          <CategoryIcon assetClass={assetClass} size={20} />
          <View style={styles.summaryCopy}>
            <AppText weight="bold">{assetName || "Asset not named"}</AppText>
            <AppText color="secondary" variant="caption">
              {symbol || "Symbol"} • {ticker || "Ticker"}
            </AppText>
          </View>
        </View>
        <AppText color="secondary" testID="metadata-review-message" variant="caption">
          {metadataReviewMessage}
        </AppText>
        <View style={styles.classRow}>
          {assetClasses.map((currentClass) => {
            const isSelected = assetClass === currentClass;
            const choiceLabel = currentClass === "stock"
              ? "Stocks"
              : currentClass === "etf"
                ? "ETFs"
                : assetClassLabel(currentClass);

            return (
              <Pressable
                accessibilityLabel={choiceLabel}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                key={currentClass}
                onPress={() => updateAssetClass(currentClass)}
                style={({ pressed }) => [
                  styles.classChip,
                  isSelected && styles.classChipActive,
                  pressed && styles.pressed,
                ]}
                testID={`asset-class-${currentClass}`}
              >
                <CategoryIcon assetClass={currentClass} size={16} />
                <AppText
                  color={isSelected ? "primary" : "secondary"}
                  variant="caption"
                  weight="bold"
                >
                  {choiceLabel}
                </AppText>
              </Pressable>
            );
          })}
        </View>
        <SelectionField
          helperText={
            instrumentTypeConfidence === "reviewRequired"
              ? "Confirm the instrument that best describes this holding."
              : undefined
          }
          helperTestID={
            instrumentTypeConfidence === "reviewRequired"
              ? "instrument-type-review-hint"
              : undefined
          }
          label="Instrument type"
          onChange={(value) => {
            setInstrumentType(value);
            resetReview();
          }}
          options={instrumentOptions}
          testIDPrefix="instrument-type"
          value={instrumentType}
        />
        {errors.instrumentType ? (
          <AppText selectable style={styles.errorText} variant="caption">
            {errors.instrumentType}
          </AppText>
        ) : null}
        {assetClass === "stock" ? (
          <>
            <SelectionField
              helperText={
                sectorTypeConfidence === "reviewRequired"
                  ? "Optional. Leave as Unknown if you are unsure."
                  : "Optional portfolio context."
              }
              helperTestID={
                sectorTypeConfidence === "reviewRequired"
                  ? "sector-type-review-hint"
                  : undefined
              }
              label="Sector"
              onChange={(value) => {
                setSectorType(value);
                resetReview();
              }}
              options={sectorOptions}
              testIDPrefix="sector-type"
              value={sectorType}
            />
            {errors.sectorType ? (
              <AppText selectable style={styles.errorText} variant="caption">
                {errors.sectorType}
              </AppText>
            ) : null}
          </>
        ) : (
          <AppText
            color="secondary"
            testID="sector-not-applicable"
            variant="caption"
          >
            Sector is not needed for this asset class.
          </AppText>
        )}
      </PremiumCard>
  );
}
