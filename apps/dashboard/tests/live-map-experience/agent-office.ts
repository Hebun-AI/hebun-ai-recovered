/*
 * LIVE MAP PHASE 4B — ONE OFFICE PAGE, ONE ROUTE, FOR EVERY REAL AGENT.
 *
 * The map's card stopped disclosing and started navigating, so three things moved at once and each
 * is asserted here rather than assumed: the card is a single link, the seam behind the route answers
 * three different sentences, and everything the inspector printed still reaches a reader.
 *
 *     NOT FOUND != UNAVAILABLE        ROUTE PARAMETER != TENANT SCOPE
 *     DEPARTMENT != TEAM              NO AUTHORITY != ZERO SUBAGENTS
 *
 * No database, no network. The two-tenant proof is `agent-office-postgres.ts`.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AgentOfficePage } from "../../src/components/live-map/agent-office-page";
import { LiveMapCanvas } from "../../src/components/live-map/live-map-canvas";
import AgentOfficeNotFound from "../../src/app/(dashboard)/live-map/agents/[agentId]/not-found";
import type { DurableAgentIdentityState } from "../../src/features/agent-identity/read-durable-agent-identity.server";
import type { LiveMapAgentOutcomeRead } from "../../src/features/agent-outcome-observation/live-map-agent-outcome.server";
import type { AgentPlacementRegister } from "../../src/features/organization-authority/agent-placement-contracts";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";
import {
  agentOfficeRoute,
  LIVE_MAP_TEAM_RELATION_ABSENT,
  type LiveMapAgentOfficeRead,
} from "../../src/features/live-map/contracts";
import { officeThemeFor } from "../../src/features/live-map/office-theme";
import {
  readLiveMapAgentOffice,
  readLiveMapProjection,
  type LiveMapAgentOfficeDeps,
} from "../../src/features/live-map/read-live-map.server";

const TENANT = asHumanTenantContext({
  tenantId: "10000000-0000-4000-8000-00000000b401",
  userId: "20000000-0000-4000-8000-00000000b401",
  authIdentityId: "auth-identity",
  membershipId: "membership",
  membershipVersion: 1,
  roleId: "role",
  sessionContextId: "session",
  provider: "local",
  assuranceLevel: "aal1",
  mfaVerified: false,
  requestId: "agent-office",
  authenticatedAt: "2026-10-31T00:00:00.000Z",
});

const SERVING = "30000000-0000-4000-8000-000000000001";
const SUSPENDED = "30000000-0000-4000-8000-000000000002";
const RETIRED = "30000000-0000-4000-8000-000000000003";
const UNKNOWN = "30000000-0000-4000-8000-000000000004";
const ELSEWHERE = "30000000-0000-4000-8000-00000000ffff";

const identity = (
  agentId: string,
  name: string,
  serviceStatus: "in-service" | "suspended" | "retired" | "indeterminate",
) => ({
  agentId,
  name,
  humanOwnerId: "human-1",
  humanOwnerType: "human",
  createdAt: "2026-05-01T00:00:00.000Z",
  retiredAt: serviceStatus === "retired" ? "2026-08-01T00:00:00.000Z" : null,
  suspendedAt: serviceStatus === "suspended" ? "2026-09-01T00:00:00.000Z" : null,
  inService: serviceStatus === "in-service",
  serviceStatus,
});

const IDENTITIES: DurableAgentIdentityState = {
  status: "known",
  genesisSpent: true,
  identities: [
    identity(SERVING, "Atlas Writer", "in-service"),
    identity(SUSPENDED, "Paused Scout", "suspended"),
    identity(RETIRED, "Legacy Drafter", "retired"),
    identity(UNKNOWN, "Disputed Clerk", "indeterminate"),
  ],
};

const OUTCOME: LiveMapAgentOutcomeRead = {
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
  ]),
  unresolvedAgentProposals: 0,
};

const PLACEMENTS: AgentPlacementRegister = {
  status: "available",
  placements: [
    {
      agentId: SERVING,
      agentInService: true,
      state: "placed",
      department: { departmentId: "d1", name: "Engineering", slug: "engineering", inService: true },
    },
    { agentId: SUSPENDED, agentInService: false, state: "unplaced", department: null },
    {
      agentId: RETIRED,
      agentInService: false,
      state: "historical",
      department: { departmentId: "d2", name: "Content", slug: "content", inService: true },
    },
    { agentId: UNKNOWN, agentInService: false, state: "unplaced", department: null },
  ],
};

const deps = (overrides: Partial<LiveMapAgentOfficeDeps> = {}): LiveMapAgentOfficeDeps => ({
  readOrganization: async () => ({ status: "unavailable", reason: "read-failed" }),
  readAgentIdentity: async () => IDENTITIES,
  readAgentOutcome: async () => OUTCOME,
  readAgentAwaiting: async () => ({
    status: "read",
    value: [{ agentId: SERVING, awaiting: 2, oldestFiledAt: "2026-10-30T00:00:00.000Z" }],
  }),
  readPeople: async () => ({ status: "unavailable", reason: "authority-unavailable", detail: "x" }),
  readPlacements: async () => ({ status: "unavailable", detail: "x" }),
  readAgentPlacements: async () => PLACEMENTS,
  now: () => new Date("2026-10-31T00:00:00.000Z"),
  ...overrides,
});

const office = (agentId: string, overrides?: Partial<LiveMapAgentOfficeDeps>): Promise<LiveMapAgentOfficeRead> =>
  readLiveMapAgentOffice(TENANT, agentId, deps(overrides));

const pageOf = (read: LiveMapAgentOfficeRead): string =>
  renderToStaticMarkup(React.createElement(AgentOfficePage, { office: read }));

const text = (markup: string): string =>
  markup
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");

const found = async (agentId: string): Promise<Extract<LiveMapAgentOfficeRead, { status: "found" }>> => {
  const read = await office(agentId);
  assert.equal(read.status, "found", `${agentId} resolves`);
  return read as Extract<LiveMapAgentOfficeRead, { status: "found" }>;
};

/* ── 1 · THE CARD IS ONE LINK ─────────────────────────────────────────────── */
async function theCardIsOneLink(): Promise<void> {
  const projection = await readLiveMapProjection(TENANT, deps());
  const markup = renderToStaticMarkup(React.createElement(LiveMapCanvas, { projection }));

  const links = markup.match(/<a [^>]*class="lm-node"[^>]*>.*?<\/a>/g) ?? [];
  assert.equal(links.length, 4, "one link per durable identity");
  assert.ok(markup.includes(`href="${agentOfficeRoute(SERVING)}"`), "the link goes to that agent's office");
  assert.ok(!/name="live-map-agent"/.test(markup), "the agents' exclusive disclosure group is gone");
  assert.ok(!markup.includes("lm-inspector"), "no inspector expands inside the map any more");

  for (const link of links) {
    const inner = link.slice(link.indexOf(">") + 1, -"</a>".length);
    for (const nested of ["<a ", "<button", "<details", "<summary", "<input", "<select"]) {
      assert.ok(!inner.includes(nested), `a card holds no nested interactive element: ${nested}`);
    }
    assert.ok(!/^<a [^>]*aria-label/.test(link), "the card's own words are its accessible name");
    assert.ok(!/^<a [^>]*tabindex/.test(link), "the link stays in natural tab order");
  }
  assert.match(text(links[0]!), /Atlas Writer/, "the name reaches the accessible name");
  assert.match(text(links[0]!), /In service/, "and so does the lifecycle word");
}

/* ── 2 · THE ROUTE IS THE IDENTITY, NEVER THE NAME ────────────────────────── */
async function theRouteIsTheIdentity(): Promise<void> {
  assert.equal(agentOfficeRoute(SERVING), `/live-map/agents/${SERVING}`);

  const renamed: DurableAgentIdentityState = {
    status: "known",
    genesisSpent: true,
    identities: [identity(SERVING, "Renamed Entirely", "in-service")],
  };
  const before = (await found(SERVING)).node;
  const after = await office(SERVING, { readAgentIdentity: async () => renamed });
  assert.equal(after.status, "found", "a rename does not break the address");
  assert.equal(after.status === "found" && after.node.officeRoute, before.officeRoute, "the route did not move");
  assert.equal(after.status === "found" && after.node.label, "Renamed Entirely", "only the words did");
}

/* ── 3 · THREE ANSWERS, AND THEY ARE THREE ────────────────────────────────── */
async function theSeamAnswersThreeSentences(): Promise<void> {
  assert.deepEqual(await office(ELSEWHERE), { status: "not-found" }, "an id outside this tenant's list");
  for (const malformed of ["", "not-a-uuid", "../../etc/passwd", `${SERVING}'--`, `${SERVING}0`, ` ${SERVING}`, `agent:${SERVING}`]) {
    assert.deepEqual(await office(malformed), { status: "not-found" }, `malformed id: ${malformed}`);
  }

  const empty = await office(SERVING, {
    readAgentIdentity: async () => ({ status: "known", genesisSpent: false, identities: [] }),
  });
  assert.deepEqual(empty, { status: "not-found" }, "a measured zero holds no office");

  const down = await office(SERVING, { readAgentIdentity: async () => ({ status: "unavailable" }) });
  assert.equal(down.status, "unavailable", "an unread authority is never not-found");

  const threw = await office(SERVING, {
    readAgentIdentity: async () => {
      throw new Error("boom");
    },
  });
  assert.equal(threw.status, "unavailable", "and neither is one that threw");

  const noTenant = await readLiveMapAgentOffice(null, SERVING, deps({ readAgentIdentity: undefined }));
  assert.equal(noTenant.status, "unavailable", "no tenant reads nothing and claims nothing");

  const page = pageOf(down);
  assert.match(text(page), /could not read/i, "the page says the authority did not answer");
  assert.ok(page.includes('href="/live-map"'), "and still offers the way back");
  assert.ok(!/not found/i.test(text(page)), "it does not read as an absent agent");
}

/* ── 4 · THE NOT-FOUND PAGE CANNOT TELL ONE ABSENCE FROM ANOTHER ──────────── */
function notFoundSaysNothingSpecific(): void {
  const markup = renderToStaticMarkup(React.createElement(AgentOfficeNotFound));
  assert.ok(markup.includes('href="/live-map"'), "the way back is offered");
  assert.ok(markup.includes("data-live-map"), "inside the Live Map's dark scope");
  assert.ok(!/[0-9a-f]{8}-[0-9a-f]{4}/i.test(markup), "no identifier is echoed");
  assert.ok(!/tenant|organization|another/i.test(text(markup)), "and no reason is offered");
}

/* ── 5 · EVERY LIFECYCLE STATE, AS THE AUTHORITY SAID IT ──────────────────── */
async function everyLifecycleStateRenders(): Promise<void> {
  const expected: readonly [string, string, string][] = [
    [SERVING, "In service", "active"],
    [SUSPENDED, "Suspended", "suspended"],
    [RETIRED, "Retired", "retired"],
    [UNKNOWN, "Status unknown", "indeterminate"],
  ];
  for (const [agentId, label, tone] of expected) {
    const markup = pageOf(await found(agentId));
    assert.ok(markup.includes(`data-tone="${tone}"`), `${label}: the tone is the authority's`);
    assert.ok(text(markup).includes(label), `${label}: the word is printed`);
    for (const claim of [/\bworking on\b/i, /\bis working\b/i, /\bbusy\b/i, /\bonline\b/i, /\bexecuting now\b/i]) {
      assert.ok(!claim.test(text(markup)), `${label}: nothing claims activity (${claim})`);
    }
  }
}

/* ── 6 · THE PAGE'S SECTIONS, IN ORDER ────────────────────────────────────── */
async function thePageHasItsSections(): Promise<void> {
  const markup = pageOf(await found(SERVING));
  assert.ok(markup.includes("data-live-map"), "the page sits in the Live Map's dark scope");
  const order = [
    'href="/live-map"',
    "<h1",
    'data-tone="active"',
    'data-office-hero',
    "Team &amp; Subagents",
    "Filed",
    "Details",
  ].map((needle) => markup.indexOf(needle));
  assert.ok(order.every((at) => at >= 0), `every section is present: ${order}`);
  assert.deepEqual(order, [...order].sort((a, b) => a - b), "and in the agreed order");
  assert.equal((markup.match(/<h1/g) ?? []).length, 1, "one page heading");
  assert.match(markup, /<h1[^>]*>Atlas Writer<\/h1>/, "and it is the agent's name");

  const back = markup.match(/<a [^>]*href="\/live-map"[^>]*>.*?<\/a>/)?.[0] ?? "";
  assert.match(text(back), /Live Map/, "the way back says where it goes");
  assert.match(back, /aria-hidden="true"[^>]*>←/, "and the arrow is not read aloud");

  /* A 44px target on every width, kept in the stylesheet so a phone cannot lose it to a media query. */
  const stylesheet = readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");
  const rule = stylesheet.match(/\[data-live-map\] \.lm-office-back \{[^}]*\}/)?.[0] ?? "";
  assert.match(rule, /min-height: 2\.75rem;/, "the way back is at least 44px tall");
  assert.match(rule, /min-width: 2\.75rem;/, "and at least 44px wide");
  assert.match(rule, /display: inline-flex;/, "and the box is real, so the area is the link's own");

  const hero = markup.slice(markup.indexOf("data-office-hero"));
  assert.ok(!/<img|<video/.test(hero.slice(0, hero.indexOf("</figure>"))), "no image is bound yet");
  assert.ok(/aria-hidden="true"/.test(hero), "the drawing is decoration");
}

/* ── 7 · THREE COUNTS, OR A SENTENCE. NEVER ZEROS OVER AN UNREAD READ ─────── */
async function theHeadlineCountsAreReal(): Promise<void> {
  const markup = text(pageOf(await found(SERVING)));
  assert.match(markup, /11 Filed/, "the filed count is the observation's");
  assert.match(markup, /5 Approved/, "so is the approved count");
  assert.match(markup, /13 Never executed/, "and the unexecuted count");

  const unread = await office(SERVING, {
    readAgentOutcome: async () => ({ status: "unavailable", reason: "read-failed" }),
  });
  const words = text(pageOf(unread));
  assert.ok(!/\b0 (Filed|Approved|Never executed)\b/.test(words), "an unread observation prints no zero");
  assert.match(words, /could not read this agent's outcome evidence/i, "it says so instead");

  const notObserved = text(pageOf(await found(SUSPENDED)));
  assert.ok(!/\b0 (Filed|Approved|Never executed)\b/.test(notObserved), "no entry is not a measured zero");
}

/* ── 8 · NO AUTHORITY IS NOT ZERO, AND A DEPARTMENT IS NOT A TEAM ─────────── */
async function theTeamPanelClaimsNothing(): Promise<void> {
  const placed = text(pageOf(await found(SERVING)));
  assert.ok(placed.includes(LIVE_MAP_TEAM_RELATION_ABSENT), "the relationship has no owner, and it says so");
  assert.ok(!/\b0\s+(sub-?agents?|team|members?)\b/i.test(placed), "no measured-looking zero");
  assert.match(placed, /Department placement/, "the department is a separate fact");
  assert.match(placed, /Engineering/, "named by the authority");
  assert.match(placed, /not a team/i, "and denied as a team");

  assert.match(text(pageOf(await found(SUSPENDED))), /no recorded department/i, "unplaced is a sentence");
  assert.match(text(pageOf(await found(RETIRED))), /not a current placement/i, "historical is not current");

  const unread = await office(SERVING, { readAgentPlacements: async () => ({ status: "unavailable" }) });
  assert.equal(unread.status, "found", "an unreadable placement does not lose the agent");
  const unreadWords = text(pageOf(unread));
  assert.match(unreadWords, /could not read this agent's department/i, "it is its own sentence");
  assert.ok(!/no recorded department/i.test(unreadWords), "and is not read as unplaced");

  const threw = await office(SERVING, {
    readAgentPlacements: async () => {
      throw new Error("boom");
    },
  });
  assert.equal(threw.status, "found", "a thrown placement read is contained too");

  const missing = await office(SERVING, {
    readAgentPlacements: async () => ({ status: "available", placements: [] }),
  });
  assert.match(text(pageOf(missing)), /could not read this agent's department/i, "no row is not unplaced");
}

/* ── 9 · EVERYTHING THE INSPECTOR PRINTED IS STILL PRINTED ────────────────── */
async function theInspectorMovedAndLostNothing(): Promise<void> {
  const read = await found(SERVING);
  const words = text(pageOf(read));
  const details = text(pageOf(read).slice(pageOf(read).lastIndexOf(">Details<")));
  const node = read.node;
  assert.equal(node.intelligence?.status, "observed");
  if (node.intelligence?.status !== "observed") return;

  for (const line of node.detail) assert.ok(details.includes(line), `identity line: ${line}`);
  assert.ok(details.includes(node.truth), "the node's truth class");
  assert.ok(details.includes(node.sourceAuthority), "and its authority");
  assert.ok(details.includes(node.intelligence.truthClass), "the attachment's truth class");
  assert.ok(details.includes(node.intelligence.sourceAuthority), "and its own authority");
  assert.ok(details.includes(node.intelligence.basis), "the basis");
  for (const group of node.intelligence.groups) {
    assert.ok(details.includes(group.label), `group ${group.label}`);
    for (const measure of group.measures) {
      assert.ok(details.includes(`${measure.label} ${measure.value}`), `${group.label}/${measure.label}`);
      if (measure.note) assert.ok(details.includes(measure.note), `note for ${measure.label}`);
    }
  }
  for (const claim of node.intelligence.nonClaims) assert.ok(details.includes(claim), `non-claim: ${claim}`);
  assert.ok(node.attention, "this agent has something awaiting");
  for (const measure of node.attention!.measures) {
    assert.ok(details.includes(measure.label), measure.label);
    assert.ok(details.includes(measure.value), measure.value);
    assert.ok(details.includes(measure.basis), measure.basis);
  }
  assert.ok(pageOf(read).includes('href="/agents"'), "the registry stays reachable");
  assert.ok(words.includes(read.freshness), "the page says what kind of reading this is");
}

/* ── 10 · A THEME IS A COSMETIC CHOICE OVER A PLACEMENT, AND NOTHING ELSE ─── */
function theThemeHasOneInput(): void {
  const placed = (slug: string) => ({
    status: "available" as const,
    state: "placed" as const,
    department: { departmentId: "d", name: slug, slug, inService: true },
  });
  assert.equal(officeThemeFor(placed("engineering")), "engineering");
  assert.equal(officeThemeFor(placed("content")), "content");
  assert.equal(officeThemeFor(placed("security")), "security");
  assert.equal(officeThemeFor(placed("heby")), "neutral", "a slug nobody mapped is neutral");
  assert.equal(officeThemeFor(placed("ENGINEERING")), "neutral", "exact, never fuzzy");
  assert.equal(officeThemeFor({ status: "unavailable" }), "neutral", "an unread placement is neutral");
  for (const state of ["unplaced", "historical", "placed-in-retired-department"] as const) {
    assert.equal(
      officeThemeFor({ ...placed("engineering"), state }),
      "neutral",
      `${state} is not a current placement`,
    );
  }
  assert.equal(officeThemeFor.length, 1, "it takes the placement and nothing else");
}

async function main(): Promise<void> {
  await theCardIsOneLink();
  await theRouteIsTheIdentity();
  await theSeamAnswersThreeSentences();
  notFoundSaysNothingSpecific();
  await everyLifecycleStateRenders();
  await thePageHasItsSections();
  await theHeadlineCountsAreReal();
  await theTeamPanelClaimsNothing();
  await theInspectorMovedAndLostNothing();
  theThemeHasOneInput();
  console.log("live-map-experience — agent office checks passed");
}

void main();
