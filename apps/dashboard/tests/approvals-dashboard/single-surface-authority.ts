import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { ApprovalsDashboard } from "../../src/components/approvals-dashboard/approvals-dashboard";
import type { ApprovalsDashboardRead } from "../../src/features/approvals-dashboard/read-dashboard.server";
import type { ActionPermitView, PendingActionRequestView } from "../../src/features/action-authorization/read-action-authorizations.server";

/*
 * `/approvals` has ONE approval surface. It must keep what the surface it replaced gave every
 * member — the released request card and permit row, whose acts the server checks one by one — and
 * it must not become a second door to the Media Asset authority.
 *
 * Test-only shapes exercise rendering; nothing here is a business record and nothing is persisted.
 */
const DIR = "src/components/approvals-dashboard";
const code = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

const request = (over: Partial<PendingActionRequestView>): PendingActionRequestView => ({
  requestId: "req-1", actionKind: "record-work", toolId: "tool", sideEffect: "CONSEQUENTIAL_MUTATION",
  reversibility: "reversible", targetKind: null, targetRef: null, targetLabel: "Human proposal",
  expectedEffect: "Records one work item.", consequences: ["One work item is recorded."], parameters: [],
  locks: [], evidence: { status: "none" }, proposedByActorType: "human", proposedByAgentName: null,
  proposedByAgentInService: null, payloadDigest: "digest", proposedAt: "2026-01-01T00:00:00.000Z",
  purposeWorkTitle: null, purposeUnresolved: false, proposalRationale: null, ...over,
} as PendingActionRequestView);

const permit = {
  permitId: "permit-1", actionKind: "record-work", state: "active", targetLabel: "Active permit",
  issuedAt: "2026-01-02T00:00:00.000Z", expiresAt: "2026-01-03T00:00:00.000Z", consumedAt: null,
  executionStatus: null, providerMessageId: null, revocationReason: null, proposedByActorType: "human",
  standingAuthorizationId: null,
} as unknown as ActionPermitView;

const data = (authorized: boolean): ApprovalsDashboardRead => ({
  content: [], authorized, contentAvailable: true, contentTruncated: false, reviewsAvailable: true,
  publicationsAvailable: true, purposes: { status: "unavailable" } as ApprovalsDashboardRead["purposes"], purposeWindowFull: false,
});

const render = (authorized: boolean, requests: PendingActionRequestView[], permits: ActionPermitView[]) =>
  renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: {} as never }, createElement(ApprovalsDashboard, {
    data: data(authorized), requests, permits, connected: true, requestsAvailable: true, permitsAvailable: true,
    workOptions: [{ workItemId: "work-1", title: "Recorded work" }],
  })));

function main() {
  /* ── 1 · A member WITHOUT Governance authority still gets the released request card ── */
  {
    const html = render(false, [request({})], []);
    assert.match(html, /Authorize this action/, "the released card is rendered; the server, not this surface, refuses the act");
    assert.match(html, /Declare purpose/, "purpose declaration needs no Governance authority and is not hidden behind it");
    assert.match(html, /proposed by human/, "the proposer class is shown before any control");
    assert.ok(!html.includes("Proposal rationale unavailable"), "a human proposal has no rationale slot to be unavailable");
    assert.match(html, /queue and bulk decision controls are disabled/, "only the queue and bulk controls are closed by this flag");
    assert.match(html, /disabled=""[^>]*>[^<]*<svg[\s\S]*?Approve All/, "Approve All stays closed without Governance authority");
  }

  /* ── 2 · An agent proposal with no stored rationale says so, as the released card does ── */
  {
    const html = render(false, [request({ proposedByActorType: "agent", proposedByAgentName: "Heby", proposedByAgentInService: true })], []);
    assert.match(html, /proposed by Heby/);
    assert.match(html, /Proposal rationale unavailable/);
  }

  /* ── 3 · Execute is not closed by the Governance flag: its authority is the executor's own ── */
  {
    const html = render(false, [], [permit]);
    const execute = /<button[^>]*>Execute now<\/button>/.exec(html)?.[0] ?? "";
    assert.ok(execute.length > 0, "the released permit row renders its Execute control");
    assert.ok(!/\sdisabled=""/.test(execute), "and this surface does not disable it for want of Governance authority");
  }

  /* ── 4 · The source: no general authority flag gates the card or the row ── */
  const dashboard = code(`${DIR}/approvals-dashboard.tsx`);
  assert.ok(!/data\.authorized[^;\n]{0,40}<ul><RequestCard/.test(dashboard), "the request card is not gated on data.authorized");
  assert.ok(!/controlsDisabled=\{[^}]*authorized/.test(dashboard), "the permit row's controls are not gated on data.authorized");

  /* ── 5 · Approvals is not a Media Asset door: the media1 firewall's own pattern finds nothing ── */
  for (const file of readdirSync(path.join(process.cwd(), DIR))) {
    const source = code(`${DIR}/${file}`);
    assert.ok(!/media[-_]?asset|mediaAsset|requestMediaGeneration/i.test(source), `${file} names no Media Asset path`);
    assert.ok(!/readMedia(Asset|Video)Action/.test(source), `${file} opens no media read grant`);
  }
  console.log("PASS one approval surface keeps per-act authority on the server and opens no Media Asset door");
}
main();
