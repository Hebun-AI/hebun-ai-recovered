/*
 * L4 — LIVE MAP CORE v1. WHAT THE MAP SAYS, AND WHAT IT REFUSES TO SAY.
 *
 * Live Map's danger is not that it reads the wrong row. It is that a picture is persuasive: an
 * empty region reads as "there is nothing here", a line between two boxes reads as "these are
 * related", and neither claim needs anybody to write it down. This suite drives every domain state
 * and every edge condition and proves the map states its own limits instead of implying them.
 *
 * Pure: both authorities are injected, so no database, no network, no provider.
 */
import assert from "node:assert/strict";
import {
  LIVE_MAP_PEOPLE_ABSENT,
  LIVE_MAP_PROJECTION_MODEL,
  LIVE_MAP_STRUCTURE_ABSENT,
  type LiveMapDomain,
  type LiveMapProjection,
} from "../../src/features/live-map/contracts";
import { readLiveMapProjection } from "../../src/features/live-map/read-live-map.server";
import type { OrganizationAuthorityRead } from "../../src/features/organization-authority/contracts";
import { ORGANIZATION_STRUCTURE_UNAVAILABLE } from "../../src/features/organization-authority/contracts";
import type { DurableAgentIdentityState } from "../../src/features/agent-identity/read-durable-agent-identity.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const TENANT = { tenantId: "tenant-l4", userId: "user-l4" } as unknown as TenantContext;

const ORGANIZATION: OrganizationAuthorityRead = {
  status: "available",
  organization: {
    organizationId: "tenant-l4",
    name: "Acme Operating Company",
    slug: "acme",
    lifecycleStatus: "active",
    tenantStatus: "active",
    provenance: "production-operator-ceremony",
    provenanceDetail: "Created by the production operator provisioning ceremony.",
    humanMemberCount: 3,
    structure: ORGANIZATION_STRUCTURE_UNAVAILABLE,
  },
};

const AGENTS_KNOWN = (inService: boolean): DurableAgentIdentityState => ({
  status: "known",
  genesisSpent: true,
  identities: [
    {
      agentId: "agent-1",
      name: "Sourcing Analyst",
      humanOwnerId: "human-1",
      humanOwnerType: "human",
      createdAt: "2026-06-01T00:00:00.000Z",
      retiredAt: inService ? null : "2026-08-01T00:00:00.000Z",
      inService,
    },
  ],
});

const read = (
  organization: OrganizationAuthorityRead,
  agents: DurableAgentIdentityState,
): Promise<LiveMapProjection> =>
  readLiveMapProjection(TENANT, {
    readOrganization: async () => organization,
    readAgentIdentity: async () => agents,
  });

const domain = (projection: LiveMapProjection, id: string): LiveMapDomain => {
  const found = projection.domains.find((d) => d.domainId === id);
  assert.ok(found, `${id} is a represented domain`);
  return found!;
};

/* ── 1 · EVERY DOMAIN IS REPRESENTED, EVEN THE ONES WITH NOTHING IN THEM ───── */
async function everyDomainIsNamed(): Promise<void> {
  const projection = await read(ORGANIZATION, AGENTS_KNOWN(true));
  assert.deepEqual(
    projection.domains.map((d) => d.domainId),
    ["organization", "agents", "structure", "people"],
    "the map names every domain it represents, including the ones it cannot fill",
  );
  /*
   * OMISSION IS A CLAIM. A map that simply leaves departments out reads as an organization that
   * has none, so structure and people are present with a stated reason instead.
   */
  assert.equal(domain(projection, "structure").state.status, "no-authority");
  assert.equal(domain(projection, "people").state.status, "no-authority");
}

/* ── 2 · FOUR STATES, AND THEY DO NOT COLLAPSE INTO EACH OTHER ─────────────── */
async function theFourStatesStayDistinct(): Promise<void> {
  const available = await read(ORGANIZATION, AGENTS_KNOWN(true));
  assert.equal(domain(available, "agents").state.status, "available");

  /* KNOWN EMPTY — the authority answered, and the answer is genuinely zero. */
  const empty = await read(ORGANIZATION, { status: "known", genesisSpent: false, identities: [] });
  const emptyAgents = domain(empty, "agents").state;
  assert.equal(emptyAgents.status, "known-empty");
  if (emptyAgents.status !== "known-empty") throw new Error("unreachable");
  assert.match(emptyAgents.detail, /measured zero/, "and it says why it is a zero and not a gap");

  /* UNAVAILABLE — the authority could not be reached. A different sentence entirely. */
  const unreachable = await read(ORGANIZATION, { status: "unavailable" });
  const unreachableAgents = domain(unreachable, "agents").state;
  assert.equal(unreachableAgents.status, "unavailable");
  if (unreachableAgents.status !== "unavailable") throw new Error("unreachable");
  assert.match(
    unreachableAgents.detail,
    /not an organization without agents/,
    "an unreadable authority is never rendered as an absence of agents",
  );

  /* And the two never share a rendering. */
  assert.notEqual(emptyAgents.detail, unreachableAgents.detail);
}

/* ── 3 · AN UNAVAILABLE ORGANIZATION IS NEVER A NAMELESS ONE ──────────────── */
async function organizationUnavailableIsNotAnEmptyOrganization(): Promise<void> {
  for (const reason of [
    "no-tenant",
    "persistence-not-configured",
    "organization-not-found",
    "read-failed",
  ] as const) {
    const projection = await read({ status: "unavailable", reason }, AGENTS_KNOWN(true));
    const state = domain(projection, "organization").state;
    assert.equal(state.status, "unavailable", `${reason} is unavailable`);
    if (state.status !== "unavailable") throw new Error("unreachable");
    assert.equal(state.reason, reason, "L3's reason travels unchanged");
    assert.ok(
      !Object.prototype.hasOwnProperty.call(state, "nodes"),
      `${reason}: an unavailable organization carries no node`,
    );
  }
}

/* ── 4 · A THROWN AUTHORITY IS CONTAINED, NOT PROPAGATED ──────────────────── */
async function oneBrokenAuthorityDoesNotBlankTheMap(): Promise<void> {
  const projection = await readLiveMapProjection(TENANT, {
    readOrganization: async () => {
      throw new Error("organization authority unreachable");
    },
    readAgentIdentity: async () => AGENTS_KNOWN(true),
  });
  assert.equal(domain(projection, "organization").state.status, "unavailable");
  assert.equal(
    domain(projection, "agents").state.status,
    "available",
    "the other authority keeps its real answer",
  );

  const inverse = await readLiveMapProjection(TENANT, {
    readOrganization: async () => ORGANIZATION,
    readAgentIdentity: async () => {
      throw new Error("agent authority unreachable");
    },
  });
  assert.equal(domain(inverse, "organization").state.status, "available");
  assert.equal(domain(inverse, "agents").state.status, "unavailable");
}

/* ── 5 · THE ONE EDGE, AND EVERY CONDITION THAT WITHHOLDS IT ──────────────── */
async function edgesAreDrawnOnlyWhenProven(): Promise<void> {
  const both = await read(ORGANIZATION, AGENTS_KNOWN(true));
  assert.equal(both.edges.length, 1, "one agent, one proven relationship");
  const edge = both.edges[0]!;
  assert.equal(edge.relation, "belongs-to");
  assert.equal(edge.fromNodeId, "agent:agent-1");
  assert.equal(edge.toNodeId, "organization:tenant-l4");
  assert.match(edge.basis, /agents\.tenant_id/, "the edge names the durable column that proves it");
  /*
   * AND IT DISCLAIMS WHAT IT DOES NOT PROVE. `agents.human_owner_id` is durable and this edge is
   * not about it; no departmental placement exists to claim at all.
   */
  assert.match(edge.basis, /No departmental placement, ownership or assignment is claimed/);

  /* No organization on the map: the relationship has no visible far end, so nothing is drawn. */
  const noOrg = await read({ status: "unavailable", reason: "read-failed" }, AGENTS_KNOWN(true));
  assert.deepEqual(noOrg.edges, [], "an edge is never drawn to a node the reader cannot see");

  /* No agents: nothing to relate. */
  const noAgents = await read(ORGANIZATION, { status: "known", genesisSpent: false, identities: [] });
  assert.deepEqual(noAgents.edges, [], "a known-empty domain produces no edges");

  const unreadable = await read(ORGANIZATION, { status: "unavailable" });
  assert.deepEqual(unreadable.edges, [], "an unreadable domain produces no edges");

  /* Every edge endpoint that IS drawn exists as a node on the map. */
  const ids = new Set(
    both.domains.flatMap((d) => (d.state.status === "available" ? d.state.nodes.map((n) => n.nodeId) : [])),
  );
  for (const e of both.edges) {
    assert.ok(ids.has(e.fromNodeId), `${e.fromNodeId} is on the map`);
    assert.ok(ids.has(e.toNodeId), `${e.toNodeId} is on the map`);
  }
}

/* ── 6 · A RETIRED AGENT IS NEVER SHOWN AS A WORKING ONE ──────────────────── */
async function retirementIsVisible(): Promise<void> {
  const retired = await read(ORGANIZATION, AGENTS_KNOWN(false));
  const state = domain(retired, "agents").state;
  assert.equal(state.status, "available");
  if (state.status !== "available") throw new Error("unreachable");
  const node = state.nodes[0]!;
  assert.match(node.detail.join(" "), /Retired/, "a retired identity says so on the map");
  assert.match(node.detail.join(" "), /it is not working/, "and says what that means");

  const serving = await read(ORGANIZATION, AGENTS_KNOWN(true));
  const servingState = serving.domains.find((d) => d.domainId === "agents")!.state;
  if (servingState.status !== "available") throw new Error("unreachable");
  assert.match(servingState.nodes[0]!.detail.join(" "), /In service/);
}

/* ── 7 · PEOPLE ARE COUNTED, NEVER PLACED ─────────────────────────────────── */
async function membershipIsNotStructure(): Promise<void> {
  const projection = await read(ORGANIZATION, AGENTS_KNOWN(true));
  const org = domain(projection, "organization").state;
  if (org.status !== "available") throw new Error("unreachable");
  assert.match(org.nodes[0]!.detail.join(" "), /Human members: 3/, "the count is an organization property");

  const people = domain(projection, "people").state;
  assert.equal(people.status, "no-authority");
  if (people.status !== "no-authority") throw new Error("unreachable");
  assert.equal(people.detail, LIVE_MAP_PEOPLE_ABSENT);
  assert.match(people.detail, /no departmental placement/, "membership is never relabelled as placement");

  const structure = domain(projection, "structure").state;
  if (structure.status !== "no-authority") throw new Error("unreachable");
  assert.equal(structure.detail, LIVE_MAP_STRUCTURE_ABSENT);
  assert.match(
    structure.detail,
    /absent authority, not an organization without them/,
    "no-authority is never rendered as a known zero",
  );
}

/* ── 8 · EVERY NODE IS AUTHORITATIVE, AND SAYS WHO OWNS IT ────────────────── */
async function everyNodeIsAdmissible(): Promise<void> {
  const projection = await read(ORGANIZATION, AGENTS_KNOWN(true));
  const nodes = projection.domains.flatMap((d) =>
    d.state.status === "available" ? d.state.nodes : [],
  );
  assert.ok(nodes.length > 0, "there are nodes to check");
  for (const node of nodes) {
    assert.equal(node.truth, "authoritative", `${node.nodeId} is authoritative`);
    assert.ok(node.sourceAuthority.length > 0, `${node.nodeId} names its owning authority`);
    assert.ok(
      !/Live Map/i.test(node.sourceAuthority),
      `${node.nodeId}: Live Map is never named as the authority for a fact it draws`,
    );
    assert.match(node.nodeId, /^(organization|agent):/, "a node id is kind-prefixed projection identity");
  }
}

/* ── 9 · NO REAL-TIME CLAIM, AND NO INVENTED TIMESTAMP ────────────────────── */
async function noRealTimeClaim(): Promise<void> {
  const projection = await read(ORGANIZATION, AGENTS_KNOWN(true));
  assert.match(projection.freshness, /not a stream/, "the surface says what this reading is");
  const json = JSON.stringify(projection);
  for (const banned of ["real-time", "realtime", "live update", "auto-refresh", "streaming"]) {
    assert.ok(!json.toLowerCase().includes(banned), `the projection must not claim "${banned}"`);
  }
  assert.equal(LIVE_MAP_PROJECTION_MODEL.realTime, false);
}

/* ── 10 · NO FABRICATED SECURITY, GOVERNANCE OR WORK STATE ────────────────── */
async function noFabricatedDomains(): Promise<void> {
  const projection = await read(ORGANIZATION, AGENTS_KNOWN(true));
  const json = JSON.stringify(projection).toLowerCase();
  for (const banned of [
    "incident",
    "finding",
    "threat",
    "risk score",
    "trust score",
    "security score",
    "policy",
    "workload",
    "goal progress",
    "utilization",
    "health score",
  ]) {
    assert.ok(!json.includes(banned), `Core must not project "${banned}"`);
  }
  assert.equal(LIVE_MAP_PROJECTION_MODEL.ownsDomainTruth, false);
  assert.equal(LIVE_MAP_PROJECTION_MODEL.persistsProjection, false);
  assert.equal(LIVE_MAP_PROJECTION_MODEL.writerCreated, false);
  assert.equal(LIVE_MAP_PROJECTION_MODEL.authorizesAction, false);
  assert.equal(LIVE_MAP_PROJECTION_MODEL.executesAction, false);
  assert.ok(Object.isFrozen(LIVE_MAP_PROJECTION_MODEL));
}

async function main(): Promise<void> {
  await everyDomainIsNamed();
  await theFourStatesStayDistinct();
  await organizationUnavailableIsNotAnEmptyOrganization();
  await oneBrokenAuthorityDoesNotBlankTheMap();
  await edgesAreDrawnOnlyWhenProven();
  await retirementIsVisible();
  await membershipIsNotStructure();
  await everyNodeIsAdmissible();
  await noRealTimeClaim();
  await noFabricatedDomains();
  console.log("l4 live map — projection truth checks passed");
}

void main();
