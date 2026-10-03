/*
 * knowledge-retrieval/eligibility.ts — the gate that decides what MAY be served (KR3).
 *
 * ── ELIGIBILITY IS NOT RELEVANCE, AND IT IS NOT A RANKING SIGNAL ─────────────
 *
 * A relevance score measures text overlap. It is completely blind to whether a record is still in
 * force. KR2 measured what that costs: with ranking alone, 6 of 46 benchmark questions served an
 * expired, not-yet-effective, or archived record inside the top five, and a superseded version of a
 * leave policy ranked at score 1.00 against the current version's 1.20 — lexically indistinguishable.
 *
 * So being out of force is not a penalty. It is disqualification. A penalty would let a strong
 * textual match drag a withdrawn policy into an answer, and no weight is small enough to make that
 * acceptable.
 *
 * ── WHAT IS DELIBERATELY *NOT* FILTERED, AND WHY ─────────────────────────────
 *
 * provisional · draft · proposed · under-review · unratified · contested · stale ·
 * textOriginUnverified
 *
 * All of these REMAIN ELIGIBLE and travel with their standing attached. Two measured reasons:
 *
 *   Filtering on `ratified` would return NOTHING — the canonical database holds zero ratified rows,
 *   because ratification requires a Governance decision and few have been made.
 *   Filtering on `textOriginUnverified` would empty the corpus — it is `true` on every record that
 *   K2 authoring and Knowledge ingestion write.
 *
 * A retrieval that answers "nothing found" because the organization has not finished ratifying its
 * own knowledge would be worse than useless; it would be false. Standing is reported, never used to
 * hide a record.
 *
 * `deprecated` also remains eligible: it is a warning about a record, not a withdrawal of it. Only
 * `archived` and `retired` are terminal.
 *
 * SUPERSEDED needs no rule here. A superseded node is not its fact's active node, and the repository
 * join is on `active_knowledge_node_id`, so a superseded version is not merely filtered — it is
 * unrepresentable as a candidate. That structural exclusion predates KR3 and is not weakened by it.
 *
 * ── GOVERNANCE-REJECTED IS DISQUALIFIED TOO (KT-1) ───────────────────────────
 *
 * A version Governance rejected is not served. `unratified` still is — nobody has decided about it
 * — but a rejection is a decision that this exact version is NOT the organization's approved
 * statement, and a retrieval that kept serving it would answer with what Governance declined.
 *
 * The rejection is not a Knowledge fact: K4 writes nothing to Knowledge for a reject, by design. So
 * the set of rejected version ids is SUPPLIED, exactly as `now` is — read by the caller from
 * Governance's own projection. This gate does not know what a decision record is.
 *
 * Pure. No I/O, no database, no clock of its own — `now` and the rejected set are always supplied.
 */

import type { KnowledgeSourceRecord } from "@/features/knowledge/contracts";
import type { RetrievalExclusion, RetrievalExclusionReason } from "./contracts";

/** Lifecycle standings that withdraw a record from service entirely. */
const TERMINAL_LIFECYCLE: ReadonlySet<string> = new Set(["archived", "retired"]);

/**
 * Why this record may not be served, or `null` when it may.
 *
 * Order is deliberate: lifecycle first, because "this policy was retired" is a more useful thing to
 * tell someone than "this policy expired", and a retired record's dates are often stale anyway.
 * Governance's rejection comes next: it is a standing fact about this exact version, where the
 * effective window is only a statement about dates.
 */
export function exclusionReasonFor(
  record: KnowledgeSourceRecord,
  now: Date,
  rejectedNodeIds: ReadonlySet<string>,
): RetrievalExclusionReason | null {
  const lifecycle = record.lifecycleStatus;
  if (lifecycle === "archived") return "lifecycle-archived";
  if (lifecycle === "retired") return "lifecycle-retired";
  if (lifecycle !== null && TERMINAL_LIFECYCLE.has(lifecycle)) return "lifecycle-archived";

  /*
   * Keyed on the version ROW. A superseding version is a different row with a different id, so a
   * rejection can never follow a fact to its successor.
   */
  const nodeId = record.activeKnowledgeNodeId;
  if (nodeId !== null && rejectedNodeIds.has(nodeId)) return "governance-rejected";

  const at = now.getTime();

  /*
   * The effective window is checked ONLY where the record states one. A record with no dates is not
   * "effective forever" by assertion — it simply makes no claim about a window, and inventing one
   * would be the same fabrication the freshness derivation refuses to commit.
   */
  const from = parseTimestamp(record.effectiveFrom);
  if (from !== null && from > at) return "not-yet-effective";

  const until = parseTimestamp(record.effectiveUntil);
  if (until !== null && until < at) return "expired";

  return null;
}

function parseTimestamp(value: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export function isEligible(
  record: KnowledgeSourceRecord,
  now: Date,
  rejectedNodeIds: ReadonlySet<string>,
): boolean {
  return exclusionReasonFor(record, now, rejectedNodeIds) === null;
}

export interface EligibilityPartition {
  readonly eligible: readonly KnowledgeSourceRecord[];
  /** Records that MATCHED the question but are not in force, with the reason. Reported, never hidden. */
  readonly excluded: readonly RetrievalExclusion[];
}

/**
 * Split matched records into what may be served and what may not.
 *
 * The excluded list is returned rather than discarded because a silently missing answer is the worst
 * of the available outcomes: the operator sees an incomplete result and has no way to learn that the
 * policy they remember exists but was retired last quarter.
 */
export function partitionByEligibility(
  records: readonly KnowledgeSourceRecord[],
  now: Date,
  rejectedNodeIds: ReadonlySet<string>,
): EligibilityPartition {
  const eligible: KnowledgeSourceRecord[] = [];
  const excluded: RetrievalExclusion[] = [];

  for (const record of records) {
    const reason = exclusionReasonFor(record, now, rejectedNodeIds);
    if (reason === null) {
      eligible.push(record);
      continue;
    }
    excluded.push({ factKey: record.factKey, domainKey: record.domainKey, reason });
  }

  return { eligible, excluded };
}
