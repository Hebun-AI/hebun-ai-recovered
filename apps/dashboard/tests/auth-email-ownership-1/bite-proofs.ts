/*
 * AUTH-EMAIL-OWNERSHIP-1 — bite-proofs.
 *
 * Each proof puts ONE defect back into the shipped source, runs the suite that should catch it, and
 * requires: the mutation applied, the suite failed, it failed for the intended reason, and the file
 * was restored byte-identical. One deliberately HARMLESS change must be ACCEPTED, which is what
 * separates "these assertions are strict" from "these assertions are brittle".
 *
 * Mutates source in place, so — per the repository's test-stability rule — it runs only in a
 * disposable worktree or scratch copy, never on a tree someone is working in.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const abs = (f: string) => path.join(ROOT, f);
const read = (f: string) => readFileSync(abs(f), "utf8");
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

const AUTHORITY = "src/features/auth-email-ownership/email-verification.server.ts";
const MAIL = "src/features/auth-email-ownership/auth-mail.server.ts";
const IDENTITY = "src/features/auth-runtime/identity-repository.server.ts";
const CONFIRM_UI = "src/components/auth/verify-email-confirm.tsx";
const GENESIS = "src/features/governance-genesis/genesis-acceptance.server.ts";
const WORDING = "src/features/auth-email-ownership/wording.ts";
const ACTIONS = "src/app/verify-email/actions.ts";

const POSTGRES = "tests/auth-email-ownership-1/ownership-postgres.ts";
const FIREWALL = "tests/auth-email-ownership-1/boundaries-and-firewall.ts";
const EMAIL_CASE = "tests/auth-email-ownership-1/email-case-postgres.ts";
const SIGNUP = "src/features/self-service-signup/create-account.server.ts";

function runSuite(suite: string): { ok: boolean; output: string } {
  const result = spawnSync(process.execPath, ["--import", "tsx", suite], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 64 * 1024 * 1024,
    timeout: 240_000,
  });
  assert.ok(!result.error, `the child run failed to execute: ${result.error?.message}`);
  return { ok: result.status === 0, output: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}

function mutate<T>(label: string, file: string, from: string, to: string, body: () => T): T {
  const original = read(file);
  const before = sha(original);
  const occurrences = original.split(from).length - 1;
  assert.equal(occurrences, 1, `${label}: the anchor must appear exactly once, found ${occurrences}`);
  try {
    writeFileSync(abs(file), original.replace(from, to), "utf8");
    assert.notEqual(sha(read(file)), before, `${label}: the mutation did not apply — the proof is vacuous`);
    return body();
  } finally {
    writeFileSync(abs(file), original, "utf8");
    assert.equal(sha(read(file)), before, `${label}: restoration was not byte-identical`);
  }
}

let bitten = 0;

function bites(label: string, file: string, suite: string, because: string, from: string, to: string): void {
  mutate(label, file, from, to, () => {
    const { ok, output } = runSuite(suite);
    assert.equal(ok, false, `${label}: the suite still passed — the guard does not bite`);
    assert.ok(
      output.includes(because),
      `${label}: failed for the wrong reason — expected ${JSON.stringify(because)}, got:\n${output.slice(-1600)}`,
    );
    bitten += 1;
  });
}

function main(): void {
  /* B1 — a link presented by ANOTHER identity's session is accepted. */
  bites(
    "session binding removed",
    AUTHORITY,
    POSTGRES,
    "different-account",
    `      if (challenge.authIdentityId !== session.authIdentityId) {`,
    `      if (false as boolean) {`,
  );

  /* B2 — a superseded link still works. */
  bites(
    "supersession ignored at consumption",
    AUTHORITY,
    POSTGRES,
    "invalid-link",
    `            isNull(authEmailChallenges.supersededAt),
            gt(authEmailChallenges.expiresAt, now),`,
    `            gt(authEmailChallenges.expiresAt, now),`,
  );

  /* B3 — an expired link still works. */
  bites(
    "expiry ignored at consumption",
    AUTHORITY,
    POSTGRES,
    "invalid-link",
    `            gt(authEmailChallenges.expiresAt, now),
            lte(authEmailChallenges.issuedAt, now),`,
    `            lte(authEmailChallenges.issuedAt, now),`,
  );

  /* B4 — no identity lock: concurrent issues stop serializing. */
  bites(
    "identity row lock removed",
    IDENTITY,
    POSTGRES,
    "concurrent issues serialize on the identity lock",
    `    .for("update", { of: authIdentities })
    .limit(1);`,
    `    .limit(1);`,
  );

  /* B5 — the token moves into a query string a server would log. */
  bites(
    "token moved into the query string",
    MAIL,
    POSTGRES,
    "the token is never in a query string a server would log",
    "/verify-email#${EMAIL_VERIFICATION_FRAGMENT_KEY}=${reference}",
    "/verify-email?${EMAIL_VERIFICATION_FRAGMENT_KEY}=${reference}",
  );

  /* B6 — a proof stops being write-once. */
  bites(
    "write-once proof removed",
    IDENTITY,
    FIREWALL,
    "a proof is write-once",
    `        isNull(authIdentities.emailOwnershipVerifiedAt),
      ),
    )
    .returning({ id: authIdentities.id });
  return updated.length === 1;`,
    `      ),
    )
    .returning({ id: authIdentities.id });
  return updated.length === 1;`,
  );

  /* B7 — opening the page presents the token without a click. */
  bites(
    "auto-submit on mount",
    CONFIRM_UI,
    FIREWALL,
    "mounting never presents the token",
    `      setPhase(token.current ? { kind: "ready" } : { kind: "missing" });`,
    `      setPhase(token.current ? { kind: "ready" } : { kind: "missing" });
      if (token.current) void confirmEmailOwnershipAction(token.current);`,
  );

  /* B8 — the fragment stays in history. */
  bites(
    "fragment left in history",
    CONFIRM_UI,
    FIREWALL,
    "mounting strips the fragment from the current history entry",
    `        window.history.replaceState(null, "", window.location.pathname);`,
    `      void 0;`,
  );

  /* B14 — the strip passes the router's own state through, so the router keeps the fragment. */
  bites(
    "router state passed through on strip",
    CONFIRM_UI,
    FIREWALL,
    "and from the router's canonical URL",
    `        window.history.replaceState(null, "", window.location.pathname);`,
    `        window.history.replaceState(window.history.state, "", window.location.pathname);`,
  );

  /* B9 — genesis checks the proof only BEFORE the update, not inside it. */
  bites(
    "proof predicate removed from the genesis UPDATE",
    GENESIS,
    FIREWALL,
    "and, in the SAME statement, on the nominee's proof",
    `            emailOwnershipProvenPredicate(
              genesisNominations.nominatedAuthIdentityId,
              provingChallengeId,
            ),`,
    ``,
  );

  /*
   * B10 — the definition of "proven" stops requiring a proof. One anchor weakens BOTH genesis guards
   * (the pre-read and the in-UPDATE predicate share it), which is the only way to reach acceptance:
   * removing either guard alone is caught by the other, and B9 proves the in-UPDATE one is present.
   */
  bites(
    "proof definition made vacuous",
    AUTHORITY,
    POSTGRES,
    "email-ownership-unproven",
    "  return sql`exists (",
    "  return sql`true or exists (",
  );

  /* B11 — the token goes back to being a positional argument the dev server-function log prints. */
  bites(
    "token passed as a positional argument",
    ACTIONS,
    FIREWALL,
    "as a form field",
    `  formData: FormData,
): Promise<EmailVerificationConfirmResult> {
  const token = formData instanceof FormData ? formData.get("token") : null;`,
    `  token: unknown,
): Promise<EmailVerificationConfirmResult> {`,
  );

  /* B12 — sign-in goes back to comparing the exact stored string. */
  bites(
    "case-sensitive sign-in lookup",
    IDENTITY,
    EMAIL_CASE,
    "signs in — the address as the human typed it",
    "        sql`lower(${users.email}) = lower(${typed})`,",
    "        eq(users.email, typed),",
  );

  /* B13 — signup's duplicate check stops seeing a case-only duplicate. */
  bites(
    "case-blind signup duplicate check removed",
    SIGNUP,
    EMAIL_CASE,
    "email-already-registered",
    "  return isEmailClaimed(db, normalizedEmail);",
    "  return normalizedEmail.length === 0;",
  );

  /* A harmless change must be ACCEPTED by both suites. */
  mutate(
    "harmless wording change",
    WORDING,
    `"Your email address is already confirmed."`,
    `"Your email address has already been confirmed."`,
    () => {
      for (const suite of [FIREWALL, POSTGRES, EMAIL_CASE]) {
        const { ok, output } = runSuite(suite);
        assert.equal(ok, true, `a harmless change was rejected by ${suite}:\n${output.slice(-1200)}`);
      }
    },
  );

  assert.equal(bitten, 14);
  console.log(`auth-email-ownership-1 bite-proofs: ${bitten}/14 bit, harmless change accepted — PASS`);
}

main();
