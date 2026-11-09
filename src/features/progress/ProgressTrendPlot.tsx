import { Circle, DashPathEffect, LinearGradient, Line as SkiaLine, matchFont, vec } from "@shopify/react-native-skia";
import { memo, useCallback, useMemo, useState } from "react";
import { Platform, StyleSheet, View, useWindowDimensions } from "react-native";
import { useAnimatedReaction, useDerivedValue, useSharedValue } from "react-native-reanimated";
import { Area, CartesianChart, Line, useChartPressState, type Scale } from "victory-native";
import { scheduleOnRN } from "react-native-worklets";

import { AppText } from "@/src/components/common";

import type { ProgressTrendModel } from "./progressTrendChartModel";
import { chartHeight } from "./progressViewModel";

type Row = Record<string, number>;

type ProgressTrendPlotProps = {
  model: ProgressTrendModel;
  formatYLabel: (value: number) => string;
  colors: { rule: string; label: string; fill: string };
  /** Month under a press-and-hold as the finger moves, then null on release. */
  onInspect: (index: number | null) => void;
};

const PRESS_DELAY_MS = 200;

/**
 * Victory line chart for one Progress card. Press and hold, then drag, to
 * inspect a month; a swipe that moves before the hold scrolls the page instead.
 * The finger's marker is drawn on the UI thread, so the screen can show the
 * month live without re-rendering the chart, which would reset the gesture.
 * Remount it (via key) when its series change: the press state is per series.
 */
export const ProgressTrendPlot = memo(function ProgressTrendPlot({
  model,
  formatYLabel,
  colors,
  onInspect,
}: ProgressTrendPlotProps) {
  const { fontScale, width: windowWidth } = useWindowDimensions();
  const font = useMemo(
    () => matchFont({
      fontFamily: Platform.select({ ios: "Helvetica", default: "sans-serif" }),
      fontSize: Math.round(11 * Math.max(1, fontScale)),
    }),
    [fontScale],
  );
  const keys = useMemo(() => model.lines.map((line) => line.key), [model.lines]);
  const data = useMemo<Row[]>(
    () => Array.from({ length: model.count }, (_, index) => {
      const row: Row = { x: index };
      for (const line of model.lines) row[line.key] = line.values[index] ?? 0;
      return row;
    }),
    [model.count, model.lines],
  );
  const { state: press } = useChartPressState<{ x: number; y: Record<string, number> }>({
    x: 0,
    y: Object.fromEntries(keys.map((key) => [key, 0])),
  });
  const [labelX, setLabelX] = useState<number[]>([]);
  const [plotWidth, setPlotWidth] = useState(0);

  const plotTop = useSharedValue(0);
  const plotBottom = useSharedValue(0);
  const reportInspect = useCallback((index: number) => onInspect(index < 0 ? null : index), [onInspect]);
  useAnimatedReaction(
    () => (press.isActive.value ? press.matchedIndex.value : -1),
    (index, previous) => {
      if (index !== previous && previous !== null) scheduleOnRN(reportInspect, index);
    },
  );
  const guideStart = useDerivedValue(() => vec(press.x.position.value, plotTop.value));
  const guideEnd = useDerivedValue(() => vec(press.x.position.value, plotBottom.value));
  const pressOpacity = useDerivedValue(() => (press.isActive.value ? 1 : 0));
  const restingOpacity = useDerivedValue(() => (press.isActive.value ? 0 : 1));
  const pressY = press.y as unknown as Record<string, { position: { value: number } }>;

  const onScaleChange = useCallback((xScale: Scale) => {
    setLabelX(model.xLabels.map((label) => xScale(label.index)));
  }, [model.xLabels]);

  const labelWidth = Math.min(72 * Math.max(1, fontScale), (plotWidth || windowWidth) / 3);
  const labelsHeight = Math.ceil(36 * Math.max(1, fontScale));
  const last = Math.max(model.count - 1, 1);

  return (
    <View onLayout={(event) => setPlotWidth(event.nativeEvent.layout.width)}>
      <View style={{ height: chartHeight }}>
        <CartesianChart
          chartPressState={press}
          data={data}
          domain={{ x: [0, last], y: [0, model.maxValue] }}
          domainPadding={{ left: 10, right: 14, top: 8 }}
          frame={{ lineWidth: 0 }}
          gestureLongPressDelay={PRESS_DELAY_MS}
          onChartBoundsChange={(bounds) => {
            plotTop.value = bounds.top;
            plotBottom.value = bounds.bottom;
          }}
          onScaleChange={onScaleChange}
          // Room for the y-axis labels centred on the top and zero rules.
          padding={{ left: 0, right: 0, top: 8, bottom: 8 }}
          xKey={"x" as never}
          yAxis={[{
            font,
            formatYLabel: formatYLabel as never,
            labelColor: colors.label,
            lineColor: colors.rule,
            lineWidth: StyleSheet.hairlineWidth,
            linePathEffect: <DashPathEffect intervals={[4, 4]} />,
            tickValues: model.yTicks,
          }]}
          yKeys={keys as never}
        >
          {({ points, chartBounds }) => {
            const byKey = points as unknown as Record<string, Array<{ x: number; y: number | null | undefined }>>;
            return (
              <>
                {model.fillUnderFirst && model.lines[0] && model.count > 1 ? (
                  <Area
                    animate={model.animate ? { type: "timing", duration: 300 } : undefined}
                    points={byKey[model.lines[0].key] as never}
                    y0={chartBounds.bottom}
                  >
                    <LinearGradient
                      colors={[`${colors.fill}2E`, `${colors.fill}00`]}
                      end={vec(0, chartBounds.bottom)}
                      start={vec(0, chartBounds.top)}
                    />
                  </Area>
                ) : null}
                {model.lines.map((line) => model.segments.map(([start, end]) => (
                  <Line
                    animate={model.animate ? { type: "timing", duration: 300 } : undefined}
                    color={line.color}
                    key={`${line.key}:${start}-${end}`}
                    points={byKey[line.key].slice(start, end + 1) as never}
                    strokeWidth={3}
                  >
                    {line.dashed ? <DashPathEffect intervals={[6, 4]} /> : null}
                  </Line>
                )))}
                {model.lines.map((line) => byKey[line.key].map((point, index) => {
                  const radius = line.pointRadii[index] ?? 0;
                  return radius > 0 && typeof point.y === "number" ? (
                    <Circle
                      color={line.pointColor}
                      cx={point.x}
                      cy={point.y}
                      key={`${line.key}:p${index}`}
                      // The committed month steps aside while a finger inspects.
                      opacity={radius >= 6 ? restingOpacity : 1}
                      r={radius}
                    />
                  ) : null;
                }))}
                <SkiaLine color={colors.rule} opacity={pressOpacity} p1={guideStart} p2={guideEnd} strokeWidth={1} />
                {model.lines.map((line) => pressY[line.key] ? (
                  <Circle
                    color={line.pointColor}
                    cx={press.x.position}
                    cy={pressY[line.key].position as never}
                    key={`${line.key}:press`}
                    opacity={pressOpacity}
                    r={6}
                  />
                ) : null)}
              </>
            );
          }}
        </CartesianChart>
      </View>
      <View style={{ height: labelsHeight }}>
        {model.xLabels.map((label, index) => {
          const x = labelX[index];
          if (x === undefined) return null;
          const left = label.align === "left"
            ? x - 4
            : label.align === "right"
              ? x - labelWidth + 4
              : x - labelWidth / 2;
          return (
            <AppText
              align={label.align}
              color="secondary"
              key={label.index}
              style={[styles.axisLabel, { left, width: labelWidth }]}
              testID="progress-trend-axis-label"
              variant="caption"
            >
              {label.text}
            </AppText>
          );
        })}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  axisLabel: { position: "absolute", top: 4 },
});
