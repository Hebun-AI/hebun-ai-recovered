"use client";

import { useState, useTransition } from "react";
import { prepareWorkArtifactAction } from "@/app/(dashboard)/operations/actions";
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
  PrepareWorkArtifactResult,
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
  "agent-identity-authority-unavailable": `The agent identity authority could not be read. ${NOT_ASKED}`,
  "model-connectivity-disabled": `Claude is switched off by the Director's provider control. ${NOT_ASKED}`,
  "invalid-input": `The request is incomplete — see the problems listed. ${NOT_ASKED}`,
  "artifact-not-found": `That draft could not be found for your organization. ${NOT_ASKED}`,
  "artifact-retired": `That draft is retired and takes no further revisions. ${NOT_ASKED}`,
  "target-unavailable": `The draft could not be read, so it is unknown rather than missing. ${NOT_ASKED}`,
  "prompt-rejected": `The instruction was not accepted. ${NOT_ASKED}`,
  /* Post-invocation: provenance may exist, prepared work does not. */
  "no-model-answer": `Hebun did not return a model-written draft. ${NOT_FILED}`,
  "not-durable": `The exchange could not be durably recorded, so nothing can be attributed to it. ${NOT_FILED}`,
  "write-refused": `The prepared text could not be filed. ${NOT_FILED}`,
};

/** What asking Hebun does not mean. Said at the moment of asking. */
export const HEBUN_PREPARATION_NON_CLAIMS: readonly string[] = [
  "Hebun writes the text and is recorded as its author; you are recorded as the person who asked.",
  "The result is a draft awaiting Governance review. Nothing is published, scheduled or sent.",
] as const;

function refusalSentence(result: Extract<PrepareWorkArtifactResult, { status: "refused" }>): string {
  return HEBUN_PREPARATION_REFUSAL_WORDING[result.reason] ?? `Not prepared: ${result.reason}.`;
}

/** Prepare a NEW content draft with Hebun. */
export function PrepareDraftWithHebun() {
  const [title, setTitle] = useState("");
  const [instruction, setInstruction] = useState("");
  const [intendedDestination, setIntendedDestination] = useState<ContentDestination>("instagram");
  const [problems, setProblems] = useState<readonly WorkArtifactValidationProblem[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      data-cgo9="prepare-draft"
      className="mt-4 space-y-2 rounded border border-border-subtle bg-surface-2 px-3 py-3"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          setProblems([]);
          setMessage(null);
          const result = await prepareWorkArtifactAction({
            prompt: instruction,
            route: "/operations",
            artifactType: CONTENT_DRAFT_TYPE,
            intendedDestination,
            title,
          });
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
      <ul className="space-y-0.5">
        {HEBUN_PREPARATION_NON_CLAIMS.map((claim) => (
          <li key={claim} className="text-xs text-fg-muted">
            {claim}
          </li>
        ))}
      </ul>
      <button
        type="submit"
        disabled={pending}
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
}: {
  readonly artifactId: string;
  readonly title: string;
  readonly onPrepared: (revisionNo: number) => Promise<void>;
}) {
  const [instruction, setInstruction] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      data-cgo9="prepare-revision"
      className="mt-2 flex flex-col gap-2 sm:flex-row"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          setMessage(null);
          const result = await prepareWorkArtifactAction({
            prompt: instruction,
            route: "/operations",
            artifactType: CONTENT_DRAFT_TYPE,
            title,
            artifactId,
          });
          if (result.status === "prepared") {
            setInstruction("");
            await onPrepared(result.revisionNo);
            setMessage(
              `Hebun prepared revision ${result.revisionNo}. Earlier revisions are unchanged; it awaits Governance review.`,
            );
            return;
          }
          setMessage(refusalSentence(result));
        });
      }}
    >
      <textarea
        value={instruction}
        onChange={(event) => setInstruction(event.target.value)}
        rows={1}
        placeholder="What should Hebun change in a new revision?"
        className="min-w-0 flex-1 rounded border border-border-subtle bg-surface-2 px-2 py-1.5 text-xs text-fg-primary placeholder:text-fg-muted"
      />
      <button
        type="submit"
        disabled={pending}
        className="shrink-0 self-start rounded border border-border-subtle px-3 py-1.5 text-xs text-fg-secondary transition-colors hover:border-border hover:text-fg-primary disabled:opacity-50"
      >
        {pending ? "Hebun is preparing…" : "Prepare revision with Hebun"}
      </button>
      {message ? <p className="text-xs text-fg-secondary sm:basis-full">{message}</p> : null}
    </form>
  );
}
