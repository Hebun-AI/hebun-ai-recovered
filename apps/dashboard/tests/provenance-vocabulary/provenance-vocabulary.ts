/*
 * G1 — production provenance vocabulary, proved against a real PostgreSQL.
 *
 * ── WHAT THIS PHASE ACTUALLY CHANGED ─────────────────────────────────────────
 *
 * Two CHECK constraints, and nothing else. Before G1:
 *
 *   companies_provisioning_source_chk    provisioning_source IS NULL
 *                                        OR provisioning_source = 'local-operator-ceremony'
 *   genesis_nominations_source_chk       nomination_source = 'local-operator-ceremony'
 *
 * The second admits no NULL, so `nomination_source` was mandatorily "local". A production-born
 * tenant and a production Genesis nomination were therefore not merely undesigned — they were
 * SCHEMA-IMPOSSIBLE to record truthfully. Either the row claimed a local root it did not have, or
 * PostgreSQL rejected it. `provisioning_source` is the only evidence a ceremony leaves (tenant
 * birth writes no `audit_log` row and cannot: `actor_id` and `actor_type` are both NOT NULL), so a
 * wrong value would be a permanent lie in the one place the truth is kept.
 *
 * ── WHAT THIS TEST MUST NOT LET DRIFT ────────────────────────────────────────
 *
 * The vocabulary is a CLOSED set, and it stays closed. Widening it by two values must not turn the
 * column into free text — so the rejection of an unknown value is asserted against the DATABASE,
 * and the assertion is bite-proofed by dropping the CHECK and watching the proof die.
 *
 * The widening is also VOCABULARY ONLY. No ceremony writes the new value, no guard was relaxed, no
 * writer was added. Those are asserted here as source-level facts because a database that accepts a
 * value says nothing about whether anything can reach it.
 *
 * Uses a disposable local database, dropped on exit.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import {
  COMPANY_PROVISIONING_SOURCE_LOCAL_OPERATOR,
  COMPANY_PROVISIONING_SOURCE_PRODUCTION_OPERATOR,
} from "../../src/db/schema/company";
import {
  GENESIS_NOMINATION_SOURCE_LOCAL_OPERATOR,
  GENESIS_NOMINATION_SOURCE_PRODUCTION_OPERATOR,
} from "../../src/db/schema/genesis-nomination";
import {
  PROVIDER_CONTROL_SOURCE_LOCAL_OPERATOR,
  PROVIDER_CONTROL_SOURCE_PRODUCTION_OPERATOR,
} from "../../src/db/schema/provider-connectivity-control";

const MIGRATIONS_DIR = "src/db/migrations";
const MIGRATION = `${MIGRATIONS_DIR}/20260818172455_production_provenance_vocabulary.sql`;

function read(path: string): string {
  return readFileSync(path, "utf8");
}

/* Comment-stripped source. A prohibition proved by `includes()` over raw text is trivially tripped
 * by prose that merely NAMES the thing it forbids — R2F.1's guard learned that the hard way. */
function codeOf(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** Insert a company with an explicit provisioning_source, returning the PostgreSQL error or null. */
async function tryCompanySource(db: Client, source: string | null): Promise<string | null> {
  try {
    await db.query(
      `insert into companies (id, name, slug, plan, provisioning_source)
       values (gen_random_uuid(), 'probe', 'probe-' || gen_random_uuid()::text, 'free', $1)`,
      [source],
    );
    return null;
  } catch (error) {
    return (error as { message?: string }).message ?? "unknown";
  }
}

async function main(): Promise<void> {
  /* ── The vocabulary constants ────────────────────────────────────────────── */
  assert.equal(COMPANY_PROVISIONING_SOURCE_LOCAL_OPERATOR, "local-operator-ceremony");
  assert.equal(COMPANY_PROVISIONING_SOURCE_PRODUCTION_OPERATOR, "production-operator-ceremony");
  assert.equal(GENESIS_NOMINATION_SOURCE_LOCAL_OPERATOR, "local-operator-ceremony");
  assert.equal(GENESIS_NOMINATION_SOURCE_PRODUCTION_OPERATOR, "production-operator-ceremony");
  /*
   * R2H — a THIRD column records these roots, and it must not spell them differently.
   *
   * `provider_connectivity_controls.control_source` differs from its two siblings in WHEN it is
   * written — per transition rather than at creation, because the row is a switch — but the
   * vocabulary is identical. A second spelling of a root is a second root.
   */
  assert.equal(PROVIDER_CONTROL_SOURCE_LOCAL_OPERATOR, "local-operator-ceremony");
  assert.equal(PROVIDER_CONTROL_SOURCE_PRODUCTION_OPERATOR, "production-operator-ceremony");

  /* The columns name the SAME roots — one root vocabulary, three places it is recorded. */
  assert.equal(
    COMPANY_PROVISIONING_SOURCE_PRODUCTION_OPERATOR,
    GENESIS_NOMINATION_SOURCE_PRODUCTION_OPERATOR,
    "a production tenant and its Genesis nomination must name the same root",
  );
  for (const [label, local, production] of [
    ["provider control", PROVIDER_CONTROL_SOURCE_LOCAL_OPERATOR, PROVIDER_CONTROL_SOURCE_PRODUCTION_OPERATOR],
  ] as const) {
    assert.equal(local, COMPANY_PROVISIONING_SOURCE_LOCAL_OPERATOR, `${label} shares the local root`);
    assert.equal(production, COMPANY_PROVISIONING_SOURCE_PRODUCTION_OPERATOR, `${label} shares the production root`);
  }

  /* ── R2H: the third column's own migration obeys the same inline-literal rule ───── */
  {
    const dir = "src/db/migrations";
    const { readdirSync } = await import("node:fs");
    const files = readdirSync(dir).filter((f) => /control_source/.test(f));
    assert.equal(files.length, 1, "exactly one migration introduces control_source");
    const sql = read(`${dir}/${files[0]!}`);
    for (const value of [
      PROVIDER_CONTROL_SOURCE_LOCAL_OPERATOR,
      PROVIDER_CONTROL_SOURCE_PRODUCTION_OPERATOR,
    ]) {
      assert.ok(
        sql.includes(`"provider_connectivity_controls"."control_source" = '${value}'`),
        `the provider-control CHECK must name ${value} inline`,
      );
    }
    assert.doesNotMatch(sql, /\$\d/, "no bind parameter may appear inside the provider-control CHECK");
    /* NULL is admitted here and NOT on genesis — the two forms are deliberate, not accidental. */
    assert.match(sql, /"control_source" is null or/, "control_source admits NULL (the companies form)");
    assert.match(
      read("src/db/schema/provider-connectivity-control.ts"),
      /= "production-operator-ceremony"/,
      "the constant is declared beside the table that uses it",
    );
  }

  /* ── Test 8: inline CHECK literals agree with the TypeScript constants ───── */
  {
    const migration = read(MIGRATION);
    for (const value of [
      COMPANY_PROVISIONING_SOURCE_LOCAL_OPERATOR,
      COMPANY_PROVISIONING_SOURCE_PRODUCTION_OPERATOR,
    ]) {
      assert.ok(
        migration.includes(`"companies"."provisioning_source" = '${value}'`),
        `the companies CHECK must name ${value} inline`,
      );
      assert.ok(
        migration.includes(`"genesis_nominations"."nomination_source" = '${value}'`),
        `the genesis CHECK must name ${value} inline`,
      );
    }
    /* A bind parameter inside a CHECK is not valid SQL — R4A's reason for the inline literal. */
    assert.doesNotMatch(migration, /\$\d/, "no bind parameter may appear inside a CHECK");
    assert.match(read("src/db/schema/company.ts"), /= "production-operator-ceremony"/);
    assert.match(read("src/db/schema/genesis-nomination.ts"), /= "production-operator-ceremony"/);
  }

  /* ── Test 7: the migration performs no backfill and adds no structure ───── */
  {
    const migration = read(MIGRATION);
    const statements = migration
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
    assert.equal(statements.length, 4, "exactly two DROP CONSTRAINT and two ADD CONSTRAINT");
    for (const forbidden of [
      /UPDATE\s/i,
      /INSERT\s+INTO/i,
      /DELETE\s+FROM/i,
      /CREATE\s+TABLE/i,
      /ADD\s+COLUMN/i,
      /DROP\s+COLUMN/i,
      /DROP\s+TABLE/i,
      /CREATE\s+TYPE/i,
      /CREATE\s+(UNIQUE\s+)?INDEX/i,
      /REFERENCES/i,
    ]) {
      assert.doesNotMatch(migration, forbidden, `G1 must not emit ${forbidden}`);
    }
    /* Every statement touches only the two named constraints. */
    for (const statement of statements) {
      assert.match(
        statement,
        /CONSTRAINT "(companies_provisioning_source_chk|genesis_nominations_source_chk)"/,
        `unrelated statement in the G1 migration: ${statement.slice(0, 80)}`,
      );
    }
  }

  /* ── Test 9 + 10: vocabulary only — no writer, no relaxed guard ──────────── */
  {
    /* `src/` writes no company row at all, so the new value cannot be reached from the app. */
    const srcFiles: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = `${dir}/${entry.name}`;
        if (entry.isDirectory()) {
          if (entry.name !== "migrations") walk(full);
        } else if (/\.tsx?$/.test(entry.name)) srcFiles.push(full);
      }
    };
    walk("src");

    const writers = srcFiles.filter((f) =>
      /\.(insert|update)\(\s*companies\s*\)|insert\s+into\s+companies|update\s+companies\s+set/i.test(
        codeOf(read(f)),
      ),
    );
    assert.deepEqual(writers, [], "no file under src may write companies");

    /*
     * Nothing under src/ names the production root either — it is schema vocabulary, not a value
     * any application code may supply. A schema module that DEFINES it is the only exception.
     *
     * ── REPAIRED AT R2H, AND DELIBERATELY NOT BY EXTENDING A LIST ─────────────────────────
     *
     * This exempted two hard-coded paths, which was an enumeration of the vocabulary owners as they
     * stood at G1. `provider_connectivity_controls.control_source` is a third owner, so the list was
     * stale — but a list is the wrong shape: it rots on every new owner, and it exempts a path
     * because of its NAME rather than because of what it does.
     *
     * The exemption is now STRUCTURAL: a file may name the production root only if it is a schema
     * module that EXPORTS it as a constant. That is strictly stronger than the list it replaces —
     * adding a non-declaring file to `src/db/schema/` would no longer be silently exempt, and a
     * declaring module cannot be forgotten.
     */
    const declaresVocabulary = (file: string): boolean =>
      file.startsWith("src/db/schema/") &&
      /export const [A-Z_]+ = "production-operator-ceremony";/.test(read(file));

    const namers = srcFiles.filter(
      (f) => !declaresVocabulary(f) && codeOf(read(f)).includes("production-operator-ceremony"),
    );
    assert.deepEqual(namers, [], "only a declaring schema module may name the production root");

    /* And the declaring set is exactly the three columns that record a ceremony root. */
    assert.deepEqual(
      srcFiles.filter(declaresVocabulary).sort(),
      [
        "src/db/schema/company.ts",
        "src/db/schema/genesis-nomination.ts",
        "src/db/schema/provider-connectivity-control.ts",
      ],
      "three columns record a ceremony root, and each declares the vocabulary it uses",
    );

    /*
     * ── REPAIRED BY G4, WHICH IS THE CEREMONY G1 SAID A LATER GATE WOULD BUILD ──
     *
     * G1's claim was "vocabulary only — no writer exists", and it pinned that by asserting the two
     * ceremonies never NAME the production root and that all five CLIs call the local guard
     * directly. Both assertions were true of G1 and are false of G4, which is the gate G1's own
     * schema header anticipated in as many words.
     *
     * The repair keeps everything G1 actually owned and re-expresses only what G4 legitimately
     * changed. What G1 owned — the vocabulary, the CHECK constraints, `src/` naming and writing
     * nothing — is asserted above and below, unweakened.
     */

    /*
     * The two writers still do not CONTAIN the production literal: it arrives as a parameter
     * derived from deployment posture, so there is still no string in either module that could
     * make a production claim on its own. This is a stronger property than G1 pinned, not a weaker
     * one — G1 forbade the literal, and it is still absent.
     */
    const provisionCeremony = codeOf(read("scripts/lib/provision-tenant.ts"));
    const genesisCeremony = codeOf(read("scripts/lib/nominate-genesis-human.ts"));
    for (const [label, source] of [
      ["provision-tenant", provisionCeremony],
      ["nominate-genesis-human", genesisCeremony],
    ] as const) {
      assert.ok(
        !source.includes('"production-operator-ceremony"'),
        `${label} must not hard-code the production root — G4 derives it from posture`,
      );
      assert.ok(source.includes("local-operator-ceremony"), `${label} still names the local root`);
    }

    /* NODE_ENV=production is refused by all five, unchanged. G4 relaxed nothing here. */
    for (const cli of [
      "scripts/tenant-provision.ts",
      "scripts/genesis-nominate.ts",
      "scripts/provider-connectivity.ts",
      "scripts/tenant-lifecycle.ts",
      "scripts/auth-dev-credential.ts",
    ]) {
      assert.match(
        codeOf(read(cli)),
        /NODE_ENV === "production"/,
        `${cli} must still refuse NODE_ENV=production`,
      );
    }

    /*
     * The LOCALITY fence: still present in all five, but reached two different ways after G4.
     *
     * The two ceremonies G4 deliberately did NOT make production-capable still call the released
     * guard directly. The three it did call it through the shared posture path, which applies the
     * SAME guard in local posture and its exact complement in production posture. Asserting the old
     * call site on all five would now be satisfied by an unused import — a grep passing while the
     * property rotted — so each is asserted where its guard actually lives.
     */
    /*
     * ── MOVED AT R2H, BY THE RULE THIS BLOCK ALREADY STATES ────────────────────────────────
     *
     * `provider-connectivity.ts` was in the local-only group because it was local-only. R2H makes
     * it production-capable through the same shared posture path, so its locality fence now lives
     * where the other production-capable ceremonies keep theirs. Asserting the direct call site on
     * it would from here on be satisfied by an unused import — the exact failure mode the comment
     * above warns about — so it moves groups rather than keeping a guard that no longer guards.
     *
     * Nothing is relaxed: the local branch still runs `assertLocalDatabaseUrl`, and the shared path
     * is asserted to contain it (and its production complement) below.
     */
    for (const cli of ["scripts/auth-dev-credential.ts"]) {
      assert.match(
        codeOf(read(cli)),
        /assertLocalDatabaseUrl/,
        `${cli} is local-only and must still call the local guard directly`,
      );
    }
    for (const cli of [
      "scripts/tenant-provision.ts",
      "scripts/genesis-nominate.ts",
      "scripts/tenant-lifecycle.ts",
      "scripts/provider-connectivity.ts",
    ]) {
      assert.match(
        codeOf(read(cli)),
        /preflightEnvironment\(posture, databaseUrl\)/,
        `${cli} must resolve locality through the shared posture path`,
      );
    }
    const sharedPath = codeOf(read("scripts/lib/ceremony-preflight.ts"));
    assert.match(
      sharedPath,
      /assertLocalDatabaseUrl\(trimmed\)/,
      "local posture still refuses a remote database",
    );
    assert.match(
      sharedPath,
      /assertNonLocalDatabaseUrl\(trimmed\)/,
      "production posture refuses a local one",
    );
  }

  /* ── Database-proved behaviour ───────────────────────────────────────────── */
  const harness = createDisposablePostgresHarness("hebun_g1_provenance");
  await harness.createDatabase();
  const db = new Client({ connectionString: harness.dbUrl });

  try {
    harness.migrateDatabase();
    await db.connect();

    /* The migration ledger is state-relative: the files, the journal and the applied rows agree,
     * and G1 is the latest entry. Never a hard-coded total. */
    {
      const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"));
      const journal = JSON.parse(read(`${MIGRATIONS_DIR}/meta/_journal.json`)) as {
        entries: { tag: string }[];
      };
      const applied = await db.query<{ count: string }>(
        "select count(*)::text as count from drizzle.__drizzle_migrations",
      );
      assert.equal(files.length, journal.entries.length, "every migration file is journalled");
      assert.equal(
        Number(applied.rows[0]!.count),
        journal.entries.length,
        "every journalled migration applied",
      );
      /*
       * G1 IS JOURNALLED — not "is last". Last was only ever true until the next phase shipped, and
       * a later authorized migration is not a G1 regression.
       */
      const tags = journal.entries.map((e) => e.tag);
      assert.ok(tags.includes("20260818172455_production_provenance_vocabulary"), "G1 is journalled");
      assert.deepEqual(
        tags.filter((t) => t > "20260818172455_production_provenance_vocabulary"),
        [
          "20260819133901_g6d_answer_source_evidence",
          "20260822140116_i1_integration_connection_authority",
          "20260822195716_int2_integration_credential_authority",
          /* R2H — control_source, the column G1's sibling R5.1 designed and deferred. */
          "20260825080110_provider_control_source",
          /* KR-EXT1 — the Knowledge-owned external-system reference table. Additive: one
           * CREATE TABLE, two foreign keys, three indexes, zero DROP. */
          "20260826064423_kr_ext1_knowledge_external_references",
          /* AGENT-PROPOSAL-4B — agent-origination invocation provenance. Additive: one CREATE
           * TABLE, one nullable column on `heby_action_requests`, zero DROP, and deliberately no
           * foreign key on the causal link. */
          "20260828071500_ap4b_origination_invocation_provenance",
          "20260828173456_sia26_origination_agent_attribution",
          "20260828190630_sia3_agent_improvement_hypothesis",
          /* AMA-1 — the Agent Mandate Authority table. A declared later phase, not this one's. */
          "20260831110423_ama1_agent_mandate_authority",
    "20260831212454_osa1_department_structure_authority",
        ],
        "and what follows it is a declared later phase",
      );
    }

    /* Both CHECKs exist and name both roots, read from the catalog rather than the file. */
    {
      const { rows } = await db.query<{ conname: string; def: string }>(
        `select conname, pg_get_constraintdef(oid) as def from pg_constraint
          where conname in ('companies_provisioning_source_chk','genesis_nominations_source_chk')`,
      );
      assert.equal(rows.length, 2, "both provenance CHECKs survive the migration");
      for (const row of rows) {
        assert.ok(row.def.includes("local-operator-ceremony"), `${row.conname} keeps the local root`);
        assert.ok(
          row.def.includes("production-operator-ceremony"),
          `${row.conname} admits the production root`,
        );
      }
    }

    /* ── Test 1 + 2: both roots accepted on companies ─────────────────────── */
    assert.equal(
      await tryCompanySource(db, COMPANY_PROVISIONING_SOURCE_LOCAL_OPERATOR),
      null,
      "the local root must still be accepted",
    );
    assert.equal(
      await tryCompanySource(db, COMPANY_PROVISIONING_SOURCE_PRODUCTION_OPERATOR),
      null,
      "the production root must be accepted",
    );
    /* NULL still means "no ceremony provenance exists". */
    assert.equal(await tryCompanySource(db, null), null, "NULL remains legal and meaningful");

    /* ── Test 4: an unknown root is refused by PostgreSQL, not by TypeScript ─ */
    for (const rogue of [
      "platform-admin",
      "production-operator",
      "PRODUCTION-OPERATOR-CEREMONY",
      "staging-operator-ceremony",
      "",
    ]) {
      const error = await tryCompanySource(db, rogue);
      assert.ok(error, `an unknown root (${JSON.stringify(rogue)}) must be refused`);
      assert.match(
        error,
        /companies_provisioning_source_chk/,
        "the refusal must come from the CHECK, not from something incidental",
      );
    }

    /* ── Test 3 + 5: genesis_nominations vocabulary and NOT NULL ──────────── */
    {
      /* Asserted against the column and its CHECK directly: a full nomination row needs a
       * membership, which needs Governance, which needs a nomination — the R4A bootstrap cycle. The
       * constraint is what G1 changed, so the constraint is what is proved. */
      const nullable = await db.query<{ is_nullable: string }>(
        `select is_nullable from information_schema.columns
          where table_name='genesis_nominations' and column_name='nomination_source'`,
      );
      assert.equal(nullable.rows[0]!.is_nullable, "NO", "nomination_source stays NOT NULL");

      const def = (
        await db.query<{ def: string }>(
          `select pg_get_constraintdef(oid) as def from pg_constraint
            where conname='genesis_nominations_source_chk'`,
        )
      ).rows[0]!.def;
      /* No NULL escape was introduced while widening — the CHECK still tests equality only. */
      assert.ok(!/IS NULL/i.test(def), "the genesis CHECK must not gain a NULL allowance");

      /* And the CHECK itself accepts exactly the two roots and nothing else. */
      const probe = async (value: string | null): Promise<boolean> => {
        const { rows } = await db.query<{ ok: boolean | null }>(
          `select (${def.replace(/^CHECK\s*/i, "")}) as ok
             from (select $1::varchar as nomination_source) as genesis_nominations`,
          [value],
        );
        return rows[0]!.ok === true;
      };
      assert.equal(await probe(GENESIS_NOMINATION_SOURCE_LOCAL_OPERATOR), true);
      assert.equal(await probe(GENESIS_NOMINATION_SOURCE_PRODUCTION_OPERATOR), true);
      assert.equal(await probe("platform-admin"), false);
      assert.equal(await probe(null), false, "NULL does not satisfy the CHECK either");

      /* ── BITE-PROOF B: the probe's `false` means the CHECK refused, not that the harness
       * always refuses. Evaluated against a deliberately permissive predicate it must return
       * true for the very values it just rejected — otherwise the four assertions above prove
       * nothing about the constraint. */
      const permissive = async (value: string | null): Promise<boolean> => {
        const { rows } = await db.query<{ ok: boolean | null }>(
          "select (nomination_source is not null or nomination_source is null) as ok" +
            " from (select $1::varchar as nomination_source) as genesis_nominations",
          [value],
        );
        return rows[0]!.ok === true;
      };
      assert.equal(
        await permissive("platform-admin"),
        true,
        "BITE-PROOF FAILED: the probe cannot return true, so its false results were vacuous",
      );
      assert.equal(await permissive(null), true, "and NULL too, under a predicate that allows it");
    }

    /* ── Test 6: pre-existing NULL rows are preserved, never backfilled ────── */
    {
      await db.query(
        `insert into companies (id, name, slug, plan)
         values (gen_random_uuid(), 'pre-existing', 'pre-existing-row', 'free')`,
      );
      const { rows } = await db.query<{ count: string }>(
        "select count(*)::text as count from companies where provisioning_source is null",
      );
      assert.ok(Number(rows[0]!.count) >= 1, "a company may still carry no provenance at all");
    }

    /* ── Test 11 + 12: no audit row, no provider state change ─────────────── */
    {
      const audit = await db.query<{ count: string }>(
        "select count(*)::text as count from audit_log",
      );
      assert.equal(Number(audit.rows[0]!.count), 0, "G1 writes no audit_log row");
      const provider = await db.query<{ count: string }>(
        "select count(*)::text as count from provider_connectivity_controls",
      );
      assert.equal(Number(provider.rows[0]!.count), 0, "G1 creates no provider control row");
    }

    /* ── BITE-PROOF A: the rejection test depends on the CHECK ─────────────── */
    {
      await db.query(
        'alter table companies drop constraint "companies_provisioning_source_chk"',
      );
      const error = await tryCompanySource(db, "platform-admin");
      assert.equal(
        error,
        null,
        "BITE-PROOF FAILED: an unknown root was still refused with the CHECK dropped, so the " +
          "rejection above was proving something other than the constraint",
      );
      /* The row that just got in is itself proof the constraint was gone: re-adding the CHECK
       * fails while it exists ("is violated by some row"). Remove it, then restore. */
      const removed = await db.query(
        "delete from companies where provisioning_source = 'platform-admin'",
      );
      assert.equal(removed.rowCount, 1, "exactly the rogue row entered while the CHECK was absent");
      /* Restore it exactly as the migration writes it, and confirm the bite returns. */
      await db.query(
        `alter table companies add constraint "companies_provisioning_source_chk"
           check ("companies"."provisioning_source" is null
                  or "companies"."provisioning_source" = 'local-operator-ceremony'
                  or "companies"."provisioning_source" = 'production-operator-ceremony')`,
      );
      assert.match(
        (await tryCompanySource(db, "platform-admin")) ?? "",
        /companies_provisioning_source_chk/,
        "the CHECK must bite again once restored",
      );
    }

    console.log("G1 provenance vocabulary: all assertions passed.");
  } finally {
    await db.end().catch(() => undefined);
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
