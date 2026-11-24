/*
 * standing-agent-task/scheduled-agent-task.server.ts — P5-5. The weekly run of standing agent tasks,
 * mirroring P6-4's scheduled research (Director decisions 2026-11-24).
 *
 * Nobody signed in. A run acts as an EPHEMERAL agent task principal, minted here from one claimed ledger
 * row and one authorization revision, and nowhere else. Before the model it re-checks: the kill switch,
 * the authorization in force, the organization, the plan, the granting person's membership and Governance
 * authority, the work item, the agent's eligibility and mandate, the Claude control, the tenant's own key
 * (D-key: own key only until GATE-D closes) and the data-use decision. It files ONE internal draft for
 * review, re-reading the authorization and the mandate inside the filing transaction, and performs no act.
 *
 * The request carries the organization's brief (conversation), Hebun's internal-draft brief (work-artifact)
 * and the agent's role (agent-mandate, P5-2), and no grounding (Director decision: brief + role).
 *
 * Server-only.
 */
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { companies } from "@/db/schema/company";
import { memberships } from "@/db/schema/membership";
import { scheduledAgentTaskRuns } from "@/db/schema/standing-agent-task";
import { agentWorkCapability, refuseOutsideAgentWorkCapability } from "@/features/agent-work/capabilities";
import { eligibleAgents, readTarget } from "@/features/agent-work/assign-work-draft.server";
import { readEffectiveAgentMandateForRuntime } from "@/features/agent-mandate/read-agent-mandate.server";
import { resolveGovernanceAuthority } from "@/features/governance-decision/authority-read.server";
import { resolveAgentAuthorship } from "@/features/work-artifacts/agent-authorship.server";
import { WORK_ARTIFACT_OWNER_WORKSPACE, WORK_ARTIFACT_PREPARATION_INTENT } from "@/features/work-artifacts/prepare-work-artifact.server";
import { preparationBriefFor } from "@/features/work-artifacts/preparation-brief";
import { createInternalDraftFromScheduledAgentTask } from "@/features/work-artifacts/write-work-artifacts.server";
import { systemInstructionsFor } from "@/features/heby-answer/model-answer.server";
import { generateHebyModelAnswer } from "@/features/heby-model";
import { ModelConnectivityError } from "@/features/heby-model/model-error";
import { resolveModelConnectivityConfig } from "@/features/heby-model/model-connectivity-environment.server";
import { resolveClaudeDirectorEnabled, resolveDirectorEnabled } from "@/features/heby-provider-ops/provider-connectivity-control.server";
import { authorizeExternalAiDisclosure, type AuthorizeExternalAiDisclosure } from "@/features/external-ai-data-use/authorize-external-ai-disclosure.server";
import { internalDraftActionClaims } from "@/features/heby-runtime/response-validator";
import { classifyProviderStopReason } from "@/features/heby-runtime/contracts";
import {
  isLiveModelTransport,
  resolveTenantModelCredential,
  selectScheduledResearchModelTransport,
  tenantAnthropicAccountRef,
} from "@/features/provider-anthropic/model-credential.server";
import { readTenantPlan } from "@/features/tenant-entitlements/tenant-dispatch-ceiling.server";
import { planFeatures } from "@/features/tenant-entitlements/plans";
import { readEffectiveAgentTaskWithin } from "./standing-agent-task.server";
import { AGENT_TASK_TEMPLATE_SPECS, istanbulIsoWeek } from "./templates";
import {
  AGENT_TASK_SCHEDULE_CONTROL_KEY,
  type StandingAgentTaskAuthorizationRecord,
  type StandingAgentTaskTemplate,
} from "./contracts";

const CAPABILITY = agentWorkCapability("prepare-work-draft");
/* The draft capability's classes, plus the agent's role (P5-2). Purpose stays the capability's: assistance. */
const DATA_USE = Object.freeze({
  purpose: CAPABILITY.dataUse.purpose,
  dataClasses: Object.freeze([...CAPABILITY.dataUse.dataClasses, "agent-mandate"] as const),
});

/** The most (tenant, template) pairs one tick considers. ponytail: a cursor when more hold an authorization. */
export const SCHEDULED_AGENT_TASK_SCAN_LIMIT = 50;

/* ── the principal ─────────────────────────────────────────────────────────── */

const AGENT_TASK_PRINCIPAL_BRAND: unique symbol = Symbol("hebun.standing-agent-task.schedule-principal");

/** One run of one standing agent task revision. Every field is read off that row or minted here. */
export interface AgentTaskSchedulePrincipal {
  readonly tenantId: string;
  readonly template: StandingAgentTaskTemplate;
  readonly authorizationId: string;
  readonly authorizationRevision: number;
  readonly workItemId: string;
  readonly agentId: string;
  readonly title: string;
  readonly brief: string;
  /** Who granted the authorization: re-checked before every run, never the actor. */
  readonly grantedByUserId: string;
  /** The run ledger row's id: this run's `system` actor. */
  readonly runId: string;
  readonly periodKey: string;
  readonly [AGENT_TASK_PRINCIPAL_BRAND]: true;
}

export function isAgentTaskSchedulePrincipal(value: unknown): value is AgentTaskSchedulePrincipal {
  return typeof value === "object" && value !== null && (value as Record<PropertyKey, unknown>)[AGENT_TASK_PRINCIPAL_BRAND] === true;
}

function mint(record: StandingAgentTaskAuthorizationRecord, tenantId: string, runId: string, periodKey: string): AgentTaskSchedulePrincipal {
  return Object.freeze({
    tenantId,
    template: record.template,
    authorizationId: record.authorizationId,
    authorizationRevision: record.authorizationRevision,
    workItemId: record.workItemId,
    agentId: record.agentId,
    title: record.title,
    brief: record.brief,
    grantedByUserId: record.authorizedByActorId,
    runId,
    periodKey,
    [AGENT_TASK_PRINCIPAL_BRAND]: true as const,
  });
}

/* ── outcomes ──────────────────────────────────────────────────────────────── */

export type ScheduledAgentTaskFailure =
  | "agent-task-schedule-disabled"
  | "authorization-changed"
  | "organization-not-active"
  | "plan-schedule-not-included"
  | "granter-not-active-member"
  | "granter-lost-governance-authority"
  | "work-unavailable"
  | "agent-not-eligible"
  | "agent-authorship-refused"
  | "model-connectivity-disabled"
  | "agent-task-requires-own-key"
  | "agent-task-data-use-not-authorized"
  | "model-unavailable"
  | "provider-failed"
  | "output-truncated"
  | "model-refused"
  | "action-claim-in-output"
  | "authorization-changed-while-preparing"
  | "agent-mandate-changed-while-preparing"
  | "write-refused"
  | "unexpected-error";

export type ScheduledAgentTaskRunOutcome =
  | { readonly status: "filed"; readonly tenantId: string; readonly template: StandingAgentTaskTemplate; readonly runId: string; readonly artifactId: string }
  | { readonly status: "failed"; readonly tenantId: string; readonly template: StandingAgentTaskTemplate; readonly runId: string; readonly reason: ScheduledAgentTaskFailure; readonly detail?: string }
  /** This week's run for this template was already claimed: nothing was asked. */
  | { readonly status: "already-run"; readonly tenantId: string; readonly template: StandingAgentTaskTemplate };

export type ScheduledAgentTaskScan =
  | { readonly status: "disabled" }
  | { readonly status: "unavailable"; readonly reason: "persistence-unavailable" }
  | { readonly status: "scanned"; readonly periodKey: string; readonly considered: number; readonly outcomes: readonly ScheduledAgentTaskRunOutcome[] };

export interface ScheduledAgentTaskDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly now?: () => Date;
  /** The `agent-task-schedule` kill switch. Absent, unreadable or not exactly `true` is off. */
  readonly readSwitch?: () => Promise<boolean>;
  readonly resolveClaudeEnabled?: () => Promise<boolean>;
  /** The released data-use authority; injected only so a test can hand it its database. */
  readonly authorizeDisclosure?: AuthorizeExternalAiDisclosure;
  readonly resolveCredential?: typeof resolveTenantModelCredential;
  readonly selectTransport?: typeof selectScheduledResearchModelTransport;
  readonly generate?: typeof generateHebyModelAnswer;
  /** The generator's own seams (disclosure record, dispatch admission), for a test's database. */
  readonly generationDeps?: Omit<Parameters<typeof generateHebyModelAnswer>[1] & object, "env" | "transport" | "disclosure">;
}

function resolveDbOrNull(deps: ScheduledAgentTaskDeps): ControlPlaneDatabase | null {
  if (deps.getDb) return deps.getDb();
  try {
    return getControlPlaneDb();
  } catch {
    return null;
  }
}

const switchOn = (deps: ScheduledAgentTaskDeps) =>
  (deps.readSwitch ?? (() => resolveDirectorEnabled(AGENT_TASK_SCHEDULE_CONTROL_KEY)))().then((v) => v === true).catch(() => false);

/* ── the tick ──────────────────────────────────────────────────────────────── */

/**
 * One tick: every (tenant, template) whose effective standing agent task authorization is active,
 * sequentially and failure-isolated. The kill switch is read FIRST; off, nothing else is read.
 */
export async function scanScheduledAgentTasks(deps: ScheduledAgentTaskDeps = {}): Promise<ScheduledAgentTaskScan> {
  if (typeof window !== "undefined") throw new Error("Scheduled agent tasks are server-only.");
  if (!(await switchOn(deps))) return { status: "disabled" };
  const db = resolveDbOrNull(deps);
  if (!db) return { status: "unavailable", reason: "persistence-unavailable" };
  const periodKey = istanbulIsoWeek((deps.now ?? (() => new Date()))());

  let pairs: { tenantId: string; template: StandingAgentTaskTemplate }[];
  try {
    const rows = await db.execute(sql`
      select tenant_id, template from (
        select distinct on (tenant_id, template) tenant_id, template, state
        from standing_agent_task_authorizations
        order by tenant_id, template, authorization_revision desc
      ) effective
      where state = 'active'
      order by tenant_id, template
      limit ${SCHEDULED_AGENT_TASK_SCAN_LIMIT}`);
    pairs = (rows.rows as { tenant_id: string; template: StandingAgentTaskTemplate }[]).map((r) => ({ tenantId: r.tenant_id, template: r.template }));
  } catch {
    return { status: "unavailable", reason: "persistence-unavailable" };
  }

  const outcomes: ScheduledAgentTaskRunOutcome[] = [];
  for (const pair of pairs) outcomes.push(await runForPair(pair.tenantId, pair.template, periodKey, db, deps));
  return { status: "scanned", periodKey, considered: pairs.length, outcomes };
}

async function runForPair(
  tenantId: string,
  template: StandingAgentTaskTemplate,
  periodKey: string,
  db: ControlPlaneDatabase,
  deps: ScheduledAgentTaskDeps,
): Promise<ScheduledAgentTaskRunOutcome> {
  let record: StandingAgentTaskAuthorizationRecord | null;
  try {
    record = await readEffectiveAgentTaskWithin(db, tenantId, template);
  } catch {
    return { status: "failed", tenantId, template, runId: "", reason: "unexpected-error", detail: "lineage-unreadable" };
  }
  if (!record || record.state !== "active") return { status: "failed", tenantId, template, runId: "", reason: "authorization-changed" };

  /* CLAIM THE WEEK before anything is asked. A conflict means this template already ran this week. */
  const claimed = await db
    .insert(scheduledAgentTaskRuns)
    .values({ tenantId, template, standingAuthorizationId: record.authorizationId, periodKey, status: "claimed" })
    .onConflictDoNothing()
    .returning({ id: scheduledAgentTaskRuns.id })
    .catch(() => null);
  if (claimed === null) return { status: "failed", tenantId, template, runId: "", reason: "unexpected-error", detail: "claim-failed" };
  if (claimed.length === 0) return { status: "already-run", tenantId, template };
  const principal = mint(record, tenantId, claimed[0]!.id, periodKey);

  let outcome: ScheduledAgentTaskRunOutcome;
  try {
    outcome = await runAsPrincipal(principal, db, deps);
  } catch {
    outcome = { status: "failed", tenantId, template, runId: principal.runId, reason: "unexpected-error" };
  }
  if (outcome.status === "failed") {
    await db
      .update(scheduledAgentTaskRuns)
      .set({
        status: "failed",
        failureReason: outcome.reason === "action-claim-in-output" && outcome.detail ? `${outcome.reason}:${outcome.detail}`.slice(0, 120) : outcome.reason,
        finishedAt: new Date(),
      })
      .where(and(eq(scheduledAgentTaskRuns.id, principal.runId), eq(scheduledAgentTaskRuns.status, "claimed")))
      .catch(() => undefined);
  }
  return outcome;
}

async function runAsPrincipal(
  principal: AgentTaskSchedulePrincipal,
  db: ControlPlaneDatabase,
  deps: ScheduledAgentTaskDeps,
): Promise<ScheduledAgentTaskRunOutcome> {
  if (!isAgentTaskSchedulePrincipal(principal)) throw new Error("not an agent task schedule principal");
  const { tenantId, runId, template } = principal;
  const fail = (reason: ScheduledAgentTaskFailure, detail?: string): ScheduledAgentTaskRunOutcome => ({
    status: "failed",
    tenantId,
    template,
    runId,
    reason,
    ...(detail ? { detail } : {}),
  });
  const tenant = { tenantId };
  const env = deps.env ?? process.env;
  const dbDeps = { getDb: () => db };

  /* ── re-check everything, before the model ── */
  if (!(await switchOn(deps))) return fail("agent-task-schedule-disabled");
  const inForce = await readEffectiveAgentTaskWithin(db, tenantId, template);
  if (!inForce || inForce.authorizationId !== principal.authorizationId || inForce.state !== "active") return fail("authorization-changed");

  const org = await db.select({ status: companies.tenantStatus }).from(companies).where(eq(companies.id, tenantId)).limit(1);
  if (org[0]?.status !== "active") return fail("organization-not-active");
  if (!planFeatures(await readTenantPlan(db, tenantId)).standingSchedules) return fail("plan-schedule-not-included");
  const member = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(and(eq(memberships.tenantId, tenantId), eq(memberships.userId, principal.grantedByUserId), eq(memberships.status, "active")))
    .limit(1);
  if (member.length === 0) return fail("granter-not-active-member");
  if (!(await resolveGovernanceAuthority({ tenantId, userId: principal.grantedByUserId }, dbDeps)).authorized) {
    return fail("granter-lost-governance-authority");
  }

  const target = await readTarget(tenant, principal.workItemId, dbDeps);
  if (target.status === "refused") return fail("work-unavailable", target.reason);
  const workScope = target.target.workScope;
  const eligible = await eligibleAgents(tenant, workScope, dbDeps, CAPABILITY);
  if (eligible.status !== "read" || !eligible.agents.some((a) => a.agentId === principal.agentId)) return fail("agent-not-eligible");
  const authorizing = await readEffectiveAgentMandateForRuntime(tenantId, principal.agentId, dbDeps);
  if (authorizing.status !== "known" || !authorizing.mandate || refuseOutsideAgentWorkCapability(CAPABILITY, authorizing, workScope)) {
    return fail("agent-not-eligible");
  }
  const mandateRevision = { mandateId: authorizing.mandate.mandateId, mandateRevision: authorizing.mandate.mandateRevision };
  const authorship = await resolveAgentAuthorship(tenant, dbDeps, { agentId: principal.agentId });
  if (authorship.status === "refused") return fail("agent-authorship-refused", authorship.reason);

  const claudeOn = await (deps.resolveClaudeEnabled ?? resolveClaudeDirectorEnabled)().catch(() => false);
  if (!claudeOn) return fail("model-connectivity-disabled");

  let accountRef: string | undefined;
  if (isLiveModelTransport(env)) {
    const credential = await (deps.resolveCredential ?? resolveTenantModelCredential)(tenant, dbDeps);
    if (credential.kind !== "tenant") return fail("agent-task-requires-own-key");
    accountRef = tenantAnthropicAccountRef(credential.integrationId);
  }
  const authorize: AuthorizeExternalAiDisclosure = deps.authorizeDisclosure ?? ((d, o, m, a) => authorizeExternalAiDisclosure(d, o, m, {}, a));
  const modelId = resolveModelConnectivityConfig(env).modelId ?? "";
  const disclosure = { tenantId, actorUserId: principal.grantedByUserId, purpose: DATA_USE.purpose, dataClasses: [...DATA_USE.dataClasses] };
  const decision = await authorize(disclosure, claudeOn, modelId, accountRef).catch(() => null);
  if (decision?.disposition !== "authorized") return fail("agent-task-data-use-not-authorized");

  const selection = await (deps.selectTransport ?? selectScheduledResearchModelTransport)(tenantId, env, dbDeps);
  if (selection.byokRefusal) return fail("agent-task-requires-own-key", selection.byokRefusal);

  /* The internal-draft brief, with the agent's role as fenced material (P5-2). */
  const spec = AGENT_TASK_TEMPLATE_SPECS[template];
  const brief = preparationBriefFor({ artifactType: spec.artifactType, agentRole: authorizing.mandate.purpose })!;
  const correlationId = randomUUID();
  let generated;
  try {
    generated = await (deps.generate ?? generateHebyModelAnswer)(
      {
        correlationId,
        tenantId,
        systemInstructions: systemInstructionsFor(WORK_ARTIFACT_PREPARATION_INTENT, brief),
        userPrompt: `${spec.lead(principal.periodKey)}\n\n${principal.brief}`,
        evidence: [],
        ...(brief.material.length > 0 ? { material: brief.material } : {}),
        modelId: "",
        maxOutputTokens: 0,
      },
      { ...(deps.generationDeps ?? {}), env, transport: selection.transport, disclosure },
    );
  } catch (error) {
    return fail("provider-failed", error instanceof ModelConnectivityError ? error.code : "unknown-provider-error");
  }
  if (generated.status !== "generated") return fail("model-unavailable", generated.state);
  const result = generated.result;
  const stop = classifyProviderStopReason(result.stopReason);
  if (stop === "max_tokens") return fail("output-truncated");
  if (stop === "refusal") return fail("model-refused");
  const claims = internalDraftActionClaims(result.text);
  if (claims.length > 0) return fail("action-claim-in-output", claims.join(","));

  /* ── file: one transaction, re-reading the authorization and the mandate ── */
  let changed: "authorization" | "mandate" | null = null;
  const written = await createInternalDraftFromScheduledAgentTask(
    { tenantId, runId },
    { title: `${principal.title} · ${principal.periodKey}`.slice(0, 200), content: result.text },
    WORK_ARTIFACT_OWNER_WORKSPACE,
    authorship.authorship,
    dbDeps,
    async (tx, created) => {
      const now = await readEffectiveAgentTaskWithin(tx, tenantId, template);
      if (!now || now.authorizationId !== principal.authorizationId || now.state !== "active") {
        changed = "authorization";
        return false;
      }
      const mandate = await readEffectiveAgentMandateForRuntime(tenantId, principal.agentId, { getDb: () => tx });
      if (mandate.status !== "known" || mandate.mandate?.mandateId !== mandateRevision.mandateId || refuseOutsideAgentWorkCapability(CAPABILITY, mandate, workScope)) {
        changed = "mandate";
        return false;
      }
      const finished = await tx
        .update(scheduledAgentTaskRuns)
        .set({ status: "filed", artifactId: created.artifactId, correlationId, finishedAt: new Date() })
        .where(and(eq(scheduledAgentTaskRuns.id, runId), eq(scheduledAgentTaskRuns.status, "claimed")))
        .returning({ id: scheduledAgentTaskRuns.id });
      if (finished.length !== 1) return false;
      return true;
    },
  );
  if (written.status === "refused" && written.reason === "filing-condition-failed") {
    return fail(changed === "mandate" ? "agent-mandate-changed-while-preparing" : "authorization-changed-while-preparing");
  }
  if (written.status !== "created") return fail("write-refused", written.status === "refused" ? written.reason : written.status);
  return { status: "filed", tenantId, template, runId, artifactId: written.artifactId };
}
