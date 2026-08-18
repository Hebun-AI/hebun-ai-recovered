/*
 * governance-activity/observation.ts — the pure R7.1 projection.
 *
 * Takes the tallies the authoritative read produced and the current time, and returns the view.
 * Performs NO I/O: no database client, no fetch, no provider, no model, no clock read. `generatedAt`
 * comes from an injected `now`, which is what makes the output deterministic — the same tallies and
 * the same clock always produce the same view, so it is testable without a database and cannot
 * drift from `audit_log`.
 *
 * It writes nothing and persists nothing. There is no cache here and no snapshot: the view is
 * recomputed on every read, because `audit_log` is append-only and a recomputation over an
 * immutable ledger can never be stale in a way a stored copy would not be worse.
 *
 * ── ORDERING IS PART OF THE CONTRACT ─────────────────────────────────────────
 *
 * Every list is totally ordered with an explicit tie-break, so two runs over the same tallies
 * produce byte-identical output. Ordering is presentational only — it ranks nothing. `actions` is
 * ordered by count purely so the longest list reads top-down; that is not a claim that a more
 * frequent action matters more.
 */

import type {
  GovernanceActionTally,
  GovernanceActivityObservation,
  GovernanceActivityTallies,
  GovernanceAuthoritySourceTally,
  GovernanceResultTally,
} from "./contracts";

/**
 * Compare two strings by code unit.
 *
 * Deliberately NOT `localeCompare`: a locale-aware comparison would order these action and result
 * keys differently under different runtimes, and a projection whose output depends on ambient
 * locale is not deterministic. These are machine keys, not display text.
 */
const byCodeUnit = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Count descending, then key ascending. The tie-break is what makes the order total. */
const byCountThenKey = <T>(key: (item: T) => string) =>
  (a: T & { count: number }, b: T & { count: number }): number =>
    b.count - a.count || byCodeUnit(key(a), key(b));

/**
 * Project the tenant's recorded governance activity.
 *
 * `tenantId` is carried through from the authorized read rather than re-derived here: this function
 * has no way to authorize anything, and it must never look like it does.
 */
export function projectGovernanceActivity(
  tenantId: string,
  tallies: GovernanceActivityTallies,
  now: Date,
): GovernanceActivityObservation {
  const actions: GovernanceActionTally[] = tallies.actions
    .map((tally) => ({
      action: tally.action,
      count: tally.count,
      latestOccurredAt: tally.latestOccurredAt.toISOString(),
    }))
    .sort(byCountThenKey<GovernanceActionTally>((item) => item.action));

  const results: GovernanceResultTally[] = tallies.results
    .map((tally) => ({ result: tally.result, count: tally.count }))
    .sort(byCountThenKey<GovernanceResultTally>((item) => item.result));

  const authoritySources: GovernanceAuthoritySourceTally[] = tallies.authoritySources
    .map((tally) => ({ authoritySource: tally.authoritySource, count: tally.count }))
    /*
     * `null` sorts last and is never dropped. An act the ledger recorded without naming an
     * authority source is still an act, and omitting its bucket would make these counts sum to
     * less than `totalRecordedActs` — the silent-truncation defect R6B found in a bounded read.
     */
    /* `null` last, by an explicit check — not by a high-code-point sentinel string. */
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      if (a.authoritySource === null) return b.authoritySource === null ? 0 : 1;
      if (b.authoritySource === null) return -1;
      return byCodeUnit(a.authoritySource, b.authoritySource);
    });

  return {
    tenantId,
    generatedAt: now.toISOString(),
    /*
     * Passed through from the INDEPENDENT `count(*)`, never summed from `actions`. Deriving it
     * from the grouped rows would make the two agree by construction and delete the only signal
     * that would expose a truncated grouping.
     */
    totalRecordedActs: tallies.totalRecordedActs,
    latestOccurredAt: tallies.latestOccurredAt?.toISOString() ?? null,
    actions,
    results,
    authoritySources,
    simulation: {
      simulatedCount: tallies.simulatedCount,
      nonSimulatedCount: tallies.nonSimulatedCount,
    },
  };
}

/**
 * The tallies of a tenant with nothing recorded.
 *
 * An honest zero, not an absence: `totalRecordedActs: 0` with empty lists says "Hebun recorded no
 * governance activity for this organization", which is a statement about Hebun's ledger and never
 * about the organization. No evidence is not negative evidence.
 */
export const EMPTY_GOVERNANCE_ACTIVITY_TALLIES: GovernanceActivityTallies = Object.freeze({
  totalRecordedActs: 0,
  latestOccurredAt: null,
  simulatedCount: 0,
  nonSimulatedCount: 0,
  actions: Object.freeze([]),
  results: Object.freeze([]),
  authoritySources: Object.freeze([]),
});

/**
 * Sum the grouped action counts.
 *
 * Exported because it is the completeness check: it must equal `totalRecordedActs`, which was
 * counted by a separate statement. A test asserts the equality, so an accidental bound on the
 * grouped query fails loudly instead of quietly under-reporting the ledger.
 */
export function sumActionCounts(observation: GovernanceActivityObservation): number {
  return observation.actions.reduce((total, tally) => total + tally.count, 0);
}
