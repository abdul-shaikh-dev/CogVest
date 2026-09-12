import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { LineChart } from "react-native-gifted-charts";

import { AppButton, AppText } from "@/src/components/common";
import { buildAssetHistory, downsampleAssetHistory } from "@/src/domain/calculations/assetHistory";
import type { createDailyPriceCache } from "@/src/services/quotes/dailyPriceCache";
import { colors, spacing } from "@/src/theme";
import type { Asset, OpeningPosition, Trade } from "@/src/types";

import { useAssetHistory } from "./useAssetHistory";

const ranges = [
  { label: "1M", months: 1 },
  { label: "3M", months: 3 },
  { label: "1Y", months: 12 },
  { label: "5Y", months: 60 },
  { label: "10Y", months: 120 },
];
const dayMs = 86_400_000;

export function assetHistoryRange(months: number, now = new Date()) {
  // Only completed UTC days: intraday prices must not masquerade as daily closes.
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - months, 1));
  start.setUTCDate(
    Math.min(
      end.getUTCDate(),
      new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate(),
    ),
  );
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
}

type AssetHistoryPanelProps = {
  asset: Asset;
  assets?: Asset[];
  openingPositions: OpeningPosition[];
  trades: Trade[];
  masked: boolean;
  minimal: boolean;
  historyCache?: ReturnType<typeof createDailyPriceCache>;
  onChartLayout?: () => void;
};

export function AssetHistoryPanel({
  asset,
  assets,
  openingPositions,
  trades,
  masked,
  minimal,
  historyCache,
  onChartLayout,
}: AssetHistoryPanelProps) {
  const [months, setMonths] = useState(3);
  const [mode, setMode] = useState<"price" | "holdingValue">("price");
  const [selection, setSelection] = useState<number | null>(null);
  const [width, setWidth] = useState(280);
  const [showDetails, setShowDetails] = useState(false);
  const { from, to } = assetHistoryRange(months);
  const history = useAssetHistory(asset, from, to, historyCache);
  const built = history.entry
    ? buildAssetHistory({ asset, assets, entry: history.entry, openingPositions, trades })
    : null;
  const sampled = built ? downsampleAssetHistory(built.points) : [];
  const originalIndices = new Map(built?.points.map((point, index) => [point.date, index]));
  const gapPrefix: number[] = [];

  built?.points.forEach((point, index, points) => {
    const previous = points[index - 1];
    const hasGap =
      index > 0 &&
      ((mode === "holdingValue" &&
        (point.holdingValue === null || previous.holdingValue === null)) ||
        Date.parse(point.date) - Date.parse(previous.date) >
          (asset.assetClass === "crypto" ? 1 : 4) * dayMs);

    gapPrefix[index] = (gapPrefix[index - 1] ?? 0) + Number(hasGap);
  });

  const available = sampled.flatMap((point, sourceIndex) => {
    if (mode === "holdingValue" && history.holdingSafe === false) return [];
    const value = point[mode];
    return value === null ? [] : [{ date: point.date, value, sourceIndex }];
  });
  const index = Math.min(selection ?? available.length - 1, available.length - 1);
  const selected = available[index];
  const firstValue = available[0]?.value;
  const latestValue = available.at(-1)?.value;
  const changePct =
    firstValue && latestValue !== undefined
      ? (latestValue / firstValue - 1) * 100
      : null;
  const format = (value: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: asset.currency,
      maximumFractionDigits: value < 1 ? 6 : 2,
    }).format(value);
  const axisFormat = (value: string) => {
    const amount = Number(value);
    const prefix = asset.currency === "INR" ? "₹" : "$";
    const abbreviated =
      Math.abs(amount) >= 1e7
        ? `${(amount / 1e7).toFixed(1)}Cr`
        : Math.abs(amount) >= 1e5
          ? `${(amount / 1e5).toFixed(1)}L`
          : Math.abs(amount) >= 1e3
            ? `${(amount / 1e3).toFixed(1)}K`
            : amount.toFixed(amount > 0 && amount < 1 ? 3 : 0);
    return `${prefix}${abbreviated}`;
  };
  const plotWidth = Math.max(100, width - 76);
  const drawableWidth = plotWidth - 16;
  const firstTime = Date.parse(available[0]?.date ?? from);
  const span = Math.max(dayMs, Date.parse(available.at(-1)?.date ?? to) - firstTime);
  const labelSpacing = drawableWidth / Math.max(1, available.length - 1);
  const data = available.map((point, pointIndex) => {
    const pointSpacing =
      pointIndex < available.length - 1
        ? ((Date.parse(available[pointIndex + 1].date) - Date.parse(point.date)) / span) * drawableWidth
        : 0;
    const label = new Date(`${point.date}T12:00:00Z`).toLocaleDateString("en-GB", {
      month: "short",
      year: "2-digit",
      timeZone: "UTC",
    });

    return {
      value: point.value,
      hideDataPoint: pointIndex !== index,
      dataPointRadius: pointIndex === index ? 4 : 0,
      dataPointColor: colors.text.primary,
      spacing: pointSpacing,
      ...(pointIndex === 0 || pointIndex === available.length - 1
        ? {
            labelComponent: () => (
              <AppText
                align={pointIndex === 0 ? "left" : "right"}
                color="secondary"
                style={{
                  width: 72,
                  left: labelSpacing / 2 - (pointIndex === 0 ? 0 : 72),
                  top: 4,
                }}
                variant="caption"
              >
                {label}
              </AppText>
            ),
          }
        : {}),
    };
  });
  const lineSegments = available.slice(1).flatMap((point, pointIndex) => {
    const previous = available[pointIndex];
    const previousIndex = originalIndices.get(previous.date) ?? 0;
    const currentIndex = originalIndices.get(point.date) ?? 0;
    return gapPrefix[currentIndex] > gapPrefix[previousIndex]
      ? [{ startIndex: pointIndex, endIndex: pointIndex + 1, color: "transparent" }]
      : [];
  });

  if (history.supported === false) {
    return (
      <View style={styles.section} testID="asset-history-panel">
        <AppText variant="section" weight="bold">History</AppText>
        <AppText color="secondary" testID="asset-history-message">
          {history.message ?? "Market history is not available for this asset."}
        </AppText>
      </View>
    );
  }

  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={styles.section}
      testID="asset-history-panel"
    >
      <AppText variant="section" weight="bold">History</AppText>

      <View style={styles.controls}>
        {([['price', 'Price history'], ['holdingValue', 'Your holding value']] as const).map(([value, title]) => (
          <AppButton
            accessibilityState={{ selected: mode === value }}
            key={value}
            onPress={() => {
              setMode(value);
              setSelection(null);
            }}
            testID={`asset-history-mode-${value}`}
            title={title}
            variant={mode === value ? "primary" : "secondary"}
          />
        ))}
      </View>

      <View style={styles.controls}>
        {ranges.map((range) => (
          <AppButton
            accessibilityState={{ selected: months === range.months }}
            key={range.label}
            onPress={() => {
              setMonths(range.months);
              setSelection(null);
            }}
            style={styles.range}
            testID={`asset-history-range-${range.label}`}
            title={range.label}
            variant={months === range.months ? "primary" : "secondary"}
          />
        ))}
      </View>

      <AppText color="secondary" variant="caption">
        {asset.currency} · Daily observations
      </AppText>
      {history.loading ? (
        <AppText color="secondary" testID="asset-history-loading">
          {history.entry ? "Refreshing history…" : "Loading history…"}
        </AppText>
      ) : null}
      {history.message ? (
        <AppText color="secondary" testID="asset-history-message">
          {history.message}
        </AppText>
      ) : null}
      {mode === "holdingValue" ? (
        <AppText color="secondary" variant="caption">
          Includes purchases and disposals; not investment return.
        </AppText>
      ) : null}
      {mode === "holdingValue" && history.holdingSafe === false ? (
        <AppText color="secondary">
          Share adjustments have not been verified in this session. Price history
          remains available; reconnect and refresh to reconstruct holding value.
        </AppText>
      ) : null}
      {mode === "holdingValue" && built?.warning ? (
        <AppText color="secondary">{built.warning}</AppText>
      ) : null}

      {masked ? (
        <AppText testID="asset-history-masked">History values hidden</AppText>
      ) : selected ? (
        <>
          <View accessibilityLiveRegion="polite" style={styles.readout}>
            <AppText color="secondary">{selected.date}</AppText>
            <AppText testID="asset-history-selected-value" variant="title" weight="bold">
              {format(selected.value)}
            </AppText>
          </View>
          {!minimal && changePct !== null ? (
            <AppText color="secondary" variant="caption">
              {changePct >= 0 ? "+" : ""}
              {changePct.toFixed(2)}% {mode === "price" ? "price change" : "value change"} · first to last observation
            </AppText>
          ) : null}
          {available.length > 1 ? (
            <View
              accessible={false}
              importantForAccessibility="no-hide-descendants"
              onLayout={onChartLayout}
              pointerEvents="none"
              testID="asset-history-chart"
            >
              <LineChart
                color={minimal ? colors.text.secondary : colors.primary}
                data={data}
                disableScroll
                endSpacing={8}
                formatYLabel={axisFormat}
                height={170}
                initialSpacing={8}
                isAnimated={false}
                lineSegments={lineSegments}
                noOfSections={3}
                rulesColor={colors.border.subtle}
                spacing={labelSpacing}
                thickness={2}
                width={plotWidth}
                xAxisColor={colors.border.subtle}
                xAxisLabelTextStyle={styles.axis}
                xAxisLabelsHeight={36}
                yAxisColor="transparent"
                yAxisLabelWidth={60}
                yAxisTextStyle={styles.axis}
              />
            </View>
          ) : (
            <AppText color="secondary">
              One observation available. More history is needed for a trend.
            </AppText>
          )}
          <View style={styles.navigation}>
            <AppButton
              disabled={index <= 0}
              onPress={() => setSelection(index - 1)}
              testID="asset-history-previous"
              title="Previous"
              variant="secondary"
            />
            <AppText color="secondary" variant="caption">
              {index + 1} / {available.length}
            </AppText>
            <AppButton
              disabled={index >= available.length - 1}
              onPress={() => setSelection(index + 1)}
              testID="asset-history-next"
              title="Next"
              variant="secondary"
            />
          </View>
        </>
      ) : !history.loading && history.entry ? (
        <AppText testID="asset-history-empty">
          {mode === "price"
            ? "No price observations in this range."
            : "Not enough recorded history to reconstruct your holding value in this range."}
        </AppText>
      ) : null}

      {history.entry ? (
        <AppText color="secondary" variant="caption">
          {history.entry.provider === "yahoo" ? "Yahoo Finance" : "CoinGecko"} · {history.freshness === "stale" ? "Saved history may be out of date" : "Cached history"}
          {history.entry.complete ? "" : " · Partial history"}
        </AppText>
      ) : null}

      <View style={styles.controls}>
        <AppButton
          disabled={history.loading}
          onPress={history.retry}
          testID="asset-history-refresh"
          title="Refresh history"
          variant="ghost"
        />
        <AppButton
          onPress={() => setShowDetails(!showDetails)}
          title={showDetails ? "Hide explanation" : "About this history"}
          variant="ghost"
        />
      </View>

      {showDetails ? (
        <AppText color="secondary" variant="caption">
          Requested {from} to {to}.
          {history.entry ? ` Fetched ${history.entry.fetchedAt.slice(0, 10)}.` : ""} Observed dates only; missing prices are not filled. Long ranges show up to 500 sampled observations. Holding value begins when recorded quantity is known, includes transactions, and is not investment return. CoinGecko midnight observations are aligned to the preceding completed UTC day. No historical currency conversion is applied.
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md, paddingVertical: spacing.lg },
  controls: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  range: { paddingHorizontal: 12 },
  readout: { gap: spacing.xs },
  navigation: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  axis: { color: colors.text.secondary, fontSize: 11 },
});
