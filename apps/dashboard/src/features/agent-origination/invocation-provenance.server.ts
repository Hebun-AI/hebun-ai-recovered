/*
 * agent-origination/invocation-provenance.server.ts — AGENT-PROPOSAL-4B.
 *
 * THE ONLY WRITER of `heby_origination_invocations`, and the only reader.
 *
 * ── WHAT IT MAY SAY, AND WHAT IT MAY NOT ─────────────────────────────────────
 *
 * It records that a model call was registered, how far it got, and what the provider returned. It
 * records NOTHING about whether a proposal exists, its status, its attribution, an approval, a
 * permit, an execution, or a send. Those are owned by `heby_action_requests` and the authorities
 * around it, and this module imports none of them — a firewall test asserts the absence.
 *
 * ── NO PROMPT, NO RESPONSE, NO SECRET ────────────────────────────────────────
 *
 * The goal text, the model's raw answer, the API key, the Authorization header and any provider
 * error body are all absent by construction: there is no parameter that could carry them. The only
 * failure information stored is the released `ModelConnectivityError` CODE, a closed value Hebun
 * wrote, never a sentence a provider wrote.
 *
 * ── WHY REGISTRATION MAY REFUSE, AND FINALIZATION MAY NOT ────────────────────
 *
 * `registerInvocation` runs BEFORE any provider dispatch. If it fails, the caller does not invoke
 * the provider — nothing has been spent and no organizational work exists to destroy, so failing
 * closed there costs an empty act.
 *
 * `finalizeInvocation` runs AFTER. It can never veto anything: it returns a boolean and throws
 * nothing, because by then a proposal may already exist and observability must not be able to
 * unmake it. A finalization that does not land leaves the row honest but incomplete, and the
 * `registered` state explicitly means UNKNOWN rather than "nothing happened".
 */
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { hebyOriginationInvocations } from "@/db/schema/heby-origination-invocation";
import { hebyActionRequests } from "@/db/schema/action-authorization";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { isAgentProposer, type AgentProposer } from "@/features/action-authorization/agent-proposer.server";

/** The model-side lifecycle. Never a proposal lifecycle. */
export type OriginationInvocationState =
  | "registered"
  | "not-dispatched"
  | "dispatch-failed"
  | "selection-invalid"
  | "no-action"
  | "selection-valid";

/** What the proposal authority returned to THIS attempt. An observation, never a lifecycle. */
export type OriginationFilingOutcome = "not-attempted" | "proposed" | "refused" | "failed";

export interface InvocationProvenanceDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly now?: () => Date;
  readonly newInvocationId?: () => string;
}

/**
 * The provider facts, and only the ones the transport actually returned.
 *
 * Every field is optional because every one of them is optional AT THE PROVIDER: a response may
 * carry no id and no usage. Absent here means "not supplied", never zero.
 */
export interface InvocationResultFacts {
  readonly provider?: string;
  readonly model?: string;
  readonly providerRequestId?: string;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
}

/*
 * The ambient control plane when no handle is injected — the same shape every other server module
 * in this repository uses.
 *
 * WITHOUT THIS FALLBACK THE PHASE WOULD HAVE BROKEN ORIGINATION OUTRIGHT. The released server
 * action passes no `provenance` deps, so an injection-only resolver returns null in production,
 * registration fails, and — because registration fails CLOSED before dispatch — every origination
 * is refused. A released test caught it; the lesson is that "fails closed" and "cannot resolve its
 * own dependencies" look identical from the outside, and only one of them is a safety property.
 */
function resolveDb(deps: InvocationProvenanceDeps): ControlPlaneDatabase | null {
  if (deps.getDb) return deps.getDb();
  try {
    return getControlPlaneDb();
  } catch {
    return null;
  }
}

/**
 * Stage 1. Mint an identity and record that an invocation is about to be made.
 *
 * Returns the invocation id, or null when nothing could be recorded. A null answer means the
 * caller MUST NOT dispatch: an unrecorded call is exactly the gap this phase exists to close, and
 * refusing before dispatch spends nothing.
 *
 * The id is server-minted and is never accepted from a caller, so no client can name an
 * invocation, collide with one, or attach a proposal to somebody else's call.
 */
export async function registerInvocation(
  tenant: TenantContext | null,
  input: {
    readonly transport: "fake" | "live";
    /*
     * ON WHOSE BEHALF (SIA-2.6). The BRANDED proposer, never a bare id.
     *
     * REQUIRED, and the requirement is the point. The column is nullable because every row written
     * before it existed must stay honestly unattributed for ever — but no NEW row may be. Schema
     * permits NULL for history; this writer never produces one.
     *
     * A raw string parameter would let any caller claim any agent. `AgentProposer`'s brand is a
     * module-private symbol that exists at RUNTIME, so a value manufactured with a type cast
     * satisfies the compiler and fails the check below. That is what makes "no caller can name an
     * arbitrary agent" a property of the code rather than a convention.
     */
    readonly proposer: AgentProposer;
  },
  deps: InvocationProvenanceDeps = {},
): Promise<string | null> {
  if (typeof window !== "undefined") {
    throw new Error("Invocation provenance is server-only.");
  }
  if (!tenant?.tenantId || !tenant.userId) return null;
  /*
   * THE RUNTIME BRAND CHECK, mirroring `agentPairOrNull` in the proposal writer. It refuses rather
   * than storing an unverified id — and refusing here is free, because registration runs BEFORE any
   * provider dispatch, so nothing has been spent and no organizational work exists to destroy.
   */
  if (!isAgentProposer(input.proposer)) return null;
  const db = resolveDb(deps);
  if (!db) return null;

  const id = (deps.newInvocationId ?? randomUUID)();
  const now = (deps.now ?? (() => new Date()))();
  try {
    await db.insert(hebyOriginationInvocations).values({
      id,
      tenantId: tenant.tenantId,
      transport: input.transport,
      /*
       * The attribution, from the verified brand and nowhere else. Written beside the tenant this
       * context resolved, so the composite foreign key can bind the two.
       */
      agentId: input.proposer.agentId,
      state: "registered",
      filingOutcome: "not-attempted",
      createdAt: now,
      updatedAt: now,
      /* The human who stated the goal caused this call to exist. The AGENT is the proposer, and
       * that attribution lives on the proposal, not here. */
      createdBy: tenant.userId,
      createdByType: "human",
    });
    return id;
  } catch {
    return null;
  }
}

/**
 * Stage 2. Record how far the invocation got, and what the proposal authority answered.
 *
 * NEVER THROWS, AND ITS RESULT IS ADVISORY. By the time it runs a proposal may already exist and
 * carry this invocation's id; a failure here must not be able to undo that, so the caller is given
 * a boolean it is free to ignore rather than an exception it must handle.
 *
 * Scoped by tenant AND id, so one tenant's finalization can never touch another's row.
 */
export async function finalizeInvocation(
  tenant: TenantContext | null,
  input: {
    readonly invocationId: string;
    readonly state: OriginationInvocationState;
    readonly failureCode?: string;
    readonly result?: InvocationResultFacts;
    readonly filingOutcome?: OriginationFilingOutcome;
    readonly filingRefusal?: string;
  },
  deps: InvocationProvenanceDeps = {},
): Promise<boolean> {
  if (typeof window !== "undefined") {
    throw new Error("Invocation provenance is server-only.");
  }
  if (!tenant?.tenantId || !input.invocationId) return false;
  const db = resolveDb(deps);
  if (!db) return false;

  const now = (deps.now ?? (() => new Date()))();
  /* A refusal reason is meaningless without a refusal, so it is dropped rather than stored as a
   * value the CHECK constraint would have to reject. */
  const refusal = input.filingOutcome === "refused" ? input.filingRefusal : undefined;

  try {
    await db
      .update(hebyOriginationInvocations)
      .set({
        state: input.state,
        failureCode: input.failureCode ?? null,
        provider: input.result?.provider ?? null,
        model: input.result?.model ?? null,
        providerRequestId: input.result?.providerRequestId ?? null,
        inputTokens: input.result?.inputTokens ?? null,
        outputTokens: input.result?.outputTokens ?? null,
        filingOutcome: input.filingOutcome ?? "not-attempted",
        filingRefusal: refusal ?? null,
        finalizedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(hebyOriginationInvocations.id, input.invocationId),
          eq(hebyOriginationInvocations.tenantId, tenant.tenantId),
        ),
      );
    return true;
  } catch {
    return false;
  }
}

/** One invocation, as recorded. Diagnostic only — nothing decides anything from this. */
export interface InvocationProvenanceView {
  readonly invocationId: string;
  readonly transport: string;
  readonly state: string;
  readonly failureCode: string | null;
  readonly provider: string | null;
  readonly model: string | null;
  readonly providerRequestId: string | null;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly filingOutcome: string;
  readonly filingRefusal: string | null;
  /**
   * The proposal that names this invocation, when one does.
   *
   * READ FROM THE PROPOSAL SIDE, which is the authority. This is why a crash immediately after the
   * proposal commit loses nothing that matters: the link was written inside the proposal's own
   * INSERT, so it is here even when `filingOutcome` was never finalized.
   */
  readonly causedActionRequestId: string | null;
}

/**
 * Read one tenant's invocation and the proposal that names it.
 *
 * The join carries an explicit tenant equality on BOTH sides. The link column has no foreign key
 * (deliberately — an FK would let provenance veto a proposal insert), so the tenant predicate is
 * what makes a cross-tenant read impossible rather than merely unlikely.
 */
export async function readInvocationProvenance(
  tenant: TenantContext | null,
  invocationId: string,
  deps: InvocationProvenanceDeps = {},
): Promise<InvocationProvenanceView | null> {
  if (typeof window !== "undefined") {
    throw new Error("Invocation provenance is server-only.");
  }
  if (!tenant?.tenantId || !invocationId) return null;
  const db = resolveDb(deps);
  if (!db) return null;

  try {
    const rows = await db
      .select({
        invocationId: hebyOriginationInvocations.id,
        transport: hebyOriginationInvocations.transport,
        state: hebyOriginationInvocations.state,
        failureCode: hebyOriginationInvocations.failureCode,
        provider: hebyOriginationInvocations.provider,
        model: hebyOriginationInvocations.model,
        providerRequestId: hebyOriginationInvocations.providerRequestId,
        inputTokens: hebyOriginationInvocations.inputTokens,
        outputTokens: hebyOriginationInvocations.outputTokens,
        filingOutcome: hebyOriginationInvocations.filingOutcome,
        filingRefusal: hebyOriginationInvocations.filingRefusal,
        causedActionRequestId: hebyActionRequests.id,
      })
      .from(hebyOriginationInvocations)
      .leftJoin(
        hebyActionRequests,
        and(
          eq(hebyActionRequests.originationInvocationId, hebyOriginationInvocations.id),
          eq(hebyActionRequests.tenantId, hebyOriginationInvocations.tenantId),
        ),
      )
      .where(
        and(
          eq(hebyOriginationInvocations.id, invocationId),
          eq(hebyOriginationInvocations.tenantId, tenant.tenantId),
        ),
      )
      .limit(1);

    const row = rows[0];
    return row ? { ...row, causedActionRequestId: row.causedActionRequestId ?? null } : null;
  } catch {
    return null;
  }
}
