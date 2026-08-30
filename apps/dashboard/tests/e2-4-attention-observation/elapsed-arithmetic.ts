/*
 * E2-4 — THE ARITHMETIC, AND THE FOUR THINGS IT REFUSES TO PRODUCE.
 *
 * Elapsed time is the easiest number in this repository to render dishonestly: a clamped negative
 * reads as "just now", a missing timestamp rendered as `0` reads as "no wait at all", and either
 * one is a claim Hebun did not measure. So most of this file is about what the primitive returns
 * when it CANNOT answer.
 *
 *     UNAVAILABLE != ZERO DURATION      FUTURE TIMESTAMP != NEGATIVE AGE
 *     AGE != IMPORTANCE                 WAITING != LATE
 *
 * Pure. No database, no network, no clock — every instant is a literal.
 */
import assert from "node:assert/strict";

import {
  ATTENTION_NON_CLAIMS,
  FORBIDDEN_ATTENTION_VOCABULARY,
  TIMESTAMP_BASES,
  TIMESTAMP_BASIS_MEANING,
  elapsedSince,
  formatDuration,
  longerOf,
  remainingUntil,
} from "../../src/features/attention-observation/contracts";

const AT = "2026-08-30T12:00:00.000Z";

/* ── 1. DETERMINISTIC ELAPSED, AGAINST A PINNED INSTANT ───────────────────── */
{
  const observed = elapsedSince("2026-08-27T08:00:00.000Z", AT, "action-request.created_at");
  assert.ok(observed, "a past instant must produce an observation");
  assert.equal(observed.milliseconds, 3 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000);
  assert.equal(observed.label, "3d 4h");
  assert.equal(observed.direction, "elapsed");
  assert.equal(observed.basis, "action-request.created_at");
  assert.equal(observed.evaluatedAt, AT, "the evaluation instant is carried, never hidden");
  assert.equal(observed.instant, "2026-08-27T08:00:00.000Z", "the authoritative instant is carried");

  /* Called twice with the same inputs it must produce the same answer. No hidden clock. */
  assert.deepEqual(
    elapsedSince("2026-08-27T08:00:00.000Z", AT, "action-request.created_at"),
    observed,
  );
}

/* ── 2. A FUTURE TIMESTAMP RETURNS null — NOT A NEGATIVE, NOT A ZERO ──────── */
{
  assert.equal(
    elapsedSince("2026-08-30T12:00:01.000Z", AT, "action-request.created_at"),
    null,
    "a proposal filed in the future is inconsistent data, not an age",
  );
  /* Exactly equal is a real zero and IS an observation: it happened at the evaluation instant. */
  const zero = elapsedSince(AT, AT, "action-request.created_at");
  assert.ok(zero);
  assert.equal(zero.milliseconds, 0);
}

/* ── 3. MISSING AND UNUSABLE INPUTS RETURN null ───────────────────────────── */
{
  for (const bad of [null, undefined, "", "   ", "not-a-date"]) {
    assert.equal(
      elapsedSince(bad, AT, "action-request.created_at"),
      null,
      `an unusable instant (${JSON.stringify(bad)}) must not become a duration`,
    );
  }
  assert.equal(elapsedSince(AT, "not-a-date", "action-request.created_at"), null);
}

/* ── 4. REMAINING: A PAST DEADLINE IS THE OWNER'S `expired`, NOT OUR "-2h" ── */
{
  const remaining = remainingUntil("2026-08-30T14:11:00.000Z", AT, "action-permit.expires_at");
  assert.ok(remaining);
  assert.equal(remaining.label, "2h 11m");
  assert.equal(remaining.direction, "remaining");
  assert.equal(
    remainingUntil("2026-08-30T11:59:59.000Z", AT, "action-permit.expires_at"),
    null,
    "an expiry already past is the permit projection's `expired`; E2-4 does not restate it",
  );
}

/* ── 5. FORMATTING BOUNDARIES, AND NO FALSE PRECISION ─────────────────────── */
{
  assert.equal(formatDuration(0), "under a minute");
  assert.equal(formatDuration(59_999), "under a minute");
  assert.equal(formatDuration(60_000), "1m");
  assert.equal(formatDuration(90_000), "1m 30s");
  assert.equal(formatDuration(3_600_000), "1h");
  assert.equal(formatDuration(3_660_000), "1h 1m");
  assert.equal(formatDuration(86_400_000), "1d");
  assert.equal(formatDuration(90_000_000), "1d 1h");
  assert.equal(formatDuration(-1), "", "a negative is not a duration");
  assert.equal(formatDuration(Number.NaN), "");
  /* TWO UNITS AT MOST. `3d 4h 17m 3s` is precision this milestone did not measure. */
  assert.equal(formatDuration(3 * 86_400_000 + 4 * 3_600_000 + 17 * 60_000 + 3_000), "3d 4h");
}

/* ── 6. `longerOf` PICKS AN OLDEST, AND IS null-SAFE ──────────────────────── */
{
  const older = elapsedSince("2026-08-20T12:00:00.000Z", AT, "action-request.created_at");
  const newer = elapsedSince("2026-08-29T12:00:00.000Z", AT, "action-request.created_at");
  assert.equal(longerOf(older, newer), older);
  assert.equal(longerOf(newer, older), older);
  assert.equal(longerOf(null, newer), newer);
  assert.equal(longerOf(older, null), older);
  assert.equal(longerOf(null, null), null);
}

/* ── 7. THE OBSERVATION CARRIES NO JUDGEMENT FIELD, AND MAY NOT GAIN ONE ──── */
{
  const observed = elapsedSince("2026-08-29T12:00:00.000Z", AT, "audit-log.occurred_at");
  assert.ok(observed);
  assert.deepEqual(
    Object.keys(observed).sort(),
    ["basis", "direction", "evaluatedAt", "instant", "label", "milliseconds"],
    "an added severity/priority/level field would be a classification E2-4 has no authority for",
  );
}

/* ── 8. EVERY BASIS NAMES ONE COLUMN AND STATES WHAT IT IS NOT ────────────── */
{
  assert.equal(TIMESTAMP_BASES.length, 5);
  assert.deepEqual(
    [...TIMESTAMP_BASES].sort(),
    [
      "action-permit.expires_at",
      "action-permit.issued_at",
      "action-request.approved_at",
      "action-request.created_at",
      "audit-log.occurred_at",
    ],
    "the basis union is CLOSED — widening it must be a deliberate edit here",
  );
  for (const basis of TIMESTAMP_BASES) {
    const meaning = TIMESTAMP_BASIS_MEANING[basis];
    assert.ok(meaning.means.length > 0, `${basis} must state what it means`);
    assert.ok(meaning.doesNotMean.length > 0, `${basis} must state what it does NOT mean`);
    assert.ok(basis.includes("."), "every basis names a table and a column");
  }
  /* THE SEMANTIC COLLAPSE THIS MILESTONE MUST NEVER MAKE. */
  assert.match(
    TIMESTAMP_BASIS_MEANING["action-request.created_at"].doesNotMean,
    /decided|approved/i,
    "`created_at` on a proposal must never be readable as a decision time",
  );
}

/* ── 9. THE NON-CLAIMS EXIST AND SAY THE THREE THINGS ─────────────────────── */
{
  assert.ok(ATTENTION_NON_CLAIMS.length >= 4);
  const joined = ATTENTION_NON_CLAIMS.join(" ").toLowerCase();
  assert.match(joined, /age is not importance/);
  assert.match(joined, /waiting is not late/);
  assert.ok(FORBIDDEN_ATTENTION_VOCABULARY.includes("urgent"));
  assert.ok(FORBIDDEN_ATTENTION_VOCABULARY.includes("overdue"));
  assert.ok(FORBIDDEN_ATTENTION_VOCABULARY.includes("threshold"));
  assert.ok(FORBIDDEN_ATTENTION_VOCABULARY.includes("sla"));
}

console.log("E2-4 elapsed arithmetic: OK");
