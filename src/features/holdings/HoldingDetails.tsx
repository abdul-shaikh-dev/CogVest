import { useRef } from "react";
import { Modal, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AppButton,
  AppText,
  CategoryIcon,
  GroupedListRow,
  IconButton,
  MaskedValue,
  PremiumCard,
  SectionHeader,
} from "@/src/components/common";
import { useReducedMotionPreference } from "@/src/hooks";
import { instrumentTypeLabel } from "@/src/domain/assets";
import { formatCompactINR, formatDate, formatINR, formatPercentage } from "@/src/domain/formatters";
import { getHoldingQuoteContext } from "@/src/services/quotes";
import { canRecordPayouts, payoutsSummary } from "@/src/features/payouts/payoutForm";
import type { Asset, Distribution, DistributionCoverage, OpeningPosition, Trade } from "@/src/types";

import type { XirrSummary } from "@/src/domain/xirrSummary";

import { AssetHistoryPanel } from "./AssetHistoryPanel";
import { HoldingXirrPanel } from "./HoldingXirrPanel";
import { getFirstRecordedPurchase, type HoldingReviewItem } from "./holdingsReview";
import { useStyles } from "./holdingsStyles";
import { formatClassification, formatQuantity, formatSignedCompactINR } from "./holdingsViewModel";

export type HoldingDetailsProps = {
  allocationAvailable: boolean;
  assets: Asset[];
  item: HoldingReviewItem;
  masked: boolean;
  minimal: boolean;
  now: Date;
  openingPositions: OpeningPosition[];
  /** Dividends and other payouts, shown for holdings that can pay them. */
  payouts?: { coverage: readonly DistributionCoverage[]; distributions: readonly Distribution[] };
  recordsVisible: boolean;
  trades: Trade[];
  /** Annualised return; Minimal mode keeps it behind the records disclosure. */
  xirr?: XirrSummary;
  onToggleRecords: () => void;
  onReviewOpeningPosition?: (id: string) => void;
  onReviewTrades?: (id: string) => void;
  onSellRedeem?: (id: string) => void;
  onRecordPurchase?: (assetId?: string) => void;
  onReviewPayouts?: (assetId: string) => void;
};

type HoldingDetailModalProps = Omit<HoldingDetailsProps, "item" | "recordsVisible" | "onToggleRecords" | "xirr"> & {
  closeDetail: () => void;
  detailScrollOffset: { current: number };
  isActive: boolean;
  selectedItem: HoldingReviewItem;
  selectedRecordsVisible: boolean;
  setSelectedRecordsVisible: (update: (visible: boolean) => boolean) => void;
  statusMessage?: string;
  toggleMaskWealthValues: () => void;
  xirrFor?: (assetId: string) => XirrSummary;
};

/** The full-screen detail for one holding, opened from a Holdings row. */
export function HoldingDetailModal({
  allocationAvailable,
  assets,
  closeDetail,
  detailScrollOffset,
  isActive,
  masked: maskWealthValues,
  minimal: isMinimalMode,
  now: observedAt,
  onRecordPurchase,
  onReviewOpeningPosition,
  onReviewPayouts,
  onReviewTrades,
  onSellRedeem,
  openingPositions,
  payouts,
  selectedItem,
  selectedRecordsVisible,
  setSelectedRecordsVisible,
  statusMessage,
  toggleMaskWealthValues,
  trades,
  xirrFor,
}: HoldingDetailModalProps) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const isReducedMotionEnabled = useReducedMotionPreference();
  const detailScrollRef = useRef<ScrollView>(null);
  return (
    <Modal
      animationType={isReducedMotionEnabled ? "none" : "fade"}
      visible={isActive}
      onRequestClose={closeDetail}
      onShow={() =>
        detailScrollRef.current?.scrollTo({
          animated: false,
          y: detailScrollOffset.current,
        })
      }
      testID="holding-detail-modal"
    >
      <View
        accessibilityViewIsModal
        style={[
          styles.detailScreen,
          { paddingTop: insets.top, paddingBottom: insets.bottom },
        ]}
      >
        <View style={styles.detailHeader}>
          <IconButton
            accessibilityLabel="Back to holdings"
            icon="arrow-back"
            onPress={closeDetail}
            testID="holding-detail-back"
          />
          <AppText style={styles.flex} weight="bold">
            Holding details
          </AppText>
          <IconButton
            accessibilityLabel={
              maskWealthValues ? "Show values" : "Hide values"
            }
            icon={maskWealthValues ? "eye-off-outline" : "eye-outline"}
            onPress={toggleMaskWealthValues}
            testID="holding-detail-mask"
          />
        </View>
        {statusMessage ? (
          <View
            accessibilityLiveRegion="polite"
            style={styles.detailStatus}
            testID="holding-detail-status-message"
          >
            <PremiumCard style={styles.statusCard}>
              <AppText style={styles.positiveText} weight="bold">
                {statusMessage}
              </AppText>
            </PremiumCard>
          </View>
        ) : null}
        <ScrollView
          contentContainerStyle={styles.detailContent}
          onScroll={(event) => {
            detailScrollOffset.current = event.nativeEvent.contentOffset.y;
          }}
          ref={detailScrollRef}
          scrollEventThrottle={16}
          testID="holding-detail-scroll"
        >
          <HoldingDetails
            key={selectedItem.holding.asset.id}
            allocationAvailable={allocationAvailable}
            item={selectedItem}
            assets={assets}
            masked={maskWealthValues}
            minimal={isMinimalMode}
            now={observedAt}
            openingPositions={openingPositions}
            payouts={payouts}
            recordsVisible={selectedRecordsVisible}
            trades={trades}
            xirr={xirrFor?.(selectedItem.holding.asset.id)}
            onToggleRecords={() =>
              setSelectedRecordsVisible((visible) => !visible)
            }
            onReviewOpeningPosition={
              onReviewOpeningPosition
                ? (id) => onReviewOpeningPosition(id)
                : undefined
            }
            onReviewTrades={
              onReviewTrades
                ? (id) => onReviewTrades(id)
                : undefined
            }
            onSellRedeem={
              onSellRedeem
                ? (id) => onSellRedeem(id)
                : undefined
            }
            onRecordPurchase={onRecordPurchase}
            onReviewPayouts={onReviewPayouts}
          />
        </ScrollView>
      </View>
    </Modal>
  );
}

export function HoldingDetails({
  allocationAvailable,
  assets,
  item,
  masked,
  minimal,
  now,
  openingPositions,
  payouts,
  recordsVisible,
  onReviewOpeningPosition,
  onReviewPayouts,
  onReviewTrades,
  onSellRedeem,
  onRecordPurchase,
  onToggleRecords,
  trades,
  xirr,
}: HoldingDetailsProps) {
  const styles = useStyles();
  const { holding } = item;
  const isPending = holding.valuation.status === "pending";
  const positive = (holding.unrealisedPnL ?? 0) >= 0;
  const assetOpeningPositions = openingPositions.filter(
    (position) => position.assetId === holding.asset.id,
  );
  const assetTrades = trades.filter((trade) => trade.assetId === holding.asset.id);
  const firstPurchase = getFirstRecordedPurchase(assetOpeningPositions, assetTrades);
  const quoteContext = getHoldingQuoteContext(holding, undefined, now);
  const currentValueText = holding.currentValue === null
    ? "Valuation pending"
    : formatINR(holding.currentValue);
  return (
    <View
      style={styles.expandedSection}
      testID={`holding-expanded-${holding.asset.id}`}
    >
      <View style={styles.detailIdentity}>
        <CategoryIcon assetClass={holding.asset.assetClass} size={28} />
        <View style={styles.flex}>
          <AppText variant="title" weight="bold">
            {holding.asset.name}
          </AppText>
          <AppText color="secondary" variant="caption">
            {holding.asset.symbol} ·{" "}
            {instrumentTypeLabel(holding.asset.instrumentType ?? "other")} · INR
          </AppText>
        </View>
      </View>
      <View style={styles.detailValuation} testID="holding-detail-valuation">
        <AppText color="secondary" variant="caption">
          Current value
        </AppText>
        <MaskedValue
          masked={masked && !isPending}
          value={currentValueText}
          variant={holding.currentValue !== null && currentValueText.length > 14 ? "title" : "hero"}
          weight="bold"
        />
        <View style={styles.valueQuoteContext} testID={`holding-quote-context-${holding.asset.id}`}>
          <AppText color="secondary" variant="caption">
            {quoteContext.label}
          </AppText>
        </View>
        <View style={styles.performanceLine}>
          <View style={styles.holdingMetric} testID="holding-detail-pnl">
          <AppText color="secondary" variant="caption">Holding P&amp;L</AppText>
          <MaskedValue
            masked={masked && holding.unrealisedPnL !== null}
            value={
              holding.unrealisedPnL === null
                ? "Return unavailable"
                : formatSignedCompactINR(holding.unrealisedPnL)
            }
            style={
              isPending
                ? undefined
                : positive
                  ? styles.positiveText
                  : styles.negativeText
            }
          />
          </View>
          <View style={styles.holdingMetric} testID="holding-detail-pnl-percent">
          <AppText color="secondary" variant="caption">Holding P&amp;L %</AppText>
          {holding.unrealisedPnLPct !== null ? (
            <AppText
              style={positive ? styles.positiveText : styles.negativeText}
            >
              {formatPercentage(holding.unrealisedPnLPct)}
            </AppText>
          ) : <AppText color="secondary">Unavailable</AppText>}
          </View>
        </View>
        <AppText color="secondary" variant="caption">Unrealized on remaining units</AppText>
        <View style={styles.detailInvested}>
          <AppText color="secondary" variant="caption">
            Invested in remaining units
          </AppText>
          <MaskedValue
            masked={masked}
            value={formatINR(holding.totalInvested)}
            weight="bold"
          />
        </View>
      </View>
      {xirr && (!minimal || recordsVisible) && holding.asset.assetClass !== "cash" && holding.asset.instrumentType !== "ppf" ? (
        <HoldingXirrPanel assetId={holding.asset.id} masked={masked} summary={xirr} />
      ) : null}
      <View style={styles.detailPosition} testID="holding-detail-position">
        <SectionHeader title="Your position" />
        <View style={styles.detailGrid}>
          <Detail
            label="Quantity"
            testID={`holding-quantity-${holding.asset.id}`}
            value={formatQuantity(holding.totalUnits)}
          />
          <Detail label="Avg cost" value={formatINR(holding.averageCostPrice)} />
          <Detail
            label="Current price"
            value={
              holding.currentPrice === null
                ? "Unavailable"
                : formatINR(holding.currentPrice)
            }
          />
          <Detail
            label="Market holdings share"
            value={
              allocationAvailable && !isPending
                ? `${item.allocationPct.toFixed(1)}%`
                : "Unavailable"
            }
          />
          <Detail
            label="First recorded purchase"
            value={firstPurchase ? formatDate(firstPurchase) : "Unknown"}
          />
        </View>
      </View>
      <View style={styles.detailActions} testID="holding-primary-actions">
        {(onReviewOpeningPosition && assetOpeningPositions.length > 0) ||
        (onReviewTrades && assetTrades.length > 0) ? (
          <GroupedListRow
            title={recordsVisible ? "Hide records" : "View records"}
            meta="Opening positions and corrections"
            value={recordsVisible ? "−" : "›"}
            testID="holding-view-records"
            onPress={onToggleRecords}
          />
        ) : null}
        {onRecordPurchase ? <GroupedListRow title="Record purchase" meta="Add units funded from Cash" value="›"
          testID={`holding-record-purchase-${holding.asset.id}`} onPress={() => onRecordPurchase(holding.asset.id)} /> : null}
        {onReviewPayouts && payouts && canRecordPayouts(holding.asset) ? (
          <GroupedListRow
            title="Dividends and payouts"
            meta={payoutsSummary(
              payouts.distributions,
              payouts.coverage.find((item) => item.assetId === holding.asset.id),
              holding.asset.id,
            )}
            value="›"
            testID={`holding-payouts-${holding.asset.id}`}
            onPress={() => onReviewPayouts(holding.asset.id)}
          />
        ) : null}
        {onSellRedeem ? (
          <GroupedListRow
            title="Sell / redeem"
            meta="Record a disposal and its cash proceeds"
            value="›"
            testID={`holding-sell-redeem-${holding.asset.id}`}
            onPress={() => onSellRedeem(holding.asset.id)}
          />
        ) : null}
      </View>
      {recordsVisible && onReviewOpeningPosition && assetOpeningPositions.length > 0 ? (
        <View style={styles.openingRecords}>
          <AppText color="secondary" variant="caption" weight="bold">
            Opening {assetOpeningPositions.length === 1 ? "record" : "records"}
          </AppText>
          {assetOpeningPositions.map((position) => (
            <View key={position.id} style={styles.openingRecordRow}>
              <View style={styles.openingRecordCopy}>
                <AppText variant="caption" weight="bold">
                  {position.date === null
                    ? "First purchase date unknown"
                    : formatDate(position.date)}
                </AppText>
                <AppText color="secondary" variant="caption">
                  {formatQuantity(position.quantity)} units · avg{" "}
                  {formatCompactINR(position.averageCostPrice)}
                </AppText>
              </View>
              <AppButton
                title="Review"
                variant="secondary"
                testID={`review-opening-position-${position.id}`}
                onPress={() => onReviewOpeningPosition(position.id)}
              />
            </View>
          ))}
        </View>
      ) : null}

      {recordsVisible && onReviewTrades && assetTrades.length > 0 ? (
        <AppButton
          title={`Review ${assetTrades.length} ${assetTrades.length === 1 ? "transaction" : "transactions"}`}
          variant="secondary"
          testID={`review-transactions-${holding.asset.id}`}
          onPress={() => onReviewTrades(holding.asset.id)}
        />
      ) : null}

      <AssetHistoryPanel asset={holding.asset} assets={assets} openingPositions={openingPositions} trades={trades} masked={masked} minimal={minimal} />

      <AppText color="secondary" variant="caption">
        {formatClassification(item)}
      </AppText>
      <AppText color="secondary" variant="caption">
        Market holdings share excludes cash and PPF. Purchase date is based on recorded
        history.
      </AppText>
      {isPending && onReviewOpeningPosition && assetOpeningPositions[0] ? (
        <AppButton
          title="Enter manual price"
          variant="secondary"
          testID={`holding-enter-manual-price-${holding.asset.id}`}
          onPress={() => onReviewOpeningPosition(assetOpeningPositions[0].id)}
        />
      ) : null}

    </View>
  );
}

export function Detail({
  label,
  masked,
  subdued,
  testID,
  tone,
  value,
}: {
  label: string;
  masked?: boolean;
  subdued?: boolean;
  testID?: string;
  tone?: "negative" | "positive";
  value: string;
}) {
  const styles = useStyles();
  return (
    <View style={styles.detail} testID={testID}>
      <AppText color="secondary" variant="caption">
        {label}
      </AppText>
      <MaskedValue
        color={subdued ? "secondary" : undefined}
        masked={masked}
        style={
          tone === "positive"
            ? styles.positiveText
            : tone === "negative"
              ? styles.negativeText
              : undefined
        }
        value={value}
        variant="caption"
        weight={subdued ? "medium" : "bold"}
      />
    </View>
  );
}
