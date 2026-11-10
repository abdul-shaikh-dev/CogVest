import { downsampleAssetHistory, type AssetHistoryPoint } from "@/src/domain/calculations/assetHistory";

const dayMs = 86_400_000;

export type AssetHistoryMode = "price" | "holdingValue";

export type AssetHistoryObservation = { date: string; value: number };

export type AssetHistoryChartDatum = {
  /** UTC noon of the observed date, so calendar spacing stays proportional. */
  x: number;
  value: number;
};

export type AssetHistoryChartModel = {
  observations: AssetHistoryObservation[];
  data: AssetHistoryChartDatum[];
  /** Inclusive index ranges drawn as one line; a break means a recorded gap. */
  segments: Array<[number, number]>;
  yDomain: [number, number];
  yTicks: number[];
  xTicks: number[];
};

export function getVisiblePriceScale(values: number[], sections = 3) {
  if (values.length === 0) {
    return { maxValue: 1, stepValue: 1 / sections, yAxisOffset: 0 };
  }

  const minimumValue = Math.min(...values);
  const maximumValue = Math.max(...values);
  const observedSpan = maximumValue - minimumValue;
  const padding = observedSpan > 0
    ? observedSpan * 0.12
    : Math.max(Math.abs(maximumValue) * 0.05, maximumValue < 1 ? 0.01 : 1);
  const yAxisOffset = Math.max(0, minimumValue - padding);
  const maxValue = Math.max(maximumValue + padding - yAxisOffset, Number.EPSILON);

  return { maxValue, stepValue: maxValue / sections, yAxisOffset };
}

/** Holding value starts at zero: it is a quantity times price, not a price level. */
function valueScale(values: number[], sections = 3) {
  const maximumValue = Math.max(0, ...values);
  const maxValue = maximumValue > 0 ? maximumValue * 1.12 : 1;
  return { maxValue, stepValue: maxValue / sections, yAxisOffset: 0 };
}

const timeOf = (date: string) => Date.parse(`${date}T12:00:00Z`);

/**
 * Builds the bounded, gap-aware chart for one history range. Pure and cheap to
 * memoise: the panel recomputes it only when the history entry or mode changes.
 */
export function buildAssetHistoryChartModel({
  points,
  mode,
  crypto,
  holdingSafe,
}: {
  points: AssetHistoryPoint[];
  mode: AssetHistoryMode;
  crypto: boolean;
  holdingSafe: boolean | undefined;
}): AssetHistoryChartModel {
  const maximumGapMs = (crypto ? 1 : 4) * dayMs;
  const gapPrefix: number[] = [];
  let previousTime = 0;
  points.forEach((point, index) => {
    const time = timeOf(point.date);
    const previous = points[index - 1];
    const hasGap =
      index > 0 &&
      ((mode === "holdingValue" && (point.holdingValue === null || previous.holdingValue === null)) ||
        time - previousTime > maximumGapMs);
    gapPrefix[index] = (gapPrefix[index - 1] ?? 0) + Number(hasGap);
    previousTime = time;
  });
  const sourceIndex = new Map(points.map((point, index) => [point, index]));

  const observations: AssetHistoryObservation[] = [];
  const sources: number[] = [];
  if (!(mode === "holdingValue" && holdingSafe === false)) {
    for (const point of downsampleAssetHistory(points)) {
      const value = point[mode];
      if (value === null) continue;
      observations.push({ date: point.date, value });
      sources.push(sourceIndex.get(point) ?? 0);
    }
  }

  const segments: Array<[number, number]> = [];
  let start = 0;
  for (let index = 1; index <= observations.length; index += 1) {
    if (index === observations.length || gapPrefix[sources[index]] > gapPrefix[sources[index - 1]]) {
      segments.push([start, index - 1]);
      start = index;
    }
  }
  if (observations.length === 0) segments.length = 0;

  const values = observations.map((observation) => observation.value);
  const scale = mode === "price" ? getVisiblePriceScale(values) : valueScale(values);
  const data = observations.map((observation) => ({ x: timeOf(observation.date), value: observation.value }));

  return {
    observations,
    data,
    segments,
    yDomain: [scale.yAxisOffset, scale.yAxisOffset + scale.maxValue],
    yTicks: [0, 1, 2, 3].map((step) => scale.yAxisOffset + scale.stepValue * step),
    xTicks: data.length > 1 ? [data[0].x, data.at(-1)!.x] : data.map((datum) => datum.x),
  };
}

/** Nearest observation to a chart x value, for touch inspection. */
export function nearestObservationIndex(data: AssetHistoryChartDatum[], x: number) {
  if (data.length === 0) return -1;
  let low = 0;
  let high = data.length - 1;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (data[middle].x < x) low = middle + 1;
    else high = middle;
  }
  if (low > 0 && Math.abs(data[low - 1].x - x) <= Math.abs(data[low].x - x)) return low - 1;
  return low;
}
