"use client";

/*
 * Provider document admission card — Knowledge workspace → Admit a document from a connected
 * provider (KID-2).
 *
 * ── WHAT IT IS, AND WHAT THE CARD BESIDE IT IS NOT ───────────────────────────
 *
 * The section above this one LISTS what exists in a connected provider and says, correctly, that
 * none of it is Hebun Knowledge. This card is the one deliberate act that changes that for exactly
 * ONE document a human selected. It is not a sync, not an import-all, not a folder, not a schedule
 * and not a background job — there is no control here for any of those, because no such capability
 * exists behind this screen.
 *
 * ── EVERY OUTCOME IS NAMED ───────────────────────────────────────────────────
 *
 * Two authorities have to agree, and they fail differently: the organization may not have granted
 * Hebun the document-content scope, the person may not hold the Knowledge authoring band, the
 * document may be a kind Hebun does not admit, the provider may not answer, the content may be too
 * long, the classification may be invalid, the content may already be admitted, or the Knowledge may
 * be admitted while the provenance declaration is not. Each of those is a different sentence here.
 * "Import failed" is never one of them.
 *
 * ── IT DOES NOT SAY "IMPORTED SUCCESSFULLY" UNLESS BOTH HALVES HAPPENED ─────
 *
 * The requested act is "admit this document AND record where it came from". When the second half
 * does not complete, this card says the Knowledge is real and the provenance is incomplete, and it
 * says how many declarations are missing — and it says the way to finish it, which is to run the
 * same admission again.
 *
 * PRESENTATIONAL AND CLIENT-SIDE. It resolves no tenant, no connection, no capability, no
 * credential and no authority; it renders an already-resolved provider answer and calls one server
 * action. The whole read of the document happens on the server, from the identifier below.
 */

import { useId, useMemo, useState, useTransition } from "react";
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
import { admitProviderDocumentAction } from "@/app/(dashboard)/knowledge/actions";
import { KNOWLEDGE_SCOPES } from "@/features/knowledge/create-contracts";
import { GOOGLE_DRIVE_READABLE_TYPES } from "@/features/provider-google/contracts";
import type { DriveSourceDiscovery } from "@/features/provider-google/discover-drive-sources.server";
import type { AdmitProviderDocumentResult } from "@/features/provider-content-admission/admit-provider-document.server";
import type { KnowledgeIngestionBlock } from "./knowledge-ingestion-card";

const FIELD_STYLE =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

const EMPTY = { sourceTitle: "", domainKey: "", scope: "company-wide" };

/** Provider type strings are not human words. Only the types this capability actually admits. */
const ADMISSIBLE_TYPE_LABEL: Readonly<Record<string, string>> = {
  "application/vnd.google-apps.document": "Google Doc",
  "text/plain": "Text",
  "text/markdown": "Markdown",
  "text/x-markdown": "Markdown",
};

function isAdmissible(mimeType: string): boolean {
  return Object.hasOwn(GOOGLE_DRIVE_READABLE_TYPES, mimeType);
}

export function ProviderDocumentAdmissionCard({
  discovery,
  block,
}: {
  readonly discovery: DriveSourceDiscovery;
  readonly block?: KnowledgeIngestionBlock;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [confirming, setConfirming] = useState(false);
  const [admission, setAdmission] = useState<AdmitProviderDocumentResult | null>(null);
  const [busy, startTransition] = useTransition();
  const router = useRouter();

  const titleId = useId();
  const domainId = useId();
  const scopeId = useId();

  /*
   * WHICH OF THE DISCOVERED DOCUMENTS CAN ACTUALLY BE ADMITTED. Filtered against the provider
   * module's OWN closed readable-type map rather than a second list kept here, so a type this
   * screen offers is a type the server will read. Trashed documents are excluded: Drive reports
   * them, and the content seam refuses them, so offering one would be a control that fails.
   */
  const candidates = useMemo(
    () =>
      discovery.status === "discovered"
        ? discovery.candidates.filter((c) => !c.trashed && isAdmissible(c.mimeType))
        : [],
    [discovery],
  );

  const unsupportedCount =
    discovery.status === "discovered"
      ? discovery.candidates.filter((c) => !c.trashed && !isAdmissible(c.mimeType)).length
      : 0;

  const chosen = candidates.find((c) => c.externalId === selected) ?? null;
  const ready =
    chosen !== null && form.sourceTitle.trim().length > 0 && form.domainKey.trim().length > 0;

  function submit() {
    if (!chosen) return;
    setAdmission(null);
    startTransition(async () => {
      const outcome = await admitProviderDocumentAction({
        fileId: chosen.externalId,
        sourceTitle: form.sourceTitle,
        domainKey: form.domainKey,
        scope: form.scope,
      });
      setConfirming(false);
      setAdmission(outcome);
      if (outcome.status === "admitted") {
        setForm(EMPTY);
        setSelected(null);
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

  if (discovery.status !== "discovered") {
    /*
     * NO DOCUMENTS WERE LISTED, AND THE REASON BELONGS TO THE SECTION ABOVE. Repeating the
     * capability verdict here would be a second interpretation of connection truth; this states
     * only that there is nothing to select, and why that is not a claim about the provider.
     */
    return (
      <StateBlock
        tone="empty"
        title="There is no document to admit"
        description="Admission acts on a document discovered in a connected provider. Nothing was listed above, so this has no subject — which is not a statement that the provider holds nothing."
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
          Choose one discovered document and classify it. Hebun reads that document&rsquo;s content
          on the server, admits it through the same authority a pasted or uploaded source goes
          through, and records which provider record it came from.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/*
          THE SECOND GRANT, STATED BEFORE ANYONE TRIES. Listing documents and reading one are
          different Google consents, and a person who granted the first will otherwise read a
          refusal as a bug.
        */}
        <p className="rounded-md border border-border bg-surface-2 px-3 py-2 text-xs text-fg-muted">
          Reading a document&rsquo;s contents is a <strong>separate Google permission</strong> from
          listing documents. If this organization has granted only the listing permission, admission
          is refused here and says so — nothing is read and no Knowledge is written.
        </p>

        {candidates.length === 0 ? (
          <StateBlock
            tone="empty"
            title="None of the discovered documents can be admitted"
            description="Hebun admits Google Docs, plain text and Markdown. Spreadsheets, slides, PDFs, folders and every other type are not read at all — nothing is extracted or guessed from them."
          />
        ) : (
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">Document</legend>
            <p className="text-xs text-fg-muted">
              {candidates.length} of the discovered {candidates.length === 1 ? "document" : "documents"} can be
              admitted
              {unsupportedCount > 0 ? (
                <>
                  {" "}
                  · {unsupportedCount} {unsupportedCount === 1 ? "is" : "are"} a type Hebun does not
                  read
                </>
              ) : null}
              . Exactly one may be selected.
            </p>
            <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
              {candidates.map((candidate) => (
                <label
                  className="flex items-start gap-2 rounded-md border border-border px-3 py-2 text-sm"
                  key={candidate.externalId}
                >
                  <input
                    checked={selected === candidate.externalId}
                    className="mt-1"
                    name="provider-document"
                    onChange={() => {
                      setSelected(candidate.externalId);
                      setConfirming(false);
                      setAdmission(null);
                      setForm((current) =>
                        current.sourceTitle.trim().length > 0
                          ? current
                          : { ...current, sourceTitle: candidate.name },
                      );
                    }}
                    type="radio"
                    value={candidate.externalId}
                  />
                  <span className="min-w-0">
                    <span className="block truncate">{candidate.name}</span>
                    <span className="block text-xs text-fg-muted">
                      {ADMISSIBLE_TYPE_LABEL[candidate.mimeType] ?? candidate.mimeType}
                      {candidate.modifiedAt ? ` · modified ${candidate.modifiedAt.slice(0, 10)}` : null}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
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
          folder the document sits in, nor its name, nor a sentence of its text decides where it is
          filed — and admitting it is not approving it.
        */}
        <p className="rounded-md border border-border bg-surface-2 px-3 py-2 text-xs text-fg-muted">
          Admitted knowledge is <strong>provisional</strong>. It is not ratified organizational
          truth, and admitting it does not review, approve or verify it. The document&rsquo;s text is
          stored as records, never as instructions to Hebun. Deleting the document in the provider
          later does <strong>not</strong> remove what was admitted — withdrawing the source above is
          the only way to do that.
        </p>

        {admission ? <AdmissionOutcome admission={admission} /> : null}

        {confirming && chosen ? (
          <div className="flex flex-col gap-2 rounded-md border border-border bg-surface-2 p-3">
            <p className="text-sm">
              Read <strong>{chosen.name}</strong> from the connected Google Drive and admit it in{" "}
              <strong>{form.domainKey.trim()}</strong> · {form.scope}?
            </p>
            <p className="text-xs text-fg-muted">
              Hebun reads this one document. It does not open the folder it is in, follow links out
              of it, or read anything else in the Drive.
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
            <Button disabled={!ready || busy} onClick={() => setConfirming(true)}>
              Review before admitting
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * WHAT ACTUALLY HAPPENED, IN ITS OWN WORDS.
 *
 * One branch per outcome. The two admitted branches are further split on whether the provenance
 * declaration stands, because "the Knowledge is here" and "Hebun recorded where it came from" are
 * two different facts and the second one can be false while the first is true.
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
        "No document was read. Granting Hebun permission to read document contents is a separate consent from listing them.",
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
