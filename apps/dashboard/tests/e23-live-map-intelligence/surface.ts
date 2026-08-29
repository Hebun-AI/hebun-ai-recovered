/*
 * E2-3 — WHAT A DIRECTOR ACTUALLY SEES ON THE MAP.
 *
 * The model suite proves the projection is truthful. This proves the RENDERED PAGE is, because a
 * correct model displayed by a component with two branches where three states exist is still a lie
 * on the page.
 *
 * It is also the product acceptance: BEFORE, an agent node could say that an agent exists and
 * belongs to the organization. AFTER, the same node can answer "what has this agent proposed, and
 * what became of it" — from records, with every lifecycle stage still distinguishable.
 *
 * Rendered with `renderToStaticMarkup`, the way the released Command, workspace and Security Center
 * suites check their surfaces. No database, no network, no browser.
 */
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

import { LiveMapCanvas } from "../../src/components/live-map/live-map-canvas";
import { readLiveMapProjection } from "../../src/features/live-map/read-live-map.server";
import type { LiveMapProjection } from "../../src/features/live-map/contracts";
import type { LiveMapAgentOutcomeRead } from "../../src/features/agent-outcome-observation/live-map-agent-outcome.server";
import type { OrganizationAuthorityRead } from "../../src/features/organization-authority/contracts";
import { ORGANIZATION_STRUCTURE_UNAVAILABLE } from "../../src/features/organization-authority/contracts";
import type { DurableAgentIdentityState } from "../../src/features/agent-identity/read-durable-agent-identity.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const TENANT = { tenantId: "tenant-e23", userId: "user-e23" } as unknown as TenantContext;
const AGENT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const ORGANIZATION: OrganizationAuthorityRead = {
  status: "available",
  organization: {
    organizationId: "tenant-e23",
    /* Deliberately free of the letters a substring ban would trip on — see the ban block below. */
    name: "Acme Holdings",
    slug: "acme",
    lifecycleStatus: "active",
    tenantStatus: "active",
    provenance: "production-operator-ceremony",
    provenanceDetail: "Created by the production operator provisioning ceremony.",
    humanMemberCount: 3,
    structure: ORGANIZATION_STRUCTURE_UNAVAILABLE,
  },
};

const IDENTITIES: DurableAgentIdentityState = {
  status: "known",
  genesisSpent: true,
  identities: [
    {
      agentId: AGENT,
      name: "Sourcing Analyst",
      humanOwnerId: "human-1",
      humanOwnerType: "human",
      createdAt: "2026-06-01T00:00:00.000Z",
      retiredAt: null,
      inService: true,
    },
  ],
};

const EVIDENCE: LiveMapAgentOutcomeRead = {
  status: "read",
  byAgentId: new Map([
    [
      AGENT,
      {
        agentId: AGENT,
        activity: { proposalsFiled: 11, pending: 3, withdrawn: 2 },
        governance: {
          approved: 5,
          rejected: 4,
          permitsIssued: 7,
          permitsActive: 1,
          permitsExpired: 6,
          permitsConsumed: 8,
          permitsRevoked: 9,
          approvedWithoutExecution: 13,
        },
        execution: { attempts: 17, pending: 10, accepted: 14, refused: 15, failed: 16, unknown: 18 },
      },
    ],
  ]),
  unresolvedAgentProposals: 0,
};

const project = (outcome: LiveMapAgentOutcomeRead): Promise<LiveMapProjection> =>
  readLiveMapProjection(TENANT, {
    readOrganization: async () => ORGANIZATION,
    readAgentIdentity: async () => IDENTITIES,
    readAgentOutcome: async () => outcome,
  });

/** Strip tags so an assertion reads the SENTENCE a person sees, not the markup around it. */
const text = (markup: string): string =>
  markup
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");

const render = async (outcome: LiveMapAgentOutcomeRead): Promise<{ markup: string; page: string }> => {
  const markup = renderToStaticMarkup(
    React.createElement(LiveMapCanvas, { projection: await project(outcome) }),
  );
  return { markup, page: text(markup) };
};

/* ── 1 · BEFORE: THE NODE WITHOUT ITS EVIDENCE ────────────────────────────── */
async function beforeTheNodeOnlyProvesExistence(): Promise<void> {
  const { page } = await render({ status: "unavailable", reason: "read-failed" });

  /* Everything L4 shipped is still there. */
  assert.ok(page.includes("Sourcing Analyst"), "the agent is on the map");
  assert.ok(page.includes("authoritative"), "with its truth class");
  assert.ok(page.includes("Durable Agent Identity"), "and the authority that owns it");
  assert.ok(page.includes("belongs-to"), "and its one proven relationship");

  /* And the evidence is honestly missing, rather than silently zero. */
  assert.ok(
    page.includes("could not read this agent's outcome evidence"),
    "an unread observation says so on the page",
  );
  assert.ok(
    page.includes("says nothing about what this agent has proposed"),
    "and says what that does NOT mean",
  );
  for (const label of ["Proposals filed", "Governance outcome", "Execution outcome"]) {
    assert.ok(!page.includes(label), `an unread observation renders no "${label}" block at all`);
  }
  assert.ok(!/\bApproved\b/.test(page), "and certainly no zeroed counts");
}

/* ── 2 · AFTER: THE SAME NODE ANSWERS THE DIRECTOR'S QUESTION ─────────────── */
async function afterTheNodeAnswersWhatBecameOfIt(): Promise<void> {
  const { page } = await render(EVIDENCE);

  /* The identity facts did not move. */
  assert.ok(page.includes("Sourcing Analyst"));
  assert.ok(page.includes("In service."));

  /* The three concerns are on the page, each labelled. */
  for (const heading of ["Proposals filed", "Governance outcome", "Execution outcome"]) {
    assert.ok(page.includes(heading), `"${heading}" reaches the page`);
  }

  /* Every number reaches the page beside its own label — no stage is collapsed into another. */
  const pairs: ReadonlyArray<readonly [string, number]> = [
    ["Filed", 11],
    ["Awaiting a decision", 3],
    ["Withdrawn", 2],
    ["Approved", 5],
    ["Rejected", 4],
    ["Permits issued", 7],
    ["Permits still active", 1],
    ["Permits expired", 6],
    ["Permits consumed", 8],
    ["Permits revoked", 9],
    ["Approved, never executed", 13],
    ["Attempts", 17],
    ["Awaiting an answer", 10],
    ["Accepted by the provider", 14],
    ["Refused", 15],
    ["Failed", 16],
    ["Unknown", 18],
  ];
  for (const [label, value] of pairs) {
    assert.ok(
      new RegExp(`${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*${value}\\b`).test(page),
      `"${label}" is rendered with its own value ${value}`,
    );
  }

  /* THE SENTENCES A NUMBER CANNOT SAY FOR ITSELF are on the page too. */
  assert.ok(page.includes("An approval authorizes an act. It does not perform one."));
  assert.ok(page.includes("Accepted is not delivered"));
  assert.ok(page.includes("This is not a failure"));
  assert.ok(page.includes("approved is not executed"));
  assert.ok(page.includes("a permit is not an execution"));
}

/* ── 3 · THE TWO TRUTH CLASSES ARE BOTH VISIBLE, AND DIFFERENT ────────────── */
async function theReaderCanTellThemApart(): Promise<void> {
  const { page } = await render(EVIDENCE);
  assert.ok(page.includes("authoritative · Durable Agent Identity"), "the node's own class");
  assert.ok(page.includes("derived · Agent Outcome Observation"), "and the attachment's");
  assert.ok(
    !page.includes("authoritative · Agent Outcome Observation"),
    "the evidence never borrows the node's truth class",
  );
  assert.ok(
    !page.includes("derived · Durable Agent Identity"),
    "and the identity never borrows the evidence's",
  );
}

/* ── 4 · CUMULATIVE, ON THE PAGE, IN WORDS ────────────────────────────────── */
async function thePageSaysItIsCumulative(): Promise<void> {
  const { page } = await render(EVIDENCE);
  assert.ok(
    page.includes("covering everything since this agent identity was established"),
    "the span is stated where the numbers are",
  );
  assert.ok(page.includes("not limited to a period"), "and the window reading is refused");
  assert.ok(page.includes("not a stream"), "the surrounding read still says what it is");

  const lower = page.toLowerCase();
  for (const banned of [
    "real-time",
    "real time",
    "live activity",
    "auto-refresh",
    "today",
    "last 24",
    "recent activity",
    "currently",
    "right now",
  ]) {
    assert.ok(!lower.includes(banned), `the page must not claim "${banned}"`);
  }
}

/* ── 5 · COUNTS ONLY — NOTHING ON THE PAGE IS A JUDGEMENT ─────────────────── */
async function thePageOffersNoJudgement(): Promise<void> {
  const { page } = await render(EVIDENCE);
  const lower = page.toLowerCase();
  for (const banned of [
    "score",
    "rating",
    "grade",
    "rank",
    "success rate",
    "approval rate",
    "%",
    "percent",
    "ratio",
    "performance",
    "efficiency",
    "healthy",
    "underperform",
  ]) {
    assert.ok(!lower.includes(banned), `the page must not present "${banned}"`);
  }
}

/* ── 6 · THE COMPLETENESS LINE IS ON THE PAGE, EITHER WAY ─────────────────── */
async function completenessIsAlwaysStated(): Promise<void> {
  const clean = await render(EVIDENCE);
  assert.ok(clean.page.includes("Unplaced agent proposals: 0."), "a complete join says so");
  assert.ok(
    clean.page.includes("was placed on an agent identity shown above"),
    "and says what that means",
  );

  const short = await render({
    status: "read",
    byAgentId: EVIDENCE.status === "read" ? EVIDENCE.byAgentId : new Map(),
    unresolvedAgentProposals: 4,
  });
  assert.ok(short.page.includes("Unplaced agent proposals: 4."), "and an incomplete one says so too");
  assert.ok(
    short.page.includes("no agent was invented to hold them"),
    "with the refusal that matters most",
  );
  /*
   * Four unplaced proposals, and still exactly one agent CARD.
   *
   * Counted by the card's own provenance line rather than by the agent's name: the name also
   * appears in the proven-relationships list, so a name count is a count of mentions, not of nodes.
   */
  assert.equal(
    (short.page.match(/Established:/g) ?? []).length,
    1,
    "no agent was manufactured to hold the unplaced proposals",
  );

  /* When the evidence could not be read at all, no completeness figure is invented. */
  const unread = await render({ status: "unavailable", reason: "read-failed" });
  assert.ok(
    !unread.page.includes("Unplaced agent proposals"),
    "a total over an unread observation is a number about nothing",
  );
}

/* ── 7 · IT DISCLOSES. IT STILL OFFERS NO CONTROL ─────────────────────────── */
async function thePageStillCannotAct(): Promise<void> {
  const { markup } = await render(EVIDENCE);
  for (const banned of ["<button", "<form", "<input", "<select", "onclick", "onsubmit"]) {
    assert.ok(!markup.toLowerCase().includes(banned), `the map offers no control: "${banned}"`);
  }
  /* The evidence sits behind a disclosure, which reveals text — it does not act. */
  assert.ok(markup.includes("<details"), "the attachment is disclosed, not forced into the card");
  assert.ok(markup.includes("<summary"), "and the disclosure is labelled");
}

async function main(): Promise<void> {
  await beforeTheNodeOnlyProvesExistence();
  await afterTheNodeAnswersWhatBecameOfIt();
  await theReaderCanTellThemApart();
  await thePageSaysItIsCumulative();
  await thePageOffersNoJudgement();
  await completenessIsAlwaysStated();
  await thePageStillCannotAct();
  console.log("e23 live map intelligence — surface checks passed");
}

void main();
