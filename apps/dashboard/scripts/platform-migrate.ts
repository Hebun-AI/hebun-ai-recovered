/*
 * Production migration ceremony — THE ONE PATH THAT APPLIES CANONICAL MIGRATIONS TO A DEPLOYMENT.
 *
 *   npm run platform:migrate
 *
 * WHAT THIS IS. The act that converges a deployment's schema onto the release this checkout
 * carries. It applies committed authored migrations and nothing else — there is no argument for a
 * migration name, a file, or a statement, because an interface that can only do one thing cannot be
 * talked into doing another.
 *
 * THE ROOT OF TRUST is possession of the deployment, exactly as it is for every other ceremony:
 * `HEBUN_PRODUCTION_CEREMONY` plus the two target pins, verified against what the live cluster
 * reports about itself. This command is not a platform admin, not an operator identity, and not a
 * Governance authority. It writes no organizational row and names no actor, because there is no
 * honest actor to name.
 *
 * ── WHY IT DOES NOT USE `verifyProductionTarget` ─────────────────────────────
 *
 * That function fuses possession with convergence, and refuses when the target's applied count is
 * not already the authored count. Every ceremony that writes a row needs that. THIS ceremony exists
 * because it is false — it runs precisely when the target is behind — so it takes possession from
 * `verifyProductionIdentity` and proves the schema separately, by exact canonical prefix rather than
 * by count. See the split in `scripts/lib/production-possession.ts`. Nothing was loosened for
 * anybody else.
 *
 * ── WHAT IT MAY MUTATE, AND WHAT IT MAY NOT ──────────────────────────────────
 *
 * May: the schema, and the migration ledger. That is the entire list.
 *
 * May not: Knowledge facts or nodes, integrations, Governance decisions, permits, execution
 * attempts, provider controls, tenant lifecycle, external send. Organizational tables are counted
 * before and after and the comparison is reported, so the claim is measured rather than asserted.
 *
 * ── LOCAL POSTURE IS SUPPORTED, AND IS NOT AN AFTERTHOUGHT ───────────────────
 *
 * Run without the production signal, this migrates the local canonical database through the same
 * code path — the same prefix proof, the same lock, the same engine call. A ceremony whose rehearsal
 * takes a different route than the real thing proves only that the rehearsal works.
 */
import { createInterface } from "node:readline";
import path from "node:path";
import { Client } from "pg";
import {
  canonicalDigest,
  readCanonicalMigrations,
  verifyCanonicalMigrationPrefix,
  type CanonicalMigration,
} from "./lib/canonical-migrations";
import {
  BACKUP_ROOT,
  acquireMigrationLock,
  applyPendingMigrations,
  createValidatedBackup,
  fingerprintDrift,
  organizationalFingerprint,
  readServerVersion,
  releaseMigrationLock,
} from "./lib/production-migration";
import { preflightEnvironment } from "./lib/ceremony-preflight";
import { resolveCeremonyPosture, verifyProductionIdentity } from "./lib/production-possession";

/** Every way this ceremony can end. Named so a report can never blur two of them together. */
export const OUTCOMES = [
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
] as const;

export type Outcome = (typeof OUTCOMES)[number];

function fail(outcome: Outcome, message: string): never {
  console.error(`\n  ✖ ${outcome}\n\n  ${message}\n`);
  process.exit(1);
}

/** Read one visible line from the TTY. Not a secret — the operator must SEE what they confirm. */
function promptVisible(question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const input = process.stdin;
    /*
     * PIPED STDIN MAY NOT AUTHORIZE PRODUCTION. `yes | npm run platform:migrate` is exactly the
     * accident this refuses: a schema change to a production database is not something a shell
     * loop should be able to agree to on a human's behalf.
     */
    if (!input.isTTY) {
      reject(
        new Error(
          "this ceremony can only be confirmed interactively — run it in a terminal, never piped",
        ),
      );
      return;
    }
    const rl = createInterface({ input, output: process.stdout, terminal: true });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

const REPOSITORY_ROOT = path.join(import.meta.dirname, "..");

/** `20260826-104512`. Sorts chronologically, carries no secret, and never collides in practice. */
function stamp(now: Date): string {
  const p = (n: number, w = 2): string => String(n).padStart(w, "0");
  return (
    `${now.getUTCFullYear()}${p(now.getUTCMonth() + 1)}${p(now.getUTCDate())}` +
    `-${p(now.getUTCHours())}${p(now.getUTCMinutes())}${p(now.getUTCSeconds())}`
  );
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    fail(
      "NOT_ARMED",
      "this ceremony is development-only and refuses to run with NODE_ENV=production. That asks " +
        "whether THIS PROCESS is a production runtime, which is a different question from which " +
        "DATABASE is targeted — a ceremony belongs on an operator terminal in either posture.",
    );
  }

  if (process.argv.length > 2) {
    fail(
      "NOT_ARMED",
      "this ceremony takes no arguments. It applies the pending canonical migrations and nothing " +
        "else — there is no way to name a migration, a file, or a statement, by design.",
    );
  }

  /* 1 · THE AUTHORED LEDGER. Read before a connection is spent, so a repository defect costs none. */
  let canonical: readonly CanonicalMigration[];
  try {
    canonical = readCanonicalMigrations();
  } catch (error) {
    fail("TARGET_UNVERIFIED", error instanceof Error ? error.message : String(error));
  }

  /* 2 · POSTURE. Absent signal is local; the exact signal opens production; anything else refuses. */
  const posture = resolveCeremonyPosture(process.env);
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const environment = preflightEnvironment(posture, databaseUrl);
  if (environment.status === "refused") fail("NOT_ARMED", environment.detail);

  const client = new Client({ connectionString: databaseUrl! });
  await client.connect();

  let locked = false;
  try {
    /*
     * 3 · POSSESSION. In production posture this proves the live cluster is the pinned one before
     * anything else is read. In local posture the released local guard already proved loopback.
     */
    let observedIdentity = "LOCAL deployment possession";
    if (environment.posture.mode === "production") {
      const identity = await verifyProductionIdentity(client, environment.posture.expected);
      if (identity.status === "refused") {
        fail(identity.reason === "ledger-unreadable" ? "TARGET_UNVERIFIED" : "TARGET_MISMATCH", identity.detail);
      }
      observedIdentity =
        `cluster ${identity.observed.systemIdentifier}, database ${identity.observed.database}`;
    }

    /*
     * 4 · SERIALIZE. Taken before the prefix is read, so a second operator cannot preflight against
     * a database the first one is already migrating.
     */
    locked = await acquireMigrationLock(client);
    if (!locked) {
      fail(
        "MIGRATION_FAILED",
        "another migration ceremony holds the advisory lock on this database. Nothing was read " +
          "further and nothing was applied. Wait for it to finish, then re-run.",
      );
    }

    /* 5 · THE SCHEMA HISTORY. An exact canonical prefix, by hash — never a count. */
    const prefix = await verifyCanonicalMigrationPrefix(client, canonical);
    if (prefix.status === "refused") {
      fail(
        prefix.reason === "ledger-ahead"
          ? "LEDGER_AHEAD"
          : prefix.reason === "ledger-diverged"
            ? "LEDGER_DIVERGED"
            : "TARGET_UNVERIFIED",
        prefix.detail,
      );
    }

    if (prefix.status === "converged") {
      console.log("");
      console.log("  ✔ ALREADY_CONVERGED");
      console.log("");
      console.log(`    target     : ${observedIdentity}`);
      console.log(`    applied    : ${prefix.applied} of ${canonical.length} canonical migrations`);
      console.log(`    digest     : ${prefix.digest}`);
      console.log("");
      console.log("    The target's history is exactly this release's. Nothing was applied,");
      console.log("    no backup was taken, and no confirmation was asked for.");
      console.log("");
      return;
    }

    /*
     * 5b · THE TARGET'S SERVER VERSION, ESTABLISHED OR REFUSED.
     *
     * This used to read `rows[0].v` from a query whose column is `server_version`, so the value was
     * `undefined`, the banner printed `PostgreSQL undefined`, and the pg_dump compatibility gate it
     * feeds was inert. A generic on `client.query` renames no column — it only asserts a shape
     * nobody checks. Now the read and the parse live in the mechanics, and a target that will not
     * report a usable version is TARGET_UNVERIFIED: a fact about the target could not be
     * established, so nothing is backed up, nothing is confirmed, and nothing is applied.
     */
    const server = await readServerVersion(client);
    if (server.status === "refused") {
      fail(
        "TARGET_UNVERIFIED",
        `${server.detail}\n\n  pg_dump compatibility cannot be established without it, so no ` +
          "backup was attempted and nothing was migrated.",
      );
    }
    const serverVersion = server.version;

    /* 6 · BASELINE, before any mutation. */
    const before = await organizationalFingerprint(client);

    /*
     * 7 · BACKUP, BEFORE THE PROMPT. An operator must not be asked to confirm a migration whose
     * backup is going to fail; a refusal costs nothing at this point and everything after it.
     */
    const backup = createValidatedBackup({
      connectionString: databaseUrl!,
      serverVersion,
      directory: BACKUP_ROOT,
      filename: `hebun_${environment.posture.mode}_pre_migration_${stamp(new Date())}.dump`,
      repositoryRoot: REPOSITORY_ROOT,
    });
    if (backup.status === "refused") fail("BACKUP_FAILED", backup.detail);

    /* 8 · CONFIRMATION. Safe facts only — no connection string, no credential, no row content. */
    console.log("");
    console.log("  PRODUCTION MIGRATION CEREMONY");
    console.log("");
    console.log(`  posture    : ${environment.posture.mode.toUpperCase()}`);
    console.log(`  target     : ${observedIdentity}`);
    console.log(`  server     : PostgreSQL ${serverVersion.raw} (major ${serverVersion.major})`);
    console.log(`  applied    : ${prefix.applied}`);
    console.log(`  canonical  : ${canonical.length}`);
    console.log(`  prefix     : verified exact by per-migration sha256`);
    console.log("");
    console.log(`  pending (${prefix.pending.length}):`);
    for (const m of prefix.pending) console.log(`    ${String(m.index).padStart(3)}  ${m.tag}`);
    console.log("");
    console.log(`  final digest : ${prefix.finalDigest}`);
    console.log(`  backup       : ${backup.file}`);
    console.log(`                 ${backup.bytes} bytes, ${backup.entries} archive entries, pg_restore -l OK`);
    console.log("");
    console.log("  This applies schema changes and migration-ledger rows. It writes no");
    console.log("  organizational row: Knowledge, Governance, integrations, permits, execution");
    console.log("  attempts and provider controls are counted before and after and compared.");
    console.log("");
    console.log("  The whole pending set runs in ONE transaction — all of it applies, or none.");
    console.log("");

    const answer = await promptVisible(`  Type the number of pending migrations to apply (${prefix.pending.length}): `);
    if (answer !== String(prefix.pending.length)) {
      fail("CONFIRMATION_REFUSED", "the confirmation did not match. Nothing was applied.");
    }

    /* 9 · APPLY, through the canonical engine and over this verified connection. */
    let engineError: string | null = null;
    try {
      await applyPendingMigrations(client);
    } catch (error) {
      engineError = error instanceof Error ? error.message : String(error);
    }

    /*
     * 10 · RE-READ, WHATEVER HAPPENED. The observed ledger is the truth, including after a failure:
     * this reports what the database says rather than claiming a rollback it did not perform.
     */
    const after = await verifyCanonicalMigrationPrefix(client, canonical);
    const appliedNow = after.status === "refused" ? (after.applied ?? -1) : after.applied;

    if (engineError !== null) {
      fail(
        "MIGRATION_FAILED",
        `the migration engine failed: ${engineError}\n\n  ` +
          `Observed ledger AFTER the failure: ${appliedNow} applied of ${canonical.length} ` +
          `canonical (it was ${prefix.applied} before).\n  ` +
          (appliedNow === prefix.applied
            ? "That is unchanged, which is consistent with the engine's single transaction " +
              "rolling back — but it is REPORTED as an observation, not claimed as a guarantee."
            : "THAT MOVED. Investigate before re-running; do not assume a clean rollback.") +
          `\n  The backup is at ${backup.file}.`,
      );
    }

    /* 11 · POST-VERIFY. Identity again, then the ledger, then the digest. */
    if (environment.posture.mode === "production") {
      const identityAgain = await verifyProductionIdentity(client, environment.posture.expected);
      if (identityAgain.status === "refused") {
        fail("POST_VERIFY_FAILED", `after migrating, the target no longer verifies: ${identityAgain.detail}`);
      }
    }
    if (after.status !== "converged") {
      fail(
        "POST_VERIFY_FAILED",
        `after migrating, the target is still not converged (${appliedNow} of ${canonical.length}). ` +
          (after.status === "refused" ? after.detail : "") +
          ` The backup is at ${backup.file}.`,
      );
    }
    const expectedDigest = canonicalDigest(canonical);
    if (after.digest !== expectedDigest) {
      fail(
        "POST_VERIFY_FAILED",
        `the target's ledger digest is ${after.digest} and this release's is ${expectedDigest}.`,
      );
    }

    /* 12 · ORGANIZATIONAL NON-MUTATION, measured. */
    const drift = fingerprintDrift(before, await organizationalFingerprint(client));

    console.log("");
    console.log("  ✔ SUCCESS");
    console.log("");
    console.log(`    target     : ${observedIdentity}`);
    console.log(`    ledger     : ${prefix.applied} → ${after.applied}`);
    console.log(`    digest     : ${after.digest}`);
    console.log(`    applied    : ${prefix.pending.map((m) => m.tag).join(", ")}`);
    console.log(`    backup     : ${backup.file}`);
    console.log("");
    if (drift.length === 0) {
      console.log("    organizational data: UNCHANGED across every counted table");
    } else {
      console.log("    ⚠ ORGANIZATIONAL DATA MOVED — a schema ceremony must not do this:");
      for (const d of drift) console.log(`      ${d.table}: ${d.before} → ${d.after}`);
    }
    console.log("");
    console.log("    Schema converged. This is NOT application acceptance: no product capability");
    console.log("    has been exercised against this deployment by this ceremony.");
    console.log("");

    if (drift.length > 0) process.exitCode = 1;
  } finally {
    if (locked) await releaseMigrationLock(client);
    await client.end();
  }
}

main().catch((error) => {
  fail("MIGRATION_FAILED", error instanceof Error ? error.message : String(error));
});
