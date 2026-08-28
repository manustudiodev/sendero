import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMonthPage,
  indexItineraryDays,
  monthKeyFromDate,
  monthKeysInRange,
  resolveMonthPage,
} from "./src/itinerary/calendar-model.js";

const days = [
  { date: "2026-12-20", title: "Llegada" },
  { date: "2026-12-31", title: "Fin de año" },
  { date: "2027-01-01", title: "Año nuevo" },
  { date: "2027-01-10", title: "Cierre" },
];

test("builds inclusive month keys across years", () => {
  assert.deepEqual(monthKeysInRange("2026-12-20", "2027-01-10"), ["2026-12", "2027-01"]);
  assert.deepEqual(monthKeysInRange("2026-11-30", "2027-02-01"), [
    "2026-11",
    "2026-12",
    "2027-01",
    "2027-02",
  ]);
  assert.deepEqual(monthKeysInRange("2027-01-10", "2026-12-20"), []);
});

test("creates Monday-first weeks with exactly seven cells", () => {
  const december = buildMonthPage({ days, monthKey: "2026-12" });
  assert.equal(december.key, "2026-12");
  assert.equal(december.year, 2026);
  assert.equal(december.monthIndex, 11);
  assert.ok(december.weeks.every((week) => week.length === 7));
  assert.equal(december.weeks[0][0].date, "2026-11-30");
  assert.equal(december.weeks[0][1].date, "2026-12-01");
  assert.equal(december.weeks.at(-1).at(-1).date, "2027-01-03");
  assert.equal(december.weeks.flat().filter((cell) => cell.inMonth).length, 31);
});

test("supports Sunday-first calendars for locales such as en-US", () => {
  const december = buildMonthPage({ days, firstDayOfWeek: 0, monthKey: "2026-12" });
  assert.equal(december.weeks[0][0].date, "2026-11-29");
  assert.equal(december.weeks[0][2].date, "2026-12-01");
  assert.ok(december.weeks.every((week) => week.length === 7));
});

test("attaches itinerary data only to dates on the current month page", () => {
  const december = buildMonthPage({ days, monthKey: "2026-12" });
  const december20 = december.weeks.flat().find((cell) => cell.date === "2026-12-20");
  const january1Spillover = december.weeks.flat().find((cell) => cell.date === "2027-01-01");
  assert.equal(december20.day.title, "Llegada");
  assert.equal(january1Spillover.inMonth, false);
  assert.equal(january1Spillover.day, null);

  const january = buildMonthPage({ days, monthKey: "2027-01" });
  const january10 = january.weeks.flat().find((cell) => cell.date === "2027-01-10");
  assert.equal(january10.day.title, "Cierre");
  assert.equal(january10.inMonth, true);
  assert.equal(january.weeks[1][6].date, "2027-01-10");
});

test("indexes valid itinerary dates and ignores malformed entries", () => {
  const lookup = indexItineraryDays([...days, { date: "2027-02-31", title: "Invalid" }, null]);
  assert.equal(lookup.size, days.length);
  assert.equal(lookup.get("2026-12-31").title, "Fin de año");
  assert.equal(monthKeyFromDate("2027-01-10"), "2027-01");
  assert.equal(monthKeyFromDate("2027-02-31"), "");
});

test("resolves pagination by month key with stable boundaries", () => {
  const keys = ["2026-12", "2027-01", "2027-02"];
  assert.deepEqual(resolveMonthPage(keys, "2027-01"), {
    index: 1,
    key: "2027-01",
    nextKey: "2027-02",
    previousKey: "2026-12",
  });
  assert.deepEqual(resolveMonthPage(keys, "missing"), {
    index: 0,
    key: "2026-12",
    nextKey: "2027-01",
    previousKey: null,
  });
  assert.deepEqual(resolveMonthPage([], "2027-01"), {
    index: -1,
    key: "",
    nextKey: null,
    previousKey: null,
  });
});

test("rejects malformed month keys", () => {
  assert.equal(buildMonthPage({ days, monthKey: "2027-13" }), null);
  assert.equal(buildMonthPage({ days, monthKey: "January 2027" }), null);
});
