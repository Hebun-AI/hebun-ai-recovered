/*
 * D1.1 — the disposable-database harness may only destroy what it created.
 *
 * THE INVARIANT. Ownership, not naming, authorizes a drop. During D1 a database
 * that was not disposable was destroyed by a `list → match prefix → drop each`
 * command. These tests exist so that pattern cannot come back: they prove the
 * harness has no API that accepts a name, that a handle can only ever reach the
 * one database it minted, and that a handle which never created anything refuses
 * to destroy anything.
 *
 * PROVING REFUSAL WITHOUT CASUALTIES. The protected-name cases are proved against
 * the exported pure predicate and against the fact that minted names can never BE
 * a protected name. No test here points a live drop at a real database to watch it
 * survive — that would be proving safety by aiming a loaded gun at it.
 *
 * Every database this file creates is dropped before it exits.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import {
  createDisposablePostgresHarness,
  isProtectedDatabaseName,
} from "../helpers/disposable-postgres";

const HELPER_SOURCE = path.resolve(process.cwd(), "tests/helpers/disposable-postgres.ts");
const SELF_SOURCE = path.resolve(
  process.cwd(),
  "tests/d1-1-flow/disposable-database-safety.ts",
);

async function databaseExists(adminUrl: string, name: string): Promise<boolean> {
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    const rows = await admin.query<{ count: string }>(
      "select count(*)::text as count from pg_database where datname = $1",
      [name],
    );
    return rows.rows[0]!.count !== "0";
  } finally {
    await admin.end();
  }
}

async function main(): Promise<void> {
  /* ── 6. There is no name-taking, pattern-taking or sweeping API ───────────── */
  {
    const helperModule = await import("../helpers/disposable-postgres");
    const exported = Object.keys(helperModule).sort();
    assert.deepEqual(
      exported,
      ["createDisposablePostgresHarness", "isProtectedDatabaseName"],
      "the helper exports exactly one factory and one pure predicate — nothing that deletes by name",
    );

    const harness = createDisposablePostgresHarness("api_shape");
    /* ── 4. Cleanup takes no arguments, so nothing can be injected into it ──── */
    assert.equal(
      harness.dropDatabase.length,
      0,
      "dropDatabase accepts no parameters — there is no name to inject",
    );

    const source = readFileSync(HELPER_SOURCE, "utf8");
    // The banned shape: reading the database catalogue and then destroying rows.
    const readsCatalogue = /from\s+pg_database/i.test(source);
    const dropsSomething = /drop\s+database/i.test(source);
    assert.ok(
      !(readsCatalogue && dropsSomething),
      "the helper must never both enumerate pg_database and drop — that is the pattern that caused the incident",
    );
    for (const banned of ["like '", "LIKE '", "ilike", "datname like", "%'"]) {
      assert.ok(
        !source.includes(banned),
        `the helper must not pattern-match database names (${banned})`,
      );
    }
  }

  /* ── Protected names, proved on the pure predicate ────────────────────────── */
  {
    /* 7, 8, 9 */
    for (const name of ["hebun_r1", "hebun_ai", "postgres", "template0", "template1"]) {
      assert.equal(
        isProtectedDatabaseName(name),
        true,
        `${name} must be recognised as protected`,
      );
      assert.equal(
        isProtectedDatabaseName(name.toUpperCase()),
        true,
        "protection is case-insensitive",
      );
    }
    // The developer's currently configured application database is protected too,
    // so a mis-set environment cannot aim the harness at something live.
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "postgresql://postgres@127.0.0.1:55432/some_live_db";
    assert.equal(
      isProtectedDatabaseName("some_live_db"),
      true,
      "whatever DATABASE_URL points at is protected",
    );
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;

    // A minted name can never BE a protected name, so the gate above is a backstop
    // rather than the protection.
    for (let i = 0; i < 25; i++) {
      const h = createDisposablePostgresHarness("collision_probe");
      assert.match(h.dbName, /^hebun_test_collision_probe_[0-9a-f]{16}$/, "names are minted");
      assert.equal(isProtectedDatabaseName(h.dbName), false);
    }
  }

  /* ── 10, 12. No create ⇒ no authority to drop ─────────────────────────────── */
  {
    const neverCreated = createDisposablePostgresHarness("never_created");
    await assert.rejects(
      () => neverCreated.dropDatabase(),
      /cannot prove ownership/,
      "a harness that never created a database refuses to drop one",
    );

    // A FAILED setup must not broaden cleanup scope either: the create threw, so
    // ownership was never established, so the drop still refuses.
    const failedSetup = createDisposablePostgresHarness(
      "failed_setup",
      "postgresql://postgres@127.0.0.1:1/postgres",
    );
    await assert.rejects(() => failedSetup.createDatabase(), "the create genuinely fails");
    await assert.rejects(
      () => failedSetup.dropDatabase(),
      /cannot prove ownership/,
      "a failed setup leaves the harness with no destructive authority at all",
    );
  }

  /* ── A remote admin target is refused before anything is created ──────────── */
  {
    const remote = createDisposablePostgresHarness(
      "remote",
      "postgresql://postgres@db.example.com:5432/postgres",
    );
    await assert.rejects(
      () => remote.createDatabase(),
      /requires localhost/,
      "the harness never touches a non-local Postgres",
    );
  }

  /* ── 1, 2, 3. Create, drop exactly that one, and repeat safely ────────────── */
  const adminUrl = createDisposablePostgresHarness("probe").adminUrl;
  {
    const harness = createDisposablePostgresHarness("lifecycle");
    await harness.createDatabase();
    assert.equal(
      await databaseExists(adminUrl, harness.dbName),
      true,
      "the disposable database was created",
    );

    await harness.dropDatabase();
    assert.equal(
      await databaseExists(adminUrl, harness.dbName),
      false,
      "…and the exact database it created was dropped",
    );

    // Called again from a `finally` block: safe, and issues nothing destructive.
    await harness.dropDatabase();
    await harness.dropDatabase();
  }

  /* ── 5, 11. A handle can only ever reach its OWN database ─────────────────── */
  {
    const alpha = createDisposablePostgresHarness("alpha");
    const beta = createDisposablePostgresHarness("beta");
    await alpha.createDatabase();
    await beta.createDatabase();

    try {
      // 5. Rewriting the handle's public name must not redirect the drop: the name
      // it acts on is captured in the closure, not read back off the object.
      (alpha as { dbName: string }).dbName = beta.dbName;
      await alpha.dropDatabase();

      assert.equal(
        await databaseExists(adminUrl, beta.dbName),
        true,
        "beta survived — a tampered handle cannot target another database",
      );

      // 11. And alpha's own database is the one that actually went.
      const alphaRealName = alpha.dbUrl.split("/").pop()!;
      assert.equal(
        await databaseExists(adminUrl, alphaRealName),
        false,
        "alpha dropped only the database alpha created",
      );
    } finally {
      await beta.dropDatabase();
    }
    assert.equal(await databaseExists(adminUrl, beta.dbName), false, "beta cleaned up");
  }

  /* ── The instance default is the Hebun-dedicated one, not the shared local ── */
  {
    const source = readFileSync(HELPER_SOURCE, "utf8");
    assert.ok(
      source.includes("127.0.0.1:55432"),
      "disposable databases default to the Hebun-dedicated instance",
    );
    assert.ok(
      !/["'`]postgresql:\/\/[^"'`]*127\.0\.0\.1:5432/.test(source),
      "the harness must not default to the shared local Postgres on :5432, which holds unrelated projects",
    );
    const harness = createDisposablePostgresHarness("instance_check");
    assert.ok(
      harness.dbUrl.includes(new URL(harness.adminUrl).port),
      "the per-database URL targets the SAME instance as the admin URL",
    );
  }

  /* ── No other test file may reintroduce the sweep pattern ─────────────────── */
  {
    const { readdirSync } = await import("node:fs");
    const collect = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) return collect(p);
        return e.isFile() && e.name.endsWith(".ts") ? [p] : [];
      });

    for (const file of collect(path.resolve(process.cwd(), "tests"))) {
      const src = readFileSync(file, "utf8");
      const rel = path.relative(process.cwd(), file);
      // The harness is the one place allowed to issue the statement, and THIS file
      // is the rule itself — it necessarily quotes the banned phrases in order to
      // ban them. Every other test file is policed.
      if (file === HELPER_SOURCE || file === SELF_SOURCE) continue;

      assert.ok(
        !/drop\s+database/i.test(src),
        `${rel}: only the harness may issue DROP DATABASE`,
      );

      /*
       * Reading pg_database is fine — asking "does the database I created still
       * exist?" is a parameterized lookup of one known name, and several tests
       * legitimately do it. What is banned is SELECTING A SET of database names by
       * PATTERN, because that set is the input the incident turned into a list of
       * drop targets. No pattern, no list; no list, no sweep.
       */
      const catalogueQueries = src.match(/from\s+pg_database[^;`"']*/gi) ?? [];
      for (const query of catalogueQueries) {
        assert.ok(
          !/\b(like|ilike|similar\s+to)\b|~/i.test(query),
          `${rel}: must not pattern-match database names in pg_database — enumerate nothing, drop nothing`,
        );
      }
    }
  }

  console.log("D1.1 disposable database safety: passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
