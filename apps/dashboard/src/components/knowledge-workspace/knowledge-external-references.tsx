"use client";

/*
 * Knowledge external-system references (KR-EXT1) — what a fact is ABOUT, outside Hebun.
 *
 * ── THE WORDING IS THE ARCHITECTURE ──────────────────────────────────────────
 *
 * There is no "Link", no "Connect", no "Import", no "Sync". Those words promise that something was
 * fetched, joined live, or brought in, and none of that happens. The act is **Record a reference**,
 * and its removal is **Withdraw** — because what is being removed is the organization's own
 * statement, not anything belonging to the provider.
 *
 * ── WHAT THE PANEL MUST SAY OUT LOUD ─────────────────────────────────────────
 *
 * A reader looking at a repository id inside the Knowledge workspace would reasonably assume Hebun
 * fetched something. It did not, so the panel says so in its own words rather than leaving it to be
 * inferred: this is an organizational reference, no provider data was imported, nothing was checked
 * with the provider, and withdrawing it removes the relationship and not the repository.
 *
 * ── THE IDENTITY IS CHOSEN, NOT TYPED ────────────────────────────────────────
 *
 * Three of the four identity fields come from a closed menu (`EXTERNAL_RECORD_KINDS`), so a typo in
 * a provider key or a capability key — which would silently make a reference unjoinable — cannot be
 * made. The one value a human supplies is the provider's own record id.
 *
 * WHAT IS STILL MANUAL, STATED HONESTLY. The id is typed rather than selected from a live provider
 * result. Handing a typed reference straight from `/repositories` into this panel would put a
 * provider read behind the Knowledge workspace, which is architecture beyond this phase — so the
 * hint says exactly where the number is already displayed, and the handoff is deferred rather than
 * faked.
 *
 * Everything rendered is server data or a fixed sentence. Provider text is never displayed here,
 * because none is stored.
 */

import { useId, useState, useTransition } from "react";
import { Link2Off, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  attachKnowledgeExternalReferenceAction,
  listKnowledgeExternalReferencesAction,
  withdrawKnowledgeExternalReferenceAction,
} from "@/app/(dashboard)/knowledge/actions";
import {
  EXTERNAL_RECORD_KINDS,
  findExternalRecordKind,
  MAX_RECORD_ID_LENGTH,
  renderExternalReference,
  type RecordedExternalReference,
} from "@/features/knowledge/external-reference-contracts";

const FIELD =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/** Why a reference could not be recorded, in the operator's words. Never a raw refusal code. */
const REFUSAL_TEXT: Readonly<Record<string, string>> = Object.freeze({
  "no-authorized-tenant-context": "Your session ended. Sign in again — nothing was recorded.",
  "not-authorized": "You do not hold the authority to record organizational Knowledge references.",
  "knowledge-fact-not-found": "That Knowledge record could not be found for your organization.",
  "malformed-reference":
    "That is not a provider record id. It must be a single value with no spaces — the id, never the name.",
  "already-declared": "Your organization already records this reference for this Knowledge record.",
  "reference-not-found": "That reference is no longer recorded, so there was nothing to withdraw.",
  "authority-unavailable": "Hebun could not reach its own records, so nothing was recorded.",
});

export interface KnowledgeExternalReferencesProps {
  readonly factId: string;
  /** False when the viewer may read Knowledge but not author it. */
  readonly canAuthor: boolean;
}

export function KnowledgeExternalReferences({ factId, canAuthor }: KnowledgeExternalReferencesProps) {
  const kindFieldId = useId();
  const idFieldId = useId();

  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [references, setReferences] = useState<readonly RecordedExternalReference[]>([]);
  const [kindId, setKindId] = useState(EXTERNAL_RECORD_KINDS[0]!.id);
  const [recordId, setRecordId] = useState("");
  const [refusal, setRefusal] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const kind = findExternalRecordKind(kindId) ?? EXTERNAL_RECORD_KINDS[0]!;

  function reload() {
    startTransition(async () => {
      setReferences(await listKnowledgeExternalReferencesAction({ knowledgeFactId: factId }));
      setLoaded(true);
    });
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !loaded) reload();
  }

  function record() {
    setRefusal(null);
    startTransition(async () => {
      const outcome = await attachKnowledgeExternalReferenceAction({
        knowledgeFactId: factId,
        reference: {
          providerKey: kind.providerKey,
          capability: kind.capability,
          recordType: kind.recordType,
          recordId: recordId.trim(),
        },
      });
      if (outcome.status === "declared") {
        setRecordId("");
        setReferences(await listKnowledgeExternalReferencesAction({ knowledgeFactId: factId }));
      } else {
        setRefusal(REFUSAL_TEXT[outcome.reason] ?? "That reference could not be recorded.");
      }
    });
  }

  function withdraw(referenceId: string) {
    setRefusal(null);
    startTransition(async () => {
      const outcome = await withdrawKnowledgeExternalReferenceAction({ referenceId });
      if (outcome.status === "withdrawn") {
        setReferences(await listKnowledgeExternalReferencesAction({ knowledgeFactId: factId }));
      } else {
        setRefusal(REFUSAL_TEXT[outcome.reason] ?? "That reference could not be withdrawn.");
      }
    });
  }

  return (
    <div className="mt-3 border-t border-border pt-3">
      <Button variant="ghost" size="sm" onClick={toggle} aria-expanded={open}>
        External systems
      </Button>

      {open ? (
        <div className="mt-3 flex flex-col gap-3">
          {/*
            THE HONEST FRAME. Stated before anything else on the panel, because a provider id shown
            inside Knowledge invites exactly the conclusion this sentence refuses.
          */}
          <p className="text-meta text-fg-muted">
            An external reference is your organization&rsquo;s own statement that this Knowledge record concerns a
            particular system record. Hebun imports no provider data, checks nothing with the provider, and does not
            keep the reference up to date. Withdrawing one removes the relationship — never the repository.
          </p>

          {!loaded && pending ? (
            <p className="text-meta text-fg-muted">Reading recorded references&hellip;</p>
          ) : references.length === 0 ? (
            <p className="text-meta text-fg-muted">
              No external system is recorded for this Knowledge record.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {references.map((reference) => (
                <li
                  key={reference.referenceId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="break-all text-body text-fg">{renderExternalReference(reference)}</p>
                    <p className="text-meta text-fg-muted">Recorded {reference.declaredAt}</p>
                  </div>
                  {canAuthor ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() => withdraw(reference.referenceId)}
                      aria-label={`Withdraw ${renderExternalReference(reference)}`}
                    >
                      <Link2Off aria-hidden className="mr-1 h-3.5 w-3.5" />
                      Withdraw
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          {canAuthor ? (
            <div className="flex flex-col gap-2">
              <label htmlFor={kindFieldId} className="text-meta uppercase tracking-wide text-fg-muted">
                External record
              </label>
              <select
                id={kindFieldId}
                className={FIELD}
                value={kindId}
                onChange={(event) => setKindId(event.target.value)}
                disabled={pending}
              >
                {EXTERNAL_RECORD_KINDS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>

              <label htmlFor={idFieldId} className="text-meta uppercase tracking-wide text-fg-muted">
                {kind.recordIdLabel}
              </label>
              <input
                id={idFieldId}
                className={FIELD}
                value={recordId}
                maxLength={MAX_RECORD_ID_LENGTH}
                onChange={(event) => setRecordId(event.target.value)}
                disabled={pending}
                placeholder="1300480452"
                aria-describedby={`${idFieldId}-hint`}
              />
              <p id={`${idFieldId}-hint`} className="text-meta text-fg-muted">
                {kind.recordIdHint}
              </p>

              {refusal ? (
                <p role="status" className="text-meta text-warning">
                  {refusal}
                </p>
              ) : null}

              <div>
                <Button size="sm" disabled={pending || recordId.trim().length === 0} onClick={record}>
                  <Plus aria-hidden className="mr-1 h-3.5 w-3.5" />
                  Record a reference
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
