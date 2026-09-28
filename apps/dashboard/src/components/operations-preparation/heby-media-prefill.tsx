"use client";

/*
 * heby-media-prefill.tsx — HEBY-MEDIA-3: what Heby recommends for this draft's media, prepared for a
 * human to act on through an EXISTING action.
 *
 * It renders a prefill the server derived from the current read and recommendation. It holds no
 * authority: nothing happens on render, on mount or on a timer. The only mutation reachable from
 * here is the existing per-asset selection action, called once per explicit click, with exactly the
 * three values the asset card already sends. The selection writer revalidates tenant, custody, kind
 * and draft binding when the human acts — a stale prefill can only be refused, never obeyed.
 *
 * Generation is never actionable here, review is never prefilled (no decision, no reason), and
 * publishing is not a target at all.
 */
import { useState, useTransition } from "react";
import { setMediaSelectionAction } from "@/app/(dashboard)/operations/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { MediaPrefill } from "@/features/content-composition/media-prefill";

type SelectResult = Awaited<ReturnType<typeof setMediaSelectionAction>>;

function short(id: string): string {
  return id.slice(0, 8);
}

function codes(list: readonly string[]): string {
  return list.length > 0 ? list.join(", ") : "none";
}

function selectNote(r: SelectResult): string {
  if (r.status === "selected") return "Added to this draft. It appears in the content package above.";
  return `Not added (${r.status === "refused" ? r.reason : r.status}). Nothing was changed.`;
}

function SelectOne({ artifactId, revisionNo, assetId }: { artifactId: string; revisionNo: number; assetId: string }) {
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  return (
    <li className="flex min-w-0 flex-wrap items-center gap-2 text-xs">
      <span className="font-mono text-fg-secondary">{short(assetId)}</span>
      <Button
        size="sm"
        variant="outline"
        disabled={pending || note?.startsWith("Added") === true}
        onClick={() =>
          start(async () =>
            setNote(
              selectNote(
                await setMediaSelectionAction({ artifactId, revisionNo, mediaAssetId: assetId, selected: true }),
              ),
            ),
          )
        }
      >
        Use in revision {revisionNo}
      </Button>
      {note ? <span className="text-fg-muted">{note}</span> : null}
    </li>
  );
}

export function HebyMediaPrefill({ prefill }: { prefill: MediaPrefill | null }) {
  if (!prefill) return null;
  return (
    <div className="min-w-0 space-y-2 rounded-lg border border-border-subtle bg-surface-sunken p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="neutral">Heby recommends</Badge>
        <span className="text-xs font-medium text-fg-primary">{prefill.recommendation}</span>
        <span className="text-[11px] text-fg-muted">deterministic · from revision {prefill.revisionNo} as read now</span>
      </div>

      {prefill.kind === "satisfied" ? (
        <p className="text-xs text-fg-secondary">
          Already selected in revision {prefill.revisionNo}: {prefill.assetIds.map(short).join(", ")}. No selection is needed.
        </p>
      ) : null}

      {prefill.kind === "select-existing" ? (
        <div className="space-y-1">
          <p className="text-xs text-fg-secondary">
            Prepared for you to choose. Nothing is selected until you click.
            {prefill.alreadySelected.length > 0 ? ` Already selected: ${prefill.alreadySelected.map(short).join(", ")}.` : ""}
          </p>
          <ul className="space-y-1">
            {prefill.assetIds.map((id) => (
              <SelectOne key={id} artifactId={prefill.artifactId} revisionNo={prefill.revisionNo} assetId={id} />
            ))}
          </ul>
        </div>
      ) : null}

      {prefill.kind === "generation-not-actionable" ? (
        <p className="text-xs text-fg-secondary">
          Not actionable. Blockers: {codes(prefill.blockers)}. Unknowns: {codes(prefill.unknowns)}. No generation is prepared.
        </p>
      ) : null}

      {prefill.kind === "ask-human" ? (
        <p className="text-xs text-fg-secondary">
          Your choice. Reasons: {codes(prefill.reasons)}. Blockers: {codes(prefill.blockers)}. Unknowns: {codes(prefill.unknowns)}.
        </p>
      ) : null}

      {prefill.reviewPending.length > 0 ? (
        <p className="text-[11px] text-fg-muted">
          Review due on {prefill.reviewPending.map(short).join(", ")} — decide it on the asset below, with your own reason.
        </p>
      ) : null}

      <ul className="space-y-0.5 text-[11px] text-fg-muted">
        {prefill.explanation.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}
