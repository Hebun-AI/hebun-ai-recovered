/*
 * decision-horizon/contracts.ts — the vocabulary, completeness rule and refusals of the UNIFIED
 * DIRECTOR DECISION HORIZON (DH-1).
 *
 * PURE. It holds no database handle, opens no connection, runs no query and exports no function
 * that touches one. It is deliberately NOT a `.server.ts` module so the read model, the projection,
 * the surface and the tests can all name one vocabulary without any of them importing a reader.
 *
 * ── WHAT THE HORIZON IS, IN ONE SENTENCE ─────────────────────────────────────
 *
 * "These are the things this organization has recorded as awaiting a human decision, gathered from
 *  every authority that owns one — and this is whether that gathering was complete."
 *
 * ── IT OWNS NOTHING, AND THAT IS THE WHOLE DESIGN ────────────────────────────
 *
 * Three released authorities already answer "what is waiting for me?" about their own subjects:
 *
 *   Action Authorization          consequential acts proposed and not yet decided
 *   Agent Improvement Hypothesis  hypotheses filed and not yet decided about
 *   Knowledge + Governance        current Knowledge versions Governance has not decided about
 *
 * Before this, a Director asking "what needs my decision?" got ONE of the three: `/approvals`
 * renders action requests alone, and Heby's `decision-records` class carried action requests alone.
 * The other two were reachable only from `/agents`, `/governance/authority`, and — for Knowledge —
 * as a COUNT inside the attention observation, with no item anywhere.
 *
 *     A SILENT OMISSION IS WORSE THAN AN ABSENCE. A horizon that answers "three things" while
 *     two authorities hold more is not incomplete; it is wrong.
 *
 * So this feature composes and NEVER acquires. It writes nothing, decides nothing, and holds no
 * table. Each block keeps the provenance of the authority that produced it, each item says which
 * authority owns it, and the decision itself is still taken on that authority's own surface.
 *
 *     THE HORIZON IS DERIVED.        EVERY ITEM IN IT IS AUTHORITATIVE TO ITS OWNER.
 *     COMPOSED != OWNED.             GATHERED != DECIDED.
 *
 * ── THE COMPLETENESS RULE ────────────────────────────────────────────────────
 *
 * The only sentence this feature exists to protect:
 *
 *     "NOTHING NEEDS YOUR DECISION" MAY BE SAID ONLY WHEN EVERY SOURCE ANSWERED
 *     AND EVERY ONE OF THEM ANSWERED WITH NOTHING.
 *
 * One unavailable source makes the horizon PARTIAL, and a partial horizon may never be reported as
 * empty — it must name which authority could not answer. The mirror of E2-4's rule, applied to a
 * union instead of a subtraction: an unreadable source must not make the queue look empty.
 */

/** The authorities a decision can be waiting on. Closed: an item with no source here cannot exist. */
export type DecisionSourceKey =
  /** Action Authorization — a consequential act proposed and not yet decided. */
  | "action-requests"
  /** Agent Improvement Hypothesis — filed, and nobody has answered yet. */
  | "improvement-hypotheses"
  /** Knowledge current versions MINUS the ones Governance has decided about. */
  | "knowledge-review";

export const DECISION_SOURCE_KEYS: readonly DecisionSourceKey[] = Object.freeze([
  "action-requests",
  "improvement-hypotheses",
  "knowledge-review",
]);

/**
 * WHO OWNS EACH SOURCE, and WHERE THE DECISION IS ACTUALLY TAKEN.
 *
 * The route matters as much as the owner: a horizon that gathers a decision and then cannot say
 * where to make it has moved the question without moving the answer. Every route below is a
 * released surface that already exists.
 */
export const DECISION_SOURCE_OWNERS: Readonly<
  Record<DecisionSourceKey, { readonly authority: string; readonly route: string; readonly subject: string }>
> = Object.freeze({
  "action-requests": Object.freeze({
    authority: "Action Authorization Authority",
    route: "/approvals",
    subject: "a consequential action proposed and not yet decided",
  }),
  "improvement-hypotheses": Object.freeze({
    authority: "Agent Improvement Hypothesis Authority",
    route: "/governance/authority",
    subject: "an improvement hypothesis filed and not yet decided about",
  }),
  "knowledge-review": Object.freeze({
    authority: "Knowledge, measured against Governance's own decision record",
    route: "/knowledge",
    subject: "a current Knowledge version Governance has recorded no decision about",
  }),
});

/**
 * Said when every source answered and every one of them answered with nothing.
 *
 * The ONLY sentence in this feature that may claim an absence, and the completeness rule above is
 * what guards it.
 */
export const HORIZON_EMPTY_STATEMENT =
  "Nothing is awaiting a human decision in this organization right now. Every source answered, and " +
  "each of them answered with nothing — this is a measured absence across all of them, not a " +
  "failed read and not a partial one.";

/** Said when at least one source could not answer. It names them rather than implying completeness. */
export function horizonPartialStatement(unavailable: readonly string[]): string {
  return (
    `THIS HORIZON IS PARTIAL. ${unavailable.length} of ${DECISION_SOURCE_KEYS.length} sources could ` +
    `not be read (${unavailable.join(", ")}), so what is shown is not everything that may be ` +
    "awaiting a decision. NOTHING HERE SAYS THOSE SOURCES HOLD NOTHING — only that Hebun could not " +
    "ask them."
  );
}

/**
 * The claims the horizon is FORBIDDEN from making, frozen so a test can read them and a surface can
 * render them rather than paraphrase them.
 */
export const HORIZON_NON_CLAIMS: readonly string[] = Object.freeze([
  "The horizon is composed, not owned: every item belongs to the authority that recorded it, and this feature records nothing.",
  "Gathering a decision is not taking one. Nothing here approves, rejects, ratifies, withdraws or authorizes anything.",
  "Items from different authorities are different KINDS of decision and are never merged into one queue, one count of equals, or one ranking.",
  "There is no priority, urgency, risk score, deadline or recommendation: no authority in Hebun owns any of them.",
  "A partial horizon is never an empty one, and a source that could not be read is never a source that holds nothing.",
  "Being listed says a decision has not been recorded — never that a decision is overdue, late, or expected.",
]);

/** The most items ONE source may contribute. A ceiling that declares itself, never a page size. */
export const MAX_HORIZON_ITEMS_PER_SOURCE = 25;
