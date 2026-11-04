/**
 * K2 — A LOST CREATION RACE IS A DUPLICATE, NOT A WRITE FAILURE (PACKAGE 3 M2-R2).
 *
 * The first Linux CI run reported `["created", "unavailable"]` where create-and-read-postgres expects
 * `["created", "duplicate"]`. The cause: drizzle-orm wraps every driver error in DrizzleQueryError,
 * so the Postgres code `23505` sits on `error.cause`, and the writer's unique-violation check only
 * read `error.code`. The rollback was always correct; the outcome the operator saw and the audit row
 * were not ("rolled-back / write-failed" for what was a refused duplicate).
 *
 * The race here is not left to timing. Both pre-checks are made to finish before either transaction
 * starts, so the second insert reaches the unique index every run.
 *
 *   1. The classifier, over REAL error objects captured from Postgres: a direct driver error and a
 *      drizzle-wrapped one are unique violations; a wrapped other SQL error, a permission error, a
 *      connection error and a two-level cause chain are not.
 *   2. A forced lost race: one creation is created, the other is a duplicate.
 *   3. The audit sink: one committed row and one rejected row with reason duplicate-identity.
 *   4. No orphan node; every node has a fact.
 *   5. A plain creation is unchanged.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { sql } from "drizzle-orm";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb, type ControlPlaneDatabase } from "../../src/db/client.server";
import {
  createDurableKnowledgeWriter,
  isUniqueViolation,
} from "../../src/features/knowledge/durable-knowledge-writer.server";
import { createKnowledgeFact } from "../../src/features/knowledge/knowledge-create.server";
import { recordKnowledgeMutation } from "../../src/features/governance-audit/knowledge-mutation-audit.server";
import { asHumanTenantContext, type TenantContext } from "../../src/features/auth/tenant/tenant-context";

const TENANT = "10000000-0000-4000-8000-0000000000c2";
const USER = "20000000-0000-4000-8000-0000000000c2";
const NOW = new Date("2026-11-02T12:00:00.000Z");

function tenantContext(): TenantContext {
  return asHumanTenantContext({
    tenantId: TENANT,
    userId: USER,
    authIdentityId: "identity",
    membershipId: "membership",
    membershipVersion: 1,
    roleId: "role",
    sessionContextId: "session",
    provider: "local",
    assuranceLevel: "aal1",
    mfaVerified: false,
    requestId: "k2-race",
    authenticatedAt: NOW.toISOString(),
  });
}

async function captured(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run();
  } catch (error) {
    return error;
  }
  throw new Error("expected the statement to fail");
}

/** A handle whose `transaction` waits until `parties` callers have reached it. Everything else is the real db. */
function gatedAtTransaction(db: ControlPlaneDatabase, parties: number): ControlPlaneDatabase {
  let arrived = 0;
  let open!: () => void;
  const gate = new Promise<void>((resolve) => (open = resolve));
  return new Proxy(db, {
    get(target, property) {
      if (property === "transaction") {
        return async (...args: Parameters<ControlPlaneDatabase["transaction"]>) => {
          arrived += 1;
          if (arrived === parties) open();
          await gate;
          return target.transaction(...args);
        };
      }
      const value = Reflect.get(target, property, target) as unknown;
      return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(target) : value;
    },
  });
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_k2_lost_race");
  await harness.createDatabase();
  try {
    harness.migrateDatabase();
    const seed = new Client({ connectionString: harness.dbUrl });
    await seed.connect();
    try {
      await seed.query(`insert into companies (id, name, slug) values ($1, 'Tenant C', 'tenant-c')`, [TENANT]);
    } finally {
      await seed.end();
    }

    const handle = createControlPlaneDb(harness.dbUrl);
    const raw = new Client({ connectionString: harness.dbUrl });
    await raw.connect();
    try {
      /* ── 1. THE CLASSIFIER, OVER REAL ERRORS ── */
      await raw.query(`create temporary table k2_probe (k text primary key)`);
      await raw.query(`insert into k2_probe values ('a')`);
      await handle.db.execute(sql`create table k2_probe_d (k text primary key)`);
      await handle.db.execute(sql`insert into k2_probe_d values ('a')`);

      const direct = await captured(() => raw.query(`insert into k2_probe values ('a')`));
      const wrapped = await captured(() => handle.db.execute(sql`insert into k2_probe_d values ('a')`));
      const wrappedOther = await captured(() => handle.db.execute(sql`select * from k2_no_such_table`));
      assert.equal((direct as { code?: unknown }).code, "23505", "the driver carries 23505 on the error itself");
      assert.equal((wrapped as Error).constructor.name, "DrizzleQueryError", "drizzle wraps driver errors");
      assert.equal((wrapped as { code?: unknown }).code, undefined, "the wrapper has no code of its own");
      assert.equal((wrapped as { cause?: { code?: unknown } }).cause?.code, "23505", "the code is on cause");

      assert.equal(isUniqueViolation(direct), true, "a direct unique violation");
      assert.equal(isUniqueViolation(wrapped), true, "a drizzle-wrapped unique violation");
      assert.equal(isUniqueViolation(wrappedOther), false, "a wrapped undefined-table error is not a duplicate");
      assert.equal(isUniqueViolation({ cause: { code: "42501" } }), false, "a permission error is not a duplicate");
      assert.equal(isUniqueViolation(Object.assign(new Error("connect"), { code: "ECONNREFUSED" })), false, "a connection error is not a duplicate");
      assert.equal(isUniqueViolation({ cause: { cause: { code: "23505" } } }), false, "only one wrapping level is read");
      assert.equal(isUniqueViolation(null), false, "null is not a duplicate");
      assert.equal(isUniqueViolation("23505"), false, "a bare string is not a duplicate");

      /* ── 2 + 3. A FORCED LOST RACE, AND WHAT THE AUDIT SINK RECORDS ── */
      const writer = createDurableKnowledgeWriter(gatedAtTransaction(handle.db, 2));
      const deps = {
        resolveAuthority: async () => ({ authorized: true, roleType: "owner" }),
        getWriter: () => writer,
        now: () => NOW,
        recordMutation: ((actor, event, options) =>
          recordKnowledgeMutation(actor, event, { ...options, getDb: () => handle.db })) as typeof recordKnowledgeMutation,
      };
      const race = await Promise.all(
        ["first", "second"].map((statement) =>
          createKnowledgeFact(tenantContext(), { factKey: "race-fact", domainKey: "ops", scope: "domain", title: statement, statement }, deps),
        ),
      );
      assert.deepEqual(race.map((r) => r.status).sort(), ["created", "duplicate"], "the lost race is a duplicate");
      const lost = race.find((r) => r.status === "duplicate");
      assert.ok(lost && lost.status === "duplicate" && lost.audited === true, "the refusal was audited");

      const audit = await raw.query<{ result: string; reason: string | null }>(
        `select result, metadata->>'reason' as reason from audit_log
          where tenant_id = $1 and action = 'knowledge.create' order by result`,
        [TENANT],
      );
      assert.deepEqual(
        audit.rows,
        [
          { result: "committed", reason: null },
          { result: "rejected", reason: "duplicate-identity" },
        ],
        "the audit sink records the same cause the operator was told",
      );

      /* ── 4. ROLLBACK UNCHANGED ── */
      const counts = await raw.query<{ nodes: string; facts: string; orphans: string }>(
        `select (select count(*)::text from knowledge_nodes where tenant_id = $1) as nodes,
                (select count(*)::text from knowledge_facts where tenant_id = $1) as facts,
                (select count(*)::text from knowledge_nodes n where n.tenant_id = $1 and not exists
                   (select 1 from knowledge_facts f where f.active_knowledge_node_id = n.id)) as orphans`,
        [TENANT],
      );
      assert.deepEqual(counts.rows[0], { nodes: "1", facts: "1", orphans: "0" }, "the loser rolled back completely");

      /* ── 5. A PLAIN CREATION IS UNCHANGED ── */
      const plain = await createKnowledgeFact(
        tenantContext(),
        { factKey: "plain-fact", domainKey: "ops", scope: "domain", title: "Plain", statement: "one" },
        { ...deps, getWriter: () => createDurableKnowledgeWriter(handle.db) },
      );
      assert.equal(plain.status, "created", "an uncontested creation still commits");
    } finally {
      await raw.end();
      await handle.dispose();
    }
    console.log("k2-flow/lost-race-classification-postgres: ok");
  } finally {
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
