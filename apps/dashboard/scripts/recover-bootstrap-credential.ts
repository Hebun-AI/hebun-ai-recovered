/*
 * Bootstrap credential recovery ceremony (G5A.1) — DEPLOYMENT-POSSESSION CLI.
 *
 *   npm run platform:recover-bootstrap-credential
 *
 * WHAT THIS IS. The one escape hatch for the bootstrap human's password, and only while the
 * deployment has no organization. G5A can create that human; without this, losing their password
 * before tenant zero exists would strand production with a person who can never sign in.
 *
 * IT TAKES NO ARGUMENTS. There is no email argument and no id argument, because there is nothing to
 * choose: the window requires exactly one human, and the ceremony acts on the only one there is.
 * Arbitrary targeting is unrepresentable rather than forbidden.
 *
 * THE WINDOW CLOSES PERMANENTLY. One company row and this refuses on every subsequent run, with no
 * flag, no override and no force mode anywhere in this phase. Tenant provisioning retires it.
 *
 * THE ROOT OF TRUST. Possession of the deployment, exactly as R4A, R4B, G2.1, D1.1, R5.1, G4 and
 * G5A. Not a platform admin, not an operator identity, not a Governance authority, and not the human
 * whose password is being replaced. The revoked row names NO actor.
 *
 * IT IS NOT A CREDENTIAL AUTHORITY. Credential authority revokes and writes; this file is guards, a
 * prompt and a banner, and contains no SQL, no hashing and no credential column.
 */
import { createInterface } from "node:readline";
import { Client } from "pg";
import { createControlPlaneDb } from "../src/db/client.server";
import { preflight, preflightEnvironment } from "./lib/ceremony-preflight";
import { resolveCeremonyPosture } from "./lib/production-possession";
import {
  MIN_RECOVERY_PASSWORD_LENGTH,
  recoverBootstrapCredential,
  resolveRecoveryEligibility,
  type RecoveryRefusal,
} from "./lib/recover-bootstrap-credential";

function fail(message: string): never {
  console.error(`\n  ✖ ${message}\n`);
  process.exit(1);
}

/** Why the window is shut, in the operator's words. */
const REFUSAL_TEXT: Record<RecoveryRefusal, string> = {
  "bootstrap-window-closed":
    "this deployment already has an organization. The bootstrap window is CLOSED and does not " +
    "reopen — there is no flag for this. Password changes now belong to the product, not to a " +
    "terminal. Nothing was changed.",
  "no-bootstrap-human":
    "this deployment has no human yet, so there is nothing to recover. Create the first human " +
    "with: npm run platform:bootstrap-first-human -- <identity-email>",
  "not-a-single-human":
    "this deployment has more than one human, so “the bootstrap human” no longer names " +
    "anybody in particular. This ceremony has no way to choose between them and will not guess.",
  "no-local-identity":
    "the single human holds no active local identity, so there is no password credential to " +
    "replace. Nothing was changed.",
  "confirmation-mismatch": "the email did not match the human on this deployment. Nothing was changed.",
  "password-too-short": `the password must be at least ${MIN_RECOVERY_PASSWORD_LENGTH} characters.`,
};

/** Read one VISIBLE line from the TTY. Not a secret — the operator must SEE what they confirm. */
function promptVisible(question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const input = process.stdin;
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

/** Read a line from the TTY WITHOUT echoing it. Same pattern D1.1 established. */
function promptHidden(question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const input = process.stdin;
    if (!input.isTTY) {
      reject(
        new Error(
          "a password can only be entered interactively — run this in a terminal, never piped",
        ),
      );
      return;
    }
    const rl = createInterface({ input, output: process.stdout, terminal: true });
    (rl as unknown as { _writeToOutput: (text: string) => void })._writeToOutput = () => {};
    process.stdout.write(question);
    rl.question("", (answer) => {
      process.stdout.write("\n");
      rl.close();
      resolve(answer);
    });
  });
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    fail("this ceremony runs from an operator terminal and refuses NODE_ENV=production.");
  }

  /* POSTURE AND TARGET BINDING ARE G4'S. Reused, never re-implemented. */
  const posture = resolveCeremonyPosture(process.env);
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const environment = preflightEnvironment(posture, databaseUrl);
  if (environment.status === "refused") fail(environment.detail);

  const probe = new Client({ connectionString: databaseUrl! });
  await probe.connect();
  try {
    const ready = await preflight(probe, environment.posture, { provenance: "none" });
    if (ready.status === "refused") fail(ready.detail);
    console.log("");
    console.log("  BOOTSTRAP CREDENTIAL RECOVERY CEREMONY");
    console.log("");
    console.log(`  posture    : ${ready.banner}`);
    if (ready.observed) {
      console.log(
        `  target     : cluster ${ready.observed.systemIdentifier}, database ${ready.observed.database}, ` +
          `${ready.observed.appliedMigrations} migrations applied`,
      );
    }
  } finally {
    await probe.end();
  }

  /*
   * The handle applies its own remote guard: a non-loopback target still requires
   * HEBUN_CONTROL_PLANE_ALLOW_REMOTE=true. Reachability and authorization stay separate.
   */
  const handle = createControlPlaneDb(databaseUrl!);
  try {
    /*
     * A courtesy read, so a refusal costs no prompt and no password. The INVARIANT is the same
     * question asked again under a table lock inside the transaction.
     */
    const eligibility = await resolveRecoveryEligibility(handle.db);
    console.log(`  humans     : ${eligibility.humanCount}`);
    console.log(`  companies  : ${eligibility.companyCount}`);
    if (!eligibility.eligible || !eligibility.human) {
      fail(REFUSAL_TEXT[eligibility.reason!]);
    }
    const human = eligibility.human;

    console.log("");
    console.log(`  human      : ${human.email}`);
    console.log("");
    console.log("  This REPLACES that human's password credential. The old credential is revoked");
    console.log("  and kept, and a new active one is written, in one transaction.");
    console.log("");
    console.log("  It creates no human, no identity, no tenant, no role, no membership and no");
    console.log("  Governance state; it does not change the email or the identity provider; and it");
    console.log("  writes no audit event — a terminal has no actor to name. The revoked row names");
    console.log("  no actor either.");
    console.log("");
    console.log("  This ceremony exists ONLY while no organization does. Provisioning the first");
    console.log("  tenant retires it permanently.");
    console.log("");

    const typed = await promptVisible(`  Retype the email to recover (${human.email}): `);
    if (typed.trim().toLowerCase() !== human.email.trim().toLowerCase()) {
      fail(REFUSAL_TEXT["confirmation-mismatch"]);
    }

    const password = await promptHidden(
      `  New password (min ${MIN_RECOVERY_PASSWORD_LENGTH} chars): `,
    );
    const passwordAgain = await promptHidden("  Confirm password: ");
    if (password !== passwordAgain) {
      fail("the two entries did not match. Nothing was changed.");
    }

    const outcome = await recoverBootstrapCredential(handle.db, {
      password,
      confirmEmail: typed,
    });

    if (outcome.status === "refused") {
      fail(REFUSAL_TEXT[outcome.reason]);
    }

    console.log("");
    console.log(`  ✔ credential replaced for ${outcome.human.email}`);
    console.log(`    identity    : ${outcome.human.authIdentityId}`);
    console.log(`    credential  : ${outcome.credentialId}`);
    console.log(`    revoked     : ${outcome.revokedCount}`);
    console.log("");
    console.log("    No session was created. Sign in normally at /login.");
    console.log("");
  } finally {
    await handle.dispose();
  }
}

main().catch((error) => {
  // Only the message — never a stack trace, which could carry the password through a frame.
  fail(error instanceof Error ? error.message : String(error));
});
