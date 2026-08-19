/*
 * heby-stream/activity-stream.ts — G7. What the Heby canvas's contextual rail ("Hebun Akışı") is
 * allowed to say.
 *
 * ── THE RULE THIS MODULE EXISTS TO ENFORCE ──────────────────────────────────
 *
 * The rail may render ONLY items projected from a record an authoritative read seam actually
 * returned. It performs no read of its own, derives no state, and has no branch that can produce an
 * item without a row behind it. Every field of every item is copied from that row.
 *
 * That is a constraint on the CODE, not a promise about the copy. There is no code path here that
 * takes a count, a status, a threshold or a guess and turns it into a rail entry, so the rail
 * cannot be populated with activity the organization did not record — not by a future edit that
 * "just adds a placeholder", because a placeholder has no row to project from.
 *
 * ── WHY IT IS SO NEARLY EMPTY, AND WHY THAT IS THE CORRECT RESULT ───────────
 *
 * The design reference shows a busy stream: a document upload, a Governance approval, a completed
 * analysis, a finished task, a detected sales trend. Measured against this repository, four of
 * those five have no read seam of any kind, and the fifth is not an event:
 *
 *   document upload      Knowledge exposes RECORDS, not ingestion events. There is no upload
 *                        stream to read.
 *   Governance approval  `audit_log` holds real rows, but R7.1 built TALLIES over it and no
 *                        per-event read. A count is not an event and must never be dressed as one.
 *   completed analysis   Heby performs no analysis. Model synthesis is not activated.
 *   completed task       there is no task runtime and there are no task records.
 *   sales signal         there is no signal detection and nothing computes a trend or a percentage.
 *
 * What IS real, per-item, tenant-scoped and timestamped is the queue of actions awaiting a human
 * decision (R3A). So that is what the rail carries. For a tenant with none, the rail is empty — and
 * an empty rail says "Hebun has recorded nothing to show here", which is true, rather than
 * "nothing happened", which Hebun cannot know.
 *
 * ── TIME IS COPIED, NEVER COMPUTED ──────────────────────────────────────────
 *
 * The stored instant is carried through as-is and formatted by pure string slicing of its own ISO
 * text. No `Date.now()`, no relative phrasing, no locale. "3 minutes ago" would be a claim computed
 * against a clock the record never carried, it would differ between the server render and the
 * client render, and it would keep silently changing while nothing about the record did.
 *
 * Pure. No React, no DOM, no database, no clock.
 */

/** One rail entry. Every field is copied from a row; none is derived, inferred or defaulted. */
export interface HebyStreamItem {
  /** React key only. Never rendered. */
  readonly key: string;
  /**
   * Which read seam produced this. Rendered verbatim as a quiet label, never mapped to a friendlier
   * word and never grouped into a category — R7.1 settled that classifying a record asserts a
   * taxonomy no authority published.
   */
  readonly kind: "pending-authorization";
  /** What the record is. Copied. */
  readonly label: string;
  /** One short line the record itself carries. Copied. */
  readonly detail: string;
  /** The stored instant, ISO-8601, exactly as the read returned it. */
  readonly at: string;
  /** Where the reader goes to act on it. A fixed in-app route, never a record-supplied URL. */
  readonly href: string;
}

/**
 * Why the rail has nothing to show. Three DIFFERENT facts, kept apart on purpose — "you have no
 * pending decisions" and "Hebun could not read them" must never render as the same sentence.
 */
export type HebyStreamState =
  | { readonly status: "items"; readonly items: readonly HebyStreamItem[] }
  | { readonly status: "empty" }
  | { readonly status: "unavailable"; readonly reason: string };

/** The minimal shape of a pending request this projection reads. A subset of R3A's own view. */
export interface PendingRequestRow {
  readonly requestId: string;
  readonly actionKind: string;
  readonly targetLabel: string | null;
  readonly targetRef: string | null;
  readonly expectedEffect: string;
  readonly proposedAt: string;
}

/** The one route a rail item may point at. Fixed here so no row can influence navigation. */
const APPROVALS_ROUTE = "/approvals";

/**
 * Pending action requests → rail items.
 *
 * `expectedEffect` is the record's own sentence about what the action would do; it is shown because
 * it is the only line that tells the reader what they are being asked to decide. `actionKind` is
 * printed verbatim for the reason above. A request with no target renders WITHOUT one rather than
 * with a placeholder, so an absent target stays visibly absent.
 */
export function toStreamItems(rows: readonly PendingRequestRow[]): readonly HebyStreamItem[] {
  return rows.map((row) => ({
    key: row.requestId,
    kind: "pending-authorization" as const,
    label: row.targetLabel ?? row.actionKind,
    detail: row.expectedEffect,
    at: row.proposedAt,
    href: APPROVALS_ROUTE,
  }));
}

/**
 * The stored instant, rendered from its own text.
 *
 * Deliberately a SLICE of the ISO string rather than a `Date` or an `Intl` format: it is identical
 * on the server and in the browser (so hydration cannot disagree), it introduces no clock, and it
 * is explicit about being UTC rather than silently implying the reader's own zone. A value that is
 * not ISO-shaped is returned untouched — inventing a formatting for an unexpected string would be
 * asserting something about a value this module does not understand.
 */
export function formatStreamInstant(iso: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(iso);
  if (!match) return iso;
  return `${match[1]} ${match[2]} UTC`;
}
