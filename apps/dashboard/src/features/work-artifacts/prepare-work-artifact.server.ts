/*
 * work-artifacts/prepare-work-artifact.server.ts — the ONE Heby seam that produces a durable
 * artifact (R3W).
 *
 * ── WHY THIS EXISTS AS A SEPARATE ENTRY POINT ────────────────────────────────
 *
 * `answerHebyModelRequest` answers questions. It records messages, and R3W does not change that:
 * a normal Heby answer stays a message and never becomes prepared work. The separation is
 * STRUCTURAL, not a convention — `model-answer.server.ts` imports the artifact READER and no
 * artifact writer at all, so there is no representation in which an ordinary answer could create
 * one. This module is the only thing that imports both, and it is reached only when a human
 * explicitly asked for prepared work.
 *
 * That is the same shape K2 uses to keep Heby out of Knowledge: `createKnowledgeAction` is a
 * separate action that Heby's own actions do not import.
 *
 * ── THE RUNTIME KNOWS IT IS PREPARING ────────────────────────────────────────
 *
 * The intent is DECLARED (`PREPARE_RECOMMENDATION` — one of the two `prepares: true` intents in
 * `HEBY_INTENT_DESCRIPTORS`), not inferred from the prompt. R3W adds NO classifier anywhere; that
 * remains R3A.1's work. The caller states what it is doing and the flow records exactly that.
 *
 * ── NO PARSER, DELIBERATELY ──────────────────────────────────────────────────
 *
 * The assistant's whole reply becomes the revision content, verbatim. There is no extraction of
 * "the draft part", no heuristic to find a fenced block, no reformatting. A parser would be a
 * second, silent author: it would decide what the model meant, and the bytes a human later
 * approved would be bytes nobody wrote.
 *
 * ── WHO THE AUTHOR IS (AGENT-RUNTIME-0) ─────────────────────────────────────
 *
 * The revision is authored by the tenant's DURABLE AGENT IDENTITY, resolved here through
 * `resolveAgentAuthorship` — never named by the caller, never inferred from the prompt, and never
 * the human's own id. A tenant with no in-service durable agent gets a typed refusal and no
 * artifact: an organization that has not established an agent has no agent that could have written
 * anything, and recording the requesting human as the author of model-produced bytes would be the
 * same false record this repair removed.
 *
 * The human `TenantContext` remains the AUTHORIZATION context for the whole request. The agent
 * identity supplies AUTHORSHIP only. Nothing here authenticates or authorizes the agent.
 *
 * ── NOTHING IS ASKED OF THE MODEL THAT COULD NOT BE FILED (CGO-9) ─────────────
 *
 * Every prerequisite that does not need the model is checked BEFORE the model is invoked, in this
 * order: tenant → durable-agent authorship → Claude provider control → target and input validity.
 * Until CGO-9 the model was asked first and the author was resolved afterwards, so a tenant with no
 * agent still spent a model call and persisted two message rows for work that could never be filed.
 *
 * That gives three outcomes, and they are three different facts:
 *
 *   preflight refusal        no model invocation, no message row, no artifact or revision write.
 *   post-invocation failure  a model was really invoked; its `messages` provenance stays exactly
 *                            as the answer flow recorded it, and no artifact or revision is written.
 *                            Erasing that row would hide real usage in order to look tidy.
 *   prepared                 the invocation's provenance plus exactly one legitimate artifact
 *                            creation or revision append, linked by `source_message_id`.
 *
 * The provider-control read here is the same injected read the answer flow uses. If the Director
 * switches Claude off between this check and the invocation, the answer flow still degrades to its
 * honest deterministic answer and this seam refuses it as `no-model-answer`.
 *
 * ── WHAT A PREPARED ARTIFACT IS NOT ──────────────────────────────────────────
 *
 * Not Knowledge, not approved, not authoritative, not executed. It is text somebody may now read,
 * revise, and — later, through R3A and a Governance decision — authorize an action against.
 *
 * Server-only.
 */
import {
  answerHebyModelRequest,
  type HebyModelAnswerDeps,
  type HebyModelAnswerResult,
} from "@/features/heby-answer/model-answer.server";
import type { AgentIdentityReadDeps } from "@/features/agent-identity/read-durable-agent-identity.server";
import { preparationDiagnosisLine } from "./preparation-diagnosis";
import {
  readEffectiveAgentMandate,
  type AgentMandateReadDeps,
} from "@/features/agent-mandate/read-agent-mandate.server";
import {
  agentWorkCapability,
  refuseOutsideAgentWorkCapability,
} from "@/features/agent-work/capabilities";
import type { WorkScope } from "@/features/work-domain/work-scope";
import { resolveClaudeDirectorEnabled } from "@/features/heby-provider-ops/provider-connectivity-control.server";
import { resolveSource } from "@/features/heby-runtime/source-resolver";
import type { HebyModelFallback } from "@/features/heby-runtime/contracts";
export type { HebyModelFallback };
import {
  resolveAgentAuthorship,
  type AgentAuthorshipRefusal,
} from "./agent-authorship.server";
import { CONTENT_DRAFT_TYPE } from "./contracts";
import type {
  ContentDestination,
  WorkArtifactType,
  WorkArtifactValidationProblem,
} from "./contracts";
import { preparationBriefFor } from "./preparation-brief";
import { isReviewBasisCurrent, mayReviseFromReview } from "@/features/work-artifact-review/change-request.server";
import { resolveReviewDbOrNull } from "@/features/work-artifact-review/review-revision.server";
import {
  listWorkArtifacts,
  readWorkArtifactHistory,
  type WorkArtifactReadDeps,
} from "./read-work-artifacts.server";
import { validateWorkArtifactInput } from "./validation";
import {
  createWorkArtifactFromHebyPreparation,
  reviseWorkArtifactFromHebyPreparation,
  type WorkArtifactWriteDeps,
} from "./write-work-artifacts.server";

/**
 * The workspace that owns prepared work today.
 *
 * Both action tools that name a `record-ref` an artifact could satisfy —
 * `heby.operations.prepare-plan` and `heby.operations.send-communication` — declare
 * `ownerWorkspace: "operations"`, and Operations is the only workspace profile carrying the
 * `work-artifacts` source class. It is a constant rather than a parameter so a caller cannot
 * attribute prepared work to a workspace that does not own the capability.
 */
export const WORK_ARTIFACT_OWNER_WORKSPACE = "operations";

/** The declared intent. One of exactly two with `prepares: true`; never inferred from text. */
export const WORK_ARTIFACT_PREPARATION_INTENT = "PREPARE_RECOMMENDATION" as const;

/** The client-supplied part. Carries no tenant, no actor, no authority, no lifecycle. */
export interface PrepareWorkArtifactInput {
  /** What the human asked to have prepared. Validated by the existing prompt validator. */
  readonly prompt: unknown;
  readonly route: string;
  readonly artifactType: WorkArtifactType;
  /**
   * CGO-3 — WHERE A PREPARED CONTENT DRAFT WAS PREPARED TO GO.
   *
   * THE HUMAN'S DECLARATION, exactly like `title`, and never derived from model output. The model
   * writes the bytes; it does not choose the destination, and no classifier reads the reply looking
   * for one. A model that produced a caption mentioning Instagram has not decided anything about
   * where this organization intends to put it.
   *
   * Required by the released validator when `artifactType` is `content-draft` and refused on every
   * other type — CGO-1's rule, enforced once in the writer rather than restated here. Before this
   * field existed the agent path could be ASKED for a content draft and always failed closed at
   * that validator, which is why it is the only thing this phase adds.
   */
  readonly intendedDestination?: ContentDestination;
  /**
   * CGO-7 — a PUBLIC PLATFORM OBSERVATION, already rendered and already fenced, appended to the
   * preparation brief the model receives.
   *
   * A STRING AND NOTHING ELSE, and that is the boundary this phase is built on. This seam does not
   * read a provider, hold a key, know which provider it came from, or contain one line that could
   * make a call — R3W's and CGO-3's firewalls both assert that about this file and both still hold.
   * The composition that reads YouTube lives in its own module and hands the result across.
   *
   * NEVER STORED AND NEVER GROUNDING. It reaches the model through the brief, which is instruction:
   * dropped for any non-preparing intent, absent from every message row, and outside the grounding
   * context that CGO-6 proved carries only this organization's own records. Nothing below reads it,
   * and the bytes stored as the artifact remain the model's whole reply.
   */
  readonly observationSupplement?: string;
  /** The human's title for the work. Never derived from model output. */
  readonly title: string;
  readonly conversationId?: string;
  /**
   * When present, the reply is appended as a NEW REVISION of this artifact instead of creating
   * one. Re-checked against the tenant server-side; a foreign or unknown id is refused.
   */
  readonly artifactId?: string;
  /**
   * AP-5A — WHICH in-service agent the human names as the author, when more than one is in service.
   *
   * A LOOKUP KEY, never authority: `resolveAgentAuthorship` verifies it against this tenant's own
   * identity read and refuses a foreign, unknown or retired id. Omitted, the single-agent rule
   * answers exactly as before — and with several agents in service an omitted one is refused as
   * ambiguous, so nothing is ever authored by an agent nobody named.
   */
  readonly agentId?: string;
  /**
   * CONTENT-AGENT-2 — the revision the human was looking at. Checked before the model is asked AND
   * inside the revision writer's lock; a draft revised since refuses rather than stacks.
   */
  readonly expectedRevisionNo?: number;
  /**
   * CONTENT-AGENT-2 — the change-request decision the human revised from. A STALENESS KEY, never
   * input: this seam never reads the reason text (the human's own prompt carries whatever they kept
   * of it). Requires `expectedRevisionNo`. Checked before the model and again under the writer's lock.
   */
  readonly reviewBasisDecisionId?: string;
}

export interface PrepareWorkArtifactDeps {
  readonly answer?: typeof answerHebyModelRequest;
  readonly write?: WorkArtifactWriteDeps;
  /**
   * The durable-agent read seam's database handle. Injected the same way the writer's is, and for
   * the same reason: without it the read would resolve the ambient `DATABASE_URL`.
   */
  readonly agentIdentity?: AgentIdentityReadDeps;
  /**
   * CGO-9. The released artifact reader's handle, for the preflight read of a revision's target.
   * Defaults to the writer's handle so a caller that injected one database never reads another.
   */
  readonly read?: WorkArtifactReadDeps;
  /** AGENT-EXECUTION-1. The mandate read's handle; defaults to the identity read's, then the writer's. */
  readonly mandate?: AgentMandateReadDeps;
  /**
   * AGENT-EXECUTION-1 — the work the named author must be responsible for. SERVER-DERIVED ONLY: it is a
   * dependency, never an input field, so no client payload can widen it. Omitted, the draft is
   * organization work (Operations prepares for the organization, not for a work domain), and the author
   * needs organization-level responsibility. The AGENT-EXECUTION-1 assignment seam passes the work
   * item's own recorded scope.
   */
  readonly workScope?: WorkScope;
  /** AOR-1a — where the one diagnosis line goes. The host's runtime log unless a test captures it. */
  readonly log?: (line: string) => void;
}

const ORGANIZATION_WORK: WorkScope = Object.freeze({ kind: "organization" as const });

/**
 * Why preparation produced no artifact. Each value is a fact about what happened; none of them is
 * a judgement about the content.
 */
export type PreparationRefusal =
  | "unauthenticated"
  | "prompt-rejected"
  /** The model path degraded to a deterministic answer, so there is no prepared text to store. */
  | "no-model-answer"
  /** The exchange was not durably persisted, so there is no message to attribute a revision to. */
  | "not-durable"
  /**
   * AGENT-RUNTIME-0. The organization has no durable agent that could truthfully be named as the
   * author. Each value is passed through from `resolveAgentAuthorship` UNCHANGED rather than folded
   * into one code: "you have never created an agent", "your agent is retired" and "the identity
   * authority is unreachable" are three different facts and a human acts differently on each.
   */
  | AgentAuthorshipRefusal
  /**
   * AGENT-EXECUTION-1 preflight. The named author's in-force mandate does not admit drafting this work
   * (the shared ceiling's own refusal, passed through unchanged), or the mandate could not be read.
   */
  | "agent-mandate-authority-unavailable"
  | "no-agent-mandate"
  | "action-outside-agent-mandate"
  | "work-scope-required"
  | "work-outside-agent-responsibility"
  /**
   * AGENT-EXECUTION-1 post-invocation. While the model was writing, the author's mandate or
   * responsibility was withdrawn; the message record stays, no revision was filed.
   */
  | "agent-mandate-changed-while-preparing"
  /**
   * OUTPUT-INTEGRITY-1 post-invocation. The provider stopped at the output limit (`max_tokens`), so the
   * text is incomplete. A cut reply is never filed as a review-ready draft; the message record stays.
   */
  | "output-truncated"
  /** CGO-9 preflight. The Director's Claude provider control is off, so no model was invoked. */
  | "model-connectivity-disabled"
  /** CGO-9 preflight. The released validator refused the classification or title; see `problems`. */
  | "invalid-input"
  /** CGO-9 preflight. No such artifact in this tenant — a foreign id is indistinguishable, on purpose. */
  | "artifact-not-found"
  /** CGO-9 preflight. A retired artifact takes no further revisions. */
  | "artifact-retired"
  /** CGO-9 preflight. The artifact authority could not be read, so the target is unknown, not absent. */
  | "target-unavailable"
  /** CONTENT-AGENT-2 preflight. The draft was revised since the human read it; Hebun was not asked. */
  | "revision-stale"
  /** CONTENT-AGENT-2 preflight. The change request revised from no longer stands; Hebun was not asked. */
  | "review-basis-stale"
  /**
   * CONTENT-AGENT-2 preflight. Revising FROM a review is for the people who may read review reasons:
   * a Governance authority of this tenant. Anyone else may still prepare with their own instruction.
   */
  | "review-basis-not-authorized"
  /**
   * CONTENT-AGENT-2 post-invocation. While Hebun was writing, the draft was revised or its review
   * changed; the writer refused under its lock. The message record stays, no revision was filed.
   */
  | "changed-while-preparing"
  | "write-refused";

export type PrepareWorkArtifactResult =
  | {
      readonly status: "prepared";
      readonly artifactId: string;
      readonly revisionNo: number;
      readonly contentDigest: string;
      readonly ref: string;
      readonly conversationId: string;
      readonly sourceMessageId: string;
      /** The full answer, so the surface can show what was said as well as what was stored. */
      readonly answer: HebyModelAnswerResult;
    }
  | {
      readonly status: "refused";
      readonly reason: PreparationRefusal;
      /**
       * Present only when the answer flow ran. A preflight refusal carries none, because no model
       * was invoked and nothing was said.
       */
      readonly answer?: HebyModelAnswerResult;
      /** The released validator's problems, for an `invalid-input` preflight refusal. */
      readonly problems?: readonly WorkArtifactValidationProblem[];
    };

/**
 * What a preparation result may carry to a browser. The answer stays on the server: the surface
 * needs the outcome and, on a fallback, the closed reason code — never the answer body, its
 * evidence or its limitations.
 */
export type PreparationClientResult =
  | Omit<Extract<PrepareWorkArtifactResult, { status: "prepared" }>, "answer">
  | (Omit<Extract<PrepareWorkArtifactResult, { status: "refused" }>, "answer"> & {
      readonly modelFallback?: HebyModelFallback;
    });

/** Pure. Drop the answer; keep only the fallback code a refusal's answer named, if any. */
export function toPreparationClientResult(result: PrepareWorkArtifactResult): PreparationClientResult {
  const { answer, ...rest } = result;
  if (rest.status === "prepared") return rest;
  const modelFallback = answer?.status === "answered" ? answer.outcome.response.modelFallback : undefined;
  return modelFallback ? { ...rest, modelFallback } : rest;
}

/**
 * Ask Heby to prepare work, and durably keep what it produced.
 *
 * WHY A DETERMINISTIC FALLBACK IS NOT STORED. When the transport fails, validation withholds the
 * answer, or the Director's kill-switch turned off after the preflight read it (a kill-switch that
 * is already off is refused before invocation), `answerHebyModelRequest` returns an honest
 * deterministic response — for `PREPARE_RECOMMENDATION` that is an explicit UNAVAILABLE, because
 * preparation genuinely needs generative reasoning. Storing that as a revision would file
 * "no model runtime is connected" as though it were prepared work. Refused instead, and the
 * answer is handed back so the human sees exactly what happened.
 */
const PREPARATION_CAPABILITY = agentWorkCapability("prepare-work-draft");

export async function prepareWorkArtifact(
  input: PrepareWorkArtifactInput,
  deps: HebyModelAnswerDeps & PrepareWorkArtifactDeps,
): Promise<PrepareWorkArtifactResult> {
  if (typeof window !== "undefined") {
    throw new Error("Work artifact preparation is server-only.");
  }

  /*
   * ── PREFLIGHT: everything that does not need the model, before the model (CGO-9) ──
   *
   * 1. THE TENANT. Resolved server-side, exactly as the answer flow resolves it.
   */
  const tenant = await deps.resolveTenant();
  if (!tenant) return { status: "refused", reason: "unauthenticated" };

  /*
   * 2. WHO IS ABOUT TO BE RECORDED AS THE AUTHOR. Resolved from the authoritative durable-agent read
   * seam against THIS tenant — never from the prompt, the client, or the human's own id.
   *
   * A refusal here stops everything. No valid durable agent means nothing Hebun prepared could be
   * filed truthfully, so Hebun does not invoke the model and does not persist model messages for it.
   */
  const authorship = await resolveAgentAuthorship(tenant, deps.agentIdentity ?? {}, { agentId: input.agentId });
  if (authorship.status === "refused") {
    return { status: "refused", reason: authorship.reason };
  }

  /*
   * 2b. AGENT-EXECUTION-1 — WHETHER THAT AUTHOR MAY DO THIS WORK. Naming an in-service agent as the
   * author used to be the only check, so any agent could be recorded as having written any draft. The
   * author's in-force mandate must admit the work capability and its responsibility must cover the
   * work's scope — the ONE shared ceiling, asked here so every preparation path (Operations, the
   * observation-grounded path, Heby's work assignment) passes through it. Before the model: a refused
   * author spends no call.
   */
  const workScope = deps.workScope ?? ORGANIZATION_WORK;
  const mandateDeps: AgentMandateReadDeps = deps.mandate ?? { getDb: deps.agentIdentity?.getDb ?? deps.write?.getDb };
  const askCeiling = async () =>
    refuseOutsideAgentWorkCapability(
      PREPARATION_CAPABILITY,
      await readEffectiveAgentMandate(tenant, authorship.authorship.agentId, mandateDeps),
      workScope,
    );
  const ceilingRefusal = await askCeiling();
  if (ceilingRefusal) return { status: "refused", reason: ceilingRefusal };

  /* 3. THE DIRECTOR'S CLAUDE PROVIDER CONTROL. The same fail-closed read the answer flow makes. */
  const directorEnabled = await (deps.resolveDirectorEnabled ?? resolveClaudeDirectorEnabled)();
  if (!directorEnabled) return { status: "refused", reason: "model-connectivity-disabled" };

  /*
   * 4. THE TARGET AND THE INPUT. A revision's target is read through the released reader, tenant-
   * scoped; its own type and destination brief the model, never the client's restatement of them.
   * A new artifact's classification and title are judged by the released validator — the content
   * is the model's to write, so only the content problem is not asked about yet.
   */
  let briefInput: Parameters<typeof preparationBriefFor>[0];
  if (input.artifactId) {
    const readDeps: WorkArtifactReadDeps = deps.read ?? { getDb: deps.write?.getDb };
    const listing = await listWorkArtifacts(tenant, readDeps);
    if (listing.status !== "read") return { status: "refused", reason: "target-unavailable" };
    const target = listing.artifacts.find((artifact) => artifact.id === input.artifactId);
    if (!target) return { status: "refused", reason: "artifact-not-found" };
    if (target.lifecycleStatus === "retired") return { status: "refused", reason: "artifact-retired" };

    const history = await readWorkArtifactHistory(tenant, target.id, readDeps);
    const current = history.find((revision) => revision.current);
    if (!current) return { status: "refused", reason: "target-unavailable" };
    /*
     * CONTENT-AGENT-2 — STALE STATE, BEFORE THE MODEL. Cheap to ask, and a stale request should not
     * spend a model call. Not sufficient on its own: the writer asks both questions again under the
     * artifact lock, because a revision or a review may land while the model is writing.
     */
    /* Shape first: a client may send anything. The basis is meaningless without the revision it was read on. */
    if (
      (input.expectedRevisionNo !== undefined && (!Number.isSafeInteger(input.expectedRevisionNo) || input.expectedRevisionNo < 1)) ||
      (input.reviewBasisDecisionId !== undefined && (typeof input.reviewBasisDecisionId !== "string" || input.expectedRevisionNo === undefined))
    ) {
      return { status: "refused", reason: "invalid-input", problems: [] };
    }
    if (input.expectedRevisionNo !== undefined && current.revisionNo !== input.expectedRevisionNo) {
      return { status: "refused", reason: "revision-stale" };
    }
    if (input.reviewBasisDecisionId !== undefined) {
      const reviewDb = (readDeps.getDb ?? deps.write?.getDb ?? resolveReviewDbOrNull)();
      if (!reviewDb) return { status: "refused", reason: "target-unavailable" };
      /*
       * Whoever may READ the reason is the only one who may revise FROM it — asked of the review
       * module, which owns that answer. A decision id is visible to every member through the
       * review-state read, so the id alone must not open this path.
       */
      if (!(await mayReviseFromReview(reviewDb, tenant))) return { status: "refused", reason: "review-basis-not-authorized" };
      const stands = await isReviewBasisCurrent(reviewDb, tenant, {
        artifactId: target.id,
        revisionNo: current.revisionNo,
        decisionId: input.reviewBasisDecisionId,
      });
      if (!stands) return { status: "refused", reason: "review-basis-stale" };
    }

    briefInput = {
      artifactType: target.artifactType,
      intendedDestination: target.intendedDestination ?? undefined,
      observationSupplement: input.observationSupplement,
      currentRevision: { revisionNo: current.revisionNo, content: current.content },
    };
  } else {
    const problems = validateWorkArtifactInput({
      artifactType: input.artifactType,
      title: input.title,
      intendedDestination: input.intendedDestination,
    }).filter((problem) => problem.field !== "content");
    if (problems.length > 0) return { status: "refused", reason: "invalid-input", problems };
    /* A staleness key names a revision of an EXISTING draft; on a new draft it is malformed. */
    if (input.expectedRevisionNo !== undefined || input.reviewBasisDecisionId !== undefined) {
      return { status: "refused", reason: "invalid-input", problems: [] };
    }
    briefInput = input;
  }

  /*
   * KNOWLEDGE TRUST PHASE 5 — PUBLIC PURPOSE IS THE ARTIFACT'S TYPE. A content draft is the only type
   * a Content Package exists for, and so the only one that can be published; for a revision the type
   * is the STORED one, so no request can relabel an existing draft. A client that creates another
   * type gets internal semantics and an artifact that can never become public content.
   */
  const publicContent = briefInput.artifactType === CONTENT_DRAFT_TYPE;

  /* ── INVOCATION: from here on, a refusal may follow a real model call ── */
  const answerFn = deps.answer ?? answerHebyModelRequest;
  const answer = await answerFn(
    { prompt: input.prompt, route: input.route, conversationId: input.conversationId },
    /*
     * HEBY-MEDIA-1 gives Operations a `content-media` class so Heby can SEE a draft's media when
     * asked. Preparation writes the caption and is production-accepted as grounded on the
     * organization's own records only (CGO-6); media facts and connectivity switches would widen
     * what a caption rests on. So preparation resolves the class to its pure, unread form — pinned
     * in tests/heby-media-1 — and its grounding is exactly what it was before this phase.
     */
    {
      ...deps,
      resolveContentMedia: async () => resolveSource("content-media"),
      /*
       * KT-5 — a content draft is public content. Knowledge coverage counts every fact in force, cleared
       * for public use or not, so for a content draft it resolves to its pure, unread form too.
       */
      ...(publicContent ? { resolveKnowledgeCoverage: async () => resolveSource("knowledge-coverage") } : {}),
    },
    {
      intent: WORK_ARTIFACT_PREPARATION_INTENT,
      /* KT-5 — derived from the artifact's own type (the stored one for a revision), never from a client flag. */
      ...(publicContent ? { knowledgePurpose: "public-content" as const } : {}),
      /*
       * CGO-4. The model is told, BEFORE it writes, that its whole reply is the artifact — so it
       * authors the durable bytes directly. This is the only place the product asks for a cleaner
       * draft: nothing below reads, trims or extracts the reply, and the no-parser rule above is
       * unchanged. Resolved from the human's declared type and destination, never from the prompt.
       */
      preparationBrief: preparationBriefFor(briefInput),
      /*
       * EXTERNAL-AI-DATA-USE-B2 — the brief's classes by owning authority: the artifact's type,
       * destination and revision are the work-artifact authority's; a platform observation is the
       * provider observation authority's, and assistance does not cover it, so a preparation that
       * carries one is refused before the model is asked.
       */
      preparationBriefDataClasses: input.observationSupplement ? ["work-artifact", "provider-observation"] : ["work-artifact"],
      /*
       * AOR-1b — an internal plan or message is judged as a draft a person will act on: planning and
       * checklist language passes, and a completed act is a claim even when attributed to someone else.
       * Derived from the artifact's own type (the stored one for a revision); a content draft keeps the
       * answer rule. Never from a client field or the model.
       */
      ...(publicContent ? {} : { actionClaimMode: "internal-draft" as const }),
    },
  );

  if (answer.status === "unauthorized") return { status: "refused", reason: "unauthenticated" };
  if (answer.status === "rejected") return { status: "refused", reason: "prompt-rejected" };

  /* AOR-1a — one line when a model really answered, before anything decides what to do with it. */
  const diagnosis = preparationDiagnosisLine(answer);
  if (diagnosis) (deps.log ?? ((line: string) => console.info(line)))(diagnosis);

  /*
   * ONLY MODEL-ORIGIN TEXT BECOMES PREPARED WORK. `origin` is set by the answer flow from what
   * actually happened, never by this module, so this cannot be talked into storing a fallback.
   */
  if (answer.outcome.response.origin !== "model") {
    return { status: "refused", reason: "no-model-answer", answer };
  }
  if (!answer.persistence.durable) {
    return { status: "refused", reason: "not-durable", answer };
  }
  /*
   * OUTPUT-INTEGRITY-1 — RECEIVED != COMPLETE. The validator judges what the text says, not whether it
   * ended; a reply cut at the output limit passes it and would be filed as if finished. Only the
   * provider's explicit `max_tokens` refuses: an unreported stop reason is not evidence of a cut.
   */
  if (answer.modelStopReason === "max_tokens") {
    return { status: "refused", reason: "output-truncated", answer };
  }

  /* A mandate withdrawn while the model was writing stops the filing, exactly as a stale revision does. */
  if (await askCeiling()) return { status: "refused", reason: "agent-mandate-changed-while-preparing", answer };

  const content = answer.outcome.response.body.join("\n");
  const sourceMessageId = answer.persistence.assistantMessageId;

  const basisDecisionId = input.reviewBasisDecisionId;
  const written = input.artifactId
    ? await reviseWorkArtifactFromHebyPreparation(
        tenant,
        { artifactId: input.artifactId, content, sourceMessageId, expectedRevisionNo: input.expectedRevisionNo },
        authorship.authorship,
        deps.write,
        /*
         * CONTENT-AGENT-2 — the review basis, asked again under the writer's artifact lock. HEBY-WORKFLOW-1:
         * so is the requester's right to revise from it, which the preflight asked before the model; a
         * Governance authority revoked while the model was writing files nothing.
         */
        basisDecisionId === undefined
          ? undefined
          : async (tx, artifact) =>
              !(await mayReviseFromReview(tx, tenant)) ||
              !(await isReviewBasisCurrent(tx, tenant, {
                artifactId: artifact.id,
                revisionNo: artifact.currentRevision,
                decisionId: basisDecisionId,
              })),
      )
    : await createWorkArtifactFromHebyPreparation(
        tenant,
        {
          artifactType: input.artifactType,
          /*
           * CGO-3. Passed straight through. This seam decides nothing about it — the released
           * validator requires it for a content draft and refuses it on anything else, and a
           * second copy of that rule here would be a second place it could drift.
           */
          intendedDestination: input.intendedDestination,
          title: input.title,
          content,
          sourceMessageId,
        },
        WORK_ARTIFACT_OWNER_WORKSPACE,
        authorship.authorship,
        deps.write,
      );

  if (written.status === "refused" && (written.reason === "revision-stale" || written.reason === "review-basis-stale")) {
    return { status: "refused", reason: "changed-while-preparing", answer };
  }
  if (written.status !== "created" && written.status !== "revised") {
    return { status: "refused", reason: "write-refused", answer };
  }

  return {
    status: "prepared",
    artifactId: written.artifactId,
    revisionNo: written.revisionNo,
    contentDigest: written.contentDigest,
    ref: written.ref,
    conversationId: answer.persistence.conversationId,
    sourceMessageId,
    answer,
  };
}
