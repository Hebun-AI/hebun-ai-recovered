/*
 * standing-research-authority/scheduled-research.server.ts — P6-4: the 08:00 research run (D1, D5–D7, D9).
 *
 * ── WHO ACTS ─────────────────────────────────────────────────────────────────
 *
 * Nobody signed in. A run acts as an EPHEMERAL research schedule principal, minted here and only here,
 * from the effective, active standing research authorization row. Its tenant, brief, work item, agent
 * and granting person are what that row says; no caller supplies any of them, and there is no tenant
 * parameter anywhere. It is not a `TenantContext`, so it cannot reach a seam that stamps a human, and
 * it inherits nobody's authority: the granting person's authority is RE-CHECKED before every model call.
 *
 * ── WHAT IS CHECKED, AND WHEN ────────────────────────────────────────────────
 *
 *   the research-schedule kill switch           first, before any row is read; again before the model
 *   one run per (tenant, revision, Istanbul day) the run ledger's unique key, claimed before the model
 *   the authorization revision is still in force before the model, and inside the filing transaction
 *   the organization is active; the granting
 *     person is an active member holding its
 *     Governance authority                      before the model (P6-2-GRANTER-RECHECK-1)
 *   the work item; the agent in service, holding
 *     prepare-research and responsible for it   before the model; the mandate again inside filing
 *   the Director's Claude control; the tenant's
 *     own verified Anthropic key (never the
 *     platform's); the research data-use
 *     decision (web search only under its own)  before the model, and again at dispatch by the generator
 *   the dispatch cap and live-spend budget      at dispatch, by the generator
 *
 * A failed check, a provider failure or an output the filing rules refuse ends the run `failed` with
 * its reason. A failed run is not retried that day: the ledger row is the day's one run.
 *
 * ── WHAT IS WRITTEN ──────────────────────────────────────────────────────────
 *
 * Only on success: one research report (created by `system` — the run — and authored by the agent),
 * its filing audit row and the ledger's `filed` outcome, in ONE transaction. The released data-use
 * evidence and dispatch-cap rows are keyed to a human; they name the granting person as the
 * accountable authorizer of this recurring disclosure. Nothing is sent, published or decided.
 *
 * Server-only.
 */
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { companies } from "@/db/schema/company";
import { memberships } from "@/db/schema/membership";
import { scheduledResearchRuns } from "@/db/schema/scheduled-research-run";
import { agentWorkCapability, refuseOutsideAgentWorkCapability } from "@/features/agent-work/capabilities";
import { eligibleAgents, readTarget } from "@/features/agent-work/assign-work-draft.server";
import {
  LINK,
  RESEARCH_BRIEF,
  SOURCED_RESEARCH_BRIEF,
  researchWebSearchMaxUses,
} from "@/features/agent-work/assign-research-report.server";
import { composeSourcedResearchReport } from "@/features/agent-work/sourced-research-report";
import { readEffectiveAgentMandateForRuntime } from "@/features/agent-mandate/read-agent-mandate.server";
import { resolveGovernanceAuthority } from "@/features/governance-decision/authority-read.server";
import { resolveAgentAuthorship } from "@/features/work-artifacts/agent-authorship.server";
import { WORK_ARTIFACT_OWNER_WORKSPACE, WORK_ARTIFACT_PREPARATION_INTENT } from "@/features/work-artifacts/prepare-work-artifact.server";
import { createResearchReportFromScheduledResearch } from "@/features/work-artifacts/write-work-artifacts.server";
import { recordScheduledResearchReportFiled } from "@/features/governance-audit/research-report-audit.server";
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
import { readEffectiveWithin } from "./standing-research.server";
import { readTenantPlan } from "@/features/tenant-entitlements/tenant-dispatch-ceiling.server";
import { planFeatures } from "@/features/tenant-entitlements/plans";
import { RESEARCH_SCHEDULE_CONTROL_KEY, type StandingResearchAuthorizationRecord } from "./contracts";

const CAPABILITY = agentWorkCapability("prepare-research-report");
const DATA_USE = (() => {
  const declared = CAPABILITY.dataUse;
  if (declared.purpose !== "research") throw new Error("prepare-research-report must declare the research purpose.");
  return declared;
})();

/** The most tenants one tick considers. ponytail: a cursor when more than this many tenants hold an authorization. */
export const SCHEDULED_RESEARCH_SCAN_LIMIT = 25;

/* ── the principal ─────────────────────────────────────────────────────────── */

const RESEARCH_SCHEDULE_PRINCIPAL_BRAND: unique symbol = Symbol("hebun.standing-research-authority.research-schedule-principal");

/** One run of one standing research authorization revision. Every field is read off that row or minted here. */
export interface ResearchSchedulePrincipal {
  readonly tenantId: string;
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
  readonly localDate: string;
  readonly [RESEARCH_SCHEDULE_PRINCIPAL_BRAND]: true;
}

export function isResearchSchedulePrincipal(value: unknown): value is ResearchSchedulePrincipal {
  return typeof value === "object" && value !== null && (value as Record<PropertyKey, unknown>)[RESEARCH_SCHEDULE_PRINCIPAL_BRAND] === true;
}

function mint(record: StandingResearchAuthorizationRecord, tenantId: string, runId: string, localDate: string): ResearchSchedulePrincipal {
  return Object.freeze({
    tenantId,
    authorizationId: record.authorizationId,
    authorizationRevision: record.authorizationRevision,
    workItemId: record.workItemId,
    agentId: record.agentId,
    title: record.title,
    brief: record.brief,
    grantedByUserId: record.authorizedByActorId,
    runId,
    localDate,
    [RESEARCH_SCHEDULE_PRINCIPAL_BRAND]: true as const,
  });
}

/** D7 — the Europe/Istanbul calendar date of `now`, as `YYYY-MM-DD`. */
export function istanbulLocalDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/* ── outcomes ──────────────────────────────────────────────────────────────── */

export type ScheduledResearchFailure =
  | "research-schedule-disabled"
  | "authorization-changed"
  | "organization-not-active"
  /** P5-4 — the organization's plan holds no schedule (a downgrade to Free after the grant). */
  | "plan-schedule-not-included"
  | "granter-not-active-member"
  | "granter-lost-governance-authority"
  | "work-unavailable"
  | "agent-not-eligible"
  | "agent-authorship-refused"
  | "model-connectivity-disabled"
  | "research-requires-own-key"
  | "research-data-use-not-authorized"
  | "model-unavailable"
  | "provider-failed"
  | "output-truncated"
  | "model-refused"
  | "research-incomplete"
  | "action-claim-in-output"
  | "link-in-output"
  | "sourced-answer-mismatch"
  | "sourced-no-sources"
  | "authorization-changed-while-preparing"
  | "agent-mandate-changed-while-preparing"
  | "write-refused"
  | "unexpected-error";

export type ScheduledResearchRunOutcome =
  | { readonly status: "filed"; readonly tenantId: string; readonly runId: string; readonly artifactId: string; readonly sourcing: "unsourced" | "web-search" }
  | { readonly status: "failed"; readonly tenantId: string; readonly runId: string; readonly reason: ScheduledResearchFailure; readonly detail?: string }
  /** The day's run for this revision was already claimed: nothing was asked. */
  | { readonly status: "already-run"; readonly tenantId: string };

export type ScheduledResearchScan =
  | { readonly status: "disabled" }
  | { readonly status: "unavailable"; readonly reason: "persistence-unavailable" }
  | { readonly status: "scanned"; readonly localDate: string; readonly considered: number; readonly outcomes: readonly ScheduledResearchRunOutcome[] };

export interface ScheduledResearchDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly now?: () => Date;
  /** The `research-schedule` kill switch. Absent, unreadable or not exactly `true` is off. */
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

function resolveDbOrNull(deps: ScheduledResearchDeps): ControlPlaneDatabase | null {
  if (deps.getDb) return deps.getDb();
  try {
    return getControlPlaneDb();
  } catch {
    return null;
  }
}

const switchOn = (deps: ScheduledResearchDeps) =>
  (deps.readSwitch ?? (() => resolveDirectorEnabled(RESEARCH_SCHEDULE_CONTROL_KEY)))().then((v) => v === true).catch(() => false);

/* ── the tick ──────────────────────────────────────────────────────────────── */

/**
 * One tick: every tenant whose effective standing research authorization is active, sequentially and
 * failure-isolated. The kill switch is read FIRST; off, nothing else is read.
 */
export async function scanScheduledResearch(deps: ScheduledResearchDeps = {}): Promise<ScheduledResearchScan> {
  if (typeof window !== "undefined") throw new Error("Scheduled research is server-only.");
  if (!(await switchOn(deps))) return { status: "disabled" };
  const db = resolveDbOrNull(deps);
  if (!db) return { status: "unavailable", reason: "persistence-unavailable" };
  const now = (deps.now ?? (() => new Date()))();
  const localDate = istanbulLocalDate(now);

  let tenants: string[];
  try {
    const rows = await db.execute(sql`
      select tenant_id from (
        select distinct on (tenant_id) tenant_id, state
        from standing_research_authorizations
        order by tenant_id, authorization_revision desc
      ) effective
      where state = 'active'
      order by tenant_id
      limit ${SCHEDULED_RESEARCH_SCAN_LIMIT}`);
    tenants = (rows.rows as { tenant_id: string }[]).map((r) => r.tenant_id);
  } catch {
    return { status: "unavailable", reason: "persistence-unavailable" };
  }

  const outcomes: ScheduledResearchRunOutcome[] = [];
  for (const tenantId of tenants) {
    outcomes.push(await runScheduledResearchForTenant(tenantId, localDate, db, deps));
  }
  return { status: "scanned", localDate, considered: tenants.length, outcomes };
}

/** One tenant's run for `localDate`. The tenant id comes from the scan's own read, never from a caller. */
async function runScheduledResearchForTenant(
  tenantId: string,
  localDate: string,
  db: ControlPlaneDatabase,
  deps: ScheduledResearchDeps,
): Promise<ScheduledResearchRunOutcome> {
  let record: StandingResearchAuthorizationRecord | null;
  try {
    record = await readEffectiveWithin(db, tenantId);
  } catch {
    return { status: "failed", tenantId, runId: "", reason: "unexpected-error", detail: "lineage-unreadable" };
  }
  if (!record || record.state !== "active") return { status: "failed", tenantId, runId: "", reason: "authorization-changed" };

  /* D6 — CLAIM THE DAY before anything is asked. A conflict means this revision already ran today. */
  const claimed = await db
    .insert(scheduledResearchRuns)
    .values({ tenantId, standingAuthorizationId: record.authorizationId, localDate, status: "claimed" })
    .onConflictDoNothing()
    .returning({ id: scheduledResearchRuns.id })
    .catch(() => null);
  if (claimed === null) return { status: "failed", tenantId, runId: "", reason: "unexpected-error", detail: "claim-failed" };
  if (claimed.length === 0) return { status: "already-run", tenantId };
  const principal = mint(record, tenantId, claimed[0]!.id, localDate);

  let outcome: ScheduledResearchRunOutcome;
  try {
    outcome = await runAsPrincipal(principal, db, deps);
  } catch {
    outcome = { status: "failed", tenantId, runId: principal.runId, reason: "unexpected-error" };
  }
  /* P6 fix 2 — an action-claim refusal keeps its verbs (closed literals from the validator) so the next one names its cause. */
  if (outcome.status === "failed") {
    await db
      .update(scheduledResearchRuns)
      .set({ status: "failed", failureReason: outcome.reason === "action-claim-in-output" && outcome.detail ? `${outcome.reason}:${outcome.detail}`.slice(0, 120) : outcome.reason, finishedAt: new Date() })
      .where(and(eq(scheduledResearchRuns.id, principal.runId), eq(scheduledResearchRuns.status, "claimed")))
      .catch(() => undefined);
  }
  return outcome;
}

async function runAsPrincipal(
  principal: ResearchSchedulePrincipal,
  db: ControlPlaneDatabase,
  deps: ScheduledResearchDeps,
): Promise<ScheduledResearchRunOutcome> {
  if (!isResearchSchedulePrincipal(principal)) throw new Error("not a research schedule principal");
  const { tenantId, runId } = principal;
  const fail = (reason: ScheduledResearchFailure, detail?: string): ScheduledResearchRunOutcome => ({
    status: "failed",
    tenantId,
    runId,
    reason,
    ...(detail ? { detail } : {}),
  });
  const tenant = { tenantId };
  const env = deps.env ?? process.env;
  const dbDeps = { getDb: () => db };

  /* ── re-check everything, before the model ── */
  if (!(await switchOn(deps))) return fail("research-schedule-disabled");
  const inForce = await readEffectiveWithin(db, tenantId);
  if (!inForce || inForce.authorizationId !== principal.authorizationId || inForce.state !== "active") return fail("authorization-changed");

  const org = await db.select({ status: companies.tenantStatus }).from(companies).where(eq(companies.id, tenantId)).limit(1);
  if (org[0]?.status !== "active") return fail("organization-not-active");
  /* P5-4 — the plan is read at run time, before the model: a downgrade stops the next run. */
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

  /* D4 — the tenant's own verified key, and the data-use decision asked about THAT account. */
  let accountRef: string | undefined;
  if (isLiveModelTransport(env)) {
    const credential = await (deps.resolveCredential ?? resolveTenantModelCredential)(tenant, dbDeps);
    if (credential.kind !== "tenant") return fail("research-requires-own-key");
    accountRef = tenantAnthropicAccountRef(credential.integrationId);
  }
  const authorize: AuthorizeExternalAiDisclosure = deps.authorizeDisclosure ?? ((d, o, m, a) => authorizeExternalAiDisclosure(d, o, m, {}, a));
  const modelId = resolveModelConnectivityConfig(env).modelId ?? "";
  const ask = (dataClasses: readonly ((typeof DATA_USE.dataClasses)[number] | typeof DATA_USE.webSearchDataClass)[]) =>
    authorize({ tenantId, actorUserId: principal.grantedByUserId, purpose: DATA_USE.purpose, dataClasses }, claudeOn, modelId, accountRef).catch(() => null);
  const sourcedDecision = await ask([...DATA_USE.dataClasses, DATA_USE.webSearchDataClass]);
  const sourced = sourcedDecision?.disposition === "authorized" && sourcedDecision.authorizedDataClasses.includes(DATA_USE.webSearchDataClass);
  const decision = sourced ? sourcedDecision : await ask(DATA_USE.dataClasses);
  if (decision?.disposition !== "authorized") return fail("research-data-use-not-authorized");

  /* ── the model: the generator, its gates and charge, on the tenant's own key ── */
  const selection = await (deps.selectTransport ?? selectScheduledResearchModelTransport)(tenantId, env, dbDeps);
  if (selection.byokRefusal) return fail("research-requires-own-key", selection.byokRefusal);
  const correlationId = randomUUID();
  let generated;
  try {
    generated = await (deps.generate ?? generateHebyModelAnswer)(
      {
        correlationId,
        tenantId,
        systemInstructions: systemInstructionsFor(WORK_ARTIFACT_PREPARATION_INTENT, sourced ? SOURCED_RESEARCH_BRIEF : RESEARCH_BRIEF),
        userPrompt: principal.brief,
        evidence: [],
        modelId: "",
        maxOutputTokens: 0,
        ...(sourced ? { webSearch: { maxUses: researchWebSearchMaxUses(env) } } : {}),
      },
      {
        ...(deps.generationDeps ?? {}),
        env,
        transport: selection.transport,
        disclosure: {
          tenantId,
          actorUserId: principal.grantedByUserId,
          purpose: DATA_USE.purpose,
          dataClasses: sourced ? [...DATA_USE.dataClasses, DATA_USE.webSearchDataClass] : [...DATA_USE.dataClasses],
        },
      },
    );
  } catch (error) {
    return fail("provider-failed", error instanceof ModelConnectivityError ? error.code : "unknown-provider-error");
  }
  if (generated.status !== "generated") return fail("model-unavailable", generated.state);
  const result = generated.result;
  const stop = classifyProviderStopReason(result.stopReason);
  if (stop === "max_tokens") return fail("output-truncated");
  if (stop === "refusal") return fail("model-refused");
  if (stop === "pause_turn") return fail("research-incomplete");
  const claims = internalDraftActionClaims(result.text);
  if (claims.length > 0) return fail("action-claim-in-output", claims.join(","));

  let content = result.text;
  let webResearch: { searchCount: number; sourceCount: number } | undefined;
  if (sourced) {
    if (!result.webResearch) return fail("model-unavailable", "no-web-research-trace");
    const composed = composeSourcedResearchReport({
      question: principal.brief,
      researchedAt: (deps.now ?? (() => new Date()))(),
      validatedText: result.text,
      trace: result.webResearch,
    });
    if (composed.status === "refused") {
      return fail(composed.reason === "link-in-output" ? "link-in-output" : composed.reason === "no-sources" ? "sourced-no-sources" : "sourced-answer-mismatch");
    }
    content = composed.content;
    webResearch = { searchCount: composed.searchCount, sourceCount: composed.sourceCount };
  } else if (LINK.test(content)) {
    return fail("link-in-output");
  }

  /* ── file: one transaction, re-reading the authorization and the mandate ── */
  let changed: "authorization" | "mandate" | null = null;
  const written = await createResearchReportFromScheduledResearch(
    { tenantId, runId },
    { title: principal.title, content },
    WORK_ARTIFACT_OWNER_WORKSPACE,
    authorship.authorship,
    dbDeps,
    async (tx, created) => {
      const now = await readEffectiveWithin(tx, tenantId);
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
        .update(scheduledResearchRuns)
        .set({ status: "filed", artifactId: created.artifactId, correlationId, finishedAt: new Date() })
        .where(and(eq(scheduledResearchRuns.id, runId), eq(scheduledResearchRuns.status, "claimed")))
        .returning({ id: scheduledResearchRuns.id });
      if (finished.length !== 1) return false;
      await recordScheduledResearchReportFiled(tx, {
        tenantId,
        runId,
        artifactId: created.artifactId,
        agentId: principal.agentId,
        ...mandateRevision,
        capability: CAPABILITY.id,
        purpose: DATA_USE.purpose,
        standingAuthorizationId: principal.authorizationId,
        standingAuthorizationRevision: principal.authorizationRevision,
        grantedByUserId: principal.grantedByUserId,
        localDate: principal.localDate,
        correlationId,
        occurredAt: new Date(),
        ...(webResearch ? { webResearch } : {}),
      });
      return true;
    },
  );
  if (written.status === "refused" && written.reason === "filing-condition-failed") {
    return fail(changed === "mandate" ? "agent-mandate-changed-while-preparing" : "authorization-changed-while-preparing");
  }
  if (written.status !== "created") return fail("write-refused", written.status === "refused" ? written.reason : written.status);
  return { status: "filed", tenantId, runId, artifactId: written.artifactId, sourcing: webResearch ? "web-search" : "unsourced" };
}
