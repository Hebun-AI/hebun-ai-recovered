/*
 * E2-7 — WINDOWED COUNTS AGAINST REAL POSTGRES.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "A window counts every act inside [since, until) for the asking tenant and NOTHING else — not
 *    the act exactly on `until`, not the act one millisecond before `since`, and not one row of a
 *    neighbouring tenant."
 *
 * ── WHY THE BOUNDARY PROOF MUST BE HERE AND NOT AGAINST A FAKE ───────────────
 *
 * Half-open-ness is a property of the SQL comparison operators. A fake would be written to agree
 * with whatever the reader does, so it could prove only that the author was consistent. The acts
 * seeded below sit EXACTLY on both boundaries and one millisecond either side, so `gte`/`lt`
 * silently becoming `gt`/`lte` — the single most plausible edit — changes a count and fails.
 *
 * ── AND WHY TWO ADJACENT WINDOWS MUST PARTITION ──────────────────────────────
 *
 * Every seeded act is counted in exactly one of the two periods or in neither, never in both. That
 * is asserted as an arithmetic identity, because overlapping windows would double-count boundary
 * acts and both counts would still look plausible.
 *
 * Runs against a DISPOSABLE database this file creates, migrates and drops. Canonical is never
 * opened: the harness claims `DATABASE_URL` for the duration and restores it on drop.
 */
import assert from "node:assert/strict";
import { Client, Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import {
  readRecordedActWindow,
  readRecordedActWindowPair,
  observeRecordedActWindows,
} from "../../src/features/governance-activity/act-window-read.server";
import { readActWindowGroundingSource } from "../../src/features/governance-activity/heby-act-window-source.server";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import type { ControlPlaneDatabase } from "../../src/db/client.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const TENANT_A = "10000000-0000-4000-8000-00000000a001";
const TENANT_B = "10000000-0000-4000-8000-00000000b001";
const ACTOR = "20000000-0000-4000-8000-000000000009";

/* The window under test: [SINCE, UNTIL). */
const SINCE = new Date("2026-08-23T00:00:00.000Z");
const UNTIL = new Date("2026-08-30T00:00:00.000Z");

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
  tenantId: string,
  entityType: string,
  occurredAt: string,
): Promise<void> {
  await client.query(
    `insert into audit_log
       (id, tenant_id, actor_type, actor_id, action, entity_type, entity_id,
        occurred_at, result, simulation, authority_source, previous_state, next_state, metadata)
     values ($1, $2, 'human', $3, $4, $5, $6, $7, 'committed', false, 'membership', $8, $9, $10)`,
    [
      uuid(),
      tenantId,
      ACTOR,
      "knowledge.create",
      entityType,
      uuid(),
      occurredAt,
      /* Poisoned: if a withheld column ever reaches a caller, section 5 fails loudly. */
      JSON.stringify({ secretPrevious: "SHOULD-NEVER-SURFACE" }),
      JSON.stringify({ secretNext: "SHOULD-NEVER-SURFACE" }),
      JSON.stringify({ apiToken: "SHOULD-NEVER-SURFACE" }),
    ],
  );
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_e27_window");
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

    /* ── THE FOUR BOUNDARY ACTS, ONE PER POSITION ─────────────────────────── */
    /* 1ms BEFORE `since` — outside. */
    await seedAct(client, TENANT_A, "before_window", "2026-08-22T23:59:59.999Z");
    /* EXACTLY `since` — INSIDE, because the lower bound is inclusive. */
    await seedAct(client, TENANT_A, "on_since", SINCE.toISOString());
    /* Comfortably inside. */
    await seedAct(client, TENANT_A, "inside", "2026-08-26T12:00:00.000Z");
    await seedAct(client, TENANT_A, "inside", "2026-08-27T12:00:00.000Z");
    /* 1ms BEFORE `until` — inside. */
    await seedAct(client, TENANT_A, "just_inside", "2026-08-29T23:59:59.999Z");
    /* EXACTLY `until` — OUTSIDE, because the upper bound is exclusive. */
    await seedAct(client, TENANT_A, "on_until", UNTIL.toISOString());
    /* After. */
    await seedAct(client, TENANT_A, "after_window", "2026-08-31T00:00:00.000Z");

    /* A neighbouring tenant, sitting squarely inside the window. */
    for (let index = 0; index < 5; index += 1) {
      await seedAct(client, TENANT_B, "inside", "2026-08-26T12:00:00.000Z");
    }

    /* ── 1 · THE INTERVAL IS HALF-OPEN ────────────────────────────────────── */
    const window = await readRecordedActWindow(TENANT_A, { since: SINCE, until: UNTIL }, { getDb });
    assert.ok(window, "the window read must have run");
    assert.equal(
      window!.acts,
      4,
      "on-since, two inside and just-inside are counted; before-window, on-until and after are not",
    );
    const kinds = Object.fromEntries(window!.byEntityKind.map((k) => [k.entityType, k.acts]));
    assert.equal(kinds.on_since, 1, "an act exactly ON `since` is INSIDE — the bound is inclusive");
    assert.equal(kinds.inside, 2);
    assert.equal(kinds.just_inside, 1);
    assert.equal(kinds.on_until, undefined, "an act exactly ON `until` is OUTSIDE — the bound is exclusive");
    assert.equal(kinds.before_window, undefined);
    assert.equal(kinds.after_window, undefined);

    /* ── 2 · THE GROUPED COUNTS SUM TO THE INDEPENDENT TOTAL ──────────────── */
    assert.equal(
      window!.byEntityKind.reduce((sum, k) => sum + k.acts, 0),
      window!.acts,
      "the breakdown must sum to the total counted independently of it",
    );
    assert.equal(window!.since, SINCE.toISOString());
    assert.equal(window!.until, UNTIL.toISOString());

    /* ── 3 · TENANT ISOLATION ─────────────────────────────────────────────── */
    const neighbour = await readRecordedActWindow(TENANT_B, { since: SINCE, until: UNTIL }, { getDb });
    assert.equal(neighbour!.acts, 5, "the neighbour sees only its own acts");
    assert.ok(
      !window!.byEntityKind.some((k) => k.acts > 2),
      "no neighbour act leaked into tenant A's breakdown",
    );

    /* ── 4 · TWO ADJACENT WINDOWS PARTITION, NEVER OVERLAP ────────────────── */
    const pair = await readRecordedActWindowPair(TENANT_A, UNTIL, 7, { getDb });
    assert.ok(pair, "the pair read must have run");
    assert.equal(pair!.current.since, SINCE.toISOString());
    assert.equal(pair!.current.until, UNTIL.toISOString());
    assert.equal(
      pair!.previous.until,
      pair!.current.since,
      "the previous window ends exactly where the current one begins",
    );
    /*
     * `before_window` at 2026-08-22T23:59:59.999Z falls in the previous period, and it is counted
     * there exactly once. Overlapping windows would count it twice and both numbers would still
     * look reasonable.
     */
    assert.equal(pair!.previous.acts, 1, "the act just before `since` belongs to the previous period");
    assert.equal(pair!.current.acts + pair!.previous.acts, 5, "each act is counted in at most one period");

    /* ── 5 · NO WITHHELD COLUMN SURVIVES THE READ ─────────────────────────── */
    const serialized = JSON.stringify({ window, pair });
    assert.ok(!serialized.includes("SHOULD-NEVER-SURFACE"), "no poisoned payload reached a caller");
    assert.ok(
      !/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(serialized),
      "no identifier of any kind travels",
    );

    /* ── 6 · AN INVERTED OR EMPTY INTERVAL IS REFUSED, NOT COUNTED AS ZERO ── */
    assert.equal(
      await readRecordedActWindow(TENANT_A, { since: UNTIL, until: SINCE }, { getDb }),
      null,
      "an inverted interval is a caller error, not an empty period",
    );
    assert.equal(
      await readRecordedActWindow(TENANT_A, { since: SINCE, until: SINCE }, { getDb }),
      null,
      "a zero-length interval is refused rather than reported as nothing having happened",
    );
    assert.equal(
      await readRecordedActWindow("not-a-uuid", { since: SINCE, until: UNTIL }, { getDb }),
      null,
      "an id that cannot name a tenant is refused before querying",
    );

    /* ── 7 · A PERIOD WITH NOTHING IN IT IS A MEASURED ZERO ───────────────── */
    const quiet = await readRecordedActWindow(
      TENANT_A,
      { since: new Date("2026-01-01T00:00:00.000Z"), until: new Date("2026-01-08T00:00:00.000Z") },
      { getDb },
    );
    assert.ok(quiet, "a quiet period is still a successful read");
    assert.equal(quiet!.acts, 0);
    assert.deepEqual(quiet!.byEntityKind, [], "no kinds, and no invented ones");

    /* ── 8 · THE OBSERVER AND THE GROUNDING AGREE WITH THE READER ─────────── */
    const tenant = { tenantId: TENANT_A } as unknown as TenantContext;
    const observation = await observeRecordedActWindows(tenant, {
      getDb,
      now: () => UNTIL,
      windowDays: 7,
    });
    assert.equal(observation.status, "observed");
    if (observation.status === "observed") {
      assert.equal(observation.comparison.current.acts, 4);
      assert.equal(observation.comparison.previous.acts, 1);
      assert.equal(observation.comparison.evaluatedAt, UNTIL.toISOString());
    }

    const grounding = await readActWindowGroundingSource(tenant, {
      readWindows: (t) => observeRecordedActWindows(t, { getDb, now: () => UNTIL, windowDays: 7 }),
    });
    assert.equal(grounding.state, "resolved");
    assert.equal(grounding.authoritative, false);
    assert.match(grounding.items[0]!.detail, /4 recorded acts/);
    assert.match(grounding.items[1]!.detail, /1 recorded act\b/, "singular when exactly one");
    assert.match(grounding.items[2]!.detail, /4 recorded acts in the current 7-day period and 1 in the/);

    /* ── 9 · A NULL TENANT AND AN ABSENT DB BOTH FAIL CLOSED ──────────────── */
    assert.equal((await observeRecordedActWindows(null, { getDb })).status, "unavailable");
    const noDb = await observeRecordedActWindows(tenant, { getDb: () => null, now: () => UNTIL });
    assert.equal(noDb.status, "unavailable");
    if (noDb.status === "unavailable") assert.equal(noDb.reason, "persistence-not-configured");

    console.log("e27-act-window-grounding/window-postgres: OK");
  } finally {
    await client.end();
    await pool.end();
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
