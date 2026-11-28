import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addDays, localNow, parseTimePreference, validateAppointmentPreferences,
} from "./appointmentPreferences.js";

// 2026-11-28 10:30 in Cambodia (UTC+7) is 03:30 UTC.
const now = new Date("2026-11-28T03:30:00Z");
const validate = (input, options = {}) => validateAppointmentPreferences(input, { now, ...options });

test("today and the current time are measured in Cambodia time", () => {
  assert.deepEqual(localNow(now), { date: "2026-11-28", minutes: 10 * 60 + 30 });
  // 18:00 UTC on the 28th is already the 29th in Phnom Penh.
  assert.equal(localNow(new Date("2026-11-28T18:00:00Z")).date, "2026-11-29");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});

test("accepts a date with a named range, an exact time, or a custom range", () => {
  for (const [time, stored] of [
    ["Morning (8:00 – 12:00)", "Morning (8:00 – 12:00)"],
    ["afternoon", "Afternoon (12:00 – 17:00)"],
    ["Evening", "Evening (17:00 – 20:00)"],
    ["14:30", "14:30"],
    ["9:00 - 11:00", "09:00-11:00"],
    ["13:00–15:30", "13:00-15:30"],
  ]) {
    const { errors, values } = validate({ appointmentDate: "2026-11-29", appointmentTime: time });
    assert.deepEqual(errors, {}, time);
    assert.equal(values.appointmentTime, stored, time);
  }
});

test("scheduling notes are optional, trimmed and limited to 500 characters", () => {
  const base = { appointmentDate: "2026-11-29", appointmentTime: "Morning" };
  assert.equal(validate({ ...base, schedulingNotes: "  Call 30 minutes before.  " }).values.schedulingNotes, "Call 30 minutes before.");
  assert.deepEqual(validate({ ...base, schedulingNotes: "x".repeat(500) }).errors, {});
  assert.match(validate({ ...base, schedulingNotes: "x".repeat(501) }).errors.schedulingNotes, /500 characters/);
  assert.match(validate({ ...base, schedulingNotes: 42 }).errors.schedulingNotes, /text/);
});

test("rejects past, unreal and too-distant dates", () => {
  const time = { appointmentTime: "Afternoon" };
  assert.match(validate({ appointmentDate: "2026-11-27", ...time }).errors.appointmentDate, /past/);
  assert.match(validate({ appointmentDate: "2026-02-30", ...time }).errors.appointmentDate, /real date/);
  assert.match(validate({ appointmentDate: "28/11/2026", ...time }).errors.appointmentDate, /real date/);
  assert.deepEqual(validate({ appointmentDate: addDays("2026-11-28", 90), ...time }).errors, {});
  assert.match(validate({ appointmentDate: addDays("2026-11-28", 91), ...time }).errors.appointmentDate, /90 days/);
});

test("rejects times outside service hours or in the wrong format", () => {
  for (const time of ["07:30", "20:00", "20:30", "25:00", "11:00-09:00", "10:00-10:00", "07:00-09:00", "18:00-21:00", "noon", "9am"]) {
    assert.ok(validate({ appointmentDate: "2026-11-29", appointmentTime: time }).errors.appointmentTime, time);
  }
  assert.equal(parseTimePreference("19:59")?.label, "19:59");
});

test("on today's date, a time that has already passed is rejected", () => {
  // It is 10:30.
  assert.match(validate({ appointmentDate: "2026-11-28", appointmentTime: "09:00" }).errors.appointmentTime, /already passed/);
  assert.match(validate({ appointmentDate: "2026-11-28", appointmentTime: "08:00-10:30" }).errors.appointmentTime, /already passed/);
  assert.deepEqual(validate({ appointmentDate: "2026-11-28", appointmentTime: "Morning" }).errors, {}, "morning runs until 12:00");
  assert.deepEqual(validate({ appointmentDate: "2026-11-28", appointmentTime: "11:00" }).errors, {});
  assert.deepEqual(validate({ appointmentDate: "2026-11-29", appointmentTime: "09:00" }).errors, {}, "tomorrow is fine");
});

test("regular requests need a date and time; emergency requests may leave both empty", () => {
  const regular = validate({});
  assert.ok(regular.errors.appointmentDate && regular.errors.appointmentTime);

  assert.deepEqual(validate({ appointmentDate: "", appointmentTime: "" }, { emergency: true }).errors, {});
  assert.ok(validate({ appointmentDate: "2026-11-29", appointmentTime: "" }, { emergency: true }).errors.appointmentTime);
  assert.ok(validate({ appointmentDate: "", appointmentTime: "Morning" }, { emergency: true }).errors.appointmentDate);
});
