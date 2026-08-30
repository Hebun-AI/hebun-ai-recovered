"use client";

/*
 * Provider document admission card — Knowledge workspace → Admit a provider document.
 *
 * ── WHAT CHANGED, AND WHY ────────────────────────────────────────────────────
 *
 * KID-2 shipped this card selecting from a list Hebun had discovered across the whole connected
 * Drive. That listing needs `drive.metadata.readonly`, and reading the chosen document needed
 * `drive.readonly` — both classified RESTRICTED by Google.
 *
 * The Director chose least privilege instead. Selection now happens in GOOGLE'S OWN CHOOSER, and
 * the chooser is not a nicer list — it IS the permission mechanism: `drive.file` grants access per
 * file, to files the user hands the app through the Picker. So this surface asks for no Drive-wide
 * permission of any kind, and the section above it — which merely OBSERVES what exists in a
 * connected Drive — is untouched and still says it admits nothing.
 *
 *     USER-SELECTED FILE != ALL DRIVE FILES        SELECTION != ADMISSION
 *
 * ── EVERY OUTCOME IS NAMED, AND CANCELLING IS NOT ONE OF THE FAILURES ───────
 *
 * Google not connected, the per-file permission not granted, the chooser not configured, the
 * chooser closed by the human, an unsupported document, a failed content read, a refused Knowledge
 * authorization, a refused validation, a duplicate, admitted-but-provenance-incomplete, and fully
 * admitted are ten different sentences. Closing the chooser is a decision, not an error, and it is
 * reported as one. "Import failed" is never any of them.
 *
 * PRESENTATIONAL AND CLIENT-SIDE. It resolves no tenant, no connection, no capability and no
 * credential. It calls two server actions: one that authorizes a chooser, one that admits what was
 * chosen. Neither the token nor the chosen document grants this component any authority.
 */

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CloudDownload } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StateBlock } from "@/components/ui/state-block";
import {
  admitPickedGoogleDocumentAction,
  authorizeGooglePickerSessionAction,
} from "@/app/(dashboard)/knowledge/actions";
import { KNOWLEDGE_SCOPES } from "@/features/knowledge/create-contracts";
import { GOOGLE_DRIVE_READABLE_TYPES } from "@/features/provider-google/contracts";
import type { AdmitProviderDocumentResult } from "@/features/provider-content-admission/admit-provider-document.server";
import { openGooglePicker, type PickedGoogleDocument } from "./google-picker.client";
import type { KnowledgeIngestionBlock } from "./knowledge-ingestion-card";

const FIELD_STYLE =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const EMPTY = { sourceTitle: "", domainKey: "", scope: "company-wide" };

/**
 * WHAT THE CHOOSER MAY OFFER — the provider module's OWN closed readable-type map, not a second
 * list kept here. The chooser and the server therefore agree by construction: a type the human can
 * select is a type the server will read.
 */
const ADMISSIBLE_MIME_TYPES = Object.keys(GOOGLE_DRIVE_READABLE_TYPES);

const TYPE_LABEL: Readonly<Record<string, string>> = {
  "application/vnd.google-apps.document": "Google Doc",
  "text/plain": "Text",
  "text/markdown": "Markdown",
  "text/x-markdown": "Markdown",
};

/** What the surface is currently telling the human about the CHOOSER, as opposed to the admission. */
type SelectionNotice =
  | { readonly kind: "cancelled" }
  | { readonly kind: "unsupported"; readonly mimeType: string }
  | { readonly kind: "refused"; readonly detail: string }
  | { readonly kind: "unavailable"; readonly detail: string };

export function ProviderDocumentAdmissionCard({
  block,
  pickerConfigured,
}: {
  readonly block?: KnowledgeIngestionBlock;
  /** Server-resolved boolean. The Picker's own configuration values never reach this component. */
  readonly pickerConfigured: boolean;
}) {
  const [picked, setPicked] = useState<PickedGoogleDocument | null>(null);
  const [notice, setNotice] = useState<SelectionNotice | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [confirming, setConfirming] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [admission, setAdmission] = useState<AdmitProviderDocumentResult | null>(null);
  const [busy, startTransition] = useTransition();
  const router = useRouter();

  const titleId = useId();
  const domainId = useId();
  const scopeId = useId();

  const ready = picked !== null && form.sourceTitle.trim().length > 0 && form.domainKey.trim().length > 0;

  /**
   * Open Google's chooser.
   *
   * The token is authorized SERVER-SIDE per click and is handed straight to Google's Picker. It is
   * not stored in component state, in browser storage, or anywhere else it could outlive the
   * chooser it was minted for.
   */
  async function chooseDocument() {
    setNotice(null);
    setAdmission(null);
    setConfirming(false);
    setChoosing(true);
    try {
      const session = await authorizeGooglePickerSessionAction();
      if (session.status === "refused") {
        setNotice({ kind: "refused", detail: session.detail });
        return;
      }
      if (session.status === "provider-failed") {
        setNotice({ kind: "unavailable", detail: session.detail });
        return;
      }

      const chosen = await openGooglePicker({
        accessToken: session.accessToken,
        apiKey: session.apiKey,
        appId: session.appId,
        mimeTypes: ADMISSIBLE_MIME_TYPES,
      });

      if (chosen.status === "cancelled") {
        setNotice({ kind: "cancelled" });
        return;
      }
      if (chosen.status === "unavailable") {
        setNotice({ kind: "unavailable", detail: chosen.detail });
        return;
      }
      /*
       * The chooser was already restricted to admissible types; this is the second check, because a
       * surface that only filters cannot state what happened if something else arrives anyway.
       */
      if (!ADMISSIBLE_MIME_TYPES.includes(chosen.document.mimeType)) {
        setNotice({ kind: "unsupported", mimeType: chosen.document.mimeType });
        return;
      }
      setPicked(chosen.document);
      setForm((current) =>
        current.sourceTitle.trim().length > 0
          ? current
          : { ...current, sourceTitle: chosen.document.name },
      );
    } finally {
      setChoosing(false);
    }
  }

  function submit() {
    if (!picked) return;
    setAdmission(null);
    startTransition(async () => {
      const admitted = await admitPickedGoogleDocumentAction({
        fileId: picked.fileId,
        sourceTitle: form.sourceTitle,
        domainKey: form.domainKey,
        scope: form.scope,
      });
      setConfirming(false);
      setAdmission(admitted);
      if (admitted.status === "admitted") {
        setForm(EMPTY);
        setPicked(null);
        router.refresh();
      }
    });
  }

  if (block) {
    /* The SAME band that authors and ingests. Same three kinds, same released wording. */
    return (
      <StateBlock
        tone={block.kind === "persistence-unavailable" ? "unavailable" : "restricted"}
        title="Admit a document from a connected provider"
        description={
          block.kind === "unauthenticated"
            ? "Sign in to admit a provider document into organizational Knowledge."
            : block.kind === "forbidden"
              ? "Your role may not establish organizational Knowledge. Admitting a provider document is limited to the same authority band that authors it."
              : "Durable persistence is not configured, so nothing can be admitted."
        }
      />
    );
  }

  return (
    <Card>
      <CardHeader stacked>
        <CardTitle className="flex items-center gap-2">
          <CloudDownload aria-hidden className="size-4" />
          Admit one document
        </CardTitle>
        <CardDescription>
          Choose one document in Google&rsquo;s own chooser and classify it. Hebun reads that
          document on the server, admits it through the same authority a pasted or uploaded source
          goes through, and records which provider record it came from.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/*
          THE PERMISSION, STATED BEFORE THE CONTROL. This is the sentence the whole adaptation was
          for, and a reader should be able to check it against what Google asks them to approve.
        */}
        <p className="rounded-md border border-border bg-surface-2 px-3 py-2 text-xs text-fg-muted">
          Hebun asks Google for access to <strong>only the document you choose</strong> — not to
          your Drive. Each document you pick is granted individually, and Hebun can read nothing you
          have not handed to it.
        </p>

        {!pickerConfigured ? (
          <StateBlock
            tone="unavailable"
            title="The document chooser is not configured"
            description="This deployment has no Google Picker configuration, so Hebun cannot open Google's chooser. Nothing was read and no connection was consulted."
          />
        ) : (
          <div className="flex flex-col gap-2">
            <Button disabled={choosing || busy} onClick={() => void chooseDocument()}>
              {choosing ? "Opening Google Drive…" : "Choose from Google Drive"}
            </Button>
            {notice ? <SelectionMessage notice={notice} /> : null}
            {picked ? (
              <p className="text-xs text-fg-muted" role="status">
                Selected <strong>{picked.name}</strong> ·{" "}
                {TYPE_LABEL[picked.mimeType] ?? picked.mimeType}. Nothing has been read or admitted
                yet.
              </p>
            ) : null}
          </div>
        )}

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
          CLASSIFICATION IS THE HUMAN'S, AND THE STANDING IS STATED BEFORE THE ACT. Neither the
          document's name nor a sentence of its text decides where it is filed — and admitting it is
          not approving it.
        */}
        <p className="rounded-md border border-border bg-surface-2 px-3 py-2 text-xs text-fg-muted">
          Admitted knowledge is <strong>provisional</strong>. It is not ratified organizational
          truth, and admitting it does not review, approve or verify it. The document&rsquo;s text is
          stored as records, never as instructions to Hebun. Deleting the document in Google later
          does <strong>not</strong> remove what was admitted — withdrawing the source above is the
          only way to do that.
        </p>

        {admission ? <AdmissionOutcome admission={admission} /> : null}

        {confirming && picked ? (
          <div className="flex flex-col gap-2 rounded-md border border-border bg-surface-2 p-3">
            <p className="text-sm">
              Read <strong>{picked.name}</strong> from Google Drive and admit it in{" "}
              <strong>{form.domainKey.trim()}</strong> · {form.scope}?
            </p>
            <p className="text-xs text-fg-muted">
              Hebun reads this one document. It does not open the folder it sits in, follow links out
              of it, or read anything else you have not chosen.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy} onClick={submit}>
                {busy ? "Admitting…" : "Admit document"}
              </Button>
              <Button disabled={busy} onClick={() => setConfirming(false)} variant="outline">
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <Button disabled={!ready || busy || choosing} onClick={() => setConfirming(true)}>
              Review before admitting
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * WHAT HAPPENED AT THE CHOOSER — which is a different question from what happened to the Knowledge.
 *
 * `cancelled` is deliberately NOT rendered as an error: the human closed a dialog, which is a
 * decision they are entitled to make, and colouring it red would teach them that using the product
 * normally produces failures.
 */
function SelectionMessage({ notice }: { readonly notice: SelectionNotice }) {
  if (notice.kind === "cancelled") {
    return (
      <p className="text-xs text-fg-muted" role="status">
        You closed the chooser, so nothing was selected. Nothing was read and nothing was admitted.
      </p>
    );
  }
  const text =
    notice.kind === "unsupported"
      ? `Hebun admits Google Docs, plain text and Markdown. That document is ${notice.mimeType}, which Hebun does not read — nothing was extracted or guessed from it.`
      : notice.detail;
  return (
    <p
      aria-live="assertive"
      className="rounded-md border border-error/30 bg-error-subtle px-3 py-2 text-body text-error"
      role="alert"
    >
      {text}
    </p>
  );
}

/**
 * WHAT ACTUALLY HAPPENED TO THE KNOWLEDGE.
 *
 * The two admitted branches are split further on whether the provenance declaration stands, because
 * "the Knowledge is here" and "Hebun recorded where it came from" are two different facts and the
 * second can be false while the first is true.
 */
function AdmissionOutcome({ admission }: { readonly admission: AdmitProviderDocumentResult }) {
  if (admission.status === "admitted" || admission.status === "already-admitted") {
    const { document, provenance } = admission;
    const admittedNow = admission.status === "admitted";
    return (
      <div
        aria-live="polite"
        className="flex flex-col gap-1 rounded-md border border-border bg-surface-2 px-3 py-2 text-sm"
        role="status"
      >
        <p>
          {admittedNow ? (
            <>
              Admitted <strong>{document.providerName}</strong> as {document.chunkCount} provisional{" "}
              {document.chunkCount === 1 ? "record" : "records"}. They are not ratified.
            </>
          ) : (
            <>
              This exact content is <strong>already admitted</strong> under this classification, so
              nothing was written. It stands as {document.chunkCount}{" "}
              {document.chunkCount === 1 ? "record" : "records"}.
            </>
          )}
        </p>
        {provenance.complete ? (
          <p className="text-xs text-fg-muted">
            All {provenance.factCount} {provenance.factCount === 1 ? "record" : "records"} record
            that they concern this Google Drive document.
          </p>
        ) : (
          <p className="text-xs text-error">
            <strong>The provenance is incomplete.</strong> {provenance.declared} of{" "}
            {provenance.factCount} {provenance.factCount === 1 ? "record" : "records"} record which
            provider document they came from
            {provenance.refusals.length > 0 ? ` (${provenance.refusals.join(", ")})` : null}. The
            Knowledge itself is admitted and readable. Running this same admission again completes
            the missing declarations without writing the Knowledge twice.
          </p>
        )}
      </div>
    );
  }

  const message = describe(admission);
  return (
    <ul
      aria-live="assertive"
      className="flex flex-col gap-1 rounded-md border border-error/30 bg-error-subtle px-3 py-2 text-body text-error"
      role="alert"
    >
      {message.map((line, index) => (
        <li key={index}>{line}</li>
      ))}
    </ul>
  );
}

/** Every refusal, in the words of the authority that produced it. Never collapsed into one. */
function describe(admission: AdmitProviderDocumentResult): readonly string[] {
  switch (admission.status) {
    case "not-authenticated":
      return ["You are not signed in. Nothing was read and nothing was written."];
    case "knowledge-not-authorized":
      return [
        "Your role may not establish organizational Knowledge, so no document was read and nothing was written.",
      ];
    case "provider-capability-unavailable":
      return [
        admission.detail,
        "No document was read. Hebun needs permission to open documents you choose in Google Drive, which is granted separately from connecting your account.",
      ];
    case "provider-refused":
      return [admission.detail, "No Knowledge was written."];
    case "provider-read-failed":
      return [
        "Google did not answer this read, so the document's contents are unknown.",
        "The connection and the access granted to it are unaffected, and no Knowledge was written.",
      ];
    case "document-not-admissible":
      return [admission.detail];
    case "content-refused":
      return admission.problems.map((problem) => problem.message);
    case "classification-refused":
      return admission.problems.map((problem) => problem.message);
    case "admission-unavailable":
      return [admission.detail];
    case "admission-failed":
      return [`Nothing was admitted. ${admission.detail}`];
    default:
      return ["Nothing was admitted."];
  }
}
