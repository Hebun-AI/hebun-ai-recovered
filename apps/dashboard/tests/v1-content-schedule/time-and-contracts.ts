/*
 * V1-STAGE-2 — schedule time handling and contracts. Pure; no database.
 * The process zone is varied to prove the conversion never depends on it.
 */
import assert from "node:assert/strict";
import {
  asScheduleYouTubeOptions,
  checkLead,
  formatInZone,
  isDue,
  isValidTimeZone,
  zonedLocalToUtc,
} from "../../src/features/content-schedule/contracts";

const iso = (r: ReturnType<typeof zonedLocalToUtc>) => (r.ok ? r.instant.toISOString() : r.reason);

for (const processZone of ["UTC", "Asia/Tokyo", "America/Los_Angeles"]) {
  process.env.TZ = processZone;
  assert.equal(iso(zonedLocalToUtc("2026-11-12T09:00", "Europe/Istanbul")), "2026-11-12T06:00:00.000Z", processZone);
  assert.equal(iso(zonedLocalToUtc("2026-11-12T09:00", "UTC")), "2026-11-12T09:00:00.000Z");
  assert.equal(iso(zonedLocalToUtc("2026-07-01T12:00", "America/New_York")), "2026-07-01T16:00:00.000Z", "EDT");
  assert.equal(iso(zonedLocalToUtc("2026-12-01T12:00", "America/New_York")), "2026-12-01T17:00:00.000Z", "EST");
  /* Spring forward 2026-03-08: 02:00→03:00 in New York; 02:30 never happens. */
  assert.equal(iso(zonedLocalToUtc("2026-03-08T02:30", "America/New_York")), "nonexistent-local-time");
  assert.equal(iso(zonedLocalToUtc("2026-03-08T03:30", "America/New_York")), "2026-03-08T07:30:00.000Z");
  /* Fall back 2026-11-01: 01:30 happens twice; the first (EDT, UTC−4) is chosen. */
  assert.equal(iso(zonedLocalToUtc("2026-11-01T01:30", "America/New_York")), "2026-11-01T05:30:00.000Z");
  /* A half-hour zone and the date line. */
  assert.equal(iso(zonedLocalToUtc("2026-11-12T09:00", "Asia/Kolkata")), "2026-11-12T03:30:00.000Z");
  assert.equal(iso(zonedLocalToUtc("2026-11-12T00:15", "Pacific/Kiritimati")), "2026-11-11T10:15:00.000Z");
  assert.equal(formatInZone("2026-11-12T06:00:00.000Z", "Europe/Istanbul"), "2026-11-12 09:00 Europe/Istanbul");
  assert.equal(formatInZone("2026-11-01T05:30:00.000Z", "America/New_York"), "2026-11-01 01:30 America/New_York");
}
process.env.TZ = "UTC";
console.log("ok time: conversion and display identical under three process zones; DST gap refused, overlap → first");

for (const bad of ["2026-02-30T10:00", "2026-11-12T24:00", "2026-11-12 09:00", "2026-11-12T9:00", ""]) {
  assert.equal(iso(zonedLocalToUtc(bad, "UTC")), "invalid-local-time", bad);
}
for (const tz of ["Mars/Olympus", "", "x".repeat(65), "Europe/Istanbul; drop"]) {
  assert.equal(isValidTimeZone(tz), false, tz);
  assert.equal(iso(zonedLocalToUtc("2026-11-12T09:00", tz)), "invalid-time-zone");
}
console.log("ok invalid local times and zones refused");

const now = new Date("2026-11-09T12:00:00.000Z");
assert.equal(checkLead(new Date("2026-11-09T12:04:00.000Z"), now), "too-soon");
assert.equal(checkLead(new Date("2026-11-09T12:05:00.000Z"), now), null);
assert.equal(checkLead(new Date("2027-11-11T12:00:00.000Z"), now), "too-far");
assert.equal(isDue("2026-11-09T12:00:00.000Z", now), true);
assert.equal(isDue("2026-11-09T12:00:01.000Z", now), false);
console.log("ok lead window (5 min … 366 days) and due-ness");

assert.deepEqual(asScheduleYouTubeOptions({ privacyStatus: "private", categoryId: "22", madeForKids: "no", syntheticMedia: "yes" }), {
  privacyStatus: "private", categoryId: "22", madeForKids: "no", syntheticMedia: "yes",
});
for (const bad of [null, {}, { privacyStatus: "secret", categoryId: "22", madeForKids: "no", syntheticMedia: "no" },
  { privacyStatus: "public", categoryId: "22a", madeForKids: "no", syntheticMedia: "no" },
  { privacyStatus: "public", categoryId: "22", madeForKids: "true", syntheticMedia: "no" }]) {
  assert.equal(asScheduleYouTubeOptions(bad), null, JSON.stringify(bad));
}
console.log("ok YouTube options validated against the released publishing contract");
console.log("PASS v1 content schedule time and contracts");
