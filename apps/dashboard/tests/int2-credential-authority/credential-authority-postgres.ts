/*
 * INT-2 — THE CREDENTIAL AUTHORITY, AGAINST A REAL POSTGRES DATABASE.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "A tenant's secret can be stored, scoped-decrypted, replaced, revoked and destroyed; one
 *    tenant's credential is unreachable from another's session by THREE independent mechanisms;
 *    replacement is atomic under injected failure; and none of it ever produces `connected`."
 *
 * Disposable database, dropped on exit. Canonical is never opened.
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { Client } from "pg";
// Loaded FIRST: the schema barrel is the only safe entry point for src/db/schema/*.
import { createControlPlaneDb } from "../../src/db/client.server";
import {
  destroyCredential,
  hasLiveCredential,
  listCredentialMetadata,
  replaceCredential,
  revokeCredential,
  storeCredential,
  withDecryptedSecret,
} from "../../src/features/integration-credentials/credential-repository.server";
import { rotateIntegrationEncryptionKey, countRowsOnKey } from "../../src/features/integration-credentials/rotate-encryption-key.server";
import { resolveIntegrationEncryptionKeys, INTEGRATION_ENCRYPTION_ENV_KEYS } from "../../src/features/secret-encryption/key-registry.server";
import { createConnection } from "../../src/features/integration-authority/integration-repository.server";
import { verifyConnection } from "../../src/features/integration-authority/verify-connection.server";
import {
  I1_PRODUCIBLE_STATES,
  NO_CREDENTIAL_AUTHORITY,
  NO_PROVIDER_VERIFIER,
  type ConnectionDefinition,
  type ProviderCatalog,
} from "../../src/features/integration-authority/contracts";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const TENANT_A = "10000000-0000-4000-8000-00000000c101";
const TENANT_B = "10000000-0000-4000-8000-00000000c102";
const ACTOR_A = "20000000-0000-4000-8000-00000000c201";
const ACTOR_B = "20000000-0000-4000-8000-00000000c202";
const NOW = new Date("2026-08-22T12:00:00.000Z");
const ABSENT = "40000000-0000-4000-8000-0000000000ff";

/** THE FIXTURE SECRET. Its ABSENCE from logs, audit and metadata is what several checks assert. */
const SECRET_A = "int2-fixture-secret-alpha-7d21c9";
const SECRET_B = "int2-fixture-secret-beta-4f80ab";
const SECRET_REPLACED = "int2-fixture-secret-replacement-11ee";

const KEY_1 = randomBytes(32).toString("base64");
const KEY_2 = randomBytes(32).toString("base64");
const ENV_K1 = {
  [INTEGRATION_ENCRYPTION_ENV_KEYS.keys]: `k1:${KEY_1}`,
  [INTEGRATION_ENCRYPTION_ENV_KEYS.activeKeyId]: "k1",
};
const ENV_BOTH_K2_ACTIVE = {
  [INTEGRATION_ENCRYPTION_ENV_KEYS.keys]: `k1:${KEY_1},k2:${KEY_2}`,
  [INTEGRATION_ENCRYPTION_ENV_KEYS.activeKeyId]: "k2",
};

/** TEST-ONLY catalog: the RELEASED one is empty, so nothing could be connected without this. */
const CATALOG: ProviderCatalog = Object.freeze([
  Object.freeze({
    providerKey: "test-connectable",
    label: "Test Connectable Provider (test fixture only)",
    authMethod: "api_key",
    accountIdentity: "account",
    connectivity: "connectable",
    minimumScopes: Object.freeze(["test.read"]),
    capabilityScopes: Object.freeze({}),
  }) satisfies ConnectionDefinition,
]);

function tenantOf(tenantId: string, userId: string): TenantContext {
  return { tenantId, userId, requestId: "test-request" } as TenantContext;
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_int2_credentials");
  await harness.createDatabase();
  harness.migrateDatabase();

  const client = new Client({ connectionString: harness.dbUrl });
  await client.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const db = handle.db;
  const getDb = () => db;
  const deps = { getDb, now: () => NOW, env: ENV_K1 } as const;

  try {
    await client.query(`insert into companies (id, name, slug) values ($1,'Acme','acme-int2'),($2,'Globex','globex-int2')`, [
      TENANT_A,
      TENANT_B,
    ]);
    const a = tenantOf(TENANT_A, ACTOR_A);
    const b = tenantOf(TENANT_B, ACTOR_B);

    const connA = await createConnection(a, { providerKey: "test-connectable", name: "Acme" }, { getDb, now: () => NOW, catalog: CATALOG });
    assert.ok(connA.status === "created");
    const idA = connA.connection.integrationId;
    assert.equal(connA.connection.connectionState, "draft");

    const connB = await createConnection(b, { providerKey: "test-connectable", name: "Globex" }, { getDb, now: () => NOW, catalog: CATALOG });
    assert.ok(connB.status === "created");
    const idB = connB.connection.integrationId;

    /* ── 1. BEFORE ANY CREDENTIAL: VERIFICATION SAYS THERE IS NONE ──────────── */
    {
      const outcome = await verifyConnection(a, idA, { getDb, catalog: CATALOG });
      assert.deepEqual(
        outcome,
        { ok: false, reason: NO_CREDENTIAL_AUTHORITY },
        "no credential exists, so THAT is the truthful refusal",
      );
    }

    /* ── 2. STORING A SECRET PRODUCES `unverified`, NEVER `connected` ───────── */
    let credentialA: string;
    {
      const stored = await storeCredential(a, { integrationId: idA, kind: "api_key", plaintext: SECRET_A }, deps);
      assert.ok(stored.status === "stored", `store refused: ${JSON.stringify(stored)}`);
      credentialA = stored.credential.credentialId;

      assert.equal(stored.connectionState, "unverified", "a supplied secret is an UNPROVEN secret");
      assert.notEqual(stored.connectionState, "connected");

      /* The metadata a caller receives carries NOTHING that could open anything. */
      const serialized = JSON.stringify(stored.credential);
      for (const value of [SECRET_A, KEY_1]) {
        assert.ok(!serialized.includes(value), "credential metadata must not carry secret material");
      }
      /*
       * Checked as JSON KEYS, not as substrings: `"live":true` contains the letters `iv`, and a
       * substring test would have failed on the very field that says the credential is usable.
       */
      for (const field of ["ciphertext", "iv", "authTag", "auth_tag", "plaintext", "secret", "fingerprint", "material"]) {
        assert.ok(!serialized.includes(`"${field}"`), `credential metadata must not carry "${field}"`);
        assert.ok(!(field in (stored.credential as unknown as Record<string, unknown>)), `and must have no "${field}" property`);
      }
      assert.equal(stored.credential.algorithm, "aes-256-gcm");
      assert.equal(stored.credential.keyId, "k1", "the row remembers which key sealed it");
      assert.equal(stored.credential.live, true);

      /* And the row on disk holds ciphertext that is not the secret. */
      const row = await client.query<{ ciphertext: string; iv: string; auth_tag: string }>(
        `select ciphertext, iv, auth_tag from integration_credentials where id = $1`,
        [credentialA],
      );
      assert.notEqual(row.rows[0]!.ciphertext, SECRET_A);
      assert.ok(!Buffer.from(row.rows[0]!.ciphertext, "base64").toString("utf8").includes(SECRET_A));

      /* THE STATE MACHINE. `unverified` is producible by design; `connected` is not. */
      /* AMENDED BY INT-3, which added `connected` and `expired`. What INT-2 defends here is that
       * storing a credential does not REACH them — proved by the assertions above and below, not
       * by the set being short. */
      assert.deepEqual(
        [...I1_PRODUCIBLE_STATES].sort(),
        ["connected", "disconnected", "draft", "expired", "unverified"],
        "the producible set after INT-3",
      );
      assert.ok(!I1_PRODUCIBLE_STATES.includes("revoked"));

      const states = await client.query<{ connection_state: string }>(`select distinct connection_state from integrations`);
      assert.ok(
        states.rows.every((r) => r.connection_state !== "connected"),
        "nothing the runtime wrote is `connected`",
      );
    }

    /* ── 3. VERIFICATION NOW REFUSES FOR THE OTHER REASON ───────────────────── */
    {
      const outcome = await verifyConnection(a, idA, { getDb, catalog: CATALOG });
      assert.deepEqual(
        outcome,
        { ok: false, reason: NO_PROVIDER_VERIFIER },
        "a credential IS held — telling the tenant it is missing would be false",
      );
      assert.notEqual(NO_PROVIDER_VERIFIER, NO_CREDENTIAL_AUTHORITY);

      const after = await client.query<{ connection_state: string }>(
        `select connection_state from integrations where id = $1`,
        [idA],
      );
      assert.equal(after.rows[0]!.connection_state, "unverified", "and refusing wrote nothing");
    }

    /* ── 4. SCOPED DECRYPTION: THE SECRET COMES BACK, AND ONLY INSIDE ───────── */
    {
      const used = await withDecryptedSecret(a, credentialA, (secret) => {
        assert.equal(secret, SECRET_A, "the tenant's actual secret, inside the callback");
        return secret.length;
      }, deps);
      assert.ok(used.status === "used");
      assert.equal(used.value, SECRET_A.length, "the CALLBACK's result is returned");

      /* There is no arm of the result type that could carry the secret out. */
      assert.ok(!JSON.stringify(used).includes(SECRET_A), "the secret is not in the returned object");

      /* Decrypting changed NOTHING — it is not verification and not a lifecycle event. */
      const after = await client.query<{ connection_state: string }>(
        `select connection_state from integrations where id = $1`,
        [idA],
      );
      assert.equal(after.rows[0]!.connection_state, "unverified", "decrypt success is NOT connected");
    }

    /* ── 5. TENANT ISOLATION, LAYER 1: THE APPLICATION PREDICATE ────────────── */
    {
      const storedB = await storeCredential(b, { integrationId: idB, kind: "api_key", plaintext: SECRET_B }, { ...deps, now: () => NOW });
      assert.ok(storedB.status === "stored");
      const credentialB = storedB.credential.credentialId;

      /* A cannot see, open, revoke or destroy B's credential — and is told NOTHING about it. */
      const read = await withDecryptedSecret(a, credentialB, () => "reached", deps);
      assert.deepEqual(read, { status: "refused", reason: "not-found" }, "A cannot DECRYPT B's");
      const absent = await withDecryptedSecret(a, ABSENT, () => "reached", deps);
      assert.deepEqual(absent, read, "a foreign id reads EXACTLY as a nonexistent one");

      assert.deepEqual(await revokeCredential(a, credentialB, deps), { status: "refused", reason: "not-found" });
      assert.deepEqual(await destroyCredential(a, credentialB, deps), { status: "refused", reason: "not-found" });

      const listA = await listCredentialMetadata(a, idB, deps);
      assert.ok(listA.status === "read");
      assert.deepEqual(listA.credentials, [], "A cannot LIST B's connection's credentials");

      /* B's row is untouched by every one of those refusals. */
      const stillB = await withDecryptedSecret(b, credentialB, (s) => s, deps);
      assert.ok(stillB.status === "used" && stillB.value === SECRET_B);
    }

    /* ── 6. TENANT ISOLATION, LAYER 2: THE COMPOSITE FOREIGN KEY ────────────── */
    {
      /*
       * The application layer is bypassed entirely: a raw INSERT claiming B's connection under A's
       * tenant. The DATABASE refuses, so isolation does not depend on this repository being correct.
       */
      await assert.rejects(
        client.query(
          `insert into integration_credentials
             (tenant_id, integration_id, kind, algorithm, key_id, ciphertext, iv, auth_tag)
           values ($1,$2,'oauth_access','aes-256-gcm','k1','x','y','z')`,
          [TENANT_A, idB],
        ),
        /foreign key|violates/i,
        "a credential naming ANOTHER TENANT'S connection is a database error",
      );
    }

    /* ── 7. TENANT ISOLATION, LAYER 3: THE AAD ───────────────────────────────── */
    {
      /*
       * Both other layers are removed: A's own ciphertext is copied, by raw SQL, onto A's own row
       * — but relabelled as a different KIND. The FK is satisfied and the tenant predicate passes.
       * The cipher still refuses, because the AAD binds the ciphertext to (tenant, integration,
       * kind) and one third of that identity changed.
       */
      const source = await client.query<{ ciphertext: string; iv: string; auth_tag: string }>(
        `select ciphertext, iv, auth_tag from integration_credentials where id = $1`,
        [credentialA],
      );
      const smuggled = "70000000-0000-4000-8000-000000000001";
      await client.query(
        `insert into integration_credentials
           (id, tenant_id, integration_id, kind, algorithm, key_id, ciphertext, iv, auth_tag)
         values ($1,$2,$3,'oauth_access','aes-256-gcm','k1',$4,$5,$6)`,
        [smuggled, TENANT_A, idA, source.rows[0]!.ciphertext, source.rows[0]!.iv, source.rows[0]!.auth_tag],
      );

      const opened = await withDecryptedSecret(a, smuggled, () => "reached", deps);
      assert.deepEqual(
        opened,
        { status: "refused", reason: "decryption-failed" },
        "a ciphertext relabelled as another KIND does not open — the AAD is load-bearing",
      );
      await client.query(`delete from integration_credentials where id = $1`, [smuggled]);
    }

    /* ── 8. ONE LIVE CREDENTIAL PER KIND ─────────────────────────────────────── */
    {
      const second = await storeCredential(a, { integrationId: idA, kind: "api_key", plaintext: "another" }, deps);
      assert.deepEqual(
        second,
        { status: "refused", reason: "duplicate-live-credential" },
        "`store` refuses where `replace` is the operation",
      );

      /* A DIFFERENT KIND is legitimate — an access token and its refresh token coexist. */
      const refresh = await storeCredential(a, { integrationId: idA, kind: "oauth_refresh", plaintext: "refresh-fixture" }, deps);
      assert.ok(refresh.status === "stored", "a second KIND is not a duplicate");
      await revokeCredential(a, refresh.credential.credentialId, deps);
    }

    /* ── 9. ATOMIC REPLACEMENT ───────────────────────────────────────────────── */
    {
      /* 9a. FAILURE AFTER THE REVOKE, BEFORE THE INSERT — the accused window, forced open. */
      const injected = replaceCredential(
        a,
        { integrationId: idA, kind: "api_key", plaintext: SECRET_REPLACED },
        { ...deps, failAfterRevokeForTest: async () => { throw new Error("injected mid-replacement failure"); } },
      );
      await assert.rejects(injected, /injected mid-replacement failure/);

      const afterFailure = await withDecryptedSecret(a, credentialA, (s) => s, deps);
      assert.ok(
        afterFailure.status === "used" && afterFailure.value === SECRET_A,
        "the OLD credential is still live and still decryptable — the rollback restored it",
      );

      /* 9b. FAILURE IN THE AUDIT WRITE — same guarantee, different step. */
      const auditFailed = replaceCredential(
        a,
        { integrationId: idA, kind: "api_key", plaintext: SECRET_REPLACED },
        { ...deps, recordEventForTest: async () => { throw new Error("injected audit failure"); } },
      );
      await assert.rejects(auditFailed, /injected audit failure/);
      const afterAudit = await withDecryptedSecret(a, credentialA, (s) => s, deps);
      assert.ok(
        afterAudit.status === "used" && afterAudit.value === SECRET_A,
        "an unauditable replacement is not a replacement — the old credential survives intact",
      );

      /* 9c. THE SUCCESSFUL REPLACEMENT. */
      const replaced = await replaceCredential(a, { integrationId: idA, kind: "api_key", plaintext: SECRET_REPLACED }, deps);
      assert.ok(replaced.status === "replaced", `replace refused: ${JSON.stringify(replaced)}`);
      assert.equal(replaced.revokedCredentialId, credentialA, "the previous row is named, not lost");
      assert.equal(replaced.connectionState, "unverified", "a new secret is an unproven secret");

      const live = await client.query<{ n: string }>(
        `select count(*) as n from integration_credentials
          where tenant_id = $1 and integration_id = $2 and kind = 'api_key'
            and revoked_at is null and destroyed_at is null`,
        [TENANT_A, idA],
      );
      assert.equal(live.rows[0]!.n, "1", "exactly ONE live credential after a replacement");

      const old = await withDecryptedSecret(a, credentialA, () => "reached", deps);
      assert.deepEqual(old, { status: "refused", reason: "credential-not-live" }, "the revoked row cannot be opened");

      const now = await withDecryptedSecret(a, replaced.credential.credentialId, (s) => s, deps);
      assert.ok(now.status === "used" && now.value === SECRET_REPLACED, "and the new one holds the new secret");
      credentialA = replaced.credential.credentialId;
    }

    /* ── 10. DESTRUCTION IS A FACT, NOT A FLAG ───────────────────────────────── */
    {
      const destroyed = await destroyCredential(a, credentialA, deps);
      assert.ok(destroyed.status === "destroyed");
      assert.equal(destroyed.credential.destroyedAt, NOW.toISOString());
      assert.ok(destroyed.credential.revokedAt, "destruction implies revocation");

      const row = await client.query<{ ciphertext: string; iv: string; auth_tag: string }>(
        `select ciphertext, iv, auth_tag from integration_credentials where id = $1`,
        [credentialA],
      );
      assert.equal(row.rows[0]!.ciphertext, "", "there is NOTHING LEFT to decrypt");
      assert.equal(row.rows[0]!.iv, "");
      assert.equal(row.rows[0]!.auth_tag, "");

      const opened = await withDecryptedSecret(a, credentialA, () => "reached", deps);
      assert.deepEqual(opened, { status: "refused", reason: "credential-not-live" });

      /* The database refuses to un-destroy it by restoring material. */
      await assert.rejects(
        client.query(`update integration_credentials set ciphertext = 'restored' where id = $1`, [credentialA]),
        /destroyed_empty_chk|violates/i,
        "a destroyed row cannot be given its ciphertext back",
      );
    }

    /* ── 11. A TERMINAL CONNECTION TAKES NO NEW SECRETS ──────────────────────── */
    {
      await client.query(`update integrations set connection_state = 'disconnected' where id = $1`, [idA]);
      const refused = await storeCredential(a, { integrationId: idA, kind: "api_key", plaintext: "post-mortem" }, deps);
      assert.deepEqual(
        refused,
        { status: "refused", reason: "connection-terminal" },
        "a disconnected connection cannot be resurrected by attaching a credential",
      );
      const state = await client.query<{ connection_state: string }>(
        `select connection_state from integrations where id = $1`,
        [idA],
      );
      assert.equal(state.rows[0]!.connection_state, "disconnected", "and the refusal wrote nothing");
    }

    /* ── 12. FAIL CLOSED WITHOUT KEYS ────────────────────────────────────────── */
    {
      const noKeys = await storeCredential(b, { integrationId: idB, kind: "oauth_access", plaintext: "x" }, { getDb, now: () => NOW, env: {} });
      assert.deepEqual(noKeys, { status: "refused", reason: "encryption-not-configured" });

      const cannotOpen = await withDecryptedSecret(b, ABSENT, () => "reached", { getDb, env: { HEBUN_INTEGRATION_ENCRYPTION_KEYS: "broken" } });
      assert.deepEqual(cannotOpen, { status: "refused", reason: "encryption-not-configured" });
    }

    /* ── 13. KEY ROTATION IS NOT CREDENTIAL REPLACEMENT ──────────────────────── */
    {
      const before = await client.query<{ id: string; kind: string; expires_at: string | null; revoked_at: string | null; key_id: string; ciphertext: string }>(
        `select id, kind, expires_at, revoked_at, key_id, ciphertext from integration_credentials
          where tenant_id = $1 and destroyed_at is null order by created_at`,
        [TENANT_B],
      );
      assert.ok(before.rowCount! > 0, "there is something to rotate");
      const target = before.rows[0]!;
      assert.equal(target.key_id, "k1");

      const keys = resolveIntegrationEncryptionKeys(ENV_BOTH_K2_ACTIVE);
      assert.ok(keys.status === "configured");

      /* 13a. A FAILURE MID-ROTATION LEAVES THE ROW READABLE UNDER ITS OLD KEY. */
      const failed = await rotateIntegrationEncryptionKey(db, keys, {
        failBeforeWriteForTest: async () => { throw new Error("injected rotation failure"); },
      });
      assert.equal(failed.countReEncrypted, 0);
      assert.equal(failed.result, "incomplete", "a rotation that moved nothing must NOT say complete");
      assert.ok(failed.failures.every((f) => f.reason === "write-failed"));

      const unchanged = await client.query<{ key_id: string; ciphertext: string }>(
        `select key_id, ciphertext from integration_credentials where id = $1`,
        [target.id],
      );
      assert.equal(unchanged.rows[0]!.key_id, "k1", "the row is untouched");
      assert.equal(unchanged.rows[0]!.ciphertext, target.ciphertext);
      const stillReadable = await withDecryptedSecret(b, target.id, (s) => s, { getDb, env: ENV_BOTH_K2_ACTIVE });
      assert.ok(stillReadable.status === "used" && stillReadable.value === SECRET_B, "and still decryptable");

      /* 13b. AN OLD ROW STILL OPENS AFTER THE ACTIVE KEY CHANGED. */
      assert.ok(stillReadable.status === "used", "an active-key switch affects NEW writes only");

      /* 13c. THE REAL ROTATION. */
      const report = await rotateIntegrationEncryptionKey(db, keys);
      assert.equal(report.destinationKeyId, "k2");
      assert.ok(report.countReEncrypted > 0);
      assert.equal(report.countRemaining, 0, "a complete rotation leaves nothing on the old key");
      assert.equal(report.result, "complete");
      assert.deepEqual(report.failures, []);
      /* The report is evidence, and evidence must not be a secret. */
      const evidence = JSON.stringify(report);
      for (const forbidden of [SECRET_A, SECRET_B, SECRET_REPLACED, KEY_1, KEY_2]) {
        assert.ok(!evidence.includes(forbidden), "the rotation report must carry no secret material");
      }

      const after = await client.query<{ id: string; kind: string; expires_at: string | null; revoked_at: string | null; key_id: string; ciphertext: string }>(
        `select id, kind, expires_at, revoked_at, key_id, ciphertext from integration_credentials where id = $1`,
        [target.id],
      );
      const moved = after.rows[0]!;
      assert.equal(moved.key_id, "k2", "the wrapping moved");
      assert.notEqual(moved.ciphertext, target.ciphertext, "and the ciphertext with it");
      /* EVERYTHING ELSE IS THE SAME ROW. */
      assert.equal(moved.id, target.id, "the credential id is unchanged");
      assert.equal(moved.kind, target.kind, "the kind is unchanged");
      assert.equal(moved.expires_at, target.expires_at, "the expiry is unchanged");
      assert.equal(moved.revoked_at, target.revoked_at, "the lifecycle is unchanged — nothing was revoked");

      const connectionAfter = await client.query<{ connection_state: string }>(
        `select connection_state from integrations where id = $1`,
        [idB],
      );
      assert.equal(
        connectionAfter.rows[0]!.connection_state,
        "unverified",
        "rotating a deployment key must NOT unverify a tenant's connection",
      );

      /* THE SAME SECRET, under the new key. The tenant's credential never changed. */
      const reread = await withDecryptedSecret(b, target.id, (s) => s, { getDb, env: ENV_BOTH_K2_ACTIVE });
      assert.ok(reread.status === "used" && reread.value === SECRET_B, "the plaintext survived rotation");

      /* 13d. THE OLD KEY MAY NOW BE REMOVED — and not one moment sooner. */
      assert.equal(
        await countRowsOnKey(db, "k1"),
        0,
        "no credential would become unreadable if the old key were removed",
      );
      assert.ok((await countRowsOnKey(db, "k2")) > 0, "and the new key is now load-bearing");

      /*
       * A DESTROYED ROW STILL NAMES ITS ORIGINAL KEY, and that must not block the key's removal:
       * its ciphertext is empty, so there is nothing the key could ever open again. The count is
       * about readability, not about references — measured here rather than asserted in prose.
       */
      const stillNaming = await client.query<{ n: string }>(
        `select count(*) as n from integration_credentials where key_id = 'k1'`,
      );
      assert.ok(
        Number(stillNaming.rows[0]!.n) > 0,
        "a destroyed row keeps the historical record of which key held it",
      );

      /* THE OPPOSITE DIRECTION: a LIVE row on the old key does block removal. */
      const blocker = await storeCredential(
        b,
        { integrationId: idB, kind: "oauth_access", plaintext: "blocker-fixture" },
        { getDb, now: () => NOW, env: ENV_K1 },
      );
      assert.ok(blocker.status === "stored" && blocker.credential.keyId === "k1");
      assert.equal(
        await countRowsOnKey(db, "k1"),
        1,
        "one live credential on a key is enough to refuse its removal",
      );
      await destroyCredential(b, blocker.credential.credentialId, { getDb, now: () => NOW, env: ENV_K1 });
    }

    /* ── 14. NOTHING REACHED `connected`, ANYWHERE, EVER ─────────────────────── */
    {
      const states = await client.query<{ connection_state: string; n: string }>(
        `select connection_state, count(*) as n from integrations group by connection_state`,
      );
      for (const row of states.rows) {
        assert.notEqual(row.connection_state, "connected", "INT-2 produced no connected integration");
      }
      assert.equal(await hasLiveCredential(a, idA, deps), false, "A's credential was destroyed");
      assert.equal(await hasLiveCredential(b, idB, deps), true);
    }

    /* ── 15. THE AUDIT RECORD: FOUR ACTIONS, NO SECRETS, ITS OWN ENTITY TYPE ── */
    {
      const rows = await client.query<{ action: string; entity_type: string; metadata: unknown; actor_type: string; actor_id: string }>(
        `select action, entity_type, metadata, actor_type, actor_id from audit_log where entity_type = 'integration_credential' order by occurred_at`,
      );
      assert.ok(rows.rowCount! >= 4, "every credential lifecycle act is recorded");
      const actions = new Set(rows.rows.map((r) => r.action));
      for (const expected of ["integration.credential.stored", "integration.credential.replaced", "integration.credential.revoked", "integration.credential.destroyed"]) {
        assert.ok(actions.has(expected), `expected the "${expected}" event`);
      }
      for (const row of rows.rows) {
        assert.equal(row.actor_type, "human", "every audited act has a REAL actor");
        assert.ok([ACTOR_A, ACTOR_B].includes(row.actor_id));
        const serialized = JSON.stringify(row);
        for (const value of [SECRET_A, SECRET_B, SECRET_REPLACED, KEY_1, KEY_2]) {
          assert.ok(!serialized.includes(value), "an audit row must never carry secret material");
        }
        for (const field of ["ciphertext", "authTag", "auth_tag", "fingerprint", "plaintext"]) {
          assert.ok(!serialized.includes(`"${field}"`), `an audit row must never carry "${field}"`);
        }
      }

      /* I1's released claim is untouched: still exactly two actions on `integration`. */
      const i1 = await client.query<{ action: string }>(
        `select distinct action from audit_log where entity_type = 'integration'`,
      );
      assert.deepEqual(
        i1.rows.map((r) => r.action).sort(),
        ["integration.connection.created"],
        "the credential events did NOT widen I1's entity type",
      );

      /* NO ROTATION EVENT. A terminal has no actor, and none was invented. */
      const rotation = await client.query<{ action: string }>(
        `select distinct action from audit_log where action like '%rotat%' or action like '%encryption%'`,
      );
      assert.deepEqual(
        rotation.rows.map((r) => r.action),
        [],
        "key rotation writes NO audit row — a terminal has no actor, and none was invented",
      );
      /* And no row anywhere claims a non-human actor for anything INT-2 did. */
      const nonHuman = await client.query<{ actor_type: string }>(
        `select distinct actor_type from audit_log where source = 'integration-credentials'`,
      );
      assert.deepEqual(nonHuman.rows.map((r) => r.actor_type), ["human"], "no invented system actor");
    }

    console.log("int2-credential-authority/credential-authority-postgres: all assertions passed");
  } finally {
    await client.end();
    await handle.dispose();
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
