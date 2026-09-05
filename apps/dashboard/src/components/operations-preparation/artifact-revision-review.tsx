"use client";

/*
 * artifact-revision-review.tsx — the human review control for ONE EXACT revision (TRH-10).
 *
 * ── WHY IT IS NOT LABELLED "APPROVE" ─────────────────────────────────────────
 *
 * The expensive confusion here is specific: a button reading only "Approve", on a draft whose
 * destination caption says Instagram, would reasonably be read as approving it FOR Instagram. So
 * the action says what it does — accept for the next internal step — and the publication notice is
 * rendered next to the buttons rather than in a footnote, for the reason CGO-1 gives about the
 * destination caption: the collapse happens at the moment of deciding, so the denial belongs there.
 *
 * ── IT HOLDS NO AUTHORITY, AND SHOWS NO STATE IT INVENTED ────────────────────
 *
 * Every string it renders comes from the released contract rather than a copy, so a drifted
 * paraphrase fails a test instead of quietly misinforming a reviewer. The review state it shows is
 * DERIVED from the Governance ledger by the server; this component computes none of it, and stores
 * none of it. A refusal is rendered as the reason the server gave.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  acceptArtifactRevisionAction,
  requestArtifactRevisionChangesAction,
} from "@/app/(dashboard)/operations/actions";
import {
  ARTIFACT_REVIEW_ACCEPT_EFFECT,
  ARTIFACT_REVIEW_ACCEPT_NON_EFFECTS,
  ARTIFACT_REVIEW_PUBLICATION_NOTICE,
  ARTIFACT_REVIEW_REJECT_EFFECT,
  ARTIFACT_REVIEW_REJECT_NON_EFFECTS,
  ARTIFACT_REVIEW_REVISION_SCOPE_NOTICE,
  type ArtifactReviewRefusal,
  type ArtifactRevisionReviewState,
} from "@/features/work-artifact-review/contracts";

const JUSTIFICATION_MINIMUM = 24;

/** The refusal words a reviewer reads. One per closed reason — never a free-text server string. */
const REFUSAL_COPY: Record<ArtifactReviewRefusal, string> = {
  unauthenticated: "Sign in to review this revision.",
  "no-governance-authority":
    "This organization has no Governance authority yet, so no one can decide about prepared work.",
  "not-the-governance-authority":
    "Reviewing is a Governance act. Preparing work does not confer it, and you do not hold it here.",
  "revision-unresolvable": "That revision could not be resolved in this organization.",
  "justification-required": `A reason of at least ${JUSTIFICATION_MINIMUM} characters is required.`,
  "persistence-unavailable": "The decision could not be recorded. Nothing was written.",
};

/** The derived state, in words. `null` is UNREVIEWED — never quietly rendered as rejected. */
function stateLabel(state: ArtifactRevisionReviewState | undefined): string {
  if (!state || state.decision === null) return "not reviewed";
  const base =
    state.decision === "accepted" ? "accepted for the next internal step" : "changes requested";
  /*
   * The count is shown when an organization has decided about these bytes more than once. Hiding it
   * would present a reversal as though it had always been the answer, and the fact that a view
   * changed is often the useful part.
   */
  return state.decisionCount > 1 ? `${base} · ${state.decisionCount} decisions on record` : base;
}

export function ArtifactRevisionReview({
  artifactId,
  revisionId,
  revisionNo,
  state,
  reviewable,
}: {
  artifactId: string;
  revisionId: string;
  revisionNo: number;
  state?: ArtifactRevisionReviewState;
  /** False when the reader may see the bytes but may not decide about them. */
  reviewable: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [intent, setIntent] = useState<"accept" | "changes" | null>(null);
  const [justification, setJustification] = useState("");
  const [refusal, setRefusal] = useState<ArtifactReviewRefusal | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const tooShort = justification.trim().length < JUSTIFICATION_MINIMUM;

  function submit(kind: "accept" | "changes") {
    setRefusal(null);
    startTransition(async () => {
      const payload = { artifactId, revisionId, justification };
      const result =
        kind === "accept"
          ? await acceptArtifactRevisionAction(payload)
          : await requestArtifactRevisionChangesAction(payload);
      if (result.status === "refused") {
        setRefusal(result.reason);
        return;
      }
      setDone(
        result.decision === "accepted"
          ? `Revision ${result.revisionNo} accepted for the next internal step.`
          : `Changes requested on revision ${result.revisionNo}.`,
      );
      setIntent(null);
      setJustification("");
      router.refresh();
    });
  }

  return (
    <div className="mt-2 rounded border border-border-subtle p-2">
      <p className="text-xs text-fg-secondary">
        Governance review of revision {revisionNo}:{" "}
        <span className="text-fg-primary">{stateLabel(state)}</span>
      </p>

      {done ? <p className="mt-1 text-xs text-fg-primary">{done}</p> : null}

      {reviewable ? (
        <>
          {intent === null ? (
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => setIntent("accept")}
                className="rounded border border-border-subtle px-2 py-1 text-xs text-fg-secondary transition-colors hover:border-border hover:text-fg-primary disabled:opacity-50"
              >
                Accept for next internal step
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => setIntent("changes")}
                className="rounded border border-border-subtle px-2 py-1 text-xs text-fg-secondary transition-colors hover:border-border hover:text-fg-primary disabled:opacity-50"
              >
                Request changes
              </button>
            </div>
          ) : (
            <div className="mt-2 flex flex-col gap-2">
              <p className="text-xs text-fg-secondary">
                {intent === "accept"
                  ? `Accepting ${ARTIFACT_REVIEW_ACCEPT_EFFECT}`
                  : `Requesting changes ${ARTIFACT_REVIEW_REJECT_EFFECT}`}
              </p>
              <ul className="list-disc pl-4 text-xs text-fg-muted">
                {(intent === "accept"
                  ? ARTIFACT_REVIEW_ACCEPT_NON_EFFECTS
                  : ARTIFACT_REVIEW_REJECT_NON_EFFECTS
                ).map((claim) => (
                  <li key={claim}>It {claim}</li>
                ))}
              </ul>
              <p className="text-xs text-fg-muted">{ARTIFACT_REVIEW_REVISION_SCOPE_NOTICE}</p>
              <label className="text-xs font-medium text-fg-primary" htmlFor={`just-${revisionId}`}>
                Why
              </label>
              <textarea
                id={`just-${revisionId}`}
                rows={3}
                value={justification}
                onChange={(event) => setJustification(event.target.value)}
                className="rounded border border-border-subtle bg-surface p-2 text-xs text-fg-primary"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={pending || tooShort}
                  onClick={() => submit(intent)}
                  className="rounded border border-border-subtle px-2 py-1 text-xs text-fg-secondary transition-colors hover:border-border hover:text-fg-primary disabled:opacity-50"
                >
                  {pending
                    ? "Recording…"
                    : intent === "accept"
                      ? "Record acceptance"
                      : "Record changes requested"}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setIntent(null);
                    setRefusal(null);
                  }}
                  className="rounded border border-border-subtle px-2 py-1 text-xs text-fg-muted transition-colors hover:text-fg-secondary disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </>
      ) : null}

      {refusal ? <p className="mt-1 text-xs text-fg-primary">{REFUSAL_COPY[refusal]}</p> : null}

      {/*
        * THE SENTENCE THIS COMPONENT EXISTS TO KEEP ON SCREEN. Rendered unconditionally — a reader
        * who is not allowed to decide still needs to know what accepting would and would not mean.
        */}
      <p className="mt-2 text-xs text-fg-muted">{ARTIFACT_REVIEW_PUBLICATION_NOTICE}</p>
    </div>
  );
}
