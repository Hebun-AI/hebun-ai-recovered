/*
 * agent-work/assign-work-draft.server.ts — AGENT-EXECUTION-1: a person assigns an agent one bounded
 * task on a work item, the agent performs it, and the outcome is read back from the authorities that
 * recorded it.
 *
 * ── WHO OWNS EACH STEP ───────────────────────────────────────────────────────
 *
 *   the person chooses the work item, the agent and the instruction        Heby (/heby?workItem=)
 *   the person may link evidence to this work                              Governance authority
 *   the agent is in service and responsible for the work's scope           Agent Identity · Agent Mandate
 *   the agent writes the draft (one model call, authored by the agent)     Work Artifacts (prepareWorkArtifact)
 *   the person declares the draft as this work's evidence, as a second,    Organizational Work (WEV-1), through
 *   separate act                                                           its own human action on /director/work
 *   the draft is accepted, or changes are requested                        Governance (artifact review)
 *
 * THIS MODULE OWNS NOTHING. No table, no task row, no state of its own: the assignment is the
 * person's request, the execution is the preparation seam's recorded invocation and revision, the
 * correlation is the evidence reference the person declares, and completion is a Governance review
 * decision. Reading the task back is reading those records (`readWorkDrafts`); nothing here can say
 * "done" on its own.
 *
 * WHY THIS MODULE DOES NOT LINK THE DRAFT. WEV-1 keeps declaration a human act that nothing
 * machine-shaped reaches: its only caller is the human action on /director/work. A link written here,
 * in the same request as a model call, would make the model's run the trigger of a declaration. So the
 * person links the draft themselves, with one more click, through that action.
 *
 * ── WHAT IS CHECKED, AND WHEN ────────────────────────────────────────────────
 *
 * Everything that does not need the model is asked before it, so a refused assignment spends no call:
 * tenant → work item (in service, scoped) → the person's authority to link evidence → the agent's
 * capability (in service, and the ONE shared ceiling: the in-force mandate admits a responsibility-scoped
 * kind and its responsibility covers the scope) → no other assignment of this agent to this work in
 * flight (an advisory lock) → no open draft by the same agent for this work. The preparation seam asks
 * the same ceiling again for the work item's scope, so the two can never disagree. The
 * model call itself is gated by the External-AI Data Use decision inside the preparation seam
 * (`assistance` × conversation, work-artifact). After the draft exists, the work item and the agent's
 * capability are asked AGAIN: a mandate withdrawn while the agent was writing is reported, and the
 * draft is not offered as this work's evidence.
 *
 * This is an enforcement point of the shared ceiling (`refuseOutsideAgentMandate`,
 * `refuseOutsideAgentResponsibility`), exactly like the proposal writer and the permit spend — not a
 * use of the read-only eligibility projection, which no enforcement point may import (AP-4B F2).
 *
 * The client supplies ids and words only. The agent id is a lookup key answered against this tenant's
 * eligibility read; the work item id is answered by the Work Authority's tenant-scoped read; nothing
 * the person writes is parsed for a tenant, an agent, a scope or a permission.
 *
 * Server-only.
 */
import { sql } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { agentWorkCapability, agentWorkRole, refuseOutsideAgentWorkCapability, type AgentWorkRole } from "./capabilities";
import { readDurableAgentIdentityState } from "@/features/agent-identity/read-durable-agent-identity.server";
import { readEffectiveAgentMandate } from "@/features/agent-mandate/read-agent-mandate.server";
import { resolveGovernanceAuthority } from "@/features/governance-decision/authority-read.server";
import { readWorkStateTarget } from "@/features/organizational-work/read-work.server";
import { readWorkEvidenceReferences } from "@/features/organizational-work/read-work-evidence.server";
import type { WorkScope } from "@/features/work-domain/work-scope";
import {
  prepareWorkArtifact,
  toPreparationClientResult,
  WORK_ARTIFACT_OWNER_WORKSPACE,
  type PreparationRefusal,
} from "@/features/work-artifacts/prepare-work-artifact.server";
import type { ContentDestination, WorkArtifactType } from "@/features/work-artifacts/contracts";
import { listWorkArtifacts, readWorkArtifactHistory } from "@/features/work-artifacts/read-work-artifacts.server";
import { readCurrentRevisionReviewStates } from "@/features/work-artifact-review/review-revision.server";
import { artifactRowReviewStatus, type ArtifactRowReviewStatus } from "@/features/work-artifact-review/contracts";
import type { HebyModelFallback } from "@/features/heby-runtime/contracts";
import type { WorkDeclaredState } from "@/features/organizational-work/work-contracts";
import { suggestCompletion, type CompletionSuggestion } from "@/features/work-outcome/contracts";
import { readWorkOutcomeEvidence } from "@/features/work-outcome/read-work-outcome-evidence.server";

const CAPABILITY = agentWorkCapability("prepare-work-draft");

/* The route whose workspace owns prepared work. A constant: the client does not choose the grounding. */
const PREPARATION_ROUTE = `/${WORK_ARTIFACT_OWNER_WORKSPACE}`;

export interface AgentWorkDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly resolveAuthority?: (tenant: TenantContext | null) => Promise<{ readonly authorized: boolean }>;
}

export interface AssignWorkDraftDeps extends AgentWorkDeps {
  readonly resolveTenant: () => Promise<TenantContext | null>;
  /** The released preparation seam, or a test double with its exact signature. */
  readonly prepare?: typeof prepareWorkArtifact;
  /** Extra dependencies handed to the preparation seam unchanged (a test's model transport). */
  readonly preparation?: Omit<Parameters<typeof prepareWorkArtifact>[1], "resolveTenant">;
}

function resolveDbOrNull(): ControlPlaneDatabase | null {
  try {
    return getControlPlaneDb();
  } catch {
    return null;
  }
}

/* ═══ ELIGIBILITY — the capability contract, answered by the authorities that own it ═══════════ */

type WorkTarget = {
  readonly workItemId: string;
  readonly title: string;
  readonly workScope: WorkScope;
  readonly declaredState: WorkDeclaredState;
};

type TargetRead =
  | { readonly status: "resolved"; readonly target: WorkTarget }
  | { readonly status: "refused"; readonly reason: "persistence-unavailable" | "work-unresolved" | "work-retired" | "work-not-scoped" };

async function readTarget(tenant: TenantContext, workItemId: unknown, deps: AgentWorkDeps): Promise<TargetRead> {
  const read = await readWorkStateTarget(tenant, workItemId, { getDb: deps.getDb });
  if (read.status === "unavailable") return { status: "refused", reason: "persistence-unavailable" };
  if (read.status === "unresolved") return { status: "refused", reason: "work-unresolved" };
  if (!read.target.inService) return { status: "refused", reason: "work-retired" };
  if (read.target.workScope === null) return { status: "refused", reason: "work-not-scoped" };
  return {
    status: "resolved",
    target: {
      workItemId: read.target.workItemId,
      title: read.target.title,
      workScope: read.target.workScope,
      declaredState: read.target.declaredState,
    },
  };
}

type EligibleAgent = { readonly agentId: string; readonly name: string; readonly role: AgentWorkRole };

/**
 * In-service agents whose in-force mandate admits one of the capability's responsibility-scoped kinds
 * AND whose responsibility covers this scope — the shared ceiling, asked per kind, never re-derived.
 */
async function eligibleAgents(
  tenant: TenantContext,
  workScope: WorkScope,
  deps: AgentWorkDeps,
): Promise<{ readonly status: "read"; readonly agents: readonly EligibleAgent[] } | { readonly status: "unavailable" }> {
  const identity = await readDurableAgentIdentityState(tenant, { getDb: deps.getDb });
  if (identity.status !== "known") return { status: "unavailable" };
  const agents: EligibleAgent[] = [];
  for (const candidate of identity.identities) {
    if (!candidate.inService) continue;
    const mandate = await readEffectiveAgentMandate(tenant, candidate.agentId, { getDb: deps.getDb });
    if (mandate.status !== "known") return { status: "unavailable" };
    if (!refuseOutsideAgentWorkCapability(CAPABILITY, mandate, workScope)) {
      agents.push({ agentId: candidate.agentId, name: candidate.name, role: agentWorkRole(mandate, workScope) });
    }
  }
  return { status: "read", agents };
}

/* ═══ THE TASK, READ BACK — drafts this work declares as evidence, with their review state ══════ */

export interface WorkDraftView {
  readonly artifactId: string;
  readonly title: string;
  readonly artifactType: WorkArtifactType;
  readonly revisionNo: number;
  readonly retired: boolean;
  /** Who wrote the current revision, from the revision row itself. */
  readonly author: { readonly kind: "agent"; readonly agentId: string; readonly name: string | null } | { readonly kind: "human" };
  /** The Governance review of the current revision. `unknown` when the ledger could not say. */
  readonly review: ArtifactRowReviewStatus;
  readonly declaredAt: string;
}

export type WorkDraftsRead =
  | { readonly status: "read"; readonly drafts: readonly WorkDraftView[] }
  | { readonly status: "unavailable" };

export async function readWorkDrafts(
  tenant: TenantContext | null,
  workItemId: string,
  deps: AgentWorkDeps = {},
): Promise<WorkDraftsRead> {
  if (typeof window !== "undefined") throw new Error("Agent work reads are server-only.");
  if (!tenant?.tenantId) return { status: "unavailable" };
  const listing = await listWorkArtifacts(tenant, { getDb: deps.getDb });
  if (listing.status !== "read") return { status: "unavailable" };
  const evidence = await readWorkEvidenceReferences(tenant, { getDb: deps.getDb, listArtifacts: async () => listing });
  if (evidence.status !== "available") return { status: "unavailable" };

  const references = evidence.references.filter((r) => r.workItemId === workItemId && r.kind === "work-artifact");
  if (references.length === 0) return { status: "read", drafts: [] };

  const identities = await readDurableAgentIdentityState(tenant, { getDb: deps.getDb });
  const names = new Map(identities.status === "known" ? identities.identities.map((i) => [i.agentId, i.name] as const) : []);

  const rows: { view: Omit<WorkDraftView, "review">; currentRevision: number }[] = [];
  for (const reference of references) {
    const artifact = listing.artifacts.find((a) => a.id === reference.referentId);
    if (!artifact) return { status: "unavailable" };
    const history = await readWorkArtifactHistory(tenant, artifact.id, { getDb: deps.getDb });
    const current = history.find((revision) => revision.current);
    if (!current) return { status: "unavailable" };
    rows.push({
      currentRevision: current.revisionNo,
      view: {
        artifactId: artifact.id,
        title: artifact.title,
        artifactType: artifact.artifactType,
        revisionNo: current.revisionNo,
        retired: artifact.lifecycleStatus === "retired",
        author:
          current.authoredByActorType === "agent"
            ? { kind: "agent", agentId: current.authoredByActorId, name: names.get(current.authoredByActorId) ?? null }
            : { kind: "human" },
        declaredAt: reference.declaredAt,
      },
    });
  }
  const reviews = await readCurrentRevisionReviewStates(
    tenant,
    rows.map((row) => ({ artifactId: row.view.artifactId, revisionNo: row.currentRevision })),
    { getDb: deps.getDb },
  );
  return {
    status: "read",
    drafts: rows.map((row) => ({ ...row.view, review: artifactRowReviewStatus(reviews, row.view.artifactId) })),
  };
}

/** A draft by this agent that is still waiting on a human (or whose review could not be read). */
function openDraftBy(drafts: readonly WorkDraftView[], agentId: string): WorkDraftView | undefined {
  return drafts.find(
    (d) => !d.retired && d.author.kind === "agent" && d.author.agentId === agentId && d.review !== "accepted",
  );
}

/* ═══ CHOICES — what Heby shows before anything is asked ══════════════════════════════════════ */

export type WorkDraftChoices =
  | {
      readonly status: "read";
      readonly workItemId: string;
      /** Whether this person may link a draft to this work (Governance authority). */
      readonly mayAssign: boolean;
      readonly agents: readonly (EligibleAgent & { readonly openDraftId: string | null })[];
      /**
       * AGENT-EXECUTION-2 — the agent Heby recommends, by one server-side rule: the work's ONLY specialist
       * (responsible for this kind of work, not organization-wide), when it has no draft waiting. `null`
       * when there is none or more than one; the person then chooses. A recommendation is never a choice:
       * the assignment re-checks everything for whichever agent the person sends.
       */
      readonly recommendedAgentId: string | null;
      /** In-service agents not responsible for this work's scope, by count — never named as options. */
      readonly notResponsible: number;
      readonly drafts: readonly WorkDraftView[];
      /** WORK-OUTCOME-CLOSURE-1 — the work item's declared state, as the Work Authority holds it. */
      readonly declaredState: WorkDeclaredState;
      /**
       * WORK-OUTCOME-CLOSURE-1 — whether Heby suggests that a person declare this work complete, by the
       * one rule the Work register also uses. Advice only: the declaration is the Work Authority's own
       * human act, which asks its own authority again.
       */
      readonly completion: CompletionSuggestion;
    }
  | { readonly status: "refused"; readonly reason: "unauthenticated" | TargetRefusal }
  | { readonly status: "unavailable" };

type TargetRefusal = Extract<TargetRead, { status: "refused" }>["reason"];

export async function readWorkDraftChoices(
  tenant: TenantContext | null,
  workItemId: unknown,
  deps: AgentWorkDeps = {},
): Promise<WorkDraftChoices> {
  if (typeof window !== "undefined") throw new Error("Agent work reads are server-only.");
  if (!tenant?.tenantId || !tenant.userId) return { status: "refused", reason: "unauthenticated" };
  const target = await readTarget(tenant, workItemId, deps);
  if (target.status === "refused") return target;
  const [eligible, drafts, identities, authority, outcome] = await Promise.all([
    eligibleAgents(tenant, target.target.workScope, deps),
    readWorkDrafts(tenant, target.target.workItemId, deps),
    readDurableAgentIdentityState(tenant, { getDb: deps.getDb }),
    (deps.resolveAuthority ?? resolveGovernanceAuthority)(tenant),
    readWorkOutcomeEvidence(tenant, { getDb: deps.getDb }),
  ]);
  if (eligible.status !== "read" || drafts.status !== "read" || identities.status !== "known") return { status: "unavailable" };
  const inService = identities.identities.filter((identity) => identity.inService).length;
  const agents = eligible.agents.map((agent) => ({ ...agent, openDraftId: openDraftBy(drafts.drafts, agent.agentId)?.artifactId ?? null }));
  const specialists = agents.filter((agent) => agent.role === "specialist");
  return {
    status: "read",
    workItemId: target.target.workItemId,
    mayAssign: authority.authorized,
    agents,
    recommendedAgentId: specialists.length === 1 && specialists[0]!.openDraftId === null ? specialists[0]!.agentId : null,
    notResponsible: inService - eligible.agents.length,
    drafts: drafts.drafts,
    declaredState: target.target.declaredState,
    completion: suggestCompletion({
      declaredState: target.target.declaredState,
      inService: true,
      evidence: outcome.status === "read" ? (outcome.byWorkItem[target.target.workItemId] ?? []) : null,
    }),
  };
}

/* ═══ ASSIGN — the person's request, performed by the agent, linked by the person ════════════ */

export interface AssignWorkDraftInput {
  readonly workItemId: unknown;
  readonly agentId: unknown;
  readonly prompt: unknown;
  readonly title: unknown;
  readonly artifactType: unknown;
  readonly intendedDestination?: unknown;
}

export type AssignWorkDraftRefusal =
  | "unauthenticated"
  | TargetRefusal
  /** The person does not hold this organization's Governance authority, which linking evidence needs. */
  | "not-authorized"
  | "agent-required"
  /** The agent is not in service, has no mandate admitting this work, or is not responsible for its scope. */
  | "agent-not-eligible"
  /** Agent identity or mandate could not be read; eligibility is unknown, not absent. */
  | "eligibility-unavailable"
  /** This agent already has a draft on this work waiting for a human; review or revise it first. */
  | "draft-open"
  /** The same agent is already being assigned this work by another request; nothing was asked twice. */
  | "assignment-in-progress";

export type AssignWorkDraftResult =
  /** The agent wrote the draft. It is not yet this work's evidence: the person links it, as a second act. */
  | {
      readonly status: "prepared";
      readonly workItemId: string;
      readonly artifactId: string;
      readonly revisionNo: number;
      readonly agentName: string;
      readonly agentRole: AgentWorkRole;
    }
  /**
   * The agent wrote the draft, but while it was writing it stopped being responsible for this work, or the
   * work was retired or re-scoped. The draft exists; Heby does not offer it as this work's evidence.
   */
  | {
      readonly status: "prepared-stale";
      readonly artifactId: string;
      readonly revisionNo: number;
      readonly reason: "agent-no-longer-eligible" | "work-changed" | "eligibility-unavailable";
    }
  /** The preparation seam refused or the model did not answer. Nothing was written. */
  | {
      readonly status: "not-prepared";
      readonly reason: PreparationRefusal;
      readonly modelFallback?: HebyModelFallback;
    }
  | { readonly status: "refused"; readonly reason: AssignWorkDraftRefusal; readonly openDraftId?: string };

export async function assignWorkDraft(input: AssignWorkDraftInput, deps: AssignWorkDraftDeps): Promise<AssignWorkDraftResult> {
  if (typeof window !== "undefined") throw new Error("Agent work assignment is server-only.");
  const tenant = await deps.resolveTenant();
  if (!tenant?.tenantId || !tenant.userId) return { status: "refused", reason: "unauthenticated" };

  const target = await readTarget(tenant, input?.workItemId, deps);
  if (target.status === "refused") return target;

  const authority = await (deps.resolveAuthority ?? resolveGovernanceAuthority)(tenant);
  if (!authority.authorized) return { status: "refused", reason: "not-authorized" };

  const agentId = typeof input?.agentId === "string" ? input.agentId.trim() : "";
  if (!agentId) return { status: "refused", reason: "agent-required" };
  const eligible = await eligibleAgents(tenant, target.target.workScope, deps);
  if (eligible.status !== "read") return { status: "refused", reason: "eligibility-unavailable" };
  const agent = eligible.agents.find((candidate) => candidate.agentId === agentId);
  if (!agent) return { status: "refused", reason: "agent-not-eligible" };

  /*
   * ONE ASSIGNMENT PER (WORK, AGENT) AT A TIME. The open-draft rule reads drafts that exist; two requests
   * arriving together would both read "none" and both spend a model call. A transaction-scoped advisory
   * lock on this tenant's (work item, agent) pair is held from that read until the draft is filed, and a
   * second request that cannot take it is refused before the model — Postgres serialises, not this
   * process, so it holds across server instances. The lock is released by COMMIT/ROLLBACK, so a crashed
   * request cannot leave it held. It is a lock, not a record: nothing new is stored.
   *
   * ponytail: holds one pooled connection (idle in transaction, no row locks) for the model call's
   * duration per in-flight assignment; a separate lock pool if concurrent assignments approach the pool.
   */
  const db = deps.getDb ? deps.getDb() : resolveDbOrNull();
  if (!db) return { status: "refused", reason: "persistence-unavailable" };
  const lockKey = `${tenant.tenantId}:${target.target.workItemId}:${agent.agentId}`;
  const prepareUnderLock = async (): Promise<AssignWorkDraftResult> => {
    const drafts = await readWorkDrafts(tenant, target.target.workItemId, deps);
    if (drafts.status !== "read") return { status: "refused", reason: "persistence-unavailable" };
    const open = openDraftBy(drafts.drafts, agentId);
    if (open) return { status: "refused", reason: "draft-open", openDraftId: open.artifactId };

    const prepared = await (deps.prepare ?? prepareWorkArtifact)(
      {
        prompt: input?.prompt,
        route: PREPARATION_ROUTE,
        artifactType: input?.artifactType as WorkArtifactType,
        ...(input?.intendedDestination === undefined ? {} : { intendedDestination: input.intendedDestination as ContentDestination }),
        title: typeof input?.title === "string" ? input.title : "",
        agentId: agent.agentId,
      },
      /* The work item's own recorded scope — server-derived — is what the author's responsibility must cover. */
      { ...deps.preparation, resolveTenant: deps.resolveTenant, workScope: target.target.workScope },
    );
    if (prepared.status !== "prepared") {
      const client = toPreparationClientResult(prepared);
      return {
        status: "not-prepared",
        reason: prepared.reason,
        ...("modelFallback" in client && client.modelFallback ? { modelFallback: client.modelFallback } : {}),
      };
    }
    const made = { artifactId: prepared.artifactId, revisionNo: prepared.revisionNo };

    /* STALE CONTEXT. Ask again: the work and the agent's responsibility as they stand now. */
    const after = await readTarget(tenant, target.target.workItemId, deps);
    if (after.status === "refused" || JSON.stringify(after.target.workScope) !== JSON.stringify(target.target.workScope)) {
      return { status: "prepared-stale", ...made, reason: "work-changed" };
    }
    const stillEligible = await eligibleAgents(tenant, after.target.workScope, deps);
    if (stillEligible.status !== "read") return { status: "prepared-stale", ...made, reason: "eligibility-unavailable" };
    if (!stillEligible.agents.some((candidate) => candidate.agentId === agent.agentId)) {
      return { status: "prepared-stale", ...made, reason: "agent-no-longer-eligible" };
    }
    return { status: "prepared", workItemId: target.target.workItemId, ...made, agentName: agent.name, agentRole: agent.role };
  };

  return db.transaction(async (tx) => {
    const locked = await tx.execute(
      sql`select pg_try_advisory_xact_lock(hashtext('hebun.agent-work.assign'), hashtext(${lockKey})) as locked`,
    );
    if ((locked.rows[0] as { locked?: unknown } | undefined)?.locked !== true) {
      return { status: "refused", reason: "assignment-in-progress" } as const;
    }
    return prepareUnderLock();
  });
}

/* ═══ REVISE — Governance asked for changes; the person asks a responsible agent for the next revision ═══ */

/*
 * HEBY-WORKFLOW-1. A draft linked to this work whose current revision carries a standing change request
 * can be revised by an agent responsible for this work, on the person's request — through the same
 * preparation seam, with the WORK ITEM'S recorded scope, so a domain specialist revises its domain work
 * (Operations prepares organization work and refuses it). Nothing new is owned: the change request is the
 * Governance decision already recorded, the revision is the seam's append, and the new revision waits for
 * Governance review like any other. Linking is unchanged: the draft is already this work's evidence.
 *
 * Checked, in order, before the model: tenant → work item → the person's Governance authority → the agent's
 * capability for this scope → (under a per-draft advisory lock) the draft is declared as THIS work's evidence
 * and its current revision's latest decision is a change request. The seam then asks the review basis and
 * the revision number before the model, and again under its writer's artifact lock together with the
 * person's right to revise from the review; the agent's ceiling is asked again before filing. After the
 * revision exists, the work, the agent and the link are asked again (`prepared-stale`).
 */
export interface ReviseWorkDraftInput {
  readonly workItemId: unknown;
  readonly artifactId: unknown;
  readonly agentId: unknown;
  readonly prompt: unknown;
  /** The revision and the change request the person read. Staleness keys, re-checked by the seam; never authority. */
  readonly expectedRevisionNo: unknown;
  readonly reviewBasisDecisionId: unknown;
}

export type ReviseWorkDraftRefusal =
  | Exclude<AssignWorkDraftRefusal, "draft-open" | "assignment-in-progress">
  /** The draft is not declared as this work's evidence — or is not this organization's draft at all. */
  | "draft-not-on-this-work"
  /** The draft's current revision has no standing change request (awaiting review, accepted, retired or unknown). */
  | "no-change-request"
  /** The revision and the change request the person read were not both sent. */
  | "review-basis-required"
  /** Another request is already revising this draft. Nothing was asked twice. */
  | "revision-in-progress";

export type ReviseWorkDraftResult =
  | Exclude<AssignWorkDraftResult, { readonly status: "refused" }>
  | { readonly status: "refused"; readonly reason: ReviseWorkDraftRefusal };

export async function reviseWorkDraft(input: ReviseWorkDraftInput, deps: AssignWorkDraftDeps): Promise<ReviseWorkDraftResult> {
  if (typeof window !== "undefined") throw new Error("Agent work revision is server-only.");
  const tenant = await deps.resolveTenant();
  if (!tenant?.tenantId || !tenant.userId) return { status: "refused", reason: "unauthenticated" };

  const target = await readTarget(tenant, input?.workItemId, deps);
  if (target.status === "refused") return target;
  const scope = target.target.workScope;

  const authority = await (deps.resolveAuthority ?? resolveGovernanceAuthority)(tenant);
  if (!authority.authorized) return { status: "refused", reason: "not-authorized" };

  const expectedRevisionNo = input?.expectedRevisionNo;
  const reviewBasisDecisionId = input?.reviewBasisDecisionId;
  if (typeof expectedRevisionNo !== "number" || !Number.isSafeInteger(expectedRevisionNo) || typeof reviewBasisDecisionId !== "string" || !reviewBasisDecisionId) {
    return { status: "refused", reason: "review-basis-required" };
  }

  /* No default author: the person names the agent (Heby suggests the current revision's author). */
  const agentId = typeof input?.agentId === "string" ? input.agentId.trim() : "";
  if (!agentId) return { status: "refused", reason: "agent-required" };
  const eligible = await eligibleAgents(tenant, scope, deps);
  if (eligible.status !== "read") return { status: "refused", reason: "eligibility-unavailable" };
  const agent = eligible.agents.find((candidate) => candidate.agentId === agentId);
  if (!agent) return { status: "refused", reason: "agent-not-eligible" };

  const artifactId = typeof input?.artifactId === "string" ? input.artifactId : "";
  const db = deps.getDb ? deps.getDb() : resolveDbOrNull();
  if (!db) return { status: "refused", reason: "persistence-unavailable" };

  /*
   * ONE REVISION OF ONE DRAFT AT A TIME, whichever agent and whichever work asks: two requests would both
   * pass the seam's preflight and both spend a model call before its writer refused the second. Held from
   * the link-and-review read until the revision is filed; released by COMMIT/ROLLBACK. A lock, not a record.
   */
  const revisionLockKey = `${tenant.tenantId}:${artifactId}`;
  return db.transaction(async (tx): Promise<ReviseWorkDraftResult> => {
    const lock = await tx.execute(
      sql`select pg_try_advisory_xact_lock(hashtext('hebun.agent-work.revise'), hashtext(${revisionLockKey})) as locked`,
    );
    const held = (lock.rows[0] as { locked?: unknown } | undefined)?.locked === true;
    if (!held) return { status: "refused", reason: "revision-in-progress" };

    const linked = await readWorkDrafts(tenant, target.target.workItemId, deps);
    if (linked.status !== "read") return { status: "refused", reason: "persistence-unavailable" };
    const draft = linked.drafts.find((candidate) => candidate.artifactId === artifactId);
    if (!draft) return { status: "refused", reason: "draft-not-on-this-work" };
    if (draft.retired || draft.review !== "changes-requested") return { status: "refused", reason: "no-change-request" };

    const prepared = await (deps.prepare ?? prepareWorkArtifact)(
      {
        prompt: input?.prompt,
        route: PREPARATION_ROUTE,
        /* A revision is briefed from the STORED type and title; these are the draft's own, never the client's. */
        artifactType: draft.artifactType,
        title: draft.title,
        artifactId: draft.artifactId,
        agentId: agent.agentId,
        expectedRevisionNo,
        reviewBasisDecisionId,
      },
      { ...deps.preparation, resolveTenant: deps.resolveTenant, workScope: scope },
    );
    if (prepared.status !== "prepared") {
      const client = toPreparationClientResult(prepared);
      return {
        status: "not-prepared",
        reason: prepared.reason,
        ...("modelFallback" in client && client.modelFallback ? { modelFallback: client.modelFallback } : {}),
      };
    }
    const made = { artifactId: prepared.artifactId, revisionNo: prepared.revisionNo };

    /* STALE CONTEXT. The work, its scope, the agent's responsibility and the link, as they stand now. */
    const after = await readTarget(tenant, target.target.workItemId, deps);
    if (after.status === "refused" || JSON.stringify(after.target.workScope) !== JSON.stringify(scope)) {
      return { status: "prepared-stale", ...made, reason: "work-changed" };
    }
    const stillLinked = await readWorkDrafts(tenant, target.target.workItemId, deps);
    if (stillLinked.status !== "read" || !stillLinked.drafts.some((candidate) => candidate.artifactId === made.artifactId)) {
      return { status: "prepared-stale", ...made, reason: "work-changed" };
    }
    const stillEligible = await eligibleAgents(tenant, scope, deps);
    if (stillEligible.status !== "read") return { status: "prepared-stale", ...made, reason: "eligibility-unavailable" };
    if (!stillEligible.agents.some((candidate) => candidate.agentId === agent.agentId)) {
      return { status: "prepared-stale", ...made, reason: "agent-no-longer-eligible" };
    }
    return { status: "prepared", workItemId: target.target.workItemId, ...made, agentName: agent.name, agentRole: agent.role };
  });
}
