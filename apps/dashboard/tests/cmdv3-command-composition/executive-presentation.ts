import assert from "node:assert/strict";

import {
  COMMAND_HERO_PRESENTATIONS,
  dailyPresentationIndex,
  firstNameOf,
  greetingForHour,
} from "../../src/features/command-overview/executive-presentation";

assert.equal(greetingForHour(4), "İyi geceler");
assert.equal(greetingForHour(5), "Günaydın");
assert.equal(greetingForHour(10), "Günaydın");
assert.equal(greetingForHour(11), "İyi günler");
assert.equal(greetingForHour(17), "İyi günler");
assert.equal(greetingForHour(18), "İyi akşamlar");
assert.equal(greetingForHour(22), "İyi akşamlar");
assert.equal(greetingForHour(23), "İyi geceler");

assert.equal(firstNameOf("  Şenol Sevim "), "Şenol");
assert.equal(firstNameOf(null), null);
assert.equal(firstNameOf("   "), null);

assert.equal(COMMAND_HERO_PRESENTATIONS.length, 3);
const first = dailyPresentationIndex("2026-09-13", COMMAND_HERO_PRESENTATIONS.length);
assert.equal(first, dailyPresentationIndex("2026-09-13", COMMAND_HERO_PRESENTATIONS.length));
assert.ok(first >= 0 && first < COMMAND_HERO_PRESENTATIONS.length);
assert.equal(dailyPresentationIndex("2026-09-13", 0), -1);

console.log("CMD-V3 visual presentation: local-time boundaries, safe first-name fallback, and daily manifest selection pass.");
