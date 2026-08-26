"use client";

import { useState, useTransition } from "react";
import {
  createWorkArtifactAction,
  readWorkArtifactHistoryAction,
  retireWorkArtifactAction,
  reviseWorkArtifactAction,
} from "@/app/(dashboard)/operations/actions";
import type {
  WorkArtifactRevisionView,
  WorkArtifactType,
  WorkArtifactValidationProblem,
  WorkArtifactView,
} from "@/features/work-artifacts/contracts";
import type { WorkArtifactListing } from "@/features/work-artifacts/read-work-artifacts.server";
import { ReferenceChip } from "./reference-chip";

/*
 * prepared-work-section.tsx — what exact draft could eventually be proposed (OPS-P1).
 *
 * ── A REFERENCE NAMES ONE EXACT REVISION ─────────────────────────────────────
 *
 * `work-artifact/<uuid>@<n>` carries the revision inside it, and that is the whole point: an
 * artifact-only reference would be a moving target, so approving "draft X", revising X, and sending
 * would deliver bytes nobody approved. Revising here APPENDS — the previous revision stays
 * byte-identical, and no writer anywhere can edit revision content in place. A proposal already
 * bound to `@n` therefore cannot be changed by creating `@n+1`.
 *
 * The chip shows `currentRef`, the reference for the CURRENT revision, taken from the authoritative
 * view. This component never assembles one.
 *
 * ── WHAT IS NOT SHOWN ────────────────────────────────────────────────────────
 *
 * `WorkArtifactView` carries `tenantId` and a raw `id`; neither is rendered. `contentDigest`,
 * `authoredByActorType`, `authoredByActorId` and `sourceMessageId` on a revision are integrity and
 * audit internals and are not rendered either. What a human needs to choose a draft is its title,
 * its kind, which revision is current, and the text itself.
 *
 * NOTHING HERE PROPOSES. Authoring prepared work asks nothing of Governance and creates no action
 * request; `/send` in Heby remains the only way a proposal is filed.
 */

const REFUSAL_WORDING: Record<string, string> = {
  unauthenticated: "Your session could not be resolved, so nothing was written.",
  "invalid-input": "That draft was not written — see the problems listed.",
  "persistence-unavailable": "Durable storage is not reachable, so nothing was written.",
  "artifact-not-found": "That draft could not be found for your organization.",
  "artifact-retired": "That draft is retired and takes no further revisions.",
  "source-message-not-found": "The named source message could not be found.",
};

function ArtifactRow({ artifact }: { artifact: WorkArtifactView }) {
  const [revisionText, setRevisionText] = useState("");
  const [history, setHistory] = useState<readonly WorkArtifactRevisionView[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const retired = artifact.lifecycleStatus === "retired";

  return (
    <li className="border-b border-border-subtle py-3 last:border-b-0">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-sm text-fg-primary">{artifact.title}</p>
          <p className="text-xs text-fg-secondary">
            {artifact.artifactType} · revision {artifact.currentRevision}
            {retired ? " · retired" : ""}
          </p>
          <ReferenceChip reference={artifact.currentRef} />
        </div>
        <div className="flex shrink-0 gap-2 self-start">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const revisions = await readWorkArtifactHistoryAction({ artifactId: artifact.id });
                /*
                 * The history seam returns the revisions directly, with no unavailable branch. An
                 * artifact always holds at least revision 1, so an EMPTY array cannot mean "no
                 * revisions" — it means the read did not resolve. Rendering nothing would state the
                 * opposite of what is known, so it says so instead.
                 */
                if (revisions.length === 0) {
                  setMessage("The revision history did not resolve. This is unknown, not empty.");
                  return;
                }
                setHistory(revisions);
              })
            }
            className="rounded border border-border-subtle px-2 py-1 text-xs text-fg-secondary transition-colors hover:border-border hover:text-fg-primary disabled:opacity-50"
          >
            History
          </button>
          {retired ? null : (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await retireWorkArtifactAction({ artifactId: artifact.id });
                  setMessage(
                    result.status === "retired"
                      ? "Retired. Every revision stays readable."
                      : (REFUSAL_WORDING[result.reason] ?? `Not retired: ${result.reason}.`),
                  );
                })
              }
              className="rounded border border-border-subtle px-2 py-1 text-xs text-fg-secondary transition-colors hover:border-border hover:text-fg-primary disabled:opacity-50"
            >
              Retire
            </button>
          )}
        </div>
      </div>

      {retired ? null : (
        <form
          className="mt-2 flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            startTransition(async () => {
              setMessage(null);
              const result = await reviseWorkArtifactAction({
                artifactId: artifact.id,
                content: revisionText,
              });
              if (result.status === "revised") {
                setRevisionText("");
                setMessage(
                  `Revision ${result.revisionNo} appended. Earlier revisions are unchanged.`,
                );
                return;
              }
              if (result.status === "invalid") {
                setMessage(result.problems.map((problem) => problem.message).join(" "));
                return;
              }
              setMessage(REFUSAL_WORDING[result.reason] ?? `Not revised: ${result.reason}.`);
            });
          }}
        >
          <textarea
            value={revisionText}
            onChange={(event) => setRevisionText(event.target.value)}
            rows={2}
            placeholder="New revision text — appended, never replacing"
            className="min-w-0 flex-1 rounded border border-border-subtle bg-surface-2 px-2 py-1.5 text-xs text-fg-primary placeholder:text-fg-muted"
          />
          <button
            type="submit"
            disabled={pending}
            className="shrink-0 self-start rounded border border-border-subtle px-3 py-1.5 text-xs text-fg-secondary transition-colors hover:border-border hover:text-fg-primary disabled:opacity-50"
          >
            {pending ? "Appending…" : "Append revision"}
          </button>
        </form>
      )}

      {message ? <p className="mt-2 text-xs text-fg-secondary">{message}</p> : null}

      {history ? (
        <ol className="mt-2 space-y-1 border-l border-border-subtle pl-3">
          {history.map((revision) => (
            <li key={revision.revisionNo} className="text-xs text-fg-secondary">
              <span className="font-mono text-fg-muted">@{revision.revisionNo}</span>
              {revision.current ? " · current" : ""} — {revision.content}
            </li>
          ))}
        </ol>
      ) : null}
    </li>
  );
}

export function PreparedWorkSection({ listing }: { readonly listing: WorkArtifactListing }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [artifactType, setArtifactType] = useState<WorkArtifactType>("message-draft");
  const [problems, setProblems] = useState<readonly WorkArtifactValidationProblem[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <section className="rounded-lg border border-border-subtle bg-surface-1 p-5">
      <header className="mb-1">
        <h2 className="text-sm font-semibold text-fg-primary">Prepared work</h2>
        <p className="mt-1 text-xs text-fg-secondary">
          What exact draft could eventually be proposed. Writing a draft here proposes nothing and
          sends nothing.
        </p>
      </header>

      <form
        className="mt-4 space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          startTransition(async () => {
            setProblems([]);
            setMessage(null);
            const result = await createWorkArtifactAction({ artifactType, title, content });
            if (result.status === "created") {
              setTitle("");
              setContent("");
              setMessage(`Written as revision ${result.revisionNo}.`);
              return;
            }
            if (result.status === "invalid") {
              setProblems(result.problems);
              return;
            }
            setMessage(REFUSAL_WORDING[result.reason] ?? `Not written: ${result.reason}.`);
          });
        }}
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Title"
            className="min-w-0 flex-1 rounded border border-border-subtle bg-surface-2 px-2 py-1.5 text-sm text-fg-primary placeholder:text-fg-muted"
          />
          <select
            value={artifactType}
            onChange={(event) => setArtifactType(event.target.value as WorkArtifactType)}
            className="shrink-0 rounded border border-border-subtle bg-surface-2 px-2 py-1.5 text-sm text-fg-primary"
          >
            <option value="message-draft">message-draft</option>
            <option value="operational-plan">operational-plan</option>
          </select>
        </div>
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          rows={3}
          placeholder="Draft text"
          className="w-full rounded border border-border-subtle bg-surface-2 px-2 py-1.5 text-sm text-fg-primary placeholder:text-fg-muted"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded border border-border-subtle px-3 py-1.5 text-sm text-fg-secondary transition-colors hover:border-border hover:text-fg-primary disabled:opacity-50"
        >
          {pending ? "Writing…" : "Write draft"}
        </button>
      </form>
      {problems.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {problems.map((problem) => (
            <li key={`${problem.field}-${problem.code}`} className="text-xs text-error">
              {problem.message}
            </li>
          ))}
        </ul>
      ) : null}
      {message ? <p className="mt-2 text-xs text-fg-secondary">{message}</p> : null}

      <div className="mt-5">
        {listing.status === "unavailable" ? (
          /* UNAVAILABLE IS NOT EMPTY. */
          <p className="text-xs text-warning">
            Your prepared work could not be read ({listing.reason}), so this list is unknown rather
            than empty.
          </p>
        ) : listing.artifacts.length === 0 ? (
          <p className="text-xs text-fg-muted">
            No prepared work yet. The list was read successfully — this is the real state.
          </p>
        ) : (
          <ul>
            {listing.artifacts.map((artifact) => (
              <ArtifactRow key={artifact.currentRef} artifact={artifact} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
