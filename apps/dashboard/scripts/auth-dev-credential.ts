/*
 * Development credential provisioning (D1.1) — LOCAL OPERATOR CLI.
 *
 *   npm run auth:dev-credential -- <identity-email>
 *
 * WHAT THIS IS. D1 correctly removed "type an email and become that person",
 * which left existing development identities unable to sign in at all: they hold
 * no credential. This closes that gap the only legitimate way — it provisions a
 * REAL D1 credential using the SAME production hasher the login path verifies
 * with. It is not a bypass and must never become one.
 *
 * WHAT IT DELIBERATELY CANNOT DO:
 *   - mint a session (it never touches user_session_contexts or any cookie)
 *   - create or change a membership, role, or tenant
 *   - authenticate anybody (it writes a credential; login still verifies it)
 *   - run in production, or against a non-local database (both refused)
 *   - accept a password from a file, an argument, or durable config
 *
 * The password is read from an interactive hidden prompt, kept in memory only, and
 * never written to disk, logs, argv, or the environment. There is deliberately no
 * HEBUN_DEV_PASSWORD variable: a password that lives in config is a password that
 * eventually gets committed.
 *
 * The provisioning logic lives in ./lib/provision-dev-credential.ts so a real
 * database can prove its semantics; this file is the guards and the prompt.
 */
import { createInterface } from "node:readline";
import { Client } from "pg";
import {
  MIN_DEV_PASSWORD_LENGTH,
  assertLocalDatabaseUrl,
  findActiveIdentityByEmail,
  hasActiveCredential,
  provisionDevCredential,
} from "./lib/provision-dev-credential";

function fail(message: string): never {
  console.error(`\n  ✖ ${message}\n`);
  process.exit(1);
}

/** Read a line from the TTY without echoing it. No dependency, no temp file. */
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
    // Suppress the echo of everything typed at the prompt.
    (rl as unknown as { _writeToOutput: (text: string) => void })._writeToOutput =
      () => {};
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
    fail("this tool is development-only and refuses to run with NODE_ENV=production.");
  }

  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) fail("usage: npm run auth:dev-credential -- <identity-email>");

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    fail("DATABASE_URL is not set. Point it at your local Hebun development database.");
  }
  try {
    assertLocalDatabaseUrl(databaseUrl);
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const identity = await findActiveIdentityByEmail(client, email);
    if (!identity) {
      fail(
        `no active local identity found for "${email}". This tool provisions a ` +
          "credential for an identity that already exists; it does not create people.",
      );
    }

    const rotating = await hasActiveCredential(client, identity.authIdentityId);
    console.log("");
    console.log(`  identity : ${email}`);
    console.log(`  provider : ${identity.provider}`);
    console.log(
      `  action   : ${rotating ? "ROTATE the existing credential" : "CREATE a new credential"}`,
    );
    console.log("");

    const password = await promptHidden(
      `  New development password (min ${MIN_DEV_PASSWORD_LENGTH} chars): `,
    );
    const confirmation = await promptHidden("  Confirm password: ");
    if (password !== confirmation) {
      fail("the two entries did not match. Nothing was changed.");
    }

    const result = await provisionDevCredential(client, identity, password);

    console.log("");
    console.log(`  ✔ credential ${result.action} for ${email}`);
    console.log(`    algorithm : ${result.algorithm}`);
    console.log("    status    : active");
    console.log("");
    console.log("    No session was created. Sign in normally at /login.");
    console.log("");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  // Only the message — never a stack trace that could carry the password.
  fail(error instanceof Error ? error.message : String(error));
});
