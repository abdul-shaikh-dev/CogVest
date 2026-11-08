import { Circle, Line as SkiaLine, matchFont, vec } from "@shopify/react-native-skia";
import { memo, useCallback, useMemo, useRef } from "react";
import { Platform, View } from "react-native";
import { useAnimatedReaction, useDerivedValue, useSharedValue } from "react-native-reanimated";
import {
  CartesianChart,
  Line,
  getTransformComponents,
  useChartPressState,
  useChartTransformState,
  type ChartBounds,
  type Scale,
} from "victory-native";
import { scheduleOnRN } from "react-native-worklets";

import type { AssetHistoryChartModel } from "./assetHistoryChartModel";

const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] as const;

type AssetHistoryChartProps = {
  model: AssetHistoryChartModel;
  selectedIndex: number;
  colors: { line: string; marker: string; guide: string; label: string; rule: string };
  formatY: (value: number) => string;
  formatX: (time: number) => string;
  zoomed: boolean;
  /** Index of the observation under the finger, or null when released. */
  onInspect: (index: number | null) => void;
  /** Visible time window, in ms, after a pinch or pan settles. */
  onZoom: (from: number, to: number) => void;
};

/**
 * Skia line chart for one history range. Press and hold to inspect points;
 * pinch to zoom along time and drag to pan while zoomed. A gesture stretches
 * the drawing on the UI thread; when it settles the panel redraws that window
 * from the underlying daily observations instead of keeping a stretched image.
 */
export const AssetHistoryChart = memo(function AssetHistoryChart({
  model,
  selectedIndex,
  colors,
  formatY,
  formatX,
  zoomed,
  onInspect,
  onZoom,
}: AssetHistoryChartProps) {
  const font = useMemo(
    () => matchFont({ fontFamily: Platform.select({ ios: "Helvetica", default: "sans-serif" }), fontSize: 11 }),
    [],
  );
  const { state: press } = useChartPressState({ x: 0, y: { value: 0 } });
  const { state: transform } = useChartTransformState();
  const xScale = useRef<Scale | null>(null);
  const bounds = useRef<ChartBounds | null>(null);
  const plotTop = useSharedValue(0);
  const plotBottom = useSharedValue(0);

  const reportInspect = useCallback((index: number) => onInspect(index < 0 ? null : index), [onInspect]);
  const finishTransform = useCallback((scale: number, translate: number) => {
    transform.matrix.value = identity;
    transform.offset.value = identity;
    const scaleFn = xScale.current;
    const chart = bounds.current;
    if (!scaleFn || !chart || (Math.abs(scale - 1) < 0.02 && Math.abs(translate) < 1)) return;
    const from = scaleFn.invert((chart.left - translate) / scale);
    const to = scaleFn.invert((chart.right - translate) / scale);
    onZoom(Math.min(from, to), Math.max(from, to));
  }, [onZoom, transform]);

  useAnimatedReaction(
    () => (press.isActive.value ? press.matchedIndex.value : -1),
    (index, previous) => {
      if (index !== previous) scheduleOnRN(reportInspect, index);
    },
  );
  useAnimatedReaction(
    () => transform.zoomActive.value || transform.panActive.value,
    (active, previous) => {
      if (previous && !active) {
        const { scaleX, translateX } = getTransformComponents(transform.matrix.value);
        scheduleOnRN(finishTransform, scaleX, translateX);
      }
    },
  );

  const guideStart = useDerivedValue(() => vec(press.x.position.value, plotTop.value));
  const guideEnd = useDerivedValue(() => vec(press.x.position.value, plotBottom.value));
  const pressOpacity = useDerivedValue(() => (press.isActive.value ? 1 : 0));
  const restingOpacity = useDerivedValue(() => (press.isActive.value ? 0 : 1));

  return (
    <View style={{ height: 200 }}>
      <CartesianChart
        chartPressState={press}
        data={model.data}
        domain={{ x: [model.data[0].x, model.data.at(-1)!.x], y: model.yDomain }}
        frame={{ lineWidth: 0 }}
        gestureLongPressDelay={200}
        onChartBoundsChange={(next) => {
          bounds.current = next;
          plotTop.value = next.top;
          plotBottom.value = next.bottom;
        }}
        onScaleChange={(nextX) => {
          xScale.current = nextX;
        }}
        padding={{ left: 4, right: 12, top: 8, bottom: 4 }}
        transformConfig={{
          pan: { enabled: zoomed, dimensions: "x", activeOffsetX: [-12, 12], failOffsetY: [-12, 12] },
          pinch: { enabled: true, dimensions: "x" },
        }}
        transformState={transform}
        xAxis={{
          font,
          formatXLabel: formatX,
          labelColor: colors.label,
          lineColor: "transparent",
          lineWidth: 0,
          tickValues: model.xTicks,
        }}
        xKey="x"
        yAxis={[
          {
            font,
            formatYLabel: formatY,
            labelColor: colors.label,
            lineColor: colors.rule,
            lineWidth: 1,
            tickValues: model.yTicks,
          },
        ]}
        yKeys={["value"]}
      >
        {({ points }) => {
          const resting = points.value[selectedIndex];
          return (
            <>
              {model.segments.map(([start, end]) => (
                <Line
                  color={colors.line}
                  key={`${start}-${end}`}
                  points={points.value.slice(start, end + 1)}
                  strokeWidth={2}
                />
              ))}
              <SkiaLine color={colors.guide} opacity={pressOpacity} p1={guideStart} p2={guideEnd} strokeWidth={1} />
              <Circle
                color={colors.marker}
                cx={press.x.position}
                cy={press.y.value.position}
                opacity={pressOpacity}
                r={6}
              />
              {resting && typeof resting.y === "number" ? (
                <Circle color={colors.marker} cx={resting.x} cy={resting.y} opacity={restingOpacity} r={6} />
              ) : null}
            </>
          );
        }}
      </CartesianChart>
    </View>
  );
});
