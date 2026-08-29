/*
 * LMX-1 — LIVE MAP LIVE · SECURITY LIVE.
 *
 * Two compact panels on the default authenticated landing, and both are the shape that most easily
 * lies: a small box with a big number is read as a verdict. So the proofs here are mostly about
 * what the panels REFUSE — an unread ledger that never becomes a zero, a count of governed acts
 * that never becomes a security posture, and the word "Live" that never becomes a runtime claim.
 *
 *     LIVE MAP LIVE != A SECOND LIVE MAP        SECURITY LIVE != A SECURITY AUTHORITY
 *     AUDIT ACT != INCIDENT                     ZERO RECORDED ACTS != SECURE
 *     LIVE LABEL != REAL-TIME GUARANTEE         UNAVAILABLE != ZERO
 *
 * Pure and rendered. No database, no network, no browser.
 */
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

import { GlobalAwareness } from "../../src/components/awareness/global-awareness";
import { summariseLiveMap } from "../../src/features/live-map/awareness";
import {
  summariseSecurityObservation,
  SECURITY_AWARENESS_UNREAD,
} from "../../src/features/security-center/awareness";
import { readLiveMapProjection } from "../../src/features/live-map/read-live-map.server";
import type { LiveMapProjection } from "../../src/features/live-map/contracts";
import type { LiveMapAgentOutcomeRead } from "../../src/features/agent-outcome-observation/live-map-agent-outcome.server";
import type { OrganizationAuthorityRead } from "../../src/features/organization-authority/contracts";
import { ORGANIZATION_STRUCTURE_UNAVAILABLE } from "../../src/features/organization-authority/contracts";
import type { DurableAgentIdentityState } from "../../src/features/agent-identity/read-durable-agent-identity.server";
import type { SecurityRecordedActObservation } from "../../src/features/security-center/contracts";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const TENANT = { tenantId: "tenant-lmx", userId: "user-lmx" } as unknown as TenantContext;
const AGENT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

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
      agentId: AGENT,
      name: "Sourcing Analyst",
      humanOwnerId: null,
      humanOwnerType: null,
      createdAt: "2026-06-01T00:00:00.000Z",
      retiredAt: null,
      inService: true,
    },
  ],
};

const OUTCOME: LiveMapAgentOutcomeRead = {
  status: "read",
  byAgentId: new Map([
    [
      AGENT,
      {
        agentId: AGENT,
        activity: { proposalsFiled: 2, pending: 1, withdrawn: 0 },
        governance: {
          approved: 1,
          rejected: 0,
          permitsIssued: 1,
          permitsActive: 1,
          permitsExpired: 0,
          permitsConsumed: 0,
          permitsRevoked: 0,
          approvedWithoutExecution: 1,
        },
        execution: { attempts: 0, pending: 0, accepted: 0, refused: 0, failed: 0, unknown: 0 },
      },
    ],
  ]),
  unresolvedAgentProposals: 0,
};

const project = (
  organization: OrganizationAuthorityRead = ORGANIZATION,
  agents: DurableAgentIdentityState = IDENTITIES,
  outcome: LiveMapAgentOutcomeRead = OUTCOME,
): Promise<LiveMapProjection> =>
  readLiveMapProjection(TENANT, {
    readOrganization: async () => organization,
    readAgentIdentity: async () => agents,
    readAgentOutcome: async () => outcome,
  });

const OBSERVATION = (
  over: Partial<SecurityRecordedActObservation> = {},
): SecurityRecordedActObservation => ({
  sourceClass: "audit",
  state: "recorded",
  authoritative: false,
  provenance: "Recorded governed acts, read from the ledger Hebun writes.",
  limits: "An act is something an authorized actor did. It is not an intrusion and not an alert.",
  generatedAt: "2026-08-30T00:00:00.000Z",
  acts: [],
  totalRecordedActs: 41,
  truncated: true,
  unavailableReason: null,
  ...over,
});

const text = (markup: string): string =>
  markup
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");

const render = async (
  security: SecurityRecordedActObservation | null,
  projection?: LiveMapProjection,
): Promise<{ markup: string; page: string }> => {
  const markup = renderToStaticMarkup(
    React.createElement(GlobalAwareness, {
      liveMap: summariseLiveMap(projection ?? (await project())),
      security: summariseSecurityObservation(security),
    }),
  );
  return { markup, page: text(markup) };
};

/* ── 1 · THE SUMMARY IS A VIEW, NEVER A SECOND READ ───────────────────────── */
async function theSummaryOnlyRestates(): Promise<void> {
  const projection = await project();
  const awareness = summariseLiveMap(projection);

  assert.equal(awareness.organization.status, "named");
  if (awareness.organization.status !== "named") throw new Error("unreachable");
  assert.equal(awareness.organization.name, "Acme Holdings", "the name is the projection's own");
  assert.equal(awareness.agents.status, "counted");
  if (awareness.agents.status !== "counted") throw new Error("unreachable");
  assert.equal(awareness.agents.count, 1, "counted from the nodes the map itself drew");
  assert.equal(
    awareness.freshness,
    projection.freshness,
    "the freshness sentence is carried verbatim — the panel invents no claim about it",
  );
  assert.equal(awareness.intelligence.status, "available");
}

/* ── 2 · THE THREE AGENT ANSWERS NEVER COLLAPSE ───────────────────────────── */
async function knownEmptyIsNotUnavailable(): Promise<void> {
  const empty = summariseLiveMap(
    await project(ORGANIZATION, { status: "known", genesisSpent: false, identities: [] }),
  );
  assert.equal(empty.agents.status, "known-empty", "a measured zero keeps its own state");

  const unread = summariseLiveMap(await project(ORGANIZATION, { status: "unavailable" }));
  assert.equal(unread.agents.status, "unavailable", "an unread authority keeps its own");
  assert.notDeepEqual(empty.agents, unread.agents, "and the two are never the same value");

  /* Rendered, they are two different sentences — this is where a zero would have been printed. */
  const emptyPage = await render(OBSERVATION(), await project(ORGANIZATION, { status: "known", genesisSpent: false, identities: [] }));
  assert.ok(
    emptyPage.page.includes("no durable agent has been established"),
    "the measured zero is stated as an answer",
  );
  const unreadPage = await render(OBSERVATION(), await project(ORGANIZATION, { status: "unavailable" }));
  assert.ok(
    unreadPage.page.includes("that is a read failure, not an absence of agents"),
    "the unread one is stated as a failure",
  );
  assert.ok(!unreadPage.page.includes("0 durable"), "and never as a count");
}

/* ── 3 · SECURITY LIVE USES E2-2's EXACT SEMANTICS ────────────────────────── */
async function securityKeepsItsThreeStates(): Promise<void> {
  const recorded = summariseSecurityObservation(OBSERVATION());
  assert.equal(recorded.state.status, "recorded");
  if (recorded.state.status !== "recorded") throw new Error("unreachable");
  assert.equal(recorded.state.totalRecordedActs, 41, "the INDEPENDENT total, not the page length");
  assert.equal(recorded.state.truncated, true, "and the page's own truncation flag");
  assert.equal(recorded.authoritative, false, "the observation is derived, and says so");

  const known = summariseSecurityObservation(OBSERVATION({ state: "known-empty", totalRecordedActs: 0, acts: [], truncated: false }));
  assert.equal(known.state.status, "known-empty");

  const unavailable = summariseSecurityObservation(
    OBSERVATION({ state: "unavailable", totalRecordedActs: null, unavailableReason: "read-failed" }),
  );
  assert.equal(unavailable.state.status, "unavailable");
  if (unavailable.state.status !== "unavailable") throw new Error("unreachable");
  assert.equal(unavailable.state.reason, "read-failed", "the reason travels unchanged");

  /* No observation at all is unavailable too — never an empty ledger. */
  const absent = summariseSecurityObservation(null);
  assert.equal(absent.state.status, "unavailable");
  assert.equal(absent.provenance, SECURITY_AWARENESS_UNREAD);
}

/* ── 4 · THE PANELS RENDER, AND SAY WHAT THEY ARE ─────────────────────────── */
async function bothPanelsRenderTruthfully(): Promise<void> {
  const { markup, page } = await render(OBSERVATION());

  assert.ok(markup.includes('id="live-map-live"'), "Live Map Live is on the page");
  assert.ok(markup.includes('id="security-live"'), "so is Security Live");
  assert.ok(page.includes("Live Map Live"), "and both are named");
  assert.ok(page.includes("Security Live"));

  /* Live Map Live: the organization, its agents, and the state of the derived observation. */
  assert.ok(page.includes("Acme Holdings"), "the organization is named");
  assert.ok(page.includes("1 durable agent on the map."), "singular, and counted from the map");
  assert.ok(
    page.includes("Agent outcome observation is available for every agent shown."),
    "and the derived layer's availability is stated",
  );

  /* Security Live: a count of ACTS, in the word "acts". */
  assert.ok(page.includes("41 recorded governed acts"), "the independent total reaches the page");
  assert.ok(
    page.includes("Acts this organization's authorized actors took"),
    "described as what the ledger actually holds",
  );
  assert.ok(page.includes("bounded page"), "and the page's boundedness is disclosed");

  /* Both provenance chips, and the right kinds. */
  const kinds = [...markup.matchAll(/data-provenance="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(kinds, ["authoritative", "derived"], "the map is authoritative, the ledger view derived");

  /* Both doorways, to the CURRENT released routes. */
  assert.ok(markup.includes('href="/live-map"'), "Live Map Live opens the map");
  assert.ok(
    markup.includes('href="/director/governance/security"'),
    "Security Live opens the released Security Center route, not an invented one",
  );
}

/* ── 5 · "LIVE" CLAIMS NOTHING ABOUT A RUNTIME ────────────────────────────── */
async function neitherPanelClaimsRealTime(): Promise<void> {
  const { page } = await render(OBSERVATION());
  assert.ok(page.includes("not a stream"), "the map panel carries the projection's own sentence");
  const lower = page.toLowerCase();
  for (const banned of [
    "real-time",
    "real time",
    "continuous",
    "monitoring",
    "live feed",
    "live events",
    "streaming",
    "auto-refresh",
    "today",
    "right now",
    "currently",
  ]) {
    assert.ok(!lower.includes(banned), `no panel may claim "${banned}"`);
  }
}

/* ── 6 · NO POSTURE, NO SCORE, NO REASSURANCE ─────────────────────────────── */
async function noPanelProducesAVerdict(): Promise<void> {
  /*
   * THE DENIALS ARE STRIPPED BEFORE THE BAN RUNS, AND ASSERTED BY EQUALITY BELOW.
   *
   * The panel's most important sentence is "it is not a statement that anything is secure" — and a
   * word ban over the whole page fails on exactly that. It is the seventh time this repository has
   * recorded a prose-shaped guard tripping on the product's own honest refusal, and the rule that
   * survived E2-2 is the one applied here: remove the known denial, ban what remains, and prove the
   * denial separately by its exact words.
   */
  const DENIALS: readonly string[] = [
    "it is not a statement that anything is secure",
    "not an organization with nothing recorded",
  ];
  const stripDenials = (page: string): string =>
    DENIALS.reduce((acc, denial) => acc.split(denial).join(" "), page);

  for (const observation of [
    OBSERVATION(),
    OBSERVATION({ state: "known-empty", totalRecordedActs: 0, truncated: false }),
    OBSERVATION({ state: "unavailable", totalRecordedActs: null, unavailableReason: "read-failed" }),
    null,
  ]) {
    const { page } = await render(observation);
    const lower = stripDenials(page.toLowerCase());
    for (const banned of [
      "all systems",
      "secure",
      "no threats",
      "threat",
      "risk",
      "incident",
      "breach",
      "score",
      "rating",
      "rank",
      "healthy",
      "%",
      "percent",
      "posture",
    ]) {
      assert.ok(!lower.includes(banned), `the awareness band must not present "${banned}"`);
    }
  }

  /* A measured zero is stated as a measured zero, and disclaims the reading it invites. */
  const known = await render(OBSERVATION({ state: "known-empty", totalRecordedActs: 0, truncated: false }));
  assert.ok(known.page.includes("No governed act has been recorded"));
  assert.ok(
    known.page.includes("it is not a statement that anything is secure"),
    "the one sentence that keeps an empty ledger from reading as safety",
  );

  const unread = await render(null);
  assert.ok(unread.page.includes("Recorded acts could not be read"));
  assert.ok(
    unread.page.includes("not an organization with nothing recorded"),
    "and an unread ledger never becomes an empty one",
  );
}

/* ── 7 · IT OFFERS NAVIGATION, NEVER A CONTROL ────────────────────────────── */
async function theBandOffersNoControl(): Promise<void> {
  const { markup } = await render(OBSERVATION());
  for (const banned of ["<button", "<form", "<input", "onclick", "onsubmit"]) {
    assert.ok(!markup.toLowerCase().includes(banned), `the band offers no control: "${banned}"`);
  }
  assert.ok(markup.includes('aria-label="Live Map Live"'), "each panel is a named region");
  assert.ok(markup.includes('aria-label="Security Live"'));
  assert.ok(markup.includes('aria-describedby="live-map-live-question"'), "and describes itself");
}

async function main(): Promise<void> {
  await theSummaryOnlyRestates();
  await knownEmptyIsNotUnavailable();
  await securityKeepsItsThreeStates();
  await bothPanelsRenderTruthfully();
  await neitherPanelClaimsRealTime();
  await noPanelProducesAVerdict();
  await theBandOffersNoControl();
  console.log("live-map-experience — awareness checks passed");
}

void main();
