/*
 * action-authorization/record-action-request.server.ts — freezing a proposal so a human can
 * decide about it (R3A).
 *
 * WHAT THIS MODULE DOES, AND THE ONE THING IT REFUSES TO DO. It takes a `HebyPreparedAction` the
 * deterministic Heby lifecycle already produced and writes it down. It does not re-run the gates,
 * does not re-validate arguments against the tool schema, and does not decide anything: Phase 17
 * owns preparation and this phase owns durability. Re-deriving would create a second opinion about
 * what was prepared, and two opinions is one too many.
 *
 * WHY ONLY `REQUIRES_HUMAN_REVIEW` IS ACCEPTED. Every other terminal state means the action must
 * not reach a human: `RESTRICTED` is a device action or a confused-deputy attempt, `UNAVAILABLE`
 * has no substrate, `EXPIRED` rests on stale evidence, `FAILED` never validated, and
 * `EXECUTION_ELIGIBLE` is read-only work that needs no permission. Persisting any of them would
 * put a question in front of the Director that the architecture already answered.
 *
 * NOTHING HERE IS AUDITED. A proposal moves no authority; the row IS the record. The audit ledger
 * opens at the first authority-bearing event, which is the human's decision.
 *
 * NO AUTHORITY IS CONSULTED, AND NONE IS GRANTED. Recording a request asks nothing of Governance —
 * anyone with a tenant session may propose. That is deliberate: proposing is free, and the entire
 * cost is paid at the approval boundary, where a human and a Governance decision are both
 * mandatory. This module cannot approve, cannot mint a permit, and does not import the permit
 * table.
 *
 * Server-only.
 */
import { and, eq } from "drizzle-orm";
import { type ControlPlaneDatabase } from "@/db/client.server";
import { hebyActionRequests } from "@/db/schema/action-authorization";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { resolveGovernanceDbOrNull } from "@/features/governance-decision/persistence.server";
import type { HebyPreparedAction } from "@/features/heby-actions/contracts";
import {
  asCanonicalPayload,
  digestCanonicalAction,
  type CanonicalPayload,
} from "./canonical-payload";
import { isAgentProposer, type AgentProposer } from "./agent-proposer.server";
import {
  AUTHORIZABLE_SIDE_EFFECTS,
  type ActionRequestRefusal,
  type ActionRequestResult,
} from "./contracts";

export interface ActionRequestDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly now?: () => Date;
}

function refused(reason: ActionRequestRefusal): ActionRequestResult {
  return { status: "refused", reason };
}

/**
 * WHO ORIGINATED THIS ACT — both halves of the canonical polymorphic actor pair (S2).
 *
 * A SERVER-SUPPLIED POSITIONAL ARGUMENT, never a field on the caller's input. The two public entry
 * points below fix it, and each one is fixed to a different truth: a human who typed a command is
 * the human; an agent that selected the act from a closed set is that agent. Nothing in between is
 * representable, and neither entry point can be talked into the other's attribution.
 */
type ActionProposerPair =
  | { readonly actorType: "human"; readonly actorId: string }
  | { readonly actorType: "agent"; readonly actorId: string };

/**
 * Turn a verified proposer into the actor pair, or refuse.
 *
 * The RUNTIME check is the point. `AgentProposer`'s brand is a module-private symbol in its own
 * module, so a caller that manufactured one with a type cast satisfies the compiler and fails
 * HERE — which is what makes "no client-supplied agent id can become a proposer" a property of
 * the code rather than a convention somebody remembers.
 */
function agentPairOrNull(proposer: AgentProposer): ActionProposerPair | null {
  if (!isAgentProposer(proposer)) return null;
  return { actorType: "agent", actorId: proposer.agentId };
}

/**
 * Persist one prepared consequential action as a pending request.
 *
 * The caller supplies the prepared action and nothing else. It cannot supply the tenant (session),
 * the proposer (session), the digest (computed here), the status (always `pending`), or any
 * approval field — those columns are unreachable from this module's insert.
 */
async function insertActionRequest(
  tenant: TenantContext | null,
  prepared: HebyPreparedAction | null,
  proposer: ActionProposerPair,
  deps: ActionRequestDeps,
): Promise<ActionRequestResult> {
  if (typeof window !== "undefined") {
    throw new Error("Action requests are server-only.");
  }
  if (!tenant?.tenantId || !tenant.userId) return refused("unauthenticated");
  if (!prepared) return refused("not-authorizable");

  /* Only a proposal that actually reached the human-review boundary may be persisted. */
  if (prepared.lifecycleState !== "REQUIRES_HUMAN_REVIEW") return refused("not-authorizable");
  if (!AUTHORIZABLE_SIDE_EFFECTS.includes(prepared.sideEffect)) {
    return refused("side-effect-not-authorizable");
  }
  if (!prepared.argumentsValid) return refused("arguments-invalid");

  /*
   * The arguments already passed the tool's typed schema, so this narrowing should always succeed.
   * It is checked anyway: this is the last point before a value becomes something a human is asked
   * to approve, and it fails closed rather than trusting upstream.
   */
  const payload: CanonicalPayload | null = asCanonicalPayload(prepared.arguments);
  if (!payload) return refused("arguments-invalid");

  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return refused("persistence-unavailable");
  const now = (deps.now ?? (() => new Date()))();

  const targetKind = prepared.target?.kind ?? null;
  const targetRef = prepared.target?.ref ?? null;

  const payloadDigest = digestCanonicalAction({
    actionKind: prepared.actionKind,
    toolId: prepared.toolId,
    targetKind,
    targetRef,
    payload,
  });

  try {
    /*
     * A pre-check, NOT the invariant. `heby_action_requests_one_pending_per_digest_uq` is what
     * actually prevents two live proposals for the same act; this read exists only so the ordinary
     * case gets a named refusal instead of a constraint violation. The catch below is the real
     * guard when two callers race.
     */
    const existing = await db
      .select({ id: hebyActionRequests.id })
      .from(hebyActionRequests)
      .where(
        and(
          eq(hebyActionRequests.tenantId, tenant.tenantId),
          eq(hebyActionRequests.payloadDigest, payloadDigest),
          eq(hebyActionRequests.status, "pending"),
        ),
      )
      .limit(1);
    if (existing.length > 0) return refused("already-pending");

    const rows = await db
      .insert(hebyActionRequests)
      .values({
        tenantId: tenant.tenantId,
        actionId: prepared.actionId,
        payloadDigest,
        actionKind: prepared.actionKind,
        toolId: prepared.toolId,
        sideEffect: prepared.sideEffect,
        reversibility: prepared.reversibility,
        targetKind,
        targetRef,
        targetLabel: prepared.target?.label ?? null,
        ownerWorkspace: prepared.ownerWorkspace,
        requestingWorkspace: prepared.requestingWorkspace,
        canonicalPayload: payload,
        expectedEffect: prepared.expectedEffect,
        consequences: prepared.consequences,
        evidence: prepared.evidence,
        /*
         * WHO ACTUALLY PROPOSED THIS.
         *
         * A1a made the pair truthful for the command path, and left `agent` RESERVED: unlike the
         * approver and the permit authorizer, `proposed_by_actor_type` carries no `human` CHECK,
         * precisely so a real agent could propose one day. Its condition was stated then — "that
         * day needs an agent that originates something a human did not dictate, and an
         * authoritative id to name it by".
         *
         * AGENT-RUNTIME-0 supplied the id. AGENT-PROPOSAL-1 supplies the origination. Both halves
         * now come from the SAME resolved pair, so this row can no longer say that one kind of
         * actor acted while naming another kind's identifier.
         *
         * The human-supremacy CHECKS ARE UNTOUCHED and always were. They constrain the APPROVER
         * and the AUTHORIZER, never the proposer, so a machine still cannot approve or authorize
         * anything — that guarantee never depended on this field, and this phase does not make it
         * depend on it now.
         */
        proposedByActorType: proposer.actorType,
        proposedByActorId: proposer.actorId,
        status: "pending",
        createdAt: now,
        /*
         * THE ROW-CREATION ATTRIBUTION STAYS HUMAN, AND THAT IS NOT A CONTRADICTION. A person's
         * authenticated request is what caused this row to exist; the proposer columns say who
         * chose the act. Two different facts, both true, both recorded.
         */
        createdBy: tenant.userId,
        createdByType: "human",
      })
      .returning({ id: hebyActionRequests.id });

    const requestId = rows[0]?.id;
    if (!requestId) return refused("persistence-unavailable");
    return { status: "recorded", requestId, payloadDigest };
  } catch (error) {
    /*
     * The unique index is the authority on duplicates, not the pre-check above. A caller that lost
     * the race must be told the same thing the pre-check would have told it — reporting a
     * persistence failure would make a working invariant look like a broken database.
     */
    if (isUniqueViolation(error)) return refused("already-pending");
    return refused("persistence-unavailable");
  }
}

/**
 * A HUMAN who dictated the act, filing it for their own organization to decide about.
 *
 * BYTE-FOR-BYTE THE RELEASED BEHAVIOUR. Same signature, same attribution, same refusals. The
 * `/send` slash command is unchanged by AGENT-PROPOSAL-1: a person who types a command and both of
 * its references is the proposer, and no amount of downstream machinery makes that less true.
 */
export function recordActionRequest(
  tenant: TenantContext | null,
  prepared: HebyPreparedAction | null,
  deps: ActionRequestDeps = {},
): Promise<ActionRequestResult> {
  if (typeof window !== "undefined") {
    throw new Error("Action requests are server-only.");
  }
  if (!tenant?.tenantId || !tenant.userId) return Promise.resolve(refused("unauthenticated"));
  return insertActionRequest(
    tenant,
    prepared,
    { actorType: "human", actorId: tenant.userId },
    deps,
  );
}

/**
 * An AGENT that selected the act itself, filed under a human's authenticated request.
 *
 * THE SAME INSERT, THE SAME TABLE, THE SAME MODULE — deliberately. A second writer would be a
 * second opinion about what a pending proposal is, and the whole point of this authority is that
 * there is exactly one. What differs is one resolved pair, and the proposer is a positional
 * argument whose only source is `resolveAgentProposer`: there is no agent-id parameter and no
 * default, so this cannot be called at all without a verified durable identity. The refusal below
 * exists for a FORGED value, not for an absent one.
 *
 * It grants nothing. `status` is still `pending`, no permit is minted, no decision is written, no
 * provider is reached, and the human review boundary is exactly where it was.
 */
export function recordAgentOriginatedActionRequest(
  tenant: TenantContext | null,
  prepared: HebyPreparedAction | null,
  proposer: AgentProposer,
  deps: ActionRequestDeps = {},
): Promise<ActionRequestResult> {
  if (typeof window !== "undefined") {
    throw new Error("Action requests are server-only.");
  }
  if (!tenant?.tenantId || !tenant.userId) return Promise.resolve(refused("unauthenticated"));
  const pair = agentPairOrNull(proposer);
  if (!pair) return Promise.resolve(refused("unverified-agent-proposer"));
  return insertActionRequest(tenant, prepared, pair, deps);
}

/** PostgreSQL `unique_violation`. Read from the driver's code, never from the message text. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "23505"
  );
}
