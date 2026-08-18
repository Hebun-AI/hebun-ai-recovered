/*
 * governance-activity/contracts.ts — the typed vocabulary of the R7.1 Governance Activity
 * Observation.
 *
 * ── THE CLAIM, STATED ONCE, IN CODE ──────────────────────────────────────────
 *
 * R7.1 makes exactly one claim:
 *
 *   "Hebun can show a tenant a derived view of the governance activity Hebun has
 *    durably recorded."
 *
 * Every field below exists to support that sentence and nothing wider. The subject of the sentence
 * is *what Hebun recorded* — not what the organization did, and never how well it did it.
 *
 * ── WHO OWNS WHAT ────────────────────────────────────────────────────────────
 *
 *   AUTHORITATIVE   `audit_log` — the append-only record of governance acts. It is written by the
 *                   seven `governance-audit/*.server.ts` writers and by nothing else, and no code
 *                   in this repository updates or deletes a row in it.
 *   DERIVED         everything in this file. A count over that ledger, recomputed on read.
 *
 * This module owns no table, no row, no cache and no state. Given the same ledger and the same
 * clock it returns the same view, which is what makes it impossible for it to disagree with
 * `audit_log` — the same property R6B's Company Understanding relies on.
 *
 * ── WHAT A COUNT IS, AND THE FOUR THINGS IT IS NOT ───────────────────────────
 *
 *   A count is not QUALITY.       Sixteen committed acts is not good governance.
 *   A count is not COMPLETENESS.  It is what Hebun recorded, not what the organization did.
 *   A count is not A RATE.        No window is exposed, so no per-period reading is available.
 *   A count is not A JUDGEMENT.   Nothing here scores, grades, ranks or recommends.
 *
 * These are not softening. Each blocks a specific misreading, and the surface repeats them.
 *
 * ── WHAT IS DELIBERATELY ABSENT ──────────────────────────────────────────────
 *
 * No score, no percentage, no confidence, no health, no maturity, no risk, no efficiency, no
 * bottleneck, no recommendation, no prediction, no causal claim, and no semantic grouping of
 * `action` values into categories. `action` is reported as the raw string the ledger holds; this
 * module classifies nothing, because classifying "knowledge.retract" as a negative act would be a
 * judgement Hebun cannot support. R6B settled the same point for coverage, and K4 settled the
 * deeper one: RATIFIED IS NOT TRUE.
 *
 * `previous_state` / `next_state` are deliberately NOT exposed. They are per-row payloads, an
 * aggregate has no honest place to put them, and no product requirement asks for them.
 *
 * Pure types. No React, no I/O, no database, no server, no provider, no model, no authority.
 */

/**
 * One `action` value the ledger holds, with how many rows carry it.
 *
 * `action` is a raw `text` column on `audit_log`, reported verbatim. It is NOT mapped to a label,
 * a category, a severity or a domain: the vocabulary belongs to the writers, and a reader that
 * regrouped it would be asserting a taxonomy no authority published.
 */
export interface GovernanceActionTally {
  readonly action: string;
  readonly count: number;
  /** The most recent `occurred_at` among the rows carrying this action. */
  readonly latestOccurredAt: string;
}

/**
 * One `result` value, with how many rows carry it.
 *
 * The values come from the `audit_result` enum (`committed` / `rejected` / `rolled-back`), but the
 * type is `string` on purpose: this module reports what the ledger recorded and interprets none of
 * it. A refusal is history, not a failure — `rejected` means a governed rule refused an act and
 * nothing changed, which is exactly what an append-only sink exists to preserve.
 */
export interface GovernanceResultTally {
  readonly result: string;
  readonly count: number;
}

/**
 * One `authority_source` value, with how many rows carry it.
 *
 * The column is NULLABLE, so `null` is a real bucket and is reported as one rather than dropped.
 * Dropping it would make the buckets sum to less than `totalRecordedActs` — a silent truncation,
 * which is the defect class R6B found in a bounded list read.
 */
export interface GovernanceAuthoritySourceTally {
  /** `null` when the ledger recorded the act without naming an authority source. */
  readonly authoritySource: string | null;
  readonly count: number;
}

/**
 * Simulated versus non-simulated recorded acts.
 *
 * `simulation` is `boolean NOT NULL default false` on `audit_log` — a real distinction the schema
 * represents, meaning "produced under a non-live posture, so no real effect occurred". Both counts
 * are always present, so a reader can see that none were simulated rather than having to infer it
 * from an absent field.
 */
export interface GovernanceSimulationTally {
  readonly simulatedCount: number;
  readonly nonSimulatedCount: number;
}

/**
 * The derived observation for ONE tenant.
 *
 * DERIVED, READ-ONLY, NON-AUTHORITATIVE, NON-PERSISTED. It is recomputed on every read from
 * `audit_log` and stored nowhere.
 */
export interface GovernanceActivityObservation {
  readonly tenantId: string;
  /** When this view was computed. From an injected clock — never read inside the projection. */
  readonly generatedAt: string;
  /** Every row the ledger holds for this tenant. The total the tallies below belong to. */
  readonly totalRecordedActs: number;
  /** The most recent `occurred_at` for this tenant, or `null` when nothing is recorded. */
  readonly latestOccurredAt: string | null;
  readonly actions: readonly GovernanceActionTally[];
  readonly results: readonly GovernanceResultTally[];
  readonly authoritySources: readonly GovernanceAuthoritySourceTally[];
  readonly simulation: GovernanceSimulationTally;
}

/**
 * Why an observation could not be produced. Fails closed rather than returning a partial view: a
 * count that silently omitted rows would read as "this is all that happened".
 */
export type GovernanceActivityUnavailable =
  | "no-authorized-tenant-context"
  | "persistence-not-configured"
  | "read-failed";

export type GovernanceActivityObservationResult =
  | { readonly status: "observed"; readonly observation: GovernanceActivityObservation }
  | {
      readonly status: "unavailable";
      readonly reason: GovernanceActivityUnavailable;
      readonly detail?: string;
    };

/**
 * The raw per-dimension tallies the authoritative read produces, before projection.
 *
 * `totalRecordedActs` is counted INDEPENDENTLY of `actions` — a `count(*)` over the same tenant
 * predicate, not a sum of the grouped rows. That redundancy is the point: it is what lets a test
 * prove the grouped rows are complete, and what makes an accidental `LIMIT` on the grouped query
 * fail loudly instead of quietly under-reporting.
 */
export interface GovernanceActivityTallies {
  readonly totalRecordedActs: number;
  readonly latestOccurredAt: Date | null;
  readonly simulatedCount: number;
  readonly nonSimulatedCount: number;
  readonly actions: readonly { readonly action: string; readonly count: number; readonly latestOccurredAt: Date }[];
  readonly results: readonly { readonly result: string; readonly count: number }[];
  readonly authoritySources: readonly {
    readonly authoritySource: string | null;
    readonly count: number;
  }[];
}

/**
 * WHAT R7.1 MAY AND MAY NOT SAY. Stated as a value so the boundary is testable, and so a later
 * phase cannot quietly widen it by editing prose.
 */
export const GOVERNANCE_ACTIVITY_BOUNDARY = Object.freeze({
  observesRecordedActs: true as const,
  observesOrganizationalOperations: false as const,
  producesJudgement: false as const,
  producesRecommendation: false as const,
  producesScore: false as const,
  usesModel: false as const,
  writesAnything: false as const,
  readsKnowledge: false as const,
  isPersisted: false as const,
  isAuthoritative: false as const,
  rationale:
    "R7.1 reports how many governance acts Hebun durably recorded for a tenant, grouped by the " +
    "ledger's own action, result and authority-source values. It observes acts Hebun recorded, " +
    "not organizational operations, and it never grades, scores, explains or recommends. " +
    "audit_log remains the sole authority for recorded acts; this view is derived and stored nowhere.",
});

/**
 * Vocabulary R7.1 must never introduce, held as a value so the contract test reads it rather than
 * restating it. A field named from this list would turn an observation into a verdict.
 */
export const FORBIDDEN_OBSERVATION_VOCABULARY: readonly string[] = Object.freeze([
  "score",
  "percent",
  "confidence",
  "health",
  "maturity",
  "risk",
  "efficiency",
  "performance",
  "quality",
  "bottleneck",
  "recommendation",
  "prediction",
  "grade",
  "rating",
  "rank",
  "benchmark",
  "insight",
  "anomaly",
  "severity",
]);
