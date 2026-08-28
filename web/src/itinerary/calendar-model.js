const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_KEY = /^(\d{4})-(\d{2})$/;

function parsedIsoDate(value) {
  const match = ISO_DATE.exec(String(value || ""));
  if (!match) return null;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, monthIndex, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== monthIndex
    || date.getUTCDate() !== day
  ) return null;
  return date;
}

function parsedMonthKey(value) {
  const match = MONTH_KEY.exec(String(value || ""));
  if (!match) return null;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) return null;
  return { monthIndex, year };
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function monthKey(year, monthIndex) {
  return `${String(year).padStart(4, "0")}-${String(monthIndex + 1).padStart(2, "0")}`;
}

export function monthKeyFromDate(value) {
  const date = parsedIsoDate(value);
  return date ? monthKey(date.getUTCFullYear(), date.getUTCMonth()) : "";
}

export function monthKeysInRange(startDate, endDate) {
  const start = parsedIsoDate(startDate);
  const end = parsedIsoDate(endDate);
  if (!start || !end || end < start) return [];

  const keys = [];
  let year = start.getUTCFullYear();
  let monthIndex = start.getUTCMonth();
  const endYear = end.getUTCFullYear();
  const endMonthIndex = end.getUTCMonth();

  while (year < endYear || (year === endYear && monthIndex <= endMonthIndex)) {
    keys.push(monthKey(year, monthIndex));
    monthIndex += 1;
    if (monthIndex === 12) {
      monthIndex = 0;
      year += 1;
    }
  }
  return keys;
}

export function indexItineraryDays(days = []) {
  const lookup = new Map();
  for (const day of days) {
    if (day && parsedIsoDate(day.date)) lookup.set(day.date, day);
  }
  return lookup;
}

export function buildMonthPage({ days = [], firstDayOfWeek = 1, monthKey: requestedMonthKey }) {
  const parsed = parsedMonthKey(requestedMonthKey);
  if (!parsed) return null;

  const { monthIndex, year } = parsed;
  const firstOfMonth = new Date(Date.UTC(year, monthIndex, 1));
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const normalizedFirstDay = Number.isInteger(firstDayOfWeek) && firstDayOfWeek >= 0 && firstDayOfWeek <= 6
    ? firstDayOfWeek
    : 1;
  const leadingCells = (firstOfMonth.getUTCDay() - normalizedFirstDay + 7) % 7;
  const cellCount = Math.ceil((leadingCells + daysInMonth) / 7) * 7;
  const gridStart = new Date(Date.UTC(year, monthIndex, 1 - leadingCells));
  const dayByDate = indexItineraryDays(days);
  const cells = Array.from({ length: cellCount }, (_, index) => {
    const date = new Date(gridStart);
    date.setUTCDate(gridStart.getUTCDate() + index);
    const dateKey = isoDate(date);
    const inMonth = date.getUTCFullYear() === year && date.getUTCMonth() === monthIndex;
    return {
      date: dateKey,
      day: inMonth ? dayByDate.get(dateKey) || null : null,
      dayNumber: date.getUTCDate(),
      inMonth,
    };
  });

  const weeks = [];
  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7));
  }

  return {
    key: requestedMonthKey,
    monthIndex,
    weeks,
    year,
  };
}

export function resolveMonthPage(monthKeys, requestedMonthKey) {
  if (!Array.isArray(monthKeys) || !monthKeys.length) {
    return { index: -1, key: "", nextKey: null, previousKey: null };
  }
  const requestedIndex = monthKeys.indexOf(requestedMonthKey);
  const index = requestedIndex >= 0 ? requestedIndex : 0;
  return {
    index,
    key: monthKeys[index],
    nextKey: monthKeys[index + 1] || null,
    previousKey: monthKeys[index - 1] || null,
  };
}
