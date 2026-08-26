"use client";

/*
 * Knowledge records (K2, recomposed in Stage 1) — the tenant's real canonical Knowledge, read
 * through the K1 path.
 *
 * This renders the SAME `KnowledgeListing` the `/knowledge` and `/source` slash commands read and
 * that Heby grounds on. There is no records-specific read: if something appears here, Heby can cite
 * it, and if Heby cannot cite it, it does not appear here.
 *
 * Every record shows its own standing — authority class, lifecycle, whether a ratification is
 * actually recorded, and derived freshness — rather than a single reassuring badge. Nothing here
 * displays a confidence figure, a quality score, or a verification mark, because no authority in
 * Hebun owns one.
 *
 * ── WHAT STAGE 1 CHANGED, AND WHAT IT DID NOT ────────────────────────────────
 *
 * The READ is untouched: the same `KnowledgeListing` arrives from the same server component, with
 * the same tenant predicate and the same 50-record bound. No new read, no new action, no new
 * authority.
 *
 * What changed is the reading. The component became a client component so it can FILTER what is
 * already on screen, and it now distinguishes three outcomes that used to share one rendering:
 *
 *   the read failed          → StateBlock `unavailable`. Never "no records".
 *   the read found nothing   → StateBlock `empty`, carrying the way in.
 *   the filter matched none  → an inline note. The corpus is NOT empty; the query is narrow.
 *
 * The filter is client-side ON PURPOSE. `searchKnowledge` exists in `knowledge-read.server.ts` with
 * richer semantics (`empty-query` / `empty-corpus` / `no-match` / `matched`) and exactly one
 * consumer — Heby's evidence resolver. Adding a second server consumer would be a new seam this
 * phase was not asked for; narrowing a list the viewer has already been served is not a read at
 * all. The distinction is stated in the UI rather than implied.
 *
 * Content is rendered as TEXT through React's escaping; a statement containing markup or a command
 * is displayed, never executed.
 */

import { useId, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { StateBlock } from "@/components/ui/state-block";
import { KnowledgeExternalReferences } from "./knowledge-external-references";
import { KnowledgeVersionControl } from "./knowledge-version-control";
import type { KnowledgeListing, KnowledgeSourceRecord } from "@/features/knowledge/contracts";

function Standing({ record }: { record: KnowledgeSourceRecord }) {
  const authority =
    record.authorityClass === null
      ? "authority not stated"
      : record.authorityClass === "authoritative"
        ? "authoritative"
        : "provisional — not settled truth";
  return (
    <dl className="flex flex-wrap gap-x-4 gap-y-1 text-meta text-fg-muted">
      <div className="flex gap-1">
        <dt className="sr-only">Authority</dt>
        <dd>{authority}</dd>
      </div>
      <div className="flex gap-1">
        <dt className="sr-only">Lifecycle</dt>
        <dd>{record.lifecycleStatus ?? "lifecycle not stated"}</dd>
      </div>
      <div className="flex gap-1">
        <dt className="sr-only">Ratification</dt>
        <dd>{record.ratified ? "ratified" : "no ratification recorded"}</dd>
      </div>
      <div className="flex gap-1">
        <dt className="sr-only">Freshness</dt>
        <dd>freshness: {record.freshness}</dd>
      </div>
      <div className="flex gap-1">
        <dt className="sr-only">Version</dt>
        <dd>v{record.knowledgeVersion}</dd>
      </div>
    </dl>
  );
}

/** Case-folded containment over the fields already on screen. No ranking, no scoring. */
function matches(record: KnowledgeSourceRecord, query: string): boolean {
  const needle = query.trim().toLocaleLowerCase("en");
  if (needle.length === 0) return true;
  return [record.title, record.statement ?? "", record.domainKey, record.factKey, record.scope]
    .join("\n")
    .toLocaleLowerCase("en")
    .includes(needle);
}

export function KnowledgeRecords({
  listing,
  canAuthor = false,
}: {
  listing: KnowledgeListing;
  /** Whether the viewer's durable role band permits authoring. Read access does not imply it. */
  canAuthor?: boolean;
}) {
  const filterId = useId();
  const [query, setQuery] = useState("");

  const records = useMemo(
    () => (listing.status === "read" ? listing.records : []),
    [listing],
  );
  const visible = useMemo(
    () => records.filter((record) => matches(record, query)),
    [records, query],
  );

  /*
   * A read that did not answer is not an organization with nothing in it. This branch may never
   * render a count, a zero, or the word "no records".
   */
  if (listing.status === "unavailable") {
    return (
      <StateBlock
        tone="unavailable"
        title="Your Knowledge could not be read"
        description={
          listing.reason === "no-authorized-tenant-context"
            ? "Sign in to read your organization's Knowledge. This is not a statement that your organization holds none."
            : (listing.detail ??
              "The canonical Knowledge authority did not answer. Nothing was substituted for it, and this is not a count.")
        }
      />
    );
  }

  const { incomplete, truncated } = listing;

  if (records.length === 0) {
    return (
      <StateBlock
        tone="empty"
        title="Your organization holds no Knowledge records yet"
        description="The read succeeded and found nothing. That is the real state — nothing is stored, and nothing was invented to fill the gap."
        action={
          /*
            The way in, IN the absence. An empty state that only reports emptiness makes the reader
            hunt for the capability; this is a plain in-page link, not a control — it grants nothing
            and performs nothing, and the authority to actually write is resolved in that section.
          */
          <a
            href="#add"
            className="text-body font-medium text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
          >
            Add the first record
          </a>
        }
      />
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-meta text-fg-muted">
          {records.length} record{records.length === 1 ? "" : "s"} in force
          {truncated ? " · first page shown, more exist" : ""} · Heby reads these as evidence
        </p>
        <div className="flex min-w-0 items-center gap-2 rounded-lg border border-border bg-surface-sunken px-3">
          <Search className="size-4 shrink-0 text-fg-muted" aria-hidden="true" />
          <label htmlFor={filterId} className="sr-only">
            Filter the records already shown
          </label>
          <input
            id={filterId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter these records…"
            className="h-9 w-full min-w-0 bg-transparent text-meta text-fg outline-none placeholder:text-fg-muted"
          />
        </div>
      </div>

      {/*
        The corpus is not empty; the query is narrow. Saying "no records" here would be a claim
        about the organization rather than about the filter, which is the exact confusion the
        `empty` / `unavailable` split exists to prevent — and it applies to filtering too.
      */}
      {visible.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface-sunken p-4 text-body text-fg-secondary">
          No record matches <span className="font-medium text-fg">“{query}”</span>. Your
          organization still holds {records.length} record{records.length === 1 ? "" : "s"} —
          this filter simply does not reach {records.length === 1 ? "it" : "them"}.
        </p>
      ) : null}

      <ul className="flex flex-col gap-3">
        {visible.map((record) => (
          <li
            key={`${record.domainKey}/${record.scope}/${record.factKey}`}
            className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-surface p-4"
          >
            <div className="flex min-w-0 flex-col gap-1">
              <h3 className="text-title font-semibold text-fg text-balance">{record.title}</h3>
              <p className="font-mono text-meta text-fg-muted">
                {record.domainKey} / {record.factKey} · {record.scope}
              </p>
            </div>
            {record.statement ? (
              <p className="max-w-prose whitespace-pre-wrap break-words text-body text-fg-secondary">
                {record.statement}
              </p>
            ) : (
              <p className="text-body italic text-fg-muted">No statement recorded.</p>
            )}
            <Standing record={record} />
            <KnowledgeVersionControl
              factId={record.factId}
              factKey={record.factKey}
              domainKey={record.domainKey}
              scope={record.scope}
              currentTitle={record.title}
              currentStatement={record.statement}
              knowledgeVersion={record.knowledgeVersion}
              canAuthor={canAuthor}
            />
            {/*
              KR-EXT1 — what this fact is ABOUT, outside Hebun. A sibling of version control and
              deliberately below it: the wording of a fact is Knowledge's own, and what it concerns
              is a separate declaration with its own authority and its own withdrawal.
            */}
            <KnowledgeExternalReferences factId={record.factId} canAuthor={canAuthor} />
          </li>
        ))}
      </ul>

      {incomplete.length > 0 ? (
        <div className="flex flex-col gap-1 rounded-lg border border-warning/40 bg-warning-subtle/20 p-4">
          <p className="text-body font-semibold text-fg">
            {incomplete.length} fact{incomplete.length === 1 ? "" : "s"} with unreadable content
          </p>
          <p className="text-meta text-fg-secondary">
            Their identity exists but their selected content is missing. They are listed apart from
            readable records rather than merged into them.
          </p>
          <ul className="mt-1 flex flex-col gap-0.5 font-mono text-meta text-fg-muted">
            {incomplete.map((stub) => (
              <li key={`${stub.domainKey}/${stub.scope}/${stub.factKey}`}>
                {stub.domainKey} / {stub.factKey} · {stub.scope} · {stub.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
