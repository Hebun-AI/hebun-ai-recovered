/*
 * G5A — FIRST-HUMAN BOOTSTRAP BOUNDARIES (structural, no DB, no network).
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "The ceremony ORCHESTRATES Identity and Credential authority and never becomes either; it
 *    creates nothing organizational; the password cannot arrive from anywhere but a hidden prompt;
 *    the application cannot reach it; and G5A added no schema and no route."
 *
 * Assertions run over comment-stripped source, so prose about a guard can never stand in for the
 * guard — the trap R3B's firewall hit and every gate since has re-applied.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  FIRST_HUMAN_LOCK_MODE,
  MIN_BOOTSTRAP_PASSWORD_LENGTH,
  isBootstrapEmail,
  normalizeEmail,
} from "../../scripts/lib/bootstrap-first-human";
import { MIN_ENROLLMENT_PASSWORD_LENGTH } from "../../src/features/identity-enrollment/contracts";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");
const codeOf = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
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

const CORE = codeOf(read("scripts/lib/bootstrap-first-human.ts"));
const CLI = codeOf(read("scripts/bootstrap-first-human.ts"));
const BOTH = `${CORE}\n${CLI}`;
const SRC_FILES = collect("src");

/* ═══════════════════════════════════════════════════════════════════════════
 * 1. IT IS NOT AN IDENTITY WRITER — the load-bearing claim of this phase.
 * ═════════════════════════════════════════════════════════════════════════ */
function notAWriter(): void {
  /*
   * No INSERT of any kind, in either file. Asked as the write verbs AND as Drizzle's builder, so
   * neither raw SQL nor a query-builder call can slip a second writer in beside the authority.
   */
  for (const forbidden of [
    "insert into",
    ".insert(",
    ".values(",
    "update ",
    "delete from",
    "upsert",
    "on conflict",
  ]) {
    assert.ok(
      !BOTH.toLowerCase().includes(forbidden.toLowerCase()),
      `the ceremony must not contain ${forbidden.trim()} — Identity and Credential own the writes`,
    );
  }

  /* It calls the two authorities, by name, and those calls are how the rows come to exist. */
  assert.match(CORE, /insertLocalIdentity\(tx, \{/, "Identity authority creates the human");
  assert.match(
    CORE,
    /establishFirstPasswordCredential\(\s*tx,\s*identity\.authIdentityId,\s*input\.password,/,
    "Credential authority establishes the password, inside the same transaction",
  );

  /*
   * And it never holds derived credential material. If it named a salt or a hash it would become a
   * fourth file in D1's confinement set, which is the exact leak that rule exists to prevent.
   */
  for (const forbidden of [
    "hashPassword",
    "secretHash",
    "secret_hash",
    "salt",
    "scrypt",
    "deriveScrypt",
    "insertPasswordCredential",
  ]) {
    assert.ok(!BOTH.includes(forbidden), `the ceremony must not name ${forbidden}`);
  }

  /* Nor does it re-declare the identity vocabulary — it imports the product's own constants. */
  assert.match(
    CORE,
    /from "\.\.\/\.\.\/src\/features\/identity-enrollment\/contracts"/,
    "the provider/issuer/subject vocabulary is imported, never restated",
  );
  for (const literal of ['"local"', '"hebun-local"', "`local:"]) {
    assert.ok(
      !CORE.includes(literal),
      `the ceremony must not hard-code ${literal} — that is the contract's to define`,
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 2. NO ACTOR IS NAMED — possession is a SOURCE.
 * ═════════════════════════════════════════════════════════════════════════ */
function noActor(): void {
  /*
   * `createdByType` is OMITTED from the insert input. Asserted as the absence of the key in the
   * call, because passing `undefined` explicitly and omitting it are the same to the writer, but
   * passing "human" would be a lie and must be impossible to introduce silently.
   */
  const call = CORE.match(/insertLocalIdentity\(tx, \{[\s\S]*?\}\)/)?.[0] ?? "";
  assert.ok(call.length > 0, "the identity call must be findable");
  assert.ok(!call.includes("createdByType"), "the bootstrap names no actor type");
  assert.ok(!call.includes("createdBy"), "…and no actor id");

  /*
   * The core may not name an actor or a provenance root ANYWHERE.
   *
   * The CLI is held to the same rule everywhere EXCEPT its operator banner, which says out loud
   * that `created_by` and `created_by_type` are NULL. The first version of this assertion forbade
   * the names in both files and failed on exactly that sentence — forbidding the name would have
   * forbidden the disclosure. So the CLI is checked with its `console.log` lines removed, which
   * leaves any real use of those columns fully exposed.
   */
  const ACTOR_AND_ROOT = [
    "actor_id",
    "actor_type",
    "actorId",
    "actorType",
    "created_by",
    "provisioning_source",
    "nomination_source",
    "production-operator-ceremony",
    "local-operator-ceremony",
  ];
  for (const forbidden of ACTOR_AND_ROOT) {
    assert.ok(
      !CORE.includes(forbidden),
      `the ceremony core must not name ${forbidden} — the row records no root and no actor`,
    );
  }
  const cliWithoutBanner = CLI.replace(/console\.log\([^\n]*\);?/g, "");
  for (const forbidden of ACTOR_AND_ROOT) {
    assert.ok(
      !cliWithoutBanner.includes(forbidden),
      `the CLI may name ${forbidden} only when telling the operator it stays NULL`,
    );
  }
  assert.match(
    CLI,
    /created_by and created_by_type are NULL/,
    "…and it does say so, because an operator should be told what was not claimed",
  );

  /* And the Identity writer now derives BOTH columns from the same field. */
  const writer = codeOf(read("src/features/auth-runtime/identity-repository.server.ts"));
  assert.match(
    writer,
    /createdBy: input\.createdByType === "human" \? userId : undefined/,
    "self-attribution follows the declared actor type, in both columns",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 3. NO ORGANIZATIONAL SIDE EFFECT.
 * ═════════════════════════════════════════════════════════════════════════ */
function noSideEffects(): void {
  for (const forbidden of [
    "companies",
    "roles",
    "memberships",
    "invitations",
    "membership_authorizations",
    "genesis_nominations",
    "governance_sessions",
    "decision_records",
    "audit_log",
    "provider_connectivity_controls",
    "providers",
    "knowledge_nodes",
    "user_session_contexts",
    "director_enabled",
    "SESSION_COOKIE_NAME",
    "issueLocalSession",
    "setSessionCookie",
    "provisionTenant",
    "nominateGenesisHuman",
  ]) {
    assert.ok(!CORE.includes(forbidden), `the ceremony core must not reference ${forbidden}`);
  }
  /* The CLI may only NAME the next ceremony in its closing advice, never call it. */
  assert.ok(
    !CLI.includes("provisionTenant") && !CLI.includes("nominateGenesisHuman"),
    "the CLI must not invoke the tenant or genesis ceremony",
  );
  assert.match(CLI, /tenant:provision -- <slug>/, "…it only tells the operator what comes next");
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 4. ONE-SHOT: the guard, the lock, and the level.
 * ═════════════════════════════════════════════════════════════════════════ */
function oneShot(): void {
  /*
   * Ordering is asserted INSIDE the function body, never over the module.
   *
   * `insertLocalIdentity` also appears in the import block at the top of the file, so a
   * module-wide `indexOf` puts the write before everything and can never pass — the mirror of
   * R4C.1's ordering assertion, which matched an import and could never FAIL. Either way the
   * answer is the same: scope the search to the body that actually runs.
   */
  const BODY =
    CORE.slice(CORE.indexOf("export async function bootstrapFirstHuman")) ?? "";
  assert.ok(BODY.length > 0, "the ceremony body must be findable");

  const lockAt = BODY.indexOf("lock table users");
  const countAt = BODY.indexOf("countExistingHumans(tx)");
  assert.ok(lockAt > 0, "the transaction locks users");
  assert.ok(countAt > lockAt, "the count is taken AFTER the lock, never before");

  /*
   * The level is pinned. `share row exclusive` self-conflicts (two ceremonies serialize) and
   * conflicts with `row exclusive`, which INSERT takes. Weakening it to `row exclusive` or
   * `share` would silently permit two first humans.
   */
  assert.equal(FIRST_HUMAN_LOCK_MODE, "share row exclusive");
  assert.match(CORE, /lock table users in \$\{FIRST_HUMAN_LOCK_MODE\} mode/);

  /* Both the check and the writes are inside ONE transaction. */
  assert.match(CORE, /db\.transaction\(async \(tx\) => \{/, "one transaction");
  const txAt = BODY.indexOf("db.transaction");
  assert.ok(txAt > 0 && txAt < lockAt, "the lock is inside the transaction");
  assert.ok(
    BODY.indexOf("insertLocalIdentity(tx") > countAt,
    "the write follows the proven count",
  );
  assert.ok(
    BODY.indexOf("establishFirstPasswordCredential(") > BODY.indexOf("insertLocalIdentity(tx"),
    "the credential follows the identity it belongs to",
  );

  /*
   * Refusal is by COUNT, not by email — a second human with a DIFFERENT address must refuse too.
   *
   * Asserted over the guard region itself (lock → refusal return). A looser "the words
   * `humans-already-exist` and `email` are not near each other" version failed on the identity
   * insert that legitimately follows the guard, which proves nothing about the guard.
   */
  const guard = BODY.slice(lockAt, BODY.indexOf("existingHumans: existing"));
  assert.ok(guard.length > 0, "the guard region must be findable");
  assert.match(guard, /existing > 0/, "any existing human refuses, whatever their address");
  for (const forbidden of ["email", "Email", "normalizedEmail", "users_email_uq"]) {
    assert.ok(
      !guard.includes(forbidden),
      `the one-shot guard must not read ${forbidden} — it counts humans, it does not match one`,
    );
  }
  /* And the count query it uses is unfiltered. */
  assert.match(
    CORE,
    /select count\(\*\)::int as n from users["`]/,
    "the count is over the whole table, with no predicate",
  );

  /*
   * No rotation, no repair, no reset — asserted by MECHANISM, not by vocabulary.
   *
   * A word-list version of this failed on the ceremony's own refusal message, which tells the
   * operator it will not "repair an account" or "reset a password". That is the denial, not the
   * capability — the same trap R3B recorded when `includes("replay")` flagged
   * `automaticReplay: false`. What actually forecloses rotation is that there is no UPDATE and no
   * DELETE anywhere (section 1), and that the credential call is the ESTABLISH-FIRST primitive
   * rather than the rotating one D1.1 uses.
   */
  assert.ok(
    !BOTH.includes("provisionDevCredential") && !BOTH.includes("revokeCredential"),
    "the ceremony must not reach the rotating credential paths",
  );
  assert.match(
    CORE,
    /establishFirstPasswordCredential/,
    "it establishes a FIRST credential and has no vocabulary for a second",
  );
  assert.ok(
    !/\.update\(|update\s+auth_credentials|status\s*=\s*["']revoked["']/.test(BOTH),
    "no path here can revoke or replace an existing credential",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 5. THE PASSWORD CAN ONLY ARRIVE FROM A HIDDEN PROMPT.
 * ═════════════════════════════════════════════════════════════════════════ */
function passwordHandling(): void {
  /* Not from argv, not from the environment, not from a file. */
  const envReads = [...CLI.matchAll(/process\.env\.([A-Z_]+)/g)].map((m) => m[1]!);
  assert.deepEqual(
    [...new Set(envReads)].sort(),
    ["DATABASE_URL", "NODE_ENV"],
    "a password that lives in config is a password that eventually gets committed",
  );
  assert.ok(!CORE.includes("process.env"), "the ceremony core reads no environment at all");
  const argvReads = [...CLI.matchAll(/process\.argv\[(\d+)\]/g)].map((m) => m[1]!);
  assert.deepEqual(argvReads, ["2"], "argv carries the email and nothing else");
  for (const forbidden of ["readFileSync", "writeFileSync", "appendFileSync", "createWriteStream"]) {
    assert.ok(!BOTH.includes(forbidden), `the ceremony must not use ${forbidden}`);
  }

  /* Entered twice, hidden, and only on a real terminal. */
  assert.match(CLI, /_writeToOutput/, "the password prompt suppresses echo");
  assert.match(CLI, /isTTY/, "a piped password is refused");
  assert.equal((CLI.match(/promptHidden\(/g) ?? []).length, 3, "declared once, called twice");
  assert.match(CLI, /password !== passwordAgain/, "the password is confirmed by retyping");
  assert.match(CLI, /Retype the email to bootstrap/, "…and so is the email");

  /*
   * The password is never printed — asserted on the IDENTIFIER, not the word.
   *
   * A version matching /console\.log\([^)]*password/i failed on the banner line "ONE password
   * credential", which is prose. What matters is whether the VARIABLE reaches an output call, so
   * string literals are stripped first and the check then looks for the bare identifier.
   */
  const stripStrings = (source: string): string =>
    source
      .replace(/`(?:[^`\\]|\\.)*`/g, "``")
      .replace(/"(?:[^"\\]|\\.)*"/g, '""')
      .replace(/'(?:[^'\\]|\\.)*'/g, "''");
  const withoutStrings = stripStrings(CLI);
  for (const sink of ["console.log", "console.error", "process.stdout.write", "process.stderr.write"]) {
    const calls = [...withoutStrings.matchAll(new RegExp(`${sink.replace(".", "\\.")}\\(([^;]*)\\)`, "g"))];
    for (const [, args] of calls) {
      assert.ok(
        !/\b(password|passwordAgain)\b/.test(args ?? ""),
        `${sink} must never receive the password variable`,
      );
    }
  }
  /* Sanity: the stripper did not delete the sinks it is supposed to inspect. */
  assert.ok(withoutStrings.includes("console.log("), "the string-stripper kept the call sites");
  /* And the plaintext is never returned to the caller either. */
  /*
   * Also over stripped source: the refusal reason is the LITERAL "password-too-short", which a
   * word match reads as the plaintext escaping. Third time this file hit that shape — prose,
   * refusal reasons and denials are made of the same words as the things they forbid.
   */
  assert.ok(
    !/return[^;]*\bpassword\b/.test(stripStrings(CORE)),
    "the ceremony never returns the plaintext",
  );
  /* The declared success shape carries ids and an email — never the secret. */
  const bootstrappedShape =
    read("scripts/lib/bootstrap-first-human.ts").match(
      /export interface BootstrappedHuman \{[\s\S]*?\n\}/,
    )?.[0] ?? "";
  assert.ok(bootstrappedShape.length > 0, "the success shape must be findable");
  assert.deepEqual(
    [...bootstrappedShape.matchAll(/readonly (\w+):/g)].map((m) => m[1]!).sort(),
    ["authIdentityId", "credentialId", "email", "userId"],
    "four fields, none of them a secret",
  );
  assert.match(
    CLI,
    /fail\(error instanceof Error \? error\.message : String\(error\)\)/,
    "only the message escapes — never a stack frame that could carry the plaintext",
  );
  const success = CLI.slice(CLI.indexOf("first human bootstrapped"));
  for (const forbidden of ["password", "credential  : ${human.credentialId}".slice(0, 0)]) {
    if (forbidden) assert.ok(!success.includes(forbidden), "the success banner carries no secret");
  }

  /* The floor is the product's, not a second policy for the most privileged account. */
  assert.equal(MIN_BOOTSTRAP_PASSWORD_LENGTH, MIN_ENROLLMENT_PASSWORD_LENGTH);
  assert.equal(MIN_BOOTSTRAP_PASSWORD_LENGTH, 12);
  assert.ok(
    !/MIN_BOOTSTRAP_PASSWORD_LENGTH = \d/.test(CORE),
    "the floor is derived from the enrollment contract, never restated as a number",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 6. INPUTS: an email and a password. Nothing organizational has a parameter.
 * ═════════════════════════════════════════════════════════════════════════ */
function inputs(): void {
  const input = read("scripts/lib/bootstrap-first-human.ts").match(
    /export interface BootstrapFirstHumanInput \{[\s\S]*?\n\}/,
  )?.[0];
  assert.ok(input, "the input interface must exist");
  assert.deepEqual(
    [...input!.matchAll(/readonly (\w+):/g)].map((m) => m[1]!).sort(),
    ["email", "password"],
    "two fields, and no third",
  );
  for (const forbidden of [
    "tenantId",
    "tenant",
    "roleId",
    "role",
    "membership",
    "governance",
    "provisioningSource",
    "createdBy",
    "actorId",
    "provider",
    "issuer",
  ]) {
    assert.doesNotMatch(
      input!,
      new RegExp(`\\b${forbidden}\\b`, "i"),
      `the input must not be able to supply ${forbidden}`,
    );
  }

  /* Email normalization and bounds come from the product contract. */
  assert.equal(normalizeEmail("  Ada@Example.COM "), "ada@example.com");
  for (const bad of ["", "   ", "nope", "a@b", "a b@c.d", "@example.com", "ada@", `${"x".repeat(320)}@e.com`]) {
    assert.equal(isBootstrapEmail(bad), false, `${JSON.stringify(bad)} must be refused`);
  }
  for (const ok of ["ada@example.com", "A.B+c@sub.example.co.uk"]) {
    assert.equal(isBootstrapEmail(ok), true, `${ok} must be accepted`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 7. POSSESSION + TARGET BINDING ARE G4'S, REUSED NOT REBUILT.
 * ═════════════════════════════════════════════════════════════════════════ */
function possession(): void {
  assert.match(CLI, /resolveCeremonyPosture\(process\.env\)/, "G4's posture, not a second one");
  assert.match(CLI, /preflightEnvironment\(posture, databaseUrl\)/, "G4's locality decision");
  assert.match(CLI, /preflight\(probe, environment\.posture,/, "G4's target binding");
  assert.match(CLI, /NODE_ENV === "production"/, "the runtime fence is unchanged");

  /* No second authorization mechanism of its own. */
  for (const forbidden of [
    "HEBUN_BOOTSTRAP",
    "HEBUN_FIRST_HUMAN",
    "HEBUN_PRODUCTION_TARGET_SYSTEM_IDENTIFIER",
    "system_identifier",
    "pg_control_system",
    "assertLocalDatabaseUrl",
    "assertNonLocalDatabaseUrl",
  ]) {
    assert.ok(
      !BOTH.includes(forbidden),
      `the ceremony must not re-implement ${forbidden} — G4 owns target binding`,
    );
  }

  /* Reachability stays separate from authorization: the handle applies its own remote guard. */
  assert.match(CLI, /createControlPlaneDb\(databaseUrl!\)/, "the write uses the guarded handle");
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 8. SCRIPT CONTAINMENT — src/ and Heby cannot reach it.
 * ═════════════════════════════════════════════════════════════════════════ */
function containment(): void {
  const SRC_CODE = SRC_FILES.map((f) => codeOf(read(f))).join("\n");

  const importers = SRC_FILES.filter((f) =>
    /(?:from|require\()\s*["'][^"'\n]*scripts\//.test(codeOf(read(f))),
  );
  assert.deepEqual(importers, [], "no file under src may import anything under scripts/");
  assert.ok(
    !/import\s*\(\s*["'][^"'\n]*scripts\//.test(SRC_CODE),
    "src holds no dynamic import into scripts/",
  );

  for (const name of ["bootstrapFirstHuman", "bootstrap-first-human", "FIRST_HUMAN_LOCK_MODE"]) {
    const namers = SRC_FILES.filter((f) => codeOf(read(f)).includes(name));
    assert.deepEqual(namers, [], `no file under src may name ${name}`);
  }

  /* No route, no server action, no Heby surface. */
  const routes = collect("src/app").filter((f) => /(^|\/)route\.tsx?$/.test(f));
  for (const route of routes) {
    assert.ok(!codeOf(read(route)).includes("scripts/"), `${route} must not reach scripts/`);
  }
  const hebyFiles = SRC_FILES.filter((f) => f.includes("heby"));
  assert.ok(hebyFiles.length > 0, "there are Heby modules to check");
  for (const f of hebyFiles) {
    const code = codeOf(read(f));
    for (const forbidden of ["bootstrapFirstHuman", "insertLocalIdentity", "establishFirstPasswordCredential"]) {
      assert.ok(!code.includes(forbidden), `${f} must not reach ${forbidden}`);
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 9. G5A ADDED NO SCHEMA, AND ENROLLMENT IS UNCHANGED.
 * ═════════════════════════════════════════════════════════════════════════ */
function noSchemaNoRegression(): void {
  /* Phase-relative: G5A's claim is about G5A, not about every phase that ships after it. */
  const g5aMigrations = readdirSync(path.join(ROOT, "src/db/migrations")).filter((f) => f.endsWith(".sql"));
  const G5A_BOUNDARY = "20260817195446_r4a_tenant_provisioning_source.sql";
  assert.ok(g5aMigrations.includes(G5A_BOUNDARY), "the migration G5A inherited is intact");
  assert.deepEqual(
    g5aMigrations.filter((f) => f > G5A_BOUNDARY).sort(),
    [
      "20260818172455_production_provenance_vocabulary.sql",
      "20260819133901_g6d_answer_source_evidence.sql", "20260822140116_i1_integration_connection_authority.sql", "20260822195716_int2_integration_credential_authority.sql",
      /* R2H — control_source, the column R5.1 designed and deferred until production gained a
       * provider-control write path. */
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
      "20260902183808_wev1_work_evidence_reference.sql",
"20260902212106_pbga1_action_request_work_purpose.sql",
    ],
    "G5A authored no migration; what follows is a declared later phase",
  );
  /* Journal and directory agree — a relative claim, not another copy of a global total. */
  assert.equal(
    (JSON.parse(read("src/db/migrations/meta/_journal.json")) as { entries: unknown[] }).entries
      .length,
    g5aMigrations.length,
  );

  /* Enrollment still self-attributes, by passing the same field it always passed. */
  const enrollment = codeOf(read("src/features/identity-enrollment/complete-enrollment.server.ts"));
  assert.match(
    enrollment,
    /insertLocalIdentity\(tx, \{[\s\S]*?createdByType: "human",[\s\S]*?\}\)/,
    "enrollment still declares the human as their own creator",
  );

  /* And Identity is still the sole writer of the two tables, now with two legitimate callers. */
  const writers = SRC_FILES.filter((f) =>
    /\.insert\((users|authIdentities)\)/.test(codeOf(read(f))),
  );
  assert.deepEqual(
    writers,
    ["src/features/auth-runtime/identity-repository.server.ts"],
    "exactly one module under src may insert users or auth_identities",
  );
}

notAWriter();
noActor();
noSideEffects();
oneShot();
passwordHandling();
inputs();
possession();
containment();
noSchemaNoRegression();

console.log("G5A bootstrap boundaries: all assertions passed.");
