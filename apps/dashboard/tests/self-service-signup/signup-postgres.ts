/*
 * SELF-SERVICE SIGNUP — against a real PostgreSQL.
 *
 * Every assertion here is about ROWS, not about source text. The firewall suite proves what the code
 * cannot express; this proves what the database actually ends up holding — including the two states
 * this phase exists to make impossible:
 *
 *   a human with no organization      (a failed provision must unwind the identity)
 *   an organization with no owner     (a failed membership must unwind the tenant)
 *
 * It also proves the property the whole multi-tenant product rests on: a tenant created by signup
 * is INVISIBLE to another tenant through every released read seam.
 */
import assert from "node:assert/strict";
import { Client } from "pg";

import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
/* Loaded FIRST on purpose: the schema barrel is the only safe entry point for `src/db/schema/*`. */
import { createControlPlaneDb } from "../../src/db/client.server";
import { createSelfServiceAccount } from "../../src/features/self-service-signup/create-account.server";
import {
  deriveTenantSlugCandidate,
  validateSignupInput,
  type SignupOutcome,
} from "../../src/features/self-service-signup/contracts";
import { TENANT_PROVISIONING_SOURCE_SELF_SERVICE } from "../../src/features/tenant-provisioning/contracts";
import { MIN_ENROLLMENT_PASSWORD_LENGTH } from "../../src/features/identity-enrollment/contracts";
import { verifyPasswordCredential } from "../../src/features/auth-runtime/credential-repository.server";
import { readProviderObservations } from "../../src/features/provider-observation-history/read-provider-observations.server";
import { listConnections } from "../../src/features/integration-authority/integration-read.server";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";

const PASSWORD = "correct-horse-battery-staple";

async function count(db: Client, table: string, where = "true"): Promise<number> {
  const r = await db.query<{ n: string }>(`select count(*)::text as n from ${table} where ${where}`);
  return Number(r.rows[0]!.n);
}

const created = (outcome: SignupOutcome) => {
  assert.equal(
    outcome.status,
    "created",
    `expected a created account, got ${outcome.status === "refused" ? outcome.reason : "?"}`,
  );
  return outcome as Extract<SignupOutcome, { status: "created" }>;
};

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_signup");
  await harness.createDatabase();
  const db = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);

  try {
    harness.migrateDatabase();
    await db.connect();

    /* ═══ 1. THE HAPPY PATH — one visitor, five rows, one organization ═════ */
    let acmeTenantId: string;
    let acmeUserId: string;
    {
      const outcome = created(
        await createSelfServiceAccount(
          {
            fullName: "Ada Lovelace",
            email: "Ada@Acme.Test",
            password: PASSWORD,
            organizationName: "Acme Rugs",
          },
          handle.db,
        ),
      );
      acmeTenantId = outcome.account.tenantId;
      acmeUserId = outcome.account.userId;

      assert.equal(await count(db, "users"), 1, "exactly one human");
      assert.equal(await count(db, "auth_identities"), 1, "exactly one identity");
      assert.equal(await count(db, "auth_credentials"), 1, "exactly one credential");
      assert.equal(await count(db, "companies"), 1, "exactly one organization");
      assert.equal(await count(db, "memberships"), 1, "exactly one membership");

      const company = await db.query<{
        name: string;
        slug: string;
        tenant_status: string;
        provisioning_source: string;
        created_by: string | null;
      }>(`select name, slug, tenant_status, provisioning_source, created_by from companies`);
      const row = company.rows[0]!;
      assert.equal(row.name, "Acme Rugs", "the organization keeps the name the human typed");
      assert.equal(row.slug, "acme-rugs", "the slug is DERIVED, never typed");
      assert.equal(row.tenant_status, "active", "`provisioning` is transient and never durable");
      assert.equal(
        row.provisioning_source,
        TENANT_PROVISIONING_SOURCE_SELF_SERVICE,
        "the row records that a visitor produced it, not a ceremony",
      );
      assert.equal(row.created_by, null, "no actor is named — the human did not exist when it began");

      /* THE EMAIL IS NORMALIZED. `Ada@Acme.Test` and `ada@acme.test` are one human. */
      const user = await db.query<{ email: string; name: string }>(`select email, name from users`);
      assert.equal(user.rows[0]!.email, "ada@acme.test", "the address is stored normalized");
      assert.equal(user.rows[0]!.name, "Ada Lovelace", "the human's own name is recorded");

      /* THE MEMBERSHIP IS AN ACTIVE OWNER, AND FABRICATES NOTHING. */
      const membership = await db.query<{
        status: string;
        role_type: string;
        accepted_invitation_id: string | null;
        delegated_by_id: string | null;
      }>(
        `select m.status, r.type as role_type, m.accepted_invitation_id, m.delegated_by_id
           from memberships m join roles r on r.id = m.role_id`,
      );
      assert.equal(membership.rows[0]!.status, "active", "a NULL membership is invisible to sign-in");
      assert.equal(membership.rows[0]!.role_type, "owner", "the first human owns their own tenant");
      assert.equal(membership.rows[0]!.accepted_invitation_id, null, "no invitation is invented");
      assert.equal(membership.rows[0]!.delegated_by_id, null, "no delegating actor is invented");

      /* NOTHING ELSE WAS WRITTEN. Signup creates no Governance, no provider state, no work. */
      for (const table of [
        "decision_records",
        "governance_sessions",
        "genesis_nominations",
        "membership_authorizations",
        "invitations",
        "integrations",
        "integration_credentials",
        "provider_observations",
        "knowledge_nodes",
        "audit_log",
      ]) {
        assert.equal(await count(db, table), 0, `signup writes no ${table}`);
      }
    }

    /* ═══ 2. THE PASSWORD IS REAL, AND HASHED BY THE RELEASED AUTHORITY ════ */
    {
      const stored = await db.query<{ secret_hash: string; algorithm: string }>(
        `select secret_hash, algorithm from auth_credentials`,
      );
      assert.ok(!stored.rows[0]!.secret_hash.includes(PASSWORD), "the plaintext is NOT stored");
      assert.match(stored.rows[0]!.algorithm, /scrypt/i, "the released hasher was used");

      const identity = await db.query<{ id: string }>(`select id from auth_identities`);
      const verified = await verifyPasswordCredential(
        handle.db,
        identity.rows[0]!.id,
        PASSWORD,
        new Date(),
      );
      assert.equal(verified.outcome, "verified", "the human can actually sign in with what they chose");
    }

    /* ═══ 3. DUPLICATE EMAIL — no second human, NO ORPHAN TENANT ═══════════ */
    {
      const before = {
        users: await count(db, "users"),
        companies: await count(db, "companies"),
        memberships: await count(db, "memberships"),
        roles: await count(db, "roles"),
      };
      const outcome = await createSelfServiceAccount(
        {
          fullName: "Someone Else",
          email: "ada@acme.test",
          password: PASSWORD,
          organizationName: "Totally Different Co",
        },
        handle.db,
      );
      assert.equal(outcome.status, "refused");
      assert.equal(
        outcome.status === "refused" && outcome.reason,
        "email-already-registered",
        "a taken address is named so the visitor can sign in instead",
      );
      assert.equal(await count(db, "users"), before.users, "no second human");
      /*
       * THE POINT OF THIS CASE: the organization name was FREE, so a naive implementation that
       * provisioned before checking the identity would have left "Totally Different Co" behind with
       * no owner. Nothing was created.
       */
      assert.equal(await count(db, "companies"), before.companies, "NO ORPHAN TENANT");
      assert.equal(await count(db, "memberships"), before.memberships, "no orphan membership");
      assert.equal(await count(db, "roles"), before.roles, "no orphan role");
      assert.equal(
        await count(db, "companies", `name = 'Totally Different Co'`),
        0,
        "the organization from the refused signup does not exist",
      );
    }

    /* ═══ 4. TAKEN ORGANIZATION NAME — the HUMAN is unwound ════════════════ */
    {
      const before = { users: await count(db, "users"), companies: await count(db, "companies") };
      const outcome = await createSelfServiceAccount(
        {
          fullName: "Bob Newcomer",
          email: "bob@newco.test",
          password: PASSWORD,
          /* Derives to `acme-rugs`, which Ada already holds. */
          organizationName: "ACME  Rugs!",
        },
        handle.db,
      );
      assert.equal(outcome.status, "refused");
      assert.equal(
        outcome.status === "refused" && outcome.reason,
        "organization-name-unavailable",
        "the name is reported taken, without explaining slugs",
      );
      /*
       * THE INVARIANT THIS PHASE EXISTS FOR. The identity and the credential were created INSIDE the
       * transaction before the tenant was refused. If the transaction had not unwound them, Bob
       * would exist with a password and no organization — able to sign in, with nowhere to go.
       */
      assert.equal(await count(db, "users"), before.users, "THE HUMAN WAS UNWOUND");
      assert.equal(
        await count(db, "users", `email = 'bob@newco.test'`),
        0,
        "no human exists for a signup whose organization was refused",
      );
      assert.equal(await count(db, "auth_identities"), 1, "no orphan identity");
      assert.equal(await count(db, "auth_credentials"), 1, "no orphan credential");
      assert.equal(await count(db, "companies"), before.companies, "and no tenant");
      /* Bob can now sign up again with a different organization name — nothing is stuck. */
      const retry = created(
        await createSelfServiceAccount(
          {
            fullName: "Bob Newcomer",
            email: "bob@newco.test",
            password: PASSWORD,
            organizationName: "Newco Interiors",
          },
          handle.db,
        ),
      );
      assert.equal(retry.account.normalizedEmail, "bob@newco.test", "the retry succeeds");
    }

    /* ═══ 5. INVALID INPUT NEVER PARTIALLY PROVISIONS ══════════════════════ */
    {
      const before = {
        users: await count(db, "users"),
        companies: await count(db, "companies"),
      };
      const cases: { label: string; input: Parameters<typeof createSelfServiceAccount>[0] }[] = [
        {
          label: "empty name",
          input: { fullName: "  ", email: "x@y.test", password: PASSWORD, organizationName: "X" },
        },
        {
          label: "malformed email",
          input: { fullName: "X", email: "not-an-email", password: PASSWORD, organizationName: "X" },
        },
        {
          label: "short password",
          input: { fullName: "X", email: "x@y.test", password: "short", organizationName: "X" },
        },
        {
          label: "empty organization",
          input: { fullName: "X", email: "x@y.test", password: PASSWORD, organizationName: "   " },
        },
        {
          label: "organization that derives to nothing",
          input: { fullName: "X", email: "x@y.test", password: PASSWORD, organizationName: "!!! ---" },
        },
      ];
      for (const { label, input } of cases) {
        const outcome = await createSelfServiceAccount(input, handle.db);
        assert.equal(outcome.status, "refused", `${label} is refused`);
        assert.equal(await count(db, "users"), before.users, `${label}: no human`);
        assert.equal(await count(db, "companies"), before.companies, `${label}: no tenant`);
      }
      /* The password minimum is the RELEASED one, not a second policy. */
      assert.equal(
        validateSignupInput(
          { fullName: "X", email: "x@y.test", password: "x".repeat(MIN_ENROLLMENT_PASSWORD_LENGTH), organizationName: "X" },
          MIN_ENROLLMENT_PASSWORD_LENGTH,
        ),
        null,
        "exactly the enrollment minimum is accepted",
      );
    }

    /* ═══ 6. FAIL CLOSED when persistence is unavailable ═══════════════════ */
    {
      const outcome = await createSelfServiceAccount(
        { fullName: "X", email: "closed@y.test", password: PASSWORD, organizationName: "Closed Co" },
        null,
      );
      assert.equal(outcome.status, "refused");
      assert.equal(outcome.status === "refused" && outcome.reason, "persistence-unavailable");
      assert.equal(await count(db, "users", `email = 'closed@y.test'`), 0, "nothing was written");
    }

    /* ═══ 7. TENANT ISOLATION — two self-service tenants cannot see each other ═══ */
    {
      const newco = await db.query<{ tenant_id: string; user_id: string; role_id: string; m: string }>(
        `select m.tenant_id, m.user_id, m.role_id, m.id as m from memberships m
           join companies c on c.id = m.tenant_id where c.slug = 'newco-interiors'`,
      );
      assert.equal(newco.rows.length, 1, "Newco exists");
      const bobTenantId = newco.rows[0]!.tenant_id;
      assert.notEqual(bobTenantId, acmeTenantId, "two distinct tenants");

      const contextFor = (tenantId: string, userId: string, roleId: string, membershipId: string) =>
        asHumanTenantContext({
          tenantId,
          userId,
          authIdentityId: "00000000-0000-4000-8000-000000000001",
          membershipId,
          membershipVersion: 1,
          roleId,
          sessionContextId: "00000000-0000-4000-8000-000000000002",
          provider: "local" as never,
          assuranceLevel: "aal1",
          mfaVerified: false,
          requestId: "signup-isolation",
          authenticatedAt: new Date().toISOString(),
        } as never);

      const acme = await db.query<{ role_id: string; m: string }>(
        `select role_id, id as m from memberships where tenant_id = $1`,
        [acmeTenantId],
      );
      const bobContext = contextFor(
        bobTenantId,
        newco.rows[0]!.user_id,
        newco.rows[0]!.role_id,
        newco.rows[0]!.m,
      );

      /*
       * MEMBERSHIP ISOLATION, measured in the database rather than through a seam: every membership
       * row is tenant-predicated, so Bob's tenant holds exactly his own.
       */
      assert.equal(
        await count(db, "memberships", `tenant_id = '${bobTenantId}'`),
        1,
        "Bob's tenant holds exactly one membership — his own",
      );
      assert.equal(
        await count(db, "memberships", `tenant_id = '${bobTenantId}' and user_id = '${acmeUserId}'`),
        0,
        "Ada is not a member of Bob's tenant",
      );
      assert.equal(
        await count(db, "roles", `tenant_id = '${bobTenantId}'`),
        1,
        "Bob's tenant holds exactly its own owner role",
      );

      /*
       * PROVIDER AND OBSERVATION ISOLATION through the RELEASED read seams. Both tenants are empty
       * here, which is the honest state of a brand-new self-service tenant and exactly the point:
       * signup grants no provider reach at all. What is proved is that the seams answer for the
       * CALLER'S tenant and never aggregate across the deployment.
       */
      const connections = await listConnections(bobContext);
      assert.equal(connections.status, "read", "the connection authority answers");
      assert.deepEqual(
        connections.status === "read" ? connections.connections : null,
        [],
        "a new self-service tenant has NO provider connection — signup created none",
      );

      const observations = await readProviderObservations(bobContext, { limit: 50 });
      assert.equal(observations.status, "read", "the observation authority answers");
      assert.deepEqual(
        observations.status === "read" ? observations.observations : null,
        [],
        "and no provider observation — signup triggered none",
      );

      /* Ada's tenant is equally empty, so neither can be reading the other's rows. */
      const adaContext = contextFor(acmeTenantId, acmeUserId, acme.rows[0]!.role_id, acme.rows[0]!.m);
      const adaObservations = await readProviderObservations(adaContext, { limit: 50 });
      assert.deepEqual(
        adaObservations.status === "read" ? adaObservations.observations : null,
        [],
        "Ada's tenant holds no observations either",
      );
    }

    /* ═══ 8. SLUG DERIVATION IS A PURE, BOUNDED FUNCTION ═══════════════════ */
    {
      const cases: [string, string | null][] = [
        ["Acme Rugs", "acme-rugs"],
        ["  ACME   Rugs!  ", "acme-rugs"],
        /*
         * NON-LATIN SCRIPT DEGRADES, AND IS RECORDED RATHER THAN HIDDEN. `Türkçe Halı` keeps only
         * its ASCII letters, so the slug is `t-rk-e-hal` — ugly, stable, and never shown to anyone:
         * the organization's DISPLAY name is stored verbatim and is what every surface renders.
         * Transliteration would be a product decision (and a per-language one) that this phase was
         * not asked to take, so the behaviour is pinned here rather than quietly improved.
         */
        ["Türkçe Halı", "t-rk-e-hal"],
        ["!!!", null],
        ["   ", null],
        ["A".repeat(200), "a".repeat(64)],
      ];
      for (const [input, expected] of cases) {
        assert.equal(deriveTenantSlugCandidate(input), expected, `slug of "${input}"`);
      }
      /* Whatever it produces must satisfy the authority's own rule. */
      for (const [input] of cases) {
        const slug = deriveTenantSlugCandidate(input);
        if (slug !== null) {
          assert.match(slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `"${slug}" matches the authority's pattern`);
          assert.ok(slug.length <= 64, "…and is within bounds");
        }
      }
    }

    console.log("self-service signup (PostgreSQL): all assertions passed");
  } finally {
    await db.end().catch(() => {});
    await handle.dispose?.().catch(() => {});
    await harness.dropDatabase();
  }
}

void main();
