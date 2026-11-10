/*
 * BR-2 activation hardening — the vault key lives apart from what it protects, `backup-db` cannot run
 * without identity pins, and `offsite-push` says it verified a LOCAL copy only (md5 for an independent
 * cloud check). Synthetic key material only; nothing leaves the machine.
 *
 *   K1  assertKeyLocationSafe refuses a key inside a protected root, inside a symlink into one, and
 *       in synchronized locations; it accepts a separate directory.
 *   K2  the CLI refuses `init-key` inside the repository and never creates the file.
 *   K3  the CLI refuses a key inside `--remote-dir` before anything is pushed.
 *   K4  every `--key` in the CLI goes through `keyPath` (no direct `need(f, "key")` into `loadKeyFile`).
 *   B1  `backup-db` without identity pins is a usage error (exit 2) and touches no database.
 *   O1  `offsite-push` reports `cloudConfirmed: false` and an md5 equal to the vault file's md5.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { VaultError, assertKeyLocationSafe, encryptFile, generateKeyFile, loadKeyFile, vaultFileName } from "../../scripts/lib/backup-vault";

const REPO_ROOT = path.resolve(process.cwd(), "..", "..");
const code = (fn: () => unknown): string | null => {
  try {
    fn();
    return null;
  } catch (error) {
    return error instanceof VaultError ? error.code : `unexpected:${(error as Error).message}`;
  }
};
const cli = (...args: string[]) =>
  spawnSync(process.execPath, ["--import", "tsx", "scripts/backup-vault.ts", ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      HEBUN_BACKUP_TARGET_SYSTEM_IDENTIFIER: "",
      HEBUN_BACKUP_TARGET_DATABASE: "",
      /* Set, so `backup-db` gets past the URL and stops at the missing pins. Port 1: never reached. */
      HEBUN_BR2_PROBE_URL: "postgresql://br2probe@127.0.0.1:1/none",
    },
  });

const scratch = mkdtempSync(path.join(tmpdir(), "hebun-br2-key-"));
try {
  /* K1 */
  const protectedRoot = path.join(scratch, "vault");
  mkdirSync(protectedRoot, { recursive: true });
  assert.equal(code(() => assertKeyLocationSafe(path.join(protectedRoot, "vault.key"), [protectedRoot])), "key-location-unsafe");
  assert.equal(code(() => assertKeyLocationSafe(path.join(protectedRoot, "nested", "deep", "vault.key"), [protectedRoot])), "key-location-unsafe");
  symlinkSync(protectedRoot, path.join(scratch, "alias"));
  assert.equal(code(() => assertKeyLocationSafe(path.join(scratch, "alias", "vault.key"), [protectedRoot])), "key-location-unsafe", "a symlink into a protected root is resolved");
  for (const synced of ["Library/CloudStorage/GoogleDrive-x/My Drive", "Library/Mobile Documents/com~apple~CloudDocs", "Documents", "Dropbox", "Google Drive"]) {
    assert.equal(code(() => assertKeyLocationSafe(path.join(scratch, synced, "vault.key"), [])), "key-location-unsafe", synced);
  }
  assert.equal(code(() => assertKeyLocationSafe(path.join(scratch, "keys", "vault.key"), [protectedRoot, REPO_ROOT])), null, "a separate directory is accepted");
  assert.equal(code(() => assertKeyLocationSafe(path.join(scratch, "vault-sibling", "vault.key"), [protectedRoot])), null, "a sibling with a shared prefix is not inside");
  console.log("ok K1 key refused inside a protected root (also via symlink) and in synchronized locations; separate directory accepted");

  /* K2 */
  const inRepo = path.join(REPO_ROOT, "apps", "dashboard", ".br2-test-vault.key");
  const k2 = cli("init-key", "--key", inRepo);
  assert.equal(k2.status, 1, k2.stdout + k2.stderr);
  assert.equal(JSON.parse(k2.stdout.trim()).reason, "key-location-unsafe");
  assert.ok(!existsSync(inRepo), "no key file was created in the repository");
  console.log("ok K2 init-key inside the repository refused; nothing created");

  /* K3 + O1 */
  const keyFile = path.join(scratch, "keys", "vault.key");
  generateKeyFile(keyFile);
  const key = loadKeyFile(keyFile);
  const vault = path.join(scratch, "pv");
  mkdirSync(vault, { recursive: true, mode: 0o700 });
  const plain = path.join(scratch, "plain.dump");
  writeFileSync(plain, "synthetic dump bytes", { mode: 0o600 });
  const sealed = path.join(vault, vaultFileName("postgres-custom", new Date(Date.UTC(2026, 10, 9, 3, 0, 0))));
  encryptFile({ plaintext: plain, target: sealed, key, kind: "postgres-custom", name: "database.dump" });
  const remote = path.join(scratch, "remote");
  mkdirSync(remote, { recursive: true, mode: 0o700 });
  const keyInRemote = path.join(remote, "keys", "vault.key");
  const k3 = cli("offsite-push", "--vault", vault, "--kind", "postgres-custom", "--key", keyInRemote, "--remote-dir", remote);
  assert.equal(k3.status, 1, k3.stdout + k3.stderr);
  assert.equal(JSON.parse(k3.stdout.trim()).reason, "key-location-unsafe");
  assert.deepEqual(readdirSync(remote), [], "nothing was pushed");
  console.log("ok K3 a key inside --remote-dir refused before any push");

  const o1 = cli("offsite-push", "--vault", vault, "--kind", "postgres-custom", "--key", keyFile, "--remote-dir", remote);
  assert.equal(o1.status, 0, o1.stdout + o1.stderr);
  const out = JSON.parse(o1.stdout.trim());
  assert.equal(out.status, "pushed");
  assert.equal(out.cloudConfirmed, false, "a local-directory push never claims the cloud holds the file");
  assert.equal(out.results.length, 1);
  assert.equal(out.results[0].md5, createHash("md5").update(readFileSync(sealed)).digest("hex"));
  assert.ok(!o1.stdout.includes(key.bytes.toString("hex")) && !o1.stdout.includes(key.bytes.toString("base64")), "no key material in the output");
  console.log("ok O1 offsite-push reports cloudConfirmed:false and the md5 for an independent cloud check");

  /* B1 */
  const b1 = cli("backup-db", "--url-env", "HEBUN_BR2_PROBE_URL", "--vault", vault, "--key", keyFile);
  assert.equal(b1.status, 2, b1.stdout + b1.stderr);
  assert.match(b1.stderr, /HEBUN_BACKUP_TARGET_SYSTEM_IDENTIFIER/, "the refusal names the missing pin, not the URL");
  assert.ok(!(b1.stdout + b1.stderr).includes("br2probe"), "the URL is never printed");
  console.log("ok B1 backup-db without identity pins is a usage error");

  /* K4 */
  const cliSource = readFileSync(path.join(process.cwd(), "scripts", "backup-vault.ts"), "utf8");
  assert.ok(!/loadKeyFile\(need\(f, "key"\)\)/.test(cliSource), "no --key reaches loadKeyFile without keyPath");
  assert.ok(!/generateKeyFile\(need\(f, "key"\)\)/.test(cliSource), "init-key goes through keyPath");
  assert.equal((cliSource.match(/need\(f, "key"\)/g) ?? []).length, 1, "the only raw --key read is inside keyPath");
  console.log("ok K4 every --key passes the location check");
  console.log("PASS br2 key location and cli hardening");
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
