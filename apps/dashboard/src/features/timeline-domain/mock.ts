import { ENTERPRISE_PROJECTION_VERSION } from "@/features/enterprise-projections";
import type { TimelineActorProjection, TimelineArea, TimelineEventProjection, TimelineEventType, TimelineImpact, TimelineIntegrityProjection, TimelineOverviewMetricProjection, TimelineOverviewProjection, TimelineProvenance, TimelineRelationshipProjection, TimelineSourceProjection, TimelineStatus } from "@/features/enterprise-projections";
import type { TimelineDateRange, TimelineFilterState } from "@/features/timeline-domain/view-model";

export type TimelineSource = TimelineSourceProjection;
export type TimelineActor = TimelineActorProjection;
export type TimelineRelationship = TimelineRelationshipProjection;
export type TimelineEvent = TimelineEventProjection;
export type TimelineIntegrityMetric = TimelineIntegrityProjection;
export type TimelineOverviewMetric = TimelineOverviewMetricProjection;
export type { TimelineArea, TimelineDateRange, TimelineEventType, TimelineFilterState, TimelineImpact, TimelineProvenance, TimelineStatus };

export const timelineOverview: TimelineOverviewMetric[] = [
  { label: "Events Today", value: "4", detail: "Across six enterprise areas", state: "Healthy" },
  { label: "Decisions Recorded", value: "3", detail: "Two require Director review", state: "Watch" },
  { label: "Knowledge Changes", value: "12", detail: "Four verified publications", state: "Healthy" },
  { label: "Organization Changes", value: "2", detail: "One ownership gap surfaced", state: "Watch" },
  { label: "Pending Follow-ups", value: "5", detail: "Two are past their target", state: "Attention" },
  { label: "Critical Events", value: "1", detail: "Compliance evidence unresolved", state: "Attention" },
  { label: "Timeline Health", value: "91%", detail: "Chronology and attribution coherent", state: "Healthy" },
  { label: "Provenance Coverage", value: "94%", detail: "One event remains incomplete", state: "Watch" },
];

export const timelineEvents: TimelineEvent[] = [
  { id: "TL-208", occurredAt: "2026-08-02T09:30:00+03:00", displayTime: "Today · 09:30", dateWindow: "Today", title: "Enterprise readiness review completed", type: "Meeting", summary: "Executive leadership confirmed the launch dependency and assigned a bounded evidence review.", source: { name: "Director Office", kind: "Director" }, actor: { name: "Şenol Sevim", role: "Enterprise Director" }, areas: ["Enterprise", "Operations", "Risk"], impact: "High", status: "Recorded", provenance: "Verified", directorAttention: false, relationships: [{ kind: "Organization", label: "Executive Leadership", relationship: "participated in" }, { kind: "Decision", label: "D-204 Launch readiness", relationship: "informed" }, { kind: "Knowledge", label: "Enterprise readiness brief", relationship: "produced" }], relatedDecisions: ["D-204 · Launch readiness"], relatedKnowledge: ["Enterprise readiness brief"], relatedOrganization: ["Executive Leadership", "Operations"], followUp: "Evidence plan review due today at 16:00" },
  { id: "TL-207", occurredAt: "2026-08-02T08:45:00+03:00", displayTime: "Today · 08:45", dateWindow: "Today", title: "Compliance evidence gap escalated", type: "Risk", summary: "A missing control-evidence owner reduced confidence in enterprise launch readiness.", source: { name: "Risk & Legal", kind: "Department" }, actor: { name: "Deniz Işık", role: "Compliance Lead" }, areas: ["Risk", "Operations"], impact: "Critical", status: "Needs Review", provenance: "Verified", directorAttention: true, relationships: [{ kind: "Policy", label: "SOC 2 evidence policy", relationship: "violates" }, { kind: "Work", label: "Control evidence review", relationship: "blocks" }, { kind: "Organization", label: "Risk & Legal", relationship: "originated in" }], relatedDecisions: ["D-204 · Launch readiness"], relatedKnowledge: ["SOC 2 control evidence pack"], relatedOrganization: ["Risk & Legal", "Operations"], followUp: "Director review required before launch approval" },
  { id: "TL-206", occurredAt: "2026-08-02T08:10:00+03:00", displayTime: "Today · 08:10", dateWindow: "Today", title: "Knowledge governance policy published", type: "Policy", summary: "The Knowledge Domain received a reviewed policy for ownership, trust, freshness, and publication boundaries.", source: { name: "Knowledge", kind: "Department" }, actor: { name: "İpek Çetin", role: "Chief Knowledge Officer" }, areas: ["Knowledge", "Enterprise"], impact: "Medium", status: "Published", provenance: "Verified", directorAttention: false, relationships: [{ kind: "Knowledge", label: "Knowledge governance policy v2", relationship: "published" }, { kind: "Organization", label: "All Departments", relationship: "governs" }, { kind: "Policy", label: "Publishing cadence", relationship: "defines" }], relatedDecisions: ["D-199 · Knowledge publishing cadence"], relatedKnowledge: ["Knowledge governance policy v2"], relatedOrganization: ["Knowledge", "All Departments"], followUp: "Department acknowledgements due in seven days" },
  { id: "TL-205", occurredAt: "2026-08-02T07:40:00+03:00", displayTime: "Today · 07:40", dateWindow: "Today", title: "Revenue opportunity moved to approval", type: "Approval", summary: "A retention proposal representing $420K ARR reached the Director review boundary.", source: { name: "Sales", kind: "Department" }, actor: { name: "Leyla Şahin", role: "Chief Revenue Officer" }, areas: ["Sales", "Finance"], impact: "High", status: "Pending", provenance: "Attributed", directorAttention: true, relationships: [{ kind: "Decision", label: "D-207 Retention experiment", relationship: "awaits" }, { kind: "Knowledge", label: "Customer retention evidence", relationship: "supported by" }, { kind: "Organization", label: "Sales", relationship: "owned by" }], relatedDecisions: ["D-207 · Retention experiment"], relatedKnowledge: ["Customer retention evidence"], relatedOrganization: ["Sales", "Finance"], followUp: "Director approval requested by tomorrow" },
  { id: "TL-204", occurredAt: "2026-08-01T16:20:00+03:00", displayTime: "Yesterday · 16:20", dateWindow: "Last 7 days", title: "Organization ownership gap recorded", type: "Organization", summary: "Legal leadership coverage remains interim and overlaps with the Director Office.", source: { name: "Organization Domain", kind: "System" }, actor: { name: "Organization Review", role: "Conceptual projection" }, areas: ["Organization", "Risk"], impact: "Medium", status: "Needs Review", provenance: "Attributed", directorAttention: true, relationships: [{ kind: "Organization", label: "Risk & Legal", relationship: "affects" }, { kind: "Work", label: "Leadership capacity review", relationship: "creates" }], relatedDecisions: ["D-202 · Interim legal ownership"], relatedKnowledge: ["Organization responsibility map"], relatedOrganization: ["Risk & Legal", "Director Office"], followUp: "Confirm interim accountable owner" },
  { id: "TL-203", occurredAt: "2026-08-01T14:05:00+03:00", displayTime: "Yesterday · 14:05", dateWindow: "Last 7 days", title: "Customer research synthesis added", type: "Knowledge", summary: "Twelve customer interviews were synthesized into a reviewed enterprise knowledge asset.", source: { name: "Knowledge Domain", kind: "System" }, actor: { name: "Research", role: "Knowledge owner" }, areas: ["Knowledge", "Sales"], impact: "Medium", status: "Published", provenance: "Verified", directorAttention: false, relationships: [{ kind: "Knowledge", label: "Customer expansion synthesis", relationship: "added" }, { kind: "Decision", label: "D-207 Retention experiment", relationship: "informs" }, { kind: "Agent", label: "Research advisor", relationship: "observed by" }], relatedDecisions: ["D-207 · Retention experiment"], relatedKnowledge: ["Customer expansion synthesis", "12 interview records"], relatedOrganization: ["Research", "Sales"], followUp: "No follow-up required" },
  { id: "TL-202", occurredAt: "2026-07-30T11:15:00+03:00", displayTime: "Jul 30 · 11:15", dateWindow: "Last 7 days", title: "Knowledge freshness audit published", type: "Review", summary: "Four enterprise areas were identified as needing fresher evidence.", source: { name: "Knowledge", kind: "Department" }, actor: { name: "Ada Kılıç", role: "Enterprise Knowledge Lead" }, areas: ["Knowledge", "Enterprise"], impact: "Medium", status: "Published", provenance: "Verified", directorAttention: false, relationships: [{ kind: "Knowledge", label: "Freshness audit", relationship: "evaluated" }, { kind: "Organization", label: "Four enterprise areas", relationship: "affects" }], relatedDecisions: [], relatedKnowledge: ["Knowledge freshness audit"], relatedOrganization: ["Knowledge", "Risk & Legal", "People", "Sales"], followUp: "Domain owners to update evidence this month" },
  { id: "TL-201", occurredAt: "2026-07-18T10:00:00+03:00", displayTime: "Jul 18 · 10:00", dateWindow: "Last 30 days", title: "Operating brief attribution incomplete", type: "Publication", summary: "The Q3 operating brief was published with one supporting source awaiting attribution.", source: { name: "Director Office", kind: "Director" }, actor: { name: "Executive Operations", role: "Brief owner" }, areas: ["Enterprise", "Operations"], impact: "Low", status: "Recorded", provenance: "Incomplete", directorAttention: false, relationships: [{ kind: "Knowledge", label: "Q3 operating brief", relationship: "published" }, { kind: "System", label: "Timeline projection", relationship: "recorded by" }], relatedDecisions: ["D-195 · Q3 priorities"], relatedKnowledge: ["Q3 operating brief"], relatedOrganization: ["Director Office"], followUp: "Attribute the remaining source" },
];

export const timelineIntegrity: TimelineIntegrityMetric[] = [
  { label: "Provenance completeness", value: "94%", detail: "One publication has incomplete attribution", state: "Watch" },
  { label: "Unattributed events", value: "1", detail: "Below the executive tolerance threshold", state: "Watch" },
  { label: "Stale follow-ups", value: "2", detail: "Ownership review and evidence plan", state: "Attention" },
  { label: "Missing relationships", value: "3", detail: "Low-impact records need additional context", state: "Watch" },
  { label: "Duplicate-event risk", value: "Low", detail: "No likely duplicates in this projection", state: "Healthy" },
  { label: "Unresolved critical events", value: "1", detail: "Compliance evidence gap requires review", state: "Attention" },
];

export const recentTimelineDecisions = [
  { id: "D-207", title: "Retention experiment", state: "Director review", relationship: "Informed by customer evidence" },
  { id: "D-204", title: "Enterprise launch readiness", state: "Blocked", relationship: "Affected by compliance evidence" },
  { id: "D-202", title: "Interim legal ownership", state: "Needs review", relationship: "Connected to organization coverage" },
] as const;

export const recentTimelineKnowledge = [
  { title: "Knowledge governance policy v2", source: "Policies", change: "Published today" },
  { title: "Customer expansion synthesis", source: "Internal Documents", change: "Added yesterday" },
  { title: "Knowledge freshness audit", source: "Reviews", change: "Published Jul 30" },
] as const;

export const hebyTimelineSuggestions = [
  "Summarize today’s enterprise events",
  "Show unresolved critical events",
  "Explain what changed after decision D-204",
] as const;

export const timelineProjection: TimelineOverviewProjection = {
  projectionId: "timeline-overview",
  version: ENTERPRISE_PROJECTION_VERSION,
  generatedAt: "2026-08-02T09:30:00+03:00",
  source: { kind: "Mock Adapter", name: "Enterprise Timeline" },
  freshness: "Current",
  status: "Ready",
  overview: timelineOverview,
  events: timelineEvents,
  integrity: timelineIntegrity,
};
