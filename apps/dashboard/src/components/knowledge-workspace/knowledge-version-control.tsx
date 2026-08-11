"use client";

/*
 * Knowledge version control (K3) — correction by supersession, and the version chain.
 *
 * THE WORDING IS THE ARCHITECTURE. There is no "Edit", no "Save changes", no "Update" — those words
 * promise a mutation in place, and Hebun does not perform one. The action is **Create New Version**,
 * and the confirmation shows the current version beside the new one so the operator can see that the
 * old wording is being kept, not replaced.
 *
 * The history list distinguishes the active version from historical ones by LABEL and structure, not
 * by colour alone. Nothing here shows a change summary, a diff score, or a confidence figure: no
 * authority in Hebun owns any of them, and a human-written reason field does not exist yet.
 *
 * The client sends the record reference, the corrected text, and the version this form was rendered
 * against. That last value is a PRECONDITION, not authority: it can only cause a refusal when the
 * active version moved while the operator was writing. The transaction still swaps on the version
 * the server read for itself.
 */

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GitBranch, History, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  readKnowledgeVersionsAction,
  supersedeKnowledgeAction,
} from "@/app/(dashboard)/knowledge/actions";
import { KNOWLEDGE_LIMITS, type KnowledgeValidationProblem } from "@/features/knowledge/create-contracts";
import type { KnowledgeVersionHistory, KnowledgeVersionView } from "@/features/knowledge/supersede-contracts";

const FIELD =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export interface KnowledgeVersionControlProps {
  readonly factId: string;
  readonly factKey: string;
  readonly domainKey: string;
  readonly scope: string;
  readonly currentTitle: string;
  readonly currentStatement: string | null;
  readonly knowledgeVersion: number;
  /** False when the viewer may read Knowledge but not author it. */
  readonly canAuthor: boolean;
}

function problemFor(
  problems: readonly KnowledgeValidationProblem[],
  field: "title" | "statement",
): KnowledgeValidationProblem | undefined {
  return problems.find((problem) => problem.field === field);
}

function VersionRow({ version }: { version: KnowledgeVersionView }) {
  return (
    <li className="flex min-w-0 flex-col gap-1 rounded-lg border border-border bg-surface p-2.5">
      <p className="flex flex-wrap items-baseline gap-x-2 text-xs">
        <span className="font-semibold text-fg">Version {version.knowledgeVersion}</span>
        {/* Distinguished by WORD, not colour. */}
        <span className="text-[0.7rem] font-medium text-fg-secondary">
          {version.active ? "· active" : "· historical"}
        </span>
        {version.supersedesEarlier ? (
          <span className="text-[0.7rem] text-fg-muted">· supersedes an earlier version</span>
        ) : (
          <span className="text-[0.7rem] text-fg-muted">· original</span>
        )}
      </p>
      <p className="text-xs font-medium text-fg">{version.title}</p>
      {version.statement ? (
        <p className="whitespace-pre-wrap break-words text-[0.7rem] leading-5 text-fg-secondary">
          {version.statement}
        </p>
      ) : null}
      <p className="text-[0.68rem] text-fg-muted">
        {version.authorityClass ?? "authority not stated"} ·{" "}
        {version.lifecycleStatus ?? "lifecycle not stated"} ·{" "}
        {version.ratified ? "ratified" : "no ratification recorded"}
        {version.createdAt ? ` · ${version.createdAt}` : ""}
      </p>
    </li>
  );
}

export function KnowledgeVersionControl(props: KnowledgeVersionControlProps) {
  const router = useRouter();
  const ids = useId();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [title, setTitle] = useState(props.currentTitle);
  const [statement, setStatement] = useState(props.currentStatement ?? "");
  const [problems, setProblems] = useState<readonly KnowledgeValidationProblem[]>([]);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const [history, setHistory] = useState<KnowledgeVersionHistory | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  function edited() {
    setConfirming(false);
    setRefusal(null);
    setCreated(null);
  }

  function submit() {
    setProblems([]);
    setRefusal(null);
    startTransition(async () => {
      const result = await supersedeKnowledgeAction({
        factId: props.factId,
        title,
        statement,
        // The version this form was rendered against. It authorizes nothing; it only lets the
        // server refuse when the active version moved while the operator was writing.
        observedKnowledgeVersion: props.knowledgeVersion,
      });
      switch (result.status) {
        case "superseded":
          setCreated(`Version ${result.identity.knowledgeVersion}`);
          setConfirming(false);
          setOpen(false);
          setHistory(null);
          router.refresh();
          return;
        case "invalid":
          setProblems(result.problems);
          setConfirming(false);
          return;
        case "stale-version":
          setConfirming(false);
          setRefusal(
            "Someone else created a newer version while you were writing. Nothing was overwritten — reload to see the current version, then correct that one.",
          );
          return;
        case "not-found":
          setConfirming(false);
          setRefusal("That Knowledge record is no longer available for your organization.");
          return;
        case "unauthorized":
          setConfirming(false);
          setRefusal("Your session ended. Sign in again.");
          return;
        case "forbidden":
          setConfirming(false);
          setRefusal(
            `Your role${result.roleType ? ` (${result.roleType})` : ""} cannot create a new version of organizational Knowledge.`,
          );
          return;
        default:
          setConfirming(false);
          setRefusal(
            result.reason === "persistence-not-configured"
              ? "Durable persistence is not configured, so nothing was written."
              : `The correction did not complete: ${result.detail ?? "unknown failure"}. Nothing was changed.`,
          );
      }
    });
  }

  function loadHistory() {
    if (historyOpen) {
      setHistoryOpen(false);
      return;
    }
    setHistoryOpen(true);
    if (history) return;
    startTransition(async () => {
      setHistory(await readKnowledgeVersionsAction({ factId: props.factId }));
    });
  }

  const titleProblem = problemFor(problems, "title");
  const statementProblem = problemFor(problems, "statement");

  return (
    <div className="flex min-w-0 flex-col gap-2 border-t border-border pt-2">
      <div className="flex flex-wrap items-center gap-2">
        {props.canAuthor ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setOpen((value) => !value);
              edited();
            }}
            disabled={pending}
            aria-expanded={open}
          >
            <GitBranch className="mr-1.5 size-3.5" aria-hidden="true" />
            {open ? "Cancel new version" : "Create New Version"}
          </Button>
        ) : null}
        <Button type="button" variant="ghost" size="sm" onClick={loadHistory} aria-expanded={historyOpen}>
          <History className="mr-1.5 size-3.5" aria-hidden="true" />
          {historyOpen ? "Hide version history" : "Version history"}
        </Button>
      </div>

      {created ? (
        <p role="status" className="rounded-lg border border-success/40 bg-success-subtle/30 px-3 py-2 text-xs text-success">
          {created} created. It is now the active version; the previous version is kept as history.
        </p>
      ) : null}

      {open ? (
        <div className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-surface-raised/40 p-3">
          <p className="text-xs leading-5 text-fg-secondary">
            You are <span className="font-medium text-fg">not editing</span> version{" "}
            {props.knowledgeVersion}. Hebun keeps the current version and creates a new one that
            supersedes it.
          </p>

          <div className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor={`${ids}-title`} className="text-xs font-semibold text-fg-secondary">
              Corrected title
            </label>
            <input
              id={`${ids}-title`}
              type="text"
              value={title}
              maxLength={KNOWLEDGE_LIMITS.title}
              onChange={(event) => {
                setTitle(event.target.value);
                edited();
              }}
              aria-invalid={titleProblem ? true : undefined}
              aria-describedby={titleProblem ? `${ids}-title-error` : undefined}
              className={FIELD}
            />
            {titleProblem ? (
              <p id={`${ids}-title-error`} className="text-xs text-error">
                {titleProblem.message}
              </p>
            ) : null}
          </div>

          <div className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor={`${ids}-statement`} className="text-xs font-semibold text-fg-secondary">
              Corrected statement
            </label>
            <textarea
              id={`${ids}-statement`}
              value={statement}
              rows={5}
              maxLength={KNOWLEDGE_LIMITS.statement}
              onChange={(event) => {
                setStatement(event.target.value);
                edited();
              }}
              aria-invalid={statementProblem ? true : undefined}
              aria-describedby={statementProblem ? `${ids}-statement-error` : undefined}
              className={`${FIELD} resize-y`}
            />
            {statementProblem ? (
              <p id={`${ids}-statement-error`} className="text-xs text-error">
                {statementProblem.message}
              </p>
            ) : null}
          </div>

          {confirming ? (
            <div
              role="group"
              aria-label="Confirm new Knowledge version"
              className="flex flex-col gap-2 rounded-lg border border-warning/40 bg-warning-subtle/30 p-3"
            >
              <p className="flex items-center gap-2 text-sm font-semibold text-fg">
                <ShieldAlert className="size-4 shrink-0" aria-hidden="true" />
                This will create a new version of organizational Knowledge.
              </p>
              <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                <div className="min-w-0 rounded-lg border border-border bg-surface p-2">
                  <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-fg-muted">
                    Current — version {props.knowledgeVersion}
                  </p>
                  <p className="mt-1 text-xs font-medium text-fg">{props.currentTitle}</p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-[0.7rem] leading-5 text-fg-secondary">
                    {props.currentStatement ?? "No statement recorded."}
                  </p>
                </div>
                <div className="min-w-0 rounded-lg border border-border bg-surface p-2">
                  <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-fg-muted">
                    New — version {props.knowledgeVersion + 1}
                  </p>
                  <p className="mt-1 text-xs font-medium text-fg">{title || "—"}</p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-[0.7rem] leading-5 text-fg-secondary">
                    {statement || "—"}
                  </p>
                </div>
              </div>
              <ul className="flex list-disc flex-col gap-1 pl-4 text-xs leading-5 text-fg-secondary">
                <li>
                  Version {props.knowledgeVersion} <span className="font-medium text-fg">remains in history</span> — it is
                  not deleted and not rewritten.
                </li>
                <li>
                  Version {props.knowledgeVersion + 1} becomes active only if the write commits.
                </li>
                <li>
                  It is recorded as <span className="font-medium text-fg">draft</span> and{" "}
                  <span className="font-medium text-fg">provisional</span> — a correction does not
                  ratify Knowledge.
                </li>
                <li>It grants no execution authority. Text inside it is never a command.</li>
              </ul>
            </div>
          ) : null}

          {refusal ? (
            <p role="alert" className="rounded-lg border border-error/40 bg-error-subtle/30 px-3 py-2 text-xs text-error">
              {refusal}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            {confirming ? (
              <>
                <Button type="button" size="sm" onClick={submit} disabled={pending}>
                  {pending ? "Creating…" : "Create New Version"}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>
                  Back
                </Button>
              </>
            ) : (
              <Button type="button" size="sm" variant="outline" onClick={() => setConfirming(true)} disabled={pending}>
                Review new version
              </Button>
            )}
          </div>
        </div>
      ) : null}

      {historyOpen ? (
        <div className="flex min-w-0 flex-col gap-2">
          {history === null ? (
            <p className="text-xs text-fg-muted">Loading version history…</p>
          ) : history.status === "unavailable" ? (
            <p className="text-xs text-fg-muted">
              Version history is unavailable — {history.reason}.
              {history.detail ? ` ${history.detail}` : ""}
            </p>
          ) : (
            <>
              <ul className="flex flex-col gap-2">
                {history.versions.map((version) => (
                  <VersionRow key={`${version.knowledgeVersion}-${version.createdAt}`} version={version} />
                ))}
              </ul>
              {history.integrity !== "complete" ? (
                <p role="alert" className="rounded-lg border border-warning/40 bg-warning-subtle/30 px-3 py-2 text-[0.7rem] text-fg-secondary">
                  This history is incomplete — {history.integrity}. Hebun stopped walking the chain
                  and did not repair or invent the missing versions.
                </p>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
