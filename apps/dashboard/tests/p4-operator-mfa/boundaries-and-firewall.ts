/*
 * P4 — operator authority boundaries, proven from source.
 *
 *   - the running application (src/) has NO writer for operator grants and cannot create, activate
 *     or revoke an MFA credential; only the ceremony under scripts/ can, and src/ cannot import it;
 *   - the admin decision reads no request value and no tenant role, email or shell setting;
 *   - every admin route calls the guard; the challenge reads exactly one form field;
 *   - a tenant switch no longer carries MFA forward;
 *   - the MFA key set is separate from the integration keys;
 *   - no operator module logs, and the enrollment URI is printed in exactly one place;
 *   - the migration is additive: new tables, two nullable session columns, one CHECK.
 * Behaviour is proven in operator-mfa-postgres.ts.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { MFA_ENCRYPTION_ENV_KEYS } from "../../src/features/operator-mfa/mfa-verification.server";
import { INTEGRATION_ENCRYPTION_ENV_KEYS } from "../../src/features/secret-encryption/key-registry.server";

const ROOT = path.resolve(__dirname, "../..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
const walk = (dir: string): string[] =>
  readdirSync(path.join(ROOT, dir)).flatMap((name) => {
    const rel = `${dir}/${name}`;
    return statSync(path.join(ROOT, rel)).isDirectory() ? walk(rel) : /\.(ts|tsx)$/.test(name) ? [rel] : [];
  });
/** Code without comments, so a truthful comment can never trip a guard. */
const codeOf = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

let failures = 0;
function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures++;
    console.error(`FAIL ${name}\n  ${(error as Error).message}`);
  }
}

const SRC = walk("src").filter((f) => !f.startsWith("src/db/"));
const ADMIN_ACCESS = "src/features/operator-authority/admin-access.server.ts";
const VERIFY = "src/features/operator-mfa/mfa-verification.server.ts";
const CEREMONY = "scripts/lib/operator-authority.ts";

test("src/ never writes an operator grant", () => {
  const writers = SRC.filter((f) => /\.(insert|update|delete)\(\s*platformOperatorGrants\b/.test(codeOf(read(f))));
  assert.deepEqual(writers, []);
});

test("src/ never creates, activates or revokes an MFA credential", () => {
  const inserters = SRC.filter((f) => /\.(insert|delete)\(\s*authMfaCredentials\b/.test(codeOf(read(f))));
  assert.deepEqual(inserters, []);
  const updaters = SRC.filter((f) => /\.update\(\s*authMfaCredentials\b/.test(codeOf(read(f))));
  assert.deepEqual(updaters, [VERIFY], "only the verifier updates a credential");
  for (const block of codeOf(read(VERIFY)).split(".update(authMfaCredentials)").slice(1)) {
    const set = block.slice(block.indexOf(".set("), block.indexOf(".where("));
    assert.ok(!/\b(status|activatedAt|revokedAt|seal\w*)\s*:/.test(set), "the verifier writes counters only");
  }
});

test("src/ cannot reach the ceremony", () => {
  assert.deepEqual(SRC.filter((f) => /from\s+"[^"]*scripts\/lib\/operator-authority"/.test(codeOf(read(f)))), []);
  assert.ok(read(CEREMONY).includes("writeOperatorAudit(tx,"), "ceremony audits inside its transaction");
});

test("the admin decision reads no request value, role, email or shell setting", () => {
  const code = codeOf(read(ADMIN_ACCESS));
  for (const forbidden of ["next/headers", "cookies(", "headers(", "searchParams", "roleId", "roles", "HEBUN_SHELL_EXPERIENCE", ".email", "process.env"]) {
    assert.ok(!code.includes(forbidden), `admin-access must not use ${forbidden}`);
  }
  assert.match(code, /ADMIN_MFA_WINDOW_SECONDS = 60 \* 60/);
  assert.match(code, /if \(!standing\.grant\) return \{ status: "forbidden" \};/);
  assert.match(code, /if \(standing\.mfa !== "valid"\)/);
});

test("every admin route calls the guard; the challenge reads one field", () => {
  const routes = walk("src/app/admin");
  const guarded = routes.filter((f) => f.includes("(protected)") && /\/(layout|page)\.tsx$/.test(f));
  /* P4 dashboard: layout + overview, organizations, organization, usage, status (was 2: layout + landing). */
  assert.equal(guarded.length, 6);
  for (const file of guarded) assert.match(read(file), /await requireAdminAccess\(\);/, file);
  const action = codeOf(read("src/app/admin/verify/actions.ts"));
  assert.deepEqual([...action.matchAll(/formData\.get\("([^"]+)"\)/g)].map((m) => m[1]), ["code"]);
  assert.match(codeOf(read("src/app/admin/verify/page.tsx")), /resolveAdminAccessForRequest\(\)/);
});

test("a tenant switch drops MFA instead of copying it", () => {
  const code = codeOf(read("src/features/auth-runtime/session-service.server.ts"));
  assert.ok(!code.includes("mfaVerified: session.mfaVerified"));
  assert.equal(
    (code.match(/mfaVerified: true/g) ?? []).length,
    0,
    "the session service never elevates a session",
  );
  assert.equal(
    walk("src").filter((f) => /mfaVerified: true/.test(codeOf(read(f)))).join(),
    ADMIN_ACCESS,
    "only the MFA step-up writes an elevated session",
  );
});

test("the MFA key set is separate from the integration keys", () => {
  const mfa = Object.values(MFA_ENCRYPTION_ENV_KEYS);
  const integration = Object.values(INTEGRATION_ENCRYPTION_ENV_KEYS);
  assert.ok(mfa.every((name) => name.startsWith("HEBUN_MFA_") && !(integration as readonly string[]).includes(name)));
  assert.ok(!read(VERIFY).includes("INTEGRATION_ENCRYPTION_ENV_KEYS"));
});

test("operator modules never log; the enrollment URI is printed once", () => {
  const modules = [
    ...walk("src/features/operator-mfa"),
    ...walk("src/features/operator-authority"),
    "src/features/governance-audit/operator-authority-audit.server.ts",
    CEREMONY,
  ];
  for (const file of modules) assert.ok(!/console\.\w+\(/.test(codeOf(read(file))), `${file} logs`);
  const cli = codeOf(read("scripts/operator.ts"));
  assert.equal((cli.match(/otpauthUri\(/g) ?? []).length, 1);
  /* The one deliberate exception is the enrollment URI line itself, counted above. */
  const printed = cli.split("\n").filter((line) => /console\.\w+\(/.test(line) && !line.includes("otpauthUri("));
  assert.ok(!printed.some((line) => /password|actorCode|firstCode|secret\b/.test(line)), "no password, code or secret is printed");
});

test("the migration is additive", () => {
  const dir = "src/db/migrations";
  const sql = read(`${dir}/${readdirSync(path.join(ROOT, dir)).filter((f) => f.includes("p4_operator_mfa")).at(0)}`);
  assert.ok(!/\bDROP\b/i.test(sql), "drops nothing");
  assert.match(sql, /ADD COLUMN "mfa_verified_at" timestamp with time zone;/);
  assert.match(sql, /ADD COLUMN "mfa_credential_id" uuid;/);
  assert.ok(!/ALTER COLUMN/i.test(sql), "changes no existing column");
});

if (failures > 0) {
  console.error(`\nP4 operator boundaries: ${failures} failure(s)`);
  process.exit(1);
}
console.log("\nP4 operator boundaries: all checks passed");
