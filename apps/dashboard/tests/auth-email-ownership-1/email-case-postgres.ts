/*
 * AUTH-EMAIL-OWNERSHIP-1 — mixed-case email addresses (disposable PostgreSQL).
 *
 * The defect: signup stored `founder@x.test` for a visitor who typed `Founder@x.test`, and sign-in
 * compared the exact string, so the new account could not sign in with the address as typed (and
 * the signup action's own sign-in silently fell through to /login). Signup's duplicate check was
 * exact too, so `alice@x.test` could sign up beside a historical `Alice@x.test`.
 *
 * Proves, through the released authorities:
 *   - signup with mixed case signs in with any casing, through the SAME session service
 *   - a historical mixed-case row (never rewritten) signs in with any casing
 *   - signup refuses an address that differs from an existing human only by case
 *   - two historical humans that differ only by case: an exact match resolves to its own human, and
 *     a case-only match resolves to NOBODY (fail closed, no guessing)
 *   - nothing stored changes, and `users_email_uq` still behaves exactly as before
 */
import assert from "node:assert/strict";
import { Client } from "pg";

import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
/* Loaded FIRST on purpose: the schema barrel is the only safe entry point for `src/db/schema/*`. */
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import type { ConfiguredAuthenticationEnvironment } from "../../src/features/auth/environment/auth-environment.server";
import { issueLocalSession } from "../../src/features/auth-runtime/session-service.server";
import { findActiveLocalIdentityByEmail } from "../../src/features/auth-runtime/identity-repository.server";
import { createSelfServiceAccount } from "../../src/features/self-service-signup/create-account.server";

const NOW = new Date("2026-10-24T09:00:00.000Z");
const PASSWORD = "mixed-case-correct-password-4Qz";

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_email_case");
  await harness.createDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  const env = {
    status: "configured",
    enabled: true,
    provider: "local",
    controlPlaneDatabaseUrl: harness.dbUrl,
    sessionDigestCurrentKey: { version: 1, secret: "test-only-email-case-digest-secret-0123456789" },
  } as ConfiguredAuthenticationEnvironment;
  const signIn = (email: string, password = PASSWORD) =>
    issueLocalSession(handle.db, env, { email, password, requestId: "email-case" }, NOW);

  try {
    harness.migrateDatabase();
    await setup.connect();

    /* ═══ 1. SIGNUP WITH MIXED CASE → SIGN-IN WITH ANY CASING ═════════════════ */
    {
      const created = await createSelfServiceAccount(
        { fullName: "Ada Founder", email: "Founder@Aeo1.Test", password: PASSWORD, organizationName: "Aeo One" },
        handle.db,
      );
      assert.equal(created.status, "created");
      const stored = await setup.query<{ email: string }>(`select email from users`);
      assert.equal(stored.rows[0]!.email, "founder@aeo1.test", "signup still stores the normalized address");

      for (const typed of ["Founder@Aeo1.Test", "founder@aeo1.test", "FOUNDER@AEO1.TEST", "  Founder@Aeo1.Test "]) {
        const issued = await signIn(typed);
        assert.equal(issued.result.status, "authorized", `"${typed}" signs in — the address as the human typed it`);
      }
      const wrong = await signIn("FOUNDER@AEO1.TEST", "not-the-password-at-all-1");
      assert.equal(wrong.result.status, "unauthenticated", "casing never bypasses the password");
      assert.equal(wrong.diagnostic, "bad-password");
    }

    /* ═══ 2. A HISTORICAL MIXED-CASE ROW IS NEVER REWRITTEN, AND STILL SIGNS IN ═ */
    {
      await seedLocalIdentity(setup, {
        companyName: "Legacy",
        companySlug: "legacy",
        email: "Legacy@Old.Test",
        password: PASSWORD,
      });
      for (const typed of ["Legacy@Old.Test", "legacy@old.test", "LEGACY@OLD.TEST"]) {
        assert.equal((await signIn(typed)).result.status, "authorized", `"${typed}" reaches the historical human`);
      }
      const row = await setup.query<{ email: string }>(`select email from users where lower(email) = 'legacy@old.test'`);
      assert.deepEqual(row.rows.map((r) => r.email), ["Legacy@Old.Test"], "the stored address is untouched");

      /* Signup refuses a case-only duplicate of a historical human — previously it created a second one. */
      const dup = await createSelfServiceAccount(
        { fullName: "Imposter", email: "legacy@old.test", password: PASSWORD, organizationName: "Imposter Co" },
        handle.db,
      );
      assert.deepEqual(dup, { status: "refused", reason: "email-already-registered" });
      assert.equal(
        Number((await setup.query(`select count(*) from users where lower(email) = 'legacy@old.test'`)).rows[0].count),
        1,
        "one mailbox, one human",
      );
    }

    /* ═══ 3. TWO HISTORICAL HUMANS DIFFER ONLY BY CASE → NO GUESSING ══════════ */
    {
      const upper = await seedLocalIdentity(setup, {
        companyName: "Twin Upper",
        companySlug: "twin-upper",
        email: "Twin@X.test",
        password: PASSWORD,
      });
      const lower = await seedLocalIdentity(setup, {
        companyName: "Twin Lower",
        companySlug: "twin-lower",
        email: "twin@x.test",
        password: PASSWORD,
      });
      assert.equal((await findActiveLocalIdentityByEmail(handle.db, "Twin@X.test"))?.userId, upper.userId, "exact → its own human");
      assert.equal((await findActiveLocalIdentityByEmail(handle.db, "twin@x.test"))?.userId, lower.userId, "exact → its own human");
      assert.equal(
        await findActiveLocalIdentityByEmail(handle.db, "TWIN@X.TEST"),
        undefined,
        "a case-only match against two humans resolves to nobody",
      );
      const ambiguous = await signIn("TWIN@X.TEST");
      assert.equal(ambiguous.result.status, "unauthenticated");
      assert.equal(ambiguous.diagnostic, "no-identity", "and it is the same refusal an unknown address gets");
    }

    /* ═══ 4. DATABASE UNIQUENESS IS EXACTLY AS BEFORE ═════════════════════════ */
    {
      await assert.rejects(
        setup.query(`insert into users (email, name) values ('founder@aeo1.test', 'x')`),
        /users_email_uq/,
        "the exact-string unique index still refuses an exact duplicate",
      );
      const idx = await setup.query<{ indexdef: string }>(
        `select indexdef from pg_indexes where indexname = 'users_email_uq'`,
      );
      assert.match(idx.rows[0]!.indexdef, /\(email\)$/, "and it is still on the plain column — no index changed");
    }

    console.log("auth-email-ownership-1 email-case-postgres: PASS");
  } finally {
    await setup.end().catch(() => undefined);
    await handle.dispose?.().catch(() => undefined);
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
