import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { ApprovalsDashboard } from "../../src/components/approvals-dashboard/approvals-dashboard";
import { RequestCard } from "../../src/components/decision-workspace/action-authorizations";
import type { ApprovalsDashboardRead } from "../../src/features/approvals-dashboard/read-dashboard.server";
import type { PendingActionRequestView } from "../../src/features/action-authorization/read-action-authorizations.server";

/*
 * AP5-APPROVALS-RATIONALE-LABEL-1 — an agent's rationale is titled with the agent that proposed it.
 *
 * The title comes from `proposedByAgentName`, the identity authority's answer, and from nothing
 * else: a name when it answered, the neutral "Agent proposal rationale" when it did not. Never
 * "Heby" by default, never an identifier. Everything around the title — the rationale text, its
 * caption, the controls — must be what it was.
 *
 * Test-only shapes; nothing here is a business record and nothing is persisted.
 */
const request = (over: Partial<PendingActionRequestView>): PendingActionRequestView => ({
  requestId: "req-1", actionKind: "record-work", toolId: "tool", sideEffect: "CONSEQUENTIAL_MUTATION",
  reversibility: "reversible", targetKind: null, targetRef: null, targetLabel: "Planned work",
  expectedEffect: "Records one work item.", consequences: ["One work item is recorded."], parameters: [],
  locks: [], evidence: { status: "none" }, proposedByActorType: "agent", proposedByAgentName: null,
  proposedByAgentInService: null, payloadDigest: "digest", proposedAt: "2026-01-01T00:00:00.000Z",
  purposeWorkTitle: null, purposeUnresolved: false, proposalRationale: "Track the planned check.", ...over,
} as PendingActionRequestView);

const card = (item: PendingActionRequestView) =>
  renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: {} as never },
    createElement(RequestCard, { item, waitingFor: null, workOptions: [], instagramPreviews: null })));

const dashboard = (item: PendingActionRequestView) =>
  renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: {} as never }, createElement(ApprovalsDashboard, {
    data: { content: [], authorized: true, contentAvailable: true, contentTruncated: false, reviewsAvailable: true,
      publicationsAvailable: true, purposes: { status: "unavailable" }, purposeWindowFull: false } as unknown as ApprovalsDashboardRead,
    requests: [item], permits: [], connected: true, requestsAvailable: true, permitsAvailable: true, workOptions: [],
  })));

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const buttons = (html: string) => (html.match(/<button[^>]*>/g) ?? []).join("\n");
const without = (html: string, label: string) => html.split(label).join("§");

function main() {
  const engineering = request({ proposedByAgentName: "Engineering Agent", proposedByAgentInService: true });
  const heby = request({ proposedByAgentName: "Heby", proposedByAgentInService: true });
  const unnamed = request({});

  for (const [surface, render] of [["RequestCard", card], ["/approvals", dashboard]] as const) {
    /* ── 1 · Engineering Agent ── */
    const e = render(engineering);
    assert.ok(e.includes("Engineering Agent’s proposal rationale"), `${surface}: titled with the proposing agent`);
    assert.ok(!e.includes("Heby’s proposal rationale"), `${surface}: an Engineering Agent proposal is not titled Heby's`);

    /* ── 2 · Heby ── */
    const h = render(heby);
    assert.ok(h.includes("Heby’s proposal rationale"), `${surface}: Heby's own proposal keeps its name`);

    /* ── 3 · No name from the identity authority: neutral, never inferred, never an id ── */
    const u = render(unnamed);
    assert.ok(u.includes("Agent proposal rationale"), `${surface}: an unnamed agent gets the neutral title`);
    assert.ok(!u.includes("’s proposal rationale"), `${surface}: no name is inferred`);
    assert.ok(!UUID.test(u), `${surface}: no identifier is shown in place of a name`);

    /* ── 5 · Rationale text and caption are unchanged ── */
    for (const html of [e, h, u]) {
      assert.ok(html.includes("Track the planned check."), `${surface}: the rationale renders verbatim`);
      assert.ok(html.includes("It authorizes nothing, and it is not your justification for deciding."), `${surface}: the caption stays`);
    }
    const missing = render(request({ proposedByAgentName: "Engineering Agent", proposalRationale: null }));
    assert.ok(missing.includes("Proposal rationale unavailable"), `${surface}: a null rationale stays unavailable`);
    assert.ok(missing.includes("not that the agent gave no reason"), `${surface}: and its denial caption stays`);
    assert.ok(!render(request({ proposedByActorType: "human" })).includes("proposal rationale"), `${surface}: a human proposal has no rationale slot`);

    /* A name is tenant content: rendered as escaped text, never markup. */
    assert.ok(render(request({ proposedByAgentName: "<b>X</b>" })).includes("&lt;b&gt;X&lt;/b&gt;’s proposal rationale"), `${surface}: the name is escaped`);

    /* ── 6 · Authorization boundary: the title changes nothing else, controls included ── */
    assert.equal(buttons(e), buttons(h), `${surface}: identical controls for either agent`);
    assert.equal(buttons(e), buttons(u), `${surface}: identical controls with no name`);
    assert.equal(without(without(e, "Engineering Agent’s proposal rationale"), "Engineering Agent"),
      without(without(h, "Heby’s proposal rationale"), "Heby"), `${surface}: only the name differs`);
    assert.match(e, /Authorize this action/, `${surface}: the authorize control is still offered`);
  }

  /* ── 4 · /approvals' in-flight summary (rendered only during a transition) reads the same field ── */
  const source = readFileSync(path.join(process.cwd(), "src/components/approvals-dashboard/approvals-dashboard.tsx"), "utf8");
  const summary = source.slice(source.indexOf("function RequestSummary"), source.indexOf("\n}\n", source.indexOf("function RequestSummary")));
  assert.ok(summary.includes('{request.proposedByAgentName !== null ? <>{request.proposedByAgentName}&rsquo;s proposal rationale</> : "Agent proposal rationale"}'),
    "RequestSummary titles the rationale from proposedByAgentName");
  for (const file of ["src/components/approvals-dashboard/approvals-dashboard.tsx", "src/components/decision-workspace/action-authorizations.tsx"]) {
    assert.ok(!readFileSync(path.join(process.cwd(), file), "utf8").includes("Heby&rsquo;s proposal rationale"), `${file}: no hardcoded Heby title`);
  }

  console.log("PASS AP5-APPROVALS-RATIONALE-LABEL-1: rationale titled by the proposing agent, neutral when unnamed, on both surfaces; nothing else changes");
}
main();
