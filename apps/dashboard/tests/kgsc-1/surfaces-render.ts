/*
 * KGSC-1 — the Knowledge workspace RENDERS Governance's reading, never the record's own claim.
 *
 * Rendered with `react-dom/server` like the K4 card suite; the standings are fixtures standing in for
 * what the route reads through `readKnowledgeGovernanceStandings` (proven against Postgres in
 * `standing-postgres.ts`). Then the wiring: the route reads it server-side and hands it down, and no
 * workspace component turns `record.ratified` into an approval label.
 *
 * Not route-level acceptance: the async page is not rendered here, and no browser saw any of it.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { KnowledgeReviewCard } from "../../src/components/knowledge-workspace/knowledge-review-card";
import { KnowledgeRecords } from "../../src/components/knowledge-workspace/knowledge-records";
import { GOVERNANCE_STANDING_LABEL, type GovernanceStandingReading } from "../../src/features/knowledge-ratification/contracts";

const ROOT = join(__dirname, "../..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");
const INERT_ROUTER = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} } as unknown as never;
const DECISION = "00000000-0000-4000-8000-0000000dec15";

function record(overrides: Record<string, unknown> = {}) {
  return {
    factId: "00000000-0000-4000-8000-00000000fac7",
    factKey: "refunds.policy",
    domainKey: "policies",
    scope: "company-wide",
    title: "Refund policy",
    statement: "Refunds within 30 days.",
    lifecycleStatus: "draft",
    authorityClass: "authoritative",
    ratified: true,
    ratificationDecisionId: DECISION,
    ratifiedAt: "2026-10-19T09:00:00.000Z",
    ratifiedByActorId: "00000000-0000-4000-8000-0000000ac70r".replace(/[^0-9a-f-]/g, "0"),
    governanceSessionId: null,
    activeKnowledgeNodeId: "00000000-0000-4000-8000-000000000de0",
    knowledgeVersion: 1,
    freshness: "unknown",
    ...overrides,
  } as never;
}

const withRouter = (element: unknown) =>
  renderToStaticMarkup(createElement(AppRouterContext.Provider as never, { value: INERT_ROUTER }, element as never));
const card = (rec: unknown, standing?: GovernanceStandingReading) =>
  withRouter(createElement(KnowledgeReviewCard as never, { record: rec, ...(standing ? { standing } : {}) } as never));
const records = (rec: unknown, standings?: Record<string, GovernanceStandingReading>) =>
  withRouter(
    createElement(KnowledgeRecords as never, {
      listing: { status: "read", records: [rec], incomplete: [], truncated: false },
      ...(standings ? { standings } : {}),
    } as never),
  );

function reviewCard(): void {
  /* A — Governance holds the decision: the approval box, with its decision. */
  const ok = card(record(), "ratified");
  assert.match(ok, /is <strong>ratified<\/strong>/, "A: a confirmed version says ratified");
  assert.ok(ok.includes(DECISION));

  /* B — the record names a decision Governance does not hold. */
  const forged = card(record(), "unconfirmed");
  assert.ok(!/is <strong>ratified<\/strong>/.test(forged), "B: a forged claim is never shown as ratified");
  assert.match(forged, /<strong>not confirmed<\/strong>/, "B: it says NOT confirmed");
  assert.match(forged, /Decision the record names/, "B: the claimed id is labelled as the record's claim");

  /* D — Governance could not be read: no approval, and no denial. A missing prop is the same. */
  for (const html of [card(record(), "unavailable"), card(record())]) {
    assert.ok(!/is <strong>ratified<\/strong>/.test(html), "D: unreadable Governance is not approval");
    assert.ok(!html.includes("not confirmed"), "D: …and not a denial");
    assert.match(html, /neither confirmed nor denied/);
  }

  /* C — no claim: the released unratified wording, unchanged. */
  const none = card(record({ ratified: false, ratificationDecisionId: null, ratifiedAt: null, ratifiedByActorId: null }), "none");
  assert.match(none, /carries no Governance decision/);
  assert.ok(!/is <strong>ratified<\/strong>/.test(none));
}

function recordsList(): void {
  const factId = "00000000-0000-4000-8000-00000000fac7";
  for (const standing of ["ratified", "unconfirmed", "none", "unavailable"] as const) {
    const html = records(record(), { [factId]: standing });
    assert.ok(html.includes(GOVERNANCE_STANDING_LABEL[standing]), `the record shows "${GOVERNANCE_STANDING_LABEL[standing]}"`);
    for (const other of ["ratified", "unconfirmed", "unavailable"] as const) {
      if (other !== standing) assert.ok(!html.includes(GOVERNANCE_STANDING_LABEL[other]), `${standing}: no ${other} label`);
    }
    assert.ok(html.includes("Refunds within 30 days."), "G: the record itself still renders");
  }
  /* A record the server sent no reading for is unavailable, never ratified, whatever it claims. */
  const unread = records(record());
  assert.ok(unread.includes(GOVERNANCE_STANDING_LABEL.unavailable));
  assert.ok(!unread.includes(GOVERNANCE_STANDING_LABEL.ratified));
}

function wiring(): void {
  const page = read("src/app/(dashboard)/knowledge/page.tsx");
  assert.match(page, /readKnowledgeGovernanceStandings\(tenant, reviewable\)/, "the route reads Governance's standing server-side, for the listed records");
  assert.match(page, /<KnowledgeRecords listing=\{listing\} standings=\{standings\}/, "and hands it to the records");
  assert.match(page, /standing=\{standings\[record\.factId\] \?\? "unavailable"\}/, "and to each review card");
  const actions = read("src/app/(dashboard)/knowledge/actions.ts");
  assert.match(actions, /readStandings: async \(claims\) => \(tenant \? readKnowledgeGovernanceStandings\(tenant, claims\)/, "the version history asks the same reader");

  /* No workspace component turns the record's own claim into an approval label. */
  for (const file of ["knowledge-records.tsx", "knowledge-version-control.tsx", "knowledge-review-card.tsx"]) {
    const src = read(`src/components/knowledge-workspace/${file}`);
    assert.ok(!/\.ratified \? "ratified"/.test(src), `${file} shows no label from the record's claim`);
    assert.ok(!/governance-decision\/[^"]*\.server|knowledge-evidence\.server/.test(src), `${file} reads no Governance record in the browser`);
  }
  assert.match(read("src/components/knowledge-workspace/knowledge-version-control.tsx"), /GOVERNANCE_STANDING_LABEL\[version\.governanceStanding \?\? "unavailable"\]/);
  /* Counts the page derives from records' own claims say so, and never call the records ratified. */
  for (const file of ["company-understanding-card.tsx", "knowledge-sources-card.tsx"]) {
    const src = read(`src/components/knowledge-workspace/${file}`);
    assert.match(src, /claiming ratification \(not verified by Governance\)/, `${file} labels its count as claims`);
    assert.ok(!/(Count|FactCount)\} ratified`/.test(src), `${file} does not call a claim count "ratified"`);
  }
  assert.ok(!read("src/components/knowledge-workspace/knowledge-sources-card.tsx").includes("has been ratified by your Governance authority"));
  /* The approval box is gated on Governance's reading, not on the claim alone. */
  assert.match(read("src/components/knowledge-workspace/knowledge-review-card.tsx"), /record\.ratified && standing === "ratified" \?/);
}

reviewCard();
recordsList();
wiring();
console.log("PASS kgsc-1 surfaces-render");
