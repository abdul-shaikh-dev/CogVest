const calendarDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;

function daysInMonth(year: number, month: number) {
  if (month === 2) {
    const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);

    return isLeapYear ? 29 : 28;
  }

  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function parseCalendarDate(value: string) {
  const match = calendarDatePattern.exec(value.trim());

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (
    year < 1 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month)
  ) {
    return null;
  }

  return { day, month, year };
}

export function getCalendarDatePart(value: string) {
  const candidate = value.trim().slice(0, 10);

  return parseCalendarDate(candidate) ? candidate : null;
}

export function formatLocalCalendarDate(date: Date) {
  return `${String(date.getFullYear()).padStart(4, "0")}-${String(
    date.getMonth() + 1,
  ).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function calendarDateToLocalDate(value: string) {
  const parsed = parseCalendarDate(value);

  if (!parsed) {
    return null;
  }

  const date = new Date(0);
  date.setHours(12, 0, 0, 0);
  date.setFullYear(parsed.year, parsed.month - 1, parsed.day);

  return date;
}

export function isFutureCalendarDate(value: string, now = new Date()) {
  const calendarDate = getCalendarDatePart(value);

  return calendarDate !== null && calendarDate > formatLocalCalendarDate(now);
}

export function isEffectiveCalendarDate(value: string, now = new Date()) {
  const calendarDate = getCalendarDatePart(value);

  return calendarDate !== null && calendarDate <= formatLocalCalendarDate(now);
}
