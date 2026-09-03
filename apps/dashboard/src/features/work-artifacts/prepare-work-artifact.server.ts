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
import {
  resolveAgentAuthorship,
  type AgentAuthorshipRefusal,
} from "./agent-authorship.server";
import type { ContentDestination, WorkArtifactType } from "./contracts";
import { preparationBriefFor } from "./preparation-brief";
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
}

export interface PrepareWorkArtifactDeps {
  readonly answer?: typeof answerHebyModelRequest;
  readonly write?: WorkArtifactWriteDeps;
  /**
   * The durable-agent read seam's database handle. Injected the same way the writer's is, and for
   * the same reason: without it the read would resolve the ambient `DATABASE_URL`.
   */
  readonly agentIdentity?: AgentIdentityReadDeps;
}

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
      /** Present when an answer was produced but not stored — the human still sees it. */
      readonly answer?: HebyModelAnswerResult;
    };

/**
 * Ask Heby to prepare work, and durably keep what it produced.
 *
 * WHY A DETERMINISTIC FALLBACK IS NOT STORED. When the Director's kill-switch is off, or the
 * transport fails, or validation withholds the answer, `answerHebyModelRequest` returns an honest
 * deterministic response — for `PREPARE_RECOMMENDATION` that is an explicit UNAVAILABLE, because
 * preparation genuinely needs generative reasoning. Storing that as a revision would file
 * "no model runtime is connected" as though it were prepared work. Refused instead, and the
 * answer is handed back so the human sees exactly what happened.
 */
export async function prepareWorkArtifact(
  input: PrepareWorkArtifactInput,
  deps: HebyModelAnswerDeps & PrepareWorkArtifactDeps,
): Promise<PrepareWorkArtifactResult> {
  if (typeof window !== "undefined") {
    throw new Error("Work artifact preparation is server-only.");
  }

  const answerFn = deps.answer ?? answerHebyModelRequest;
  const answer = await answerFn(
    { prompt: input.prompt, route: input.route, conversationId: input.conversationId },
    deps,
    {
      intent: WORK_ARTIFACT_PREPARATION_INTENT,
      /*
       * CGO-4. The model is told, BEFORE it writes, that its whole reply is the artifact — so it
       * authors the durable bytes directly. This is the only place the product asks for a cleaner
       * draft: nothing below reads, trims or extracts the reply, and the no-parser rule above is
       * unchanged. Resolved from the human's declared type and destination, never from the prompt.
       */
      preparationBrief: preparationBriefFor(input),
    },
  );

  if (answer.status === "unauthorized") return { status: "refused", reason: "unauthenticated" };
  if (answer.status === "rejected") return { status: "refused", reason: "prompt-rejected" };

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

  const tenant = await deps.resolveTenant();
  if (!tenant) return { status: "refused", reason: "unauthenticated", answer };

  /*
   * WHO IS ABOUT TO BE RECORDED AS THE AUTHOR. Resolved from the authoritative durable-agent read
   * seam against THIS tenant — never from the prompt, the client, or the human's own id.
   *
   * A refusal here stops the write and nothing else: the human still receives the answer, because
   * Heby genuinely produced it. What cannot happen is that the answer is FILED as work authored by
   * an agent the organization does not have.
   */
  const authorship = await resolveAgentAuthorship(tenant, deps.agentIdentity ?? {});
  if (authorship.status === "refused") {
    return { status: "refused", reason: authorship.reason, answer };
  }

  const content = answer.outcome.response.body.join("\n");
  const sourceMessageId = answer.persistence.assistantMessageId;

  const written = input.artifactId
    ? await reviseWorkArtifactFromHebyPreparation(
        tenant,
        { artifactId: input.artifactId, content, sourceMessageId },
        authorship.authorship,
        deps.write,
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
