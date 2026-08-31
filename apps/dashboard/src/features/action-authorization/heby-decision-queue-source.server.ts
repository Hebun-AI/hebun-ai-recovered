/*
 * action-authorization/heby-decision-queue-source.server.ts — THE ACTION AUTHORIZATION AUTHORITY'S
 * read projection of its own pending queue, shaped for Heby grounding.
 *
 * ── WHY IT LIVES ON THIS SIDE OF THE BOUNDARY ────────────────────────────────
 *
 * G6C settled it, E2-1 followed it, E2-5 restated it and AMA-3 applied it again: a projection
 * belongs to the authority that owns the facts, and the consumer imports the projection. So this
 * file sits inside Action Authorization, and Heby imports one function from it. Heby therefore
 * never holds `hebyActionRequests`, never holds a database handle for decision truth, and — the
 * part that matters most here — never holds `decideActionRequest`.
 *
 * ── READ-ONLY, AND PROVABLY ──────────────────────────────────────────────────
 *
 * This module contains no insert, no update, no delete and no transaction, and it imports the READ
 * SEAM MODULE by exact path rather than any sibling. That precaution is sharper here than it was
 * for AMA-3: the decision WRITER, the proposal writer, the permit consumer and the permit revoker
 * are all files in THIS SAME DIRECTORY. A single convenience import would put a Governance-bound
 * decision writer into Heby's import graph for the sake of a read.
 *
 *     HEBY READS THE QUEUE != HEBY CAN DECIDE ANYTHING IN IT
 *
 * ── WHY `decision-records`, AND WHY THAT NAME IS NOT A MISTAKE ───────────────
 *
 * The class was declared long before it had a reader, and its own contract says what it means:
 * decision PREPARATION material, distinct from `governance`, which reads the constitutional record
 * a decision is taken UNDER. Both workspaces that declare it — `command` and `decisions` — also
 * declare the `decision-preparation` capability, and the `decisions` profile routes to `/approvals`
 * and states "Heby prepares; it never approves, rejects, or authorizes."
 *
 * This module connects that class to the truth it was always about. It invents no class, renames
 * nothing, and folds nothing into `governance` — consolidating them would make material prepared
 * for a human decision indistinguishable from the record that decision is taken under, which is the
 * exact collision G6D repaired.
 *
 * ── WHAT IT CARRIES, AND THE THINGS IT DELIBERATELY DOES NOT ─────────────────
 *
 * PENDING ONLY. "What needs my decision?" is a question about what is still waiting, so this class
 * carries requests whose status is `pending` and nothing else. Approved, permitted, executed and
 * their outcomes are owned by `recorded-acts` (E2-6) and `operations` (E2-4); restating them here
 * would create a second source of truth for facts another class already reports.
 *
 * NO ELAPSED TIME. The recorded `proposedAt` timestamp travels verbatim; how long that has been is
 * NOT computed here. E2-4's attention observation already owns duration truth ("Awaiting a human
 * decision"), and a second module measuring the same interval against its own clock is how two
 * surfaces come to disagree about the same request.
 *
 * NO PRIORITY, NO URGENCY, NO RISK SCORE, NO RECOMMENDATION. No authority in this repository owns
 * any of them, so nothing here may assert one. `reversibility` and `sideEffect` are carried because
 * they are STORED PROPERTIES of the prepared action — they are facts about the act, not judgements
 * about whether to take it, and the difference is the whole reason this class is safe to connect.
 *
 * NO PARAMETERS AND NO DIGEST. The surface at `/approvals` discloses them behind a deliberate
 * disclosure step; a grounding item is read aloud by a model, and a payload digest helps a Director
 * decide nothing.
 *
 * Server-only.
 */
import type { ResolvedSourceItem, SourceResolution } from "@/features/heby-runtime/contracts";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  readPendingActionRequests,
  type PendingActionRequestView,
} from "./read-action-authorizations.server";

/**
 * Named for what it is, and for what it is not.
 *
 * A reader who sees this line must not conclude that anything here has been decided, or that Heby
 * had any part in deciding it.
 */
export const DECISION_QUEUE_GROUNDING_PROVENANCE =
  "Action Authorization Authority — the consequential actions this organization has recorded as " +
  "AWAITING A HUMAN DECISION, read tenant-scoped from the session and authoritative " +
  "(authoritative: true). Every field is a stored property of the proposal as it was frozen when " +
  "filed. Nothing here is approved, authorized, permitted or executed: a pending request is a " +
  "question put to a human, and it remains one until that human answers it on the approvals " +
  "surface. This class carries only what is still waiting — what was already decided, permitted " +
  "or attempted belongs to the recorded-acts class, and the constitutional record those decisions " +
  "are taken under belongs to the governance class.";

/**
 * The non-claim, held as its own constant.
 *
 * IT NAMES THE CLAIMS IT FORBIDS, which is what makes it useful to a model and what makes a naive
 * vocabulary ban fail on it. E2-4 through E2-8, AMA-2 and AMA-3 each recorded that collision; the
 * settled remedy is to pin the denial BY EQUALITY and run any word ban over only what the source
 * CLAIMS. Keeping it separately named is what lets a test do both.
 */
export const DECISION_QUEUE_NON_CLAIM =
  "This is a proposal awaiting review, not a decision and not a recommendation. Hebun records no " +
  "priority, no urgency, no risk score and no judgement of whether it should be approved, so " +
  "nothing may be said about any of them. The decision is the human's, and it is taken only on " +
  "the approvals surface.";

/**
 * The measured empty queue. An established fact about Hebun's records, and NOT an unread state.
 *
 * The sentence must survive being read alone, because that is how a sentence reaches a model. So it
 * says that Hebun LOOKED, which is the difference between this and the unavailable resolution.
 */
export const DECISION_QUEUE_EMPTY_STATEMENT =
  "Nothing is awaiting a human decision in this organization right now. Hebun read the pending " +
  "queue successfully and it returned no rows — a measured empty result, never an unread or " +
  "unavailable one.";

/** Where the human actually decides. Carried so an answer can route rather than invent a route. */
export const DECISION_QUEUE_ROUTE = "/approvals" as const;

export interface DecisionQueueGroundingDeps {
  readonly readPending?: typeof readPendingActionRequests;
}

function base(
  state: SourceResolution["state"],
  items: readonly ResolvedSourceItem[],
  unavailableReason?: string,
): SourceResolution {
  return {
    sourceClass: "decision-records",
    state,
    provenance: DECISION_QUEUE_GROUNDING_PROVENANCE,
    /*
     * TRUE, on the same basis G6C's `governance` and AMA-3's `agent-mandate` declare it. Every
     * field cited below is a STORED COLUMN of the request row, frozen when the proposal was filed
     * — not a figure recomputed on read. `agents` declares `false` because it carries eight
     * recomputed counts; this class carries none, and it deliberately computes no elapsed time so
     * that it does not acquire one.
     */
    authoritative: true,
    items,
    ...(unavailableReason === undefined ? {} : { unavailableReason }),
  };
}

/** How the evidence state reads, keeping the three the projection already distinguishes apart. */
function evidenceSentence(evidence: PendingActionRequestView["evidence"]): string {
  if (evidence.status === "attached") {
    const n = evidence.items.length;
    return `${n} evidence ${n === 1 ? "reference is" : "references are"} attached to this proposal.`;
  }
  if (evidence.status === "none") {
    return "This proposal recorded no evidence. That is its stored state, not a failed read.";
  }
  return "The stored evidence could not be interpreted, so it is unknown rather than absent.";
}

/** Who proposed it, in the vocabulary the record actually holds. */
function proposerSentence(item: PendingActionRequestView): string {
  if (item.proposedByActorType !== "agent") {
    return `Proposed by a ${item.proposedByActorType}.`;
  }
  const name = item.proposedByAgentName;
  if (!name) {
    return "Proposed by an agent this organization can no longer name.";
  }
  return (
    `Proposed by the durable agent ${name}, which is ` +
    `${item.proposedByAgentInService ? "in service" : "no longer in service"}. An agent proposing ` +
    "something authorized nothing: it is why this is waiting for a human at all."
  );
}

/** One pending request, as a grounding item. */
function pendingItem(item: PendingActionRequestView): ResolvedSourceItem {
  const target = item.targetLabel ? ` Target: ${item.targetLabel}.` : "";
  const consequences =
    item.consequences.length > 0
      ? ` Recorded consequences: ${item.consequences.join("; ")}.`
      : " No consequences were recorded on this proposal.";
  return {
    recordRef: `heby-action-request/${item.requestId}`,
    label: `${item.actionKind} — awaiting a human decision`,
    detail:
      `${item.expectedEffect}${target} Side effect: ${item.sideEffect}. Reversibility: ` +
      `${item.reversibility}.${consequences} ${evidenceSentence(item.evidence)} ` +
      `${proposerSentence(item)} Filed at ${item.proposedAt}, and still pending. ` +
      DECISION_QUEUE_NON_CLAIM,
    lifecycle: "settled",
  };
}

/** The measured empty queue. A real answer, and never an unread one. */
function emptyItem(): ResolvedSourceItem {
  return {
    recordRef: "heby-action-request:none-pending",
    label: "Nothing is awaiting a human decision",
    detail: `${DECISION_QUEUE_EMPTY_STATEMENT} ${DECISION_QUEUE_NON_CLAIM}`,
    lifecycle: "settled",
  };
}

/**
 * Read this tenant's pending consequential proposals, for Heby grounding.
 *
 * Tenant-scoped through the released read seam — this module passes the server-resolved context
 * straight through and constructs no query. There is no parameter by which a caller could name
 * another tenant, so that is not refused here; it is UNREPRESENTABLE.
 *
 * THREE ANSWERS, KEPT APART. A queue with rows, a queue measured empty, and a queue that could not
 * be read. Collapsing the last two would let Heby tell a Director that nothing needs their decision
 * during a database outage — the most expensive sentence this class could get wrong, because the
 * Director would act on it by doing nothing.
 *
 *     UNAVAILABLE != EMPTY QUEUE
 */
export async function readDecisionQueueGroundingSource(
  tenant: TenantContext | null,
  deps: DecisionQueueGroundingDeps = {},
): Promise<SourceResolution> {
  if (typeof window !== "undefined") {
    throw new Error("Decision queue grounding reads are server-only.");
  }
  if (!tenant?.tenantId) {
    return base("unavailable", [], "no-authorized-tenant-context");
  }

  const readPending = deps.readPending ?? readPendingActionRequests;
  const pending = await readPending(tenant);

  if (pending.status === "unavailable") {
    /* The authority's own reason, carried verbatim. Never softened into an empty queue. */
    return base("unavailable", [], pending.reason);
  }

  if (pending.items.length === 0) {
    return base("resolved", [emptyItem()]);
  }

  return base("resolved", pending.items.map(pendingItem));
}
