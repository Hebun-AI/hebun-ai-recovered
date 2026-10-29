/*
 * agent-work/assign-research-report.server.ts — RA-PREP-1: a person asks a responsible agent for one
 * research report on a work item; the agent writes it, and the outcome is read back from the
 * authorities that recorded it. The Research Agent's first performable capability,
 * `prepare-research-report`.
 *
 * ── WHO OWNS EACH STEP ───────────────────────────────────────────────────────
 *
 *   the person chooses the work item, the agent and the question           the caller (no surface yet)
 *   the person may link evidence to this work                              Governance authority
 *   the agent is in service, holds `prepare-research`, is responsible      Agent Identity · Agent Mandate
 *   this tenant authorized research × conversation, the processor and      External-AI Data Use
 *     the model are attested, the Director's Claude control is on
 *   the model call: budget, dispatch cap, disclosure evidence, transport   the model gateway (generateHebyModelAnswer)
 *   the report is filed, once, as a `research-report` by the agent         Work Artifacts (the research writer)
 *   the person links it as this work's evidence, as a separate act         Organizational Work (WEV-1)
 *   the report is accepted, or changes are requested                       Governance (artifact review)
 *
 * THIS MODULE OWNS NOTHING: no table, no state, no lifecycle. It asks the owners above in order and
 * files through the one writer that may create a research report. It is the only importer of that
 * writer (a firewall test holds it), so research-report write authority is this seam's.
 *
 * ── PREPARED ≠ AUTHORIZED ≠ EXECUTED ─────────────────────────────────────────
 *
 * A research report is text for review. Nothing here sends, publishes, proposes, permits or changes
 * a work item; the capability is `PREPARATION_ONLY`. The model's reply is untrusted data: it is filed
 * verbatim and read by nothing that could act on it — no parser, no tool, no lifecycle transition
 * reads it. A reply that asks for an approval, a tenant or a tool is a report with an odd sentence in
 * it.
 *
 * ── UNSOURCED ────────────────────────────────────────────────────────────────
 *
 * No source transport exists (web search is RA-EAI-1-WEB-SEARCH-1, undecided) and nothing verifies a
 * citation. The model is told so before it writes; a reply that carries a link anyway is refused
 * rather than filed, because an unverified URL in a research report reads as a source. What is filed
 * is an UNSOURCED RESEARCH DRAFT (`RESEARCH_REPORT_SOURCING`).
 *
 * ── WHAT IS CHECKED, AND WHEN ────────────────────────────────────────────────
 *
 * Everything that does not need the model is asked before it, so a refused request spends no call and
 * writes nothing: tenant and person → work item (in service, scoped) → the person's Governance
 * authority → the agent's research capability (in service, `prepare-research`, responsible for the
 * scope) → the agent as author → the Director's Claude control → this tenant's research data-use
 * decision, asked of the released External-AI Data Use authority with the purpose and classes the
 * capability declares. The model gateway asks that decision AGAIN at dispatch, with the budget and the
 * dispatch cap, so a withdrawal in between still stops the call. After the model, the agent's
 * capability is asked again before filing.
 *
 * The client supplies ids and words only. The purpose is the capability's; no input field names one.
 *
 * Server-only.
 */
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { agentWorkCapability, refuseOutsideAgentWorkCapability } from "./capabilities";
import { eligibleAgents, readTarget, type AgentWorkDeps, type TargetRead } from "./assign-work-draft.server";
import { readEffectiveAgentMandate } from "@/features/agent-mandate/read-agent-mandate.server";
import { resolveGovernanceAuthority } from "@/features/governance-decision/authority-read.server";
import { answerHebyModelRequest, type HebyModelAnswerDeps } from "@/features/heby-answer/model-answer.server";
import { resolveClaudeDirectorEnabled } from "@/features/heby-provider-ops/provider-connectivity-control.server";
import { resolveModelConnectivityConfig } from "@/features/heby-model/model-connectivity-environment.server";
import {
  authorizeExternalAiDisclosure,
  type AuthorizeExternalAiDisclosure,
} from "@/features/external-ai-data-use/authorize-external-ai-disclosure.server";
import type { HebyModelFallback } from "@/features/heby-runtime/contracts";
import { hebunInstruction } from "@/features/heby-runtime/instruction-channel";
import { resolveAgentAuthorship, type AgentAuthorshipRefusal } from "@/features/work-artifacts/agent-authorship.server";
import type { AgentIdentityReadDeps } from "@/features/agent-identity/read-durable-agent-identity.server";
import {
  unfileableModelAnswer,
  WORK_ARTIFACT_OWNER_WORKSPACE,
  WORK_ARTIFACT_PREPARATION_INTENT,
} from "@/features/work-artifacts/prepare-work-artifact.server";
import { createResearchReportFromResearchPreparation, type WorkArtifactWriteDeps } from "@/features/work-artifacts/write-work-artifacts.server";

const CAPABILITY = agentWorkCapability("prepare-research-report");

/* The purpose and classes are the capability's declaration. One that is not research is a broken contract, never a fallback. */
const DATA_USE = (() => {
  const declared = CAPABILITY.dataUse;
  if (declared.purpose !== "research") throw new Error("prepare-research-report must declare the research purpose.");
  return declared;
})();

/**
 * What the model is told before it writes. Hebun's own words, minted into the instruction channel;
 * the person's question travels as the prompt (the `conversation` class) and nothing else is sent.
 */
export const RESEARCH_REPORT_PREPARATION_BRIEF: readonly string[] = [
  "You are now preparing an UNSOURCED RESEARCH DRAFT, not answering a question.",
  "Your entire reply becomes the draft that a person in this organization will review, byte for byte. Return only the draft: no preamble and no commentary on the task.",
  "There is no GROUNDING CONTEXT for this draft and no source was searched or read. Write from general knowledge, and say plainly where a point is uncertain, may be out of date, or needs checking.",
  "Do not cite sources, quote statistics as if from a source, or include any link or web address. Nothing in this draft is verified, and it must not read as if it were.",
  "Do not state facts about this organization: nothing about it was given to you. Where the research depends on one, leave a bracketed placeholder for the person to fill in.",
  "Never state or imply that anything has been sent, approved, decided or done. This draft is not acted on.",
] as const;

const RESEARCH_BRIEF = { instruction: hebunInstruction(RESEARCH_REPORT_PREPARATION_BRIEF.join(" ")), material: [] as const };

/* A reply that names a web address would read as sourced. Refused, never trimmed: no parser edits model text. */
const LINK = /\bhttps?:\/\/|\bwww\.[a-z0-9-]+\.[a-z]/i;

export interface AssignResearchReportInput {
  readonly workItemId: unknown;
  readonly agentId: unknown;
  readonly question: unknown;
  readonly title: unknown;
}

export interface AssignResearchReportDeps extends AgentWorkDeps, Omit<HebyModelAnswerDeps, "resolveTenant"> {
  readonly resolveTenant: () => Promise<TenantContext | null>;
  readonly answer?: typeof answerHebyModelRequest;
  readonly agentIdentity?: AgentIdentityReadDeps;
  readonly write?: WorkArtifactWriteDeps;
  /** The released data-use authority; injected only so a test can hand it its database. */
  readonly authorizeDisclosure?: AuthorizeExternalAiDisclosure;
}

type TargetRefusal = Extract<TargetRead, { status: "refused" }>["reason"];

export type AssignResearchReportRefusal =
  | "unauthenticated"
  | TargetRefusal
  /** The person does not hold this organization's Governance authority, which linking evidence needs. */
  | "not-authorized"
  | "agent-required"
  /** Not in service, no `prepare-research` mandate, or not responsible for this work's scope. */
  | "agent-not-eligible"
  | "eligibility-unavailable"
  | AgentAuthorshipRefusal
  /** The Director's Claude control is off. */
  | "model-connectivity-disabled"
  /** External-AI Data Use did not authorize research × conversation for this tenant and model. */
  | "research-data-use-not-authorized"
  | "invalid-input";

export type AssignResearchReportResult =
  | { readonly status: "prepared"; readonly workItemId: string; readonly artifactId: string; readonly revisionNo: number; readonly agentName: string }
  /** A model was (or may have been) asked; nothing was filed. */
  | {
      readonly status: "not-prepared";
      readonly reason:
        | "prompt-rejected"
        | "no-model-answer"
        | "not-durable"
        | "output-truncated"
        | "model-refused"
        /** The reply carried a web address; an unsourced draft must not read as sourced. */
        | "unsourced-link-in-output"
        | "agent-mandate-changed-while-preparing"
        | "write-refused";
      readonly modelFallback?: HebyModelFallback;
    }
  | { readonly status: "refused"; readonly reason: AssignResearchReportRefusal };

export async function assignResearchReport(
  input: AssignResearchReportInput,
  deps: AssignResearchReportDeps,
): Promise<AssignResearchReportResult> {
  if (typeof window !== "undefined") throw new Error("Research preparation is server-only.");
  const tenant = await deps.resolveTenant();
  if (!tenant?.tenantId || !tenant.userId) return { status: "refused", reason: "unauthenticated" };

  const target = await readTarget(tenant, input?.workItemId, deps);
  if (target.status === "refused") return target;
  const workScope = target.target.workScope;

  const authority = await (deps.resolveAuthority ?? resolveGovernanceAuthority)(tenant);
  if (!authority.authorized) return { status: "refused", reason: "not-authorized" };

  const agentId = typeof input?.agentId === "string" ? input.agentId.trim() : "";
  if (!agentId) return { status: "refused", reason: "agent-required" };
  const eligible = await eligibleAgents(tenant, workScope, deps, CAPABILITY);
  if (eligible.status !== "read") return { status: "refused", reason: "eligibility-unavailable" };
  const agent = eligible.agents.find((candidate) => candidate.agentId === agentId);
  if (!agent) return { status: "refused", reason: "agent-not-eligible" };

  const question = typeof input?.question === "string" ? input.question : "";
  const title = typeof input?.title === "string" ? input.title.trim() : "";
  if (!question.trim() || !title) return { status: "refused", reason: "invalid-input" };

  const authorship = await resolveAgentAuthorship(tenant, deps.agentIdentity ?? { getDb: deps.getDb }, { agentId: agent.agentId });
  if (authorship.status === "refused") return { status: "refused", reason: authorship.reason };

  const directorEnabled = await (deps.resolveDirectorEnabled ?? resolveClaudeDirectorEnabled)().catch(() => false);
  if (!directorEnabled) return { status: "refused", reason: "model-connectivity-disabled" };

  /*
   * THE TENANT'S RESEARCH AUTHORIZATION, BEFORE THE MODEL. The released authority, asked with the
   * capability's own declaration and the model the deployment would send; nothing is written. An
   * assistance authorization does not answer it: the composer matches purpose and class exactly.
   */
  const env = deps.env ?? process.env;
  const decision = await (deps.authorizeDisclosure ?? ((d, o, m) => authorizeExternalAiDisclosure(d, o, m)))(
    { tenantId: tenant.tenantId, actorUserId: tenant.userId, purpose: DATA_USE.purpose, dataClasses: DATA_USE.dataClasses },
    directorEnabled,
    resolveModelConnectivityConfig(env).modelId ?? "",
  ).catch(() => null);
  if (decision?.disposition !== "authorized") return { status: "refused", reason: "research-data-use-not-authorized" };

  const answer = await (deps.answer ?? answerHebyModelRequest)(
    /* No conversation id: a research request carries no earlier turn, so only this question is sent. */
    { prompt: question, route: `/${WORK_ARTIFACT_OWNER_WORKSPACE}` },
    { ...deps, resolveTenant: deps.resolveTenant },
    {
      intent: WORK_ARTIFACT_PREPARATION_INTENT,
      preparationBrief: RESEARCH_BRIEF,
      /* The brief is instruction only; it carries no data class beyond the conversation. */
      preparationBriefDataClasses: [],
      actionClaimMode: "internal-draft",
      dataUsePurpose: DATA_USE.purpose,
    },
  );
  if (answer.status === "unauthorized") return { status: "refused", reason: "unauthenticated" };
  if (answer.status === "rejected") return { status: "not-prepared", reason: "prompt-rejected" };
  const fallback = answer.outcome.response.modelFallback;
  const notPrepared = (reason: Extract<AssignResearchReportResult, { status: "not-prepared" }>["reason"]): AssignResearchReportResult => ({
    status: "not-prepared",
    reason,
    ...(fallback ? { modelFallback: fallback } : {}),
  });
  const unfileable = unfileableModelAnswer(answer);
  if (unfileable) return notPrepared(unfileable);
  if (!answer.persistence.durable) return notPrepared("not-durable");

  const content = answer.outcome.response.body.join("\n");
  if (LINK.test(content)) return notPrepared("unsourced-link-in-output");

  /* A mandate or responsibility withdrawn while the model was writing stops the filing. */
  const mandate = await readEffectiveAgentMandate(tenant, agent.agentId, { getDb: deps.getDb });
  if (refuseOutsideAgentWorkCapability(CAPABILITY, mandate, workScope)) return notPrepared("agent-mandate-changed-while-preparing");

  const written = await createResearchReportFromResearchPreparation(
    tenant,
    { title, content, sourceMessageId: answer.persistence.assistantMessageId },
    WORK_ARTIFACT_OWNER_WORKSPACE,
    authorship.authorship,
    deps.write ?? { getDb: deps.getDb },
  );
  if (written.status !== "created") return notPrepared("write-refused");
  return { status: "prepared", workItemId: target.target.workItemId, artifactId: written.artifactId, revisionNo: written.revisionNo, agentName: agent.name };
}
