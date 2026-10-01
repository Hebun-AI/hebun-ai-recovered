import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { ApprovalsDashboard } from "../../src/components/approvals-dashboard/approvals-dashboard";
import { PUBLICATION_STAGE_WORDING } from "../../src/features/action-authorization/content-publication-state";
import { buildQueue, canDecide } from "../../src/features/approvals-dashboard/model";
import type { ApprovalsDashboardRead, DashboardContent } from "../../src/features/approvals-dashboard/read-dashboard.server";
import type { PublicationHistoryEntry } from "../../src/features/action-authorization/content-publication-state";

// Pure test cases only: never business data, seeded rows or browser preview content.
const content: DashboardContent = {
  artifact: { id: "artifact", title: "Test revision", artifactType: "content-draft", lifecycleStatus: "draft", currentRevision: 1, currentRef: "ref", intendedDestination: "youtube", createdAt: "2026-01-01T00:00:00Z" },
  revision: { id: "revision", content: "Test bytes", createdAt: "2026-01-01T00:00:00Z" },
  review: { revisionId: "revision", revisionNo: 1, decision: null, decidedAt: null, decisionId: null, decisionCount: 0 },
  package: { status: "not-found" }, publication: { status: "no-request-recorded", artifactRef: "ref" }, measurement: null,
};
const data: ApprovalsDashboardRead = { content: [content], authorized: true, contentAvailable: true, contentTruncated: false, reviewsAvailable: true, publicationsAvailable: true, purposes: { status: "available", byArtifactId: {} }, purposeWindowFull: false };
const entry = (status: "unknown" | "accepted" | "failed", providerResultId: string | null): PublicationHistoryEntry => ({
  requestId: "request", actionKind: "publish-youtube-video", destination: "youtube", destinationAccountId: "channel", acknowledgesPriorAttemptId: null,
  payloadDigest: "digest", requestStatus: "approved", proposedAt: "2026-01-01T00:00:00Z", approvedAt: "2026-01-01T00:00:00Z", rejectedAt: null, permit: null,
  attempt: { attemptId: "attempt", status, providerResponseClass: null, providerResultId, failureClass: null, startedAt: "2026-01-01T00:00:00Z", completedAt: null }, stage: `execution-${status}`,
});
function renderCard(content: DashboardContent) {
  const html = renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: {} as never }, createElement(ApprovalsDashboard, {
    data: { ...data, content: [content] }, requests: [], permits: [], connected: true, requestsAvailable: true, permitsAvailable: true,
  })));
  return html.match(/<article[\s\S]*?<\/article>/)?.[0] ?? "";
}
const item = (patch: Partial<DashboardContent> = {}) => buildQueue({ ...data, content: [{ ...content, ...patch }] }, [], [])[0];
assert.ok(item().filters.includes("Pending"));
assert.ok(item().filters.includes("Drafts"));
assert.equal(canDecide(item(), true, "approve"), true);
assert.equal(canDecide(item({ review: null }), true, "approve"), false);
assert.equal(item({ review: null }).filters.includes("Pending"), false);
assert.equal(canDecide(item({ revision: null }), true, "approve"), false);
assert.equal(canDecide(item({ artifact: { ...content.artifact, lifecycleStatus: "retired" } }), true, "approve"), false);
assert.equal(canDecide(item({ review: { ...content.review!, decision: "accepted" } }), true, "approve"), false);
for (const status of ["unknown", "accepted", "failed"] as const) {
  const row = item({ publication: { status: "recorded", artifactRef: "ref", entries: [entry(status, status === "accepted" ? "provider-id" : null)], truncated: false } });
  assert.ok(row.kind === "content");
  assert.ok(renderCard(row.content).includes(PUBLICATION_STAGE_WORDING[`execution-${status}`]), "queue must expose the latest publication outcome independently of content review");
  assert.equal(row.filters.includes("Published"), status === "accepted");
  assert.equal(row.filters.includes("Failed"), status === "failed", "unknown must not become failed");
}
// Later uncertainty does not erase prior acceptance, nor become another successful delivery.
const retried = item({ review: { ...content.review!, decision: "accepted" }, publication: {
  status: "recorded", artifactRef: "ref", entries: [entry("accepted", "provider-id"), { ...entry("unknown", null), requestId: "retry" }], truncated: false,
} });
assert.ok(retried.kind === "content");
assert.deepEqual(retried.filters, ["Drafts", "Approved", "Published"]);
assert.ok(renderCard(retried.content).includes(PUBLICATION_STAGE_WORDING["execution-unknown"]));
assert.ok(renderCard(retried.content).includes("Revision accepted"));
for (const stage of ["request-pending", "request-approved-without-permit", "permit-active", "execution-pending", "execution-refused"] as const) {
  const pending = item({ publication: { status: "recorded", artifactRef: "ref", entries: [{ ...entry("unknown", null), attempt: null, stage }], truncated: false } });
  assert.ok(pending.kind === "content");
  assert.equal(pending.filters.includes("Published"), false, `${stage} does not prove publication`);
  assert.ok(renderCard(pending.content).includes(PUBLICATION_STAGE_WORDING[stage]));
}
assert.equal(item({ publication: { status: "recorded", artifactRef: "ref", entries: [entry("accepted", null)], truncated: false } }).filters.includes("Published"), false, "acceptance without provider identity proves no publication");
const unknownPurpose = buildQueue({ ...data, purposes: { status: "unavailable", detail: "unreadable" } }, [], [])[0];
assert.deepEqual(unknownPurpose.work, ["Work relationships unavailable"]);
const multiple = buildQueue({ ...data, purposes: { status: "available", byArtifactId: { artifact: [{ workItemId: "a", title: "First work", declaredState: null }, { workItemId: "b", title: null, declaredState: null }] } } }, [], [])[0];
assert.deepEqual(multiple.work, ["First work", "Recorded work · name unavailable"], "preserve multiple work declarations without invented labels");
console.log("PASS review eligibility, unknown != failed, accepted identity, retirement, and truthful many-to-many work labels");
