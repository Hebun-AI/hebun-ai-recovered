"use client";

/*
 * Ingested sources (R6D) — every source this organization still holds live Knowledge from, and the
 * governed act that withdraws one.
 *
 * ── IT IS NOT A DELETE CONTROL, AND IT MUST NOT LOOK LIKE ONE ────────────────
 *
 * Hebun never stored the file. `knowledge-file-ingest.server.ts` reads the bytes into one buffer for
 * the length of a request and lets them go; there is no object store and the `documents` table has
 * no consumer. A control labelled "delete" would therefore claim a cleanup Hebun cannot perform, and
 * the operator would reasonably believe their document had been removed from somewhere.
 *
 * So the word is RETRACT, the effect is stated before the button, and `RETRACTION_SUMMARY` — a
 * frozen value, asserted by test — says plainly that nothing is deleted and that no file was ever
 * kept. The confirmation is a typed one: the operator retypes the source title, the same shape the
 * deployment ceremonies use, because a single click is not a decision about forty facts.
 *
 * ── THE TARGET IS THE SOURCE, NEVER A CATEGORY ───────────────────────────────
 *
 * The control sits on the row that names the source and shows how many facts it produced. Company
 * Understanding aggregates several sources into one area, so putting a withdrawal on a category
 * would attach a mutation to something that is not the mutation's target.
 *
 * ACCESSIBILITY: a real <label> for the confirmation, refusals in role="alert", success in
 * role="status", and the ratified-blocked state carried by words rather than colour.
 */

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { retractKnowledgeSourceAction } from "@/app/(dashboard)/knowledge/actions";
import {
  RETRACTION_SUMMARY,
  type RetractionRefusal,
} from "@/features/knowledge/retraction-contracts";
import type { IngestedSourcesListing } from "@/features/knowledge/ingested-sources-read.server";
import type { IngestedSourceSummary } from "@/features/knowledge/durable-knowledge-repository.server";

/** Why retraction is unavailable, when it is. Shared with authoring: one band, one reason. */
export type RetractionBlock =
  | { readonly kind: "unauthenticated" }
  | { readonly kind: "persistence-unavailable" }
  | { readonly kind: "forbidden"; readonly roleType: string | null };

const REFUSAL_TEXT: Record<RetractionRefusal, string> = {
  unauthorized: "Your session ended. Sign in again.",
  forbidden: "Your role does not permit changing Knowledge.",
  "persistence-unavailable": "Durable persistence is not configured, so nothing could be changed.",
  "invalid-source-identity": "That is not a source identity. Nothing was looked up.",
  "source-not-found":
    "No active Knowledge came from that source any more. It may already have been retracted.",
  "source-contains-ratified-knowledge":
    "Some Knowledge from this source is ratified by your Governance authority. Withdrawing it would " +
    "reverse a Governance decision, which this act cannot do.",
  "write-failed": "The retraction did not complete. Nothing was changed.",
};

function label(source: IngestedSourceSummary): string {
  return source.sourceTitles[0] ?? `source ${source.sourceDigest.slice(0, 12)}`;
}

function SourceRow({ source, disabled }: { source: IngestedSourceSummary; disabled: boolean }) {
  const router = useRouter();
  const confirmId = useId();
  const [confirmation, setConfirmation] = useState("");
  const [refusal, setRefusal] = useState<RetractionRefusal | null>(null);
  const [retracted, setRetracted] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  const name = label(source);
  /* The typed confirmation must match the title shown. A click alone is not a decision here. */
  const armed = confirmation.trim() === name && !disabled && source.liveFactCount > 0;
  const blockedByRatification = source.ratifiedFactCount > 0;

  function submit() {
    setRefusal(null);
    startTransition(async () => {
      const result = await retractKnowledgeSourceAction({ sourceDigest: source.sourceDigest });
      if (result.status === "refused") {
        setRefusal(result.reason);
        return;
      }
      setRetracted(result.source.retractedFactCount);
      router.refresh();
    });
  }

  if (retracted !== null) {
    return (
      <li className="flex min-w-0 flex-col gap-1 rounded-lg border border-border bg-surface-raised/40 p-3">
        <p className="text-sm font-medium text-fg">{name}</p>
        <p role="status" className="text-xs text-fg-secondary">
          Retracted. {retracted} record{retracted === 1 ? "" : "s"} withdrawn from active Knowledge.
          Their text and history remain readable.
        </p>
      </li>
    );
  }

  return (
    <li className="flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-surface-raised/40 p-3">
      <p className="flex flex-wrap items-baseline gap-x-2 text-sm font-medium text-fg">
        {name}
        <span className="font-mono text-[0.7rem] font-normal text-fg-muted">
          {source.sourceDigest.slice(0, 12)}
        </span>
      </p>
      {source.sourceTitles.length > 1 ? (
        <p className="text-[0.7rem] text-fg-muted">
          {/* One digest, several titles: the same content was ingested more than once. */}
          Also ingested as: {source.sourceTitles.slice(1).join(", ")}
        </p>
      ) : null}
      <p className="text-[0.7rem] text-fg-muted">
        {source.liveFactCount} record{source.liveFactCount === 1 ? "" : "s"} in active Knowledge
        {source.retiredFactCount > 0 ? ` · ${source.retiredFactCount} already retracted` : ""}
        {source.ratifiedFactCount > 0 ? ` · ${source.ratifiedFactCount} ratified` : ""}
      </p>

      {blockedByRatification ? (
        <p className="flex items-start gap-2 text-xs leading-5 text-fg-secondary">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Knowledge from this source has been ratified by your Governance authority. Withdrawing it
            would reverse a Governance decision, and this act cannot do that. Correct the individual
            records instead.
          </span>
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <label htmlFor={confirmId} className="text-[0.7rem] text-fg-muted">
            Retype the source name to retract it
          </label>
          <input
            id={confirmId}
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            disabled={disabled || pending}
            aria-invalid={refusal !== null}
            className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-fg"
            placeholder={name}
          />
          <Button type="button" onClick={submit} disabled={!armed || pending} className="self-start">
            <Archive className="size-4" aria-hidden />
            {pending ? "Retracting…" : "Retract source"}
          </Button>
        </div>
      )}

      {refusal ? (
        <p role="alert" className="text-xs text-fg-secondary">
          {REFUSAL_TEXT[refusal]}
        </p>
      ) : null}
    </li>
  );
}

export function KnowledgeSourcesCard({
  listing,
  block,
}: {
  listing: IngestedSourcesListing;
  /** Whatever stops you adding a source stops you withdrawing one. Resolved once, by the page. */
  block?: RetractionBlock;
}) {
  if (listing.status === "unavailable") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Ingested sources</CardTitle>
          <CardDescription>
            {listing.reason === "no-authorized-tenant-context"
              ? "Sign in to see which sources your organization's Knowledge came from."
              : listing.detail}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const { sources } = listing;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ingested sources</CardTitle>
        <CardDescription>
          {sources.length === 0
            ? "No Knowledge in your organization came from an ingested source yet."
            : `${sources.length} source${sources.length === 1 ? "" : "s"}. ${RETRACTION_SUMMARY}`}
        </CardDescription>
      </CardHeader>

      {sources.length > 0 ? (
        <CardContent className="flex flex-col gap-3">
          {block ? (
            <p className="text-xs leading-5 text-fg-secondary">
              {block.kind === "unauthenticated"
                ? "Sign in to retract a source."
                : block.kind === "persistence-unavailable"
                  ? "Durable persistence is not configured, so nothing can be changed."
                  : `Retracting a source requires the same authority as adding one. Your role${
                      block.roleType ? ` (${block.roleType})` : ""
                    } does not hold it.`}
            </p>
          ) : null}
          <ul className="flex flex-col gap-3">
            {sources.map((source) => (
              <SourceRow key={source.sourceDigest} source={source} disabled={block !== undefined} />
            ))}
          </ul>
        </CardContent>
      ) : null}
    </Card>
  );
}
