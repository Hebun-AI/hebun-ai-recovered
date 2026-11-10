/**
 * Platform operator ceremony (P4) — OPERATOR CLI.
 *
 *   npm run operator -- grant      <target-email>
 *   npm run operator -- revoke     <target-email>
 *   npm run operator -- mfa-enroll <target-email>
 *   npm run operator -- mfa-revoke <target-email>
 *
 * THE ACTOR IS A VERIFIED HUMAN, NOT THE TERMINAL. Possession of the deployment lets this command
 * connect; it does not make anyone an actor. The person at the terminal signs in with their own email
 * and password, and — once any active operator exists — must be an active operator and enter a code
 * from their own authenticator. While no operator exists (first setup), the act runs under the
 * BOOTSTRAP rule and is audited as such. First setup order: `mfa-enroll` yourself, then `grant` yourself.
 *
 * Every act needs a one-line reason and writes its audit row in the same transaction as the change.
 * Lost authenticator: `mfa-revoke`, then `mfa-enroll` again (no backup codes in v1).
 *
 * Production use is a separate Director gate each time (production key set, migration, first grant).
 */
import { createInterface } from "node:readline";
import { Client } from "pg";
import { preflight, preflightEnvironment } from "./lib/ceremony-preflight";
import { resolveCeremonyPosture } from "./lib/production-possession";
import {
  OPERATOR_VERBS,
  auditRefusal,
  beginMfaEnrollment,
  completeMfaEnrollment,
  findIdentityByEmail,
  grantOperator,
  operatorDbFromClient,
  revokeMfa,
  revokeOperator,
  validateReason,
  verifyCeremonyActor,
  type OperatorVerb,
} from "./lib/operator-authority";
import { resolveMfaEncryptionKeys } from "../src/features/operator-mfa/mfa-verification.server";
import { otpauthUri } from "../src/features/operator-mfa/totp";

function fail(message: string): never {
  console.error(`\n  ✖ ${message}\n`);
  process.exit(1);
}

function prompt(question: string, hidden = false): Promise<string> {
  return new Promise((resolve, reject) => {
    const input = process.stdin;
    if (!input.isTTY) {
      reject(new Error("this ceremony is interactive only — run it in a terminal, never piped"));
      return;
    }
    const rl = createInterface({ input, output: process.stdout, terminal: true });
    if (hidden) {
      (rl as unknown as { _writeToOutput: (text: string) => void })._writeToOutput = () => {};
      process.stdout.write(question);
    }
    rl.question(hidden ? "" : question, (answer) => {
      if (hidden) process.stdout.write("\n");
      rl.close();
      resolve(answer.trim());
    });
  });
}

function isVerb(value: string | undefined): value is OperatorVerb {
  return OPERATOR_VERBS.includes(value as OperatorVerb);
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    fail("this ceremony refuses to run with NODE_ENV=production.");
  }
  const verb = process.argv[2]?.trim().toLowerCase();
  const targetEmail = process.argv[3]?.trim().toLowerCase();
  if (!isVerb(verb) || !targetEmail) {
    fail(`usage: npm run operator -- <${OPERATOR_VERBS.join("|")}> <target-email>`);
  }

  const posture = resolveCeremonyPosture(process.env);
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const environment = preflightEnvironment(posture, databaseUrl);
  if (environment.status === "refused") fail(environment.detail);
  const client = new Client({ connectionString: databaseUrl! });
  await client.connect();
  const ready = await preflight(client, environment.posture, { provenance: "none" });
  if (ready.status === "refused") {
    await client.end();
    fail(ready.detail);
  }

  const db = operatorDbFromClient(client);
  const keys = resolveMfaEncryptionKeys(process.env);
  try {
    const target = await findIdentityByEmail(db, targetEmail);
    if (!target) fail(`no active identity for "${targetEmail}". This ceremony never creates people.`);

    console.log("");
    console.log(`  PLATFORM OPERATOR CEREMONY — ${verb.toUpperCase()}`);
    console.log(`  target : ${target.email}`);
    console.log("");
    console.log("  Sign in as YOURSELF (the actor). The act is recorded under your identity.");
    const actorEmail = await prompt("  Your email: ");
    const actorPassword = await prompt("  Your password: ", true);
    const actorCode = await prompt("  Your authenticator code (leave empty only during first setup): ", true);
    const now = new Date();
    const verification = await verifyCeremonyActor(
      db,
      { email: actorEmail, password: actorPassword, code: actorCode || undefined },
      keys,
      now,
    );
    if (verification.status === "refused") {
      if (verification.actor) {
        await auditRefusal(db, {
          actorUserId: verification.actor.userId,
          action: verb === "grant" ? "platform.operator.grant" : verb === "revoke" ? "platform.operator.revoke" : verb === "mfa-enroll" ? "auth.mfa.enroll" : "auth.mfa.revoke",
          entityType: "auth_identity",
          entityId: target.authIdentityId,
          targetAuthIdentityId: target.authIdentityId,
          reason: "ceremony actor refused",
          refusal: verification.reason === "actor-not-operator" ? "not-operator" : "invalid-code",
          occurredAt: now,
        });
      }
      fail(`actor not verified (${verification.reason}). Nothing was changed.`);
    }
    if (verification.bootstrap) {
      console.log("\n  BOOTSTRAP: no active operator exists. This act is recorded as bootstrap.");
    }

    const reason = await prompt("  Reason (one line, required): ");
    if (!validateReason(reason)) fail("a one-line reason is required. Nothing was changed.");
    const confirmation = await prompt(`  Retype the target email to ${verb} (${target.email}): `);
    if (confirmation.toLowerCase() !== target.email.toLowerCase()) fail("the email did not match. Nothing was changed.");

    const act = { actor: verification.actor, bootstrap: verification.bootstrap, target, reason, now: new Date() };
    let outcome;
    if (verb === "grant") outcome = await grantOperator(db, act);
    else if (verb === "revoke") outcome = await revokeOperator(db, act);
    else if (verb === "mfa-revoke") outcome = await revokeMfa(db, act);
    else {
      const started = await beginMfaEnrollment(db, { target, actor: verification.actor, now: act.now }, keys);
      if (started.status === "refused") fail("the MFA key set (HEBUN_MFA_ENCRYPTION_*) is not configured. Nothing was changed.");
      console.log("");
      console.log("  Add this to the target's authenticator app. It is shown ONCE and is not stored in clear:");
      console.log(`\n    ${otpauthUri(target.email, started.secret)}\n`);
      const firstCode = await prompt("  First code from the authenticator: ", true);
      outcome = await completeMfaEnrollment(db, { ...act, now: new Date(), credentialId: started.credentialId, code: firstCode }, keys);
    }
    if (outcome.status === "refused") fail(`refused: ${outcome.reason}. Nothing was changed.`);
    console.log(`\n  ✔ ${verb} done for ${target.email}; audit row written.\n`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
