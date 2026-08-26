import assert from "node:assert/strict";
import test from "node:test";
import {
  addDaysISO,
  addMonthsISO,
  formatDateLabel,
  mondayIndex,
  monthMatrix,
  moveCalendarFocus,
  parseISODate,
  rangeState,
  selectRangeDate,
  startOfMonthISO,
  toISODate,
} from "./src/date-range.js";

test("keeps calendar dates stable in UTC, including leap years", () => {
  assert.equal(toISODate(parseISODate("2028-02-29")), "2028-02-29");
  assert.equal(parseISODate("2027-02-29"), null);
  assert.equal(addDaysISO("2028-02-28", 2), "2028-03-01");
  assert.equal(addMonthsISO("2028-01-31", 1), "2028-02-29");
  assert.equal(addMonthsISO("2027-12-31", 1), "2028-01-31");
  assert.equal(startOfMonthISO("2027-08-24"), "2027-08-01");
  assert.match(formatDateLabel("2027-08-24", "es"), /24/);
});

test("builds a six-week month grid starting on Monday", () => {
  const cells = monthMatrix("2027-08-01");
  assert.equal(cells.length, 42);
  assert.equal(cells[0].iso, "2027-07-26");
  assert.equal(cells.at(-1).iso, "2027-09-05");
  assert.equal(mondayIndex(cells[0].iso), 0);
  assert.equal(cells.filter((cell) => cell.inMonth).length, 31);
});

test("selects arrival then departure without silently swapping invalid ranges", () => {
  assert.deepEqual(selectRangeDate({ startDate: "", endDate: "", endpoint: "start" }, "2027-08-12"), {
    startDate: "2027-08-12",
    endDate: "",
    endpoint: "end",
  });
  assert.deepEqual(selectRangeDate({ startDate: "", endDate: "", endpoint: "end" }, "2027-08-12"), {
    startDate: "2027-08-12",
    endDate: "",
    endpoint: "end",
  });
  assert.deepEqual(selectRangeDate({ startDate: "2027-08-12", endDate: "", endpoint: "end" }, "2027-08-20"), {
    startDate: "2027-08-12",
    endDate: "2027-08-20",
    endpoint: "complete",
  });
  assert.deepEqual(selectRangeDate({ startDate: "2027-08-12", endDate: "2027-08-20", endpoint: "end" }, "2027-08-08"), {
    startDate: "2027-08-08",
    endDate: "",
    endpoint: "end",
  });
  assert.deepEqual(selectRangeDate({ startDate: "2027-08-12", endDate: "2027-08-20", endpoint: "start" }, "2027-08-25"), {
    startDate: "2027-08-25",
    endDate: "",
    endpoint: "end",
  });
});

test("marks and navigates a date range with calendar keyboard semantics", () => {
  assert.deepEqual(rangeState("2027-08-12", "2027-08-12", "2027-08-20"), {
    isStart: true,
    isEnd: false,
    inRange: true,
  });
  assert.equal(rangeState("2027-08-21", "2027-08-12", "2027-08-20").inRange, false);
  assert.equal(moveCalendarFocus("2027-08-01", "ArrowLeft"), "2027-07-31");
  assert.equal(moveCalendarFocus("2027-08-01", "End"), "2027-08-01");
  assert.equal(moveCalendarFocus("2027-08-01", "PageDown"), "2027-09-01");
  assert.equal(moveCalendarFocus("2028-02-29", "PageUp", true), "2027-02-28");
});
