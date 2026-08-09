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
  const acquisitionDate = getOpeningPositionAcquisitionDate(position);
  if (acquisitionDate !== null) return acquisitionDate;

  const recordedOn = getCalendarDatePart(position.recordedOn ?? "");
  if (recordedOn !== null) return recordedOn;

  const recordedAt = new Date(position.recordedAt ?? "");
  return Number.isFinite(recordedAt.getTime())
    ? formatLocalCalendarDate(recordedAt)
    : null;
}

export function isOpeningPositionEffective(
  position: OpeningPosition,
  now = new Date(),
) {
  const historyDate = getOpeningPositionHistoryDate(position);

  return historyDate !== null && isEffectiveCalendarDate(historyDate, now);
}
