"use client";

import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionShell } from "@/components/director-dashboard/section-shell";
import type {
  ListSortField,
  SectionListQuery,
  SectionListView,
} from "@/features/director-dashboard-navigation";
import { utcInstant } from "@/lib/format";

const sortFields: readonly { readonly field: ListSortField; readonly label: string }[] = [
  { field: "label", label: "Name" },
  { field: "value", label: "Value" },
  { field: "status", label: "Status" },
];

function stateCopy(view: SectionListView): { readonly title: string; readonly description: string } {
  if (view.state === "unavailable") {
    return {
      title: "Records are unavailable",
      description: "The current dashboard snapshot cannot provide the records behind this section.",
    };
  }
  if (view.state === "unsupported") {
    return {
      title: "No records to explore",
      description: "This section has no producer yet, so there is nothing behind it to open.",
    };
  }
  return {
    title: "No records in this snapshot",
    description: "This section reported no records when the current snapshot was taken.",
  };
}

export function SectionDetailList({ view, query, onQueryChange, onClose, onOpenRecord }: {
  readonly view: SectionListView;
  readonly query: SectionListQuery;
  readonly onQueryChange: (next: SectionListQuery) => void;
  readonly onClose: () => void;
  /** Omit to render the list without record drill-down. */
  readonly onOpenRecord?: (recordId: string) => void;
}) {
  const empty = stateCopy(view);
  const filtered = view.rows.length !== view.totalCount;

  return (
    <SectionShell
      title={view.label}
      description={`${view.totalCount} ${view.totalCount === 1 ? "record" : "records"} in the current snapshot.`}
      eyebrow="Section Records"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            <ArrowLeft className="size-4" /> Back to overview
          </Button>
          <Badge variant={view.snapshotFreshness === "fresh" ? "success" : "neutral"}>
            Snapshot {view.snapshotFreshness}
          </Badge>
          <Badge variant="neutral">{view.evidenceCount} evidence</Badge>
          {view.snapshotTimestamp ? (
            <span className="text-xs text-fg-muted">
              Snapshot {utcInstant(view.snapshotTimestamp)}
            </span>
          ) : null}
        </div>

        {view.totalCount > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={query.search ?? ""}
              onChange={(event) => onQueryChange({ ...query, search: event.target.value })}
              placeholder="Search records"
              aria-label={`Search ${view.label} records`}
              className="h-8 min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 text-sm text-fg placeholder:text-fg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
            />
            <select
              value={query.status ?? ""}
              onChange={(event) => onQueryChange({ ...query, status: event.target.value })}
              aria-label={`Filter ${view.label} by status`}
              className="h-8 rounded-lg border border-border bg-surface px-2 text-sm text-fg"
            >
              <option value="">All statuses</option>
              {view.statusFacets.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
            <select
              value={view.query.sortField}
              onChange={(event) => onQueryChange({ ...query, sortField: event.target.value as ListSortField })}
              aria-label={`Sort ${view.label} by field`}
              className="h-8 rounded-lg border border-border bg-surface px-2 text-sm text-fg"
            >
              {sortFields.map(({ field, label }) => (
                <option key={field} value={field}>Sort by {label}</option>
              ))}
            </select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onQueryChange({ ...query, sortDirection: view.query.sortDirection === "asc" ? "desc" : "asc" })}
              aria-label="Toggle sort direction"
            >
              {view.query.sortDirection === "asc" ? "Ascending" : "Descending"}
            </Button>
          </div>
        ) : null}

        {view.rows.length === 0 ? (
          <EmptyState
            title={view.totalCount > 0 ? "No records match this filter" : empty.title}
            description={view.totalCount > 0
              ? "Adjust the search or status filter to see records from this snapshot."
              : empty.description}
            eyebrow={view.state}
            className="min-h-32 p-4"
          />
        ) : (
          <div className="divide-y divide-border">
            {filtered ? (
              <p className="pb-2 text-xs text-fg-muted">
                Showing {view.rows.length} of {view.totalCount} records.
              </p>
            ) : null}
            {view.rows.map((row) => {
              const body = (
                <>
                  <div className="min-w-0 text-left">
                    <p className="truncate text-sm text-fg">{row.label}</p>
                    <p className="truncate text-xs text-fg-muted">{row.value}</p>
                  </div>
                  <Badge variant="neutral">{row.status}</Badge>
                </>
              );
              const shared = "flex w-full items-center justify-between gap-3 py-2 first:pt-0 last:pb-0";
              return onOpenRecord ? (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => onOpenRecord(row.id)}
                  aria-label={`Open record ${row.label}`}
                  className={`${shared} rounded-md text-left transition-colors hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring`}
                >
                  {body}
                </button>
              ) : (
                <div key={row.id} className={shared}>{body}</div>
              );
            })}
          </div>
        )}
      </div>
    </SectionShell>
  );
}
