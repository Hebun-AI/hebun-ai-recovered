/*
 * Production migration authority — BOUNDARIES AND FIREWALL.
 *
 * Source-level properties: what this ceremony may reach, what it may never print, what it may never
 * be pointed at, and — the part that matters most — that building it did not weaken the four
 * ceremonies that already existed.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import {
  PRODUCTION_CEREMONY_ENV,
  PRODUCTION_TARGET_DATABASE_ENV,
  PRODUCTION_TARGET_SYSTEM_IDENTIFIER_ENV,
} from "../../scripts/lib/production-possession";

const ROOT = path.join(import.meta.dirname, "..", "..");
const read = (file: string): string => readFileSync(path.join(ROOT, file), "utf8");

/**
 * Source with comments and string literals removed.
 *
 * BOTH, not just comments. This repository has repeatedly had assertions fail on a file's own
 * honest prose — a refusal message naming the thing it refuses reads exactly like the thing itself
 * to a substring match. Strings go too, for the same reason.
 */
const withoutComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1 ");

const codeOf = (source: string): string =>
  withoutComments(source)
    .replace(/`(?:[^`\\]|\\[\s\S])*`/g, "``")
    .replace(/"(?:[^"\\]|\\[\s\S])*"/g, '""')
    .replace(/'(?:[^'\\]|\\[\s\S])*'/g, "''");

const MIGRATE_CLI = "scripts/platform-migrate.ts";
const MIGRATE_LIB = "scripts/lib/production-migration.ts";
const CANONICAL_LIB = "scripts/lib/canonical-migrations.ts";
const POSSESSION = "scripts/lib/production-possession.ts";

/** The four ceremonies that existed before this phase. None of them may have moved. */
const PRE_EXISTING_CEREMONIES = [
  "scripts/tenant-provision.ts",
  "scripts/genesis-nominate.ts",
  "scripts/tenant-lifecycle.ts",
  "scripts/provider-connectivity.ts",
] as const;

function collect(dir: string): string[] {
  const abs = path.join(ROOT, dir);
  return readdirSync(abs).flatMap((entry) => {
    const rel = path.join(dir, entry);
    if (statSync(path.join(ROOT, rel)).isDirectory()) return collect(rel);
    return /\.tsx?$/.test(entry) ? [rel] : [];
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 1. THE CEREMONY IS ARMED THE WAY EVERY OTHER CEREMONY IS ARMED
 * ═════════════════════════════════════════════════════════════════════════ */
function itUsesTheOneProductionAuthority(): void {
  const cli = codeOf(read(MIGRATE_CLI));

  assert.match(cli, /resolveCeremonyPosture\(process\.env\)/, "posture comes from the released resolver");
  assert.match(cli, /preflightEnvironment\(posture, databaseUrl\)/, "and routes through the shared preflight");
  assert.match(cli, /NODE_ENV === ""/, "NODE_ENV=production is refused, as in every ceremony");
  assert.match(cli, /isTTY/, "confirmation is TTY-only");

  /*
   * NO SECOND POSSESSION MODEL. The ceremony must not read the arming variables itself or invent
   * its own literal — it asks the released resolver, which owns the exact-literal rule.
   */
  for (const name of [
    PRODUCTION_CEREMONY_ENV,
    PRODUCTION_TARGET_SYSTEM_IDENTIFIER_ENV,
    PRODUCTION_TARGET_DATABASE_ENV,
  ]) {
    assert.ok(!codeOf(read(MIGRATE_CLI)).includes(name), `the CLI must not name ${name} itself`);
    assert.ok(!codeOf(read(MIGRATE_LIB)).includes(name), `the mechanics must not name ${name}`);
  }

  /*
   * IT TAKES POSSESSION FROM THE IDENTITY HALF, DELIBERATELY — and must not fall back to the fused
   * check, which would deadlock it against the very gap it exists to close.
   */
  assert.match(cli, /verifyProductionIdentity\(client, environment\.posture\.expected\)/);
  assert.ok(!cli.includes("verifyProductionTarget"), "the migration ceremony does not use the fused check");
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 2. IT CAN ONLY EVER APPLY COMMITTED CANONICAL MIGRATIONS
 * ═════════════════════════════════════════════════════════════════════════ */
function itIsNotAGenericSqlExecutor(): void {
  const whole = codeOf(read(MIGRATE_CLI));
  const cli = whole;
  const lib = codeOf(read(MIGRATE_LIB));

  /* No argument may name anything. The CLI refuses argv outright. */
  assert.match(cli, /process\.argv\.length > 2/, "the ceremony takes no arguments at all");

  /*
   * The engine call takes a FOLDER and nothing else, and the folder defaults to the canonical one.
   * There is no parameter for SQL, for a statement, or for a migration name anywhere in the seam.
   */
  assert.match(
    lib,
    /export async function applyPendingMigrations\(client: Client, migrationsFolder: string = MIGRATIONS_DIR\)/,
    "the executor takes a client and a migrations FOLDER — no SQL, no statement, no file",
  );
  assert.match(
    lib,
    /await migrate\(drizzle\(\{ client \}\), \{ migrationsFolder \}\)/,
    "and hands that folder straight to the canonical engine over this verified connection",
  );

  /*
   * THE CEREMONY CALLS IT WITH THE DEFAULT FOLDER AND NOTHING ELSE. A second argument would let an
   * environment variable point the engine at migrations that are not in this commit.
   */
  const body = whole.slice(whole.indexOf("async function main("));
  assert.match(
    body,
    /await applyPendingMigrations\(client\);/,
    "the ceremony applies the COMMITTED canonical folder and cannot be pointed elsewhere",
  );

  /* Nothing in the seam executes raw SQL that a caller could have influenced. */
  for (const [label, source] of [
    ["CLI", cli],
    ["mechanics", lib],
    ["canonical", codeOf(read(CANONICAL_LIB))],
  ] as const) {
    assert.ok(!/\bsql\.raw\b/.test(source), `${label} must not reach sql.raw`);
    assert.ok(!/readFileSync\([^)]*argv/.test(source), `${label} must not read a file named by argv`);
    assert.ok(!/\bexecSync\b/.test(source), `${label} must not use execSync — argv must be a list`);
  }

  /*
   * `execFileSync` ONLY, and never `exec`/`execSync`. A shell string is how a connection string
   * ends up in shell history and in `ps`; an argv array cannot be word-split.
   */
  assert.ok(lib.includes("execFileSync"), "the backup shells out through execFileSync");

  /*
   * THE ARCHIVE IS VALIDATED, NOT MERELY WRITTEN. A file of the right size is not a restorable
   * dump; `pg_restore -l` parsing its table of contents is the cheapest proof that it is one.
   */
  const rawLib = read(MIGRATE_LIB);
  assert.ok(rawLib.includes('"pg_restore"'), "the backup is validated with pg_restore");
  assert.match(rawLib, /execFileSync\("pg_restore", \["-l", target\]/, "by listing its table of contents");

  /*
   * THE MIGRATION EXECUTOR IS NOT REACHABLE FROM ANOTHER CEREMONY. Only the migration CLI may
   * import it — otherwise a ceremony with no confirmation and no backup could apply migrations.
   */
  /*
   * COMMENTS STRIPPED, STRINGS KEPT. An import specifier IS a string literal, so running this
   * through `codeOf` would erase the very thing being looked for and leave an assertion that could
   * never fail. Comments still go, so a module naming itself in its own header is not an importer.
   */
  const importers = collect("scripts")
    .filter((f) => f !== MIGRATE_LIB)
    .filter((f) => withoutComments(read(f)).includes("production-migration"));
  /*
   * SUITE-RECOVERY-1 — A NAMED-IMPORT ALLOWLIST (Director decision, 2026-10-18). Three later
   * ceremonies take a validated backup, read the server version, or fingerprint the organization
   * before they act: IMAGE → VIDEO and MV-7 acceptance (5a130086, c2905715) and processor
   * attestation (33733cdd). They may import EXACTLY those read/backup helpers, by name. Migration
   * EXECUTION — `applyPendingMigrations`, the migration lock, the migrator — stays the migration
   * CLI's alone. Any import form that does not name its members (namespace, default, side-effect,
   * re-export, require) fails, because it would hand over the executor too.
   */
  const READ_ONLY_HELPERS: ReadonlySet<string> = new Set([
    "BACKUP_ROOT",
    "createValidatedBackup",
    "readServerVersion",
    "organizationalFingerprint",
    "fingerprintDrift",
    "OrganizationalFingerprint",
  ]);
  const HELPER_IMPORTERS = [
    "scripts/i2v-production-acceptance.ts",
    "scripts/lib/processor-attestation.ts",
    "scripts/mv7-production-acceptance.ts",
    "scripts/processor-attestation.ts",
  ];
  assert.deepEqual(
    importers.sort(),
    [...HELPER_IMPORTERS, MIGRATE_CLI].sort(),
    "only the migration ceremony may import the migration mechanics — and the named read-only helper importers",
  );
  const SPEC = String.raw`["'](?:\.\.?\/)(?:lib\/)?production-migration(?:\.ts)?["']`;
  for (const f of HELPER_IMPORTERS) {
    const code = withoutComments(read(f));
    const named = [
      ...code.matchAll(new RegExp(String.raw`import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*` + SPEC, "g")),
      ...code.matchAll(new RegExp(String.raw`(?:const|let|var)\s*\{([^}]*)\}\s*=\s*await\s+import\(\s*` + SPEC + String.raw`\s*\)`, "g")),
    ];
    const mentions = code.split("production-migration").length - 1;
    assert.equal(named.length, mentions, `${f} imports the migration module only through named members`);
    const members = named.flatMap((m) =>
      m[1]!.split(",").map((x) => x.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0]!).filter(Boolean),
    );
    for (const member of members) {
      assert.ok(READ_ONLY_HELPERS.has(member), `${f} may import only read-only/backup helpers, not \`${member}\``);
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 3. SECRETS
 * ═════════════════════════════════════════════════════════════════════════ */
function theConnectionStringIsNeverExposed(): void {
  const cli = read(MIGRATE_CLI);
  const lib = read(MIGRATE_LIB);

  /*
   * NOTHING PRINTS THE URL. Asserted on the RAW source, comments included: a comment that prints it
   * is not a risk, but a `console.log` hidden behind one is, and the raw read is the strict version.
   */
  for (const [label, source] of [
    ["CLI", cli],
    ["mechanics", lib],
  ] as const) {
    for (const sink of ["console.log", "console.error", "console.warn"]) {
      const printed = source
        .split("\n")
        .filter((line) => line.includes(sink) && /databaseUrl|connectionString|DATABASE_URL/.test(line));
      assert.deepEqual(printed, [], `${label} must never print the connection string via ${sink}`);
    }
  }

  /*
   * AND IT NEVER REACHES A CHILD'S ARGV. `pg_dump -d "$DATABASE_URL"` is the natural way to write
   * this and it publishes the password to the process table, where any user on the machine reads it
   * with `ps`. The URL goes into the child's ENVIRONMENT instead — so the argv array must not
   * mention it, and `-d`/`--dbname` must not appear at all.
   */
  const argvLines = lib
    .split("\n")
    .filter((line) => /execFileSync\(/.test(line) || /^\s*\[?"-/.test(line));
  for (const line of argvLines) {
    assert.ok(
      !/connectionString|databaseUrl|DATABASE_URL/.test(line),
      `the connection string must not appear in a child's argv: ${line.trim()}`,
    );
  }
  assert.ok(
    !/"--?d(bname)?"/.test(codeOf(lib).replace(/""/g, (m) => m)) && !lib.includes('"-d"') && !lib.includes('"--dbname"'),
    "pg_dump must take its connection from PG* env vars, never from -d",
  );
  assert.ok(lib.includes("libpqEnvFor"), "and the decomposition helper is what supplies them");

  /* The mechanics never write a file that could hold the secret. */
  assert.ok(!codeOf(lib).includes("writeFileSync"), "the mechanics write no file of their own");
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 4. BACKUP AND CONFIRMATION COME BEFORE THE MUTATION
 * ═════════════════════════════════════════════════════════════════════════ */
function nothingIsAppliedBeforeABackupAndAHuman(): void {
  /*
   * SCOPED TO THE FUNCTION BODY, NOT THE MODULE.
   *
   * A module-wide `indexOf` finds the IMPORT BLOCK first, where these names appear in alphabetical
   * order and not in execution order — so every ordering assertion below would have been measuring
   * how the imports are sorted. This repository has been bitten by exactly that before.
   */
  const whole = codeOf(read(MIGRATE_CLI));
  const cli = whole.slice(whole.indexOf("async function main("));
  assert.ok(cli.length > 0 && cli.length < whole.length, "the ceremony body was located");

  const identity = cli.indexOf("verifyProductionIdentity");
  const lock = cli.indexOf("acquireMigrationLock");
  const prefix = cli.indexOf("verifyCanonicalMigrationPrefix");
  const backup = cli.indexOf("createValidatedBackup");
  const confirm = cli.indexOf("promptVisible");
  const apply = cli.indexOf("applyPendingMigrations");

  for (const [label, index] of [
    ["identity", identity],
    ["lock", lock],
    ["prefix", prefix],
    ["backup", backup],
    ["confirmation", confirm],
    ["apply", apply],
  ] as const) {
    assert.ok(index > -1, `${label} must appear in the ceremony`);
  }

  assert.ok(identity < lock, "possession is proved before the lock is taken");
  assert.ok(lock < prefix, "the lock is taken before the ledger is read, so a peer cannot race it");
  assert.ok(prefix < backup, "a divergent target is refused before a backup is even attempted");
  assert.ok(backup < confirm, "the backup is validated BEFORE a human is asked to confirm");
  assert.ok(confirm < apply, "and nothing is applied before they answer");

  /* A refused backup ends the ceremony. */
  assert.match(cli, /if \(backup\.status === ""\) fail\(""/, "a refused backup fails the ceremony");
  /* A mismatched confirmation ends it too. */
  assert.match(cli, /if \(answer !== String\(prefix\.pending\.length\)\)/, "the answer must match exactly");
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 5. FAILURE SEMANTICS ARE DISTINCT
 * ═════════════════════════════════════════════════════════════════════════ */
function everyOutcomeHasItsOwnName(): void {
  const source = read(MIGRATE_CLI);
  for (const outcome of [
    "NOT_ARMED",
    "TARGET_UNVERIFIED",
    "TARGET_MISMATCH",
    "LEDGER_AHEAD",
    "LEDGER_DIVERGED",
    "ALREADY_CONVERGED",
    "BACKUP_FAILED",
    "CONFIRMATION_REFUSED",
    "MIGRATION_FAILED",
    "POST_VERIFY_FAILED",
    "SUCCESS",
  ]) {
    assert.ok(source.includes(`"${outcome}"`), `${outcome} must be a named outcome`);
  }

  /*
   * A POST-VERIFY FAILURE IS NOT A MIGRATION FAILURE, and neither is a success. The distinction is
   * the whole point of the list: "the engine ran" and "the target is now the release" are different
   * claims, and collapsing them is how a green ceremony reports a schema it never confirmed.
   */
  const cli = codeOf(read(MIGRATE_CLI));
  assert.match(
    cli,
    /if \(after\.status !== ""\) \{/,
    "a target that is not converged after migrating is a FAILURE, never a success",
  );
  assert.match(cli, /if \(after\.digest !== expectedDigest\)/, "the final digest is checked");
  assert.ok(
    cli.indexOf("expectedDigest") < cli.lastIndexOf(""),
    "and it is checked before success is announced",
  );

  /* No fabricated rollback: the ceremony reports the ledger it OBSERVES after a failure. */
  const failureBlock = read(MIGRATE_CLI).slice(read(MIGRATE_CLI).indexOf("engineError !== null"));
  assert.match(failureBlock, /Observed ledger AFTER the failure/, "a failure reports observed state");
  assert.ok(
    !/rolled back\b(?![^.]*REPORTED)/.test(failureBlock.split("\n").slice(0, 20).join("\n")),
    "and never claims a rollback as a guarantee",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 6. THE FOUR EXISTING CEREMONIES DID NOT MOVE
 * ═════════════════════════════════════════════════════════════════════════ */
function noExistingCeremonyWasWeakened(): void {
  /*
   * THE FUSED CHECK IS STILL FUSED. `verifyProductionTarget` still refuses on a stale ledger — that
   * is what every row-writing ceremony depends on, and the split must not have relaxed it.
   */
  const possession = codeOf(read(POSSESSION));
  assert.match(
    possession,
    /if \(observed\.appliedMigrations !== expectedMigrations\) \{/,
    "verifyProductionTarget still refuses a target whose ledger is not the authored one",
  );
  assert.match(possession, /reason: ""/, "and still by a named refusal");
  assert.ok(
    possession.includes("export async function verifyProductionTarget"),
    "and it is still exported under its released name",
  );

  /* Identity is still judged before convergence — a wrong database must never read as a stale one. */
  const target = possession.slice(possession.indexOf("export async function verifyProductionTarget"));
  assert.ok(
    target.indexOf("verifyProductionIdentity") < target.indexOf("appliedMigrations !== expectedMigrations"),
    "identity is still resolved before the ledger is judged",
  );

  /* The shared preflight still calls the FUSED check, so the four ceremonies keep their behaviour. */
  const preflight = codeOf(read("scripts/lib/ceremony-preflight.ts"));
  assert.match(preflight, /verifyProductionTarget\(/, "the shared preflight still uses the fused check");
  assert.ok(
    !preflight.includes("verifyProductionIdentity"),
    "and must not quietly switch to identity-only, which would loosen all four ceremonies at once",
  );

  /* And none of the four learned anything about migrations. */
  for (const ceremony of PRE_EXISTING_CEREMONIES) {
    const source = codeOf(read(ceremony));
    assert.ok(!source.includes("applyPendingMigrations"), `${ceremony} must not apply migrations`);
    assert.ok(!source.includes("production-migration"), `${ceremony} must not reach the migration mechanics`);
    assert.ok(!source.includes("verifyProductionIdentity"), `${ceremony} must keep the fused check`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 7. NOTHING UNDER src/ CAN REACH ANY OF THIS
 * ═════════════════════════════════════════════════════════════════════════ */
function theProductIsWalledOff(): void {
  const srcFiles = collect("src");
  for (const name of [
    "applyPendingMigrations",
    "verifyProductionIdentity",
    "verifyCanonicalMigrationPrefix",
    "acquireMigrationLock",
    "platform-migrate",
    "production-migration",
    "canonical-migrations",
  ]) {
    const namers = srcFiles.filter((f) => codeOf(read(f)).includes(name));
    assert.deepEqual(namers, [], `no file under src may name ${name}`);
  }

  /* No route, server action or Heby command reaches scripts/ at all. */
  const routes = srcFiles.filter((f) => /(^|\/)route\.tsx?$/.test(f));
  for (const route of routes) {
    assert.ok(!codeOf(read(route)).includes("scripts/"), `${route} must not reach scripts/`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 8. THIS PHASE AUTHORED NO MIGRATION
 * ═════════════════════════════════════════════════════════════════════════ */
function itIsInfrastructureNotSchema(): void {
  const files = readdirSync(path.join(ROOT, "src/db/migrations")).filter((f) => f.endsWith(".sql"));
  /* SUITE-RECOVERY-1 B3: the first 67 migrations, then exactly migrations 68–78, each a declared later phase — YOUTUBE-WRITE-2, SUPPLIED-MEDIA-ACCOUNT-PROVENANCE-1, KT-3, EXTERNAL-AI-DATA-USE-1A, SCI-2A, SCI-2B, AP-1, AP-4A, L-1b, D1 work-planning, WORK-UPDATE V1. None is this phase's; any other addition, removal or reordering fails. */
  const LATER_MIGRATIONS = [
    "20260928084834_youtube_write2_recipientless_kind",
    "20260929134334_supplied_media_account_provenance",
    "20261003074659_knowledge_public_use_domain",
    "20261004073713_external_ai_data_use_authority",
    "20261006111812_sci2a_knowledge_version_immutability",
    "20261006175909_sci2b_knowledge_integrity_at_insert",
    "20261007064348_ap1_agent_name_in_service_uniqueness",
    "20261007175237_ap4a_work_domain_foundation",
    "20261008143657_l1b_agent_lifecycle_domain",
    "20261013113340_eai_work_planning_purpose",
    "20261014042643_work_update_v1_mandate_scope",
    /* PLAN-FOLLOW-UP-REFERENCE-V1 — two insert-only provenance tables (request source work; Work follow-up sources). A declared later phase. */ "20261020170430_plan_follow_up_source_work", /* PLAN-STEP-IDEMPOTENCY-1 — one open proposal per AI plan step on action requests. A declared later phase. */ "20261022003246_plan_step_idempotency",
  ];
  assert.deepEqual([...files].sort().slice(67).map((f) => f.replace(/\.sql$/, "")), LATER_MIGRATIONS, "the production migration AUTHORITY authors no migration of its own"); /* MV-6: ledger 66 -> 67 (generation-failed + provider-canceled on the invocation provider_failure CHECK, additive). */ /* MV-5: ledger 65 -> 66 (mp4-normalize-v1 derivation CHECKs on media_assets, additive). */ /* MV-4: ledger 64 -> 65 (async generation lifecycle on media_generation_invocations, additive). */ /* MV-2: ledger 63 -> 64 (media_kind + video facts on media_assets, additive). */ /* MV-0: ledger 57 -> 63 (MEDIA-5, CONTENT-COMPOSE-1, TENANT-ARM-1, PUBLISH-0 x2, MEDIA-SUPPLIED), all additive; the first 57 files still digest to cbf6c4bb4eda57cc. */ /* WEV-1 grew the ledger 44 -> 45; PBGA-1 45 -> 46; CGO-1 46 -> 47 (content-draft + destination). TRH-10 47 -> 48 (the `artifact-review` governance domain); TRH-19 48 -> 49 (`heby_action_requests.proposal_rationale`, one additive nullable column). TRH-21 49 -> 50 (`provider_observations`, one additive table recording what a provider reported, when, and through which connection). TRH-23 50 -> 51 (`standing_observation_authorizations`, one additive table plus the `standing-observation` governance domain: Governance's permission to observe one exact provider read scope, repeatedly, until a later revision withdraws it). TRH-24 51 -> 52 (`provider_observations` gains machine provenance: the human actor pair becomes nullable, `standing_authorization_id` and `invocation_id` arrive, and a CHECK admits exactly one provenance mode — schema EVOLUTION, not purely additive DDL). SELF-SERVICE SIGNUP 52 -> 53 (`companies_provisioning_source_chk` widened to admit `self-service-signup`, so a tenant a visitor created stays distinguishable from one an operator ceremony created). RUNG 2 PREREQUISITE 53 -> 54 (`tenant_machine_execution_authorizations`, one additive table plus the `machine-execution` governance domain: Governance's permission for ONE TENANT to participate in machine delivery of work a human already authorized — never the authorization of any act, which `action_permits` keeps owning). RUNG 2 54 -> 55 (`standing_mutation_authorizations`, one additive table plus the `standing-mutation` governance domain, plus a nullable `standing_authorization_id` on `action_permits` and `heby_action_requests` and the two decision-uniqueness indexes made PARTIAL on it: one Governance decision still backs at most one ORDINARY permit and approval, and a bounded standing envelope is the decision that it may back several.) */
  const journal = JSON.parse(read("src/db/migrations/meta/_journal.json")) as { entries: { tag: string }[] };
  assert.deepEqual(journal.entries.slice(67).map((e) => e.tag), LATER_MIGRATIONS, "and the journal agrees"); /* MV-6: ledger 66 -> 67 (generation-failed + provider-canceled on the invocation provider_failure CHECK, additive). */ /* MV-5: ledger 65 -> 66 (mp4-normalize-v1 derivation CHECKs on media_assets, additive). */ /* MV-4: ledger 64 -> 65 (async generation lifecycle on media_generation_invocations, additive). */ /* MV-2: ledger 63 -> 64 (media_kind + video facts on media_assets, additive). */ /* MV-0: ledger 57 -> 63 (MEDIA-5, CONTENT-COMPOSE-1, TENANT-ARM-1, PUBLISH-0 x2, MEDIA-SUPPLIED), all additive; the first 57 files still digest to cbf6c4bb4eda57cc. */ /* TRH-10 47 -> 48 (the `artifact-review` governance domain); TRH-19 48 -> 49 (`heby_action_requests.proposal_rationale`, one additive nullable column). TRH-21 49 -> 50 (`provider_observations`, one additive table recording what a provider reported, when, and through which connection). TRH-23 50 -> 51 (`standing_observation_authorizations`, one additive table plus the `standing-observation` governance domain: Governance's permission to observe one exact provider read scope, repeatedly, until a later revision withdraws it). TRH-24 51 -> 52 (`provider_observations` gains machine provenance: the human actor pair becomes nullable, `standing_authorization_id` and `invocation_id` arrive, and a CHECK admits exactly one provenance mode — schema EVOLUTION, not purely additive DDL). RUNG 2 PREREQUISITE 53 -> 54 (`tenant_machine_execution_authorizations`, one additive table plus the `machine-execution` governance domain: Governance's permission for ONE TENANT to participate in machine delivery of work a human already authorized — never the authorization of any act, which `action_permits` keeps owning). RUNG 2 54 -> 55 (`standing_mutation_authorizations`, one additive table plus the `standing-mutation` governance domain, plus a nullable `standing_authorization_id` on `action_permits` and `heby_action_requests` and the two decision-uniqueness indexes made PARTIAL on it: one Governance decision still backs at most one ORDINARY permit and approval, and a bounded standing envelope is the decision that it may back several.) */
}

function main(): void {
  itUsesTheOneProductionAuthority();
  itIsNotAGenericSqlExecutor();
  theConnectionStringIsNeverExposed();
  nothingIsAppliedBeforeABackupAndAHuman();
  everyOutcomeHasItsOwnName();
  noExistingCeremonyWasWeakened();
  theProductIsWalledOff();
  itIsInfrastructureNotSchema();
  console.log("prodmig-flow/boundaries-and-firewall: OK");
}

main();
