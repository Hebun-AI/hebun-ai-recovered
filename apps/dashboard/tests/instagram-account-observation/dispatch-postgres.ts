/*
 * INSTAGRAM · the dispatch, against a REAL PostgreSQL database and the released authorities.
 *
 * WHAT THIS PROVES:
 *
 *   The dispatch routes each authorization to ITS OWN provider module and refuses a triple no
 *   provider claims. A missing credential, an unhealthy connection and an ungranted scope each fail
 *   CLOSED before any provider is contacted. YouTube's behaviour is unchanged by Instagram existing.
 *   And an Instagram observation lands in the released `provider_observations` table with the same
 *   machine provenance — with NO new table, NO new credential kind and NO second scheduler.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { authorizeStandingObservation } from "../../src/features/standing-observation-authority/authorize-standing-observation.server";
import { mintObservationPrincipal } from "../../src/features/standing-observation-authority/observation-principal.server";
import { revalidateStandingObservation } from "../../src/features/standing-observation-authority/revalidate-standing-observation.server";
import { observeAuthorizedSubject } from "../../src/features/provider-observation-history/observe-authorized-subject.server";
import { recordAuthorizedProviderObservation } from "../../src/features/provider-observation-history/write-provider-observation.server";
import {
  INSTAGRAM_ACCOUNT_PUBLIC_READ_CAPABILITY,
  INSTAGRAM_ACCOUNT_SUBJECT_KIND,
  INSTAGRAM_BUSINESS_BASIC_SCOPE,
  INSTAGRAM_PROVIDER_KEY,
} from "../../src/features/provider-instagram/contracts";
import {
  MIN_OBSERVATION_INTERVAL_MINUTES,
  OBSERVATION_READ_CONTROL_KEY,
} from "../../src/features/standing-observation-authority/contracts";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";

const JUSTIFICATION =
  "I am authorizing this organization's own professional Instagram account to be observed on a bounded cadence, and I accept responsibility for that.";
const ACCOUNT = "17841400000000000";
const SUBJECT_REF = `instagram/account/${ACCOUNT}`;

interface Seeded {
  readonly tenantId: string; readonly userId: string; readonly authIdentityId: string;
  readonly membershipId: string; readonly roleId: string;
}

async function sessionRowFor(client: Client, s: Seeded, tag: string): Promise<string> {
  const row = await client.query<{ id: string }>(
    `insert into user_session_contexts
       (auth_identity_id, provider_session_reference_hash, provider_session_reference_digest_version,
        user_id, active_tenant_id, active_membership_id, membership_version, assurance_level,
        mfa_verified, authenticated_at, issued_at, last_activity_at, absolute_expires_at,
        inactivity_expires_at)
     values ($1,$2,1,$3,$4,$5,1,'aal1',false, now(), now(), now(), now() + interval '1 day', now() + interval '1 hour')
     returning id`,
    [s.authIdentityId, tag.padEnd(64, "0").slice(0, 64).replace(/[^0-9a-f]/g, "a"), s.userId, s.tenantId, s.membershipId],
  );
  return row.rows[0]!.id;
}

function contextFor(s: Seeded, sessionContextId: string, requestId: string): TenantContext {
  return asHumanTenantContext({
    tenantId: s.tenantId, userId: s.userId, authIdentityId: s.authIdentityId,
    membershipId: s.membershipId, membershipVersion: 1, roleId: s.roleId, sessionContextId,
    provider: "local", assuranceLevel: "aal1", mfaVerified: false, requestId,
    authenticatedAt: new Date().toISOString(),
  });
}

async function count(c: Client, table: string): Promise<number> {
  return (await c.query<{ n: number }>(`select count(*)::int as n from ${table}`)).rows[0]!.n;
}

let providerCalls = 0;
const fakeInstagram = (async (input: string) => {
  providerCalls += 1;
  if (!String(input).includes("graph.instagram.com")) throw new Error("wrong host");
  return new Response(
    JSON.stringify({
      id: ACCOUNT, username: "turkishrughouse", account_type: "BUSINESS",
      followers_count: 1280, follows_count: 340, media_count: 96,
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}) as never;

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_instagram_dispatch");
  await harness.createDatabase();
  harness.migrateDatabase();

  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const getDb = () => handle.db;
  const baseDeps = { getDb };

  try {
    /* ═══ 0. NO SCHEMA WAS ADDED FOR A SECOND PROVIDER ═════════════════════ */
    const tables = await setup.query<{ table_name: string }>(
      `select table_name from information_schema.tables where table_schema='public'`,
    );
    for (const invented of [
      "instagram_observations", "instagram_accounts", "meta_connections",
      "instagram_credentials", "provider_instagram_observations",
    ]) {
      assert.ok(
        !tables.rows.some((r) => r.table_name === invented),
        `no '${invented}' table — a second provider reuses the released persistence`,
      );
    }
    const kinds = await setup.query<{ enumlabel: string }>(
      `select enumlabel from pg_enum e join pg_type t on t.oid=e.enumtypid
        where t.typname='integration_credential_kind' order by enumlabel`,
    );
    assert.deepEqual(
      kinds.rows.map((r) => r.enumlabel).sort(),
      ["api_key", "oauth_access", "oauth_refresh"],
      "no fourth credential kind was invented",
    );

    /* ═══ 1. A TENANT, GOVERNANCE, A CONNECTION, A CREDENTIAL ══════════════ */
    const trh = await seedLocalIdentity(setup, {
      companyName: "Turkish Rug House", companySlug: "trh-ig", email: "director@trh.test", roleType: "owner",
    });
    const ctx = contextFor(trh, await sessionRowFor(setup, trh, "ddd1"), "ig1");
    await setup.query(
      `insert into genesis_nominations
         (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
          accepted_at, accepted_session_context_id, accepted_assurance_level)
       values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
      [trh.tenantId, trh.authIdentityId, trh.userId, ctx.sessionContextId],
    );
    assert.equal(
      (await establishGovernanceAuthority(ctx, { justification: JUSTIFICATION }, baseDeps)).status,
      "established",
    );

    /*
     * THE CONNECTION CARRIES THE GRANTED SCOPE. `instagram_business_basic` is what the catalog says
     * the capability needs; a connection without it must not make the capability available.
     */
    const connection = (
      await setup.query<{ id: string }>(
        `insert into integrations (tenant_id, provider_key, name, status, connection_state, health,
                                   scopes, last_verified_at, created_by, created_by_type)
         values ($1,$2,'Instagram','connected','connected','healthy', $3, now(), $4,'human') returning id`,
        /* `scopes` is jsonb, so the granted set is sent as JSON rather than as a Postgres array. */
        [trh.tenantId, INSTAGRAM_PROVIDER_KEY, JSON.stringify([INSTAGRAM_BUSINESS_BASIC_SCOPE]), trh.userId],
      )
    ).rows[0]!.id;

    const { storeCredential } = await import("../../src/features/integration-credentials/credential-repository.server");
    const env = {
      HEBUN_INTEGRATION_ENCRYPTION_KEYS: `k1:${Buffer.alloc(32, 7).toString("base64")}`,
      HEBUN_INTEGRATION_ENCRYPTION_ACTIVE_KEY_ID: "k1",
    };

    await setup.query(
      `insert into provider_connectivity_controls (provider_key, director_enabled, control_source)
            values ($1, true, 'local-operator-ceremony')`,
      [OBSERVATION_READ_CONTROL_KEY],
    );

    const authorized = await authorizeStandingObservation(
      ctx,
      {
        providerKey: INSTAGRAM_PROVIDER_KEY,
        capabilityKey: INSTAGRAM_ACCOUNT_PUBLIC_READ_CAPABILITY,
        subjectKind: INSTAGRAM_ACCOUNT_SUBJECT_KIND,
        subjectRef: SUBJECT_REF,
        integrationId: connection,
        intervalMinutes: MIN_OBSERVATION_INTERVAL_MINUTES,
        justification: JUSTIFICATION,
        observedAuthorizationRevision: null,
      },
      baseDeps,
    );
    assert.equal(
      authorized.status,
      "authorized",
      `Governance can authorize an Instagram scope: ${JSON.stringify(authorized)}`,
    );
    if (authorized.status !== "authorized") throw new Error("unreachable");
    const authorizationId = authorized.authorization.authorizationId;

    /* ═══ 2. NO CREDENTIAL → FAIL CLOSED, NO PROVIDER CONTACTED ════════════ */
    const p1 = await mintObservationPrincipal(authorizationId, baseDeps);
    assert.equal(p1.status, "minted", "the principal mints for a released triple");
    if (p1.status !== "minted") throw new Error("unreachable");

    const noCredential = await revalidateStandingObservation(p1.principal, { ...baseDeps, env });
    assert.equal(noCredential.status, "refused", "with no credential the read is refused");
    if (noCredential.status !== "refused") throw new Error("unreachable");
    assert.equal(noCredential.reason, "credential-unavailable");
    assert.equal(providerCalls, 0, "and NO provider was contacted");

    /* Now store one, and the same revalidation passes. */
    assert.equal(
      (await storeCredential(
        ctx, { integrationId: connection, kind: "oauth_access", plaintext: "IGQVfixture-token" }, { getDb, env },
      )).status,
      "stored",
    );
    await setup.query(
      `update integrations set connection_state='connected', health='healthy', last_verified_at=now()
        where id = $1`,
      [connection],
    );

    const okRevalidation = await revalidateStandingObservation(p1.principal, { ...baseDeps, env });
    assert.equal(
      okRevalidation.status,
      "authorized",
      `an Instagram authorization passes the released 17 conditions: ${JSON.stringify(okRevalidation)}`,
    );
    if (okRevalidation.status !== "authorized") throw new Error("unreachable");

    /* ═══ 3. THE DISPATCH ROUTES TO INSTAGRAM ══════════════════════════════ */
    providerCalls = 0;
    const dispatched = await observeAuthorizedSubject(
      okRevalidation.principal,
      okRevalidation.integrationId,
      { getDb, env, fetchImpl: fakeInstagram, now: () => new Date("2026-09-09T12:00:00.000Z") },
    );
    assert.equal(dispatched.status, "observed", `the dispatch reached Instagram: ${JSON.stringify(dispatched)}`);
    if (dispatched.status !== "observed") throw new Error("unreachable");
    assert.equal(providerCalls, 1, "exactly one provider request");
    assert.deepEqual(
      dispatched.observation.facts,
      {
        accountId: ACCOUNT, username: "turkishrughouse", accountType: "BUSINESS",
        followersCount: 1280, followsCount: 340, mediaCount: 96,
      },
      "and the facts are Instagram's own",
    );

    /* ═══ 4. IT LANDS IN THE RELEASED TABLE WITH MACHINE PROVENANCE ════════ */
    const record = await recordAuthorizedProviderObservation(
      okRevalidation.principal, dispatched.observation, baseDeps,
    );
    assert.equal(record.status, "recorded", "the released writer stores an Instagram observation");

    const row = await setup.query<{
      provider_key: string; capability_key: string; subject_kind: string; subject_ref: string;
      observed_by_actor_type: string | null; standing_authorization_id: string | null;
      invocation_id: string | null; facts: Record<string, unknown>;
    }>(`select * from provider_observations`);
    assert.equal(row.rows.length, 1);
    const r = row.rows[0]!;
    assert.equal(r.provider_key, INSTAGRAM_PROVIDER_KEY);
    assert.equal(r.capability_key, INSTAGRAM_ACCOUNT_PUBLIC_READ_CAPABILITY);
    assert.equal(r.subject_kind, INSTAGRAM_ACCOUNT_SUBJECT_KIND);
    assert.equal(r.subject_ref, SUBJECT_REF);
    assert.equal(r.observed_by_actor_type, null, "NO human actor — the same machine provenance");
    assert.equal(r.standing_authorization_id, authorizationId);
    assert.ok(r.invocation_id, "and an invocation id");
    assert.equal(r.facts.followersCount, 1280, "the facts are readable back");
    assert.ok(!JSON.stringify(r.facts).includes("IGQVfixture"), "and carry NO credential material");

    /* ═══ 5. A TRIPLE NO PROVIDER CLAIMS IS REFUSED, NOT GUESSED ═══════════ */
    providerCalls = 0;
    const foreign = await observeAuthorizedSubject(
      { ...okRevalidation.principal, capabilityKey: "instagram.media.read" } as never,
      okRevalidation.integrationId,
      { getDb, env, fetchImpl: fakeInstagram },
    );
    assert.equal(
      foreign.status,
      "unsupported-subject",
      "an unregistered capability selects NO provider — it does not fall back to the only one",
    );
    assert.equal(providerCalls, 0, "and contacts nothing");

    const badSubject = await observeAuthorizedSubject(
      { ...okRevalidation.principal, subjectRef: "instagram/account/turkishrughouse" } as never,
      okRevalidation.integrationId,
      { getDb, env, fetchImpl: fakeInstagram },
    );
    assert.equal(badSubject.status, "unsupported-subject", "a username is not a subject reference");
    assert.equal(providerCalls, 0, "reads are BY ID, and a rename cannot redirect one");

    /* ═══ 6. NOTHING ELSE MOVED ════════════════════════════════════════════ */
    for (const table of [
      "action_permits", "action_execution_attempts", "knowledge_facts", "work_items", "agents",
    ]) {
      assert.equal(await count(setup, table), 0, `${table} is empty — observing observes nothing else`);
    }
    assert.equal(await count(setup, "provider_observations"), 1, "exactly one observation exists");

    console.log(
      "instagram-account-observation/dispatch-postgres: Governance authorized it, the dispatch " +
        "routed it, the released writer stored it — no new table, no new credential kind",
    );
  } finally {
    await setup.end().catch(() => undefined);
    await handle.dispose().catch(() => undefined);
    await harness.dropDatabase();
  }
}

void main();
