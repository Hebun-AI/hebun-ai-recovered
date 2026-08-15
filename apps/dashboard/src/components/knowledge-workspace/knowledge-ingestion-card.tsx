"use client";

/*
 * Knowledge ingestion card — Knowledge workspace → Ingest a source.
 *
 * ONE SOURCE BECOMES MANY RECORDS, AND THE HUMAN SEES HOW MANY BEFORE COMMITTING. That is the whole
 * difference from the authoring card beside it: authoring writes one fact the operator typed, this
 * writes N facts derived from text they pasted. Deriving records on someone's behalf is exactly the
 * kind of thing a product should not do silently, so the count is shown first and the split is
 * deterministic rather than clever.
 *
 * THE PREVIEW USES THE SERVER'S OWN CHUNKER. `normalizeSourceText` and `chunkSource` are pure and
 * imported directly — there is no second implementation here that could disagree with what actually
 * gets written. A preview that lies about the outcome is worse than no preview.
 *
 * IT CLAIMS NOTHING IT CANNOT SUPPORT. Ingested knowledge is provisional and unratified, and the card
 * says so before the button rather than in a toast afterwards. It is not search: these records become
 * readable, not findable by meaning, and the copy does not imply otherwise.
 */

import { useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileInput, ShieldAlert } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ingestKnowledgeAction } from "@/app/(dashboard)/knowledge/actions";
import { KNOWLEDGE_SCOPES } from "@/features/knowledge/create-contracts";
import {
  MAX_CHUNKS_PER_SOURCE,
  MAX_SOURCE_CHARACTERS,
  chunkSource,
  normalizeSourceText,
  type IngestionProblem,
} from "@/features/knowledge/ingestion-contracts";

export type KnowledgeIngestionBlock =
  | { readonly kind: "unauthenticated" }
  | { readonly kind: "forbidden"; readonly roleType: string | null }
  | { readonly kind: "persistence-unavailable" };

const FIELD_STYLE =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const EMPTY = { sourceTitle: "", sourceText: "", domainKey: "", scope: "company-wide" };

export function KnowledgeIngestionCard({ block }: { readonly block?: KnowledgeIngestionBlock }) {
  const [form, setForm] = useState(EMPTY);
  const [problems, setProblems] = useState<readonly IngestionProblem[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, startTransition] = useTransition();
  const router = useRouter();

  const titleId = useId();
  const textId = useId();
  const domainId = useId();
  const scopeId = useId();

  /*
   * The SAME functions the server runs, so this count is the count that will be written. Recomputed
   * as the operator types; both are pure and linear, and a 60 000-character ceiling keeps that cheap.
   */
  const preview = useMemo(() => {
    const normalized = normalizeSourceText(form.sourceText);
    return { normalized, chunks: chunkSource(normalized).length };
  }, [form.sourceText]);

  const overSize = preview.normalized.length > MAX_SOURCE_CHARACTERS;
  const overChunks = preview.chunks > MAX_CHUNKS_PER_SOURCE;
  const ready =
    form.sourceTitle.trim().length > 0 &&
    preview.normalized.length > 0 &&
    form.domainKey.trim().length > 0 &&
    !overSize &&
    !overChunks;

  function submit() {
    setProblems([]);
    setNotice(null);
    startTransition(async () => {
      const result = await ingestKnowledgeAction(form);
      if (result.status === "ingested") {
        setForm(EMPTY);
        setConfirming(false);
        setNotice(
          `Ingested as ${result.source.chunkCount} provisional knowledge ${
            result.source.chunkCount === 1 ? "record" : "records"
          }. They are not ratified.`,
        );
        router.refresh();
        return;
      }
      setConfirming(false);
      if (result.status === "invalid") {
        setProblems(result.problems);
        return;
      }
      setNotice(
        result.status === "duplicate-ingestion"
          ? `This exact source is already ingested here — ${result.alreadyPresent} of its ${result.chunkCount} records exist. Nothing was written.`
          : result.status === "forbidden"
            ? "Your role may not establish organizational Knowledge."
            : result.status === "unauthorized"
              ? "You are not signed in. Nothing was written."
              : result.status === "unavailable"
                ? "Durable persistence is not configured. Nothing was written."
                : `Nothing was ingested. ${result.detail}`,
      );
    });
  }

  if (block) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert aria-hidden className="size-4" />
            Ingest a source
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-fg-muted" role="status">
            {block.kind === "unauthenticated"
              ? "Sign in to ingest organizational knowledge."
              : block.kind === "forbidden"
                ? "Your role may not establish organizational Knowledge. Ingestion is limited to the same authority band that authors it."
                : "Durable persistence is not configured, so nothing can be ingested."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileInput aria-hidden className="size-4" />
          Ingest a source
        </CardTitle>
        <CardDescription>
          Paste organizational text — a policy, a procedure, a handbook section. It is split into
          records your organization holds, and Heby can then read them as evidence.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {notice ? (
          <p
            aria-live="polite"
            className="rounded-md border border-border bg-surface-2 px-3 py-2 text-sm"
            role="status"
          >
            {notice}
          </p>
        ) : null}

        {problems.length > 0 ? (
          <ul
            aria-live="assertive"
            className="flex flex-col gap-1 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700"
            role="alert"
          >
            {problems.map((problem) => (
              <li key={`${problem.field}-${problem.code}`}>{problem.message}</li>
            ))}
          </ul>
        ) : null}

        <label className="flex flex-col gap-1 text-sm" htmlFor={titleId}>
          <span className="font-medium">Source title</span>
          <input
            className={FIELD_STYLE}
            id={titleId}
            onChange={(event) => setForm({ ...form, sourceTitle: event.target.value })}
            placeholder="Expense policy 2026"
            value={form.sourceTitle}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm" htmlFor={textId}>
          <span className="font-medium">Source text</span>
          <textarea
            className={`${FIELD_STYLE} min-h-48 font-mono text-xs`}
            id={textId}
            onChange={(event) => setForm({ ...form, sourceText: event.target.value })}
            placeholder="Paste the text here. Blank lines separate paragraphs, and paragraphs are what the split follows."
            value={form.sourceText}
          />
          <span className="text-xs text-fg-muted">
            {preview.normalized.length.toLocaleString()} of{" "}
            {MAX_SOURCE_CHARACTERS.toLocaleString()} characters ·{" "}
            {preview.chunks === 0
              ? "no records yet"
              : `${preview.chunks} ${preview.chunks === 1 ? "record" : "records"} will be created`}
          </span>
          {overSize ? (
            <span className="text-xs text-red-700">
              This source is too long. Ingest it in parts rather than losing the remainder.
            </span>
          ) : null}
          {overChunks ? (
            <span className="text-xs text-red-700">
              This would create {preview.chunks} records, and one ingestion may create at most{" "}
              {MAX_CHUNKS_PER_SOURCE}. Heby&apos;s evidence view lists a bounded number of records, so
              a larger ingestion would be partly invisible. Ingest it in parts.
            </span>
          ) : null}
        </label>

        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="flex flex-1 flex-col gap-1 text-sm" htmlFor={domainId}>
            <span className="font-medium">Domain</span>
            <input
              className={FIELD_STYLE}
              id={domainId}
              onChange={(event) => setForm({ ...form, domainKey: event.target.value })}
              placeholder="finance"
              value={form.domainKey}
            />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-sm" htmlFor={scopeId}>
            <span className="font-medium">Scope</span>
            <select
              className={FIELD_STYLE}
              id={scopeId}
              onChange={(event) => setForm({ ...form, scope: event.target.value })}
              value={form.scope}
            >
              {KNOWLEDGE_SCOPES.map((scope) => (
                <option key={scope} value={scope}>
                  {scope}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/*
          THE STANDING IS STATED BEFORE THE ACTION. Ingesting is not ratifying, and this is where a
          human would otherwise assume it was — the volume makes it feel like an import of truth.
        */}
        <p className="rounded-md border border-border bg-surface-2 px-3 py-2 text-xs text-fg-muted">
          Ingested knowledge is <strong>provisional</strong>. It is not ratified organizational truth,
          and ingesting it does not review, approve or verify it. Each record is stored as a draft
          your organization holds, attributed to this source and to you.
        </p>

        {confirming ? (
          <div className="flex flex-col gap-2 rounded-md border border-border bg-surface-2 p-3">
            <p className="text-sm">
              Create <strong>{preview.chunks}</strong>{" "}
              {preview.chunks === 1 ? "record" : "records"} from{" "}
              <strong>{form.sourceTitle.trim()}</strong> in{" "}
              <strong>{form.domainKey.trim()}</strong> · {form.scope}?
            </p>
            <p className="text-xs text-fg-muted">
              They are written together — if any record fails, none are kept.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy} onClick={submit}>
                {busy ? "Ingesting…" : "Ingest source"}
              </Button>
              <Button disabled={busy} onClick={() => setConfirming(false)} variant="outline">
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <Button disabled={!ready || busy} onClick={() => setConfirming(true)}>
              Review before ingesting
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
