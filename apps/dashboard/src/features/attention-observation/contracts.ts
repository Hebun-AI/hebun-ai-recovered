/*
 * attention-observation/contracts.ts — ELAPSED TIME AS EVIDENCE, AND NOTHING ELSE (E2-4).
 *
 * ── WHAT THIS MODULE IS ──────────────────────────────────────────────────────
 *
 * Arithmetic over two instants, plus the vocabulary that keeps the result from being read as a
 * verdict. It owns no organizational fact, holds no table, opens no connection and reads nothing.
 * Every value it produces is derived from a timestamp an authority already wrote.
 *
 * ── THE ONE THING E2-4 MUST NEVER BECOME ─────────────────────────────────────
 *
 * The milestone is called Organizational Attention Observation, and that name is the trap. Naming
 * a thing "attention" is one short step from deciding what deserves it — and Hebun holds no
 * authority that could support such a decision. There is no policy owner, no SLA, no target, no
 * threshold and no definition of late anywhere in this repository.
 *
 *     AGE                != IMPORTANCE
 *     WAITING            != LATE
 *     OLD                != URGENT
 *     NO THRESHOLD IS A POLICY
 *     OBSERVATION        != DECISION
 *     OBSERVATION        != AUTHORIZATION
 *     OBSERVATION        != EXECUTION
 *
 * So the type below carries a duration and its basis, and deliberately carries no severity, no
 * class, no band, no colour and no flag. A representation that cannot express a judgement cannot
 * leak one — the same reason SIA-2's derived metrics carry a numerator and a denominator and
 * refuse to divide.
 *
 * ── EVERY DURATION NAMES THE COLUMN IT CAME FROM ─────────────────────────────
 *
 * {@link TimestampBasis} is a closed union of the exact authoritative columns E2-4 may read. It is
 * not decoration: `created_at` on a proposal means FILED, `issued_at` on a permit means AUTHORIZED,
 * `started_at` on an attempt means the attempt began, and `occurred_at` on the ledger means the act
 * happened. Collapsing any two into a generic "activity" would produce a number nobody could trace
 * back to a fact, which is the failure mode this whole milestone exists to avoid.
 *
 * No database import. Client-safe on purpose, exactly as SIA-1's and SIA-3's contracts are.
 */

/* ═══════════════════════════════════════════════════════════════════════════
 * 1. WHICH TIMESTAMPS E2-4 MAY READ, AND WHAT EACH ONE MEANS
 * ═════════════════════════════════════════════════════════════════════════ */

/**
 * The closed set of authoritative timestamps this milestone derives from.
 *
 * Each entry names ONE column on ONE table owned by ONE released authority. A basis that is not in
 * this union cannot be constructed, so a future edit cannot quietly widen what "elapsed" is
 * measured from without changing this list and failing its test.
 */
export type TimestampBasis =
  /** `heby_action_requests.created_at` — when a proposal was FILED. Never when it was decided. */
  | "action-request.created_at"
  /**
   * `heby_action_requests.approved_at` — when a proposal was APPROVED.
   *
   * Non-null exactly when `status = 'approved'`, enforced by the released
   * `heby_action_requests_approved_chk`: approval, its decision, its actor and its instant move
   * together or not at all. So a duration measured from it is never an inference.
   */
  | "action-request.approved_at"
  /** `action_permits.issued_at` — when authorization was granted. Never when it was used. */
  | "action-permit.issued_at"
  /** `action_permits.expires_at` — the authoritative expiry the permit itself carries. */
  | "action-permit.expires_at"
  /** `audit_log.occurred_at` — when a recorded governed act happened. */
  | "audit-log.occurred_at"
  /**
   * `knowledge_nodes.created_at` — when a Knowledge VERSION was authored.
   *
   * It is the version's own authoring instant, and the duration measured from it is only
   * meaningful next to the separate fact that no Governance decision names that version. Neither
   * half is a claim on its own: a version authored long ago that was decided yesterday produces no
   * observation at all, because it is not in the population.
   */
  | "knowledge-node.created_at";

export const TIMESTAMP_BASES: readonly TimestampBasis[] = Object.freeze([
  "action-request.created_at",
  "action-request.approved_at",
  "action-permit.issued_at",
  "action-permit.expires_at",
  "audit-log.occurred_at",
  "knowledge-node.created_at",
]);

/**
 * What each basis MEANS and what it must never be read as.
 *
 * Frozen for the reason SIA-1's stage ladder is frozen: an edit that widens a meaning has to widen
 * this record, where a test is watching.
 */
export const TIMESTAMP_BASIS_MEANING: Readonly<
  Record<TimestampBasis, { readonly means: string; readonly doesNotMean: string }>
> = Object.freeze({
  "action-request.created_at": {
    means: "when this proposal was filed",
    doesNotMean:
      "when it was decided, approved, rejected or acted on — the decision instants are separate " +
      "columns, and reading filing time as decision time is the collapse this union exists to stop",
  },
  "action-request.approved_at": {
    means: "when a Governance decision approved this proposal",
    doesNotMean:
      "when it was executed, or that it ever was — approval authorizes an act, it does not perform one",
  },
  "action-permit.issued_at": {
    means: "when a Governance decision authorized this action",
    doesNotMean: "when it was executed, or that it ever was",
  },
  "action-permit.expires_at": {
    means: "the bounded lifetime the permit itself carries",
    doesNotMean: "a deadline anybody must meet — an unspent permit simply expires having caused nothing",
  },
  "audit-log.occurred_at": {
    means: "when a governed act Hebun recorded happened",
    doesNotMean: "when the organization last did something — Hebun records some acts and not others",
  },
  "knowledge-node.created_at": {
    means:
      "this Knowledge version has had no Governance decision naming it for this elapsed duration",
    doesNotMean:
      "that it is urgent, important, a priority, overdue, late, stalled, critical, risky or an SLA " +
      "breach; that it should be approved or should be rejected; that it is unread, or unreviewed " +
      "in any informal sense — a person may have read it a hundred times. It states one thing: no " +
      "ratify or reject decision names this exact version, and this much time has passed since the " +
      "version was authored",
  },
});

/* ═══════════════════════════════════════════════════════════════════════════
 * 2. THE OBSERVATION
 * ═════════════════════════════════════════════════════════════════════════ */

/**
 * One elapsed-time observation.
 *
 * NO SEVERITY FIELD EXISTS, and none may be added. There is no `urgent`, no `overdue`, no `level`,
 * no `state` and no `colour`, because Hebun holds no authority that could fill one truthfully.
 */
export interface ElapsedObservation {
  /** The authoritative column this duration was measured from. */
  readonly basis: TimestampBasis;
  /** The authoritative instant, carried unchanged so a reader can go and check it. */
  readonly instant: string;
  /** The evaluation instant. Injected by the caller, never taken from a hidden clock. */
  readonly evaluatedAt: string;
  /** Whole milliseconds. Always >= 0 — see {@link elapsedSince} for what a negative means. */
  readonly milliseconds: number;
  /** `3d 4h`, `4h 12m`, `12m 30s`, `under a minute`. A duration, never a judgement. */
  readonly label: string;
  /** Which direction the duration runs. Kept explicit so no consumer has to infer it. */
  readonly direction: "elapsed" | "remaining";
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 3. THE ARITHMETIC
 * ═════════════════════════════════════════════════════════════════════════ */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * A duration, in the two largest units that carry information.
 *
 * `3d 4h`, not `3d 4h 17m 3s`: the smaller units are noise at that scale and inventing them is the
 * false precision E2-4 is forbidden to introduce. Below a minute there is no useful pair at all, so
 * it says so in words rather than rendering a second count that will be stale before it is read.
 */
export function formatDuration(milliseconds: number): string {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return "";
  if (milliseconds < MINUTE) return "under a minute";
  const days = Math.floor(milliseconds / DAY);
  const hours = Math.floor((milliseconds % DAY) / HOUR);
  const minutes = Math.floor((milliseconds % HOUR) / MINUTE);
  const seconds = Math.floor((milliseconds % MINUTE) / 1000);
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

/** Whole milliseconds from an ISO string, or `null` when it is missing or unparseable. */
function instantOf(iso: string | null | undefined): number | null {
  if (typeof iso !== "string" || iso.trim() === "") return null;
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Time elapsed since an authoritative instant.
 *
 * ── A FUTURE TIMESTAMP RETURNS `null`, AND THAT IS THE CONTRACT ──────────────
 *
 * A proposal filed in the future is inconsistent data, not a negative age. Rendering `-4h` would
 * ask a reader to interpret a nonsense; clamping it to zero would state that it was filed just now,
 * which is a claim. Returning `null` means "no elapsed observation is available for this record",
 * and every consumer already has to handle that case because a timestamp can also be missing.
 *
 *     UNAVAILABLE != ZERO DURATION
 *
 * `evaluatedAt` is a required parameter, never a hidden `Date.now()`. The whole read must share one
 * instant, and a test must be able to pin it.
 */
export function elapsedSince(
  instant: string | null | undefined,
  evaluatedAt: string,
  basis: TimestampBasis,
): ElapsedObservation | null {
  const from = instantOf(instant);
  const at = instantOf(evaluatedAt);
  if (from === null || at === null) return null;
  const milliseconds = at - from;
  if (milliseconds < 0) return null;
  return {
    basis,
    instant: new Date(from).toISOString(),
    evaluatedAt: new Date(at).toISOString(),
    milliseconds,
    label: formatDuration(milliseconds),
    direction: "elapsed",
  };
}

/**
 * Time remaining until an authoritative deadline.
 *
 * A deadline already in the past returns `null` rather than a negative or a zero. The released
 * permit projection already derives `expired` from exactly that comparison and owns that statement;
 * a second module saying "expired 2h ago" in its own words would be a second answer to a question
 * that already has one.
 */
export function remainingUntil(
  deadline: string | null | undefined,
  evaluatedAt: string,
  basis: TimestampBasis,
): ElapsedObservation | null {
  const until = instantOf(deadline);
  const at = instantOf(evaluatedAt);
  if (until === null || at === null) return null;
  const milliseconds = until - at;
  if (milliseconds < 0) return null;
  return {
    basis,
    instant: new Date(until).toISOString(),
    evaluatedAt: new Date(at).toISOString(),
    milliseconds,
    label: formatDuration(milliseconds),
    direction: "remaining",
  };
}

/** The larger of two elapsed observations, `null`-safe. Used to derive an oldest, never a worst. */
export function longerOf(
  a: ElapsedObservation | null,
  b: ElapsedObservation | null,
): ElapsedObservation | null {
  if (a === null) return b;
  if (b === null) return a;
  return b.milliseconds > a.milliseconds ? b : a;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 4. THE SENTENCES THAT TRAVEL WITH EVERY DURATION
 * ═════════════════════════════════════════════════════════════════════════ */

/** What an elapsed figure IS, said rather than left for a reader to assume. */
export const ATTENTION_OBSERVATION_BASIS =
  "Every duration here is measured from a timestamp an authoritative subsystem already wrote, " +
  "against one evaluation instant shared by the whole reading. It is elapsed time and nothing " +
  "more: Hebun holds no target, no threshold and no definition of late, so no duration on this " +
  "surface is a judgement about whether something should have happened by now.";

/** The authority named on any attachment. E2-4 owns the arithmetic, never the records. */
export const ATTENTION_OBSERVATION_AUTHORITY = "Organizational Attention Observation";

/** What the whole milestone refuses to say. Rendered beside the numbers, never omitted. */
export const ATTENTION_NON_CLAIMS: readonly string[] = Object.freeze([
  "age is not importance — a proposal filed long ago is not thereby more worth approving",
  "waiting is not late — no target, deadline or service level exists for a human decision here",
  "an expiring permit is not a deadline — an unspent permit expires having caused nothing",
  "an elapsed figure is not a decision, an authorization or an execution",
  "a Knowledge version with no Governance decision is not thereby wrong, unread or in need of one",
]);

/**
 * Vocabulary E2-4 may not introduce, in any surface, sentence or field name.
 *
 * Each word encodes a judgement that would require a policy authority Hebun does not have. The ban
 * is enforced by test against the code this milestone produces — not against the whole repository,
 * because other subsystems legitimately use some of these words about things they DO own.
 */
export const FORBIDDEN_ATTENTION_VOCABULARY: readonly string[] = Object.freeze([
  "urgent",
  "urgency",
  "priority",
  "prioritise",
  "prioritize",
  "overdue",
  "late",
  "stalled",
  "stale",
  "critical",
  "severity",
  "escalate",
  "escalation",
  "sla",
  "threshold",
  "breach",
  "unhealthy",
  "healthy",
  "at risk",
  "attention required",
  "action required",
  "needs attention",
  "should be approved",
]);
