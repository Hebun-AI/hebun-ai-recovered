/*
 * BR-2 — the backup vault: authenticated encryption that fails closed, private file modes, a key
 * that is refused unless it is owner-only, and a retention plan that never prunes the newest backup
 * or prunes while a kept backup is unreadable. Synthetic bytes only; every file lives in a scratch
 * directory that is removed in `finally`, and the test proves it is gone.
 */
import assert from "node:assert/strict";
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  DEFAULT_RETENTION,
  VaultError,
  assertFreeSpace,
  decryptFile,
  encryptFile,
  generateKeyFile,
  loadKeyFile,
  planRetention,
  pruneVault,
  readVaultHeader,
  vaultFileName,
} from "../../scripts/lib/backup-vault";

const mode = (p: string) => statSync(p).mode & 0o777;

function code(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    assert.ok(error instanceof VaultError, `expected a VaultError, got ${String(error)}`);
    return error.code;
  }
  assert.fail("expected a refusal");
}

const scratch = mkdtempSync(path.join(tmpdir(), "hebun-br2-vault-"));
try {
  assert.equal(mode(scratch), 0o700);

  /* KEY */
  const keyFile = path.join(scratch, "keys", "vault.key");
  const { id } = generateKeyFile(keyFile);
  assert.equal(mode(keyFile), 0o600, "key is born 0600");
  assert.equal(mode(path.dirname(keyFile)), 0o700, "key directory is born 0700");
  assert.equal(code(() => generateKeyFile(keyFile)), "target-exists", "a key is never overwritten");
  const key = loadKeyFile(keyFile);
  assert.equal(key.id, id);
  chmodSync(keyFile, 0o644);
  assert.equal(code(() => loadKeyFile(keyFile)), "key-unsafe", "a group/world-readable key is refused");
  chmodSync(keyFile, 0o600);
  const shortKey = path.join(scratch, "short.key");
  writeFileSync(shortKey, randomBytes(16), { mode: 0o600 });
  assert.equal(code(() => loadKeyFile(shortKey)), "key-invalid");
  const linkKey = path.join(scratch, "link.key");
  symlinkSync(keyFile, linkKey);
  assert.equal(code(() => loadKeyFile(linkKey)), "key-unsafe", "a symlinked key is refused");
  console.log("ok key: born 0600 in a 0700 directory, never overwritten; 0644, short and symlinked keys refused");

  /* ROUND TRIP */
  const plain = path.join(scratch, "synthetic.dump");
  const body = randomBytes(3 * 1024 * 1024 + 17); // crosses the 1 MiB chunk boundary
  writeFileSync(plain, body, { mode: 0o600 });
  const vaultDir = path.join(scratch, "vault");
  const at = new Date(Date.UTC(2026, 10, 9, 3, 0, 0));
  const sealed = path.join(vaultDir, vaultFileName("postgres-custom", at));
  assert.equal(path.basename(sealed), "postgres-custom-20261109T030000Z.hbk");
  const header = encryptFile({ plaintext: plain, target: sealed, key, kind: "postgres-custom", name: "synthetic.dump", now: at });
  assert.equal(mode(sealed), 0o600, "vault file is 0600");
  assert.equal(mode(vaultDir), 0o700, "vault directory is 0700");
  assert.equal(header.plaintextSha256, createHash("sha256").update(body).digest("hex"));
  assert.ok(!readFileSync(sealed).includes(body.subarray(0, 64)), "ciphertext does not carry the plaintext");
  assert.deepEqual(readVaultHeader(sealed), header);
  const opened = path.join(scratch, "out", "restored.dump");
  decryptFile({ vault: sealed, key, target: opened });
  assert.ok(readFileSync(opened).equals(body), "round trip is byte-exact");
  assert.equal(mode(opened), 0o600);
  assert.equal(code(() => decryptFile({ vault: sealed, key, target: opened })), "target-exists", "decrypt never overwrites");
  assert.equal(code(() => encryptFile({ plaintext: plain, target: sealed, key, kind: "postgres-custom", name: "x", now: at })), "target-exists");
  console.log(`ok round trip: ${body.length} bytes sealed and opened byte-exact, files 0600, directories 0700`);

  /* FAIL CLOSED — each tamper is refused and leaves no output behind. */
  const bytes = readFileSync(sealed);
  const headerEnd = 12 + bytes.readUInt32BE(8);
  const tamper = (label: string, mutate: (b: Buffer) => Buffer, expected: string) => {
    const f = path.join(scratch, `tamper-${label}.hbk`);
    writeFileSync(f, mutate(Buffer.from(bytes)), { mode: 0o600 });
    const out = path.join(scratch, "out", `tamper-${label}.dump`);
    assert.equal(code(() => decryptFile({ vault: f, key, target: out })), expected, label);
    assert.ok(!existsSync(out) && !existsSync(`${out}.part`), `${label}: no plaintext and no part file is left`);
  };
  const flip = (at: number) => (b: Buffer) => ((b[at] = b[at]! ^ 0x01), b);
  tamper("ciphertext-first", flip(headerEnd), "authentication-failed");
  tamper("ciphertext-last", flip(bytes.length - 17), "authentication-failed");
  tamper("tag", flip(bytes.length - 1), "authentication-failed");
  tamper("truncated", (b) => b.subarray(0, b.length - 1000), "authentication-failed");
  tamper("appended", (b) => Buffer.concat([b, Buffer.from("x")]), "authentication-failed");
  tamper("magic", flip(0), "not-a-vault");
  // A header edit that stays valid JSON and the v1 shape is caught by the tag (the header is AAD).
  tamper("header-createdAt", (b) => {
    const s = b.toString("latin1").replace("2026-11-09T03:00:00.000Z", "2026-11-09T04:00:00.000Z");
    return Buffer.from(s, "latin1");
  }, "authentication-failed");
  tamper("header-garbage", flip(14), "header-invalid");
  tamper("empty", () => Buffer.alloc(0), "not-a-vault");
  const otherKeyFile = path.join(scratch, "keys", "other.key");
  generateKeyFile(otherKeyFile);
  assert.equal(code(() => decryptFile({ vault: sealed, key: loadKeyFile(otherKeyFile), target: path.join(scratch, "out", "wk") })), "wrong-key");
  assert.ok(!existsSync(path.join(scratch, "out", "wk")));
  console.log("ok fail closed: ciphertext, tag, header, truncation, extension, magic and wrong key refused; no output left");

  /* A file sealed by the right key whose header digest is wrong (an encrypt-time race) is still refused. */
  {
    const forged = { ...header, plaintextSha256: "0".repeat(64) };
    const hb = Buffer.from(JSON.stringify(forged), "utf8");
    const len = Buffer.alloc(4);
    len.writeUInt32BE(hb.length);
    const prefix = Buffer.concat([Buffer.from("HEBUNBK1"), len, hb]);
    const c = createCipheriv("aes-256-gcm", key.bytes, Buffer.from(forged.nonce, "base64"));
    c.setAAD(prefix);
    const f = path.join(scratch, "forged-digest.hbk");
    writeFileSync(f, Buffer.concat([prefix, c.update(body), c.final(), c.getAuthTag()]), { mode: 0o600 });
    const out = path.join(scratch, "out", "forged.dump");
    assert.equal(code(() => decryptFile({ vault: f, key, target: out })), "digest-mismatch");
    assert.ok(!existsSync(out) && !existsSync(`${out}.part`), "digest mismatch leaves no output");
  }
  console.log("ok an authentic file whose sealed digest is wrong is refused (digest-mismatch); no output left");

  /* DISK FLOOR */
  assert.equal(code(() => assertFreeSpace(scratch, Number.MAX_SAFE_INTEGER)), "disk-below-floor");
  console.log("ok disk floor refuses before writing");

  /* RETENTION — pure plan */
  const stamps: string[] = [];
  for (let d = 0; d < 120; d++) {
    for (const h of [3, 15]) stamps.push(vaultFileName("postgres-custom", new Date(Date.UTC(2026, 10, 9, h) - d * 86400000)));
  }
  const plan = planRetention([...stamps, "README.txt", "media-tar-20261109T030000Z.hbk.part"], DEFAULT_RETENTION);
  assert.equal(plan.keep.length + plan.prune.length, 240, "foreign names are neither kept nor pruned");
  const newestFirst = [...stamps].sort().reverse();
  assert.equal(plan.keep[0], newestFirst[0], "the newest is kept");
  assert.deepEqual(plan.keep.slice(0, 3), newestFirst.slice(0, 3), "keepLast holds the three newest");
  const days = new Set(plan.keep.map((n) => n.slice(16, 24)));
  assert.ok(days.size >= 7 && plan.keep.length <= 3 + 7 + 4 + 6, `GFS bound: ${plan.keep.length} kept over ${days.size} days`);
  assert.ok(plan.keep.some((n) => n.includes("202607")), "a backup roughly four months old survives as a monthly");
  assert.deepEqual(planRetention([stamps[5]!], { keepLast: 0, keepDaily: 0, keepWeekly: 0, keepMonthly: 0 }).keep, [stamps[5]], "a zero policy still keeps the newest");
  assert.throws(() => planRetention([...stamps.slice(0, 2), "media-tar-20261109T030000Z.hbk"], DEFAULT_RETENTION), /one kind/);
  console.log(`ok retention plan: ${plan.keep.length} kept / ${plan.prune.length} pruned of 240, newest always kept`);

  /* RETENTION — applied, and refused while a kept file is broken */
  const pruneDir = path.join(scratch, "prune");
  const small = path.join(scratch, "small.dump");
  writeFileSync(small, "synthetic", { mode: 0o600 });
  const pruneStamps = stamps.slice(0, 30);
  for (const n of pruneStamps) {
    const at2 = new Date(Date.UTC(+n.slice(16, 20), +n.slice(20, 22) - 1, +n.slice(22, 24), +n.slice(25, 27)));
    encryptFile({ plaintext: small, target: path.join(pruneDir, n), key, kind: "postgres-custom", name: "small.dump", now: at2 });
  }
  writeFileSync(path.join(pruneDir, "notes.txt"), "not mine");
  const expected = planRetention(pruneStamps, DEFAULT_RETENTION);
  const dry = pruneVault({ directory: pruneDir, kind: "postgres-custom", key, apply: false });
  assert.equal(dry.deleted.length, 0);
  assert.equal(readdirSync(pruneDir).length, 31, "dry run deletes nothing");
  // Break a file that will be kept: pruning must refuse and delete nothing.
  const victim = path.join(pruneDir, expected.keep[expected.keep.length - 1]!);
  const good = readFileSync(victim);
  writeFileSync(victim, flip(good.length - 1)(Buffer.from(good)));
  assert.equal(code(() => pruneVault({ directory: pruneDir, kind: "postgres-custom", key, apply: true })), "authentication-failed");
  assert.equal(readdirSync(pruneDir).length, 31, "nothing pruned while a kept backup is unreadable");
  writeFileSync(victim, good);
  const applied = pruneVault({ directory: pruneDir, kind: "postgres-custom", key, apply: true });
  assert.deepEqual(applied.deleted.sort(), expected.prune.sort());
  assert.deepEqual(readdirSync(pruneDir).filter((n) => n.endsWith(".hbk")).sort(), expected.keep.sort());
  assert.ok(existsSync(path.join(pruneDir, "notes.txt")), "a foreign file is never deleted");
  console.log(`ok retention applied: ${applied.deleted.length} pruned, ${expected.keep.length} kept and verified; refused while a kept file was broken`);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
assert.ok(!existsSync(scratch), "scratch removed");
console.log("PASS br2 backup vault");
