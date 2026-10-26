"use client";

import { useState, useTransition } from "react";
import {
  GROUNDING_NON_CLAIMS,
  OWN_CONTENT_GROUNDING_DISCLOSABLE,
  type GroundingDisposition,
  type OwnContentGrounding,
} from "@/features/content-grounding/contracts";
import { prepareWorkArtifactAction, readRevisionChangeRequestAction } from "@/app/(dashboard)/operations/actions";
import type { CurrentRevisionChangeRequest } from "@/features/work-artifact-review/contracts";
import {
  AgentChoiceSelect,
  agentChoiceRequired,
  agentSelectionFor,
  type AgentOption,
} from "@/components/agents/agent-choice-select";
import {
  CONTENT_DESTINATION_LABELS,
  CONTENT_DESTINATION_NON_CLAIMS,
  CONTENT_DESTINATIONS,
  CONTENT_DRAFT_TYPE,
} from "@/features/work-artifacts/contracts";
import type {
  ContentDestination,
  WorkArtifactValidationProblem,
} from "@/features/work-artifacts/contracts";
import type {
  HebyModelFallback,
  PreparationClientResult,
  PreparationRefusal,
} from "@/features/work-artifacts/prepare-work-artifact.server";

/*
 * prepare-with-hebun.tsx — a human explicitly asks Hebun to prepare a content draft (CGO-9).
 *
 * ── WHAT THIS IS ─────────────────────────────────────────────────────────────
 *
 * Two controls, both calling the released `prepareWorkArtifactAction` and nothing else: prepare a
 * new content draft, or prepare a new revision of an existing one. The request is the human's; the
 * words are the model's, and the revision is recorded as authored by the organization's durable
 * agent — never by the person who clicked. The artifact's `created_by` still names that person,
 * because a person did ask.
 *
 * The result is prepared work and nothing more: it enters the existing list, where CGO-8 shows its
 * review state and TRH-10's Governance review decides about it. Nothing is generated beyond text,
 * nothing is published, scheduled or sent, and no action is proposed.
 *
 * ── THREE OUTCOMES, WORDED AS THREE FACTS ────────────────────────────────────
 *
 * A PREFLIGHT refusal means Hebun was never asked and nothing was written. A POST-INVOCATION
 * refusal means Hebun may have been asked — its message record stays — but no prepared work was
 * filed. Only `prepared` changes the list. The wording map is exhaustive over the seam's refusal
 * type, so a new refusal cannot ship without a sentence that says which of the two it is.
 */

const NOT_ASKED = "Hebun was not asked, and nothing was written.";
const NOT_FILED = "No prepared work was written; any model call that happened stays in its message record.";

export const HEBUN_PREPARATION_REFUSAL_WORDING: Record<PreparationRefusal, string> = {
  /* Preflight: no model invocation, no message, no artifact. */
  unauthenticated: `Your session could not be resolved. ${NOT_ASKED}`,
  "no-authorized-tenant-context": `Your organization could not be resolved. ${NOT_ASKED}`,
  "no-durable-agent-identity": `Your organization has no durable agent that could author this. ${NOT_ASKED}`,
  "durable-agent-identity-retired": `Your organization's durable agent is retired. ${NOT_ASKED}`,
  "ambiguous-durable-agent-identity": `More than one durable agent is in service, so no single author can be named. ${NOT_ASKED}`,
  "selected-agent-unresolvable": `The chosen agent is not one of your organization's agents. ${NOT_ASKED}`,
  "selected-agent-retired": `The chosen agent is retired. ${NOT_ASKED}`,
  "agent-identity-authority-unavailable": `The agent identity authority could not be read. ${NOT_ASKED}`,
  /* AGENT-EXECUTION-1 preflight: the shared mandate ceiling, asked of the named author. */
  "agent-mandate-authority-unavailable": `The agent's mandate could not be read, so it is unknown rather than absent. ${NOT_ASKED}`,
  "no-agent-mandate": `The chosen agent has no mandate, so it may not write drafts. ${NOT_ASKED}`,
  "action-outside-agent-mandate": `The chosen agent's mandate does not admit work drafting. ${NOT_ASKED}`,
  "work-scope-required": `The work this draft is for has no recorded scope. ${NOT_ASKED}`,
  "work-outside-agent-responsibility": `The chosen agent is not responsible for this work. A draft prepared here is organization work, so it needs an agent responsible for the organization. ${NOT_ASKED}`,
  "model-connectivity-disabled": `Claude is switched off by the Director's provider control. ${NOT_ASKED}`,
  "invalid-input": `The request is incomplete — see the problems listed. ${NOT_ASKED}`,
  "artifact-not-found": `That draft could not be found for your organization. ${NOT_ASKED}`,
  "artifact-retired": `That draft is retired and takes no further revisions. ${NOT_ASKED}`,
  "target-unavailable": `The draft could not be read, so it is unknown rather than missing. ${NOT_ASKED}`,
  "prompt-rejected": `The instruction was not accepted. ${NOT_ASKED}`,
  /* CONTENT-AGENT-2 preflight. */
  "revision-stale": `This draft was revised since you opened it. Reload it and read the current revision first. ${NOT_ASKED}`,
  "review-basis-stale": `The change request you revised from no longer stands on the current revision. ${NOT_ASKED}`,
  "review-basis-not-authorized": `Revising from a review is for a Governance authority of this organization. You can still prepare with your own instruction. ${NOT_ASKED}`,
  /* Post-invocation: provenance may exist, prepared work does not. */
  "no-model-answer": `Hebun did not return a model-written draft. ${NOT_FILED}`,
  "not-durable": `The exchange could not be durably recorded, so nothing can be attributed to it. ${NOT_FILED}`,
  "write-refused": `The prepared text could not be filed. ${NOT_FILED}`,
  "agent-mandate-changed-while-preparing": `While Hebun was writing, the agent's mandate or responsibility was withdrawn, so nothing was filed. ${NOT_FILED}`,
  /* CONTENT-AGENT-2 post-invocation: the writer refused under its lock. */
  "changed-while-preparing": `While Hebun was writing, the draft was revised or its review changed, so nothing was filed on top of it. ${NOT_FILED}`,
};

/** What asking Hebun does not mean. Said at the moment of asking. */
export const HEBUN_PREPARATION_NON_CLAIMS: readonly string[] = [
  "Hebun writes the text and is recorded as its author; you are recorded as the person who asked.",
  "The result is a draft awaiting Governance review. Nothing is published, scheduled or sent.",
] as const;

/*
 * Why the model answer was not served, said plainly. Built only from the closed code the server
 * returns — never from the answer, its evidence or its limitations, which stay on the server.
 */
const NOTHING_FILED = "No revision was written.";
export function modelFallbackSentence(fallback: HebyModelFallback): string {
  switch (fallback.kind) {
    case "public-knowledge-blocked":
      return fallback.reason === "no-public-eligible-knowledge"
        ? `No Knowledge of this organization is both ratified and cleared for public use, so the model was not asked to write public content. ${NOTHING_FILED}`
        : `Whether this organization's Knowledge may ground public content could not be established, so the model was not asked. ${NOTHING_FILED}`;
    case "director-disabled":
      return `Claude is switched off by the Director's provider control, so the model was not asked. ${NOTHING_FILED}`;
    case "provider-failed":
      return `The request to the model provider did not succeed (${fallback.code}). Whether the provider received it is not known. ${NOTHING_FILED}`;
    case "withheld":
      return `The model answered, but its answer failed Hebun's validation and was withheld. ${NOTHING_FILED}`;
    case "unavailable":
      switch (fallback.state) {
        case "DATA_USE_NOT_AUTHORIZED":
          return `This organization's external AI data-use authorization does not cover what this request would send, so the model was not asked. ${NOTHING_FILED}`;
        case "DISPATCH_SAFETY_CAP_REACHED":
          return `This organization reached its daily AI dispatch safety limit, so the model was not asked. ${NOTHING_FILED}`;
        case "INSTRUCTION_CHANNEL_REFUSED":
          return `The request's instructions were not Hebun's own, so it was not sent. ${NOTHING_FILED}`;
        default:
          return `Model connectivity is not available on this deployment (${fallback.state}), so the model was not asked. ${NOTHING_FILED}`;
      }
  }
}

function refusalSentence(result: Extract<PreparationClientResult, { status: "refused" }>): string {
  if (result.reason === "no-model-answer" && result.modelFallback) return modelFallbackSentence(result.modelFallback);
  return HEBUN_PREPARATION_REFUSAL_WORDING[result.reason] ?? `Not prepared: ${result.reason}.`;
}

/* A thrown action has no result to read: say so instead of showing nothing. */
const ACTION_DID_NOT_COMPLETE =
  "The request did not complete, so its outcome is not known. Reload the draft to see whether a revision was written.";


/* CONTENT-GROUND-1 — what a human is told about the grounding. Never any caption text. */
const GROUNDING_WORDING: Record<GroundingDisposition, string> = {
  grounded: "",
  "not-requested": "",
  "destination-not-supported": "This draft is not going to Instagram, so your own captions were not used.",
  "no-observation": "Hebun has not yet observed this organization's Instagram posts, so none were used.",
  "no-captions": "The observation Hebun has holds no caption text, so none was used.",
  unavailable: "Your own captions could not be read just now, so Hebun prepared without them.",
};

function groundingSentence(g: OwnContentGrounding | undefined): string {
  if (!g || g.disposition === "not-requested") return "";
  if (g.disposition === "grounded") {
    return `It was written with ${g.captionCount} of your own recent Instagram captions as a voice reference${g.observedAt ? ` (observed ${new Date(g.observedAt).toISOString().slice(0, 10)})` : ""}.`;
  }
  return GROUNDING_WORDING[g.disposition];
}

/** Prepare a NEW content draft with Hebun. */
export function PrepareDraftWithHebun({
  agents = [],
}: {
  /** AP-5A — the in-service agents, from the identity read. A choice is asked only when there are several. */
  readonly agents?: readonly AgentOption[];
} = {}) {
  const [title, setTitle] = useState("");
  const [agentId, setAgentId] = useState("");
  const [instruction, setInstruction] = useState("");
  const [intendedDestination, setIntendedDestination] = useState<ContentDestination>("instagram");
  const [problems, setProblems] = useState<readonly WorkArtifactValidationProblem[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      data-cgo9="prepare-draft"
      className="mt-4 space-y-2 rounded border border-border-subtle bg-surface-sunken px-3 py-3"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          setProblems([]);
          setMessage(null);
          let result;
          try {
            result = await prepareWorkArtifactAction({
              prompt: instruction,
              route: "/operations",
              artifactType: CONTENT_DRAFT_TYPE,
              intendedDestination,
              title,
              ...agentSelectionFor(agents, agentId),
            });
          } catch {
            setMessage(ACTION_DID_NOT_COMPLETE);
            return;
          }
          if (result.status === "prepared") {
            setTitle("");
            setInstruction("");
            setMessage(
              `Hebun prepared revision ${result.revisionNo}. It is agent-authored and awaits Governance review.`,
            );
            return;
          }
          if (result.problems) setProblems(result.problems);
          setMessage(refusalSentence(result));
        });
      }}
    >
      <p className="text-xs font-medium text-fg-primary">Prepare a content draft with Hebun</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Title"
          className="min-w-0 flex-1 rounded border border-border-subtle bg-surface-1 px-2 py-1.5 text-sm text-fg-primary placeholder:text-fg-muted"
        />
        <label className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-fg-secondary">Prepared for</span>
          <select
            value={intendedDestination}
            onChange={(event) => setIntendedDestination(event.target.value as ContentDestination)}
            className="rounded border border-border-subtle bg-surface-1 px-2 py-1 text-sm text-fg-primary"
          >
            {CONTENT_DESTINATIONS.map((destination) => (
              <option key={destination} value={destination}>
                {CONTENT_DESTINATION_LABELS[destination]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-xs text-fg-muted">
        A declared preparation target. {CONTENT_DESTINATION_NON_CLAIMS.join(" ")}
      </p>
      <textarea
        value={instruction}
        onChange={(event) => setInstruction(event.target.value)}
        rows={2}
        placeholder="What should Hebun prepare?"
        className="w-full rounded border border-border-subtle bg-surface-1 px-2 py-1.5 text-sm text-fg-primary placeholder:text-fg-muted"
      />
      <AgentChoiceSelect id="prepare-draft-agent" value={agentId} onChange={setAgentId} agents={agents} disabled={pending} />
      <ul className="space-y-0.5">
        {HEBUN_PREPARATION_NON_CLAIMS.map((claim) => (
          <li key={claim} className="text-xs text-fg-muted">
            {claim}
          </li>
        ))}
      </ul>
      <button
        type="submit"
        disabled={pending || (agentChoiceRequired(agents) && agentId === "")}
        className="rounded border border-border-subtle px-3 py-1.5 text-sm text-fg-secondary transition-colors hover:border-border hover:text-fg-primary disabled:opacity-50"
      >
        {pending ? "Hebun is preparing…" : "Prepare with Hebun"}
      </button>
      {problems.length > 0 ? (
        <ul className="space-y-1">
          {problems.map((problem) => (
            <li key={`${problem.field}-${problem.code}`} className="text-xs text-error">
              {problem.message}
            </li>
          ))}
        </ul>
      ) : null}
      {message ? <p className="text-xs text-fg-secondary">{message}</p> : null}
    </form>
  );
}

/**
 * Prepare a NEW REVISION of an existing, non-retired content draft with Hebun.
 *
 * The caller renders this only for such a row; the seam re-checks both facts server-side, so a
 * stale screen cannot revise a draft retired since it loaded.
 */
export function PrepareRevisionWithHebun({
  artifactId,
  title,
  onPrepared,
  agents = [],
  changeRequest,
}: {
  readonly artifactId: string;
  readonly title: string;
  readonly onPrepared: (revisionNo: number) => Promise<void>;
  /** AP-5A — the in-service agents, from the identity read. A choice is asked only when there are several. */
  readonly agents?: readonly AgentOption[];
  /**
   * CONTENT-AGENT-2 — present only when the row's ledger read says the CURRENT revision's latest
   * decision is `changes-requested`. The reason itself is read on demand from the server, never
   * carried here, and is re-validated by the seam and its writer when the human submits.
   */
  readonly changeRequest?: { readonly revisionNo: number; readonly decisionId: string };
}) {
  const [instruction, setInstruction] = useState("");
  /* CONTENT-AGENT-2 — the reason as read, and whether THIS submission revises from it. */
  const [reason, setReason] = useState<CurrentRevisionChangeRequest | null>(null);
  const [fromReview, setFromReview] = useState<{ readonly revisionNo: number; readonly decisionId: string } | null>(null);
  const [agentId, setAgentId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  /* CONTENT-GROUND-1 — the human's ask. A boolean leaves this component; text never does. */
  const [useOwnContent, setUseOwnContent] = useState(OWN_CONTENT_GROUNDING_DISCLOSABLE);
  const [pending, startTransition] = useTransition();

  return (
    <form
      data-cgo9="prepare-revision"
      data-hebun-preparation="revision"
      className="mt-3 space-y-2 rounded border border-border-subtle bg-surface-sunken px-3 py-3"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          setMessage(null);
          let result;
          try {
            result = await prepareWorkArtifactAction({
              prompt: instruction,
              route: "/operations",
              artifactType: CONTENT_DRAFT_TYPE,
              title,
              artifactId,
              useOwnContentGrounding: useOwnContent,
              ...agentSelectionFor(agents, agentId),
              /* CONTENT-AGENT-2 — only when the human chose to revise from the review reason. */
              ...(fromReview ? { expectedRevisionNo: fromReview.revisionNo, reviewBasisDecisionId: fromReview.decisionId } : {}),
            });
          } catch {
            setMessage(ACTION_DID_NOT_COMPLETE);
            return;
          }
          if (result.status === "prepared") {
            setInstruction("");
            setFromReview(null);
            setReason(null);
            await onPrepared(result.revisionNo);
            setMessage(
              `Hebun prepared revision ${result.revisionNo}. ${groundingSentence(result.grounding)} Earlier revisions are unchanged; it awaits Governance review.`,
            );
            return;
          }
          setMessage(refusalSentence(result));
        });
      }}
    >
      {/*
        * THE HEADING IS THE FIX. Before this, the instruction field sat as a bare one-row textarea
        * directly beneath the human append control, in the same flat row, distinguishable only by a
        * placeholder that vanishes the moment anyone types. A human put a Hebun instruction into the
        * manual box and it was stored as draft content. Naming the section, and drawing a border
        * around everything that belongs to Hebun, is what makes that mistake unavailable.
        */}
      <p className="text-xs font-medium text-fg-primary">Prepare with Hebun</p>
      <p className="text-xs text-fg-muted">
        Hebun writes a NEW revision, authored by this organization&apos;s durable agent. The current
        revision is left byte-identical, and the new one still awaits Governance review.
      </p>
      {/*
        * CONTENT-AGENT-2 — REVISE FROM THE REVIEW. Shown only while the current revision's latest
        * decision is a change request. The reason is read from the Governance ledger on the human's
        * click and shown as recorded. It authorizes nothing.
        *
        * EAI-SYSTEM-COPY-INTO-CONVERSATION-1 — the reason is NEVER copied into the instruction. It is
        * Governance's record, not the human's words; once in the textarea it would leave as
        * `conversation` and bypass its own classification. The second click only binds this
        * revision to the review (the staleness keys); the human writes the instruction.
        */}
      {changeRequest ? (
        <div data-content-agent-2="change-request" className="space-y-1.5 rounded border border-border-subtle bg-surface px-2 py-2">
          {reason?.status === "requested" && reason.decisionId === changeRequest.decisionId ? (
            <>
              <p className="text-[11px] font-medium text-fg-secondary">
                Change request on revision {reason.revisionNo}
                {reason.decidedAt ? ` (recorded ${new Date(reason.decidedAt).toISOString().slice(0, 10)})` : ""}
              </p>
              <p className="whitespace-pre-wrap text-xs text-fg-primary">{reason.justification}</p>
              <button
                type="button"
                disabled={pending}
                onClick={() => setFromReview({ revisionNo: reason.revisionNo, decisionId: reason.decisionId })}
                className="rounded border border-border-subtle px-2 py-1 text-xs text-fg-secondary hover:border-border hover:text-fg-primary disabled:opacity-50"
              >
                Revise with Hebun from this review
              </button>
              <p className="text-[11px] text-fg-muted">
                Write your own instruction below. The reason is not copied into it and is not sent to Hebun. It is not an approval and starts nothing on its own.
              </p>
            </>
          ) : reason && reason.status !== "requested" ? (
            <p className="text-xs text-fg-muted">
              {reason.status === "unavailable"
                ? "The review reason could not be read just now. This is unknown, not absent."
                : reason.status === "not-authorized"
                  ? "Review reasons are shown only to a Governance authority of this organization. You can still prepare a revision with your own instruction."
                  : "There is no standing change request on the current revision."}
            </p>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  setReason(await readRevisionChangeRequestAction({ artifactId, revisionNo: changeRequest.revisionNo }));
                })
              }
              className="rounded border border-border-subtle px-2 py-1 text-xs text-fg-secondary hover:border-border hover:text-fg-primary disabled:opacity-50"
            >
              Show the change request
            </button>
          )}
        </div>
      ) : null}
      <label className="block space-y-1">
        <span className="block text-xs text-fg-secondary">Instruction for Hebun</span>
        <textarea
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
          rows={fromReview ? 5 : 2}
          placeholder="What should Hebun change in a new revision?"
          className="w-full rounded border border-border-subtle bg-surface px-2 py-1.5 text-xs text-fg-primary placeholder:text-fg-muted"
        />
      </label>
      {/*
        * INSIDE the Hebun section, deliberately. The grounding option is meaningless beside a manual
        * revision — nothing a person types is grounded — so placing it anywhere else would imply an
        * authority it does not have.
        */}
      <label className="flex items-start gap-2 text-xs text-fg-secondary">
        <input
          type="checkbox"
          checked={useOwnContent}
          disabled={!OWN_CONTENT_GROUNDING_DISCLOSABLE}
          onChange={(event) => setUseOwnContent(event.target.checked)}
          className="mt-0.5"
        />
        <span>
          Use our own recent Instagram captions as a voice reference
          <span className="block text-[11px] text-fg-muted">
            {OWN_CONTENT_GROUNDING_DISCLOSABLE
              ? GROUNDING_NON_CLAIMS[0]
              : "Not available: the platform's external AI data-use policy does not cover sending Instagram observations to the model."}
          </span>
        </span>
      </label>
      <AgentChoiceSelect id={`prepare-revision-agent-${artifactId}`} value={agentId} onChange={setAgentId} agents={agents} disabled={pending} />
      <button
        type="submit"
        disabled={pending || (agentChoiceRequired(agents) && agentId === "")}
        className="rounded border border-border-subtle px-3 py-1.5 text-xs text-fg-secondary transition-colors hover:border-border hover:text-fg-primary disabled:opacity-50"
      >
        {pending ? "Hebun is preparing…" : "Prepare revision with Hebun"}
      </button>
      {message ? <p className="text-xs text-fg-secondary">{message}</p> : null}
    </form>
  );
}
