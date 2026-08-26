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

/* ═══════════════════════════════════════════════════════════════════════════
 * R7.1.1 — THE RECORDED ACT DRILL-THROUGH
 *
 * R7.1 answered "how many acts, of which kinds?" and named its own gap: "No drill-through. The
 * counts do not link to the individual acts behind them." This is that drill-through, and it is
 * deliberately the SAME claim at a finer grain — not a wider one:
 *
 *   "Hebun can show a tenant a bounded, ordered view of the acts Hebun has durably recorded."
 *
 * ── IT IS NOT AN INTRUSION LOG, AND THAT IS A PROPERTY OF THE WRITERS ────────
 *
 * `audit_log` records what AUTHORIZED actors did. Unauthenticated and forbidden attempts are not
 * written to it at all — `KNOWLEDGE_AUDIT_BOUNDARY` already states that cost. So no reading of this
 * ledger can show an attack, an intrusion, a breach, a threat or a failed break-in, because the
 * rows that would evidence one were never recorded. That is a limit of the SOURCE, which no reader
 * can lift, and the surface says so rather than letting a reader infer completeness.
 *
 * ── WHY SO FEW FIELDS ────────────────────────────────────────────────────────
 *
 * `audit_log` carries three `jsonb` columns — `previous_state`, `next_state` and `metadata` — whose
 * shape differs per writer (nine writers, nine typed metadata interfaces). Serializing a union of
 * nine shapes to a reader would be shipping arbitrary JSON whose contents no single contract
 * governs, so NONE of the three is exposed. Omission, not heuristic sanitizing: a redactor for
 * payloads you do not control is a guess, and a guess in this position is a leak waiting for a
 * tenth writer.
 *
 * The identifiers are withheld for the same reason a narrower surface is a safer one:
 * `entity_id`, `actor_id`, `correlation_id`, `causation_id`, `request_id`, `session_context_id`
 * and `principal_reference_hash` answer no question a chronology asks, and each is one more handle
 * for correlating a person across acts.
 *
 * What remains is either a database ENUM (`actor_type`, `result`), a CHECK-constrained value
 * (`authority_source`), a timestamp, or a closed compile-time constant written by the audit writers
 * (`action`, `entity_type`, `source`). No field below can carry text a user typed.
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * How many acts one read may return. Default AND hard maximum — deliberately one number.
 *
 * A caller cannot raise it, because there is no parameter to raise: a bound the client can widen is
 * not a bound. There is no pagination and no cursor, because no product surface asks to walk the
 * ledger, and R6B's lesson is that a read seam's BOUND is part of its meaning — a bound invented
 * ahead of a requirement acquires a meaning nobody chose.
 */
export const RECORDED_ACT_PAGE_LIMIT = 20 as const;

/**
 * One recorded act, in the only shape Hebun will show.
 *
 * Every field is reported VERBATIM from the ledger. Nothing here is mapped to a friendlier label,
 * grouped into a category, or scored — the vocabulary belongs to the writers, exactly as R7.1
 * settled for `action`.
 */
export interface RecordedAct {
  /** Logical time of the act, ISO-8601. The ordering key. */
  readonly occurredAt: string;
  /** The writer's own verb, e.g. `knowledge.ratify`. Never reinterpreted. */
  readonly action: string;
  /** What kind of thing the act was about, e.g. `knowledge_fact`. Never the id of one. */
  readonly entityType: string;
  /** From the `actor_type` enum. A KIND of actor — never which person. */
  readonly actorType: string;
  /** From the `audit_result` enum. A `rejected` row is history, not a failure. */
  readonly result: string;
  /** Which subsystem recorded it, e.g. `governance-authority`. Null when unrecorded. */
  readonly source: string | null;
  /** CHECK-constrained to four values, and nullable — `null` is reported, never hidden. */
  readonly authoritySource: string | null;
  /** True when recorded under a non-live posture, so no real effect occurred. */
  readonly simulation: boolean;
}

/**
 * A bounded page of acts, and the total it was drawn from.
 *
 * `totalRecordedActs` is counted INDEPENDENTLY, with no bound, over the same tenant predicate —
 * never inferred from `acts.length`. That redundancy is the whole safety property: it is what lets
 * the surface say "showing 20 of 137" instead of showing 20 and letting a reader believe that is
 * all that ever happened. A bounded list that cannot name its own total is a silent completeness
 * claim, which is the defect R6B found and the one this field exists to make impossible.
 */
export interface RecordedActPage {
  readonly acts: readonly RecordedAct[];
  readonly totalRecordedActs: number;
  /** True when the ledger holds more acts than this page shows. Derived, never guessed. */
  readonly truncated: boolean;
}

/**
 * The result of asking for one tenant's recorded act history.
 *
 * THE THREE OUTCOMES ARE KEPT APART ON PURPOSE, and collapsing any two is the failure this phase
 * exists to prevent:
 *
 *   `recorded`     the ledger holds acts for this tenant, and here is a bounded, ordered page.
 *   `empty`        the ledger was READ SUCCESSFULLY and holds nothing for this tenant. An
 *                  established fact about the organization.
 *   `unavailable`  the ledger could not be read. NOT the same as empty — "nothing was recorded"
 *                  and "Hebun could not look" are different sentences, and a read failure rendered
 *                  as an empty history would be Hebun asserting an organizational fact it never
 *                  established. Fails closed, exactly as R7.1's observation does.
 */
export type RecordedActHistoryResult =
  | {
      readonly status: "recorded";
      readonly tenantId: string;
      readonly generatedAt: string;
      readonly page: RecordedActPage;
    }
  | { readonly status: "empty"; readonly tenantId: string; readonly generatedAt: string }
  | {
      readonly status: "unavailable";
      readonly reason: GovernanceActivityUnavailable;
      readonly detail?: string;
    };

/**
 * WHAT THE DRILL-THROUGH MAY AND MAY NOT SAY. A value, so the boundary is testable rather than
 * merely written down, and so a later phase cannot widen it by editing prose.
 */
export const RECORDED_ACT_HISTORY_BOUNDARY = Object.freeze({
  showsRecordedActs: true as const,
  statesItsOwnBound: true as const,
  /* The source cannot evidence these, so no reader of it may claim them. */
  showsIntrusionAttempts: false as const,
  showsSecurityIncidents: false as const,
  showsThreats: false as const,
  showsProviderHistory: false as const,
  showsExecutionHistory: false as const,
  claimsForensicCompleteness: false as const,
  claimsAllOrganizationalActivity: false as const,
  /* Shape and authority. */
  exposesJsonPayloads: false as const,
  exposesEntityIdentifiers: false as const,
  usesModel: false as const,
  writesAnything: false as const,
  isPersisted: false as const,
  isAuthoritative: false as const,
  rationale:
    "R7.1.1 shows a bounded, ordered page of the acts Hebun durably recorded for one tenant, and " +
    "states the total it was drawn from. audit_log remains the sole authority and its writers " +
    "remain its only writers. It records what authorized actors did, so it can evidence no " +
    "intrusion, incident or threat, and this view claims none. No jsonb payload and no entity or " +
    "actor identifier is exposed. Nothing is interpreted by a model and nothing is stored.",
});

/**
 * Fields of `audit_log` that this seam must NEVER select. Held as a value so the firewall reads it
 * instead of restating it, and so deleting a name from this list is a visible act.
 */
export const WITHHELD_AUDIT_COLUMNS: readonly string[] = Object.freeze([
  "previousState",
  "nextState",
  "metadata",
  "entityId",
  "actorId",
  "correlationId",
  "causationId",
  "requestId",
  "sessionContextId",
  "principalReferenceHash",
]);
