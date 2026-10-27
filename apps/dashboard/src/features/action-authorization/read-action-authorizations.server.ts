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
import { readGovernedWorkOutcomes } from "@/features/organizational-work/read-governed-work-outcomes.server";
import type { GovernedWorkOutcome } from "@/features/organizational-work/read-governed-work-outcomes.server";
import { RECORD_WORK_ACTION_KIND, SET_WORK_DECLARED_STATE_ACTION_KIND } from "@/features/heby-action-inlet/contracts";
import {
  isWorkDeclaredState,
  WORK_AUDIT_RECORDED,
  WORK_AUDIT_STATE_DECLARED,
  type WorkDeclaredState,
} from "@/features/organizational-work/work-contracts";
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
  /**
   * TRH-19 — WHY THE AGENT SAID IT PROPOSED THIS, as recorded when the proposal was filed.
   *
   * `null` means NO RATIONALE WAS DURABLY RECORDED. It does NOT mean the agent gave none, that the
   * reason was blank, or that a human filed it — every proposal filed before TRH-19 carries null
   * and none was backfilled. A surface must render that as UNAVAILABLE and must never render it as
   * "no reason given", which is a claim this record cannot support.
   *
   * It is the NORMALIZED rationale and nothing else: no raw provider response, no prompt, no goal
   * text, no provider error, no credential. Those never reached the column, so they cannot leave
   * through this view.
   *
   * IT IS NOT AUTHORITY. No decision predicate reads it, and it is not a Governance justification —
   * that is typed by a human at the decision and lives in `decision_records`.
   */
  readonly proposalRationale: string | null;
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
  /**
   * WHO PROPOSED THE ACT THIS PERMIT AUTHORIZES (Delivery Legibility).
   *
   * The same column the pending-request view has always projected, on a join this query has always
   * performed. It is carried here because automatic delivery is a question ONLY about an
   * agent-proposed act — the runtime discovery predicate refuses a human-proposed one — so without
   * it the surface cannot tell an authorization awaiting delivery from one that will never be
   * delivered, and would have to guess in whichever direction is convenient.
   *
   * No new query, no new join, no new seam and no new authority: one more column off a row this
   * reader already selects from.
   */
  readonly proposedByActorType: string;
  /**
   * THE STANDING ENVELOPE THIS PERMIT WAS ISSUED UNDER, OR NULL (RUNG 2).
   *
   * Carried so a surface can tell two very different provenances apart. `authorized_by_actor_id`
   * names a human in BOTH cases, and for a standing-issued permit that human did NOT read this act
   * and click Approve — they authorized it IN ADVANCE, inside a bounded envelope they can withdraw.
   * A surface that could not distinguish those would eventually imply the first while the second is
   * true, which is the class of claim this repository repairs rather than tolerates.
   */
  readonly standingAuthorizationId: string | null;
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
          /* TRH-19. Stored or null. Never substituted, never derived, never explained away. */
          proposalRationale: row.proposalRationale,
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
        proposedByActorType: hebyActionRequests.proposedByActorType,
        /* LEFT joined: a permit that was never spent has no attempt, and that is not an error. */
        standingAuthorizationId: actionPermits.standingAuthorizationId,
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
        ({
          permit,
          actionKind,
          toolId,
          targetLabel,
          proposedByActorType,
          standingAuthorizationId,
          attemptStatus,
          providerMessageId,
        }) => ({
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
          proposedByActorType,
          standingAuthorizationId: standingAuthorizationId ?? null,
        }),
      ),
    };
  } catch {
    return { status: "unavailable", reason: "read-failed" };
  }
}

/**
 * HEBY-REQUEST-LIFECYCLE — what happened, so far, to ONE request this tenant filed.
 *
 * Every column below is already owned and written elsewhere: the decision columns by Governance's
 * decision writer, the permit by Action Authorization, the attempt by the executor. This reads the
 * three rows the released invariants allow (one permit per request, one attempt per permit) and
 * derives nothing the rows do not state.
 *
 * REASONS ARE NOT PROJECTED. A rejection or revocation reason is a Governance author's text; this
 * read is open to any member of the tenant, so it says THAT a decision was taken and when, never why.
 */
export interface ActionRequestLifecycleView {
  readonly requestId: string;
  readonly actionKind: string;
  /** The approved `title` and target label as recorded on the request, else its descriptor effect sentence. */
  readonly label: string;
  readonly proposedByActorType: string;
  readonly proposedAt: string;
  readonly decision:
    | { readonly status: "pending" }
    | { readonly status: "approved"; readonly at: string; readonly standing: boolean }
    | { readonly status: "rejected"; readonly at: string };
  readonly permit: {
    /**
     * HEBY-EXECUTE-AUTHORIZED-1. The permit's own id, so the person can spend it from Heby through the
     * same named server action Approvals uses. An identifier, not an authority: spending still asks
     * the server for this tenant's Governance authority and refuses everyone else.
     */
    readonly permitId: string;
    readonly state: PermitDisplayState;
    readonly expiresAt: string;
    readonly consumedAt: string | null;
    readonly revokedAt: string | null;
  } | null;
  readonly execution: { readonly status: ExecutionAttemptStatus; readonly providerAccepted: boolean } | null;
  /**
   * HEBY-VERIFIED-WORK-OUTCOMES. For a `record-work` request whose permit was spent, the work that
   * spend produced, as Organizational Work links and reads it; `reference-unavailable` when that
   * authority cannot name it (no declared link, or it could not be read). `null` otherwise.
   *
   * OPERATIONAL-RELIABILITY-1 — the same for a spent `set-work-declared-state` request: the item whose
   * state that spend changed, named by the `work.state-declared` row the Work Authority wrote in the
   * spend's transaction. `stateChange` is the change the human approved (the bound payload), present
   * only with that link; it is never inferred from the permit alone.
   */
  readonly workOutcome:
    | ({
        readonly status: "recorded";
        readonly stateChange?: { readonly fromState: WorkDeclaredState; readonly toState: WorkDeclaredState };
      } & GovernedWorkOutcome)
    | { readonly status: "reference-unavailable" }
    | null;
}

export type ActionRequestLifecycleRead =
  | { readonly status: "read"; readonly lifecycle: ActionRequestLifecycleView }
  | { readonly status: "not-found" }
  | { readonly status: "unavailable"; readonly reason: string };

const REQUEST_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One query shape for every lifecycle read: request, its one permit, that permit's one attempt. */
function selectLifecycleRows(db: ControlPlaneDatabase) {
  return db
    .select({
      request: hebyActionRequests,
      permitId: actionPermits.id,
      permitStatus: actionPermits.status,
      permitExpiresAt: actionPermits.expiresAt,
      permitConsumedAt: actionPermits.consumedAt,
      permitRevokedAt: actionPermits.revokedAt,
      permitHandoffId: actionPermits.handoffId,
      attemptStatus: actionExecutionAttempts.status,
      providerMessageId: actionExecutionAttempts.providerMessageId,
    })
    .from(hebyActionRequests)
    .leftJoin(
      actionPermits,
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
    );
}

type LifecycleRow = Awaited<ReturnType<ReturnType<typeof selectLifecycleRows>["where"]>>[number];

/* The exact `title` the decision bound (canonical payload), the target it names, else the descriptor effect. */
function labelOf(request: LifecycleRow["request"]): string {
  const title = asCanonicalPayload(request.canonicalPayload)?.title;
  const parts = [typeof title === "string" ? title : null, request.targetLabel].filter((p): p is string => !!p);
  return parts.length > 0 ? parts.join(" · ") : request.expectedEffect;
}

/* The governed work acts whose spend names a work item, and the audit action that names it. */
const WORK_LINK_ACTION: Readonly<Record<string, typeof WORK_AUDIT_RECORDED | typeof WORK_AUDIT_STATE_DECLARED>> = {
  [RECORD_WORK_ACTION_KIND]: WORK_AUDIT_RECORDED,
  [SET_WORK_DECLARED_STATE_ACTION_KIND]: WORK_AUDIT_STATE_DECLARED,
};

/** The spend whose work outcome this row may name: a consumed `record-work` or state-change permit, else none. */
const spentWorkHandoff = (row: LifecycleRow): string | null =>
  WORK_LINK_ACTION[row.request.actionKind] !== undefined && row.permitStatus === "consumed" ? row.permitHandoffId : null;

/** One read per act of the work outcomes for these rows' spends, through the authority that declared them. */
async function workOutcomesFor(
  tenant: TenantContext,
  rows: readonly LifecycleRow[],
  getDb: (() => ControlPlaneDatabase | null) | undefined,
): Promise<ReadonlyMap<string, GovernedWorkOutcome> | null> {
  const byHandoff = new Map<string, GovernedWorkOutcome>();
  for (const action of new Set(Object.values(WORK_LINK_ACTION))) {
    const handoffs = rows
      .filter((row) => WORK_LINK_ACTION[row.request.actionKind] === action)
      .map(spentWorkHandoff)
      .filter((id): id is string => id !== null);
    if (handoffs.length === 0) continue;
    const read = await readGovernedWorkOutcomes(tenant, handoffs, { getDb }, action);
    if (read.status !== "read") return null;
    for (const [handoff, work] of read.byHandoff) byHandoff.set(handoff, work);
  }
  return byHandoff;
}

/** The state change the human approved, from the bound payload — or `undefined` if it is not one. */
function approvedStateChange(request: LifecycleRow["request"]) {
  if (request.actionKind !== SET_WORK_DECLARED_STATE_ACTION_KIND) return undefined;
  const payload = asCanonicalPayload(request.canonicalPayload);
  const fromState = payload?.["fromState"];
  const toState = payload?.["toState"];
  return isWorkDeclaredState(fromState) && isWorkDeclaredState(toState) && fromState !== toState
    ? { fromState, toState }
    : undefined;
}

function toLifecycleView(
  row: LifecycleRow,
  now: Date,
  outcomes: ReadonlyMap<string, GovernedWorkOutcome> | null,
): ActionRequestLifecycleView {
  const handoff = spentWorkHandoff(row);
  const stateChange = approvedStateChange(row.request);
  const work = handoff === null ? undefined : outcomes?.get(handoff);
  const { request } = row;
  return {
    requestId: request.id,
    actionKind: request.actionKind,
    label: labelOf(request),
    proposedByActorType: request.proposedByActorType,
    proposedAt: iso(request.createdAt) ?? "",
    decision:
      request.status === "approved" && request.approvedAt
        ? { status: "approved", at: iso(request.approvedAt) ?? "", standing: request.standingAuthorizationId !== null }
        : request.status === "rejected" && request.rejectedAt
          ? { status: "rejected", at: iso(request.rejectedAt) ?? "" }
          : { status: "pending" },
    permit:
      row.permitId === null || row.permitStatus === null || row.permitExpiresAt === null
        ? null
        : {
            permitId: row.permitId,
            state: derivePermitState(row.permitStatus, row.permitExpiresAt, now),
            expiresAt: iso(row.permitExpiresAt) ?? "",
            consumedAt: iso(row.permitConsumedAt),
            revokedAt: iso(row.permitRevokedAt),
          },
    execution:
      row.attemptStatus === null
        ? null
        : {
            status: row.attemptStatus as ExecutionAttemptStatus,
            providerAccepted: row.attemptStatus === "accepted" && row.providerMessageId !== null,
          },
    workOutcome:
      handoff === null
        ? null
        : work
          ? { status: "recorded", ...work, ...(stateChange ? { stateChange } : {}) }
          : { status: "reference-unavailable" },
  };
}

export async function readActionRequestLifecycle(
  tenant: TenantContext | null,
  requestId: string,
  deps: { readonly getDb?: () => ControlPlaneDatabase | null; readonly now?: () => Date } = {},
): Promise<ActionRequestLifecycleRead> {
  if (typeof window !== "undefined") throw new Error("Action authorization reads are server-only.");
  if (!tenant?.tenantId) return { status: "unavailable", reason: "no-authorized-tenant-context" };
  /* Not an id this table could hold — the same answer as a foreign or unknown one. */
  if (typeof requestId !== "string" || !REQUEST_ID_RE.test(requestId)) return { status: "not-found" };
  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return { status: "unavailable", reason: "persistence-not-configured" };
  const now = (deps.now ?? (() => new Date()))();

  try {
    const [row] = await selectLifecycleRows(db)
      .where(and(eq(hebyActionRequests.tenantId, tenant.tenantId), eq(hebyActionRequests.id, requestId)))
      .limit(1);
    if (!row) return { status: "not-found" };
    const outcomes = await workOutcomesFor(tenant, [row], deps.getDb);
    return { status: "read", lifecycle: toLifecycleView(row, now, outcomes) };
  } catch {
    return { status: "unavailable", reason: "read-failed" };
  }
}

/** How many of a person's own requests Heby lists. A window, never a total. */
export const MY_ACTION_REQUESTS_LIMIT = 10 as const;

export type MyActionRequestLifecyclesRead =
  | { readonly status: "read"; readonly items: readonly ActionRequestLifecycleView[]; readonly more: boolean }
  | { readonly status: "unavailable"; readonly reason: string };

/**
 * HEBY-MY-REQUESTS — the requests THIS PERSON caused to be filed, newest first, with their lifecycle.
 *
 * "Mine" is the row's own creation attribution: the single writer (`record-action-request.server.ts`)
 * stamps `created_by` with the authenticated human whose request filed the row, for a human proposal
 * AND for an agent proposal that person asked for. Nothing is inferred from conversation history.
 * Tenant AND person are predicates; another member's requests are not in this read.
 */
export async function readMyActionRequestLifecycles(
  tenant: TenantContext | null,
  deps: { readonly getDb?: () => ControlPlaneDatabase | null; readonly now?: () => Date } = {},
): Promise<MyActionRequestLifecyclesRead> {
  if (typeof window !== "undefined") throw new Error("Action authorization reads are server-only.");
  if (!tenant?.tenantId || !tenant.userId) return { status: "unavailable", reason: "no-authorized-tenant-context" };
  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return { status: "unavailable", reason: "persistence-not-configured" };
  const now = (deps.now ?? (() => new Date()))();

  try {
    /* ponytail: no (tenant, created_by) index; the tenant predicate bounds the scan. Add one if a tenant's request count grows large. */
    const rows = await selectLifecycleRows(db)
      .where(
        and(
          eq(hebyActionRequests.tenantId, tenant.tenantId),
          eq(hebyActionRequests.createdBy, tenant.userId),
          eq(hebyActionRequests.createdByType, "human"),
        ),
      )
      .orderBy(desc(hebyActionRequests.createdAt), desc(hebyActionRequests.id))
      .limit(MY_ACTION_REQUESTS_LIMIT + 1);
    const shown = rows.slice(0, MY_ACTION_REQUESTS_LIMIT);
    const outcomes = await workOutcomesFor(tenant, shown, deps.getDb);
    return {
      status: "read",
      items: shown.map((row) => toLifecycleView(row, now, outcomes)),
      more: rows.length > MY_ACTION_REQUESTS_LIMIT,
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
