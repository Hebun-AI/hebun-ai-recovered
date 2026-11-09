/*
 * BR-2 — the media backup chain, as an operator runs it, on synthetic objects:
 *   VPS: hebun_media_backup.py snapshot  →  operator host: backup-vault seal (media-tar)
 *   → open → hebun_media_backup.py verify → restore into a NEW root → byte-exact.
 * Also runs the media tool's own unittest suite, so CI exercises it. Scratch is removed and proven gone.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { VaultError, decryptFile, encryptFile, generateKeyFile, loadKeyFile } from "../../scripts/lib/backup-vault";

const INFRA = path.resolve(process.cwd(), "..", "..", "infra", "media-store-vps");
const TOOL = path.join(INFRA, "hebun_media_backup.py");

function py(args: string[], cwd = INFRA) {
  const r = spawnSync("python3", ["-I", ...args], { cwd, encoding: "utf8" });
  return { status: r.status, out: (r.stdout ?? "").trim(), err: (r.stderr ?? "").trim() };
}

const unit = spawnSync("python3", ["-m", "unittest", "test_hebun_media_backup.py"], { cwd: INFRA, encoding: "utf8" });
assert.equal(unit.status, 0, `media backup unittest failed:\n${unit.stderr}`);
console.log(`ok python unittest: ${/Ran (\d+) tests/.exec(unit.stderr)?.[1]} tests OK`);

const scratch = mkdtempSync(path.join(tmpdir(), "hebun-br2-media-chain-"));
try {
  const root = path.join(scratch, "store");
  const objects = new Map<string, Buffer>();
  for (const tenant of [randomUUID(), randomUUID()]) {
    const dir = path.join(root, "tenants", tenant, "media");
    mkdirSync(dir, { recursive: true });
    for (let i = 0; i < 3; i++) {
      const asset = randomUUID();
      const body = randomBytes(64 * 1024 + i);
      writeFileSync(path.join(dir, asset), body);
      chmodSync(path.join(dir, asset), 0o440);
      objects.set(`tenants/${tenant}/media/${asset}`, body);
    }
  }

  const snap = path.join(scratch, "media-snapshot.tar");
  const s = py([TOOL, "snapshot", root, snap, "--min-free-bytes", "0"]);
  assert.equal(s.status, 0, s.out + s.err);
  assert.equal(JSON.parse(s.out).objects, 6);

  generateKeyFile(path.join(scratch, "keys", "vault.key"));
  const key = loadKeyFile(path.join(scratch, "keys", "vault.key"));
  const sealed = path.join(scratch, "vault", "media-tar-20261109T030000Z.hbk");
  encryptFile({ plaintext: snap, target: sealed, key, kind: "media-tar", name: "media-snapshot.tar" });
  assert.equal(statSync(sealed).mode & 0o777, 0o600);
  rmSync(snap); // only the sealed file would leave the host

  const opened = path.join(scratch, "opened", "media-snapshot.tar");
  assert.equal(decryptFile({ vault: sealed, key, target: opened }).kind, "media-tar");
  const v = py([TOOL, "verify", opened]);
  assert.equal(v.status, 0, v.out + v.err);
  const newRoot = path.join(scratch, "restored");
  const r = py([TOOL, "restore", opened, newRoot, "--min-free-bytes", "0"]);
  assert.equal(r.status, 0, r.out + r.err);
  for (const [key2, body] of objects) assert.ok(readFileSync(path.join(newRoot, key2)).equals(body), key2);
  console.log("ok chain: snapshot → seal → open → verify → restore, 6 objects byte-exact");

  const tampered = Buffer.from(readFileSync(sealed));
  tampered[tampered.length - 100] = tampered[tampered.length - 100]! ^ 0x01;
  writeFileSync(sealed, tampered);
  const reopened = path.join(scratch, "opened", "again.tar");
  assert.throws(() => decryptFile({ vault: sealed, key, target: reopened }), (e: unknown) => e instanceof VaultError && e.code === "authentication-failed");
  assert.ok(!existsSync(reopened) && !existsSync(`${reopened}.part`));
  console.log("ok tampered sealed snapshot is refused before the media tool ever sees it");
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
assert.ok(!existsSync(scratch));
console.log("PASS br2 media backup chain");
