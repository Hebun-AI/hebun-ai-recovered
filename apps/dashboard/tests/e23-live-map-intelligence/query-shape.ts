/*
 * E2-3 — THE SHAPE OF THE READ, MEASURED RATHER THAN PROMISED.
 *
 * The obvious way to hang outcome numbers on a map is the wrong one: walk the agent nodes and, for
 * each, ask what it proposed. That reads correctly, renders correctly, and multiplies the
 * organization's database work by its headcount — a defect no assertion about VALUES can see,
 * because every value is right.
 *
 * So this measures the shape directly. A counting database handle records every statement issued,
 * the same read runs against one agent and against sixty, and the counts must be equal.
 *
 *     ONE READ FOR THE ORGANIZATION != ONE READ PER AGENT
 *
 * It also proves the KEY survives the whole path — composer to Live Map seam — because a projection
 * that loses the id has nothing left to join on but a name.
 *
 * No real database: the handle is a fake that counts.
 */
import "../../src/db/schema";
import assert from "node:assert/strict";
import type { ControlPlaneDatabase } from "../../src/db/client.server";
import { composeAgentOutcomes } from "../../src/features/agent-outcome-observation/agent-outcome-projection.server";
import { readLiveMapAgentOutcome } from "../../src/features/agent-outcome-observation/live-map-agent-outcome.server";
import { readLiveMapProjection } from "../../src/features/live-map/read-live-map.server";
import type { DurableAgentIdentityRecord } from "../../src/features/agent-identity/read-durable-agent-identity.server";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";

const TENANT = asHumanTenantContext({
  tenantId: "11111111-1111-4111-8111-111111111111",
  userId: "22222222-2222-4222-8222-222222222222",
  authIdentityId: "33333333-3333-4333-8333-333333333333",
  membershipId: "44444444-4444-4444-8444-444444444444",
  membershipVersion: 1,
  roleId: "55555555-5555-4555-8555-555555555555",
  sessionContextId: "66666666-6666-4666-8666-666666666666",
  provider: "local",
  assuranceLevel: "aal1",
  mfaVerified: false,
  requestId: "e23-query-shape",
  authenticatedAt: new Date(0).toISOString(),
});

const agentId = (n: number): string =>
  `${String(n).padStart(8, "0")}-0000-4000-8000-000000000000`;

interface AgentRow {
  readonly id: string;
  readonly name: string;
  readonly humanOwnerId: string | null;
  readonly humanOwnerType: string | null;
  readonly createdAt: Date;
  readonly retiredAt: Date | null;
  readonly lifecycle: string;
}

const agentRows = (count: number): readonly AgentRow[] =>
  Array.from({ length: count }, (_unused, i) => ({
    id: agentId(i + 1),
    name: `Agent ${i + 1}`,
    humanOwnerId: null,
    humanOwnerType: null,
    createdAt: new Date(0),
    retiredAt: null,
    lifecycle: "active",
  }));

/**
 * A handle that answers nothing and remembers everything.
 *
 * `select(...).from(...).where(...).orderBy(...)` is the identity authority's own chain, and
 * `execute(...)` is how every aggregate statement is issued. Both are recorded, so the count below
 * is the real number of round trips this read would make.
 */
function countingDb(rows: readonly AgentRow[]): {
  readonly db: ControlPlaneDatabase;
  readonly statements: string[];
} {
  const statements: string[] = [];
  const db = {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: async () => {
            statements.push("select:agents");
            return rows;
          },
        }),
      }),
    }),
    execute: async () => {
      statements.push("execute:aggregate");
      return { rows: [] };
    },
  } as unknown as ControlPlaneDatabase;
  return { db, statements };
}

/* ── 1 · THE STATEMENT COUNT IS A PROPERTY OF THE READ, NOT OF THE ORG ────── */
async function theReadDoesNotGrowWithTheOrganization(): Promise<void> {
  const one = countingDb(agentRows(1));
  const many = countingDb(agentRows(60));

  const readOne = await readLiveMapAgentOutcome(TENANT, { getDb: () => one.db });
  const readMany = await readLiveMapAgentOutcome(TENANT, { getDb: () => many.db });

  assert.equal(readOne.status, "read", "the fake handle answered");
  assert.equal(readMany.status, "read", "for both sizes");

  assert.equal(
    one.statements.length,
    many.statements.length,
    `sixty agents must cost what one costs — got ${one.statements.length} vs ${many.statements.length}`,
  );

  /*
   * AND THE NUMBER IS PINNED, not merely equal. One identity read plus eight grouped aggregates.
   * Pinning it means a tenth statement arrives as a failure here rather than as a slow page.
   */
  assert.equal(one.statements.length, 9, "one identity read and eight grouped aggregates");
  assert.equal(
    one.statements.filter((s) => s === "select:agents").length,
    1,
    "the identity authority is read once",
  );
  assert.equal(
    one.statements.filter((s) => s === "execute:aggregate").length,
    8,
    "and every aggregate is issued once, grouped, for the whole organization",
  );
}

/* ── 2 · THE MAP ISSUES THE OUTCOME READ EXACTLY ONCE ─────────────────────── */
async function liveMapReadsTheEvidenceOnce(): Promise<void> {
  let calls = 0;
  const identities: readonly DurableAgentIdentityRecord[] = agentRows(40).map((row) => ({
    agentId: row.id,
    name: row.name,
    humanOwnerId: null,
    humanOwnerType: null,
    createdAt: row.createdAt.toISOString(),
    retiredAt: null,
    inService: true,
  }));

  const projection = await readLiveMapProjection(TENANT, {
    readOrganization: async () => ({ status: "unavailable", reason: "read-failed" }),
    readAgentIdentity: async () => ({ status: "known", genesisSpent: true, identities }),
    readAgentOutcome: async () => {
      calls += 1;
      return { status: "read", byAgentId: new Map(), unresolvedAgentProposals: 0 };
    },
  });

  assert.equal(calls, 1, "forty agent nodes, one outcome read — the attachment is a map lookup");
  const agents = projection.domains.find((d) => d.domainId === "agents")!.state;
  if (agents.status !== "available") throw new Error("unreachable");
  assert.equal(agents.nodes.length, 40, "and every node still got its attachment decision");
}

/* ── 3 · THE KEY SURVIVES THE COMPOSER ────────────────────────────────────── */
function theComposerKeysByDurableId(): void {
  const identities: readonly DurableAgentIdentityRecord[] = [
    {
      agentId: agentId(1),
      /* TWO IDENTITIES, ONE NAME. The key must be the id, or these two become one. */
      name: "Twin",
      humanOwnerId: null,
      humanOwnerType: null,
      createdAt: new Date(0).toISOString(),
      retiredAt: null,
      inService: true,
    },
    {
      agentId: agentId(2),
      name: "Twin",
      humanOwnerId: null,
      humanOwnerType: null,
      createdAt: new Date(0).toISOString(),
      retiredAt: null,
      inService: true,
    },
  ];

  const composed = composeAgentOutcomes({
    identities,
    proposals: [
      {
        agentId: agentId(2),
        filed: 9,
        pending: 1,
        approved: 2,
        rejected: 3,
        withdrawn: 4,
        withInvocationLink: 5,
        withoutInvocationLink: 4,
      },
      /* A proposal for an agent the identity read did not return: counted, never discarded. */
      {
        agentId: agentId(99),
        filed: 7,
        pending: 7,
        approved: 0,
        rejected: 0,
        withdrawn: 0,
        withInvocationLink: 0,
        withoutInvocationLink: 7,
      },
    ],
    permits: [],
    executions: [],
    invocations: [],
    distribution: [],
    selection: [],
  });

  assert.deepEqual(
    [...composed.byAgentId.keys()],
    [agentId(1), agentId(2)],
    "the index is keyed by the identity authority's own ids, in identity order",
  );
  assert.equal(composed.byAgentId.get(agentId(1))!.activity.proposalsFiled, 0, "the twin filed none");
  assert.equal(composed.byAgentId.get(agentId(2))!.activity.proposalsFiled, 9, "the other filed nine");
  assert.equal(composed.unresolvedAgentProposals, 7, "the unplaceable proposals are counted");

  /* The list and the index are two views of ONE pairing, never two derivations. */
  assert.equal(composed.agents.length, composed.byAgentId.size);
  assert.deepEqual([...composed.byAgentId.values()], composed.agents);
}

/* ── 4 · AND THE KEY SURVIVES THE LIVE MAP SEAM ───────────────────────────── */
async function theSeamKeysByDurableId(): Promise<void> {
  const rows = agentRows(3);
  const { db } = countingDb(rows);
  const read = await readLiveMapAgentOutcome(TENANT, { getDb: () => db });
  assert.equal(read.status, "read");
  if (read.status !== "read") throw new Error("unreachable");

  assert.deepEqual(
    [...read.byAgentId.keys()],
    rows.map((r) => r.id),
    "the seam hands back the durable agent ids it was given, unchanged",
  );
  for (const [key, value] of read.byAgentId) {
    assert.equal(value.agentId, key, "the entry carries the key it is filed under");
  }
}

/* ── 5 · AN UNREADABLE STORE IS UNAVAILABLE, NEVER A SET OF ZEROS ─────────── */
async function anUnreadableStoreIsUnavailable(): Promise<void> {
  const noStore = await readLiveMapAgentOutcome(TENANT, { getDb: () => null });
  assert.equal(noStore.status, "unavailable", "an unreadable store never renders as measured zeros");

  const noTenant = await readLiveMapAgentOutcome(null);
  assert.equal(noTenant.status, "unavailable");
  assert.equal(
    noTenant.status === "unavailable" ? noTenant.reason : "",
    "no-authorized-tenant-context",
    "no authorized tenant means no evidence, decided before any statement is issued",
  );
}

async function main(): Promise<void> {
  await theReadDoesNotGrowWithTheOrganization();
  await liveMapReadsTheEvidenceOnce();
  theComposerKeysByDurableId();
  await theSeamKeysByDurableId();
  await anUnreadableStoreIsUnavailable();
  console.log("e23 live map intelligence — query shape checks passed");
}

void main();
