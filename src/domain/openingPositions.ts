import type { OpeningPosition } from "@/src/types";

import {
  formatLocalCalendarDate,
  getCalendarDatePart,
  isEffectiveCalendarDate,
} from "./dates";

export function getOpeningPositionAcquisitionDate(
  position: OpeningPosition,
) {
  return position.date === null ? null : getCalendarDatePart(position.date);
}

export function getOpeningPositionHistoryDate(position: OpeningPosition) {
  const measuredAsOf = getCalendarDatePart(position.measuredAsOf ?? "");
  if (measuredAsOf !== null) return measuredAsOf;

  const acquisitionDate = getOpeningPositionAcquisitionDate(position);
  if (acquisitionDate !== null) return acquisitionDate;

  const recordedOn = getCalendarDatePart(position.recordedOn ?? "");
  if (recordedOn !== null) return recordedOn;

  const recordedAt = new Date(position.recordedAt ?? "");
  return Number.isFinite(recordedAt.getTime())
    ? formatLocalCalendarDate(recordedAt)
    : null;
}

export function getLatestOpeningPositionCutover(
  positions: OpeningPosition[],
) {
  return (
    positions
      .map((position) => getCalendarDatePart(position.measuredAsOf ?? ""))
      .filter((date): date is string => date !== null)
      .sort()
      .at(-1) ?? null
  );
}

export function isTransactionAfterOpeningCutover(
  transactionDate: string,
  positions: OpeningPosition[],
) {
  const cutover = getLatestOpeningPositionCutover(positions);
  const date = getCalendarDatePart(transactionDate);

  return cutover === null || (date !== null && date > cutover);
}

export function isOpeningPositionEffective(
  position: OpeningPosition,
  now = new Date(),
) {
  const historyDate = getOpeningPositionHistoryDate(position);

  return historyDate !== null && isEffectiveCalendarDate(historyDate, now);
}
