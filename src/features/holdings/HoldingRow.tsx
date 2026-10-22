import { Pressable, View, useWindowDimensions } from "react-native";

import {
  AppText,
  MaskedValue,
  androidRipple,
  getPressedStateStyle,
} from "@/src/components/common";
import { formatCompactINR, formatINR, formatPercentage } from "@/src/domain/formatters";

import type { HoldingDetailsProps } from "./HoldingDetails";
import { useStyles } from "./holdingsStyles";
import {
  formatHoldingWeight,
  formatSignedCompactINR,
  getHoldingRowAccessibilityLabel,
  getHoldingRowIdentity,
} from "./holdingsViewModel";

export function HoldingRow({
  allocationAvailable,
  item,
  masked,
  minimal,
  onPress,
}: Pick<
  HoldingDetailsProps,
  "allocationAvailable" | "item" | "masked" | "minimal"
> & { onPress: () => void }) {
  const styles = useStyles();
  const { holding } = item;
  const pending = holding.currentValue === null;
  const pnlAvailable = holding.unrealisedPnL !== null;
  const { width, fontScale } = useWindowDimensions();
  const metricStyle = [styles.holdingMetric, (width < 400 || fontScale > 1.15) && styles.holdingMetricHalf];
  const weightAvailable = allocationAvailable && !pending;
  const identity = getHoldingRowIdentity(holding.asset);
  const stackIdentity = (width < 400 || fontScale > 1.15) &&
    (pending || holding.asset.name.length > 60);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={getHoldingRowAccessibilityLabel({
        identity,
        item,
        masked,
        minimal,
        weightAvailable,
      })}
      accessibilityHint="Opens a separate holding detail panel"
      android_ripple={androidRipple()}
      onPress={onPress}
      style={({ pressed }) => [
        styles.holdingCard,
        pressed && styles.holdingCardPressed,
        getPressedStateStyle({ pressed }),
      ]}
      testID={`holding-row-${holding.asset.id}`}
    >
      <View style={[styles.compactRow, stackIdentity && styles.stackedContent]}>
        <View style={styles.assetCopy}>
          <AppText weight="medium">{holding.asset.name}</AppText>
          <AppText color="secondary" variant="caption">
            {identity}
            {holding.quoteSource === "manual" ? " · Manual" : ""}
          </AppText>
        </View>
        <View style={[styles.valueColumn, stackIdentity && styles.stackedValue]}>
          <MaskedValue
            style={styles.holdingNumber}
            variant={pending ? "body" : "section"}
            exactValue={
              pending ? undefined : formatINR(holding.currentValue!)
            }
            masked={masked && !pending}
            value={
              pending
                ? "Valuation pending"
                : formatCompactINR(holding.currentValue!)
            }
            weight="bold"
          />
        </View>
      </View>
      <View style={styles.holdingMetrics}>
        {!minimal ? <>
        <View
          style={metricStyle}
          testID={`holding-pnl-${holding.asset.id}`}
        >
          <AppText color="secondary" variant="caption">
            Holding P&amp;L
          </AppText>
          {pnlAvailable ? (
              <MaskedValue
                exactValue={formatINR(holding.unrealisedPnL!)}
                masked={masked}
                value={formatSignedCompactINR(holding.unrealisedPnL!)}
                style={[
                  styles.holdingNumber,
                  holding.unrealisedPnL! >= 0 ? styles.positiveText : styles.negativeText,
                ]}
                weight="bold"
              />
          ) : (
            <AppText color="secondary" weight="bold">—</AppText>
          )}
        </View>
        <View style={metricStyle} testID={`holding-pnl-percent-${holding.asset.id}`}>
          <AppText color="secondary" variant="caption">Holding P&amp;L %</AppText>
          {holding.unrealisedPnLPct !== null ? (
              <AppText
                weight="bold"
                style={[
                  styles.holdingNumber,
                  holding.unrealisedPnLPct >= 0
                    ? styles.positiveText
                    : styles.negativeText,
                ]}
              >
                {formatPercentage(holding.unrealisedPnLPct)}
              </AppText>
          ) : (
            <AppText color="secondary" weight="bold">
              —
            </AppText>
          )}
        </View>
        <View style={metricStyle} testID={`holding-invested-${holding.asset.id}`}>
          <AppText color="secondary" variant="caption">Invested</AppText>
          <MaskedValue exactValue={formatINR(holding.totalInvested)} masked={masked}
            value={formatCompactINR(holding.totalInvested)} style={styles.holdingNumber} weight="medium" />
        </View>
        </> : null}
        <View
          style={[minimal ? styles.holdingMetric : metricStyle, styles.holdingWeightMetric, minimal && styles.minimalWeightMetric]}
          testID={`holding-weight-${holding.asset.id}`}
        >
          <AppText color="secondary" variant="caption">
            Weight
          </AppText>
          <AppText color={weightAvailable ? "primary" : "secondary"} style={styles.holdingNumber} weight="medium">
            {weightAvailable ? formatHoldingWeight(item.allocationPct) : "—"}
          </AppText>
        </View>
      </View>
      {weightAvailable ? (
        <View
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          style={styles.holdingWeightTrack}
          testID={`holding-weight-track-${holding.asset.id}`}
        >
          <View
            style={[
              styles.holdingWeightFill,
              { width: `${Math.max(0, Math.min(100, item.allocationPct))}%` },
            ]}
          />
        </View>
      ) : null}
    </Pressable>
  );
}
