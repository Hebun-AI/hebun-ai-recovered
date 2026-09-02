/*
 * G5A.1 — BOOTSTRAP CREDENTIAL RECOVERY BOUNDARIES (structural, no DB, no network).
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "Recovery cannot choose whom it acts on, cannot outlive the bootstrap window, owns no
 *    credential SQL and no cryptography, cannot be reached from the product, and adds no schema."
 *
 * Assertions run over comment-stripped source, and anything about a secret is asserted over source
 * with STRING LITERALS STRIPPED — G5A learned four times that prose, refusal reasons and denials
 * are made of the same words as the things they forbid.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  MIN_RECOVERY_PASSWORD_LENGTH,
  RECOVERY_LOCK_MODE,
  RECOVERY_REVOCATION_REASON,
} from "../../scripts/lib/recover-bootstrap-credential";
import { MIN_ENROLLMENT_PASSWORD_LENGTH } from "../../src/features/identity-enrollment/contracts";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");
const codeOf = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const stripStrings = (source: string): string =>
  source
    .replace(/`(?:[^`\\]|\\.)*`/g, "``")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''");
const collect = (dir: string): string[] =>
  readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name);
    return e.isDirectory()
      ? e.name === "migrations"
        ? []
        : collect(rel)
      : /\.tsx?$/.test(e.name)
        ? [rel]
        : [];
  });

const CORE = codeOf(read("scripts/lib/recover-bootstrap-credential.ts"));
const CLI = codeOf(read("scripts/recover-bootstrap-credential.ts"));
const BOTH = `${CORE}\n${CLI}`;
const AUTHORITY = codeOf(read("src/features/auth-runtime/credential-repository.server.ts"));
const SRC_FILES = collect("src");

/* ═══════════════════════════════════════════════════════════════════════════
 * 1. IT IS NOT A CREDENTIAL AUTHORITY.
 * ═════════════════════════════════════════════════════════════════════════ */
function notAnAuthority(): void {
  /* No credential SQL, no builder call, no cryptography, in either ceremony file. */
  for (const forbidden of [
    "insert into",
    ".insert(",
    ".values(",
    "update auth_credentials",
    ".update(",
    "delete from",
    "on conflict",
    "hashPassword",
    "verifyPassword",
    "scrypt",
    "secretHash",
    "secret_hash",
    "salt",
    "insertPasswordCredential",
  ]) {
    assert.ok(
      !BOTH.toLowerCase().includes(forbidden.toLowerCase()),
      `recovery must not contain ${forbidden.trim()} — Credential authority owns it`,
    );
  }

  /* It calls exactly one credential primitive, and that primitive lives in the authority. */
  assert.match(
    CORE,
    /replacePasswordCredential\(\s*tx,\s*human\.authIdentityId,\s*input\.password,/,
    "Credential authority performs the replacement, inside the caller's transaction",
  );
  assert.match(
    AUTHORITY,
    /export async function replacePasswordCredential/,
    "the replacement primitive belongs to the credential repository",
  );

  /* And there is still exactly ONE module under src/ that writes auth_credentials. */
  const writers = SRC_FILES.filter((f) =>
    /\.(insert|update)\(authCredentials\)/.test(codeOf(read(f))),
  );
  assert.deepEqual(
    writers,
    ["src/features/auth-runtime/credential-repository.server.ts"],
    "no second credential repository was created",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 2. THE TRANSITION IS REVOKE-THEN-INSERT, DERIVED FROM THE INDEX.
 * ═════════════════════════════════════════════════════════════════════════ */
function transition(): void {
  const body = AUTHORITY.slice(AUTHORITY.indexOf("export async function replacePasswordCredential"));
  const revokeAt = body.indexOf('status: "revoked"');
  const insertAt = body.indexOf("insertPasswordCredential(");
  assert.ok(revokeAt > 0, "the old credential is revoked");
  assert.ok(insertAt > revokeAt, "…BEFORE the replacement is written — the partial index demands it");

  /*
   * Not an update in place, not a delete. The record that a credential existed survives.
   *
   * Scoped to the UPDATE statement itself. A `/set\(\{[\s\S]*?secretHash/` version spanned the whole
   * function and matched the `secretHash` in the INSERT's arguments — an unscoped regex reading two
   * different statements as one.
   */
  assert.ok(!/delete/i.test(body), "the old credential is never deleted");
  const updateStatement = body.slice(
    body.indexOf(".update(authCredentials)"),
    body.indexOf(".where("),
  );
  assert.ok(updateStatement.length > 0, "the update statement must be findable");
  for (const forbidden of ["secretHash", "salt", "algorithm", "params", "authIdentityId"]) {
    assert.ok(
      !updateStatement.includes(forbidden),
      `the revoke must not touch ${forbidden} — it changes status, not the secret`,
    );
  }
  /* `[,:]` because `revocationReason` is written as a shorthand property, with no colon. */
  const setBlock = updateStatement.slice(updateStatement.indexOf(".set({"));
  assert.deepEqual(
    [...setBlock.matchAll(/^\s+(\w+)\s*[,:]/gm)].map((m) => m[1]!).sort(),
    ["revocationReason", "revokedAt", "status", "updatedAt"],
    "the revoke sets exactly four columns",
  );

  /* Scoped so it can only ever touch the one row the partial index permits to be active. */
  for (const clause of [
    "eq(authCredentials.authIdentityId, authIdentityId)",
    'eq(authCredentials.credentialType, "password")',
    'eq(authCredentials.status, "active")',
  ]) {
    assert.ok(body.includes(clause), `the revoke must be scoped by ${clause}`);
  }

  /* A non-blank reason is written, because the schema requires one. */
  assert.match(body, /revocationReason,/, "the revocation carries its reason");
  assert.ok(RECOVERY_REVOCATION_REASON.trim().length > 0);

  /* Derivation happens BEFORE the revoke: a hash failure must not strand the human. */
  assert.ok(
    body.indexOf("hashPassword(password)") < revokeAt,
    "the password is derived before anything is revoked",
  );

  /* No actor is named on the revoked row. */
  for (const forbidden of ["revokedBy", "revoked_by", "actorId", "actorType"]) {
    assert.ok(!body.includes(forbidden), `the revoke must not name ${forbidden}`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 3. THE BOOTSTRAP WINDOW, AND ITS CLOSURE CONDITION.
 * ═════════════════════════════════════════════════════════════════════════ */
function window(): void {
  /* Two predicates, both read from the database, neither from configuration. */
  assert.match(CORE, /select count\(\*\)::int from users/, "the window counts humans");
  assert.match(CORE, /select count\(\*\)::int from companies/, "…and organizations");
  assert.match(CORE, /companyCount > 0/, "one company closes the window");
  assert.match(CORE, /humanCount === 0/, "no human means nothing to recover");
  assert.match(CORE, /humanCount > 1/, "more than one human is unanswerable");

  /* The window is state, not a flag. There is no override anywhere in this phase. */
  const envReads = [...CLI.matchAll(/process\.env\.([A-Z_]+)/g)].map((m) => m[1]!);
  assert.deepEqual(
    [...new Set(envReads)].sort(),
    ["DATABASE_URL", "NODE_ENV"],
    "no environment variable may open, widen or reopen the window",
  );
  assert.ok(!CORE.includes("process.env"), "the ceremony core reads no environment at all");
  for (const forbidden of ["force", "override", "ignoreWindow", "allowAfter", "skipGuard"]) {
    assert.ok(
      !BOTH.toLowerCase().includes(forbidden.toLowerCase()),
      `there is no ${forbidden} — the window closes permanently`,
    );
  }

  /* Closure is checked FIRST, so "an organization exists" is the answer an operator sees. */
  const resolveBody = CORE.slice(CORE.indexOf("export async function resolveRecoveryEligibility"));
  assert.ok(
    resolveBody.indexOf("companyCount > 0") < resolveBody.indexOf("humanCount === 0"),
    "a closed window is reported as closed even when the human count is also wrong",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 4. THE HUMAN IS RESOLVED, NEVER SELECTED.
 * ═════════════════════════════════════════════════════════════════════════ */
function noTargeting(): void {
  /* The CLI takes no arguments at all. */
  assert.ok(!CLI.includes("process.argv"), "recovery takes no arguments — there is nothing to choose");

  /*
   * The resolution accepts nothing to resolve WITH.
   *
   * Asserted as the absence of any injected value — a bind placeholder or a template hole — rather
   * than as forbidden SQL text. An `"id ="` substring version failed on the join condition
   * `i.user_id = u.id`, which is the query's own structure and not a caller's input.
   */
  const resolveQuery = CORE.slice(CORE.indexOf("select u.id as user_id"), CORE.indexOf("limit 1"));
  assert.ok(resolveQuery.length > 0, "the resolution query must be findable");
  for (const forbidden of ["$1", "$2", "${", "+ "]) {
    assert.ok(
      !resolveQuery.includes(forbidden),
      `the resolution must carry no ${forbidden} — it reads the only row that exists`,
    );
  }
  /* And the function it lives in takes a reader, and nothing that could name a human. */
  const signature = read("scripts/lib/recover-bootstrap-credential.ts").match(
    /export async function resolveRecoveryEligibility\([\s\S]*?\): Promise<RecoveryEligibility>/,
  )?.[0];
  assert.ok(signature, "the resolution signature must be findable");
  assert.deepEqual(
    [...signature!.matchAll(/(\w+):\s*Pick</g)].map((m) => m[1]!),
    ["reader"],
    "one parameter, and it is a database reader",
  );
  for (const forbidden of ["email", "userId", "identityId", "id:"]) {
    assert.ok(!signature!.includes(forbidden), `the resolution must not take ${forbidden}`);
  }

  /* The input can express a password and a CONFIRMATION, and nothing else. */
  const input = read("scripts/lib/recover-bootstrap-credential.ts").match(
    /export interface RecoverBootstrapCredentialInput \{[\s\S]*?\n\}/,
  )?.[0];
  assert.ok(input, "the input interface must exist");
  assert.deepEqual(
    [...input!.matchAll(/readonly (\w+)\??:/g)].map((m) => m[1]!).sort(),
    ["confirmEmail", "password"],
    "two fields, and no third",
  );
  for (const forbidden of ["userId", "authIdentityId", "targetEmail", "tenantId", "roleId"]) {
    assert.doesNotMatch(
      input!,
      new RegExp(`\\b${forbidden}\\b`, "i"),
      `the input must not be able to select ${forbidden}`,
    );
  }

  /*
   * `confirmEmail` is COMPARED, never used to look anything up. Asserted as the shape of its only
   * use: an equality against the human the database already resolved.
   */
  const uses = [...CORE.matchAll(/confirmEmail/g)];
  assert.ok(uses.length >= 2, "confirmEmail is used");
  assert.match(
    CORE,
    /typed !== human\.email\.trim\(\)\.toLowerCase\(\)/,
    "the confirmation is compared against the resolved human, never queried with",
  );
  assert.ok(
    !/where[\s\S]{0,120}confirmEmail/i.test(CORE),
    "confirmEmail must never reach a predicate",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 5. ONE-AT-A-TIME: the lock, its level, and its position.
 * ═════════════════════════════════════════════════════════════════════════ */
function serialization(): void {
  const body = CORE.slice(CORE.indexOf("export async function recoverBootstrapCredential"));
  const txAt = body.indexOf("db.transaction");
  const lockAt = body.indexOf("lock table auth_credentials");
  const resolveAt = body.indexOf("resolveRecoveryEligibility(tx)");
  const writeAt = body.indexOf("replacePasswordCredential(");

  assert.ok(txAt > 0, "one transaction");
  assert.ok(lockAt > txAt, "the lock is inside it");
  assert.ok(resolveAt > lockAt, "the window is re-resolved AFTER the lock, never before");
  assert.ok(writeAt > resolveAt, "the write follows the proven window");

  assert.equal(RECOVERY_LOCK_MODE, "share row exclusive");
  assert.match(CORE, /lock table auth_credentials in \$\{RECOVERY_LOCK_MODE\} mode/);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 6. SECRET CONFINEMENT — over STRING-STRIPPED source.
 * ═════════════════════════════════════════════════════════════════════════ */
function secrets(): void {
  const cliCode = stripStrings(CLI);
  const coreCode = stripStrings(CORE);

  /* Never from argv, never from the environment, never from or to a file. */
  assert.ok(!cliCode.includes("process.argv"), "the password cannot arrive in argv");
  const envReads = [...cliCode.matchAll(/process\.env\.([A-Z_]+)/g)].map((m) => m[1]!);
  assert.deepEqual([...new Set(envReads)].sort(), ["DATABASE_URL", "NODE_ENV"]);
  for (const forbidden of ["readFileSync", "writeFileSync", "appendFileSync", "createWriteStream"]) {
    assert.ok(!BOTH.includes(forbidden), `recovery must not use ${forbidden}`);
  }

  /* Hidden, on a real TTY, entered twice. */
  assert.match(CLI, /_writeToOutput/, "the password prompt suppresses echo");
  assert.match(CLI, /isTTY/, "a piped password is refused");
  assert.equal((CLI.match(/promptHidden\(/g) ?? []).length, 3, "declared once, called twice");
  assert.match(CLI, /password !== passwordAgain/, "confirmed by retyping");

  /* The VARIABLE never reaches an output sink or a returned value. */
  for (const sink of ["console.log", "console.error", "process.stdout.write", "process.stderr.write"]) {
    for (const [, args] of cliCode.matchAll(
      new RegExp(`${sink.replace(".", "\\.")}\\(([^;]*)\\)`, "g"),
    )) {
      assert.ok(
        !/\b(password|passwordAgain)\b/.test(args ?? ""),
        `${sink} must never receive the password variable`,
      );
    }
  }
  assert.ok(cliCode.includes("console.log("), "the string-stripper kept the call sites");
  assert.ok(!/return[^;]*\bpassword\b/.test(coreCode), "the ceremony never returns the plaintext");

  /* The declared success shape carries ids and a count — never a secret. */
  const outcome = read("scripts/lib/recover-bootstrap-credential.ts").match(
    /export type RecoveryOutcome =[\s\S]*?\n  \| \{ readonly status: "refused"[^\n]*\n/,
  )?.[0];
  assert.ok(outcome, "the outcome type must be findable");
  assert.ok(!/\bpassword\b/.test(stripStrings(outcome!)), "the success value carries no password");

  /* Only the message escapes an error — never a frame that could hold the plaintext. */
  assert.match(CLI, /fail\(error instanceof Error \? error\.message : String\(error\)\)/);

  /* The floor is the product's, imported rather than restated. */
  assert.equal(MIN_RECOVERY_PASSWORD_LENGTH, MIN_ENROLLMENT_PASSWORD_LENGTH);
  assert.equal(MIN_RECOVERY_PASSWORD_LENGTH, 12);
  assert.ok(
    !/MIN_RECOVERY_PASSWORD_LENGTH = \d/.test(CORE),
    "the floor is derived from the enrollment contract, never restated as a number",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 7. NO ORGANIZATIONAL OR IDENTITY SIDE EFFECT.
 * ═════════════════════════════════════════════════════════════════════════ */
function noSideEffects(): void {
  for (const forbidden of [
    "insertLocalIdentity",
    "bootstrapFirstHuman",
    "provisionTenant",
    "nominateGenesisHuman",
    "memberships",
    "roles",
    "invitations",
    "genesis_nominations",
    "governance_sessions",
    "decision_records",
    "audit_log",
    "provider_connectivity_controls",
    "director_enabled",
    "knowledge_nodes",
    "user_session_contexts",
    "issueLocalSession",
    "setSessionCookie",
    "authIdentities",
    "users.email",
  ]) {
    assert.ok(!CORE.includes(forbidden), `recovery must not reference ${forbidden}`);
  }
  /* It reads `users` and `companies` for the window, and nothing else touches them. */
  assert.ok(
    !/update\s+users|update\s+companies|insert\s+into\s+users/i.test(BOTH),
    "the window predicate reads; it never writes",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 8. POSSESSION AND TARGET BINDING ARE G4'S.
 * ═════════════════════════════════════════════════════════════════════════ */
function possession(): void {
  assert.match(CLI, /resolveCeremonyPosture\(process\.env\)/);
  assert.match(CLI, /preflightEnvironment\(posture, databaseUrl\)/);
  assert.match(CLI, /preflight\(probe, environment\.posture,/);
  assert.match(CLI, /NODE_ENV === "production"/, "the runtime fence is unchanged");
  assert.match(CLI, /createControlPlaneDb\(databaseUrl!\)/, "reachability stays a separate guard");

  for (const forbidden of [
    "pg_control_system",
    "system_identifier",
    "assertLocalDatabaseUrl",
    "assertNonLocalDatabaseUrl",
    "HEBUN_PRODUCTION_TARGET",
    "HEBUN_RECOVERY",
  ]) {
    assert.ok(!BOTH.includes(forbidden), `recovery must not re-implement ${forbidden}`);
  }

  /*
   * Target binding is proved BEFORE the window is even read — asserted inside `main()`.
   *
   * `resolveRecoveryEligibility` also appears in the import block at the top of the file, so a
   * module-wide `indexOf` puts it first and the assertion can never pass. Third time this repo has
   * hit that shape; the answer is always to scope the search to the body that runs.
   */
  const MAIN_BODY = CLI.slice(CLI.indexOf("async function main("));
  assert.ok(MAIN_BODY.length > 0, "main() must be findable");
  assert.ok(
    MAIN_BODY.indexOf("preflight(probe") < MAIN_BODY.indexOf("resolveRecoveryEligibility(handle.db)"),
    "a wrong target refuses before any credential state is read",
  );
  /* …and the posture is resolved before the target probe is even opened. */
  assert.ok(
    MAIN_BODY.indexOf("resolveCeremonyPosture") < MAIN_BODY.indexOf("preflight(probe"),
    "a malformed posture refuses before a connection is spent",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 9. CONTAINMENT — src/, routes and Heby cannot reach it.
 * ═════════════════════════════════════════════════════════════════════════ */
function containment(): void {
  const SRC_CODE = SRC_FILES.map((f) => codeOf(read(f))).join("\n");

  const importers = SRC_FILES.filter((f) =>
    /(?:from|require\()\s*["'][^"'\n]*scripts\//.test(codeOf(read(f))),
  );
  assert.deepEqual(importers, [], "no file under src may import anything under scripts/");
  assert.ok(!/import\s*\(\s*["'][^"'\n]*scripts\//.test(SRC_CODE), "no dynamic import either");

  for (const name of [
    "recoverBootstrapCredential",
    "recover-bootstrap-credential",
    "resolveRecoveryEligibility",
    "RECOVERY_LOCK_MODE",
  ]) {
    assert.deepEqual(
      SRC_FILES.filter((f) => codeOf(read(f)).includes(name)),
      [],
      `no file under src may name ${name}`,
    );
  }

  /* The new AUTHORITY primitive exists in src — and no product surface calls it. */
  const callers = SRC_FILES.filter(
    (f) =>
      f !== "src/features/auth-runtime/credential-repository.server.ts" &&
      codeOf(read(f)).includes("replacePasswordCredential"),
  );
  assert.deepEqual(callers, [], "no route, action or feature may call the replacement primitive");

  const routes = collect("src/app").filter((f) => /(^|\/)route\.tsx?$/.test(f));
  for (const route of routes) {
    assert.ok(!codeOf(read(route)).includes("scripts/"), `${route} must not reach scripts/`);
  }
  for (const f of SRC_FILES.filter((f) => f.includes("heby"))) {
    for (const forbidden of ["replacePasswordCredential", "recoverBootstrapCredential", "revokeCredential"]) {
      assert.ok(!codeOf(read(f)).includes(forbidden), `${f} must not reach ${forbidden}`);
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 10. NO SCHEMA, AND NOTHING RELEASED WAS CHANGED.
 * ═════════════════════════════════════════════════════════════════════════ */
function noSchema(): void {
  /* Phase-relative: G5A.1's claim is about G5A.1. See tests/authentication-schema/migration.ts. */
  const files = readdirSync(path.join(ROOT, "src/db/migrations")).filter((f) => f.endsWith(".sql"));
  const G5A1_BOUNDARY = "20260818172455_production_provenance_vocabulary.sql";
  assert.ok(files.includes(G5A1_BOUNDARY), "the migration G5A.1 inherited is intact");
  assert.deepEqual(
    files.filter((f) => f > G5A1_BOUNDARY).sort(),
    ["20260819133901_g6d_answer_source_evidence.sql", "20260822140116_i1_integration_connection_authority.sql", "20260822195716_int2_integration_credential_authority.sql",
      /* R2H — control_source: the column R5.1 designed and deferred. */
      "20260825080110_provider_control_source.sql",
      /* KR-EXT1 — the Knowledge-owned external-system reference table. Additive: one CREATE TABLE,
       * two foreign keys and three indexes, zero DROP, `knowledge_nodes` untouched. */
      "20260826064423_kr_ext1_knowledge_external_references.sql",
      "20260828071500_ap4b_origination_invocation_provenance.sql",
      "20260828173456_sia26_origination_agent_attribution.sql",
      "20260828190630_sia3_agent_improvement_hypothesis.sql",
      /* AMA-1 — the Agent Mandate Authority table. A declared later phase, not this one's. */
      "20260831110423_ama1_agent_mandate_authority.sql",
      /* OSA-1 — the departments additive hardening. A declared later phase, not this one's. */
      "20260831212454_osa1_department_structure_authority.sql",
      /* WORK-1 — the Organizational Work Authority table. A declared later phase, not this one's. */
      "20260901122013_work1_organizational_work_authority.sql",
      "20260901170404_osa3_departmental_placement.sql",
      /* GIA-1 — the `record-work` mandate-scope CHECK. A declared later phase, not this one's. */
      "20260902115846_gia1_record_work_mandate_scope.sql",
      /* WEV-1 — the `work_evidence_references` table. A declared later phase, not this one's. */
      "20260902183808_wev1_work_evidence_reference.sql"],
    "G5A.1 authored no migration; what follows is a declared later phase",
  );
  /* Journal and directory agree — a relative claim, not another copy of a global total. */
  assert.equal(
    (JSON.parse(read("src/db/migrations/meta/_journal.json")) as { entries: unknown[] }).entries
      .length,
    files.length,
  );

  /* The released primitives are untouched. */
  assert.match(AUTHORITY, /export async function establishFirstPasswordCredential/);
  assert.match(AUTHORITY, /export async function insertPasswordCredential/);
  assert.match(AUTHORITY, /export async function revokeCredential/);
  assert.match(
    codeOf(read("scripts/lib/bootstrap-first-human.ts")),
    /establishFirstPasswordCredential\(\s*tx,/,
    "the G5A first-human ceremony still uses its own primitive, unchanged",
  );
  assert.match(
    codeOf(read("src/features/identity-enrollment/complete-enrollment.server.ts")),
    /establishFirstPasswordCredential\(tx, identity\.authIdentityId, password, now\)/,
    "enrollment is unchanged",
  );
  assert.match(
    codeOf(read("scripts/lib/provision-dev-credential.ts")),
    /insert into auth_credentials/,
    "the local dev tool is untouched and still quarantined",
  );
}

notAnAuthority();
transition();
window();
noTargeting();
serialization();
secrets();
noSideEffects();
possession();
containment();
noSchema();

console.log("G5A.1 recovery boundaries: all assertions passed.");
