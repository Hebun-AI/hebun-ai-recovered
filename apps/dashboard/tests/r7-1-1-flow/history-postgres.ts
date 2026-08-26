/*
 * R7.1.1 — THE DRILL-THROUGH AGAINST REAL POSTGRES.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "The page shows only the asking tenant's acts, in a deterministic order, bounded — and the
 *    total it reports is the tenant's WHOLE ledger, not the size of the page."
 *
 * Runs against a DISPOSABLE database this file creates, migrates and drops. Canonical is never
 * opened: the harness claims `DATABASE_URL` for the duration and restores it on drop.
 *
 * ── WHY THE FIXTURE IS LARGER THAN THE BOUND ─────────────────────────────────
 *
 * Tenant A holds far more acts than `RECORDED_ACT_PAGE_LIMIT`. A fixture at or below the bound
 * could not tell a correct bound from a missing one, and could never catch a `total` quietly
 * derived from `acts.length` — which is the specific untruth this phase exists to prevent.
 */
import assert from "node:assert/strict";
import { Client, Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { readRecordedActPage } from "../../src/features/governance-activity/act-history-read.server";
import { observeRecordedActHistory } from "../../src/features/governance-activity/observe.server";
import { RECORDED_ACT_PAGE_LIMIT } from "../../src/features/governance-activity/contracts";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import type { ControlPlaneDatabase } from "../../src/db/client.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const TENANT_A = "10000000-0000-4000-8000-00000000a001";
const TENANT_B = "10000000-0000-4000-8000-00000000b001";
const TENANT_EMPTY = "10000000-0000-4000-8000-00000000c001";
const ACTOR = "20000000-0000-4000-8000-000000000009";

/** Deliberately above the bound, so a missing bound and a wrong total both bite. */
const A_ACTS = RECORDED_ACT_PAGE_LIMIT * 3 + 7;

let seq = 0;
const uuid = (): string => {
  seq += 1;
  return `30000000-0000-4000-8000-${String(seq).padStart(12, "0")}`;
};

async function seedCompany(client: Client, id: string, name: string): Promise<void> {
  await client.query(`insert into companies (id, name, slug) values ($1, $2, $3)`, [
    id,
    name,
    name.toLowerCase(),
  ]);
}

async function seedAct(
  client: Client,
  act: {
    tenantId: string | null;
    action: string;
    entityType: string;
    occurredAt: string;
    result?: string;
    authoritySource?: string | null;
    simulation?: boolean;
  },
): Promise<void> {
  await client.query(
    `insert into audit_log
       (id, tenant_id, actor_type, actor_id, action, entity_type, entity_id,
        occurred_at, result, simulation, authority_source, previous_state, next_state, metadata)
     values ($1, $2, 'human', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [
      uuid(),
      act.tenantId,
      ACTOR,
      act.action,
      act.entityType,
      uuid(),
      act.occurredAt,
      act.result ?? "committed",
      act.simulation ?? false,
      act.authoritySource === undefined ? "membership" : act.authoritySource,
      /* Deliberately poisoned: if any of these ever reaches a caller, §4 fails loudly. */
      JSON.stringify({ secretPrevious: "SHOULD-NEVER-SURFACE" }),
      JSON.stringify({ secretNext: "SHOULD-NEVER-SURFACE" }),
      JSON.stringify({ apiToken: "SHOULD-NEVER-SURFACE" }),
    ],
  );
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_r711_history");
  await harness.createDatabase();
  harness.migrateDatabase();

  const client = new Client({ connectionString: harness.dbUrl });
  const pool = new Pool({ connectionString: harness.dbUrl });
  await client.connect();

  try {
    const db = drizzle(pool) as unknown as ControlPlaneDatabase;
    const getDb = () => db;

    await seedCompany(client, TENANT_A, "Acme");
    await seedCompany(client, TENANT_B, "Globex");
    await seedCompany(client, TENANT_EMPTY, "Initech");

    for (let index = 0; index < A_ACTS; index += 1) {
      await seedAct(client, {
        tenantId: TENANT_A,
        action: "onboarding.invitation.issued",
        entityType: "invitation",
        occurredAt: new Date(Date.UTC(2026, 7, 13, 0, index)).toISOString(),
      });
    }
    /* The newest act tenant A holds, and a refusal — history, not a failure. */
    await seedAct(client, {
      tenantId: TENANT_A,
      action: "governance.decision.rejected",
      entityType: "governance_decision",
      occurredAt: "2026-08-20T09:00:00.000Z",
      result: "rejected",
      authoritySource: null,
    });
    for (let index = 0; index < 9; index += 1) {
      await seedAct(client, {
        tenantId: TENANT_B,
        action: "knowledge.ratify",
        entityType: "knowledge_fact",
        occurredAt: new Date(Date.UTC(2026, 7, 21, 0, index)).toISOString(),
      });
    }
    /* A GLOBAL row: `tenant_id` is nullable. It belongs to no organization and must reach none. */
    await seedAct(client, {
      tenantId: null,
      action: "platform.control.updated",
      entityType: "provider_connectivity_control",
      occurredAt: "2026-08-25T00:00:00.000Z",
    });

    const totalA = A_ACTS + 1;

    /* ── 1 · TENANT ISOLATION ────────────────────────────────────────────── */
    {
      const a = await readRecordedActPage(TENANT_A, { getDb });
      const b = await readRecordedActPage(TENANT_B, { getDb });
      assert.ok(a && b);
      assert.equal(a!.totalRecordedActs, totalA, "A's total is A's whole ledger");
      assert.equal(b!.totalRecordedActs, 9, "B's total is B's whole ledger");
      assert.ok(
        a!.acts.every((act) => act.entityType !== "knowledge_fact"),
        "no row of B's appears in A's page",
      );
      assert.ok(
        b!.acts.every((act) => act.entityType !== "invitation"),
        "and no row of A's appears in B's page",
      );
      /* The global row belongs to nobody and reaches nobody. */
      for (const page of [a!, b!]) {
        assert.ok(
          page.acts.every((act) => act.entityType !== "provider_connectivity_control"),
          "a NULL-tenant row is not visible to any tenant",
        );
      }
      assert.equal(
        a!.totalRecordedActs + b!.totalRecordedActs,
        totalA + 9,
        "and neither total absorbed the global row",
      );
    }

    /* ── 2 · THE BOUND BITES, AND THE TOTAL IS NOT THE PAGE ──────────────── */
    {
      const a = await readRecordedActPage(TENANT_A, { getDb });
      assert.ok(a);
      assert.equal(a!.acts.length, RECORDED_ACT_PAGE_LIMIT, "the page is bounded");
      assert.equal(a!.totalRecordedActs, totalA, "the total is counted independently of the page");
      assert.notEqual(a!.acts.length, a!.totalRecordedActs, "so the two genuinely differ");
      assert.equal(a!.truncated, true, "and the page says it is truncated");
    }

    /* ── 3 · ORDERING IS NEWEST-FIRST AND DETERMINISTIC ──────────────────── */
    {
      const first = await readRecordedActPage(TENANT_A, { getDb });
      const second = await readRecordedActPage(TENANT_A, { getDb });
      assert.ok(first && second);
      assert.equal(
        first!.acts[0]!.action,
        "governance.decision.rejected",
        "the newest act is first",
      );
      assert.equal(first!.acts[0]!.result, "rejected", "and a refusal is reported as history");
      assert.equal(first!.acts[0]!.authoritySource, null, "a null authority source survives as null");
      const times = first!.acts.map((a) => a.occurredAt);
      assert.deepEqual([...times].sort().reverse(), times, "the page is newest-first");
      assert.deepEqual(
        first!.acts,
        second!.acts,
        "and two reads of one ledger return the identical page",
      );
    }

    /* ── 4 · THE WITHHELD COLUMNS NEVER LEAVE THE DATABASE ───────────────
     * Every seeded row carries poisoned jsonb. Serializing the whole page must not contain it.
     */
    {
      const a = await readRecordedActPage(TENANT_A, { getDb });
      const serialized = JSON.stringify(a);
      assert.ok(!serialized.includes("SHOULD-NEVER-SURFACE"), "no jsonb payload reaches a caller");
      for (const key of ["secretPrevious", "secretNext", "apiToken", "metadata", "previousState", "nextState"]) {
        assert.ok(!serialized.includes(key), `"${key}" is absent from the page`);
      }
      const keys = Object.keys(a!.acts[0]!).sort();
      assert.deepEqual(
        keys,
        ["action", "actorType", "authoritySource", "entityType", "occurredAt", "result", "simulation", "source"],
        "an act carries exactly the eight declared fields — no identifier, no payload",
      );
    }

    /* ── 5 · EMPTY IS ESTABLISHED, UNAVAILABLE IS NOT ────────────────────── */
    {
      const empty = await observeRecordedActHistory({ tenantId: TENANT_EMPTY } as TenantContext, { getDb });
      assert.equal(empty.status, "empty", "a tenant with no acts reads as empty, not unavailable");

      const noDb = await observeRecordedActHistory({ tenantId: TENANT_A } as TenantContext, {
        getDb: () => null,
      });
      assert.equal(noDb.status, "unavailable", "and an unreadable ledger is never empty");
    }

    /* ── 6 · READING CHANGES NOTHING ─────────────────────────────────────── */
    {
      const before = await client.query<{ n: string }>("select count(*)::text as n from audit_log");
      await readRecordedActPage(TENANT_A, { getDb });
      await observeRecordedActHistory({ tenantId: TENANT_A } as TenantContext, { getDb });
      const after = await client.query<{ n: string }>("select count(*)::text as n from audit_log");
      assert.equal(after.rows[0]!.n, before.rows[0]!.n, "the ledger is unchanged by being read");
    }

    console.log("r7-1-1-flow/history-postgres: OK");
  } finally {
    await client.end();
    await pool.end();
    await harness.dropDatabase();
  }
}

void main();
