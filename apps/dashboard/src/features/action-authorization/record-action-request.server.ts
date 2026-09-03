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
import type { HebyActionKind, HebyPreparedAction } from "@/features/heby-actions/contracts";
import { AGENT_ORIGINABLE_REGISTRY_KIND } from "@/features/agent-origination/contracts";
/*
 * AMA-2 — the READ SEAM MODULE, never the feature barrel.
 *
 * `@/features/agent-mandate` re-exports `establishAgentMandate`, and importing the barrel would put
 * a Governance-bound WRITER into the proposal path's import graph for the sake of a read. That is
 * the exact defect G6C repaired in Heby's graph, where a database-handle import dragged
 * `establishGovernanceAuthority` in behind it. Enforcement needs to LOOK at a mandate and must
 * remain unable to change one.
 */
import { readEffectiveAgentMandate } from "@/features/agent-mandate/read-agent-mandate.server";
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

/* ═══════════════════════════════════════════════════════════════════════════
 * AMA-2 — THE AGENT MANDATE CEILING, ENFORCED HERE AND NOWHERE ELSE.
 *
 * ── WHY THIS SEAM ───────────────────────────────────────────────────────────
 *
 * A ceiling that lived in a UI, a prompt, a capability descriptor or the seeded workforce adapter
 * would be advice. This is the module that makes an agent-originated proposal DURABLE, so a check
 * that runs here is the one thing a proposal cannot get around: there is no second writer of
 * `heby_action_requests` for an agent, and the gate runs BEFORE `insertActionRequest` is ever
 * called — a refusal therefore leaves no row, not a withdrawn one.
 *
 * ── WHAT IT DOES, STATED AS THE FORMULA IT IMPLEMENTS ───────────────────────
 *
 *   proposal proceeds  REQUIRES  a mandate exists AND kind ∈ mandate.proposal_scope   (necessary)
 *   kind ∈ mandate.proposal_scope  IMPLIES  nothing                                   (never sufficient)
 *
 * The second line is the whole design. Passing this gate changes NOTHING downstream: the row is
 * still `pending`, no permit is minted, no Governance decision is written, no provider is reached,
 * and the human review boundary is exactly where it was. A mandate only ever SUBTRACTS.
 *
 * ── IT READS, AND CANNOT WRITE ──────────────────────────────────────────────
 *
 * `readEffectiveAgentMandate` holds no insert, update, delete or transaction, and this module
 * imports nothing else from the mandate authority. Enforcing a bound cannot alter the bound.
 * ═════════════════════════════════════════════════════════════════════════ */

/**
 * The three fail-closed states, kept apart on purpose. See `ActionRequestRefusal` for why one
 * value would have been a fabricated absence.
 */
type MandateCeilingRefusal = Extract<
  ActionRequestRefusal,
  "agent-mandate-authority-unavailable" | "no-agent-mandate" | "action-outside-agent-mandate"
>;

/**
 * Whether this agent's recorded ceiling admits this action kind.
 *
 * Returns `null` to proceed, or the refusal that stops the proposal. There is no third answer and
 * no default: every path through this function either names a refusal or reports an admitted kind,
 * so a mandate that could not be read can never be treated as one that permits.
 *
 * The agent id comes from the already-verified proposer pair and the tenant from the resolved
 * server-side context — neither is a caller-supplied value, so no request can ask about another
 * organization's mandate or another agent's.
 */
async function mandateCeilingRefusal(
  tenant: TenantContext,
  agentId: string,
  actionKind: HebyActionKind,
  deps: ActionRequestDeps,
): Promise<MandateCeilingRefusal | null> {
  const read = await readEffectiveAgentMandate(tenant, agentId, { getDb: deps.getDb });

  /* (A) Hebun could not look. An unreachable ceiling is not an absent one. */
  if (read.status === "unavailable") return "agent-mandate-authority-unavailable";
  /* (B) Hebun looked, and nobody has bounded this agent. NO MANDATE != UNLIMITED MANDATE. */
  if (!read.mandate) return "no-agent-mandate";

  /*
   * (C) A bound exists. The stored scope is in the ORIGINATION ALIAS vocabulary and the prepared
   * action carries a REGISTRY kind, so the comparison goes through the declared map rather than
   * through string equality — see `AGENT_ORIGINABLE_REGISTRY_KIND` for why comparing the two
   * vocabularies directly would refuse every proposal, including the ones a mandate admits.
   *
   * An EMPTY scope — withdrawal — admits nothing and lands here for every kind, which is what
   * withdrawal means.
   */
  const admitted = read.mandate.proposalScope.some(
    (alias) => AGENT_ORIGINABLE_REGISTRY_KIND[alias] === actionKind,
  );
  return admitted ? null : "action-outside-agent-mandate";
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
  /*
   * AGENT-PROPOSAL-4B — the model invocation that caused this proposal, when one did.
   *
   * A VALUE, and nothing else. This module does not read the provenance table, does not check that
   * the row exists, and does not import its authority — an existence check here would recreate, in
   * code, exactly the veto that omitting the foreign key was meant to prevent. Undefined for every
   * human-typed proposal, which is the honest reading: a human dictated the act.
   */
  originationInvocationId?: string,
  /*
   * PBGA-1 — THE WORK THIS ACT IS DECLARED TO SERVE, when a human declared one while filing it.
   *
   * A POSITIONAL ARGUMENT SUPPLIED BY ONE ENTRY POINT ONLY. `recordActionRequest` (human) may pass
   * it; `recordAgentOriginatedActionRequest` never does and has no parameter for it. So the agent
   * firewall is the SHAPE of the call, not a check inside it — and the storage CHECK
   * `heby_action_requests_human_purpose_declarer_chk` refuses a non-human declarer underneath.
   *
   * Optional, always. A proposal without a declared purpose is unchanged in every respect.
   */
  purposeWorkItemId?: string,
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
        originationInvocationId: originationInvocationId ?? null,
        /*
         * PBGA-1 — THE DECLARED PURPOSE, ATOMIC WITH THE PROPOSAL.
         *
         * Written in the SAME insert rather than patched afterwards, so "a request exists but the
         * purpose its author declared was lost" is not a state this path can produce. All four
         * columns move together or none do — the CHECK requires it — and the declarer is the human
         * whose authenticated request created the row, which is the same person the proposer
         * columns already name on this entry point.
         *
         * Undefined on the agent path by CONSTRUCTION: that entry point has no such parameter.
         */
        purposeWorkItemId: purposeWorkItemId ?? null,
        purposeDeclaredByActorType: purposeWorkItemId ? "human" : null,
        purposeDeclaredByActorId: purposeWorkItemId ? tenant.userId : null,
        purposeDeclaredAt: purposeWorkItemId ? now : null,
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
    /*
     * PBGA-1. The composite FK is the authority on whether the declared work exists in this tenant.
     * Asking the Work authority first would put a second, weaker copy of that question in a module
     * that owns neither table, and the two could disagree.
     */
    if (isForeignKeyViolation(error)) return refused("purpose-work-not-found");
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
  /**
   * PBGA-1. The Work item this person declares the act serves. Optional — omitting it is the
   * released behaviour, byte for byte, and leaves every purpose column NULL.
   */
  purposeWorkItemId?: string,
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
    undefined,
    purposeWorkItemId,
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
 *
 * ── AMA-2. THE MANDATE CEILING IS ENFORCED HERE, AND ONLY ON THIS PATH ───────
 *
 * This is the ONE place a recorded mandate constrains anything. It is checked after the proposer is
 * verified — a ceiling is a fact about a KNOWN agent, so there is nothing to look up until one is
 * resolved — and before `insertActionRequest`, so every mandate refusal writes no row at all.
 *
 * `recordActionRequest`, the human entry point below-and-above this one, reads no mandate and is
 * byte-unchanged in behaviour. A human may still propose an act this agent's mandate excludes:
 * AGENT MANDATE CONSTRAINS AGENTS, NOT HUMAN AUTHORITY.
 */
export async function recordAgentOriginatedActionRequest(
  tenant: TenantContext | null,
  prepared: HebyPreparedAction | null,
  proposer: AgentProposer,
  deps: ActionRequestDeps = {},
  /** AGENT-PROPOSAL-4B. The causing invocation, as a value. Never looked up here. */
  originationInvocationId?: string,
): Promise<ActionRequestResult> {
  if (typeof window !== "undefined") {
    throw new Error("Action requests are server-only.");
  }
  if (!tenant?.tenantId || !tenant.userId) return refused("unauthenticated");
  const pair = agentPairOrNull(proposer);
  if (!pair) return refused("unverified-agent-proposer");

  /*
   * A null prepared action carries no kind, so there is no requested act for a ceiling to admit or
   * exclude. Refused with the reason `insertActionRequest` would have given it anyway — the
   * released behaviour, unchanged — rather than reported as outside a mandate, which would name the
   * wrong defect. Nothing is written on either path, and the gate below is never skipped for
   * anything that could become a row.
   */
  if (!prepared) return refused("not-authorizable");

  const ceiling = await mandateCeilingRefusal(tenant, pair.actorId, prepared.actionKind, deps);
  if (ceiling) return refused(ceiling);

  return insertActionRequest(tenant, prepared, pair, deps, originationInvocationId);
}

/** PostgreSQL `foreign_key_violation`. Read from the driver's code, never from the message text. */
function isForeignKeyViolation(error: unknown): boolean {
  return (
    typeof error === "object" && error !== null && (error as { code?: unknown }).code === "23503"
  );
}

/** PostgreSQL `unique_violation`. Read from the driver's code, never from the message text. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "23505"
  );
}
