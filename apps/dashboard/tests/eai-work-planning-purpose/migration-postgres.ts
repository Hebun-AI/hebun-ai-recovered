/*
 * CONTROLLED AGENT REASONING · PHASE 5 — D1's migration on a disposable PostgreSQL 18.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *   "Applied over a database at the previous ledger head that already holds scope rows for every
 *    earlier purpose, `eai_work_planning_purpose` changes exactly one CHECK: every earlier purpose
 *    stays valid, `work-planning` becomes valid, an unknown purpose is still refused, no grant is
 *    created and no existing grant changes. The rollback applies only while no `work-planning` row
 *    exists."
 *
 * The seeded rows bypass foreign keys and the append-only triggers (`session_replication_role =
 * replica`, a superuser setting on a disposable database): this proves the CHECK, not the writer.
 * CHECK constraints are enforced under `replica`. Nothing here touches a shared or production
 * database.
 */
import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { MIGRATIONS_DIR } from "../../scripts/lib/canonical-migrations";
import { applyPendingMigrations } from "../../scripts/lib/production-migration";
import { PURPOSES } from "../../src/features/external-ai-data-use/contracts";

const TAG = "20261013113340_eai_work_planning_purpose";
const OLD_PURPOSES = ["assistance", "relevance-selection", "agent-origination", "media-generation"] as const;
const ROLLBACK = [
  `ALTER TABLE "tenant_ai_data_use_scopes" DROP CONSTRAINT "tenant_ai_data_use_scopes_purpose_chk"`,
  `ALTER TABLE "tenant_ai_data_use_scopes" ADD CONSTRAINT "tenant_ai_data_use_scopes_purpose_chk" CHECK ("tenant_ai_data_use_scopes"."purpose" in (${OLD_PURPOSES.map((p) => `'${p}'`).join(", ")}))`,
];

const journal = JSON.parse(readFileSync(path.join(MIGRATIONS_DIR, "meta", "_journal.json"), "utf8")) as {
  entries: { idx: number; when: number; tag: string; version: string; breakpoints: boolean }[];
};

/** The ledger up to, not including, D1's migration. */
function ledgerBefore(tag: string): string {
  const at = journal.entries.findIndex((e) => e.tag === tag);
  assert.ok(at > 0, `${tag} is in the journal`);
  const dir = mkdtempSync(path.join(tmpdir(), "hebun-mig-d1-"));
  mkdirSync(path.join(dir, "meta"));
  const entries = journal.entries.slice(0, at);
  for (const e of entries) cpSync(path.join(MIGRATIONS_DIR, `${e.tag}.sql`), path.join(dir, `${e.tag}.sql`));
  writeFileSync(path.join(dir, "meta", "_journal.json"), JSON.stringify({ ...journal, entries }));
  return dir;
}

const sqlState = async (p: Promise<unknown>): Promise<string | null> =>
  p.then(() => null, (e: { code?: string }) => e.code ?? "unknown");

/** Probes after the seed use another authorization, so the (authorization, purpose, class) key never collides. */
const insertScope = (client: Client, purpose: string, id: string, authorizationId = "22222222-2222-4222-8222-222222222222") =>
  client.query(
    `insert into tenant_ai_data_use_scopes (id, tenant_id, authorization_id, purpose, data_class) values ($1, '11111111-1111-4111-8111-111111111111', $3, $2, 'conversation')`,
    [id, purpose, authorizationId],
  );
const PROBE_AUTHORIZATION = "33333333-3333-4333-8333-333333333333";

const fingerprint = async (client: Client, table: string): Promise<string> =>
  (await client.query<{ f: string }>(`select count(*) || ':' || coalesce(md5(string_agg(t::text, '|' order by t.id)), '') as f from ${table} t`)).rows[0]!.f;

async function main(): Promise<void> {
  /* The migration file is exactly the reviewed one: one DROP, one ADD, the five purposes. */
  const migration = readFileSync(path.join(MIGRATIONS_DIR, `${TAG}.sql`), "utf8");
  /* WORK-UPDATE V1 appended entry 77 (the mandate scope CHECK); D1 stays exactly where it was authored. */
  assert.equal(journal.entries[76]!.tag, TAG, "D1 is ledger entry 77 (idx 76)");
  assert.equal(migration.split("--> statement-breakpoint").length, 2, "two statements");
  assert.match(migration, /^ALTER TABLE "tenant_ai_data_use_scopes" DROP CONSTRAINT "tenant_ai_data_use_scopes_purpose_chk";/);
  /* RA-EAI-1 appended `research` to the vocabulary later; D1's file lists the vocabulary as it was then. */
  assert.ok(migration.includes(`in (${[...OLD_PURPOSES, "work-planning"].map((p) => `'${p}'`).join(", ")})`), "the CHECK lists exactly D1's vocabulary");
  assert.ok(!/\b(drop table|delete|update|insert|truncate)\b/i.test(migration), "no table dropped, no row written");

  const folder = ledgerBefore(TAG);
  const harness = createDisposablePostgresHarness("eai_d1");
  await harness.createDatabase();
  const client = new Client({ connectionString: harness.dbUrl });
  await client.connect();
  try {
    const version = (await client.query("show server_version_num")).rows[0].server_version_num as string;
    assert.ok(Number(version) >= 180000, `PostgreSQL 18 (server_version_num ${version})`);

    /* ── Before: the previous head, with a scope row for every earlier purpose. ── */
    await applyPendingMigrations(client, folder);
    await client.query("set session_replication_role = replica");
    for (const [i, purpose] of OLD_PURPOSES.entries()) await insertScope(client, purpose, `00000000-0000-4000-8000-00000000000${i}`);
    assert.equal(await sqlState(insertScope(client, "work-planning", "00000000-0000-4000-8000-0000000000aa")), "23514", "before: work-planning is refused");
    await client.query("set session_replication_role = origin");
    const scopesBefore = await fingerprint(client, "tenant_ai_data_use_scopes");
    const authorizationsBefore = await fingerprint(client, "tenant_ai_data_use_authorizations");
    assert.match(scopesBefore, /^4:/);

    /* ── Apply D1, exactly as the migration authority would: the canonical ledger. ── */
    await applyPendingMigrations(client);
    const applied = await client.query(`select count(*)::int as n from drizzle.__drizzle_migrations`);
    assert.equal(applied.rows[0].n, journal.entries.length, "the whole ledger is applied");

    assert.equal(await fingerprint(client, "tenant_ai_data_use_scopes"), scopesBefore, "existing grants unchanged");
    assert.equal(await fingerprint(client, "tenant_ai_data_use_authorizations"), authorizationsBefore, "existing authorizations unchanged");
    assert.equal((await client.query(`select count(*)::int as n from tenant_ai_data_use_scopes where purpose = 'work-planning'`)).rows[0].n, 0, "no grant was created");
    const def = (await client.query<{ d: string; convalidated: boolean }>(`select pg_get_constraintdef(oid) as d, convalidated from pg_constraint where conname = 'tenant_ai_data_use_scopes_purpose_chk'`)).rows;
    assert.equal(def.length, 1, "one purpose CHECK");
    assert.equal(def[0].convalidated, true, "validated against the existing rows");
    for (const p of PURPOSES) assert.ok(def[0].d.includes(`'${p}'`), `the CHECK admits ${p}`);

    /* ── After: every earlier purpose and work-planning are valid; an unknown one is not. ── */
    await client.query("begin");
    await client.query("set local session_replication_role = replica");
    for (const [i, purpose] of PURPOSES.entries()) {
      assert.equal(await sqlState(insertScope(client, purpose, `00000000-0000-4000-8000-0000000001${i}0`, PROBE_AUTHORIZATION)), null, `${purpose} is valid`);
    }
    await client.query("rollback");
    for (const unknown of ["work-planning ", "Work-Planning", "planning", "", "assistance,work-planning"]) {
      await client.query("begin");
      await client.query("set local session_replication_role = replica");
      assert.equal(await sqlState(insertScope(client, unknown, "00000000-0000-4000-8000-0000000002a0", PROBE_AUTHORIZATION)), "23514", `"${unknown}" is refused`);
      await client.query("rollback");
    }
    assert.equal(await fingerprint(client, "tenant_ai_data_use_scopes"), scopesBefore, "the probes left nothing behind");

    /* ── Rollback: clean while no work-planning row exists; refused once one does. ── */
    await client.query("begin");
    for (const s of ROLLBACK) await client.query(s);
    assert.equal(await sqlState(insertScope(client, "work-planning", "00000000-0000-4000-8000-0000000003a0", PROBE_AUTHORIZATION)), "23514", "rolled back: work-planning refused again");
    await client.query("rollback");

    await client.query("begin");
    await client.query("set local session_replication_role = replica");
    await insertScope(client, "work-planning", "00000000-0000-4000-8000-0000000003b0", PROBE_AUTHORIZATION);
    await client.query(ROLLBACK[0]!);
    assert.equal(await sqlState(client.query(ROLLBACK[1]!)), "23514", "the rollback fails while a work-planning grant exists");
    await client.query("rollback");
    assert.equal(await fingerprint(client, "tenant_ai_data_use_scopes"), scopesBefore);

    console.log("PASS eai-work-planning-purpose migration-postgres");
  } finally {
    await client.end();
    await harness.dropDatabase();
    rmSync(folder, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
