const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseISODate(value) {
  const match = ISO_DATE_PATTERN.exec(String(value || ""));
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) return null;
  return date;
}

export function toISODate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return [
    String(date.getUTCFullYear()).padStart(4, "0"),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export function todayISO(now = new Date()) {
  return toISODate(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
}

export function addDaysISO(value, amount) {
  const date = parseISODate(value);
  if (!date) return "";
  date.setUTCDate(date.getUTCDate() + amount);
  return toISODate(date);
}

export function addMonthsISO(value, amount) {
  const date = parseISODate(value);
  if (!date) return "";
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + amount);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return toISODate(date);
}

export function startOfMonthISO(value) {
  const date = parseISODate(value);
  if (!date) return "";
  date.setUTCDate(1);
  return toISODate(date);
}

export function mondayIndex(value) {
  const date = parseISODate(value);
  if (!date) return 0;
  return (date.getUTCDay() + 6) % 7;
}

export function monthMatrix(value) {
  const monthStart = startOfMonthISO(value);
  if (!monthStart) return [];
  const gridStart = addDaysISO(monthStart, -mondayIndex(monthStart));
  return Array.from({ length: 42 }, (_, index) => {
    const iso = addDaysISO(gridStart, index);
    return { iso, inMonth: iso.slice(0, 7) === monthStart.slice(0, 7) };
  });
}

export function formatDateLabel(value, locale = "es") {
  const date = parseISODate(value);
  if (!date) return "Elegir";
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatLongDateLabel(value, locale = "es") {
  const date = parseISODate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatMonthLabel(value, locale = "es") {
  const date = parseISODate(value);
  if (!date) return "";
  const label = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
  return `${label.charAt(0).toLocaleUpperCase(locale)}${label.slice(1)}`;
}

export function rangeState(value, startDate, endDate) {
  return {
    isStart: Boolean(startDate && value === startDate),
    isEnd: Boolean(endDate && value === endDate),
    inRange: Boolean(startDate && endDate && value >= startDate && value <= endDate),
  };
}

export function selectRangeDate({ startDate = "", endDate = "", endpoint = "start" }, value) {
  if (!parseISODate(value)) return { startDate, endDate, endpoint };
  if (endpoint === "start") {
    return {
      startDate: value,
      endDate: endDate && endDate >= value ? endDate : "",
      endpoint: "end",
    };
  }
  if (!startDate || value < startDate) {
    return { startDate: value, endDate: "", endpoint: "end" };
  }
  return { startDate, endDate: value, endpoint: "complete" };
}

export function moveCalendarFocus(value, key, shiftKey = false) {
  if (key === "ArrowLeft") return addDaysISO(value, -1);
  if (key === "ArrowRight") return addDaysISO(value, 1);
  if (key === "ArrowUp") return addDaysISO(value, -7);
  if (key === "ArrowDown") return addDaysISO(value, 7);
  if (key === "Home") return addDaysISO(value, -mondayIndex(value));
  if (key === "End") return addDaysISO(value, 6 - mondayIndex(value));
  if (key === "PageUp") return addMonthsISO(value, shiftKey ? -12 : -1);
  if (key === "PageDown") return addMonthsISO(value, shiftKey ? 12 : 1);
  return "";
}
