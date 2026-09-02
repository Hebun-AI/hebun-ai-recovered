/*
 * decision-horizon/heby-decision-horizon-source.server.ts — the `decision-records` class, widened
 * from ONE authority to every authority that owns a human decision (DH-1).
 *
 * ── WHAT CHANGED, AND WHAT DELIBERATELY DID NOT ──────────────────────────────
 *
 * The class is unchanged: `decision-records` was chartered as decision PREPARATION material — the
 * question "what is waiting for a human?" — and was never chartered as "action requests". Its first
 * reader answered with action requests because that was the only authority connected at the time.
 * Two more were already released and answered the same question about their own subjects, and a
 * Director asking Heby "what needs my decision?" was getting one third of the answer with no
 * indication that two thirds were missing.
 *
 *     A SILENT OMISSION IS WORSE THAN AN ABSENCE.
 *
 * ── IT COMPOSES; IT DOES NOT ACQUIRE ─────────────────────────────────────────
 *
 * The action half is obtained from THE RELEASED QUEUE PROJECTION, unchanged and unbypassed. That
 * projection carries the effect, the target, the side effect, the reversibility, the recorded
 * consequences, the evidence state and the proposer — far more than a horizon row holds — and
 * re-deriving any of it here would be a second interpreter of Action Authorization's own records.
 * So its items travel VERBATIM, carrying its own non-claim with them.
 *
 * The other two halves come from the horizon read model, asked for exactly those two sources.
 *
 *     COMPOSED != OWNED.      GATHERED != DECIDED.      PER-ITEM PROVENANCE SURVIVES.
 *
 * ── THE ONE SENTENCE THIS FILE EXISTS TO PROTECT ─────────────────────────────
 *
 *     "NOTHING NEEDS YOUR DECISION" IS SAID ONLY WHEN ALL THREE SOURCES ANSWERED
 *     AND ALL THREE ANSWERED WITH NOTHING.
 *
 * Anything else is PARTIAL, and a partial horizon names which authority could not answer. Telling a
 * Director that nothing is waiting during an outage is the most expensive sentence this class can
 * get wrong, because they act on it by doing nothing — and it is now three times easier to get
 * wrong than it was with one source.
 *
 * ── READ-ONLY, AND PROVABLY ──────────────────────────────────────────────────
 *
 * No insert, no update, no delete, no transaction, no database handle, no table. It imports read
 * seams and one released projection, and holds no decision writer of any kind — `decideActionRequest`,
 * the ratification writer and the hypothesis filer are all absent from its import graph.
 *
 *     HEBY READS THE HORIZON != HEBY CAN DECIDE ANYTHING IN IT
 *
 * Server-only.
 */
import type { ResolvedSourceItem, SourceResolution } from "@/features/heby-runtime/contracts";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { readDecisionQueueGroundingSource } from "@/features/action-authorization/heby-decision-queue-source.server";
import {
  readDecisionHorizon,
  type DecisionHorizon,
  type HorizonBlock,
} from "./read-decision-horizon.server";
import {
  DECISION_SOURCE_OWNERS,
  HORIZON_EMPTY_STATEMENT,
  HORIZON_NON_CLAIMS,
  horizonPartialStatement,
  type DecisionSourceKey,
} from "./contracts";

/** The sources this projection reads through the horizon model. The third comes from its own. */
const COMPOSED_SOURCES: readonly DecisionSourceKey[] = Object.freeze([
  "improvement-hypotheses",
  "knowledge-review",
]);

/** Named for what it is, and for what it is not. */
export const DECISION_HORIZON_PROVENANCE =
  "The Decision Horizon — everything this organization has recorded as AWAITING A HUMAN DECISION, " +
  "gathered from the three authorities that each own one, read tenant-scoped from the session and " +
  "authoritative (authoritative: true). IT IS COMPOSED, NOT OWNED: Action Authorization owns the " +
  "proposed consequential actions, the Agent Improvement Hypothesis authority owns the filed " +
  "hypotheses, and Knowledge measured against Governance's own decision record owns the current " +
  "versions nobody has decided about. Every item says which authority owns it and where the " +
  "decision is actually taken; nothing here approves, rejects, ratifies or authorizes anything. " +
  "THESE ARE DIFFERENT KINDS OF DECISION and are never merged into one queue, one ranking or one " +
  "count of equals. There is no priority, urgency, risk score or deadline, because no authority in " +
  "Hebun owns any of them. AND THE HORIZON STATES WHETHER IT IS COMPLETE: if any source could not " +
  "be read it says so and names it, and nothing may be concluded about what that source holds.";

/** The refusal carried on every horizon item, held as its own constant so a test can pin it. */
export const DECISION_HORIZON_NON_CLAIM =
  "This is RECORDED as awaiting a decision. It is not a statement that the decision is overdue, " +
  "expected, or more important than anything else here, and Hebun has taken no part in it.";

export interface DecisionHorizonGroundingDeps {
  readonly readQueue?: typeof readDecisionQueueGroundingSource;
  readonly readHorizon?: typeof readDecisionHorizon;
}

function base(
  state: SourceResolution["state"],
  items: readonly ResolvedSourceItem[],
  unavailableReason?: string,
): SourceResolution {
  return {
    sourceClass: "decision-records",
    state,
    provenance: DECISION_HORIZON_PROVENANCE,
    /*
     * TRUE, unchanged from the single-source reader. Every item cited is a STORED property of a row
     * a released authority wrote. `authoritative` describes WHOSE RECORDS THESE ARE — and the
     * provenance carries the half it cannot: that the gathering itself is derived, and may be
     * partial.
     */
    authoritative: true,
    items,
    ...(unavailableReason === undefined ? {} : { unavailableReason }),
  };
}

/** One composed item, carrying its owner and the route where the decision is actually taken. */
function horizonItem(source: DecisionSourceKey, recordId: string, label: string, recordedAt: string | null): ResolvedSourceItem {
  const owner = DECISION_SOURCE_OWNERS[source];
  return {
    recordRef: `${source}/${recordId}`,
    label: `${label} — awaiting a human decision`,
    detail:
      `${owner.authority} records this as ${owner.subject}. Recorded ${recordedAt ?? "at an unrecorded time"}. ` +
      `The decision is taken at ${owner.route}, never here. ${DECISION_HORIZON_NON_CLAIM}`,
    lifecycle: "settled",
  };
}

/** A source that could not answer, said out loud as its own item so a model cannot miss it. */
function unavailableItem(block: Extract<HorizonBlock, { status: "unavailable" }>): ResolvedSourceItem {
  const owner = DECISION_SOURCE_OWNERS[block.source];
  return {
    recordRef: `${block.source}:unavailable`,
    label: `${owner.authority} could not be read`,
    detail:
      `Hebun could not read ${owner.subject} (${block.reason}). NOTHING HERE SAYS THAT SOURCE HOLDS ` +
      "NOTHING — only that it could not be asked. This horizon is therefore incomplete.",
    lifecycle: "unknown",
  };
}

/**
 * Read this organization's whole decision horizon, for Heby grounding.
 *
 * Tenant-scoped through released seams — this module passes the server-resolved context straight
 * through and constructs no query, so a cross-organization read is UNREPRESENTABLE rather than
 * refused.
 */
export async function readDecisionHorizonGroundingSource(
  tenant: TenantContext | null,
  deps: DecisionHorizonGroundingDeps = {},
): Promise<SourceResolution> {
  if (typeof window !== "undefined") {
    throw new Error("Decision horizon grounding reads are server-only.");
  }
  if (!tenant?.tenantId) return base("unavailable", [], "no-authorized-tenant-context");

  const readQueue = deps.readQueue ?? readDecisionQueueGroundingSource;
  const readHorizon = deps.readHorizon ?? readDecisionHorizon;

  const [queue, horizon] = await Promise.all([
    readQueue(tenant).catch(
      (): SourceResolution => ({
        sourceClass: "decision-records",
        state: "unavailable",
        provenance: DECISION_HORIZON_PROVENANCE,
        authoritative: true,
        items: [],
        unavailableReason: "action-authorization:read-failed",
      }),
    ),
    readHorizon(tenant, {}, { sources: COMPOSED_SOURCES }).catch(
      (): DecisionHorizon => ({ status: "unavailable", reason: "no-authorized-tenant-context" }),
    ),
  ]);

  const items: ResolvedSourceItem[] = [];
  const unavailable: string[] = [];

  /*
   * THE ACTION HALF, VERBATIM. Its synthetic "nothing is pending" item is DROPPED, because emptiness
   * is now a judgement about the whole horizon and no single source may make it. Its real items are
   * carried unchanged, keeping the detail the released projection composed.
   */
  if (queue.state === "unavailable") {
    unavailable.push(DECISION_SOURCE_OWNERS["action-requests"].authority);
    items.push({
      recordRef: "action-requests:unavailable",
      label: `${DECISION_SOURCE_OWNERS["action-requests"].authority} could not be read`,
      detail:
        `Hebun could not read ${DECISION_SOURCE_OWNERS["action-requests"].subject} ` +
        `(${queue.unavailableReason ?? "unavailable"}). NOTHING HERE SAYS THAT SOURCE HOLDS ` +
        "NOTHING — only that it could not be asked. This horizon is therefore incomplete.",
      lifecycle: "unknown",
    });
  } else {
    items.push(...queue.items.filter((item) => !item.recordRef.endsWith(":none-pending")));
  }

  /* THE OTHER TWO, from the horizon model, each keeping its own owner and route. */
  if (horizon.status !== "read") {
    for (const source of COMPOSED_SOURCES) {
      unavailable.push(DECISION_SOURCE_OWNERS[source].authority);
      items.push(unavailableItem({ source, status: "unavailable", reason: "horizon-unreadable" }));
    }
  } else {
    for (const block of horizon.blocks) {
      if (block.status === "unavailable") {
        unavailable.push(DECISION_SOURCE_OWNERS[block.source].authority);
        items.push(unavailableItem(block));
        continue;
      }
      for (const item of block.items) {
        items.push(horizonItem(item.source, item.recordId, item.label, item.recordedAt));
      }
      if (block.truncated) {
        items.push({
          recordRef: `${block.source}:bound-reached`,
          label: `More than are listed from ${DECISION_SOURCE_OWNERS[block.source].authority}`,
          detail:
            `This source holds ${block.total} items awaiting a decision and more than the bound ` +
            "lists here, so this is not all of them.",
          lifecycle: "unknown",
        });
      }
    }
  }

  /*
   * THE COMPLETENESS VERDICT, ALWAYS PRESENT AND ALWAYS LAST.
   *
   * The emptiness sentence is guarded by it and by nothing else: it is said only when every source
   * answered and no source produced an item.
   */
  const anyDecisionItems = items.some(
    (item) => !item.recordRef.includes(":unavailable") && !item.recordRef.includes(":bound-reached"),
  );

  if (unavailable.length > 0) {
    items.push({
      recordRef: "decision-horizon:partial",
      label: "This horizon is incomplete",
      detail: `${horizonPartialStatement(unavailable)} ${DECISION_HORIZON_NON_CLAIM}`,
      lifecycle: "unknown",
    });
    return base("resolved", items);
  }

  if (!anyDecisionItems) {
    return base("resolved", [
      {
        recordRef: "decision-horizon:none",
        label: "Nothing is awaiting a human decision",
        detail: `${HORIZON_EMPTY_STATEMENT} ${HORIZON_NON_CLAIMS[0]}`,
        lifecycle: "settled",
      },
    ]);
  }

  items.push({
    recordRef: "decision-horizon:complete",
    label: "This horizon is complete",
    detail:
      "Every source of decisions in Hebun answered, so this is everything the organization has " +
      "recorded as awaiting a human decision right now. It is still not a ranking, a priority " +
      "order, or a statement that any of it is overdue.",
    lifecycle: "settled",
  });
  return base("resolved", items);
}
