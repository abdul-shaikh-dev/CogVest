import { useCallback, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import { AppButton, AppText, SectionHeader } from "@/src/components/common";
import { buildAssetHistory } from "@/src/domain/calculations/assetHistory";
import { formatDate } from "@/src/domain/formatters";
import type { createDailyPriceCache } from "@/src/services/quotes/dailyPriceCache";
import { spacing, useTheme, createThemedStyles } from "@/src/theme";
import type { Asset, OpeningPosition, Trade } from "@/src/types";

import { AssetHistoryChart } from "./AssetHistoryChart";
import { buildAssetHistoryChartModel, getVisiblePriceScale } from "./assetHistoryChartModel";
import { useAssetHistory } from "./useAssetHistory";

export { getVisiblePriceScale };

const ranges = [
  { label: "1M", months: 1 },
  { label: "3M", months: 3 },
  { label: "1Y", months: 12 },
  { label: "5Y", months: 60 },
  { label: "10Y", months: 120 },
];

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
  const { colors } = useTheme();
  const styles = useStyles();
  const [months, setMonths] = useState(3);
  const [mode, setMode] = useState<"price" | "holdingValue">("price");
  const [selection, setSelection] = useState<number | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [inspecting, setInspecting] = useState<number | null>(null);
  const [zoom, setZoom] = useState<{ key: string; from: number; to: number } | null>(null);
  const { from, to } = assetHistoryRange(months);
  const history = useAssetHistory(asset, from, to, historyCache);
  const entry = history.entry;
  // Identical cache reads arrive as new objects; key the heavy work on content.
  const entryKey = entry
    ? [entry.provider, entry.providerId, entry.currency, entry.from, entry.to, entry.fetchedAt, entry.complete, entry.points.length].join("|")
    : "";
  const built = useMemo(
    () => (entry ? buildAssetHistory({ asset, assets, entry, openingPositions, trades }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- entryKey identifies entry's content.
    [entryKey, asset, assets, openingPositions, trades],
  );
  const viewKey = `${entryKey}|${mode}`;
  const window = zoom?.key === viewKey ? zoom : null;
  const model = useMemo(() => {
    const points = built?.points ?? [];
    const visible = window
      ? points.filter((point) => {
          const time = Date.parse(`${point.date}T12:00:00Z`);
          return time >= window.from && time <= window.to;
        })
      : points;
    return buildAssetHistoryChartModel({
      points: visible,
      mode,
      crypto: asset.assetClass === "crypto",
      holdingSafe: history.holdingSafe,
    });
  }, [built, window, mode, asset.assetClass, history.holdingSafe]);
  const available = model.observations;
  const restingIndex = Math.min(selection ?? available.length - 1, available.length - 1);
  const index = inspecting ?? restingIndex;
  const selected = available[index];
  const firstValue = available[0]?.value;
  const latestValue = available.at(-1)?.value;
  const changePct =
    firstValue && latestValue !== undefined
      ? (latestValue / firstValue - 1) * 100
      : null;
  const visiblePriceScale = mode === "price" ? { yAxisOffset: model.yDomain[0] } : null;
  const format = useCallback((value: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: asset.currency,
      maximumFractionDigits: value < 1 ? 6 : 2,
    }).format(value), [asset.currency]);
  const axisFormat = useCallback((amount: number) => {
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
  }, [asset.currency]);
  const dateFormat = useCallback((time: number) =>
    new Date(time).toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" }), []);
  const chartColors = useMemo(() => ({
    line: minimal ? colors.text.secondary : colors.primary,
    marker: colors.text.primary,
    guide: colors.border.subtle,
    label: colors.text.secondary,
    rule: colors.border.subtle,
  }), [colors, minimal]);
  const inspectingRef = useRef<number | null>(null);
  const onInspect = useCallback((next: number | null) => {
    // Releasing keeps the inspected observation selected for Previous/Next.
    if (next === null && inspectingRef.current !== null) setSelection(inspectingRef.current);
    inspectingRef.current = next;
    setInspecting(next);
  }, []);
  const onZoom = useCallback((zoomFrom: number, zoomTo: number) => {
    const points = built?.points ?? [];
    const first = points[0] ? Date.parse(`${points[0].date}T12:00:00Z`) : zoomFrom;
    const last = points.at(-1) ? Date.parse(`${points.at(-1)!.date}T12:00:00Z`) : zoomTo;
    const nextFrom = Math.max(first, zoomFrom);
    const nextTo = Math.min(last, zoomTo);
    setSelection(null);
    // Zooming back out to the whole range, or below a week, is not a zoom.
    if (nextFrom <= first && nextTo >= last) setZoom(null);
    else if (nextTo - nextFrom >= 7 * 86_400_000) setZoom({ key: viewKey, from: nextFrom, to: nextTo });
  }, [built, viewKey]);

  if (history.supported === false) {
    return (
      <View style={styles.section} testID="asset-history-panel">
        <SectionHeader title="History" />
        <AppText color="secondary" testID="asset-history-message">
          {history.message ?? "Market history is not available for this asset."}
        </AppText>
      </View>
    );
  }

  return (
    <View
      style={styles.section}
      testID="asset-history-panel"
    >
      <SectionHeader title="History" />

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
            <AppText color="secondary">{formatDate(selected.date)}</AppText>
            <AppText testID="asset-history-selected-value" variant="title" weight="bold">
              {format(selected.value)}
            </AppText>
          </View>
          {!minimal && changePct !== null ? (
            <AppText color="secondary" variant="caption">
              {changePct >= 0 ? "+" : ""}
              {changePct.toFixed(2)}% {mode === "price" ? "price change" : "value change"} · first to last {window ? "visible " : ""}observation
            </AppText>
          ) : null}
          {visiblePriceScale && visiblePriceScale.yAxisOffset > 0 ? (
            <AppText color="secondary" testID="asset-history-visible-range" variant="caption">
              Visible price range · Axis starts at {format(visiblePriceScale.yAxisOffset)}, not zero
            </AppText>
          ) : null}
          {available.length > 1 ? (
            <View
              accessible={false}
              importantForAccessibility="no-hide-descendants"
              onLayout={onChartLayout}
              testID="asset-history-chart"
            >
              <AssetHistoryChart
                colors={chartColors}
                formatX={dateFormat}
                formatY={axisFormat}
                model={model}
                onInspect={onInspect}
                onZoom={onZoom}
                selectedIndex={restingIndex}
                zoomed={window !== null}
              />
            </View>
          ) : null}
          {available.length > 1 ? (
            <View style={styles.zoomRow}>
              <AppText color="secondary" style={styles.zoomHint} variant="caption">
                {window
                  ? `Showing ${formatDate(available[0].date)} to ${formatDate(available.at(-1)!.date)}`
                  : "Press and hold to inspect · pinch to zoom"}
              </AppText>
              {window ? (
                <AppButton
                  onPress={() => {
                    setZoom(null);
                    setSelection(null);
                  }}
                  testID="asset-history-reset-zoom"
                  title="Reset zoom"
                  variant="ghost"
                />
              ) : null}
            </View>
          ) : (
            <AppText color="secondary">
              One observation available. More history is needed for a trend.
            </AppText>
          )}
          <View style={styles.navigation}>
            <AppButton
              accessibilityLabel={`Previous observed date before ${formatDate(selected.date)}`}
              disabled={index <= 0}
              onPress={() => setSelection(index - 1)}
              testID="asset-history-previous"
              title="Previous"
              variant="secondary"
            />
            <View style={styles.navigationLabel} testID="asset-history-selected-date">
              <AppText align="center" color="secondary" variant="caption">Observed date</AppText>
              <AppText align="center" variant="caption" weight="bold">
                {formatDate(selected.date)}
              </AppText>
            </View>
            <AppButton
              accessibilityLabel={`Next observed date after ${formatDate(selected.date)}`}
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
          Requested {formatDate(from)} to {formatDate(to)}.
          {history.entry ? ` Fetched ${formatDate(history.entry.fetchedAt)}.` : ""} Observed dates only; missing prices are not filled. Long ranges show up to 500 sampled observations; zooming in redraws that window from the daily observations, still capped at 500. Holding value begins when recorded quantity is known, includes transactions, and is not investment return. CoinGecko midnight observations are aligned to the preceding completed UTC day. No historical currency conversion is applied.
        </AppText>
      ) : null}
    </View>
  );
}

const useStyles = createThemedStyles((colors) => StyleSheet.create({
  section: { gap: spacing.md, paddingBottom: spacing.md },
  controls: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  range: { paddingHorizontal: 12 },
  readout: { gap: spacing.xs },
  navigation: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  navigationLabel: { flex: 1, gap: spacing.xs },
  zoomRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  zoomHint: { flex: 1 },
}));
