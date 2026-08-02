"use client";

import { useMemo, useState } from "react";
import { ArrowRight, ChevronDown, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { TimelineArea, TimelineDateRange, TimelineEvent, TimelineEventType, TimelineFilterState, TimelineImpact, TimelineStatus } from "@/features/timeline-domain/mock";

const dateOptions: TimelineDateRange[] = ["All time", "Today", "Last 7 days", "Last 30 days"];
const typeOptions: Array<TimelineEventType | "All types"> = ["All types", "Decision", "Knowledge", "Organization", "Review", "Publication", "Approval", "Meeting", "Risk", "Agent", "System", "Work", "Policy"];
const impactOptions: Array<TimelineImpact | "All impacts"> = ["All impacts", "Critical", "High", "Medium", "Low"];
const statusOptions: Array<TimelineStatus | "All statuses"> = ["All statuses", "Recorded", "Needs Review", "Pending", "Resolved", "Published"];
const areaOptions: Array<TimelineArea | "All areas"> = ["All areas", "Enterprise", "Finance", "Knowledge", "Operations", "Organization", "Risk", "Sales"];
const attentionOptions: TimelineFilterState["attention"][] = ["Any attention", "Director attention", "No attention required"];
const initialFilters: TimelineFilterState = { dateRange: "All time", eventType: "All types", impact: "All impacts", status: "All statuses", area: "All areas", source: "All sources", attention: "Any attention" };
const impactVariant = { Low: "neutral", Medium: "info", High: "warning", Critical: "error" } as const;
const statusVariant = { Recorded: "neutral", "Needs Review": "warning", Pending: "warning", Resolved: "success", Published: "info" } as const;

function matchesDateRange(event: TimelineEvent, dateRange: TimelineDateRange) {
  if (dateRange === "All time" || dateRange === "Last 30 days") return true;
  if (dateRange === "Today") return event.dateWindow === "Today";
  return event.dateWindow === "Today" || event.dateWindow === "Last 7 days";
}

function TimelineSelect({ id, label, value, options, onChange }: { id: string; label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label htmlFor={id} className="block"><span className="mb-1 block text-[0.65rem] font-semibold uppercase tracking-wider text-fg-muted">{label}</span><span className="relative block"><select id={id} value={value} onChange={(event) => onChange(event.target.value)} className="min-h-10 w-full appearance-none rounded-lg border border-border bg-surface px-3 pr-8 text-xs text-fg outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary-ring/30"><option value={options[0]}>{options[0]}</option>{options.slice(1).map((option) => <option key={option} value={option}>{option}</option>)}</select><ChevronDown className="pointer-events-none absolute right-2.5 top-3 size-4 text-fg-muted" aria-hidden="true" /></span></label>;
}

export function TimelineWorkspace({ events }: { events: TimelineEvent[] }) {
  const [filters, setFilters] = useState<TimelineFilterState>(initialFilters);
  const sources = useMemo(() => ["All sources", ...Array.from(new Set(events.map((event) => event.source.name)))], [events]);
  const filteredEvents = useMemo(() => events.filter((event) => {
    const dateMatch = matchesDateRange(event, filters.dateRange);
    return dateMatch && (filters.eventType === "All types" || event.type === filters.eventType) && (filters.impact === "All impacts" || event.impact === filters.impact) && (filters.status === "All statuses" || event.status === filters.status) && (filters.area === "All areas" || event.areas.includes(filters.area)) && (filters.source === "All sources" || event.source.name === filters.source) && (filters.attention === "Any attention" || (filters.attention === "Director attention" ? event.directorAttention : !event.directorAttention));
  }).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)), [events, filters]);

  return (
    <section aria-labelledby="enterprise-timeline-title" className="rounded-xl border border-border bg-surface">
      <div className="border-b border-border p-4 sm:p-5"><div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div><h2 id="enterprise-timeline-title" className="text-base font-semibold text-fg">Chronological enterprise timeline</h2><p className="mt-1 text-sm text-fg-secondary">What happened, why it matters, who originated it, and what requires attention.</p></div><Badge variant="primary">{filteredEvents.length} of {events.length} events</Badge></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
          <TimelineSelect id="timeline-date" label="Date range" value={filters.dateRange} options={dateOptions} onChange={(value) => setFilters((current) => ({ ...current, dateRange: dateOptions.find((option) => option === value) ?? "All time" }))} />
          <TimelineSelect id="timeline-type" label="Event type" value={filters.eventType} options={typeOptions} onChange={(value) => setFilters((current) => ({ ...current, eventType: typeOptions.find((option) => option === value) ?? "All types" }))} />
          <TimelineSelect id="timeline-impact" label="Impact" value={filters.impact} options={impactOptions} onChange={(value) => setFilters((current) => ({ ...current, impact: impactOptions.find((option) => option === value) ?? "All impacts" }))} />
          <TimelineSelect id="timeline-status" label="Status" value={filters.status} options={statusOptions} onChange={(value) => setFilters((current) => ({ ...current, status: statusOptions.find((option) => option === value) ?? "All statuses" }))} />
          <TimelineSelect id="timeline-area" label="Enterprise area" value={filters.area} options={areaOptions} onChange={(value) => setFilters((current) => ({ ...current, area: areaOptions.find((option) => option === value) ?? "All areas" }))} />
          <TimelineSelect id="timeline-source" label="Source" value={filters.source} options={sources} onChange={(value) => setFilters((current) => ({ ...current, source: sources.find((option) => option === value) ?? "All sources" }))} />
          <TimelineSelect id="timeline-attention" label="Attention" value={filters.attention} options={attentionOptions} onChange={(value) => setFilters((current) => ({ ...current, attention: attentionOptions.find((option) => option === value) ?? "Any attention" }))} />
        </div>
        <button type="button" onClick={() => setFilters(initialFilters)} className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-lg px-2 text-xs font-semibold text-primary transition-colors hover:bg-primary-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"><RotateCcw className="size-3.5" aria-hidden="true" />Reset filters</button>
      </div>
      {filteredEvents.length ? <ol className="divide-y divide-border">{filteredEvents.map((event) => <li key={event.id} className="p-4 sm:p-5"><details className="group"><summary className="cursor-pointer list-none rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-ring"><div className="grid gap-3 xl:grid-cols-[8rem_minmax(16rem,1.3fr)_minmax(12rem,0.8fr)_auto] xl:items-center"><time dateTime={event.occurredAt} className="text-xs font-semibold text-fg">{event.displayTime}</time><div><div className="flex flex-wrap items-center gap-2"><Badge variant="neutral">{event.type}</Badge>{event.directorAttention ? <Badge variant="error">Director attention</Badge> : <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-fg-muted">No action required</span>}</div><h3 className="mt-2 text-sm font-semibold text-fg">{event.title}</h3><p className="mt-1 text-xs leading-5 text-fg-secondary">{event.summary}</p></div><dl className="grid grid-cols-2 gap-2 text-xs"><div><dt className="text-fg-muted">Source</dt><dd className="mt-1 font-medium text-fg">{event.source.name}</dd></div><div><dt className="text-fg-muted">Actor</dt><dd className="mt-1 font-medium text-fg">{event.actor.name}</dd></div><div><dt className="text-fg-muted">Provenance</dt><dd className="mt-1 font-medium text-fg">{event.provenance}</dd></div><div><dt className="text-fg-muted">Related records</dt><dd className="mt-1 font-medium text-fg tabular-nums">{event.relationships.length}</dd></div></dl><div className="flex flex-wrap items-center gap-2 xl:justify-end"><Badge variant={impactVariant[event.impact]}>{event.impact} impact</Badge><Badge variant={statusVariant[event.status]}>{event.status}</Badge><span className="flex items-center gap-1 text-xs font-semibold text-primary">Inspect <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" aria-hidden="true" /></span></div></div></summary>
                <div className="mt-5 grid gap-5 border-t border-border pt-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]"><div><h4 className="text-xs font-semibold uppercase tracking-wider text-fg-muted">Enterprise relationships</h4><ul className="mt-3 grid gap-2 sm:grid-cols-2">{event.relationships.map((relationship) => <li key={`${relationship.kind}-${relationship.label}`} className="rounded-lg border border-border bg-surface-sunken/40 p-3"><p className="text-[0.65rem] font-semibold uppercase tracking-wider text-primary">{relationship.kind}</p><p className="mt-1 text-xs font-semibold text-fg">{relationship.label}</p><p className="mt-1 flex items-center gap-1 text-[0.7rem] text-fg-secondary"><ArrowRight className="size-3" aria-hidden="true" />{relationship.relationship}</p></li>)}</ul><p className="mt-3 text-[0.7rem] text-fg-muted">Conceptual relationships only · no graph resolution</p></div><dl className="space-y-3 text-xs"><div><dt className="font-semibold text-fg-muted">Affected areas</dt><dd className="mt-1 text-fg">{event.areas.join(" · ")}</dd></div><div><dt className="font-semibold text-fg-muted">Related decisions</dt><dd className="mt-1 text-fg">{event.relatedDecisions.length ? event.relatedDecisions.join(" · ") : "None recorded"}</dd></div><div><dt className="font-semibold text-fg-muted">Related knowledge</dt><dd className="mt-1 text-fg">{event.relatedKnowledge.join(" · ")}</dd></div><div><dt className="font-semibold text-fg-muted">Organization entities</dt><dd className="mt-1 text-fg">{event.relatedOrganization.join(" · ")}</dd></div><div><dt className="font-semibold text-fg-muted">Follow-up state</dt><dd className="mt-1 text-fg">{event.followUp}</dd></div></dl></div>
              </details></li>)}</ol> : <div className="p-10 text-center"><p className="text-sm font-semibold text-fg">No events match these filters.</p><p className="mt-1 text-xs text-fg-secondary">Reset or broaden the local filter selection.</p></div>}
    </section>
  );
}
