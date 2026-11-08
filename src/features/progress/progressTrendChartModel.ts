import type { MonthlyProgressChartSeries } from "@/src/domain/calculations";
import type { ThemeColors } from "@/src/theme";

import {
  chartSections,
  formatChartAxisLabel,
  getChartMaxValue,
  getChartPointRadius,
  getDisplayedSeriesColor,
  getSeriesColor,
  shouldShowAxisLabel,
} from "./progressViewModel";

export type ProgressTrendLine = {
  /** Stable data key for the renderer. */
  key: string;
  label: string;
  color: string;
  pointColor: string;
  dashed: boolean;
  values: number[];
  /** 0 hides a marker; the inspected month is always enlarged. */
  pointRadii: number[];
};

export type ProgressTrendAxisLabel = {
  index: number;
  text: string;
  align: "left" | "center" | "right";
};

export type ProgressTrendModel = {
  count: number;
  lines: ProgressTrendLine[];
  /** Inclusive month-index ranges drawn as one line; a break is a missing month. */
  segments: Array<[number, number]>;
  /** Soft fill under the first line; only drawn when there are no gaps. */
  fillUnderFirst: boolean;
  maxValue: number;
  yTicks: number[];
  xLabels: ProgressTrendAxisLabel[];
  animate: boolean;
};

export function getGapSegments(count: number, gapAfterIndices: number[]): Array<[number, number]> {
  if (count === 0) return [];
  const segments: Array<[number, number]> = [];
  let start = 0;
  for (const gap of [...gapAfterIndices].sort((a, b) => a - b)) {
    if (gap < start || gap >= count - 1) continue;
    segments.push([start, gap]);
    start = gap + 1;
  }
  segments.push([start, count - 1]);
  return segments;
}

/**
 * Sparse, chart-native month labels: first, middle and latest month, or only
 * the endpoints when enlarged text meets a narrow plot. Endpoints align inward
 * so they stay inside the plot; multi-year ranges carry the year on a second line.
 */
export function getProgressAxisLabels(monthLabels: string[], endpointsOnly: boolean): ProgressTrendAxisLabel[] {
  const total = monthLabels.length;
  const spansYears = new Set(monthLabels.map((label) => label.split(" ")[1])).size > 1;
  const labels: ProgressTrendAxisLabel[] = [];
  monthLabels.forEach((monthLabel, index) => {
    const show = endpointsOnly ? index === 0 || index === total - 1 : shouldShowAxisLabel(index, total);
    if (!show) return;
    labels.push({
      index,
      text: spansYears ? monthLabel.replace(" ", "\n") : formatChartAxisLabel(monthLabel),
      align: index === 0 ? "left" : index === total - 1 ? "right" : "center",
    });
  });
  return labels;
}

/**
 * Pure drawing model for one Progress trend chart. The screen owns month
 * selection, masking and accessibility text; this only decides what to draw.
 */
export function buildProgressTrendModel({
  colors,
  drawnSeries,
  scaleSeries,
  dashedLabels = [],
  endpointsOnly,
  fillUnderFirst,
  focusedSeries,
  gapAfterIndices,
  monthLabels,
  reducedMotion,
  selectedIndex,
}: {
  colors: ThemeColors;
  drawnSeries: MonthlyProgressChartSeries[];
  /** Series that set the zero-based scale; may include ones not drawn. */
  scaleSeries: MonthlyProgressChartSeries[];
  dashedLabels?: string[];
  endpointsOnly: boolean;
  fillUnderFirst: boolean;
  focusedSeries: string | null;
  gapAfterIndices: number[];
  monthLabels: string[];
  reducedMotion: boolean;
  selectedIndex: number;
}): ProgressTrendModel {
  const count = drawnSeries[0]?.values.length ?? 0;
  const segments = getGapSegments(count, gapAfterIndices);
  const maxValue = getChartMaxValue(scaleSeries);

  return {
    count,
    lines: drawnSeries.map((series, index) => ({
      key: `s${index}`,
      label: series.label,
      color: getDisplayedSeriesColor(colors, series.label, focusedSeries),
      pointColor: getSeriesColor(colors, series.label),
      dashed: dashedLabels.includes(series.label),
      values: series.values,
      pointRadii: series.values.map((_, point) => getChartPointRadius(count, point, selectedIndex)),
    })),
    segments,
    fillUnderFirst: fillUnderFirst && segments.length <= 1,
    maxValue,
    yTicks: Array.from({ length: chartSections + 1 }, (_, step) => (maxValue / chartSections) * step),
    xLabels: getProgressAxisLabels(monthLabels.slice(0, count), endpointsOnly),
    animate: !reducedMotion,
  };
}
