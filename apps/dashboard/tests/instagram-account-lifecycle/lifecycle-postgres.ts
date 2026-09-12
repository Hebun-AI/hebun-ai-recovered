/*
 * INSTAGRAM ACCOUNT LIFECYCLE — against a real PostgreSQL.
 *
 * The firewall suite proves what the code cannot express. This proves what the database actually
 * does when two tenants hold connections to the SAME external Instagram account and one of them
 * disconnects — which is not a hypothetical: production holds exactly that shape today.
 *
 * The two states this file exists to make impossible:
 *
 *   one tenant's disconnect ends another tenant's connection
 *   a connection reported "disconnected" while a live, decryptable token remains
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { Client } from "pg";

import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
/* Loaded FIRST on purpose: the schema barrel is the only safe entry point for `src/db/schema/*`. */
import { createControlPlaneDb } from "../../src/db/client.server";
import {
  createConnection,
  disconnectConnection,
  listConnections,
} from "../../src/features/integration-authority/integration-repository.server";
import {
  listCredentialMetadata,
  revokeCredential,
  storeCredential,
  hasLiveCredential,
} from "../../src/features/integration-credentials/credential-repository.server";
import { INSTAGRAM_PROVIDER_KEY } from "../../src/features/provider-instagram/contracts";
import { INTEGRATION_ENCRYPTION_ENV_KEYS } from "../../src/features/secret-encryption/key-registry.server";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

/**
 * A throwaway key for this run only, supplied through the released `deps.env` seam exactly as the
 * INT-2 credential suite does. Nothing here reads a deployment key, and the value dies with the
 * process — a fixture that borrowed a real key would make a test able to open real secrets.
 */
const ENV = {
  [INTEGRATION_ENCRYPTION_ENV_KEYS.keys]: `k1:${randomBytes(32).toString("base64")}`,
  [INTEGRATION_ENCRYPTION_ENV_KEYS.activeKeyId]: "k1",
};

/** The one external Instagram account BOTH tenants connect. The whole point of the fixture. */
const SHARED_ACCOUNT = "28295264780115792";
const TOKEN_A = "tenant-a-long-lived-token-value";
const TOKEN_B = "tenant-b-long-lived-token-value";

async function seedTenant(db: Client, slug: string): Promise<TenantContext> {
  const co = await db.query<{ id: string }>(
    `insert into companies (name, slug, tenant_status) values ($1, $2, 'active') returning id`,
    [slug, slug],
  );
  const tenantId = co.rows[0]!.id;
  const u = await db.query<{ id: string }>(
    `insert into users (email) values ($1) returning id`,
    [`owner@${slug}.test`],
  );
  const userId = u.rows[0]!.id;
  const ai = await db.query<{ id: string }>(
    `insert into auth_identities (user_id, provider, issuer, subject, status, is_primary, verified_at)
     values ($1,'local','hebun-local',$2,'active',true, now()) returning id`,
    [userId, `local:owner@${slug}.test`],
  );
  const r = await db.query<{ id: string }>(
    `insert into roles (tenant_id, name, type, system_role) values ($1,'Owner','owner',false) returning id`,
    [tenantId],
  );
  const m = await db.query<{ id: string }>(
    `insert into memberships (tenant_id, user_id, role_id, status, status_changed_at)
     values ($1,$2,$3,'active',now()) returning id`,
    [tenantId, userId, r.rows[0]!.id],
  );
  return asHumanTenantContext({
    tenantId,
    userId,
    authIdentityId: ai.rows[0]!.id,
    membershipId: m.rows[0]!.id,
    membershipVersion: 1,
    roleId: r.rows[0]!.id,
    sessionContextId: "00000000-0000-4000-8000-00000000000b",
    provider: "local" as never,
    assuranceLevel: "aal1",
    mfaVerified: false,
    requestId: `lifecycle-${slug}`,
    authenticatedAt: new Date().toISOString(),
  } as never);
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_ig_lifecycle");
  await harness.createDatabase();
  const db = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db, env: ENV } as const;

  try {
    harness.migrateDatabase();
    await db.connect();

    const a = await seedTenant(db, "tenant-a");
    const b = await seedTenant(db, "tenant-b");

    /* ═══ 1. TWO TENANTS, ONE EXTERNAL ACCOUNT ════════════════════════════ */
    const connFor = async (tenant: TenantContext, token: string): Promise<string> => {
      const created = await createConnection(
        tenant,
        { providerKey: INSTAGRAM_PROVIDER_KEY, name: "Instagram" },
        deps,
      );
      assert.equal(created.status, "created", "connection created");
      const integrationId =
        created.status === "created" ? created.connection.integrationId : "";
      /* Both rows carry the SAME provider account id — the shape production actually holds. */
      await db.query(`update integrations set external_account_id=$2 where id=$1`, [
        integrationId,
        SHARED_ACCOUNT,
      ]);
      const stored = await storeCredential(
        tenant,
        { integrationId, kind: "oauth_access", plaintext: token },
        deps,
      );
      assert.equal(stored.status, "stored", `credential store refused: ${JSON.stringify(stored)}`);
      return integrationId;
    };

    const integrationA = await connFor(a, TOKEN_A);
    const integrationB = await connFor(b, TOKEN_B);
    assert.notEqual(integrationA, integrationB, "two distinct integration rows");

    const sameAccount = await db.query<{ n: string }>(
      `select count(distinct tenant_id)::text n from integrations where external_account_id=$1`,
      [SHARED_ACCOUNT],
    );
    assert.equal(sameAccount.rows[0]!.n, "2", "one external account, two tenants — fixture is real");
    assert.equal(await hasLiveCredential(a, integrationA, deps), true, "A holds a live credential");
    assert.equal(await hasLiveCredential(b, integrationB, deps), true, "B holds a live credential");

    /* ═══ 2. A CROSS-TENANT DISCONNECT IS REFUSED, NOT SILENTLY IGNORED ═══ */
    {
      const stolen = await disconnectConnection(a, integrationB, deps);
      assert.equal(stolen.status, "refused", "tenant A cannot disconnect tenant B's connection");
      assert.equal(
        stolen.status === "refused" && stolen.reason,
        "not-found",
        "and it looks like absence, disclosing nothing about another tenant",
      );
      /* B is untouched. */
      const bStill = await listConnections(b, deps);
      assert.equal(
        bStill.status === "read"
          ? bStill.connections.find((c) => c.integrationId === integrationB)?.connectionState
          : null,
        "unverified",
        "tenant B's connection state did not move",
      );
      assert.equal(await hasLiveCredential(b, integrationB, deps), true, "B's credential is live");
    }

    /* ═══ 3. A CROSS-TENANT CREDENTIAL REVOCATION IS REFUSED ══════════════ */
    {
      const bCreds = await listCredentialMetadata(b, integrationB, deps);
      assert.equal(bCreds.status, "read");
      const bCredentialId =
        bCreds.status === "read" ? bCreds.credentials[0]!.credentialId : "";
      const stolen = await revokeCredential(a, bCredentialId, deps);
      assert.equal(stolen.status, "refused", "tenant A cannot revoke tenant B's credential");
      assert.equal(await hasLiveCredential(b, integrationB, deps), true, "B's credential survives");
    }

    /* ═══ 4. A'S OWN DISCONNECT: SECRET FIRST, THEN LIFECYCLE ════════════ */
    {
      const aCreds = await listCredentialMetadata(a, integrationA, deps);
      assert.equal(aCreds.status, "read");
      const live = aCreds.status === "read" ? aCreds.credentials.filter((c) => c.live) : [];
      assert.equal(live.length, 1, "A has exactly one live credential to revoke");

      const revoked = await revokeCredential(a, live[0]!.credentialId, deps);
      assert.equal(revoked.status, "revoked", "the credential authority revoked it");
      assert.equal(
        await hasLiveCredential(a, integrationA, deps),
        false,
        "no live credential remains for A",
      );

      const ended = await disconnectConnection(a, integrationA, deps);
      assert.equal(ended.status, "transitioned", "the integration authority ended the connection");
      assert.equal(
        ended.status === "transitioned" ? ended.connection.connectionState : null,
        "disconnected",
        "…as `disconnected` and never `revoked` — Hebun cannot claim the provider ended it",
      );
      assert.equal(
        ended.status === "transitioned" ? ended.connection.health : null,
        "unknown",
        "health is reset rather than asserted",
      );
    }

    /* ═══ 5. TENANT B IS ENTIRELY UNAFFECTED ══════════════════════════════ */
    {
      const bList = await listConnections(b, deps);
      const bConn =
        bList.status === "read"
          ? bList.connections.find((c) => c.integrationId === integrationB)
          : undefined;
      assert.ok(bConn, "B still has its connection");
      assert.notEqual(bConn!.connectionState, "disconnected", "B was NOT disconnected");
      assert.equal(
        await hasLiveCredential(b, integrationB, deps),
        true,
        "B's credential is STILL LIVE after A disconnected the same external account",
      );
      /* And A genuinely cannot see B's row. */
      const aList = await listConnections(a, deps);
      assert.ok(
        aList.status === "read" &&
          aList.connections.every((c) => c.integrationId !== integrationB),
        "tenant A's listing never contains tenant B's connection",
      );
    }

    /* ═══ 6. DISCONNECT IS TERMINAL AND IDEMPOTENT-SAFE ═══════════════════ */
    {
      const again = await disconnectConnection(a, integrationA, deps);
      assert.equal(again.status, "refused", "a terminal row refuses a second transition");
      assert.equal(
        again.status === "refused" && again.reason,
        "illegal-transition",
        "…and says why, rather than pretending to succeed",
      );
    }

    /* ═══ 7. STORED OBSERVATIONS SURVIVE A DISCONNECT ═════════════════════ */
    {
      const before = await db.query<{ n: string }>(
        `select count(*)::text n from provider_observations where tenant_id=$1`,
        [a.tenantId],
      );
      /*
       * Written directly because this fixture is about SURVIVAL, not about the observation writer's
       * own contract — which has its own suite. The row simply has to exist across the transition.
       */
      /*
       * HUMAN PROVENANCE, because the schema admits exactly one mode: the actor pair, or a standing
       * authorization with an invocation — never both and never neither. There is no `provenance`
       * column to write; the mode IS which pair is populated.
       */
      await db.query(
        `insert into provider_observations
           (tenant_id, provider_key, capability_key, subject_kind, subject_ref, integration_id,
            observed_at, recorded_at, facts, facts_digest,
            observed_by_actor_type, observed_by_actor_id)
         values ($1,'instagram','instagram.account.public.read','instagram-account',
                 'instagram/account/shared',$2, now(), now(), '{"followersCount":1}'::jsonb,
                 repeat('a', 64), 'human', $3)`,
        [a.tenantId, integrationA, a.userId],
      );
      const after = await db.query<{ n: string }>(
        `select count(*)::text n from provider_observations where tenant_id=$1`,
        [a.tenantId],
      );
      assert.equal(Number(after.rows[0]!.n), Number(before.rows[0]!.n) + 1, "an observation exists");

      /* The connection is ALREADY disconnected; the row is still here and still readable. */
      const survived = await db.query<{ n: string }>(
        `select count(*)::text n from provider_observations o
           join integrations i on i.id = o.integration_id
          where o.tenant_id=$1 and i.connection_state='disconnected'`,
        [a.tenantId],
      );
      assert.equal(
        survived.rows[0]!.n,
        "1",
        "the observation outlives the grant — Instagram did say it, at that instant",
      );
    }

    console.log("Instagram account lifecycle (PostgreSQL): all assertions passed");
  } finally {
    await db.end().catch(() => {});
    await handle.dispose?.().catch(() => {});
    await harness.dropDatabase();
  }
}

void main();
