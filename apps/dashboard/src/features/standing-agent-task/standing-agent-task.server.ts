/*
 * standing-agent-task/standing-agent-task.server.ts — P5-5. The ONE writer of standing agent task
 * authorizations, mirroring P6-2's standing research writer.
 *
 * Authorize and withdraw are each a Governance decision by a person holding Governance authority, written
 * in one transaction with the revision and the decision's audit row. One lineage per (tenant, template):
 * a stale view is refused, a withdrawal carries forward what it ends, a Free plan cannot be granted one
 * (P5-4). Agent eligibility is checked by every run, before the model, not at grant time.
 *
 * Server-only.
 */
import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { standingAgentTaskAuthorizations } from "@/db/schema/standing-agent-task";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { recordGovernanceEventWithin } from "@/features/governance-audit/governance-decision-audit.server";
import { resolveGovernanceAuthority, type GovernanceAuthorityResolution } from "@/features/governance-decision/authority-read.server";
import { writeGovernanceDecisionWithin } from "@/features/governance-decision/decision-authority.server";
import { validateJustification } from "@/features/governance-decision/persistence.server";
import { readTenantPlan } from "@/features/tenant-entitlements/tenant-dispatch-ceiling.server";
import { planFeatures } from "@/features/tenant-entitlements/plans";
import {
  MAX_AGENT_TASK_BRIEF_CHARACTERS,
  MAX_AGENT_TASK_TITLE_CHARACTERS,
  STANDING_AGENT_TASK_AUTHORIZE_DECISION_TYPE,
  STANDING_AGENT_TASK_SUBJECT_TYPE,
  STANDING_AGENT_TASK_TEMPLATES,
  STANDING_AGENT_TASK_WITHDRAW_DECISION_TYPE,
  type StandingAgentTaskAuthorizationRecord,
  type StandingAgentTaskRefusal,
  type StandingAgentTaskState,
  type StandingAgentTaskTemplate,
  type StandingAgentTaskWriteResult,
} from "./contracts";

export interface StandingAgentTaskDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly now?: () => Date;
  /** Injected only so a test can resolve authority and eligibility against its own database. */
  readonly resolveAuthority?: (tenant: TenantContext) => Promise<GovernanceAuthorityResolution>;
}

class Abort extends Error {
  constructor(readonly refusal: StandingAgentTaskRefusal) {
    super(refusal);
  }
}

function resolveDbOrNull(deps: { readonly getDb?: () => ControlPlaneDatabase | null }): ControlPlaneDatabase | null {
  if (deps.getDb) return deps.getDb();
  try {
    return getControlPlaneDb();
  } catch {
    return null;
  }
}

const isUniqueViolation = (error: unknown): boolean => {
  const code = (v: unknown) => (typeof v === "object" && v !== null ? (v as { code?: unknown }).code : undefined);
  return code(error) === "23505" || code((error as { cause?: unknown } | null)?.cause) === "23505";
};

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

export function isStandingAgentTaskTemplate(value: unknown): value is StandingAgentTaskTemplate {
  return typeof value === "string" && (STANDING_AGENT_TASK_TEMPLATES as readonly string[]).includes(value);
}

type Row = typeof standingAgentTaskAuthorizations.$inferSelect;

function toRecord(row: Row): StandingAgentTaskAuthorizationRecord {
  return {
    authorizationId: row.id,
    template: row.template as StandingAgentTaskTemplate,
    authorizationRevision: row.authorizationRevision,
    state: row.state as StandingAgentTaskState,
    workItemId: row.workItemId,
    agentId: row.agentId,
    title: row.title,
    brief: row.brief,
    governanceDecisionId: row.governanceDecisionId,
    authorizedByActorId: row.authorizedByActorId,
    authorizedAt: row.authorizedAt.toISOString(),
    supersedesAuthorizationId: row.supersedesAuthorizationId,
  };
}

/** The effective (highest) revision of one tenant's lineage for one template. */
export async function readEffectiveAgentTaskWithin(
  reader: Pick<ControlPlaneDatabase, "select">,
  tenantId: string,
  template: StandingAgentTaskTemplate,
): Promise<StandingAgentTaskAuthorizationRecord | null> {
  const rows = await reader
    .select()
    .from(standingAgentTaskAuthorizations)
    .where(and(eq(standingAgentTaskAuthorizations.tenantId, tenantId), eq(standingAgentTaskAuthorizations.template, template)))
    .orderBy(desc(standingAgentTaskAuthorizations.authorizationRevision))
    .limit(1);
  return rows[0] ? toRecord(rows[0]) : null;
}

/** Both templates' effective revisions for this session's tenant. */
export async function readStandingAgentTasks(
  tenant: TenantContext | null,
  deps: Pick<StandingAgentTaskDeps, "getDb"> = {},
): Promise<
  | { readonly status: "read"; readonly authorizations: Readonly<Record<StandingAgentTaskTemplate, StandingAgentTaskAuthorizationRecord | null>> }
  | { readonly status: "unavailable" }
> {
  if (!tenant?.tenantId || !tenant.userId) return { status: "unavailable" };
  const db = resolveDbOrNull(deps);
  if (!db) return { status: "unavailable" };
  try {
    const [content, operations] = await Promise.all(
      STANDING_AGENT_TASK_TEMPLATES.map((template) => readEffectiveAgentTaskWithin(db, tenant.tenantId, template)),
    );
    return { status: "read", authorizations: { "weekly-content-plan": content ?? null, "weekly-operations-summary": operations ?? null } };
  } catch {
    return { status: "unavailable" };
  }
}

export interface AuthorizeStandingAgentTaskInput {
  readonly template: unknown;
  readonly workItemId: unknown;
  readonly agentId: unknown;
  readonly title: unknown;
  readonly brief: unknown;
  readonly justification: unknown;
  /** The revision the person was looking at; `null` when none existed. */
  readonly observedAuthorizationRevision: number | null;
}

export interface WithdrawStandingAgentTaskInput {
  readonly template: unknown;
  readonly justification: unknown;
  readonly observedAuthorizationRevision: number | null;
}

export function authorizeStandingAgentTask(
  tenant: TenantContext | null,
  input: AuthorizeStandingAgentTaskInput,
  deps: StandingAgentTaskDeps = {},
): Promise<StandingAgentTaskWriteResult> {
  return writeRevision(tenant, "active", input, deps);
}

export function withdrawStandingAgentTask(
  tenant: TenantContext | null,
  input: WithdrawStandingAgentTaskInput,
  deps: StandingAgentTaskDeps = {},
): Promise<StandingAgentTaskWriteResult> {
  return writeRevision(tenant, "withdrawn", input, deps);
}

async function writeRevision(
  tenant: TenantContext | null,
  nextState: StandingAgentTaskState,
  input: AuthorizeStandingAgentTaskInput | WithdrawStandingAgentTaskInput,
  deps: StandingAgentTaskDeps,
): Promise<StandingAgentTaskWriteResult> {
  if (typeof window !== "undefined") throw new Error("Standing agent task authorization is server-only.");
  const refuse = (reason: StandingAgentTaskRefusal): StandingAgentTaskWriteResult => ({ status: "refused", reason });

  if (!tenant?.tenantId || !tenant.userId) return refuse("unauthenticated");
  const person = tenant;
  if (!isStandingAgentTaskTemplate(input?.template)) return refuse("invalid-template");
  const template = input.template;
  const justification = validateJustification(text(input?.justification));
  if (!justification) return refuse("justification-required");

  const observed = input?.observedAuthorizationRevision ?? null;
  if (observed !== null && !Number.isInteger(observed)) return refuse("stale-authorization-revision");

  const scope =
    "brief" in input
      ? { workItemId: text(input.workItemId), agentId: text(input.agentId), title: text(input.title), brief: text(input.brief) }
      : null;
  if (
    scope &&
    (!scope.workItemId || !scope.agentId || !scope.title || !scope.brief ||
      scope.title.length > MAX_AGENT_TASK_TITLE_CHARACTERS || scope.brief.length > MAX_AGENT_TASK_BRIEF_CHARACTERS)
  ) {
    return refuse("invalid-brief");
  }

  const db = resolveDbOrNull(deps);
  if (!db) return refuse("persistence-unavailable");
  const now = (deps.now ?? (() => new Date()))();

  let authority: GovernanceAuthorityResolution;
  try {
    authority = await (deps.resolveAuthority ?? ((t: TenantContext) => resolveGovernanceAuthority(t, { getDb: deps.getDb })))(person);
  } catch {
    return refuse("persistence-unavailable");
  }
  if (!authority.authorized) return refuse("not-the-governance-authority");

  /*
   * No eligibility read here: the composite FKs keep the work item and agent inside this tenant, and
   * every run re-checks that the agent is in service, mandated and responsible before the model
   * (`agent-not-eligible`). Reading eligibility from this writer would pull the agent-work seam, and
   * with it the memory substrate, into the /agents action boundary.
   */

  try {
    let outcome: StandingAgentTaskWriteResult | null = null;
    await db.transaction(async (rawTx) => {
      const tx = rawTx as unknown as ControlPlaneDatabase;
      const effective = await readEffectiveAgentTaskWithin(tx, person.tenantId, template);
      if (observed !== (effective?.authorizationRevision ?? null)) throw new Abort("stale-authorization-revision");
      /* P5-4 — granting a schedule needs a plan that holds one; withdrawing never does. */
      if (nextState === "active" && !planFeatures(await readTenantPlan(tx, person.tenantId)).standingSchedules) {
        throw new Abort("plan-schedule-not-included");
      }
      if (nextState === "withdrawn" && effective?.state !== "active") throw new Abort("no-active-authorization");
      if (
        scope &&
        effective?.state === "active" &&
        effective.workItemId === scope.workItemId &&
        effective.agentId === scope.agentId &&
        effective.title === scope.title &&
        effective.brief === scope.brief
      ) {
        throw new Abort("already-authorized");
      }

      /* A withdrawal CARRIES FORWARD what it ends; it can never re-point the brief, agent or work. */
      const body = scope ?? { workItemId: effective!.workItemId, agentId: effective!.agentId, title: effective!.title, brief: effective!.brief };
      const authorizationRevision = (effective?.authorizationRevision ?? 0) + 1;
      const supersedesAuthorizationId = effective?.authorizationId ?? null;
      const authorizationId = randomUUID();
      const decisionType = nextState === "withdrawn" ? STANDING_AGENT_TASK_WITHDRAW_DECISION_TYPE : STANDING_AGENT_TASK_AUTHORIZE_DECISION_TYPE;

      const decision = await writeGovernanceDecisionWithin(
        tx,
        person,
        authority,
        {
          decisionType,
          subjectType: STANDING_AGENT_TASK_SUBJECT_TYPE,
          subjectId: authorizationId,
          evidence: {
            authorityVia: authority.via,
            authorityDelegationDecisionId: authority.delegationDecisionId,
            standingAgentTaskAuthorizationId: authorizationId,
            template,
            authorizationRevision,
            state: nextState,
            workItemId: body.workItemId,
            agentId: body.agentId,
            supersedesAuthorizationId,
          },
          justification,
        },
        now,
      );

      try {
        await tx.insert(standingAgentTaskAuthorizations).values({
          id: authorizationId,
          tenantId: person.tenantId,
          template,
          authorizationRevision,
          state: nextState,
          ...body,
          governanceDecisionId: decision.decisionId,
          governanceSessionId: decision.sessionId,
          authorizedByActorType: "human",
          authorizedByActorId: person.userId,
          authorizedAt: now,
          supersedesAuthorizationId,
          createdAt: now,
          createdBy: person.userId,
          createdByType: "human",
          updatedAt: now,
          updatedBy: person.userId,
          updatedByType: "human",
        });
      } catch (error) {
        if (isUniqueViolation(error)) throw new Abort("concurrent-authorization-change");
        throw error;
      }

      await recordGovernanceEventWithin(
        tx,
        { tenantId: person.tenantId, userId: person.userId, requestId: person.requestId, sessionContextId: person.sessionContextId },
        {
          action: "governance.decision.recorded",
          outcome: "committed",
          entityId: decision.decisionId,
          metadata: {
            governanceSessionId: decision.sessionId,
            decisionType,
            subjectType: STANDING_AGENT_TASK_SUBJECT_TYPE,
            subjectId: authorizationId,
            bootstrap: false,
          },
        },
        now,
      );

      outcome = {
        status: "authorized",
        authorization: {
          authorizationId,
          template,
          authorizationRevision,
          state: nextState,
          ...body,
          governanceDecisionId: decision.decisionId,
          authorizedByActorId: person.userId,
          authorizedAt: now.toISOString(),
          supersedesAuthorizationId,
        },
      };
    });
    return outcome ?? refuse("persistence-unavailable");
  } catch (error) {
    if (error instanceof Abort) return refuse(error.refusal);
    if (isUniqueViolation(error)) return refuse("concurrent-authorization-change");
    return refuse("persistence-unavailable");
  }
}
