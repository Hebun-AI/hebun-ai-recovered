/*
 * BR-2 — off-site transport through the provider-independent interface, with the local-directory
 * adapter as the simulated remote. Synthetic bytes only. Proves: only sealed files leave; verified
 * after transfer; idempotent; conflicts never overwritten; bounded retries; pull authenticates before
 * accepting; off-site retention cannot remove the last recoverable backup; the key appears in no
 * archive, remote object, result or CLI output; plaintext media snapshots are removed on success and
 * on failure, and the key can never be sealed or deleted by that path.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { decryptFile, encryptFile, generateKeyFile, loadKeyFile, vaultFileName } from "../../scripts/lib/backup-vault";
import {
  LocalDirectoryTransport,
  pruneOffsite,
  pullSealed,
  pushSealed,
  pushVault,
  sealMediaSnapshot,
  sha256File,
  type OffsiteTransport,
} from "../../scripts/lib/offsite-backup";

const mode = (p: string) => statSync(p).mode & 0o777;
const noWait = { attempts: 4, baseDelayMs: 0 };

/** Wraps a transport, counts calls, and can inject failures. */
class Spy implements OffsiteTransport {
  readonly name = "spy";
  calls: Record<string, number> = { head: 0, put: 0, get: 0, list: 0, delete: 0 };
  failPuts = 0;
  corruptPuts = 0;
  corruptGets = 0;
  constructor(private readonly inner: OffsiteTransport, private readonly remoteRoot: string) {}
  async head(o: string) { this.calls.head!++; return this.inner.head(o); }
  async put(f: string, o: string) {
    this.calls.put!++;
    if (this.failPuts > 0) { this.failPuts--; throw new Error("ECONNRESET (injected)"); }
    await this.inner.put(f, o);
    if (this.corruptPuts > 0) { this.corruptPuts--; const p = path.join(this.remoteRoot, o); writeFileSync(p, readFileSync(p).subarray(0, 100)); }
  }
  async get(o: string, t: string) {
    this.calls.get!++;
    await this.inner.get(o, t);
    if (this.corruptGets > 0) { this.corruptGets--; const b = readFileSync(t); b[b.length - 1] = b[b.length - 1]! ^ 1; writeFileSync(t, b); }
  }
  async list() { this.calls.list!++; return this.inner.list(); }
  async delete(o: string) { this.calls.delete!++; return this.inner.delete(o); }
}

async function main() {
  const scratch = mkdtempSync(path.join(tmpdir(), "hebun-br2-offsite-"));
  try {
    const keyFile = path.join(scratch, "keys", "vault.key");
    generateKeyFile(keyFile);
    const key = loadKeyFile(keyFile);
    const keyBytes = readFileSync(keyFile);
    const vault = path.join(scratch, "vault");
    const remoteRoot = path.join(scratch, "remote");
    const plain = path.join(scratch, "synthetic.dump");
    const body = randomBytes(256 * 1024);
    writeFileSync(plain, body, { mode: 0o600 });
    const at = (d: number) => new Date(Date.UTC(2026, 10, 9, 3) - d * 86400000);
    const seal = (d: number, kind: "postgres-custom" | "media-tar" = "postgres-custom") => {
      const f = path.join(vault, vaultFileName(kind, at(d)));
      encryptFile({ plaintext: plain, target: f, key, kind, name: "synthetic.dump", now: at(d) });
      return f;
    };
    const results: unknown[] = [];

    /* O1 — push, verify, idempotent. */
    const f0 = seal(0);
    const spy = new Spy(new LocalDirectoryTransport(remoteRoot), remoteRoot);
    const r1 = await pushSealed({ file: f0, key, transport: spy, retry: noWait });
    results.push(r1);
    assert.equal(r1.status, "uploaded", JSON.stringify(r1));
    const remoteFile = path.join(remoteRoot, path.basename(f0));
    assert.deepEqual(sha256File(remoteFile), sha256File(f0));
    assert.equal(mode(remoteFile), 0o600);
    assert.equal(mode(remoteRoot), 0o700);
    const mtime = statSync(remoteFile).mtimeMs;
    const r2 = await pushSealed({ file: f0, key, transport: spy, retry: noWait });
    results.push(r2);
    assert.equal(r2.status, "already-present");
    assert.equal(spy.calls.put, 1, "an identical object is not uploaded again");
    assert.equal(statSync(remoteFile).mtimeMs, mtime);
    console.log("ok O1 sealed file pushed, digest verified, 0600 in a 0700 remote; second push is already-present");

    /* O2 — only sealed files leave; the transport is never called otherwise. */
    const before = { ...spy.calls };
    const fakeName = path.join(scratch, "fake", vaultFileName("postgres-custom", at(1)));
    mkdirSync(path.dirname(fakeName), { recursive: true });
    writeFileSync(fakeName, body, { mode: 0o600 });
    for (const file of [plain, keyFile, fakeName]) {
      const r = await pushSealed({ file, key, transport: spy, retry: noWait });
      results.push(r);
      assert.equal(r.status === "refused" && r.reason, "not-sealed", file);
    }
    const otherKey = path.join(scratch, "keys", "other.key");
    generateKeyFile(otherKey);
    const wk = await pushSealed({ file: f0, key: loadKeyFile(otherKey), transport: spy, retry: noWait });
    assert.equal(wk.status === "refused" && wk.reason, "not-sealed", "a file the key cannot authenticate is not pushed");
    assert.deepEqual(spy.calls, before, "no transport call for a refused file");
    console.log("ok O2 plaintext, the key file, a vault-named plaintext and a wrong-key file are refused before any transfer");

    /* O3 — same name, different content: conflict, never overwritten, not retried. */
    const conflictLocal = path.join(scratch, "conflict", path.basename(f0));
    encryptFile({ plaintext: plain, target: conflictLocal, key, kind: "postgres-custom", name: "synthetic.dump", now: at(0) });
    const putsBefore = spy.calls.put;
    const r3 = await pushSealed({ file: conflictLocal, key, transport: spy, retry: noWait });
    assert.equal(r3.status === "refused" && r3.reason, "remote-conflict");
    assert.equal(spy.calls.put, putsBefore);
    assert.deepEqual(sha256File(remoteFile), sha256File(f0), "the remote object is unchanged");
    console.log("ok O3 a different object under the same name is a conflict and is never overwritten");

    /* O4 — transient failures retried with backoff; bounded. */
    const f1 = seal(1);
    const sleeps: number[] = [];
    spy.failPuts = 2;
    const r4 = await pushSealed({ file: f1, key, transport: spy, retry: { attempts: 4, baseDelayMs: 100, sleep: async (ms) => void sleeps.push(ms) } });
    assert.equal(r4.status, "uploaded");
    assert.equal(r4.status === "uploaded" && r4.attempts, 3);
    assert.deepEqual(sleeps, [100, 200], "exponential backoff");
    const f2 = seal(2);
    spy.failPuts = 99;
    const puts = spy.calls.put!;
    const r5 = await pushSealed({ file: f2, key, transport: spy, retry: noWait });
    assert.equal(r5.status === "refused" && r5.reason, "transfer-failed");
    assert.equal(spy.calls.put! - puts, 4, "exactly `attempts` tries");
    assert.ok(!existsSync(path.join(remoteRoot, path.basename(f2))));
    spy.failPuts = 0;
    console.log("ok O4 two transient failures retried (backoff 100, 200 ms); persistent failure stops after 4 tries, nothing remote");

    /* O5 — corrupted in transit: detected, the bad object removed, retried. */
    spy.corruptPuts = 1;
    const r6 = await pushSealed({ file: f2, key, transport: spy, retry: noWait });
    assert.equal(r6.status, "uploaded");
    assert.equal(r6.status === "uploaded" && r6.attempts, 2);
    assert.deepEqual(sha256File(path.join(remoteRoot, path.basename(f2))), sha256File(f2));
    const f3 = seal(3);
    spy.corruptPuts = 99;
    const r7 = await pushSealed({ file: f3, key, transport: spy, retry: noWait });
    assert.equal(r7.status === "refused" && r7.reason, "transfer-failed");
    assert.ok(!existsSync(path.join(remoteRoot, path.basename(f3))), "a mismatched object is never left behind");
    spy.corruptPuts = 0;
    console.log("ok O5 a corrupted transfer is detected, removed and retried; persistent corruption leaves nothing remote");

    /* O6 — pull authenticates before accepting. */
    const out = path.join(scratch, "pulled");
    const p1 = await pullSealed({ object: path.basename(f0), key, transport: spy, outDirectory: out, retry: noWait });
    assert.equal(p1.status, "pulled", JSON.stringify(p1));
    if (p1.status === "pulled") {
      assert.equal(mode(p1.file), 0o600);
      assert.equal(mode(out), 0o700);
      const opened = path.join(scratch, "opened.dump");
      decryptFile({ vault: p1.file, key, target: opened });
      assert.ok(readFileSync(opened).equals(body), "restore from the simulated remote is byte-exact");
    }
    const again = await pullSealed({ object: path.basename(f0), key, transport: spy, outDirectory: out, retry: noWait });
    assert.equal(again.status, "refused", "never overwrites a local file");
    spy.corruptGets = 99;
    const p2 = await pullSealed({ object: path.basename(f1), key, transport: spy, outDirectory: out, retry: noWait });
    assert.equal(p2.status === "refused" && p2.reason, "digest-mismatch");
    spy.corruptGets = 0;
    const tamperedRemote = path.join(remoteRoot, path.basename(f1));
    const tb = readFileSync(tamperedRemote);
    tb[200] = tb[200]! ^ 1;
    writeFileSync(tamperedRemote, tb);
    const p3 = await pullSealed({ object: path.basename(f1), key, transport: spy, outDirectory: out, retry: noWait });
    assert.equal(p3.status === "refused" && p3.reason, "vault-rejected", "remote digest matches its own bytes, but they do not authenticate");
    const p4 = await pullSealed({ object: vaultFileName("postgres-custom", at(50)), key, transport: spy, outDirectory: out, retry: noWait });
    assert.equal(p4.status === "refused" && p4.reason, "absent");
    assert.deepEqual(readdirSync(out), [path.basename(f0)], "refused pulls leave nothing behind");
    console.log("ok O6 pull: byte-exact restore from the simulated remote; transit corruption, tampered remote and absent object refused, nothing left");

    /* O7 — off-site retention cannot remove the last recoverable backup. */
    const pruneRemote = path.join(scratch, "remote-prune");
    const pt = new LocalDirectoryTransport(pruneRemote);
    const pv = path.join(scratch, "vault-prune");
    const names: string[] = [];
    for (let d = 0; d < 6; d++) {
      const f = path.join(pv, vaultFileName("postgres-custom", at(d)));
      encryptFile({ plaintext: plain, target: f, key, kind: "postgres-custom", name: "synthetic.dump", now: at(d) });
      names.push(path.basename(f));
    }
    const pushed = await pushVault({ directory: pv, kind: "postgres-custom", key, transport: pt, retry: noWait });
    assert.ok(pushed.every((r) => r.status === "uploaded") && pushed.length === 6);
    const newest = path.join(pruneRemote, names[0]!);
    const good = readFileSync(newest);
    const broken = Buffer.from(good);
    broken[broken.length - 1] = broken[broken.length - 1]! ^ 1;
    writeFileSync(newest, broken);
    const policy = { keepLast: 1, keepDaily: 0, keepWeekly: 0, keepMonthly: 0 };
    const refusedPrune = await pruneOffsite({ transport: pt, kind: "postgres-custom", key, workDirectory: scratch, policy, apply: true });
    assert.ok("status" in refusedPrune && refusedPrune.status === "refused", JSON.stringify(refusedPrune));
    assert.equal(readdirSync(pruneRemote).length, 6, "the newest is broken: nothing is deleted, older recoverable backups survive");
    writeFileSync(newest, good);
    const applied = await pruneOffsite({ transport: pt, kind: "postgres-custom", key, workDirectory: scratch, policy, apply: true });
    assert.ok(!("status" in applied));
    if (!("status" in applied)) assert.equal(applied.deleted.length, 5);
    assert.deepEqual(readdirSync(pruneRemote), [names[0]], "the newest, verified, is kept");
    const zero = await pruneOffsite({ transport: pt, kind: "postgres-custom", key, workDirectory: scratch, policy: { keepLast: 0, keepDaily: 0, keepWeekly: 0, keepMonthly: 0 }, apply: true });
    assert.ok(!("status" in zero) && zero.deleted.length === 0);
    assert.deepEqual(readdirSync(pruneRemote), [names[0]], "even a zero policy keeps the last backup");
    assert.deepEqual(readdirSync(scratch).filter((n) => n.startsWith("hebun-offsite-verify-")), [], "verification scratch removed");
    console.log("ok O7 off-site retention verifies kept objects first; a broken newest blocks all deletion; the last backup is never pruned");

    /* M1 — media snapshot plaintext: owner-only, removed on success and failure; the key is untouchable. */
    const mvault = path.join(scratch, "vault-media");
    const snap = (name: string, m = 0o600) => {
      const p = path.join(scratch, name);
      writeFileSync(p, randomBytes(4096), { mode: m });
      chmodSync(p, m);
      return p;
    };
    const s1 = snap("media-1.tar");
    const m1 = sealMediaSnapshot({ snapshot: s1, vaultDirectory: mvault, key, keyFile, now: at(0) });
    assert.equal(m1.status, "sealed");
    assert.ok(!existsSync(s1), "plaintext removed after a successful seal");
    const s2 = snap("media-2.tar", 0o644);
    const m2 = sealMediaSnapshot({ snapshot: s2, vaultDirectory: mvault, key, keyFile, now: at(1) });
    assert.equal(m2.status === "refused" && m2.reason, "snapshot-unsafe");
    assert.ok(!existsSync(s2), "a group/world-readable plaintext is refused and removed");
    const s3 = snap("media-3.tar");
    const m3 = sealMediaSnapshot({ snapshot: s3, vaultDirectory: mvault, key, keyFile, now: at(0) }); // same name: seal fails
    assert.equal(m3.status === "refused" && m3.reason, "seal-failed");
    assert.ok(!existsSync(s3), "plaintext removed when sealing fails");
    assert.equal(readdirSync(mvault).length, 1, "a failed seal adds nothing");
    const keyLink = path.join(scratch, "key-link.tar");
    symlinkSync(keyFile, keyLink);
    for (const p of [keyFile, keyLink]) {
      const r = sealMediaSnapshot({ snapshot: p, vaultDirectory: mvault, key, keyFile, now: at(5) });
      assert.equal(r.status === "refused" && r.reason, "key-not-sealable", p);
    }
    assert.ok(readFileSync(keyFile).equals(keyBytes), "the key file is untouched");
    console.log("ok M1 media plaintext removed after success and after failure; 0644 refused; the key can be neither sealed nor deleted");

    /* K1 — the key appears in no archive, remote object, result or CLI output. */
    const needles = [keyBytes, Buffer.from(keyBytes.toString("hex")), Buffer.from(keyBytes.toString("base64"))];
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : e.isFile() ? [path.join(dir, e.name)] : []));
    const scanned = [vault, remoteRoot, pruneRemote, pv, mvault, out].flatMap(walk);
    for (const file of scanned) for (const n of needles) assert.ok(!readFileSync(file).includes(n), `key material found in ${file}`);
    const cli = spawnSync(process.execPath, ["--import", "tsx", "scripts/backup-vault.ts", "offsite-push", "--vault", pv, "--kind", "postgres-custom", "--key", keyFile, "--remote-dir", path.join(scratch, "remote-cli")], { encoding: "utf8" });
    assert.equal(cli.status, 0, cli.stderr);
    const cliPull = spawnSync(process.execPath, ["--import", "tsx", "scripts/backup-vault.ts", "offsite-pull", "--object", names[0]!, "--key", keyFile, "--remote-dir", path.join(scratch, "remote-cli"), "--out", path.join(scratch, "cli-out")], { encoding: "utf8" });
    assert.equal(cliPull.status, 0, cliPull.stderr);
    const logs = JSON.stringify(results) + cli.stdout + cli.stderr + cliPull.stdout + cliPull.stderr;
    for (const n of needles.slice(1)) assert.ok(!logs.includes(n.toString()), "key material in a result or log");
    assert.ok(cli.stdout.includes(key.id), "results name the key by id only");
    console.log(`ok K1 key material absent from ${scanned.length} archive/remote files, results and CLI output; key referenced by id`);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
  assert.ok(!existsSync(scratch));
  console.log("PASS br2 off-site transport");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
