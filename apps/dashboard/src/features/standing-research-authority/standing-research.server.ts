/*
 * standing-research-authority/standing-research.server.ts — P6-2: THE ONE writer of a standing
 * research authorization, the one place research is run under it, and the admission check a
 * scheduled run passes before it may start.
 *
 * WRITING (authorize / withdraw). One transaction, or nothing:
 *   read the tenant's effective revision → require the caller saw THAT revision → write the
 *   Governance decision → INSERT revision N+1 → Governance audit → standing-research audit.
 * Same shape as TRH-23's standing observation writer. No update, no delete, no upsert: withdrawal
 * is a new `withdrawn` revision under a `revoke` decision, and the active revision it ends is left
 * byte-identical. Writing prepares nothing and calls no model.
 *
 * RUNNING (`runStandingResearchNow`). Research runs only on the brief, agent and work item the
 * revision in force names — never on caller text. The revision is read before the model and read
 * AGAIN inside the filing transaction, so a withdrawal or a new revision landing while the model
 * writes files nothing. Everything else — the person's Governance authority, the agent's
 * `prepare-research` mandate, the Director's Claude control, the tenant's own key, the data-use
 * grant, the one-at-a-time lock — stays where it is, in the released research seam.
 *
 * SCHEDULED ADMISSION (`admitScheduledResearch`). The `research-schedule` kill switch is read first
 * and fails closed; only then is the tenant's lineage read. P6-4's cron is its only intended caller.
 */
import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { standingResearchAuthorizations } from "@/db/schema/standing-research-authorization";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { recordGovernanceEventWithin } from "@/features/governance-audit/governance-decision-audit.server";
import { resolveGovernanceAuthority, type GovernanceAuthorityResolution } from "@/features/governance-decision/authority-read.server";
import { writeGovernanceDecisionWithin } from "@/features/governance-decision/decision-authority.server";
import { validateJustification } from "@/features/governance-decision/persistence.server";
import { resolveDirectorEnabled } from "@/features/heby-provider-ops/provider-connectivity-control.server";
import {
  assignResearchReport,
  readResearchChoices,
  type AssignResearchReportDeps,
  type AssignResearchReportResult,
} from "@/features/agent-work/assign-research-report.server";
import {
  MAX_RESEARCH_BRIEF_CHARACTERS,
  MAX_RESEARCH_TITLE_CHARACTERS,
  RESEARCH_SCHEDULE_CONTROL_KEY,
  STANDING_RESEARCH_AUDIT_AUTHORIZED,
  STANDING_RESEARCH_AUDIT_WITHDRAWN,
  STANDING_RESEARCH_AUTHORIZE_DECISION_TYPE,
  STANDING_RESEARCH_SUBJECT_TYPE,
  STANDING_RESEARCH_WITHDRAW_DECISION_TYPE,
  type ScheduledResearchAdmission,
  type StandingResearchAuthorizationRecord,
  type StandingResearchRefusal,
  type StandingResearchState,
  type StandingResearchWriteResult,
} from "./contracts";
import { recordStandingResearchEventWithin, recordStandingResearchRefusal } from "@/features/governance-audit/standing-research-audit.server";

export interface StandingResearchDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly now?: () => Date;
  /** Injected only so a test can resolve authority and eligibility against its own database. */
  readonly resolveAuthority?: (tenant: TenantContext) => Promise<GovernanceAuthorityResolution>;
  readonly readChoices?: typeof readResearchChoices;
}

class Abort extends Error {
  constructor(readonly refusal: StandingResearchRefusal) {
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

type Row = typeof standingResearchAuthorizations.$inferSelect;

function toRecord(row: Row): StandingResearchAuthorizationRecord {
  return {
    authorizationId: row.id,
    authorizationRevision: row.authorizationRevision,
    state: row.state,
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

/** The tenant's effective revision: the highest ordinal in its one lineage. Tenant-scoped by predicate. */
async function readEffectiveWithin(reader: Pick<ControlPlaneDatabase, "select">, tenantId: string): Promise<StandingResearchAuthorizationRecord | null> {
  const rows = await reader
    .select()
    .from(standingResearchAuthorizations)
    .where(eq(standingResearchAuthorizations.tenantId, tenantId))
    .orderBy(desc(standingResearchAuthorizations.authorizationRevision))
    .limit(1);
  return rows[0] ? toRecord(rows[0]) : null;
}

/** The revision in force for the signed-in tenant, or `null` when none was ever written. */
export async function readStandingResearch(
  tenant: TenantContext | null,
  deps: Pick<StandingResearchDeps, "getDb"> = {},
): Promise<{ readonly status: "read"; readonly authorization: StandingResearchAuthorizationRecord | null } | { readonly status: "unavailable" }> {
  if (!tenant?.tenantId || !tenant.userId) return { status: "unavailable" };
  const db = resolveDbOrNull(deps);
  if (!db) return { status: "unavailable" };
  try {
    return { status: "read", authorization: await readEffectiveWithin(db, tenant.tenantId) };
  } catch {
    return { status: "unavailable" };
  }
}

export interface AuthorizeStandingResearchInput {
  readonly workItemId: unknown;
  readonly agentId: unknown;
  readonly title: unknown;
  readonly brief: unknown;
  readonly justification: unknown;
  /** The revision the person was looking at; `null` when none existed. */
  readonly observedAuthorizationRevision: number | null;
}

export interface WithdrawStandingResearchInput {
  readonly justification: unknown;
  readonly observedAuthorizationRevision: number | null;
}

export function authorizeStandingResearch(
  tenant: TenantContext | null,
  input: AuthorizeStandingResearchInput,
  deps: StandingResearchDeps = {},
): Promise<StandingResearchWriteResult> {
  return writeRevision(tenant, "active", input, deps);
}

export function withdrawStandingResearch(
  tenant: TenantContext | null,
  input: WithdrawStandingResearchInput,
  deps: StandingResearchDeps = {},
): Promise<StandingResearchWriteResult> {
  return writeRevision(tenant, "withdrawn", input, deps);
}

async function writeRevision(
  tenant: TenantContext | null,
  nextState: StandingResearchState,
  input: AuthorizeStandingResearchInput | WithdrawStandingResearchInput,
  deps: StandingResearchDeps,
): Promise<StandingResearchWriteResult> {
  if (typeof window !== "undefined") throw new Error("Standing research authorization is server-only.");
  const attempt = nextState === "active" ? "authorize" : "withdraw";
  const refuse = async (reason: StandingResearchRefusal, entityId: string | null = null): Promise<StandingResearchWriteResult> => {
    await recordStandingResearchRefusal(tenant, attempt, reason, entityId, deps.getDb);
    return { status: "refused", reason };
  };

  if (!tenant?.tenantId || !tenant.userId) return { status: "refused", reason: "unauthenticated" };
  const person = tenant;

  const justification = validateJustification(text(input?.justification));
  if (!justification) return refuse("justification-required");

  const observed = input?.observedAuthorizationRevision ?? null;
  if (observed !== null && !Number.isInteger(observed)) return refuse("stale-authorization-revision");

  const scope =
    "brief" in input
      ? { workItemId: text(input.workItemId), agentId: text(input.agentId), title: text(input.title), brief: text(input.brief) }
      : null;
  if (scope && (!scope.workItemId || !scope.agentId || !scope.title || !scope.brief || scope.title.length > MAX_RESEARCH_TITLE_CHARACTERS || scope.brief.length > MAX_RESEARCH_BRIEF_CHARACTERS)) {
    return refuse("invalid-brief");
  }

  const db = resolveDbOrNull(deps);
  if (!db) return { status: "refused", reason: "persistence-unavailable" };
  const now = (deps.now ?? (() => new Date()))();

  /* The ONE released resolver; a tenant owner without Governance authority is refused like a stranger. */
  let authority: GovernanceAuthorityResolution;
  try {
    authority = await (deps.resolveAuthority ?? ((t: TenantContext) => resolveGovernanceAuthority(t, { getDb: deps.getDb })))(person);
  } catch {
    return { status: "refused", reason: "persistence-unavailable" };
  }
  if (!authority.authorized) return refuse("not-the-governance-authority");

  /* AUTHORIZING names an agent that may prepare research on this work today: in service, `prepare-research`, responsible. */
  if (scope) {
    const choices = await (deps.readChoices ?? readResearchChoices)(person, scope.workItemId, { getDb: deps.getDb }).catch(() => null);
    if (!choices || choices.status === "unavailable") return { status: "refused", reason: "persistence-unavailable" };
    if (choices.status === "refused") return refuse("work-unavailable");
    if (!choices.agents.some((a) => a.agentId === scope.agentId)) return refuse("agent-not-eligible");
  }

  try {
    let outcome: StandingResearchWriteResult | null = null;
    await db.transaction(async (rawTx) => {
      const tx = rawTx as unknown as ControlPlaneDatabase;
      const effective = await readEffectiveWithin(tx, person.tenantId);
      if (observed !== (effective?.authorizationRevision ?? null)) throw new Abort("stale-authorization-revision");

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
      const decisionType = nextState === "withdrawn" ? STANDING_RESEARCH_WITHDRAW_DECISION_TYPE : STANDING_RESEARCH_AUTHORIZE_DECISION_TYPE;

      const decision = await writeGovernanceDecisionWithin(
        tx,
        person,
        authority,
        {
          decisionType,
          subjectType: STANDING_RESEARCH_SUBJECT_TYPE,
          subjectId: authorizationId,
          evidence: {
            authorityVia: authority.via,
            authorityDelegationDecisionId: authority.delegationDecisionId,
            standingResearchAuthorizationId: authorizationId,
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
        await tx.insert(standingResearchAuthorizations).values({
          id: authorizationId,
          tenantId: person.tenantId,
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
            subjectType: STANDING_RESEARCH_SUBJECT_TYPE,
            subjectId: authorizationId,
            bootstrap: false,
          },
        },
        now,
      );
      await recordStandingResearchEventWithin(
        tx,
        person,
        {
          action: nextState === "withdrawn" ? STANDING_RESEARCH_AUDIT_WITHDRAWN : STANDING_RESEARCH_AUDIT_AUTHORIZED,
          outcome: "committed",
          entityId: authorizationId,
          metadata: {
            authorizationRevision,
            state: nextState,
            workItemId: body.workItemId,
            agentId: body.agentId,
            governanceDecisionId: decision.decisionId,
            supersedesAuthorizationId,
            prepared: false,
          },
        },
        now,
      );

      outcome = {
        status: "authorized",
        authorization: {
          authorizationId,
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
    return outcome ?? { status: "refused", reason: "persistence-unavailable" };
  } catch (error) {
    if (error instanceof Abort) return refuse(error.refusal);
    if (isUniqueViolation(error)) return refuse("concurrent-authorization-change");
    return { status: "refused", reason: "persistence-unavailable" };
  }
}

export type RunStandingResearchResult =
  | AssignResearchReportResult
  | { readonly status: "refused"; readonly reason: "no-active-authorization" | "stale-authorization-revision" };

/**
 * Run the brief in force NOW, for the signed-in person ("run now", D8). The caller names only the
 * revision it was looking at; the brief, agent and work item come from that revision.
 */
export async function runStandingResearchNow(
  input: { readonly observedAuthorizationRevision: unknown },
  deps: AssignResearchReportDeps & { readonly assign?: typeof assignResearchReport },
): Promise<RunStandingResearchResult> {
  if (typeof window !== "undefined") throw new Error("Research preparation is server-only.");
  const tenant = await deps.resolveTenant();
  if (!tenant?.tenantId || !tenant.userId) return { status: "refused", reason: "unauthenticated" };
  const refuse = async <R extends RunStandingResearchResult & { status: "refused" }>(result: R, entityId: string | null): Promise<R> => {
    await recordStandingResearchRefusal(tenant, "run", result.reason, entityId, deps.getDb);
    return result;
  };

  const db = resolveDbOrNull(deps);
  if (!db) return { status: "refused", reason: "persistence-unavailable" };
  let effective: StandingResearchAuthorizationRecord | null;
  try {
    effective = await readEffectiveWithin(db, tenant.tenantId);
  } catch {
    return { status: "refused", reason: "persistence-unavailable" };
  }
  if (!effective || effective.state !== "active") {
    return refuse({ status: "refused", reason: "no-active-authorization" } as const, effective?.authorizationId ?? null);
  }
  if (input?.observedAuthorizationRevision !== effective.authorizationRevision) {
    return refuse({ status: "refused", reason: "stale-authorization-revision" } as const, effective.authorizationId);
  }

  const inForce = effective;
  const result = await (deps.assign ?? assignResearchReport)(
    { workItemId: inForce.workItemId, agentId: inForce.agentId, question: inForce.brief, title: inForce.title },
    {
      ...deps,
      /* Read again INSIDE the filing transaction: the revision in force must still be this one. */
      standingAuthorizationHolds: async (tx) => {
        const now = await readEffectiveWithin(tx, tenant.tenantId);
        return now?.authorizationId === inForce.authorizationId && now.state === "active";
      },
      standingAuthorizationId: inForce.authorizationId,
    },
  );
  if (result.status === "refused") await recordStandingResearchRefusal(tenant, "run", result.reason, inForce.authorizationId, deps.getDb);
  return result;
}

/**
 * May a SCHEDULED research run start for this tenant now? The kill switch is read FIRST and fails
 * closed (absent row, no database, read error → off); the lineage is read only when it is on.
 *
 * Re-checking the granting person's Governance authority at run time needs a machine principal,
 * which P6-4 adds with the cron; it is not claimed here.
 */
export async function admitScheduledResearch(
  tenantId: string,
  deps: { readonly getDb?: () => ControlPlaneDatabase | null; readonly readSwitch?: () => Promise<boolean> } = {},
): Promise<ScheduledResearchAdmission> {
  const on = await (deps.readSwitch ?? (() => resolveDirectorEnabled(RESEARCH_SCHEDULE_CONTROL_KEY)))().catch(() => false);
  if (on !== true) return { status: "refused", reason: "research-schedule-disabled" };
  const db = resolveDbOrNull(deps);
  if (!db || !tenantId) return { status: "refused", reason: "persistence-unavailable" };
  try {
    const effective = await readEffectiveWithin(db, tenantId);
    if (!effective || effective.state !== "active") return { status: "refused", reason: "no-active-authorization" };
    return { status: "admitted", authorization: effective };
  } catch {
    return { status: "refused", reason: "persistence-unavailable" };
  }
}
