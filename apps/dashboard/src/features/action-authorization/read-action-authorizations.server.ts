/*
 * action-authorization/read-action-authorizations.server.ts — what the Director surface may show
 * (R3A).
 *
 * TENANT-SCOPED BY PREDICATE, NOT BY CALLER DISCIPLINE. Every query here carries
 * `tenant_id = <session tenant>`; there is no unscoped read and no parameter through which a
 * caller could ask about another tenant.
 *
 * EXPIRY IS COMPUTED HERE, NOT STORED. `expires_at <= now()` is the whole mechanism, so a permit
 * that is `active` in the column and past its expiry is reported as expired. The surface must show
 * the derived truth, because that is the truth consumption will apply.
 *
 * READ ONLY. No insert, update, delete or transaction appears in this module.
 *
 * ── APP-2: THREE COLUMNS THAT WERE ALREADY BEING SELECTED, AND WERE NOT PROJECTED ────────────
 *
 * `select()` has always returned the whole row, so `evidence`, `proposed_by_actor_type` and
 * `side_effect` were in hand and dropped on the floor by the mapping. The surface then said, of a
 * live request, that no evidence was attached — an absence it had never established — and showed no
 * proposer at all. Projecting them adds no query, no seam and no authority: it stops discarding
 * what this reader already holds.
 *
 * NOTHING IS RESOLVED. An evidence entry is carried exactly as the proposal recorded it. This
 * module dereferences no reference, calls no model or provider, reads no Knowledge, and resolves no
 * Governance authority — it did none of those before and does none of them now.
 *
 * Server-only.
 */
import { and, desc, eq } from "drizzle-orm";
import { type ControlPlaneDatabase } from "@/db/client.server";
import { actionPermits, hebyActionRequests } from "@/db/schema/action-authorization";
import { actionExecutionAttempts } from "@/db/schema/action-execution";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import type { ExecutionAttemptStatus } from "@/features/action-execution/contracts";
import { resolveGovernanceDbOrNull } from "@/features/governance-decision/persistence.server";
import {
  resolveAgentProposerDisplays,
  type AgentProposerDisplay,
} from "./agent-proposer-display.server";
import { readWorkRegister } from "@/features/organizational-work/read-work.server";
import { asCanonicalPayload } from "./canonical-payload";
import { splitPayload, toEvidence } from "./decision-projection";
import type { EvidenceProjection, PayloadLockView } from "./decision-projection";
/* Re-exported so the surface keeps importing its view types from the one seam it already reads. */
export type {
  EvidenceProjection,
  EvidenceReferenceView,
  PayloadLockView,
} from "./decision-projection";

/** The derived state a human is shown. `expired` exists here and nowhere in the database. */
export type PermitDisplayState = "active" | "expired" | "consumed" | "revoked" | "none";

export interface PendingActionRequestView {
  readonly requestId: string;
  readonly actionKind: string;
  readonly toolId: string;
  readonly sideEffect: string;
  readonly reversibility: string;
  readonly targetKind: string | null;
  readonly targetRef: string | null;
  readonly targetLabel: string | null;
  readonly expectedEffect: string;
  readonly consequences: readonly string[];
  readonly parameters: readonly { readonly name: string; readonly value: string }[];
  /** The integrity values, split out of `parameters`. See `splitPayload`. */
  readonly locks: readonly PayloadLockView[];
  /** The evidence the PROPOSAL recorded, projected — never resolved, enriched or invented. */
  readonly evidence: EvidenceProjection;
  /*
   * WHO PROPOSED THIS — the actor CLASS, and deliberately not the actor id.
   *
   * A1a made `proposed_by_actor_type` truthful in the database and nothing has ever read it, so a
   * human authorizing an irreversible action cannot see who originated it. Today that is invisible
   * because every proposal is human; the moment an agent may propose, it is the difference between
   * authorizing a person's request and a machine's.
   *
   * The actor ID is NOT projected. This view crosses into a client component, so every field on it
   * is serialized to the browser; a raw uuid is not a name, no identity display seam exists to turn
   * it into one, and carrying it would ship an internal identifier that nothing renders. The class
   * is what the decision turns on.
   */
  readonly proposedByActorType: string;
  /**
   * WHICH agent proposed it, when one did (AGENT-PROPOSAL-2).
   *
   * `null` for a human proposal, and `null` for an agent id this tenant does not own or that the
   * identity authority could not answer for. NEVER the raw uuid as a fallback label: the id stays
   * on the server, and a surface that cannot name the agent falls back to the actor CLASS it
   * already had rather than to an internal identifier.
   */
  readonly proposedByAgentName: string | null;
  /** False when that agent has since been retired. The proposal it made is unaffected. */
  readonly proposedByAgentInService: boolean | null;
  readonly payloadDigest: string;
  readonly proposedAt: string;
  /**
   * PBGA-1 — THE DECLARED ORGANIZATIONAL PURPOSE, so the approver knows what they are authorizing
   * this act FOR before they decide.
   *
   * `null` means NO PURPOSE WAS DECLARED IN THIS RECORD. It does not mean the act is purposeless,
   * unrelated to work, or improper, and the surface renders it as "Not declared" rather than
   * "No purpose". Every request filed before this capability is null, and none was backfilled.
   *
   * The TITLE comes from the Work authority, resolved server-side. The work item id is deliberately
   * NOT projected: this view crosses to a client component, APP-2's data minimization applies, and
   * a raw uuid is not a purpose.
   */
  readonly purposeWorkTitle: string | null;
  /**
   * True when a purpose was declared but the Work authority could not answer for it — UNKNOWN, not
   * absent. A surface must never render this as "Not declared".
   */
  readonly purposeUnresolved: boolean;
}

export interface ActionPermitView {
  readonly permitId: string;
  readonly requestId: string;
  readonly actionKind: string;
  readonly toolId: string;
  readonly targetLabel: string | null;
  readonly state: PermitDisplayState;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly consumedAt: string | null;
  readonly revokedAt: string | null;
  readonly revocationReason: string | null;
  readonly boundPayloadDigest: string;
  /**
   * REPAIRED AT R3B. This was hard-coded `false` and captioned "always false in R3A", which became
   * a lie the moment an execution runtime shipped: a consumed permit may now have an attempt
   * behind it. It is DERIVED from that attempt.
   *
   * `null` means no attempt exists — the permit was never spent, or was spent and the attempt row
   * is the thing that failed to write (in which case the spend rolled back with it, so there is no
   * permit state left claiming otherwise).
   */
  readonly executionStatus: ExecutionAttemptStatus | null;
  /**
   * True ONLY when a provider accepted the operation and returned an id. Never true for `unknown`:
   * the whole point of that state is that Hebun cannot claim an effect it cannot prove.
   */
  readonly providerAccepted: boolean;
  /** Present only on acceptance. The provider's own id, the only receipt metadata carried. */
  readonly providerMessageId: string | null;
}

export type ActionAuthorizationRead<T> =
  | { readonly status: "read"; readonly items: readonly T[] }
  | { readonly status: "unavailable"; readonly reason: string };

function toConsequences(raw: unknown): readonly string[] {
  return Array.isArray(raw) ? raw.filter((v): v is string => typeof v === "string") : [];
}

function iso(value: Date | string | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

/** Every action still awaiting a human decision in this tenant. */
export async function readPendingActionRequests(
  tenant: TenantContext | null,
  deps: { readonly getDb?: () => ControlPlaneDatabase | null; readonly limit?: number } = {},
): Promise<ActionAuthorizationRead<PendingActionRequestView>> {
  if (typeof window !== "undefined") throw new Error("Action authorization reads are server-only.");
  if (!tenant?.tenantId) return { status: "unavailable", reason: "no-authorized-tenant-context" };
  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return { status: "unavailable", reason: "persistence-not-configured" };

  try {
    const rows = await db
      .select()
      .from(hebyActionRequests)
      .where(
        and(
          eq(hebyActionRequests.tenantId, tenant.tenantId),
          eq(hebyActionRequests.status, "pending"),
        ),
      )
      .orderBy(desc(hebyActionRequests.createdAt))
      .limit(deps.limit ?? 50);

    /*
     * WHO PROPOSED, BY NAME (AGENT-PROPOSAL-2).
     *
     * ONE lookup for the whole page, not one per row: the identity seam answers with the tenant's
     * whole identity state, so asking it per proposal would be the same read repeated. The raw ids
     * are collected here, consulted on the SERVER, and never placed on the view — APP-2's data
     * minimization is unchanged, and the only thing that crosses to the client is a name.
     */
    const agentIds = rows
      .filter((row) => row.proposedByActorType === "agent")
      .map((row) => row.proposedByActorId);
    const displays: ReadonlyMap<string, AgentProposerDisplay> =
      agentIds.length > 0
        ? await resolveAgentProposerDisplays(tenant, agentIds, { getDb: deps.getDb })
        : new Map();

    /*
     * PBGA-1 — WHAT THE DECLARED PURPOSE IS CALLED.
     *
     * ONE read for the whole page, and only when something on it declared a purpose, mirroring the
     * agent-name resolution directly above. It goes through the RELEASED Work register seam rather
     * than joining `work_items` here: Organizational Work owns what its work is called, and a join
     * would make this module a second reader of that authority's rows.
     *
     * A work item the register cannot answer for stays UNRESOLVED. It is never replaced by its id,
     * by a guess, or by silence — the released Human Legibility rule, applied to a different kind
     * of referent.
     */
    const purposeIds = new Set(
      rows.map((row) => row.purposeWorkItemId).filter((id): id is string => id !== null),
    );
    const workTitles = new Map<string, string>();
    if (purposeIds.size > 0) {
      /*
       * THE INJECTED DATABASE IS FORWARDED, and it must be. This read shipped calling the register
       * with the tenant alone while the query above honoured `deps.getDb`, so one function reached
       * two different databases whenever a caller injected one: the requests came from the injected
       * handle and the titles from whatever the default resolver found. A caller that injected a
       * database it could read got `purposeUnresolved: true` for a purpose that was declared and
       * resolvable — an UNKNOWN manufactured by the seam rather than observed in the record.
       */
      const register = await readWorkRegister(tenant, { getDb: deps.getDb });
      if (register.status === "available") {
        for (const item of register.items) {
          if (purposeIds.has(item.workItemId)) workTitles.set(item.workItemId, item.title);
        }
      }
    }

    return {
      status: "read",
      items: rows.map((row) => {
        const { parameters, locks } = splitPayload(asCanonicalPayload(row.canonicalPayload));
        const display =
          row.proposedByActorType === "agent" ? displays.get(row.proposedByActorId) : undefined;
        return {
          requestId: row.id,
          actionKind: row.actionKind,
          toolId: row.toolId,
          sideEffect: row.sideEffect,
          reversibility: row.reversibility,
          targetKind: row.targetKind,
          targetRef: row.targetRef,
          targetLabel: row.targetLabel,
          expectedEffect: row.expectedEffect,
          consequences: toConsequences(row.consequences),
          parameters,
          locks,
          evidence: toEvidence(row.evidence),
          proposedByActorType: row.proposedByActorType,
          proposedByAgentName: display?.name ?? null,
          proposedByAgentInService: display ? display.inService : null,
          payloadDigest: row.payloadDigest,
          proposedAt: iso(row.createdAt) ?? "",
          purposeWorkTitle:
            row.purposeWorkItemId === null ? null : (workTitles.get(row.purposeWorkItemId) ?? null),
          purposeUnresolved:
            row.purposeWorkItemId !== null && !workTitles.has(row.purposeWorkItemId),
        };
      }),
    };
  } catch {
    return { status: "unavailable", reason: "read-failed" };
  }
}

/** Every permit this tenant holds, with expiry derived at read time. */
export async function readActionPermits(
  tenant: TenantContext | null,
  deps: {
    readonly getDb?: () => ControlPlaneDatabase | null;
    readonly limit?: number;
    readonly now?: () => Date;
  } = {},
): Promise<ActionAuthorizationRead<ActionPermitView>> {
  if (typeof window !== "undefined") throw new Error("Action authorization reads are server-only.");
  if (!tenant?.tenantId) return { status: "unavailable", reason: "no-authorized-tenant-context" };
  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return { status: "unavailable", reason: "persistence-not-configured" };
  const now = (deps.now ?? (() => new Date()))();

  try {
    const rows = await db
      .select({
        permit: actionPermits,
        actionKind: hebyActionRequests.actionKind,
        toolId: hebyActionRequests.toolId,
        targetLabel: hebyActionRequests.targetLabel,
        /* LEFT joined: a permit that was never spent has no attempt, and that is not an error. */
        attemptStatus: actionExecutionAttempts.status,
        providerMessageId: actionExecutionAttempts.providerMessageId,
      })
      .from(actionPermits)
      .innerJoin(
        hebyActionRequests,
        and(
          eq(actionPermits.actionRequestId, hebyActionRequests.id),
          eq(actionPermits.tenantId, hebyActionRequests.tenantId),
        ),
      )
      .leftJoin(
        actionExecutionAttempts,
        and(
          eq(actionExecutionAttempts.permitId, actionPermits.id),
          eq(actionExecutionAttempts.tenantId, actionPermits.tenantId),
        ),
      )
      .where(eq(actionPermits.tenantId, tenant.tenantId))
      .orderBy(desc(actionPermits.issuedAt))
      .limit(deps.limit ?? 50);

    return {
      status: "read",
      items: rows.map(
        ({ permit, actionKind, toolId, targetLabel, attemptStatus, providerMessageId }) => ({
          permitId: permit.id,
          requestId: permit.actionRequestId,
          actionKind,
          toolId,
          targetLabel,
          state: derivePermitState(permit.status, permit.expiresAt, now),
          issuedAt: iso(permit.issuedAt) ?? "",
          expiresAt: iso(permit.expiresAt) ?? "",
          consumedAt: iso(permit.consumedAt),
          revokedAt: iso(permit.revokedAt),
          revocationReason: permit.revocationReason,
          boundPayloadDigest: permit.boundPayloadDigest,
          executionStatus: (attemptStatus as ExecutionAttemptStatus | null) ?? null,
          /* Acceptance requires BOTH, exactly as the database CHECK requires both. */
          providerAccepted: attemptStatus === "accepted" && providerMessageId !== null,
          providerMessageId: providerMessageId ?? null,
        }),
      ),
    };
  } catch {
    return { status: "unavailable", reason: "read-failed" };
  }
}

/**
 * The derived display state.
 *
 * `consumed` and `revoked` are terminal and outrank the clock: a permit that was spent before it
 * expired was spent, and saying "expired" afterwards would misreport what happened.
 */
export function derivePermitState(
  status: string,
  expiresAt: Date | string,
  now: Date,
): PermitDisplayState {
  if (status === "consumed") return "consumed";
  if (status === "revoked") return "revoked";
  if (status !== "active") return "none";
  const expiry = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  return expiry.getTime() <= now.getTime() ? "expired" : "active";
}
