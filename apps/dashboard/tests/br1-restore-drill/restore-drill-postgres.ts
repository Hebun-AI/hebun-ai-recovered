/*
 * BR-1 — RESTORE DRILL, end to end, on synthetic data only.
 *
 * A disposable source database is migrated with the canonical migrations and seeded with three
 * synthetic tenants (company → user → auth identity → role → membership). `createValidatedBackup`
 * — the production ceremony's own backup — dumps it. `restoreArchive` loads the dump into a second,
 * empty disposable database, and `compareSnapshots` must find no difference.
 *
 * Then the drill must FAIL where it should: a corrupt archive, a lost migration ledger, a tenant
 * count that differs, and a disk below the floor. Every database and temporary file is removed in
 * `finally`, and the test proves it: both disposable names are gone from pg_database and the
 * scratch directory is gone from disk.
 *
 * No production database, no production dump, no credential, no network beyond loopback.
 */
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Client } from "pg";
import { createDisposablePostgresHarness, type DisposablePostgresHarness } from "../helpers/disposable-postgres";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { createValidatedBackup, readServerVersion } from "../../scripts/lib/production-migration";
import {
  compareSnapshots,
  restoreArchive,
  snapshotDatabase,
  type DatabaseSnapshot,
} from "../../scripts/lib/restore-drill";

const REPO_ROOT = path.resolve(process.cwd(), "..", "..");

async function withClient<T>(url: string, body: (c: Client) => Promise<T>): Promise<T> {
  const c = new Client({ connectionString: url });
  await c.connect();
  try {
    return await body(c);
  } finally {
    await c.end();
  }
}

/** A fresh empty target, restored from `archive`, compared with `source`; always dropped. */
async function restoreInto(
  archive: string,
  scratch: string,
  mutate?: (targetUrl: string) => Promise<void>,
  floorBytes?: number,
) {
  const target = createDisposablePostgresHarness("br1_target");
  await target.createDatabase();
  try {
    const restored = restoreArchive({ archive, targetUrl: target.dbUrl, workDirectory: scratch, floorBytes });
    if (restored.status !== "restored") return { restored, differences: null, dbName: target.dbName };
    if (mutate) await mutate(target.dbUrl);
    return { restored, differences: compareSnapshots(source!, await snapshotDatabase(target.dbUrl)), dbName: target.dbName };
  } finally {
    await target.dropDatabase();
  }
}

let source: DatabaseSnapshot | undefined;

async function main(): Promise<void> {
  const scratch = mkdtempSync(path.join(tmpdir(), "hebun-br1-"));
  const harness: DisposablePostgresHarness = createDisposablePostgresHarness("br1_source");
  const created: string[] = [harness.dbName];
  try {
    assert.equal(statSync(scratch).mode & 0o777, 0o700, "the scratch directory is 0700");

    await harness.createDatabase();
    harness.migrateDatabase();
    await withClient(harness.dbUrl, async (c) => {
      for (const n of [1, 2, 3]) {
        await seedLocalIdentity(c, {
          companyName: `BR-1 Synthetic Tenant ${n}`,
          companySlug: `br1-synthetic-${n}`,
          email: `br1-owner-${n}@example.invalid`,
        });
      }
    });

    source = await snapshotDatabase(harness.dbUrl);
    assert.ok(source.ledger && source.ledger.length > 0, "the source carries the migration ledger");
    assert.equal(source.tenants, 3, "three synthetic tenants");
    assert.ok(source.foreignKeys > 0 && source.unvalidatedForeignKeys === 0, "the source has validated foreign keys");
    console.log(`ok source: ${source.ledger!.length} migrations, ${Object.keys(source.rowCounts).length} tables, ${source.tenants} tenants, ${source.foreignKeys} foreign keys`);

    /* THE PRODUCTION BACKUP PATH, unchanged in behaviour, now 0600. */
    const version = await withClient(harness.dbUrl, (c) => readServerVersion(c));
    assert.equal(version.status, "parsed", "the server version is parsed");
    if (version.status !== "parsed") return;
    const umaskBefore = process.umask();
    const backup = createValidatedBackup({
      connectionString: harness.dbUrl,
      serverVersion: version.version,
      directory: scratch,
      filename: "br1-synthetic.dump",
      repositoryRoot: REPO_ROOT,
    });
    assert.equal(backup.status, "created", `backup: ${JSON.stringify(backup)}`);
    if (backup.status !== "created") return;
    assert.equal(statSync(backup.file).mode & 0o777, 0o600, "the archive is born 0600");
    assert.equal(process.umask(), umaskBefore, "the process umask is restored after the dump");
    console.log(`ok backup: ${backup.bytes} bytes, ${backup.entries} TOC entries, mode 0600`);

    /* P1 — the real restore reproduces the source. */
    const good = await restoreInto(backup.file, scratch);
    created.push(good.dbName);
    assert.equal(good.restored.status, "restored", JSON.stringify(good.restored));
    assert.deepEqual(good.differences, [], "the restored database matches the source");
    if (good.restored.status === "restored") console.log(`ok P1 restore matches source; restore took ${good.restored.elapsedMs.toFixed(0)} ms`);

    /* N1 — a corrupt archive is refused, and its target is still dropped. */
    const corrupt = path.join(scratch, "br1-corrupt.dump");
    const bytes = readFileSync(backup.file);
    writeFileSync(corrupt, bytes.subarray(0, Math.floor(bytes.length / 2)), { mode: 0o600 });
    const bad = await restoreInto(corrupt, scratch);
    created.push(bad.dbName);
    assert.equal(bad.restored.status, "refused");
    assert.equal(bad.restored.status === "refused" && bad.restored.reason, "restore-failed");
    console.log("ok N1 a truncated archive is refused (restore-failed)");

    /* N2 — a lost ledger is detected, both a missing row and a missing table. */
    const lostRow = await restoreInto(backup.file, scratch, (u) =>
      withClient(u, (c) => c.query("delete from drizzle.__drizzle_migrations where id = (select max(id) from drizzle.__drizzle_migrations)")).then(() => undefined),
    );
    created.push(lostRow.dbName);
    assert.ok(lostRow.differences?.some((d) => d.kind === "ledger"), `ledger row loss detected: ${JSON.stringify(lostRow.differences)}`);
    const lostTable = await restoreInto(backup.file, scratch, (u) =>
      withClient(u, (c) => c.query("drop table drizzle.__drizzle_migrations")).then(() => undefined),
    );
    created.push(lostTable.dbName);
    assert.ok(lostTable.differences?.some((d) => d.kind === "ledger-absent"), "ledger table loss detected");
    console.log("ok N2 a missing migration ledger row and a missing ledger table are both detected");

    /* N3 — a tenant count that differs is detected. */
    const extra = await restoreInto(backup.file, scratch, (u) =>
      withClient(u, (c) =>
        c.query("insert into companies (name, slug, plan, tenant_status) values ('BR-1 Extra', 'br1-extra', 'free', 'active')"),
      ).then(() => undefined),
    );
    created.push(extra.dbName);
    assert.ok(extra.differences?.some((d) => d.kind === "tenants" && d.source === 3 && d.target === 4), "tenant mismatch detected");
    console.log("ok N3 a tenant count mismatch is detected");

    /* N6 — schema drift is still detected: a lost index, and a lost CHECK (compared by name). */
    for (const [label, sql] of [
      ["index", "drop index companies_slug_uq"],
      ["check", "alter table audit_log drop constraint audit_log_authority_source_chk"],
    ] as const) {
      const drift = await restoreInto(backup.file, scratch, (u) => withClient(u, (c) => c.query(sql)).then(() => undefined));
      created.push(drift.dbName);
      assert.ok(drift.differences?.some((d) => d.kind === "schema"), `${label} loss detected as schema drift`);
    }
    console.log("ok N6 a dropped unique index and a dropped CHECK are detected as schema drift");

    /* N4 — below the disk floor nothing is restored. */
    const floor = await restoreInto(backup.file, scratch, undefined, Number.MAX_SAFE_INTEGER);
    created.push(floor.dbName);
    assert.equal(floor.restored.status === "refused" && floor.restored.reason, "disk-below-floor");
    await withClient(harness.adminUrl, async (c) => {
      /* The refused target was dropped in finally; nothing ran in it either way. */
      const r = await c.query("select 1 from pg_database where datname = $1", [floor.dbName]);
      assert.equal(r.rowCount, 0);
    });
    console.log("ok N4 below the free-space floor the restore refuses before running");

    /* N5 — the drill refuses a non-loopback target before any tool runs. */
    assert.throws(
      () => restoreArchive({ archive: backup.file, targetUrl: "postgresql://u@db.example.invalid/x", workDirectory: scratch }),
      /non-loopback/,
    );
    console.log("ok N5 a non-loopback target is refused");
  } finally {
    await harness.dropDatabase();
    rmSync(scratch, { recursive: true, force: true });
  }

  /* CLEANUP, PROVED: every database this run minted is gone, and so is the scratch directory. */
  await withClient(harness.adminUrl, async (c) => {
    const left = await c.query("select datname from pg_database where datname = any($1)", [created]);
    assert.equal(left.rowCount, 0, `left behind: ${left.rows.map((r) => r.datname).join(", ")}`);
  });
  assert.ok(!existsSync(scratch), "the scratch directory is removed");
  console.log(`ok cleanup: ${created.length} disposable databases dropped, scratch directory removed`);
  console.log("PASS br1 restore drill");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
