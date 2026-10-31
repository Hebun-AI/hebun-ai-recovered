/*
 * LMX-1 — WHAT A DIRECTOR ACTUALLY SEES ON /live-map.
 *
 * Core v1 was truthful and it was an inventory: four stacked regions of cards from which a reader
 * assembled the shape of their own organization in their head. This proves the surface now DRAWS
 * that shape — and, more importantly, that drawing it added no claim.
 *
 * A picture is believed faster than a paragraph, so every assertion here is paired: the map shows
 * the relationship AND still prints the column that proves it; the map shows counts AND still says
 * they are derived; the map is a canvas AND still states, in words, every domain Hebun does not own.
 *
 *     TRUTH BEFORE GRAPH COMPLETENESS        VISUAL INTERACTION != WRITE AUTHORITY
 *
 * Rendered with `renderToStaticMarkup` against the released projection. No database, no browser.
 */
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

import { AgentOfficePage } from "../../src/components/live-map/agent-office-page";
import { LiveMapCanvas } from "../../src/components/live-map/live-map-canvas";
import { readLiveMapAgentOffice, readLiveMapProjection } from "../../src/features/live-map/read-live-map.server";
import type { LiveMapProjection } from "../../src/features/live-map/contracts";
import type { LiveMapAgentOutcomeRead } from "../../src/features/agent-outcome-observation/live-map-agent-outcome.server";
import type { OrganizationAuthorityRead } from "../../src/features/organization-authority/contracts";
import { ORGANIZATION_STRUCTURE_UNAVAILABLE } from "../../src/features/organization-authority/contracts";
import type { DurableAgentIdentityState } from "../../src/features/agent-identity/read-durable-agent-identity.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const TENANT = { tenantId: "tenant-lmx", userId: "user-lmx" } as unknown as TenantContext;
const SERVING = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const RETIRED = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const ORGANIZATION: OrganizationAuthorityRead = {
  status: "available",
  organization: {
    organizationId: "tenant-lmx",
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
      agentId: SERVING,
      name: "Sourcing Analyst",
      humanOwnerId: "human-1",
      humanOwnerType: "human",
      createdAt: "2026-06-01T00:00:00.000Z",
      retiredAt: null,
      inService: true,
      serviceStatus: "in-service" as const,
      suspendedAt: null,
    },
    {
      agentId: RETIRED,
      name: "Legacy Drafter",
      humanOwnerId: "human-1",
      humanOwnerType: "human",
      createdAt: "2026-05-01T00:00:00.000Z",
      retiredAt: "2026-08-01T00:00:00.000Z",
      inService: false,
      serviceStatus: "retired" as const,
      suspendedAt: null,
    },
  ],
};

const EVIDENCE: LiveMapAgentOutcomeRead = {
  status: "read",
  byAgentId: new Map([
    [
      SERVING,
      {
        agentId: SERVING,
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
    [
      RETIRED,
      {
        agentId: RETIRED,
        activity: { proposalsFiled: 0, pending: 0, withdrawn: 0 },
        governance: {
          approved: 0,
          rejected: 0,
          permitsIssued: 0,
          permitsActive: 0,
          permitsExpired: 0,
          permitsConsumed: 0,
          permitsRevoked: 0,
          approvedWithoutExecution: 0,
        },
        execution: { attempts: 0, pending: 0, accepted: 0, refused: 0, failed: 0, unknown: 0 },
      },
    ],
  ]),
  unresolvedAgentProposals: 0,
};

const project = (
  outcome: LiveMapAgentOutcomeRead,
  agents: DurableAgentIdentityState = IDENTITIES,
  organization: OrganizationAuthorityRead = ORGANIZATION,
): Promise<LiveMapProjection> =>
  readLiveMapProjection(TENANT, {
    readOrganization: async () => organization,
    readAgentIdentity: async () => agents,
    readAgentOutcome: async () => outcome,
  });

const text = (markup: string): string =>
  markup
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");

const render = async (
  outcome: LiveMapAgentOutcomeRead,
  agents?: DurableAgentIdentityState,
  organization?: OrganizationAuthorityRead,
): Promise<{ markup: string; page: string }> => {
  const markup = renderToStaticMarkup(
    React.createElement(LiveMapCanvas, { projection: await project(outcome, agents, organization) }),
  );
  return { markup, page: text(markup) };
};

/** The first agent's office, from the same fixtures: the inspector's words now live there. */
const renderOffice = async (outcome: LiveMapAgentOutcomeRead): Promise<{ markup: string; page: string }> => {
  const office = await readLiveMapAgentOffice(TENANT, SERVING, {
    readOrganization: async () => ORGANIZATION,
    readAgentIdentity: async () => IDENTITIES,
    readAgentOutcome: async () => outcome,
    readAgentPlacements: async () => ({ status: "unavailable" }),
  });
  const markup = renderToStaticMarkup(React.createElement(AgentOfficePage, { office }));
  return { markup, page: text(markup) };
};

/* ── A · IT IS A MAP, NOT A STACK OF CARDS ────────────────────────────────── */
async function itRendersAsAMap(): Promise<void> {
  const { markup } = await render(EVIDENCE);
  assert.ok(markup.includes('data-live-map'), "the surface declares itself a map");
  assert.ok(markup.includes('class="lm-canvas"'), "and renders a canvas");
  assert.ok(markup.includes('class="lm-org-node"'), "with an organization node");
  assert.ok(markup.includes('class="lm-agents"'), "and an agent field");
  assert.equal(
    (markup.match(/class="lm-agent"/g) ?? []).length,
    2,
    "one node per durable identity, and no more",
  );
}

/* ── B · THE ORGANIZATION IS THE CENTRE ───────────────────────────────────── */
async function theOrganizationIsCentral(): Promise<void> {
  const { markup, page } = await render(EVIDENCE);

  const centre = markup.indexOf('class="lm-centre"');
  const org = markup.indexOf('class="lm-org-node"');
  const field = markup.indexOf('class="lm-agents"');
  assert.ok(centre >= 0 && org > centre, "the organization node sits in the map's centre slot");
  assert.ok(org < field, "and it precedes the agents that hang from it");

  assert.ok(page.includes("Acme Holdings"), "the organization is named");
  assert.ok(page.includes("authoritative"), "and carries its truth class");
  assert.ok(page.includes("Organization Authority"), "and names the authority that owns it");
  /* Technical provenance is present, in secondary detail rather than dominating the centre. */
  assert.ok(page.includes("Organization record"), "the record is one disclosure away");
  assert.ok(page.includes("Human members: 3"), "and it carries the authority's own facts");
}

/* ── C + D · REAL AGENTS, AND THE PROVEN RELATIONSHIP ─────────────────────── */
async function agentsAndTheirRelationship(): Promise<void> {
  const { markup, page } = await render(EVIDENCE);

  assert.ok(page.includes("Sourcing Analyst"), "the serving identity is on the map");
  assert.ok(page.includes("Legacy Drafter"), "so is the retired one");
  assert.ok(page.includes("In service"), "with its lifecycle word");
  assert.ok(page.includes("Retired"), "and the other's");
  assert.ok(page.includes("2 agents"), "the field states how many are drawn");

  /* The relationship is DRAWN — and still printed, because a line says "related" and no more. */
  assert.ok(markup.includes('data-connected="yes"'), "the spine is drawn: both ends are on the map");
  assert.ok(page.includes("belongs-to"), "the relation is named");
  assert.ok(page.includes("agents.tenant_id"), "and the durable column that proves it is printed");
  assert.ok(
    page.includes("No departmental placement, ownership or assignment is claimed"),
    "along with what the drawn line does NOT claim",
  );

  /* No organization on the map: nothing is drawn, because the far end is not visible. */
  const orphaned = await render(EVIDENCE, IDENTITIES, { status: "unavailable", reason: "read-failed" });
  assert.ok(
    orphaned.markup.includes('data-connected="no"'),
    "with no visible organization the spine is not drawn",
  );
  assert.ok(!orphaned.page.includes("agents.tenant_id"), "and no relationship is asserted");
}

/* ── E + F · SELECTING AN AGENT REVEALS THE DERIVED OBSERVATION ───────────── */
async function theInspectorRevealsOutcomeIntelligence(): Promise<void> {
  const { markup, page } = await renderOffice(EVIDENCE);

  /* Choosing an agent is a link, and what the inspector printed is on the office page. */
  const { markup: map } = await render(EVIDENCE);
  assert.equal((map.match(/<a class="lm-node"/g) ?? []).length, 2, "every agent is one link");
  assert.ok(!map.includes("<details class=\"lm-agent\""), "and no card discloses in place");
  assert.ok(markup.includes('aria-labelledby="lm-office-details"'), "the record is the office's Details");

  /* The identity half. */
  assert.ok(page.includes("authoritative · Durable Agent Identity"), "identity states its class");
  /* The derived half — E2-3's observation, reused rather than recomputed. */
  assert.ok(page.includes("derived · Agent Outcome Observation"), "the observation states its own");
  assert.ok(
    !page.includes("authoritative · Agent Outcome Observation"),
    "and never borrows the identity's class",
  );

  for (const heading of ["Proposals filed", "Governance outcome", "Execution outcome"]) {
    assert.ok(page.includes(heading), `"${heading}" reaches the inspector`);
  }
  const pairs: ReadonlyArray<readonly [string, number]> = [
    ["Filed", 11],
    ["Approved", 5],
    ["Approved, never executed", 13],
    ["Attempts", 17],
    ["Accepted by the provider", 14],
    ["Unknown", 18],
  ];
  for (const [label, value] of pairs) {
    assert.ok(
      new RegExp(`${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*${value}\\b`).test(page),
      `"${label}" is rendered with its own value ${value}`,
    );
  }
  assert.ok(page.includes("approved is not executed"), "the refusals travel with the numbers");
  assert.ok(page.includes("Accepted is not delivered"), "including the strongest one");

  /* The glance line on a closed node is three counts, never one summarising figure. */
  const { page: glance } = await render(EVIDENCE);
  assert.ok(glance.includes("11 filed"), "the node glances the filed count");
  assert.ok(glance.includes("5 approved"), "and the approved count");
  assert.ok(glance.includes("13 never executed"), "and the approval gap — three facts, not one");
}

/* ── G · UNAVAILABLE EVIDENCE NEVER BECOMES ZEROS ─────────────────────────── */
async function unavailableIsNotZero(): Promise<void> {
  const { page } = await render({ status: "unavailable", reason: "read-failed" });

  assert.ok(page.includes("Sourcing Analyst"), "the agents are still real and still drawn");
  assert.ok(page.includes("Outcome observation unread"), "the glance line says it could not be read");
  const { page: office } = await renderOffice({ status: "unavailable", reason: "read-failed" });
  assert.ok(
    office.includes("could not read this agent's outcome evidence"),
    "and the office says so in full",
  );
  assert.ok(
    office.includes("says nothing about what this agent has proposed"),
    "with what that does NOT mean",
  );
  for (const heading of ["Proposals filed", "Governance outcome", "Execution outcome"]) {
    assert.ok(!page.includes(heading), `an unread observation renders no "${heading}" block`);
    assert.ok(!office.includes(heading), `on the office either: "${heading}"`);
  }
  assert.ok(!/\bApproved\b/.test(page), "and no zeroed count anywhere");
  assert.ok(!/\bApproved\b/.test(office), "on either surface");
  assert.ok(!page.includes("Unplaced agent proposals"), "no completeness figure is invented");

  /* A MEASURED zero is different, and is shown as a zero. */
  const measured = await render(EVIDENCE);
  assert.ok(measured.page.includes("0 filed"), "the retired agent's measured zero is shown");
}

/* ── H · NO FICTION ENTERS THE PICTURE ────────────────────────────────────── */
async function noFictionIsDrawn(): Promise<void> {
  const { page } = await render(EVIDENCE);
  const lower = page.toLowerCase();

  /* The absences are STATED — the strongest evidence that they were not drawn instead. */
  assert.ok(page.includes("Departments & teams"), "structure is named as a domain");
  assert.ok(
    /* OSA-1: the sentence moved from "no authority exists" to "the authority could not answer". */
    page.includes("unknown — not absent"),
    "and stated as unread rather than empty",
  );
  assert.ok(page.includes("People"), "people are named");
  /* Repointed with the released sentence: see `l4-live-map/projection-truth.ts` for the reasoning. */
  assert.ok(
    page.includes("a placement register is not a member roster"),
    "and membership is never relabelled as placement",
  );

  /* No invented entity, and no judgement anywhere on the surface. */
  for (const banned of [
    "score",
    "rating",
    "rank",
    "success rate",
    "performance",
    "%",
    "percent",
    "healthy",
    "risk",
    "incident",
    "threat",
  ]) {
    assert.ok(!lower.includes(banned), `the map must not present "${banned}"`);
  }
  for (const banned of ["real-time", "real time", "live update", "auto-refresh", "today", "currently"]) {
    assert.ok(!lower.includes(banned), `the map must not claim "${banned}"`);
  }
  assert.ok(page.includes("not a stream"), "and it says what the reading actually is");
}

/* ── I · IT DISCLOSES; IT STILL CANNOT ACT ────────────────────────────────── */
async function theMapOffersNoControl(): Promise<void> {
  const { markup } = await render(EVIDENCE);
  for (const banned of ["<button", "<form", "<input", "<select", "onclick", "onsubmit", "draggable"]) {
    assert.ok(!markup.toLowerCase().includes(banned), `the map offers no control: "${banned}"`);
  }

  /* Accessibility: the map is navigable and named, never a field of decorative shapes. */
  assert.ok(markup.includes('aria-label="Organizational map"'), "the canvas is named");
  assert.ok(markup.includes('aria-label="Organization: Acme Holdings"'), "the centre node is named");
  /* The node's text IS its name: an `aria-label` here replaced the three counts for a screen reader. */
  const agentNode = markup.match(/<a class="lm-node".*?<\/a>/)?.[0] ?? "";
  assert.ok(!/^<a [^>]*aria-label/.test(agentNode), "no label replaces the node's text");
  for (const word of ["Sourcing Analyst", "In service", "11", "filed", "5", "approved", "13", "never executed"]) {
    assert.ok(text(agentNode).includes(word), `and each agent node carries its own accessible name: ${word}`);
  }
  const { markup: office } = await renderOffice(EVIDENCE);
  assert.ok(office.includes('aria-label="Agent identity"'), "the record's halves are named");
  assert.ok(office.includes('aria-label="Agent outcome observation"'), "both of them");

  /* Navigation to the owning subsystems survives. */
  assert.ok(markup.includes('href="/director/organization"'), "Organization stays reachable");
  assert.ok(office.includes('href="/agents"'), "so does Agents, from the office");
}

/* ── J · THE SPARSE CASES STAY GRACEFUL ───────────────────────────────────── */
async function oneAgentAndNoAgents(): Promise<void> {
  const single: DurableAgentIdentityState = {
    status: "known",
    genesisSpent: true,
    identities: [IDENTITIES.status === "known" ? IDENTITIES.identities[0]! : ({} as never)],
  };
  const one = await render(EVIDENCE, single);
  assert.ok(one.page.includes("1 agent"), "one agent reads as one agent, not '1 agents'");
  assert.ok(one.markup.includes('data-connected="yes"'), "and it is still connected to the centre");

  const none = await render(EVIDENCE, { status: "known", genesisSpent: false, identities: [] });
  assert.ok(none.markup.includes('data-connected="no"'), "no agents, so nothing is drawn");
  assert.ok(none.page.includes("measured zero"), "and the empty answer says it was measured");

  const unread = await render(EVIDENCE, { status: "unavailable" });
  assert.ok(
    unread.page.includes("not an organization without agents"),
    "an unreadable agent authority is never rendered as an organization with none",
  );
}

async function main(): Promise<void> {
  await itRendersAsAMap();
  await theOrganizationIsCentral();
  await agentsAndTheirRelationship();
  await theInspectorRevealsOutcomeIntelligence();
  await unavailableIsNotZero();
  await noFictionIsDrawn();
  await theMapOffersNoControl();
  await oneAgentAndNoAgents();
  console.log("live-map-experience — map surface checks passed");
}

void main();
