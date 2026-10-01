import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { ApprovalsDashboard } from "../../src/components/approvals-dashboard/approvals-dashboard";
import { readApprovalsDashboard } from "../../src/features/approvals-dashboard/read-dashboard.server";
async function main() {
  const data = await readApprovalsDashboard(null);
  assert.equal(data.authorized, false);
  assert.equal(data.contentAvailable, false);
  assert.equal(data.reviewsAvailable, false);
  assert.deepEqual(data.content, []);
  const html = renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: {} as never }, createElement(ApprovalsDashboard, {
    data, requests: [], permits: [], connected: false, requestsAvailable: false, permitsAvailable: false,
  })));
  assert.match(html, /No readable records/);
  assert.match(html, /This does not establish an empty queue/);
  assert.match(html, /Approve All/);
  assert.equal((html.match(/>—</g) ?? []).length, 5, "unreadable counters must not become zero");
  assert.match(html, /disabled=""[^>]*>[^<]*<svg[\s\S]*?Approve All/, "Approve All is disabled without authority");
  assert.ok(!html.includes('<img'), "no fabricated thumbnail");
  console.log("PASS actual no-session reads render unavailable counters, closed decision controls and honest empty state");
}
void main();
