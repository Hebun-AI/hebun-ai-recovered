/*
 * BR-2 — the scheduled database backup end to end, on synthetic data only.
 *
 * A disposable source (canonical migrations, three synthetic tenants) is backed up by
 * `backupDatabase`: dumped, sealed into the vault, read back and authenticated, plaintext deleted.
 * `restoreFromVault` restores the sealed file into an empty disposable target, and BR-1's
 * `compareSnapshots` must find no difference. Then the refusals: a tampered vault file, the wrong
 * key, and the wrong kind are rejected BEFORE pg_restore runs (the target stays empty); a disk below
 * the floor and an unreachable server refuse without leaving files. Retention prunes after a second
 * backup. No scratch directory, plaintext dump or database survives the run, and the test proves it.
 */
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { encryptFile, generateKeyFile, loadKeyFile, vaultFileName } from "../../scripts/lib/backup-vault";
import { backupDatabase, restoreFromVault } from "../../scripts/lib/database-backup";
import { compareSnapshots, snapshotDatabase } from "../../scripts/lib/restore-drill";

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

const publicTables = (url: string) =>
  withClient(url, async (c) => Number((await c.query("select count(*)::int as n from information_schema.tables where table_schema = 'public'")).rows[0].n));

async function main(): Promise<void> {
  const scratch = mkdtempSync(path.join(tmpdir(), "hebun-br2-db-"));
  const vault = path.join(scratch, "vault");
  const leftovers = () => readdirSync(scratch).filter((n) => /^hebun-(backup|restore)-/.test(n));
  const source = createDisposablePostgresHarness("br2_source");
  const minted: string[] = [source.dbName];
  try {
    await source.createDatabase();
    source.migrateDatabase();
    await withClient(source.dbUrl, async (c) => {
      for (const n of [1, 2, 3]) {
        await seedLocalIdentity(c, { companyName: `BR-2 Synthetic ${n}`, companySlug: `br2-synthetic-${n}`, email: `br2-owner-${n}@example.invalid` });
      }
    });
    const before = await snapshotDatabase(source.dbUrl);
    assert.equal(before.tenants, 3);
    /* The identity every backup must prove before pg_dump runs. */
    const expected = await withClient(source.dbUrl, async (c) => {
      const row = (await c.query("select system_identifier::text as sid, current_database() as db from pg_control_system()")).rows[0];
      return { systemIdentifier: row.sid as string, database: row.db as string };
    });

    const keyFile = path.join(scratch, "keys", "vault.key");
    generateKeyFile(keyFile);
    const key = loadKeyFile(keyFile);

    /* B1 — backup: sealed, 0600, authenticated, and no plaintext dump left anywhere. */
    const t0 = new Date(Date.UTC(2026, 10, 9, 3, 0, 0));
    const started = process.hrtime.bigint();
    const b1 = await backupDatabase({ connectionString: source.dbUrl, expectedTarget: expected, vaultDirectory: vault, key, repositoryRoot: REPO_ROOT, workRoot: scratch, now: t0 });
    const backupMs = Number(process.hrtime.bigint() - started) / 1e6;
    assert.equal(b1.status, "sealed", JSON.stringify(b1));
    if (b1.status !== "sealed") return;
    assert.equal(path.basename(b1.file), vaultFileName("postgres-custom", t0));
    assert.equal(statSync(b1.file).mode & 0o777, 0o600);
    assert.equal(statSync(vault).mode & 0o777, 0o700);
    assert.deepEqual(leftovers(), [], "the plaintext dump and its scratch directory are gone");
    assert.ok(!readFileSync(b1.file).includes(Buffer.from("PGDMP")), "the sealed file does not carry the pg_dump magic in clear");
    console.log(`ok B1 backup sealed: ${b1.header.plaintextBytes} plaintext bytes, key ${b1.header.keyId}, ${backupMs.toFixed(0)} ms, no plaintext left`);

    /* R1 — restore from the vault reproduces the source. */
    const target = createDisposablePostgresHarness("br2_target");
    minted.push(target.dbName);
    await target.createDatabase();
    try {
      const r = restoreFromVault({ vault: b1.file, key, targetUrl: target.dbUrl, workRoot: scratch });
      assert.equal(r.status, "restored", JSON.stringify(r));
      assert.deepEqual(compareSnapshots(before, await snapshotDatabase(target.dbUrl)), [], "restored database matches the source");
      if (r.status === "restored") console.log(`ok R1 restore from vault matches source (83 tables, 3 tenants); pg_restore ${r.elapsedMs.toFixed(0)} ms`);
    } finally {
      await target.dropDatabase();
    }
    assert.deepEqual(leftovers(), []);

    /* R2..R4 — rejected before pg_restore: the target stays EMPTY. */
    const sealed = readFileSync(b1.file);
    const tampered = path.join(scratch, "tampered.hbk");
    const flipped = Buffer.from(sealed);
    flipped[Math.floor(flipped.length / 2)] = flipped[Math.floor(flipped.length / 2)]! ^ 0x01;
    writeFileSync(tampered, flipped, { mode: 0o600 });
    const otherKey = path.join(scratch, "keys", "other.key");
    generateKeyFile(otherKey);
    const notDb = path.join(scratch, "media.tar");
    writeFileSync(notDb, "synthetic media archive", { mode: 0o600 });
    const mediaVault = path.join(scratch, "media.hbk");
    encryptFile({ plaintext: notDb, target: mediaVault, key, kind: "media-tar", name: "media.tar" });
    for (const [label, vaultFile, k, reason] of [
      ["tampered", tampered, key, "vault-rejected"],
      ["wrong key", b1.file, loadKeyFile(otherKey), "vault-rejected"],
      ["wrong kind", mediaVault, key, "wrong-kind"],
    ] as const) {
      const t = createDisposablePostgresHarness("br2_reject");
      minted.push(t.dbName);
      await t.createDatabase();
      try {
        const r = restoreFromVault({ vault: vaultFile, key: k, targetUrl: t.dbUrl, workRoot: scratch });
        assert.equal(r.status === "refused" && r.reason, reason, `${label}: ${JSON.stringify(r)}`);
        assert.equal(await publicTables(t.dbUrl), 0, `${label}: nothing reached the target`);
      } finally {
        await t.dropDatabase();
      }
      assert.deepEqual(leftovers(), [], `${label}: scratch removed after the refusal`);
    }
    console.log("ok R2-R4 tampered file, wrong key and wrong kind rejected before pg_restore; targets stayed empty");

    /* F1 — below the floor nothing is written; F2 — an unreachable server refuses cleanly. */
    const vaultBefore = readdirSync(vault).sort();
    const f1 = await backupDatabase({ connectionString: source.dbUrl, expectedTarget: expected, vaultDirectory: vault, key, repositoryRoot: REPO_ROOT, workRoot: scratch, floorBytes: Number.MAX_SAFE_INTEGER });
    assert.equal(f1.status === "refused" && f1.reason, "disk-below-floor");
    const f2 = await backupDatabase({ connectionString: "postgresql://postgres@127.0.0.1:1/none", expectedTarget: expected, vaultDirectory: vault, key, repositoryRoot: REPO_ROOT, workRoot: scratch });
    assert.equal(f2.status === "refused" && f2.reason, "connect-failed");
    const r5 = restoreFromVault({ vault: b1.file, key, targetUrl: "postgresql://postgres@127.0.0.1:55432/x", workRoot: scratch, floorBytes: Number.MAX_SAFE_INTEGER });
    assert.equal(r5.status === "refused" && r5.reason, "disk-below-floor");
    const sealedBytes = readFileSync(b1.file);
    const f3 = await backupDatabase({ connectionString: source.dbUrl, expectedTarget: expected, vaultDirectory: vault, key, repositoryRoot: REPO_ROOT, workRoot: scratch, now: t0 });
    assert.equal(f3.status === "refused" && f3.reason, "seal-failed", "a second backup at the same instant is refused");
    assert.ok(readFileSync(b1.file).equals(sealedBytes), "the existing sealed backup is never deleted or changed by a failed seal");
    assert.deepEqual(readdirSync(vault).sort(), vaultBefore, "refusals add nothing to the vault");
    assert.deepEqual(leftovers(), []);
    console.log("ok F1-F2 disk floor and unreachable server refuse; vault and scratch unchanged");

    /* I1-I2 — identity is proven before any dump: a wrong system identifier or database refuses, the vault is untouched. */
    const wrongSid = expected.systemIdentifier.endsWith("0") ? `${expected.systemIdentifier.slice(0, -1)}1` : `${expected.systemIdentifier.slice(0, -1)}0`;
    for (const [label, target, reason] of [
      ["system identifier", { ...expected, systemIdentifier: wrongSid }, "identity-system-identifier-mismatch"],
      ["database", { ...expected, database: `${expected.database}_other` }, "identity-database-mismatch"],
    ] as const) {
      const r = await backupDatabase({ connectionString: source.dbUrl, expectedTarget: target, vaultDirectory: vault, key, repositoryRoot: REPO_ROOT, workRoot: scratch, now: new Date(Date.UTC(2026, 10, 9, 5, 0, 0)) });
      assert.equal(r.status === "refused" && r.reason, reason, `${label}: ${JSON.stringify(r)}`);
      assert.deepEqual(readdirSync(vault).sort(), vaultBefore, `${label}: nothing reached the vault`);
      assert.deepEqual(leftovers(), [], `${label}: no dump was started`);
    }
    console.log("ok I1-I2 wrong system identifier and wrong database refuse before pg_dump; vault unchanged");

    /* I3 — a read-only role (pg_read_all_data) proves identity and backs up. */
    const roRole = `br2_ro_${Date.now().toString(36)}`;
    await withClient(source.adminUrl, (c) => c.query(`create role ${roRole} login; grant pg_read_all_data to ${roRole}`));
    try {
      const roUrl = new URL(source.dbUrl);
      roUrl.username = roRole;
      roUrl.password = "";
      const roVault = path.join(scratch, "vault-ro");
      const ro = await backupDatabase({ connectionString: roUrl.toString(), expectedTarget: expected, vaultDirectory: roVault, key, repositoryRoot: REPO_ROOT, workRoot: scratch, now: t0 });
      assert.equal(ro.status, "sealed", JSON.stringify(ro));
      if (ro.status === "sealed") assert.equal(ro.header.kind, "postgres-custom");
      assert.deepEqual(leftovers(), []);
    } finally {
      await withClient(source.adminUrl, (c) => c.query(`drop role if exists ${roRole}`));
    }
    console.log("ok I3 a pg_read_all_data role proves identity and seals a backup");

    /* I4 — refusal details never carry the URL or its user, password or host. */
    const secretUrl = "postgresql://br2secretuser:br2s3cretpw@127.0.0.1:1/none";
    const leak = await backupDatabase({ connectionString: secretUrl, expectedTarget: expected, vaultDirectory: vault, key, repositoryRoot: REPO_ROOT, workRoot: scratch });
    assert.equal(leak.status, "refused");
    for (const needle of ["br2secretuser", "br2s3cretpw", "127.0.0.1", secretUrl]) {
      assert.ok(!JSON.stringify(leak).includes(needle), `I4: the refusal does not carry ${needle}`);
    }
    console.log("ok I4 refusal detail redacted (no user, password, host or URL)");

    /* P1 — a second backup with retention prunes the first. */
    const b2 = await backupDatabase({
      connectionString: source.dbUrl, expectedTarget: expected, vaultDirectory: vault, key, repositoryRoot: REPO_ROOT, workRoot: scratch,
      now: new Date(Date.UTC(2026, 10, 10, 3, 0, 0)), prune: true,
      retention: { keepLast: 1, keepDaily: 0, keepWeekly: 0, keepMonthly: 0 },
    });
    assert.equal(b2.status, "sealed", JSON.stringify(b2));
    if (b2.status === "sealed") assert.deepEqual(b2.pruned, [path.basename(b1.file)]);
    assert.deepEqual(readdirSync(vault).filter((n) => n.endsWith(".hbk")), ["postgres-custom-20261110T030000Z.hbk"]);
    console.log("ok P1 second backup sealed and retention pruned the older one");
  } finally {
    await source.dropDatabase();
    rmSync(scratch, { recursive: true, force: true });
  }
  await withClient(source.adminUrl, async (c) => {
    const left = await c.query("select datname from pg_database where datname = any($1)", [minted]);
    assert.equal(left.rowCount, 0, `left behind: ${left.rows.map((r) => r.datname).join(", ")}`);
  });
  assert.ok(!existsSync(scratch));
  console.log(`ok cleanup: ${minted.length} disposable databases dropped, scratch removed`);
  console.log("PASS br2 database backup");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
