/*
 * attention-observation/heby-attention-source.server.ts — E2-4's read projection, shaped for Heby
 * grounding, for the `operations` source class.
 *
 * ── WHY THIS CLASS, AND WHY IT WAS EMPTY ─────────────────────────────────────
 *
 * `operations` is declared by Heby's Command and Operations workspaces and has never had a
 * connected reader: `workspace-registry.ts` produces it through `definedButUnconnected`, so a
 * Director asking Command what is waiting was told the source was unavailable — truthfully, and
 * while Hebun held every fact needed to answer.
 *
 * This connects it, to observations Hebun already computes, and to nothing else.
 *
 * ── WHY IT LIVES HERE AND NOT UNDER `heby-` ──────────────────────────────────
 *
 * G6C settled it, E2-1 and INT-5A restated it: the projection belongs to the side that owns the
 * facts, and the consumer imports the projection. Heby therefore never holds a database handle for
 * proposals, permits, attempts or the act ledger — E2-4's composition keeps it, and the composition
 * itself holds only readers.
 *
 * The property that matters is structural rather than lexical, and it is proved by walking the real
 * import graph from Heby's roots: NO module reachable from `model-answer.server.ts` may define a
 * Governance writer. Measured for every reader this file reaches — action authorization, action
 * execution, governance activity — the closures contain zero Governance writers and zero durable
 * write statements.
 *
 * ── DERIVED, AND SAYING SO ───────────────────────────------------------------
 *
 * `authoritative: false`, deliberately. The underlying RECORDS are authoritative; every number
 * here is arithmetic recomputed on read against an injected instant. G6C's source declares `true`
 * because `decision_records` IS the Governance record; this one is the opposite case, and
 * flattening a derived duration into an authoritative fact is the collapse Heby must never make.
 *
 *     AUTHORITATIVE RECORD != AUTHORITATIVE DERIVATION
 *
 * ── WHAT IT STRUCTURALLY CANNOT SAY ──────────────────────────────────────────
 *
 * No urgency, no priority, no lateness, no threshold and no recommendation — not because each is
 * filtered here, but because {@link AttentionObservation} carries no field that could hold one. The
 * only thing that travels is a duration and the column it was measured from.
 *
 *     AGE != IMPORTANCE        WAITING != LATE        NO THRESHOLD IS A POLICY
 *
 * Server-only.
 */
import type { ResolvedSourceItem, SourceResolution } from "@/features/heby-runtime/contracts";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { ATTENTION_OBSERVATION_BASIS, type ElapsedObservation } from "./contracts";
import {
  readAttentionObservation,
  type AttentionObservation,
  type AttentionObservationDeps,
  type AttentionObservationRead,
} from "./read-attention-observation.server";

/** Named for what it is, and for what it is not. */
export const ATTENTION_GROUNDING_PROVENANCE =
  "Organizational Attention Observation — elapsed time derived on read from timestamps the action " +
  "authorization, action execution, governance activity, Knowledge and Governance decision " +
  "authorities already wrote (authoritative: false). The Knowledge review line is a SUBTRACTION " +
  "across two owners: Knowledge states which versions currently exist, Governance states which of " +
  "them it has decided about, and neither side is asked the other's question. " +
  ATTENTION_OBSERVATION_BASIS;

/** Why the source could not be resolved. Two reasons, two sentences, and they must not merge. */
export const ATTENTION_GROUNDING_UNAVAILABLE = Object.freeze({
  "no-authorized-tenant-context":
    "No authorized tenant context, so nothing was read. Nothing was substituted for it.",
  "read-failed":
    "Hebun could not read the records these durations are measured from. That is a read failure, " +
    "not an organization with nothing waiting.",
});

export interface AttentionGroundingDeps extends AttentionObservationDeps {
  readonly readAttention?: (
    tenant: TenantContext | null,
    deps?: AttentionObservationDeps,
  ) => Promise<AttentionObservationRead>;
}

function unavailable(reason: string): SourceResolution {
  return {
    sourceClass: "operations",
    state: "unavailable",
    provenance: ATTENTION_GROUNDING_PROVENANCE,
    authoritative: false,
    items: [],
    unavailableReason: reason,
  };
}

/** A duration, or the honest absence of one. NEVER the string "0" for a missing observation. */
function duration(observation: ElapsedObservation | null): string {
  return observation === null ? "no elapsed observation available" : observation.label;
}

/** The basis clause. Every line names the column it was measured from, or says it has none. */
function basis(observation: ElapsedObservation | null): string {
  return observation === null ? "no timestamp basis" : `basis ${observation.basis}`;
}

/**
 * One line per block, and a block that could not be read says so instead of contributing a zero.
 *
 *     UNAVAILABLE != NOTHING WAITING        UNAVAILABLE != ZERO DURATION
 */
function itemsFor(observation: AttentionObservation): readonly ResolvedSourceItem[] {
  const items: ResolvedSourceItem[] = [];

  const awaiting = observation.awaitingDecision;
  items.push({
    recordRef: "attention:awaiting-decision",
    label: "Awaiting a human decision",
    detail:
      awaiting.status === "observed"
        ? `${awaiting.value.awaiting} awaiting · oldest waiting ${duration(awaiting.value.oldestWaiting)} · ${basis(awaiting.value.oldestWaiting)}`
        : `not read (${awaiting.reason}) — this is an unread observation, not an empty queue`,
    lifecycle: awaiting.status === "observed" ? "settled" : "unknown",
  });

  const approved = observation.approvedUnexecuted;
  items.push({
    recordRef: "attention:approved-without-attempt",
    label: "Approved with no execution attempt recorded",
    detail:
      approved.status === "observed"
        ? `${approved.value.approvedWithoutAttempt} approved with no attempt · oldest approved ${duration(approved.value.oldestApproved)} ago · ${basis(approved.value.oldestApproved)}`
        : `not read (${approved.reason}) — this is an unread observation, not an absence of approvals`,
    lifecycle: approved.status === "observed" ? "settled" : "unknown",
  });

  const permits = observation.authorizedUnspent;
  items.push({
    recordRef: "attention:authorized-unspent",
    label: "Authorized and not yet used",
    detail:
      permits.status === "observed"
        ? `${permits.value.active} active · soonest expiry in ${duration(permits.value.soonestExpiry)} · longest held ${duration(permits.value.longestHeld)}`
        : `not read (${permits.reason}) — this is an unread observation, not an absence of permits`,
    lifecycle: permits.status === "observed" ? "settled" : "unknown",
  });

  const acts = observation.recordedActRecency;
  items.push({
    recordRef: "attention:recorded-act-recency",
    label: "Most recent recorded governed act",
    detail:
      acts.status === "observed"
        ? `${acts.value.totalRecordedActs} recorded · most recent ${duration(acts.value.sinceMostRecent)} ago · ${basis(acts.value.sinceMostRecent)}`
        : `not read (${acts.reason}) — this is an unread ledger, not an organization that has done nothing`,
    lifecycle: acts.status === "observed" ? "settled" : "unknown",
  });

  /*
   * ── IDENTIFICATION AND ROUTING ONLY ──────────────────────────────────────
   *
   * A COUNT, A DURATION AND A ROUTE. No statement, no title, no domain key, no scope, no node id
   * and no provenance — Command is where a Director asks what is waiting, and E2-8 established
   * that Command does not receive Knowledge CONTENT. Nothing crosses that line here, because the
   * observation this reads from carries no field that could hold any of it.
   *
   *     A DURATION IS NOT CONTENT        WAITING FOR A DECISION != WHAT IT SAYS
   *
   * The route is the released Knowledge workspace path, so Heby routes the human to the authority
   * that owns the act instead of offering one it does not hold.
   */
  const review = observation.knowledgeAwaitingReview;
  items.push({
    recordRef: "attention:knowledge-governance-review",
    label: "Knowledge versions no Governance decision names",
    detail:
      review.status === "observed"
        ? `${review.value.awaitingReview} with no ratify or reject decision · oldest authored ${duration(review.value.oldestAwaiting)} ago · ${basis(review.value.oldestAwaiting)} · decided in the Knowledge workspace at /knowledge`
        : `not read (${review.reason}) — this is an unread observation, not an absence of Knowledge waiting on a decision`,
    lifecycle: review.status === "observed" ? "settled" : "unknown",
  });

  return items;
}

/**
 * Read this tenant's elapsed-time observations for Heby grounding, ADDED TO whatever the class
 * already carried.
 *
 * ── WHY IT MERGES INSTEAD OF REPLACING ───────────────────────────────────────
 *
 * `operations` was NOT an empty class. The pure resolver already fills it from the Executive
 * Overview's operational sections, and the first draft of this module returned a fresh resolution
 * that overwrote them — silently deleting evidence another source was contributing. R2C's released
 * injection test caught it, which is exactly what that test is for.
 *
 * Every other connected class replaces, and correctly: Knowledge, Governance, Integrations and
 * Organization each substitute a real tenant-scoped read for a PURE DEFAULT that carried nothing.
 * This one is different because the default carries items, so E2-4 appends.
 *
 *     A CONNECTED READER MAY ADD EVIDENCE. IT MAY NOT DELETE ANOTHER SOURCE'S.
 *
 * Both contributions are `authoritative: false`, so the class asserts one standing and cites under
 * it — the conflict E2-1 warned about does not arise. The provenance sentence names both origins,
 * and every E2-4 item names the authoritative column its duration was measured from.
 *
 * Tenant-scoped through the composition's readers, which each bind the session tenant into their
 * own predicate. This module constructs no query and takes no tenant identifier, so a
 * cross-organization read is not refused here; it is UNREPRESENTABLE.
 *
 * FIVE ITEMS, ALWAYS. The contribution is bounded by the number of blocks this observation defines,
 * not by a limit somebody chose — there is no list to page and no row to enumerate.
 */
export async function readAttentionGroundingSource(
  tenant: TenantContext | null,
  deps: AttentionGroundingDeps = {},
  base?: SourceResolution,
): Promise<SourceResolution> {
  if (typeof window !== "undefined") {
    throw new Error("Attention grounding reads are server-only.");
  }

  /* What the class already carried. Preserved whatever happens below. */
  const carried = base?.state === "resolved" ? base.items : [];

  const read = await (deps.readAttention ?? readAttentionObservation)(tenant, deps);
  if (read.status === "unavailable") {
    const reason =
      read.reason === "no-authorized-tenant-context"
        ? ATTENTION_GROUNDING_UNAVAILABLE["no-authorized-tenant-context"]
        : ATTENTION_GROUNDING_UNAVAILABLE["read-failed"];
    /*
     * A FAILED E2-4 READ MUST NOT COST THE CLASS ITS EXISTING EVIDENCE. When the base carried
     * items they are returned unchanged, with the base's own provenance; only when there was
     * nothing to keep does the whole class become unavailable.
     */
    return carried.length > 0 ? (base as SourceResolution) : unavailable(reason);
  }

  return {
    sourceClass: "operations",
    state: "resolved",
    provenance:
      carried.length > 0
        ? `${base!.provenance} ${ATTENTION_GROUNDING_PROVENANCE}`
        : ATTENTION_GROUNDING_PROVENANCE,
    /* DERIVED. The records are authoritative; these durations are recomputed on every read. */
    authoritative: false,
    items: [...carried, ...itemsFor(read.observation)],
  };
}
