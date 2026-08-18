/*
 * First-human bootstrap ceremony (G5A) — DEPLOYMENT-POSSESSION CLI.
 *
 *   npm run platform:bootstrap-first-human -- <identity-email>
 *
 * WHAT THIS IS. The deliberate, out-of-band act that gives an empty deployment its first person, so
 * the ordinary authorities have somebody to act on. It is a CLI and not a product route for the
 * plainest possible reason: there is nobody to authenticate yet, so no product surface could gate it.
 *
 * THE ROOT OF TRUST — READ THIS BEFORE USING IT.
 * Authority is POSSESSION OF THE DEPLOYMENT, exactly as for R4A, R4B, G2.1, D1.1, R5.1 and G4.
 * Hebun cannot cryptographically identify the human at this terminal and does not pretend to. It is
 * NOT a platform admin, NOT a platform operator, NOT a Governance authority, and NOT the human being
 * created. The rows it writes name NO actor — `created_by` and `created_by_type` stay NULL together,
 * because a terminal is not a person.
 *
 * IT IS NOT A NEW IDENTITY AUTHORITY. Identity still owns `users` and `auth_identities`; Credential
 * still owns the password. This file is guards, a prompt, and a banner; `scripts/lib/
 * bootstrap-first-human.ts` is the orchestration, and neither contains an INSERT.
 *
 * WHAT IT DELIBERATELY CANNOT DO:
 *   - create a company, role, membership, invitation, Governance decision or Genesis nomination
 *   - mint a session or sign anybody in — the human must sign in normally at /login afterwards
 *   - create a SECOND human. If any user exists, it refuses, even with a different email
 *   - rotate, reset or repair an existing credential — that is not what "first" means
 *   - touch providers, Knowledge, actions or artifacts
 *   - accept a password from argv, a file, or the environment
 *   - run against a database it was not explicitly pointed at, by cluster identity
 *
 * There is deliberately no HEBUN_BOOTSTRAP_EMAIL and no unattended mode: a first human that config
 * can name is a first human a deployment mistake can create. The email is confirmed interactively by
 * retyping it, and the password is entered twice, hidden.
 */
import { createInterface } from "node:readline";
import { Client } from "pg";
import { createControlPlaneDb } from "../src/db/client.server";
import {
  MIN_BOOTSTRAP_PASSWORD_LENGTH,
  bootstrapFirstHuman,
  isBootstrapEmail,
  normalizeEmail,
} from "./lib/bootstrap-first-human";
import { preflight, preflightEnvironment } from "./lib/ceremony-preflight";
import { resolveCeremonyPosture } from "./lib/production-possession";

function fail(message: string): never {
  console.error(`\n  ✖ ${message}\n`);
  process.exit(1);
}

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

  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    fail("usage: npm run platform:bootstrap-first-human -- <identity-email>");
  }
  if (!isBootstrapEmail(email)) {
    fail(
      "that is not a usable email address. Nothing is rewritten for you — an address you did " +
        "not type is an address you did not confirm.",
    );
  }

  /*
   * POSTURE FIRST, before a connection is spent. Absent `HEBUN_PRODUCTION_CEREMONY` is the local
   * posture and a local database; the exact production signal requires a pinned cluster and refuses
   * a loopback URL. Anything else refuses outright and is never downgraded to local. This is G4's
   * contract, reused rather than re-implemented.
   */
  const posture = resolveCeremonyPosture(process.env);
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const environment = preflightEnvironment(posture, databaseUrl);
  if (environment.status === "refused") fail(environment.detail);

  /*
   * TARGET BINDING on a plain client, exactly as every sibling ceremony does it. The transactional
   * write below needs a Drizzle handle instead, because the Identity and Credential authorities take
   * a writer — so the target is proved on one connection and the act happens on another, and the
   * proving connection is closed first.
   */
  const probe = new Client({ connectionString: databaseUrl! });
  await probe.connect();
  let humansBefore: number;
  try {
    const ready = await preflight(probe, environment.posture, { provenance: "none" });
    if (ready.status === "refused") fail(ready.detail);
    console.log("");
    console.log("  FIRST HUMAN BOOTSTRAP CEREMONY");
    console.log("");
    console.log(`  posture    : ${ready.banner}`);
    if (ready.observed) {
      console.log(
        `  target     : cluster ${ready.observed.systemIdentifier}, database ${ready.observed.database}, ` +
          `${ready.observed.appliedMigrations} migrations applied`,
      );
    }
    const existing = await probe.query<{ n: string }>("select count(*)::text as n from users");
    humansBefore = Number(existing.rows[0]!.n);
  } finally {
    await probe.end();
  }

  /*
   * A courtesy read, reported before the operator is asked to confirm anything, so a refusal costs
   * no prompt and no password. The INVARIANT is the same question asked again under a table lock
   * inside the transaction — this number can be stale by the time it is printed and is never trusted.
   */
  if (humansBefore > 0) {
    fail(
      `this deployment already has ${humansBefore} human${humansBefore === 1 ? "" : "s"}. This ` +
        "ceremony creates the FIRST one and never a second — not with a different email, not to " +
        "repair an account, not to reset a password. Nothing was changed.",
    );
  }

  console.log(`  email      : ${normalizeEmail(email)}`);
  console.log("");
  console.log("  This creates ONE user, ONE local identity and ONE password credential.");
  console.log("  It creates no tenant, no role, no membership, no invitation, no Governance");
  console.log("  decision and no genesis nomination. It writes no audit event — a terminal has");
  console.log("  no actor to name — and it names no creator on the rows themselves.");
  console.log("");
  console.log("  The human it creates belongs NOWHERE until a tenant ceremony gives them a");
  console.log("  membership. They can sign in and will have no workspace.");
  console.log("");

  const confirmation = await promptVisible(`  Retype the email to bootstrap (${normalizeEmail(email)}): `);
  if (normalizeEmail(confirmation) !== normalizeEmail(email)) {
    fail("the email did not match. Nothing was changed.");
  }

  const password = await promptHidden(
    `  Password for this human (min ${MIN_BOOTSTRAP_PASSWORD_LENGTH} chars): `,
  );
  const passwordAgain = await promptHidden("  Confirm password: ");
  if (password !== passwordAgain) {
    fail("the two entries did not match. Nothing was changed.");
  }

  /*
   * The control-plane handle applies its OWN remote guard: a non-loopback target still requires
   * HEBUN_CONTROL_PLANE_ALLOW_REMOTE=true. Reachability and authorization stay separate, and a
   * production ceremony needs both.
   */
  const handle = createControlPlaneDb(databaseUrl!);
  try {
    const outcome = await bootstrapFirstHuman(handle.db, { email, password });

    if (outcome.status === "refused") {
      fail(
        outcome.reason === "humans-already-exist"
          ? "a human was created by something else while this ceremony was running. Nothing was " +
              "changed, and no partial human survives."
          : `refused: ${outcome.reason}. Nothing was changed.`,
      );
    }

    const { human } = outcome;
    console.log("");
    console.log(`  ✔ first human bootstrapped: ${human.email}`);
    console.log(`    user        : ${human.userId}`);
    console.log(`    identity    : ${human.authIdentityId}`);
    console.log(`    credential  : ${human.credentialId}`);
    console.log("");
    console.log("    created_by and created_by_type are NULL on both identity rows.");
    console.log("    Possession is a SOURCE, never an ACTOR.");
    console.log("");
    console.log("    No session was created. This human belongs to no tenant yet.");
    console.log("    The next ceremony is separate and explicit:");
    console.log("");
    console.log(`      npm run tenant:provision -- <slug> <display-name> ${human.email}`);
    console.log("");
  } finally {
    await handle.dispose();
  }
}

main().catch((error) => {
  // Only the message — never a stack trace, which could carry the password through a frame.
  fail(error instanceof Error ? error.message : String(error));
});
