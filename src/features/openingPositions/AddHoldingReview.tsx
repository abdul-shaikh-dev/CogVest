import type { Dispatch, SetStateAction } from "react";
import { TouchableOpacity, View } from "react-native";

import { AppButton, AppText, assetClassLabel, CategoryIcon, PremiumCard, SectionHeader } from "@/src/components/common";
import { instrumentTypeLabel, sectorTypeLabel } from "@/src/domain/assets";
import { formatINR, formatPercentage } from "@/src/domain/formatters";
import type { Quote } from "@/src/types";

import { useStyles } from "./addHoldingStyles";
import { formatSignedINR } from "./addHoldingViewModel";
import type { AddOpeningPositionController } from "./useAddOpeningPosition";

type Controller = AddOpeningPositionController;

function ReviewDetailRow({
  label,
  testID,
  value,
}: {
  label: string;
  testID?: string;
  value: string;
}) {
  const styles = useStyles();
  return (
    <View style={styles.reviewDetailRow} testID={testID}>
      <AppText color="secondary" variant="caption">
        {label}
      </AppText>
      <AppText style={styles.reviewDetailValue} weight="bold">
        {value}
      </AppText>
    </View>
  );
}

function ReviewSectionHeader({
  onEdit,
  testID,
  title,
}: {
  onEdit: () => void;
  testID: string;
  title: string;
}) {
  const styles = useStyles();
  return (
    <View style={styles.reviewSectionHeader}>
      <SectionHeader title={title} />
      <TouchableOpacity
        accessibilityLabel={`Edit ${title.toLowerCase()}`}
        accessibilityRole="button"
        activeOpacity={0.74}
        onPress={onEdit}
        style={styles.reviewEditAction}
        testID={testID}
      >
        <AppText color="secondary" variant="caption" weight="bold">
          Edit
        </AppText>
      </TouchableOpacity>
    </View>
  );
}

/** Step 4: the derived holding preview, valuation provenance and position summary. */
export function AddHoldingReview({
  candidateProviderQuote,
  holding,
  isMinimalMode,
  preservesProviderQuote,
  previewHolding,
  reviewAsset,
  reviewOpeningPosition,
  reviewQuoteSourceLabel,
}: {
  candidateProviderQuote?: Quote;
  holding: Controller;
  isMinimalMode: boolean;
  preservesProviderQuote: boolean;
  previewHolding: NonNullable<Controller["previewHolding"]>;
  reviewAsset: NonNullable<Controller["reviewAsset"]>;
  reviewOpeningPosition: NonNullable<Controller["reviewOpeningPosition"]>;
  reviewQuoteSourceLabel: string;
}) {
  const styles = useStyles();
  const {
    moveToPhase,
  } = holding;
  return (
      <View
        style={styles.reviewSections}
        testID="add-holding-phase-review"
      >
      <PremiumCard testID="derived-preview-card">
        <SectionHeader title="Review holding" />
        <View testID="derived-preview">
        <View style={styles.summaryCard}>
          <CategoryIcon assetClass={reviewAsset!.assetClass} size={20} />
          <View style={styles.summaryCopy}>
            <AppText weight="bold">{reviewAsset!.name}</AppText>
            <AppText color="secondary" variant="caption">
              {reviewAsset!.symbol} • {assetClassLabel(reviewAsset!.assetClass)}
            </AppText>
          </View>
        </View>
        <AppText color="secondary" testID="review-quote-provenance" variant="caption">
          {reviewQuoteSourceLabel}
        </AppText>
        <View style={styles.previewGrid}>
          <View style={styles.previewCell}>
            <AppText color="secondary" variant="caption">
              Invested
            </AppText>
            <AppText style={styles.financialValue} variant="title" weight="bold">
              {formatINR(previewHolding.totalInvested)}
            </AppText>
          </View>
          <View style={styles.previewCell}>
            <AppText color="secondary" variant="caption">
              Current
            </AppText>
            <AppText style={styles.financialValue} variant="title" weight="bold">
              {previewHolding.currentValue === null
                ? "Unavailable"
                : formatINR(previewHolding.currentValue)}
            </AppText>
          </View>
        </View>
        <View style={styles.reviewPnl} testID="review-pnl-summary">
          <View style={styles.reviewPnlValues}>
            <View style={styles.reviewPnlCell} testID="review-pnl-amount-cell">
            <AppText color="secondary" variant="caption">Holding P&amp;L</AppText>
            {previewHolding.unrealisedPnL === null ? (
              <AppText color="secondary" weight="bold">Unavailable</AppText>
            ) : (
              <AppText
                style={[
                  styles.financialValue,
                  previewHolding.unrealisedPnL >= 0
                    ? styles.positiveText
                    : styles.negativeText,
                ]}
                testID="derived-preview-pnl"
                variant="title"
                weight={isMinimalMode ? "medium" : "bold"}
              >
                {formatSignedINR(previewHolding.unrealisedPnL)}
              </AppText>
            )}
            </View>
            <View style={styles.reviewPnlCell} testID="review-pnl-percent-cell">
            <AppText color="secondary" variant="caption">Holding P&amp;L %</AppText>
            {previewHolding.unrealisedPnLPct === null ? (
              <AppText color="secondary" variant="caption">Percentage unavailable</AppText>
            ) : (
              <AppText
                style={
                  previewHolding.unrealisedPnLPct >= 0
                    ? styles.positiveText
                    : styles.negativeText
                }
                testID="derived-preview-pnl-percent"
                variant="title"
                accessibilityLabel={`P&L percentage ${formatPercentage(previewHolding.unrealisedPnLPct)}`}
                weight={isMinimalMode ? "medium" : "bold"}
              >
                {formatPercentage(previewHolding.unrealisedPnLPct)}
              </AppText>
            )}
            </View>
          </View>
        </View>
        <View testID="review-position">
          <ReviewSectionHeader
            onEdit={() => moveToPhase("position")}
            testID="review-edit-position"
            title="Position"
          />
          <ReviewDetailRow label="Quantity" value={reviewOpeningPosition.quantity.toString()} />
          <ReviewDetailRow label="Average cost" value={formatINR(reviewOpeningPosition.averageCostPrice)} />
          <ReviewDetailRow label="Current price" value={
            reviewOpeningPosition.manualValuation
              ? formatINR(reviewOpeningPosition.manualValuation.price)
              : candidateProviderQuote && preservesProviderQuote
                ? formatINR(candidateProviderQuote.price)
                : "Valuation pending"
          } />
        </View>
        <View style={styles.cashImpact}>
          <AppText weight="bold">Cash impact</AppText>
          <AppText color="secondary" variant="caption">
            No cash movement. Opening positions are existing holdings funded
            outside CogVest.
          </AppText>
        </View>
        </View>
      </PremiumCard>
      </View>
  );
}

/** Asset, classification and optional details behind the review, each with an edit link. */
export function AddHoldingReviewDetails({
  areReviewDetailsExpanded,
  holding,
  quickSetup,
  setArePositionOptionsExpanded,
  setAreReviewDetailsExpanded,
}: {
  areReviewDetailsExpanded: boolean;
  holding: Controller;
  quickSetup: boolean;
  setArePositionOptionsExpanded: Dispatch<SetStateAction<boolean>>;
  setAreReviewDetailsExpanded: Dispatch<SetStateAction<boolean>>;
}) {
  const styles = useStyles();
  const {
    currentPhase,
    instrumentType,
    moveToPhase,
    reviewAsset,
    reviewOpeningPosition,
  } = holding;
  if (currentPhase !== "review" || !reviewAsset || !reviewOpeningPosition) return null;
  return (
    <>
      <AppButton
        accessibilityState={{ expanded: areReviewDetailsExpanded }}
        onPress={() => setAreReviewDetailsExpanded((expanded) => !expanded)}
        testID="toggle-review-details"
        title={areReviewDetailsExpanded ? "Hide holding details" : "Holding details & edits"}
        variant="ghost"
      />
      {areReviewDetailsExpanded ? (
        <View style={styles.reviewSections}>
          <PremiumCard testID="review-identity">
            <ReviewSectionHeader onEdit={() => moveToPhase("asset")} testID="review-edit-asset" title="Asset" />
            <ReviewDetailRow label="Name" value={reviewAsset.name} />
            <ReviewDetailRow label="Symbol" value={reviewAsset.symbol} />
            {reviewAsset.ticker !== reviewAsset.symbol ? (
              <ReviewDetailRow label="Ticker" value={reviewAsset.ticker} />
            ) : null}
            {reviewAsset.exchange ? <ReviewDetailRow label="Exchange" value={reviewAsset.exchange} /> : null}
            <ReviewDetailRow label="Currency" value={reviewAsset.currency} />
            {reviewAsset.quoteSourceId && reviewAsset.quoteSourceId !== reviewAsset.ticker && reviewAsset.quoteSourceId !== reviewAsset.symbol ? (
              <ReviewDetailRow label="Price lookup symbol" value={reviewAsset.quoteSourceId} />
            ) : null}
          </PremiumCard>
          {!quickSetup ? (
            <PremiumCard testID="review-classification">
              <ReviewSectionHeader onEdit={() => moveToPhase("class")} testID="review-edit-classification" title="Classification" />
              <ReviewDetailRow label="Asset class" value={assetClassLabel(reviewAsset.assetClass)} />
              <ReviewDetailRow label="Instrument" value={instrumentTypeLabel(reviewAsset.instrumentType ?? instrumentType)} />
              {reviewAsset.assetClass === "stock" ? <ReviewDetailRow label="Sector" value={sectorTypeLabel(reviewAsset.sectorType ?? "other")} /> : null}
            </PremiumCard>
          ) : null}
          {reviewOpeningPosition.date || (!quickSetup && (reviewOpeningPosition.notes || reviewOpeningPosition.conviction || reviewOpeningPosition.intendedHoldDays)) ? (
            <PremiumCard testID="review-optional-details">
              <ReviewSectionHeader onEdit={() => {
                setArePositionOptionsExpanded(true);
                moveToPhase("position");
              }} testID="review-edit-options" title="Optional details" />
              {reviewOpeningPosition.date ? <ReviewDetailRow label="First purchase date" value={reviewOpeningPosition.date.slice(0, 10)} /> : null}
              {!quickSetup && reviewOpeningPosition.notes ? <ReviewDetailRow label="Note" value={reviewOpeningPosition.notes} /> : null}
              {!quickSetup && reviewOpeningPosition.conviction ? <ReviewDetailRow label="Conviction" value={`${reviewOpeningPosition.conviction} of 5`} /> : null}
              {!quickSetup && reviewOpeningPosition.intendedHoldDays ? <ReviewDetailRow label="Planned holding period" value={`${reviewOpeningPosition.intendedHoldDays} days`} /> : null}
            </PremiumCard>
          ) : null}
        </View>
      ) : null}
    </>
  );
}
