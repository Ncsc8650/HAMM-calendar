import test from "node:test";
import assert from "node:assert/strict";
import {dayKey, monthBounds, eventDays, groupEvents, category} from "./calendar-logic.js";

test("Thai day and month bounds cross Gregorian year", () => {
  assert.equal(dayKey(new Date("2026-09-30T17:00:00Z")), "2026-10-01");
  assert.deepEqual(monthBounds(2026, 11), {
    timeMin: "2026-12-01T00:00:00+07:00",
    timeMax: "2027-01-01T00:00:00+07:00"
  });
});

test("all-day end date is exclusive and timed midnight end is exclusive", () => {
  assert.deepEqual(eventDays({start: {date: "2026-10-01"}, end: {date: "2026-10-03"}}), ["2026-10-01", "2026-10-02"]);
  assert.deepEqual(eventDays({start: {dateTime: "2026-10-01T23:00:00+07:00"}, end: {dateTime: "2026-10-02T00:00:00+07:00"}}), ["2026-10-01"]);
});

test("long events across months appear on all days in the selected month", () => {
  const long = {summary: "งานประจำปี", start: {date: "2026-09-01"}, end: {date: "2027-10-01"}};
  const map = groupEvents([long, {status: "cancelled", start: {date: "2026-10-01"}, end: {date: "2026-10-02"}}], 2026, 9);
  assert.equal(map.size, 31);
  assert.equal(map.get("2026-10-31")[0], long);
  assert.equal(category({summary: "กินยาความดัน"}), "medicine");
});
