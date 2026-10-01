import type { ActionPermitView, PendingActionRequestView } from "@/features/action-authorization/read-action-authorizations.server";
import { isPublicationActionKind, PUBLICATION_DESTINATION } from "@/features/action-authorization/content-publication-state";
import type { ApprovalsDashboardRead, DashboardContent } from "./read-dashboard.server";

export type Filter = "All" | "Pending" | "Approved" | "Published" | "Failed" | "Drafts";
export type Intent = "approve" | "changes" | "reject";
export type QueueItem = {
  id: string; title: string; channel: string | null; createdAt: string;
  filters: readonly Filter[]; status: string; work: string[];
} & (
  | { kind: "request"; request: PendingActionRequestView }
  | { kind: "content"; content: DashboardContent }
  | { kind: "permit"; permit: ActionPermitView }
);
const channelOf = (kind: string) => isPublicationActionKind(kind) ? PUBLICATION_DESTINATION[kind] : null;
export function buildQueue(data: ApprovalsDashboardRead, requests: readonly PendingActionRequestView[], permits: readonly ActionPermitView[]): QueueItem[] {
  return [
    ...requests.map((request): QueueItem => ({
      kind: "request", id: `request:${request.requestId}`, request,
      title: request.targetLabel ?? request.expectedEffect, channel: channelOf(request.actionKind),
      createdAt: request.proposedAt, filters: ["Pending"], status: "Awaiting authorization",
      work: [request.purposeWorkTitle ?? (request.purposeUnresolved ? "Work relationship unavailable" : "Purpose not declared")],
    })),
    ...data.content.map((content): QueueItem => {
      const entries = content.publication?.status === "recorded" ? content.publication.entries : [];
      const latest = entries.at(-1);
      const accepted = entries.some((e) => e.attempt?.status === "accepted" && e.attempt.providerResultId !== null);
      const failed = latest?.stage === "execution-failed" || latest?.stage === "execution-refused";
      const reviewed = content.review?.decision === "accepted";
      const draft = content.artifact.lifecycleStatus === "draft";
      const links = data.purposes.status === "available" ? data.purposes.byArtifactId[content.artifact.id] ?? [] : null;
      return {
        kind: "content", id: `content:${content.artifact.currentRef}`, content,
        title: content.artifact.title, channel: content.artifact.intendedDestination,
        createdAt: content.artifact.createdAt,
        filters: [...(draft ? ["Drafts" as const] : []), ...(draft && content.review && !reviewed ? ["Pending" as const] : []), ...(reviewed ? ["Approved" as const] : []), ...(accepted ? ["Published" as const] : []), ...(failed ? ["Failed" as const] : [])],
        status: content.artifact.lifecycleStatus === "retired" ? "Retired" : content.review === null ? "Review unavailable" : reviewed ? "Revision accepted" : content.review.decision === "changes-requested" ? "Changes requested" : "Awaiting content review",
        work: links === null ? ["Work relationships unavailable"] : links.length ? links.map((link) => link.title ?? "Recorded work · name unavailable") : [data.purposeWindowFull ? "No work link in the loaded window" : "No declared work link"],
      };
    }),
    ...permits.map((permit): QueueItem => ({
      kind: "permit", id: `permit:${permit.permitId}`, permit,
      title: permit.targetLabel ?? permit.actionKind, channel: channelOf(permit.actionKind), createdAt: permit.issuedAt,
      filters: ["Approved", ...(permit.executionStatus === "failed" || permit.executionStatus === "refused" ? ["Failed" as const] : [])],
      status: `Permit ${permit.state}${permit.executionStatus ? ` · ${permit.executionStatus}` : ""}`,
      work: ["Work relationship not projected by the permit reader"],
    })),
  ];
}
export function filterQueue(items: readonly QueueItem[], filter: Filter, channel: string, search: string, order: "newest" | "oldest") {
  const query = search.trim().toLocaleLowerCase();
  return items.filter((item) => (filter === "All" || item.filters.includes(filter)) &&
    (channel === "all" || item.channel === channel) &&
    [item.title, item.channel ?? "", item.status, ...item.work].join(" ").toLocaleLowerCase().includes(query))
    .sort((a, b) => (order === "newest" ? -1 : 1) * a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}
// Display eligibility only. The existing server actions independently resolve session + authority.
export function canDecide(item: QueueItem, authorized: boolean, intent: Intent): boolean {
  if (!authorized || item.kind === "permit") return false;
  if (item.kind === "request") return intent !== "changes";
  return item.content.artifact.lifecycleStatus === "draft" && item.content.revision !== null && item.content.review !== null &&
    (intent !== "approve" || item.content.review.decision !== "accepted");
}
export interface DecisionOutcome { id: string; title: string; status: "success" | "refused" | "unknown" | "skipped"; detail: string }
// Deliberately sequential; every item crosses its existing single-item authority boundary.
// A lost response is UNKNOWN (the write may have committed), never a claimed failure or auto-retry.
export async function decideVisibleItems(items: readonly QueueItem[], authorized: boolean, intent: Intent,
  decide: (item: QueueItem) => Promise<{ ok: boolean; detail: string }>): Promise<DecisionOutcome[]> {
  const outcomes: DecisionOutcome[] = [];
  for (const item of [...new Map(items.map((item) => [item.id, item])).values()]) {
    if (!canDecide(item, authorized, intent)) {
      outcomes.push({ id: item.id, title: item.title, status: "skipped", detail: "Not eligible for this decision." });
      continue;
    }
    try {
      const result = await decide(item);
      outcomes.push({ id: item.id, title: item.title, status: result.ok ? "success" : "refused", detail: result.detail });
    } catch {
      outcomes.push({ id: item.id, title: item.title, status: "unknown", detail: "Response unavailable. Refresh and inspect the recorded state before trying again." });
    }
  }
  return outcomes;
}
