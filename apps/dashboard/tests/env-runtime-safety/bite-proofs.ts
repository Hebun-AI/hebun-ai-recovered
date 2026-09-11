/*
 * ENV RUNTIME SAFETY bite-proofs — each guard is shown to FAIL on a broken product.
 *
 * A green suite proves nothing on its own, and that is especially true of a safety invariant whose
 * whole job is to refuse. Every mutation below is a LOOSENING a well-meaning developer might
 * plausibly make — treat the flag as truthy, trim it, trust NODE_ENV, trust VERCEL, put the host in
 * the error — and each must be caught by name.
 *
 * Files are restored from their original bytes and the SHA-256 is compared before and after, so a
 * crashed run cannot leave a weakened guard on disk pretending to be released code.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();
const SUITE = "tests/env-runtime-safety/control-plane-target.ts";
const POOL_SUITE = "tests/env-runtime-safety/control-plane-pool.ts";
const CLIENT = "src/db/client.server.ts";

const abs = (file: string): string => path.join(ROOT, file);
const readFile = (file: string): string => readFileSync(abs(file), "utf8");
const sha = (text: string): string => createHash("sha256").update(text).digest("hex");

function runSuite(suite: string): { ok: boolean; output: string } {
  const result = spawnSync(process.execPath, ["--import", "tsx", suite], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 64 * 1024 * 1024,
    timeout: 300_000,
  });
  assert.ok(!result.error, `the child run of ${suite} failed to execute: ${result.error?.message}`);
  return { ok: result.status === 0, output: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}

interface Mutation {
  readonly label: string;
  /** Which suite must notice. Defaults to the target suite. */
  readonly suite?: string;
  readonly find: string;
  readonly replace: string;
  /** A fragment the failure must contain. A bare non-zero exit is not enough. */
  readonly expect: string;
}

const MUTATIONS: readonly Mutation[] = [
  {
    label: "M1 the allow-remote flag is treated as truthy rather than an exact literal",
    find: '  if (env[CONTROL_PLANE_ALLOW_REMOTE_ENV] === "true") return;',
    replace: "  if (Boolean(env[CONTROL_PLANE_ALLOW_REMOTE_ENV])) return;",
    expect: "AssertionError",
  },
  {
    label: "M2 the flag is trimmed and lowercased, forgiving a mistake that opens production",
    find: '  if (env[CONTROL_PLANE_ALLOW_REMOTE_ENV] === "true") return;',
    replace:
      '  if ((env[CONTROL_PLANE_ALLOW_REMOTE_ENV] ?? "").trim().toLowerCase() === "true") return;',
    expect: "AssertionError",
  },
  {
    label: "M3 the pulled-snapshot check is removed, so a snapshot authorizes itself",
    find: "  if (isPulledEnvSnapshot(env)) {",
    replace: "  if (false as boolean) {",
    expect: "a masked value proves a pulled snapshot",
  },
  {
    label: "M4 the snapshot check runs AFTER the flag, so an unmasked flag wins",
    find: '  if (isPulledEnvSnapshot(env)) {',
    replace: '  if (env[CONTROL_PLANE_ALLOW_REMOTE_ENV] === "true") return;\n  if (isPulledEnvSnapshot(env)) {',
    expect: "a masked value proves a pulled snapshot",
  },
  {
    label: "M5 NODE_ENV is promoted into deployment identity",
    find: '  if (env[CONTROL_PLANE_ALLOW_REMOTE_ENV] === "true") return;',
    replace:
      '  if (env.NODE_ENV === "production") return;\n  if (env[CONTROL_PLANE_ALLOW_REMOTE_ENV] === "true") return;',
    expect: "NODE_ENV=production is a build mode",
  },
  {
    label: "M6 VERCEL is trusted as proof of a real deployment",
    find: '  if (env[CONTROL_PLANE_ALLOW_REMOTE_ENV] === "true") return;',
    replace:
      '  if (env.VERCEL === "1") return;\n  if (env[CONTROL_PLANE_ALLOW_REMOTE_ENV] === "true") return;',
    expect: "pulled verbatim into a local file",
  },
  {
    label: "M7 the refusal leaks the database host",
    find: '    "Refusing a non-local control-plane target: this process is not authorized to reach a remote " +',
    replace:
      '    `Refusing a non-local control-plane target (${target.hostname}): not authorized to reach a remote ` +',
    expect: "nor the host",
  },
  {
    label: "M8 the refusal leaks the whole connection string",
    find: '    "Refusing a non-local control-plane target: this process is not authorized to reach a remote " +',
    replace:
      '    `Refusing a non-local control-plane target: ${trimmed} is not authorized to reach a remote ` +',
    expect: "the password never appears in the message",
  },
  {
    label: "M9 the masked DATABASE_URL is rejected without diagnosing the cause",
    find: "  if (trimmed === VERCEL_SENSITIVE_PLACEHOLDER) {",
    replace: "  if (false as boolean) {",
    expect: "the refusal names the real cause",
  },
  {
    label: "M10 IPv6 loopback is misclassified as remote again",
    find: "  if (LOCAL_HOSTS.has(normalizeHost(target.hostname))) return;",
    replace: "  if (LOCAL_HOSTS.has(target.hostname)) return;",
    expect: "Got unwanted exception",
  },
  /*
   * WHAT M11 IS NOT.
   *
   * The first M11 deleted the empty-string check and EXPECTED a failure. It survived, and the guard
   * was right: `new URL("")` throws anyway, so an empty target still fails closed through the
   * parser. That check buys a better MESSAGE, not a safety boundary, and a bite-proof that cannot
   * bite because there is no defect to expose is theatre. It was replaced with a loosening that
   * does open a real hole.
   */
  {
    label: "M12 the connect budget is reverted to the value that lost an observation cycle",
    suite: POOL_SUITE,
    find: "  connectionTimeoutMillis: 5000,",
    replace: "  connectionTimeoutMillis: 2000,",
    expect: "must leave room for a cold wake",
  },
  {
    label: "M13 the pool is built before the target is authorized",
    suite: POOL_SUITE,
    find: "  /* THE GUARD RUNS FIRST, so a refused target never reaches the pool below. */\n  assertAllowedTarget(trimmed, env);",
    replace: "",
    expect: "no pool may be constructed",
  },
  {
    label: "M14 the settings constant is bypassed so the pool keeps the old budget",
    suite: POOL_SUITE,
    find: "    ...CONTROL_PLANE_POOL_SETTINGS,",
    replace: "    max: 4,\n    idleTimeoutMillis: 1000,\n    connectionTimeoutMillis: 2000,",
    expect: "AssertionError",
  },
  {
    label: "M11 the snapshot scan is narrowed to DATABASE_URL, missing a masked sibling",
    find: "  for (const value of Object.values(env)) {",
    replace: "  for (const value of [env[CONTROL_PLANE_DATABASE_URL_ENV]]) {",
    expect: "a masked value proves a pulled snapshot",
  },
];

function main(): void {
  const original = readFile(CLIENT);
  const digest = sha(original);

  for (const suite of [SUITE, POOL_SUITE]) {
    const baseline = runSuite(suite);
    assert.ok(baseline.ok, `${suite} must pass before mutation:\n${baseline.output}`);
  }

  let survived: string | null = null;
  try {
    for (const mutation of MUTATIONS) {
      assert.ok(
        original.includes(mutation.find),
        `${mutation.label}: the anchor is stale — the guard may have moved:\n${mutation.find}`,
      );
      writeFileSync(abs(CLIENT), original.replace(mutation.find, mutation.replace), "utf8");

      /* Each mutation names the suite that must notice it; the target suite is the default. */
      const run = runSuite(mutation.suite ?? SUITE);
      writeFileSync(abs(CLIENT), original, "utf8");

      if (run.ok) {
        survived = `${mutation.label}: the mutation SURVIVED — the guard does not bite.`;
        break;
      }
      if (!run.output.includes(mutation.expect)) {
        survived =
          `${mutation.label}: it failed, but not for the stated reason. ` +
          `Expected output containing "${mutation.expect}".\n${run.output}`;
        break;
      }
      console.log(`BITES ${mutation.label}`);
    }
  } finally {
    writeFileSync(abs(CLIENT), original, "utf8");
    assert.equal(sha(readFile(CLIENT)), digest, `${CLIENT} was restored byte-for-byte`);
  }

  assert.equal(survived, null, survived ?? "");
  console.log(`env runtime safety bite-proofs passed — ${MUTATIONS.length} guards all bite`);
}

main();
