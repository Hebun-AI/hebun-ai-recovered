/*
 * Knowledge records (K2) — the tenant's real canonical Knowledge, read through the K1 path.
 *
 * This renders the SAME `KnowledgeListing` the `/knowledge` and `/source` slash commands read and
 * that Heby grounds on. There is no K2-specific read: if something appears here, Heby can cite it,
 * and if Heby cannot cite it, it does not appear here.
 *
 * Every record shows its own standing — authority class, lifecycle, whether a ratification is
 * actually recorded, and derived freshness — rather than a single reassuring badge. Nothing here
 * displays a confidence figure, a quality score, or a verification mark, because no authority in
 * Hebun owns one.
 *
 * Server component. Content is rendered as TEXT through React's escaping; a statement containing
 * markup or a command is displayed, never executed.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    <dl className="flex flex-wrap gap-x-4 gap-y-1 text-[0.7rem] text-fg-muted">
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

export function KnowledgeRecords({
  listing,
  canAuthor = false,
}: {
  listing: KnowledgeListing;
  /** Whether the viewer's durable role band permits authoring. Read access does not imply it. */
  canAuthor?: boolean;
}) {
  if (listing.status === "unavailable") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Organizational Knowledge</CardTitle>
          <CardDescription>
            {listing.reason === "no-authorized-tenant-context"
              ? "Sign in to read your organization's Knowledge."
              : (listing.detail ?? "Knowledge could not be read. Nothing was substituted for it.")}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const { records, incomplete, truncated } = listing;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organizational Knowledge</CardTitle>
        <CardDescription>
          {records.length === 0
            ? "Your organization holds no Knowledge records yet. That is the real state — nothing is stored, and nothing was invented to fill the gap."
            : `${records.length} record${records.length === 1 ? "" : "s"}${truncated ? " (first page shown; more exist)" : ""}. Heby reads these as evidence.`}
        </CardDescription>
      </CardHeader>

      {records.length > 0 || incomplete.length > 0 ? (
        <CardContent className="flex flex-col gap-3">
          <ul className="flex flex-col gap-3">
            {records.map((record) => (
              <li
                key={`${record.domainKey}/${record.scope}/${record.factKey}`}
                className="flex min-w-0 flex-col gap-1.5 rounded-lg border border-border bg-surface-raised/40 p-3"
              >
                <p className="flex flex-wrap items-baseline gap-x-2 text-sm font-medium text-fg">
                  {record.title}
                  <span className="font-mono text-[0.7rem] text-fg-muted">
                    {record.domainKey} / {record.factKey} · {record.scope}
                  </span>
                </p>
                {record.statement ? (
                  <p className="whitespace-pre-wrap break-words text-xs leading-5 text-fg-secondary">
                    {record.statement}
                  </p>
                ) : (
                  <p className="text-xs italic text-fg-muted">No statement recorded.</p>
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
              </li>
            ))}
          </ul>

          {incomplete.length > 0 ? (
            <div className="flex flex-col gap-1 rounded-lg border border-warning/40 bg-warning-subtle/20 p-3">
              <p className="text-xs font-semibold text-fg">
                {incomplete.length} fact{incomplete.length === 1 ? "" : "s"} with unreadable content
              </p>
              <p className="text-[0.7rem] text-fg-secondary">
                Their identity exists but their selected content is missing. They are listed apart
                from readable records rather than merged into them.
              </p>
              <ul className="mt-1 flex flex-col gap-0.5 font-mono text-[0.7rem] text-fg-muted">
                {incomplete.map((stub) => (
                  <li key={`${stub.domainKey}/${stub.scope}/${stub.factKey}`}>
                    {stub.domainKey} / {stub.factKey} · {stub.scope} · {stub.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      ) : null}
    </Card>
  );
}
