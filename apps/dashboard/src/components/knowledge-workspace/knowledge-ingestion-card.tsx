"use client";

/*
 * Knowledge ingestion card — Knowledge workspace → Ingest a source.
 *
 * ONE SOURCE BECOMES MANY RECORDS, AND THE HUMAN SEES HOW MANY BEFORE COMMITTING. That is the whole
 * difference from the authoring card beside it: authoring writes one fact the operator typed, this
 * writes N facts derived from text they supplied. Deriving records on someone's behalf is exactly
 * the kind of thing a product should not do silently, so the count is shown first and the split is
 * deterministic rather than clever.
 *
 * THE PREVIEW USES THE SERVER'S OWN CHUNKER. `normalizeSourceText` and `chunkSource` are pure and
 * imported directly — there is no second implementation here that could disagree with what actually
 * gets written. A preview that lies about the outcome is worse than no preview.
 *
 * A FILE IS THE SAME SOURCE, ARRIVING DIFFERENTLY (R4C.1). Choosing a file changes how the text
 * gets here and nothing else: same authority, same bounds, same chunker, same provisional standing.
 * The bounds check and the strict decoder are imported from the same module the server runs, for the
 * same reason the chunker is — so the record count shown before confirming is the one that will be
 * written, and a file that the server will refuse is refused here too instead of failing later.
 *
 * DECODING HERE IS FOR DISPLAY, NEVER FOR AUTHORITY. The FILE is what gets submitted, not this
 * copy of its text. The server reads the bytes itself and derives the source type from the extension
 * it validated, so nothing shown on this screen can decide what is stored.
 *
 * SELECTING IS NOT SUBMITTING. Choosing a file fills the form and shows what it would become. The
 * same explicit confirmation as before is still the act that writes anything.
 *
 * IT CLAIMS NOTHING IT CANNOT SUPPORT. Ingested knowledge is provisional and unratified, and the card
 * says so before the button rather than in a toast afterwards. These records become readable, not
 * retrievable by meaning, and the copy does not imply otherwise.
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
import {
  ingestKnowledgeAction,
  ingestKnowledgeFileAction,
} from "@/app/(dashboard)/knowledge/actions";
import { KNOWLEDGE_SCOPES, type KnowledgeSourceType } from "@/features/knowledge/create-contracts";
import {
  MAX_CHUNKS_PER_SOURCE,
  MAX_SOURCE_CHARACTERS,
  chunkSource,
  normalizeSourceText,
  type IngestionProblem,
} from "@/features/knowledge/ingestion-contracts";
import {
  MAX_FILE_BYTES,
  SUPPORTED_FILE_EXTENSIONS,
  decodeUtf8Strictly,
  validateSelectedFile,
  type FileIngestionProblem,
} from "@/features/knowledge/file-ingestion-contracts";

export type KnowledgeIngestionBlock =
  | { readonly kind: "unauthenticated" }
  | { readonly kind: "forbidden"; readonly roleType: string | null }
  | { readonly kind: "persistence-unavailable" };

const FIELD_STYLE =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const EMPTY = { sourceTitle: "", sourceText: "", domainKey: "", scope: "company-wide" };

const ACCEPTED_EXTENSIONS = Object.keys(SUPPORTED_FILE_EXTENSIONS);

/** How each accepted source type is named to a human. */
const SOURCE_TYPE_LABEL: Readonly<Record<KnowledgeSourceType, string>> = {
  "plain-text": "plain text",
  markdown: "Markdown",
};

/** A file the operator chose, already bounded and decoded — held so it can be SUBMITTED as bytes. */
interface ChosenFile {
  readonly file: File;
  readonly fileName: string;
  readonly byteLength: number;
  readonly sourceType: KnowledgeSourceType;
  /** A display copy. The server decodes the bytes again and does not receive this. */
  readonly previewText: string;
}

type Mode = "paste" | "file";

export function KnowledgeIngestionCard({ block }: { readonly block?: KnowledgeIngestionBlock }) {
  const [mode, setMode] = useState<Mode>("paste");
  const [form, setForm] = useState(EMPTY);
  const [chosen, setChosen] = useState<ChosenFile | null>(null);
  const [fileProblems, setFileProblems] = useState<readonly FileIngestionProblem[]>([]);
  const [problems, setProblems] = useState<readonly IngestionProblem[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [reading, setReading] = useState(false);
  const [chooserKey, setChooserKey] = useState(0);
  const [busy, startTransition] = useTransition();
  const router = useRouter();

  const titleId = useId();
  const textId = useId();
  const fileId = useId();
  const domainId = useId();
  const scopeId = useId();

  /* Whichever way the source arrived, one string feeds the preview and one path feeds the bounds. */
  const sourceText = mode === "file" ? (chosen?.previewText ?? "") : form.sourceText;

  /*
   * The SAME functions the server runs, so this count is the count that will be written. Recomputed
   * as the operator types; both are pure and linear, and a 60 000-character ceiling keeps that cheap.
   */
  const preview = useMemo(() => {
    const normalized = normalizeSourceText(sourceText);
    return { normalized, chunks: chunkSource(normalized).length };
  }, [sourceText]);

  const overSize = preview.normalized.length > MAX_SOURCE_CHARACTERS;
  const overChunks = preview.chunks > MAX_CHUNKS_PER_SOURCE;
  const ready =
    form.sourceTitle.trim().length > 0 &&
    preview.normalized.length > 0 &&
    form.domainKey.trim().length > 0 &&
    !overSize &&
    !overChunks &&
    (mode === "paste" || chosen !== null);

  function clearOutcome() {
    setProblems([]);
    setFileProblems([]);
    setNotice(null);
  }

  function switchMode(next: Mode) {
    if (next === mode) return;
    setMode(next);
    setConfirming(false);
    clearOutcome();
  }

  function forget() {
    setChosen(null);
    setChooserKey((key) => key + 1);
  }

  /*
   * Reading happens on SELECTION so the operator learns immediately whether Hebun can read the file
   * and what it would become. It writes nothing — the confirmation below is still the only act.
   */
  async function chooseFile(file: File | undefined) {
    clearOutcome();
    setConfirming(false);
    setChosen(null);
    if (!file) return;

    const bounds = validateSelectedFile({
      fileName: file.name,
      byteLength: file.size,
      declaredMediaType: file.type,
    });
    if (!bounds.ok) {
      setFileProblems(bounds.problems);
      forget();
      return;
    }

    setReading(true);
    try {
      const decoded = decodeUtf8Strictly(await file.arrayBuffer());
      if (!decoded.ok) {
        setFileProblems([decoded.problem]);
        forget();
        return;
      }
      setChosen({
        file,
        fileName: file.name,
        byteLength: file.size,
        sourceType: bounds.sourceType,
        previewText: decoded.text,
      });
      /* The file name is offered as a title only when the operator has not written one. */
      setForm((current) =>
        current.sourceTitle.trim().length > 0
          ? current
          : { ...current, sourceTitle: bounds.defaultSourceTitle },
      );
    } finally {
      setReading(false);
    }
  }

  function submit() {
    clearOutcome();
    startTransition(async () => {
      let result;
      if (mode === "file") {
        if (!chosen) return;
        /* The FILE is submitted, not the text shown above it. */
        const payload = new FormData();
        payload.set("file", chosen.file);
        payload.set("sourceTitle", form.sourceTitle);
        payload.set("domainKey", form.domainKey);
        payload.set("scope", form.scope);
        result = await ingestKnowledgeFileAction(payload);
      } else {
        result = await ingestKnowledgeAction(form);
      }

      if (result.status === "ingested") {
        setForm(EMPTY);
        forget();
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
      if (result.status === "file-rejected") {
        setFileProblems(result.problems);
        return;
      }
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
          Paste organizational text — a policy, a procedure, a handbook section — or choose a{" "}
          {ACCEPTED_EXTENSIONS.join(" / ")} file. It is split into records your organization holds,
          and Heby can then read them as evidence.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2" role="group">
          <Button
            aria-pressed={mode === "paste"}
            disabled={busy}
            onClick={() => switchMode("paste")}
            variant={mode === "paste" ? "primary" : "outline"}
          >
            Paste text
          </Button>
          <Button
            aria-pressed={mode === "file"}
            disabled={busy}
            onClick={() => switchMode("file")}
            variant={mode === "file" ? "primary" : "outline"}
          >
            Choose a file
          </Button>
        </div>

        {notice ? (
          <p
            aria-live="polite"
            className="rounded-md border border-border bg-surface-2 px-3 py-2 text-sm"
            role="status"
          >
            {notice}
          </p>
        ) : null}

        {fileProblems.length > 0 ? (
          <ul
            aria-live="assertive"
            className="flex flex-col gap-1 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700"
            role="alert"
          >
            {fileProblems.map((problem) => (
              <li key={problem.code}>{problem.message}</li>
            ))}
          </ul>
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

        {mode === "file" ? (
          <label className="flex flex-col gap-1 text-sm" htmlFor={fileId}>
            <span className="font-medium">Source file</span>
            <input
              accept={ACCEPTED_EXTENSIONS.join(",")}
              className={FIELD_STYLE}
              id={fileId}
              key={chooserKey}
              onChange={(event) => void chooseFile(event.target.files?.[0])}
              type="file"
            />
            <span className="text-xs text-fg-muted">
              {ACCEPTED_EXTENSIONS.join(", ")} · UTF-8 · at most{" "}
              {MAX_FILE_BYTES.toLocaleString("en-US")} bytes. The file itself is not stored — only the
              records it becomes.
            </span>
            {reading ? (
              <span className="text-xs text-fg-muted" role="status">
                Reading the file…
              </span>
            ) : null}
            {chosen ? (
              <span className="text-xs text-fg-muted" role="status">
                <strong>{chosen.fileName}</strong> · read as {SOURCE_TYPE_LABEL[chosen.sourceType]} ·{" "}
                {chosen.byteLength.toLocaleString("en-US")} bytes
              </span>
            ) : null}
          </label>
        ) : (
          <label className="flex flex-col gap-1 text-sm" htmlFor={textId}>
            <span className="font-medium">Source text</span>
            <textarea
              className={`${FIELD_STYLE} min-h-48 font-mono text-xs`}
              id={textId}
              onChange={(event) => setForm({ ...form, sourceText: event.target.value })}
              placeholder="Paste the text here. Blank lines separate paragraphs, and paragraphs are what the split follows."
              value={form.sourceText}
            />
          </label>
        )}

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
            {MAX_CHUNKS_PER_SOURCE}. Heby&apos;s evidence view lists a bounded number of records, so a
            larger ingestion would be partly invisible. Ingest it in parts.
          </span>
        ) : null}

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
            {chosen ? (
              <p className="text-xs text-fg-muted">
                Read from <strong>{chosen.fileName}</strong> as{" "}
                {SOURCE_TYPE_LABEL[chosen.sourceType]}. The file is not kept.
              </p>
            ) : null}
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
            <Button disabled={!ready || busy || reading} onClick={() => setConfirming(true)}>
              Review before ingesting
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
