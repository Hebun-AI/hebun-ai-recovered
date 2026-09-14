/*
 * action-authorization/machine-execution-principal.server.ts — the EPHEMERAL principal that lets a
 * MACHINE spend one already-authorized permit, and the only place one can come into being (RUNG 1).
 *
 * ── WHY IT LIVES WITH THE PERMIT AUTHORITY ───────────────────────────────────
 *
 * The authority that owns a permit owns who may spend one. Minting this anywhere else would let a
 * caller define its own idea of a legitimate spender and hand it to a writer with no way to
 * disagree — the same reasoning that put `AgentProposer` beside the proposal writer.
 *
 * ── IT IS DELIBERATELY NOT A `TenantContext` ─────────────────────────────────
 *
 * PRINCIPAL-FW-1 made `TenantContext` nominally human so that a future machine principal would be a
 * DIFFERENT type and therefore structurally unable to reach the call sites that stamp
 * `actor_type = 'human'`. This is that different type, and it inherits nothing from that one.
 *
 * TRH-23 minted the first such principal for standing OBSERVATION. This is its sibling for one
 * exact governed internal MUTATION, and it is a sibling rather than an extension on purpose: the
 * observation principal is minted from a standing authorization that permits a scope REPEATEDLY,
 * and quietly teaching it to mutate would turn a read permission into a write one.
 *
 * ── THE CALLER SUPPLIES A PERMIT ID AND NOTHING ELSE ─────────────────────────
 *
 * There is no parameter for a tenant, an agent, an action kind or a payload. Every field below is
 * READ OFF THE PERMIT AND ITS REQUEST. This is the whole answer to "how does a machine obtain
 * trusted tenant identity": it does not supply one. It names a permit, and the tenant is a property
 * of that row.
 *
 *     CLIENT-SUPPLIED TENANT IS UNREPRESENTABLE, NOT MERELY REJECTED.
 *
 * ── THE TRIGGERING AGENT IS THE PROPOSER ON THE RECORD ───────────────────────
 *
 * A machine may only spend a permit whose request an AGENT proposed, and the agent it names is the
 * one `proposed_by_actor_id` already records. A human-proposed request is refused here: a human who
 * proposes an act and never returns to perform it has not asked for it to be performed unattended.
 *
 * AGENT LIVENESS IS DELIBERATELY NOT RE-READ. What makes the spend legitimate is the human
 * Governance authorization, and that authorization was granted with this proposer on the record.
 * Re-checking the agent's lifecycle here would invent a refusal the deciding human never
 * contemplated, and would make this module a second reader of an identity AGENT-ID-0.1 owns. An
 * agent that must be stopped is stopped by the released controls: the kill switch, and revoking the
 * permit.
 *
 * ── MINTING IS NOT AUTHORIZATION ─────────────────────────────────────────────
 *
 * A principal is EVIDENCE THAT AN ACTIVE PERMIT WAS READ, never a decision that it may now be
 * spent. Nothing here writes, nothing here locks, and the authoritative single-spend check runs
 * afterwards in the one released statement that owns it. A principal minted against a permit that
 * another caller spends first buys nothing: the spend refuses, exactly as it would for a human.
 *
 * ── THE BRAND IS A RUNTIME SYMBOL ────────────────────────────────────────────
 *
 * Module-private and never exported, so no other module can write the key into an object literal,
 * and it exists at RUNTIME so a type cast cannot forge one either. `AgentProposer`, `AgentAuthorship`
 * and the observation principal all use this technique for the same reason.
 *
 * Server-only.
 */
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { type ControlPlaneDatabase } from "@/db/client.server";
import { actionPermits, hebyActionRequests } from "@/db/schema/action-authorization";

const machineExecutionPrincipalBrand: unique symbol = Symbol("hebun.machineExecutionPrincipal");

/**
 * A machine's permission-shaped EVIDENCE that one exact permit exists and names an agent proposer.
 *
 * It carries no credential, no session, no membership and no role. It is thrown away at the end of
 * the invocation that minted it and is persisted nowhere: there is no principal table and no column
 * anywhere that names one.
 */
export interface MachineExecutionPrincipal {
  readonly [machineExecutionPrincipalBrand]: true;
  /** Read off the permit. NEVER supplied by a caller. */
  readonly tenantId: string;
  /** The exact permit this principal was minted for, and the only one it can be spent against. */
  readonly permitId: string;
  /** Read off the request. The act the authorization actually covers. */
  readonly actionKind: string;
  /** Read off the request's `proposed_by_actor_id`. The durable agent that originated the act. */
  readonly agentId: string;
  /** THIS RUN. Minted here, durable only as the audit correlation of the execution it causes. */
  readonly invocationId: string;
}

export type MachinePrincipalRefusal =
  /** No permit with that id, in any tenant, in a reachable control plane. */
  | "permit-unresolved"
  /** The permit is not `active` — spent, revoked or expired. Refused before anything is attempted. */
  | "permit-not-active"
  /** The request was proposed by a human. Unattended execution was never asked for. */
  | "not-agent-proposed"
  /** The control plane could not be reached. Nothing was read and nothing was decided. */
  | "persistence-unavailable";

export type MachinePrincipalResult =
  | { readonly status: "minted"; readonly principal: MachineExecutionPrincipal }
  | { readonly status: "refused"; readonly reason: MachinePrincipalRefusal };

/** The read capability this mint needs, and nothing else. It cannot insert, update or delete. */
export type MachinePrincipalReadTx = Pick<ControlPlaneDatabase, "select">;

/**
 * Mint one ephemeral machine execution principal from a permit id.
 *
 * `active` is checked here as an EARLY REFUSAL, not as the authority: the permit could be spent by
 * somebody else between this read and the spend, and the released single-spend statement is what
 * settles that race. Reading it here only avoids minting a principal for an authorization that was
 * already obviously gone.
 */
export async function mintMachineExecutionPrincipal(
  tx: MachinePrincipalReadTx,
  input: { readonly permitId: string },
): Promise<MachinePrincipalResult> {
  const permitId = typeof input?.permitId === "string" ? input.permitId : "";
  if (permitId.length === 0) return { status: "refused", reason: "permit-unresolved" };

  try {
    const permitRows = await tx
      .select({
        id: actionPermits.id,
        tenantId: actionPermits.tenantId,
        status: actionPermits.status,
        actionRequestId: actionPermits.actionRequestId,
      })
      .from(actionPermits)
      .where(eq(actionPermits.id, permitId))
      .limit(1);

    const permit = permitRows[0];
    if (!permit) return { status: "refused", reason: "permit-unresolved" };
    if (permit.status !== "active") return { status: "refused", reason: "permit-not-active" };

    /* The request is located UNDER THE PERMIT'S OWN TENANT, so no id can reach across tenants. */
    const requestRows = await tx
      .select({
        actionKind: hebyActionRequests.actionKind,
        proposedByActorType: hebyActionRequests.proposedByActorType,
        proposedByActorId: hebyActionRequests.proposedByActorId,
      })
      .from(hebyActionRequests)
      .where(
        and(
          eq(hebyActionRequests.id, permit.actionRequestId),
          eq(hebyActionRequests.tenantId, permit.tenantId),
        ),
      )
      .limit(1);

    const request = requestRows[0];
    if (!request) return { status: "refused", reason: "permit-unresolved" };
    if (request.proposedByActorType !== "agent") {
      return { status: "refused", reason: "not-agent-proposed" };
    }

    return {
      status: "minted",
      principal: {
        [machineExecutionPrincipalBrand]: true,
        tenantId: permit.tenantId,
        permitId: permit.id,
        actionKind: request.actionKind,
        agentId: request.proposedByActorId,
        invocationId: randomUUID(),
      },
    };
  } catch {
    return { status: "refused", reason: "persistence-unavailable" };
  }
}

/**
 * RUNTIME proof that a value came from {@link mintMachineExecutionPrincipal}.
 *
 * A type cast cannot produce the symbol, so a forged object literal fails here rather than reaching
 * a spend.
 */
export function isMachineExecutionPrincipal(value: unknown): value is MachineExecutionPrincipal {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Record<symbol, unknown>)[machineExecutionPrincipalBrand] === true
  );
}
