/*
 * VPS MEDIA STORAGE — BITE PROOFS.
 *
 * Same discipline as MEDIA-1: ONE targeted change to real source (TypeScript adapter/resolver, or the
 * Python store itself), run the suite that must object, require a unique anchor, a failure FOR THE
 * INTENDED REASON, and a byte-identical restore by sha256. A killed child is VOID, never a bite.
 *
 * Source-mutating: children run SEQUENTIALLY.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();
const abs = (f: string): string => path.resolve(ROOT, f);
const read = (f: string): string => readFileSync(abs(f), "utf8");
const sha = (s: string): string => createHash("sha256").update(s).digest("hex");

const RESOLVER = "src/features/media-assets/media-storage.server.ts";
const ADAPTER = "src/features/media-assets/vps-media-object-store.server.ts";
const HELPER = "tests/helpers/media-vps-store-process.ts";
const STORE = "../../infra/media-store-vps/hebun_media_store.py";

type Suite = "contract" | "firewall" | "python";
const CHILD_TIMEOUT_MS = 300_000;

function runSuite(suite: Suite): { ok: boolean; void: boolean; output: string } {
  const result =
    suite === "python"
      ? spawnSync("python3", ["-m", "unittest", "test_hebun_media_store.py"], {
          cwd: abs("../../infra/media-store-vps"),
          encoding: "utf8",
          maxBuffer: 64 * 1024 * 1024,
          timeout: CHILD_TIMEOUT_MS,
        })
      : spawnSync(
          process.execPath,
          ["--import", "tsx", suite === "contract" ? "tests/media-vps-storage/vps-adapter-contract.ts" : "tests/media1-asset-authority/authority-firewall.ts"],
          { cwd: ROOT, encoding: "utf8", env: process.env, maxBuffer: 64 * 1024 * 1024, timeout: CHILD_TIMEOUT_MS },
        );
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  const killed = result.signal !== null || result.status === null;
  return { ok: result.status === 0, void: killed, output };
}

interface Mutation {
  readonly label: string;
  readonly file: string;
  readonly suite: Suite;
  readonly edits: readonly { readonly find: string; readonly replace: string }[];
  readonly because: string;
}

const MUTATIONS: readonly Mutation[] = [
  {
    label: "V1 the resolver accepts plain http",
    file: RESOLVER,
    suite: "contract",
    edits: [{ find: '    url.protocol === "https:" &&', replace: '    (url.protocol === "https:" || url.protocol === "http:") &&' }],
    because: "plain http",
  },
  {
    label: "V2 a half-configured deployment is treated as connected",
    file: RESOLVER,
    suite: "contract",
    edits: [
      {
        find: '    return { status: "unavailable", reason: "storage-misconfigured" };',
        replace: '    return { status: "available", store: createVpsMediaObjectStore({ origin: "https://x.invalid", writeSecret, readSecret }) };',
      },
    ],
    because: "storage-misconfigured",
  },
  {
    label: "V3 read grants are not clamped",
    file: ADAPTER,
    suite: "contract",
    edits: [
      {
        find: "Math.min(Math.max(Math.floor(input.ttlSeconds), 1), VPS_READ_MAX_TTL_SECONDS)",
        replace: "Math.max(Math.floor(input.ttlSeconds), 1)",
      },
    ],
    because: "ttl is clamped",
  },
  {
    label: "V4 an adapter error carries the store origin",
    file: ADAPTER,
    suite: "contract",
    edits: [{ find: "`media store: put refused (${response.status})`", replace: "`media store: put refused (${response.status}) ${origin}`" }],
    because: "leaks",
  },
  {
    label: "V5 the adapter follows redirects",
    file: ADAPTER,
    suite: "firewall",
    edits: [{ find: '        method: "PUT",\n', replace: '        method: "PUT",\n        ...({ redirect: "follow" } as object),\n' }],
    because: "never follows a redirect",
  },
  {
    label: "V6 a signalled store process is awaited forever (silent exit 0)",
    file: HELPER,
    suite: "contract",
    edits: [{ find: "child.exitCode !== null || child.signalCode !== null", replace: "child.exitCode !== null" }],
    because: "exited before completing",
  },
  {
    label: "S1 the store overwrites an existing key",
    file: STORE,
    suite: "python",
    edits: [
      {
        find: '            os.stat(asset_id, dir_fd=dir_fd, follow_symlinks=False)\n            raise StoreError(409, "key-exists")',
        replace: "            raise FileNotFoundError",
      },
      {
        find: "                os.link(tmp_name, asset_id, src_dir_fd=dir_fd, dst_dir_fd=dir_fd, follow_symlinks=False)",
        replace: "                os.replace(tmp_name, asset_id, src_dir_fd=dir_fd, dst_dir_fd=dir_fd)",
      },
    ],
    because: "test_duplicate_key_refused_and_original_bytes_kept",
  },
  {
    label: "S2 directory components follow symlinks",
    file: STORE,
    suite: "python",
    edits: [{ find: "_DIR_FLAGS = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW |", replace: "_DIR_FLAGS = os.O_RDONLY | os.O_DIRECTORY |" }],
    because: "test_symlink_escape_refused_for_write_verify_and_read",
  },
  {
    label: "S3 nonces are never claimed",
    file: STORE,
    suite: "python",
    edits: [{ find: "            return nonces.claim(nonce, now)", replace: "            return True" }],
    because: "test_replayed_nonce_refused",
  },
  {
    label: "S4 requests signed before start are accepted",
    file: STORE,
    suite: "python",
    edits: [{ find: " or t < int(started_at)", replace: "" }],
    because: "test_stale_future_and_pre_start_timestamps_refused",
  },
  {
    label: "S5 the stored digest is not compared",
    file: STORE,
    suite: "python",
    edits: [{ find: "            if not hmac.compare_digest(digest.hexdigest(), sha256_hex):", replace: "            if False:" }],
    because: "test_digest_mismatch_refused_and_nothing_stored",
  },
  {
    label: "S6 the free-space threshold is ignored",
    file: STORE,
    suite: "python",
    edits: [{ find: "    if vfs.f_bavail * vfs.f_frsize - content_length < config.min_free_bytes:", replace: "    if False:" }],
    because: "test_writes_refused_below_free_space_threshold",
  },
  {
    label: "S7 read grants never expire",
    file: STORE,
    suite: "python",
    edits: [{ find: "            if e <= now or e > now + READ_MAX_TTL_SECONDS:", replace: "            if e > now + READ_MAX_TTL_SECONDS:" }],
    because: "test_grant_expires_with_the_clock",
  },
  {
    label: "S8 keys are not canonical",
    file: STORE,
    suite: "python",
    edits: [{ find: 'KEY_RE = re.compile(rf"^tenants/({_UUID})/media/({_UUID})$")', replace: 'KEY_RE = re.compile(rf"^tenants/(.+)/media/(.+)$")' }],
    because: "test_traversal_and_noncanonical_keys_refused",
  },
  {
    label: "S9 the store starts without a write secret",
    file: STORE,
    suite: "python",
    edits: [{ find: "    if len(write_secret) < MIN_SECRET_LENGTH:", replace: "    if False:" }],
    because: "test_missing_or_weak_configuration_refuses_to_start",
  },
  {
    label: "S10 the read secret can sign writes",
    file: STORE,
    suite: "python",
    edits: [
      { find: "            if not hmac.compare_digest(expected, sig):\n                return False", replace: "            if not (hmac.compare_digest(expected, sig) or hmac.compare_digest(sign(config.read_secret, write_canonical(method, key, ts, nonce, sha, ctype, length)), sig)):\n                return False" },
    ],
    because: "read secret cannot write",
  },
];

function main(): void {
  const voided: string[] = [];
  let bitten = 0;
  for (const m of MUTATIONS) {
    const original = read(m.file);
    const before = sha(original);
    let mutated = original;
    for (const edit of m.edits) {
      const n = mutated.split(edit.find).length - 1;
      assert.equal(n, 1, `${m.label}: anchor must appear exactly once in ${m.file}, found ${n}`);
      mutated = mutated.replace(edit.find, edit.replace);
    }
    try {
      writeFileSync(abs(m.file), mutated, "utf8");
      assert.equal(read(m.file), mutated, `${m.label}: mutation did not reach ${m.file}`);
      const run = runSuite(m.suite);
      if (run.void) {
        voided.push(m.label);
      } else {
        assert.equal(run.ok, false, `${m.label}: the suite still PASSED — the guard does not bite`);
        assert.ok(run.output.includes(m.because), `${m.label}: failed, but not for "${m.because}".\n${run.output.slice(-2500)}`);
        bitten += 1;
        console.log(`BITE ${m.label}`);
      }
    } finally {
      writeFileSync(abs(m.file), original, "utf8");
      assert.equal(sha(read(m.file)), before, `${m.label}: ${m.file} not restored byte-identically`);
    }
  }
  assert.deepEqual(voided, [], `VOID (child killed), not passes: ${voided.join(", ")}`);
  assert.equal(bitten, MUTATIONS.length);
  console.log(`media-vps-storage/bite-proofs: ok (${bitten} bites)`);
}

main();
