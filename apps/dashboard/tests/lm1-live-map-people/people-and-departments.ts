/*
 * LM-1 — LIVE MAP DRAWS THIS ORGANIZATION'S PARTS AND ITS PEOPLE.
 *
 * THE SUCCESS CONDITION:
 *
 *   "Departments and people are NODES, the `works-in` relationship is an EDGE drawn only when both
 *    endpoints are on the map, and every stale sentence this map used to carry about them is gone.
 *    An unreadable register is `unavailable`, an empty one is `known-empty`, and neither is the
 *    other. Nothing here is a writer, and nothing here can reach a model."
 *
 * The pins:
 *
 *   UNAVAILABLE != EMPTY        NO EDGE      != PLACED NOWHERE
 *   MEMBERSHIP  != EMPLOYMENT   AN ORG CHART != A MEMBER LIST
 *   THE LABEL IS COMPOSED, NEVER MERGED
 *
 * Pure: no database, no network, no model. Every seam is injected.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  LIVE_MAP_DEPARTMENT_BASIS,
  LIVE_MAP_HUMAN_BASIS,
  LIVE_MAP_PEOPLE_ABSENT,
  LIVE_MAP_PEOPLE_NONE_RECORDED,
  LIVE_MAP_WORKS_IN_BASIS,
  liveMapStructureRecorded,
} from "../../src/features/live-map/contracts";
import { readLiveMapProjection } from "../../src/features/live-map/read-live-map.server";
import type { LiveMapDomain, LiveMapProjection } from "../../src/features/live-map/contracts";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const ROOT = process.cwd();
const TENANT = { tenantId: "t-1", userId: "u-1" } as unknown as TenantContext;

/* eslint-disable @typescript-eslint/no-explicit-any */
const org = (departments: readonly unknown[]) =>
  ({
    status: "available",
    organization: {
      organizationId: "t-1",
      name: "Hebun AI",
      slug: "hebun",
      lifecycleStatus: "active",
      tenantStatus: "active",
      humanMemberCount: 2,
      provenanceDetail: "provenance",
      structure: { status: "available", departments },
    },
  }) as any;

const department = (id: string, name: string, inService = true) => ({
  departmentId: id,
  name,
  slug: name.toLowerCase(),
  inService,
  owner: null,
});

const person = (id: string) => ({
  userId: id,
  membershipId: `m-${id}`,
  membershipRecordedAt: "2026-08-18T22:00:19.335Z",
});

const placement = (userId: string, departmentId: string) => ({
  placementId: `p-${userId}`,
  userId,
  departmentId,
  departmentName: "Engineering",
  departmentSlug: "engineering",
  departmentInService: true,
  currentlyActiveMember: true,
});

const deps = (o: Record<string, unknown>) =>
  ({
    readOrganization: async () => o.org ?? org([]),
    readAgentIdentity: async () => ({ status: "unavailable" }),
    readAgentOutcome: async () => ({ status: "unavailable", reason: "x" }),
    readAgentAwaiting: async () => ({ status: "unavailable", reason: "x" }),
    readPeople: async () => o.people ?? { status: "available", people: [], truncated: false, detail: "d" },
    readPlacements: async () => o.placements ?? { status: "available", placements: [], truncated: false, detail: "d" },
    resolveLabels: async () => (o.labels as ReadonlyMap<string, string>) ?? new Map(),
    now: () => new Date("2026-09-02T00:00:00Z"),
  }) as any;

const domain = (p: LiveMapProjection, id: string): LiveMapDomain => {
  const d = p.domains.find((x) => x.domainId === id);
  assert.ok(d, `the map must always account for the ${id} domain`);
  return d!;
};

async function main(): Promise<void> {
  /* ═════════════════════════════════════════════════════════════════════════
   * 1. DEPARTMENTS AND PEOPLE ARE NODES, AND THE EDGE IS DRAWN.
   * ═══════════════════════════════════════════════════════════════════════ */
  {
    const projection = await readLiveMapProjection(
      TENANT,
      deps({
        org: org([department("d-1", "Engineering"), department("d-2", "Finance", false)]),
        people: { status: "available", people: [person("u-1"), person("u-2")], truncated: false, detail: "d" },
        placements: { status: "available", placements: [placement("u-1", "d-1")], truncated: false, detail: "d" },
        labels: new Map([["u-1", "senoltr@gmail.com"]]),
      }),
    );

    const structure = domain(projection, "structure");
    assert.equal(structure.state.status, "available", "departments are DRAWN, not counted");
    if (structure.state.status !== "available") throw new Error("unreachable");
    assert.equal(structure.state.nodes.length, 2);
    assert.equal(structure.state.nodes[0]!.kind, "department");
    assert.equal(structure.state.nodes[0]!.nodeId, "department:d-1", "kind-prefixed projection id");
    assert.equal(structure.state.nodes[0]!.truth, "authoritative");
    assert.equal(structure.state.nodes[0]!.sourceAuthority, "Organization Structure Authority");
    assert.ok(structure.state.nodes[0]!.detail.includes(LIVE_MAP_DEPARTMENT_BASIS));
    /* A RETIRED DEPARTMENT IS KEPT AND SAYS SO — retirement is not deletion. */
    assert.equal(structure.state.nodes[1]!.status?.tone, "retired");
    assert.ok(structure.state.nodes[1]!.detail.some((l) => /retirement is not deletion/.test(l)));

    const people = domain(projection, "people");
    assert.equal(people.state.status, "available", "people are DRAWN — OSA-4 released the authority");
    if (people.state.status !== "available") throw new Error("unreachable");
    assert.equal(people.state.nodes.length, 2);
    assert.equal(people.state.nodes[0]!.kind, "human");
    assert.equal(people.state.nodes[0]!.label, "senoltr@gmail.com", "the PRODUCT label, composed by Identity");
    assert.equal(people.state.nodes[1]!.label, "name unavailable", "UNKNOWN REMAINS UNKNOWN — never a guess");
    assert.ok(
      people.state.nodes[1]!.detail.some((l) => l.includes("u-2")),
      "and the identifier is still there to act on",
    );
    assert.ok(people.state.nodes[0]!.detail.includes(LIVE_MAP_HUMAN_BASIS));
    assert.ok(
      people.state.nodes[0]!.detail.some((l) => /Not a hire date/.test(l)),
      "MEMBERSHIP RECORDED != HIRE DATE, on the node itself",
    );

    /* THE EDGE. Drawn once, from the human to the department, on the placement row. */
    const worksIn = projection.edges.filter((e) => e.relation === "works-in");
    assert.equal(worksIn.length, 1, "exactly the placement that exists");
    assert.equal(worksIn[0]!.fromNodeId, "human:u-1");
    assert.equal(worksIn[0]!.toNodeId, "department:d-1");
    assert.equal(worksIn[0]!.basis, LIVE_MAP_WORKS_IN_BASIS);
    assert.match(LIVE_MAP_WORKS_IN_BASIS, /department_placements/, "the edge names the durable row");
    assert.match(LIVE_MAP_WORKS_IN_BASIS, /NOT A ROLE, NOT A JOB TITLE/);
    assert.match(LIVE_MAP_WORKS_IN_BASIS, /not a statement that they do no work/,
      "NO EDGE != PLACED NOWHERE, said on the edge itself");

    /* u-2 is unplaced and therefore has NO edge — and nothing claims anything about them. */
    assert.equal(projection.edges.filter((e) => e.fromNodeId === "human:u-2").length, 0);
  }

  /* ═════════════════════════════════════════════════════════════════════════
   * 2. AN EDGE IS NEVER DRAWN INTO EMPTY SPACE.
   * ═══════════════════════════════════════════════════════════════════════ */
  {
    /* The placement names a department this organization's structure does not return. */
    const projection = await readLiveMapProjection(
      TENANT,
      deps({
        org: org([department("d-1", "Engineering")]),
        people: { status: "available", people: [person("u-1")], truncated: false, detail: "d" },
        placements: { status: "available", placements: [placement("u-1", "d-GONE")], truncated: false, detail: "d" },
      }),
    );
    assert.equal(
      projection.edges.filter((e) => e.relation === "works-in").length,
      0,
      "an endpoint that is not on the map draws NO edge, never a dangling one",
    );
    assert.equal(domain(projection, "people").state.status, "available", "and the nodes are untouched");
  }

  /* An unreadable placement register draws no edges and changes no node. */
  {
    const projection = await readLiveMapProjection(
      TENANT,
      deps({
        org: org([department("d-1", "Engineering")]),
        people: { status: "available", people: [person("u-1")], truncated: false, detail: "d" },
        placements: { status: "unavailable", detail: "down" },
      }),
    );
    assert.equal(projection.edges.filter((e) => e.relation === "works-in").length, 0);
    assert.equal(domain(projection, "people").state.status, "available");
    assert.equal(domain(projection, "structure").state.status, "available");
  }

  /* ═════════════════════════════════════════════════════════════════════════
   * 3. UNAVAILABLE != EMPTY, ON BOTH NEW DOMAINS.
   * ═══════════════════════════════════════════════════════════════════════ */
  {
    const unread = await readLiveMapProjection(
      TENANT,
      deps({ people: { status: "unavailable", reason: "not-authorized", detail: "x" } }),
    );
    const people = domain(unread, "people");
    assert.equal(people.state.status, "unavailable", "a refused or unreachable register is UNAVAILABLE");
    if (people.state.status !== "unavailable") throw new Error("unreachable");
    assert.equal(people.state.reason, "not-authorized", "and it carries the authority's own reason");
    assert.equal(people.state.detail, LIVE_MAP_PEOPLE_ABSENT);

    const empty = await readLiveMapProjection(TENANT, deps({}));
    const emptyPeople = domain(empty, "people");
    assert.equal(emptyPeople.state.status, "known-empty", "a measured empty register is an ANSWER");
    if (emptyPeople.state.status !== "known-empty") throw new Error("unreachable");
    assert.equal(emptyPeople.state.detail, LIVE_MAP_PEOPLE_NONE_RECORDED);
  }

  /* A throwing register is contained: ONE domain, never the map. */
  {
    const projection = await readLiveMapProjection(TENANT, {
      ...deps({ org: org([department("d-1", "Engineering")]) }),
      readPeople: async () => {
        throw new Error("register exploded");
      },
    } as any);
    assert.equal(domain(projection, "people").state.status, "unavailable");
    assert.equal(domain(projection, "structure").state.status, "available", "the other domains keep their answers");
    assert.equal(domain(projection, "organization").state.status, "available");
  }

  /* Legibility failing does not un-draw a person. */
  {
    const projection = await readLiveMapProjection(TENANT, {
      ...deps({ people: { status: "available", people: [person("u-1")], truncated: false, detail: "d" } }),
      resolveLabels: async () => {
        throw new Error("labels exploded");
      },
    } as any);
    const people = domain(projection, "people");
    assert.equal(people.state.status, "available");
    if (people.state.status !== "available") throw new Error("unreachable");
    assert.equal(people.state.nodes[0]!.label, "name unavailable");
  }

  /* ═════════════════════════════════════════════════════════════════════════
   * 4. THE STALE SENTENCES ARE GONE, AND THE NEW ONES SAY WHAT THEY MUST.
   * ═══════════════════════════════════════════════════════════════════════ */
  {
    /*
     * ASSERTED OVER THE SHIPPED VALUES, NOT OVER THE FILE'S PROSE.
     *
     * The first version of this check scanned contracts.ts for the stale sentences and failed on
     * the comments that RECORD the repair — the honest-prose trap this repository keeps hitting.
     * What must be true is that no sentence a reader can SEE still makes the claim, so the exported
     * constants are what is checked.
     */
    const shipped = [
      LIVE_MAP_PEOPLE_ABSENT,
      LIVE_MAP_PEOPLE_NONE_RECORDED,
      LIVE_MAP_HUMAN_BASIS,
      LIVE_MAP_DEPARTMENT_BASIS,
      LIVE_MAP_WORKS_IN_BASIS,
      liveMapStructureRecorded(1, 0),
    ].join("\n");
    for (const stale of [
      "no authority that lists them",
      "drawing them as map nodes is a later milestone",
      "still counted on the organization",
      "are not drawn as their own nodes",
    ]) {
      assert.ok(!shipped.includes(stale), `no rendered sentence still claims: "${stale}"`);
    }
    assert.match(liveMapStructureRecorded(2, 1), /2 departments in service, 1 retired/,
      "the structure sentence still states the authority's own counts");
    assert.match(LIVE_MAP_PEOPLE_ABSENT, /unknown — not absent/);
    assert.match(LIVE_MAP_PEOPLE_NONE_RECORDED, /measured absence/);
    assert.match(LIVE_MAP_HUMAN_BASIS, /MEMBERSHIP IN HEBUN IS NOT EMPLOYMENT/);
    assert.match(LIVE_MAP_HUMAN_BASIS, /not an org chart/i);

    /* THE PROJECTION IS NOT A WRITER, AND CANNOT REACH ONE. */
    const model = readFileSync(path.join(ROOT, "src/features/live-map/read-live-map.server.ts"), "utf8");
    for (const banned of [".insert(", ".update(", ".delete(", ".transaction(", "@/db/client"]) {
      assert.ok(!model.includes(banned), `the projection must not contain "${banned}"`);
    }
  }

  console.log("PASS lm1-live-map-people/people-and-departments");
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
