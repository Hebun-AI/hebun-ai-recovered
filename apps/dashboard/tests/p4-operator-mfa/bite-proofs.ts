/*
 * P4 operator MFA — bite-proofs.
 *
 * Each mutation removes one security property from the source, re-runs the suite that defends it, and
 * requires that suite to FAIL for the intended reason. Every file is restored byte-identically.
 * Mutates source in place: run only in a disposable worktree (CLAUDE.md test stability rule 4).
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PG = "tests/p4-operator-mfa/operator-mfa-postgres.ts";
const FIREWALL = "tests/p4-operator-mfa/boundaries-and-firewall.ts";
const ACCESS = "src/features/operator-authority/admin-access.server.ts";
const VERIFY = "src/features/operator-mfa/mfa-verification.server.ts";
const CEREMONY = "scripts/lib/operator-authority.ts";
const SESSIONS = "src/features/auth-runtime/session-service.server.ts";
const TIMEOUT_MS = 10 * 60 * 1000;

const abs = (f: string) => path.join(ROOT, f);
const readFile = (f: string) => readFileSync(abs(f), "utf8");
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

interface Mutation {
  readonly label: string;
  readonly file: string;
  readonly suite: string;
  readonly find: string;
  readonly replace: string;
  readonly expect: string;
}

const MUTATIONS: readonly Mutation[] = [
  {
    label: "B1 the guard stops requiring MFA",
    file: ACCESS,
    suite: PG,
    find: `  if (standing.mfa !== "valid")\n    return { status: "mfa-required", mfa: standing.mfa };`,
    replace: `  void standing.mfa;`,
    expect: "1: an operator without session MFA is sent to the challenge",
  },
  {
    label: "B2 the guard stops requiring a grant",
    file: ACCESS,
    suite: PG,
    find: `  if (!standing.grant) return { status: "forbidden" };`,
    replace: `  void standing.grant;`,
    expect: "3: a Director (tenant owner) is not an admin",
  },
  {
    label: "B3 the replay guard is removed",
    file: VERIFY,
    suite: PG,
    find: "        sql`${authMfaCredentials.lastAcceptedStep} < ${step}`,",
    replace: "        sql`true`,",
    expect: "6: a used code is never accepted twice",
  },
  {
    label: "B4 the admin MFA window grows to a day",
    file: ACCESS,
    suite: PG,
    find: "export const ADMIN_MFA_WINDOW_SECONDS = 60 * 60;",
    replace: "export const ADMIN_MFA_WINDOW_SECONDS = 24 * 60 * 60;",
    expect: "O1: admin MFA expires after 60 minutes",
  },
  {
    label: "B5 the lockout threshold is raised out of reach",
    file: VERIFY,
    suite: PG,
    find: "export const MFA_FAILED_ATTEMPT_THRESHOLD = 5;",
    replace: "export const MFA_FAILED_ATTEMPT_THRESHOLD = 50;",
    expect: "7: five failures lock the credential",
  },
  {
    label: "B6 a revoked MFA credential still satisfies the guard",
    file: ACCESS,
    suite: PG,
    find: `    credential.status !== "active" ||`,
    replace: ``,
    expect: "11: revoking MFA cuts admin on the next request",
  },
  {
    label: "B7 a revoked grant still counts as active",
    file: ACCESS,
    suite: PG,
    find: `        eq(platformOperatorGrants.status, "active"),\n      ),\n    )\n    .limit(1);\n  return rows.length > 0;`,
    replace: `      ),\n    )\n    .limit(1);\n  return rows.length > 0;`,
    expect: "12: operator revoke cuts admin on the next request",
  },
  {
    label: "B8 the bootstrap rule applies forever",
    file: CEREMONY,
    suite: PG,
    find: "  if ((await countActiveOperators(db)) === 0) return { status: \"verified\", actor, bootstrap: true };",
    replace: "  return { status: \"verified\", actor, bootstrap: true };",
    expect: "15: once an operator exists, a non-operator actor is refused",
  },
  {
    label: "B9 a tenant switch carries MFA forward again",
    file: SESSIONS,
    suite: FIREWALL,
    find: "        assuranceLevel: SESSION_ASSURANCE_LEVEL,\n        mfaVerified: false,",
    replace: "        assuranceLevel: SESSION_ASSURANCE_LEVEL,\n        mfaVerified: session.mfaVerified,",
    expect: "a tenant switch drops MFA instead of copying it",
  },
  {
    label: "B10 the app gains a grant writer",
    file: ACCESS,
    suite: FIREWALL,
    find: "export async function hasActiveOperatorGrant(",
    replace:
      "export async function grantFromApp(db: ControlPlaneDatabase): Promise<void> {\n  await db.insert(platformOperatorGrants).values([]);\n}\n\nexport async function hasActiveOperatorGrant(",
    expect: "src/ never writes an operator grant",
  },
];

function withMutation(mutation: Mutation, body: () => void): void {
  const original = readFile(mutation.file);
  const before = sha(original);
  assert.equal(original.split(mutation.find).length - 1, 1, `${mutation.label}: find-string must appear exactly once in ${mutation.file}`);
  const mutated = original.replace(mutation.find, mutation.replace);
  try {
    writeFileSync(abs(mutation.file), mutated, "utf8");
    body();
  } finally {
    writeFileSync(abs(mutation.file), original, "utf8");
  }
  assert.equal(sha(readFile(mutation.file)), before, `${mutation.file} was not restored byte-identically`);
}

let bitten = 0;
for (const mutation of MUTATIONS) {
  withMutation(mutation, () => {
    const run = spawnSync(process.execPath, ["--import", "tsx", mutation.suite], {
      cwd: ROOT,
      encoding: "utf8",
      env: process.env,
      maxBuffer: 64 * 1024 * 1024,
      timeout: TIMEOUT_MS,
    });
    const output = `${run.stdout ?? ""}${run.stderr ?? ""}`;
    assert.notEqual(run.signal, "SIGTERM", `${mutation.label}: the suite timed out — a VOID result, not a bite`);
    assert.notEqual(run.status, 0, `${mutation.label}: SURVIVED — ${mutation.suite} still passed`);
    assert.ok(
      output.includes(mutation.expect),
      `${mutation.label}: failed, but not for the intended reason ("${mutation.expect}").\n${output.slice(-2000)}`,
    );
  });
  bitten += 1;
  console.log(`BITE ${mutation.label}`);
}
assert.equal(bitten, MUTATIONS.length);
console.log(`p4-operator-mfa/bite-proofs: ${bitten} mutations bit`);
