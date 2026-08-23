/*
 * INT-4 — TENANT ISOLATION AND REFRESH PRESERVATION, AGAINST A REAL DATABASE.
 *
 * ── THE TWO SENTENCES THIS FILE PROVES ──────────────────────────────────────
 *
 *   1. A Drive read is tenant-owned end to end. Tenant B cannot reach Tenant A's connection,
 *      credential or capability — and gets "nothing here", not "forbidden".
 *
 *   2. WHEN GOOGLE OMITS A REFRESH TOKEN, THE EXISTING ONE SURVIVES. Google returns no refresh
 *      token on an ordinary refresh, and treating that as "replace it with nothing" would destroy
 *      the tenant's only way back into their own connection. This is INT-2's invariant, and INT-4
 *      routes a second caller through it, so it is re-proved here rather than assumed.
 *
 * Google is mocked so every branch is reachable; the vault, the credential authority, the
 * connection authority and the database are REAL. Disposable database, dropped on exit.
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { Client } from "pg";
import { createControlPlaneDb } from "../../src/db/client.server";
import {
  createConnection,
  disconnectConnection,
  holdConnectionForProviderRefreshWithin,
  recordVerifiedConnectionWithin,
} from "../../src/features/integration-authority/integration-repository.server";
import {
  storeCredential,
  listCredentialMetadata,
  replaceCredential,
  replaceCredentialFromProviderRefresh,
  withDecryptedSecret,
} from "../../src/features/integration-credentials/credential-repository.server";
import { readDriveMetadata } from "../../src/features/provider-google/read-drive-metadata.server";
import { withGoogleAccessToken } from "../../src/features/provider-google/google-authorized-call.server";
import {
  GOOGLE_PROVIDER_KEY,
  GOOGLE_DRIVE_METADATA_SCOPE,
} from "../../src/features/provider-google/contracts";
import { GOOGLE_OAUTH_ENV_KEYS } from "../../src/features/provider-google/google-environment.server";
import { INTEGRATION_ENCRYPTION_ENV_KEYS } from "../../src/features/secret-encryption/key-registry.server";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const TENANT_A = "10000000-0000-4000-8000-00000000e001";
const TENANT_B = "10000000-0000-4000-8000-00000000e002";
const ACTOR_A = "20000000-0000-4000-8000-00000000e101";
const ACTOR_B = "20000000-0000-4000-8000-00000000e102";
const NOW = new Date("2026-08-23T10:00:00.000Z");

const ACCESS_TOKEN = "int4-fixture-google-access-token-a1";
const REFRESH_TOKEN = "int4-fixture-google-refresh-token-ORIGINAL";
const ROTATED_ACCESS = "int4-fixture-google-access-token-a2";

const ENV = {
  [INTEGRATION_ENCRYPTION_ENV_KEYS.keys]: `k1:${randomBytes(32).toString("base64")}`,
  [INTEGRATION_ENCRYPTION_ENV_KEYS.activeKeyId]: "k1",
  [GOOGLE_OAUTH_ENV_KEYS.clientId]: "int4-fixture.apps.googleusercontent.com",
  [GOOGLE_OAUTH_ENV_KEYS.clientSecret]: "int4-fixture-client-secret",
  [GOOGLE_OAUTH_ENV_KEYS.redirectUri]: "http://localhost:3000/api/integrations/google/callback",
  [GOOGLE_OAUTH_ENV_KEYS.stateSecret]: "int4-fixture-state-secret-0123456789abcdef",
};

const DRIVE_GRANT = Object.freeze([
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  GOOGLE_DRIVE_METADATA_SCOPE,
]);

const IDENTITY_GRANT = Object.freeze(DRIVE_GRANT.slice(0, 3));

function tenantOf(tenantId: string, userId: string): TenantContext {
  return { tenantId, userId, requestId: "test-request" } as TenantContext;
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_int4_drive");
  await harness.createDatabase();
  harness.migrateDatabase();

  const client = new Client({ connectionString: harness.dbUrl });
  await client.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const db = handle.db;
  const getDb = () => db;
  const deps = { getDb, now: () => NOW, env: ENV } as const;

  try {
    await client.query(
      `insert into companies (id, name, slug) values ($1,'Acme','acme-int4'),($2,'Globex','globex-int4')`,
      [TENANT_A, TENANT_B],
    );
    const a = tenantOf(TENANT_A, ACTOR_A);
    const b = tenantOf(TENANT_B, ACTOR_B);

    /* ── Tenant A: a connected Google account WITH the Drive scope ──────────── */
    const created = await createConnection(
      a,
      { providerKey: GOOGLE_PROVIDER_KEY, name: "Google Workspace" },
      { getDb, now: () => NOW },
    );
    assert.ok(created.status === "created");
    const idA = created.connection.integrationId;

    /*
     * THE ORDINARY RULE, ASSERTED WHERE IT FIRST APPLIES. A SUPPLIED secret demotes — here from
     * `draft` — and INT-4's correction must not weaken it. Stated at the top of the suite so a
     * mutation that removes the demotion fails on the rule itself rather than on a later symptom.
     */
    const firstSecret = await storeCredential(
      a,
      { integrationId: idA, kind: "oauth_access", plaintext: ACCESS_TOKEN },
      deps,
    );
    assert.ok(firstSecret.status === "stored");
    assert.equal(
      firstSecret.connectionState,
      "unverified",
      "a human/new-secret write still demotes a connected row — the released rule survives",
    );
    await storeCredential(a, { integrationId: idA, kind: "oauth_refresh", plaintext: REFRESH_TOKEN }, deps);

    await db.transaction(async (tx) =>
      recordVerifiedConnectionWithin(
        tx,
        a,
        idA,
        {
          externalAccountId: "104729000000000000009",
          externalAccountLabel: "director@acme.example",
          grantedScopes: [...DRIVE_GRANT],
        },
        NOW,
      ),
    );

    /* ── 1. THE CAPABILITY ANSWERS FOR ITS OWNER ───────────────────────────── */
    {
      const result = await readDriveMetadata(a, {}, {
        ...deps,
        fetchImpl: async () =>
          json(200, {
            files: [
              { id: "f1", name: "Policy.pdf", mimeType: "application/pdf", size: "10", trashed: false },
            ],
          }),
      });
      assert.equal(result.status, "read", `Tenant A should read: ${JSON.stringify(result)}`);
      if (result.status === "read") {
        assert.equal(result.listing.files.length, 1);
        assert.equal(result.listing.files[0]!.fileId, "f1");
      }
    }

    /* ── 2. TENANT B FINDS NOTHING — NOT A REFUSAL THAT LEAKS ──────────────── */
    {
      let googleWasCalled = false;
      const result = await readDriveMetadata(b, {}, {
        ...deps,
        fetchImpl: async () => {
          googleWasCalled = true;
          return json(200, { files: [] });
        },
      });
      assert.equal(result.status, "refused", "Tenant B holds no Google connection");
      if (result.status === "refused") {
        assert.equal(result.reason, "capability-not-available");
        /*
         * The refusal must not describe Tenant A. It names what THIS organization can do, and the
         * detail comes from the availability seam's own not-connected reason.
         */
        const detail = JSON.stringify(result);
        assert.ok(!detail.includes(idA), "Tenant A's integration id is never named");
        assert.ok(!detail.includes("acme.example"), "Tenant A's account label is never named");
      }
      assert.equal(googleWasCalled, false, "no credential is spent for a tenant with no capability");
    }

    /* ── 3. TENANT B CANNOT SPEND TENANT A'S CREDENTIAL, EVEN NAMING IT ────── */
    {
      const attempted = await withGoogleAccessToken(
        b,
        idA,
        async () => ({ ok: true as const, value: "should-never-run" }),
        { ...deps, fetchImpl: async () => json(200, {}) },
      );
      assert.ok(!attempted.ok, "Tenant B must not spend Tenant A's credential");
      if (!attempted.ok) {
        assert.equal(
          attempted.reason,
          "no-live-access-credential",
          "cross-tenant reads as ABSENT — indistinguishable from a connection that never existed",
        );
      }
    }

    /* ── 4. IDENTITY-ONLY GRANT: CONNECTED, AND NO DRIVE ──────────────────── */
    {
      await db.transaction(async (tx) =>
        recordVerifiedConnectionWithin(
          tx,
          a,
          idA,
          {
            externalAccountId: "104729000000000000009",
            externalAccountLabel: "director@acme.example",
            grantedScopes: [...IDENTITY_GRANT],
          },
          NOW,
        ),
      );
      let googleWasCalled = false;
      const result = await readDriveMetadata(a, {}, {
        ...deps,
        fetchImpl: async () => {
          googleWasCalled = true;
          return json(200, { files: [] });
        },
      });
      assert.equal(result.status, "refused", "the grant no longer covers Drive");
      if (result.status === "refused") assert.equal(result.reason, "capability-not-available");
      assert.equal(googleWasCalled, false, "the gate refuses BEFORE any credential is spent");

      const state = await client.query<{ connection_state: string; health: string }>(
        `select connection_state, health from integrations where id = $1`,
        [idA],
      );
      assert.equal(state.rows[0]!.connection_state, "connected", "and the connection is still fine");

      /* Restore the Drive grant for the refresh proof below. */
      await db.transaction(async (tx) =>
        recordVerifiedConnectionWithin(
          tx,
          a,
          idA,
          {
            externalAccountId: "104729000000000000009",
            externalAccountLabel: "director@acme.example",
            grantedScopes: [...DRIVE_GRANT],
          },
          NOW,
        ),
      );
    }

    /* ── 5. THE REFRESH CREDENTIAL SURVIVES WHEN GOOGLE OMITS ONE ──────────── */
    {
      const before = await listCredentialMetadata(a, idA, deps);
      assert.ok(before.status === "read");
      const refreshBefore = before.credentials.find((c) => c.kind === "oauth_refresh" && c.live)!;
      assert.ok(refreshBefore, "a refresh credential exists to be preserved");

      /*
       * Google refuses the access token once, then answers the refresh WITHOUT a new refresh
       * token — the ordinary case — and finally serves Drive.
       */
      let call = 0;
      const result = await readDriveMetadata(a, {}, {
        ...deps,
        fetchImpl: async (input) => {
          call += 1;
          if (input.includes("/drive/v3/files") && call === 1) {
            return json(401, { error: { code: 401 } });
          }
          if (input.includes("oauth2.googleapis.com/token")) {
            /* NO `refresh_token` FIELD. This is what Google actually returns on a refresh. */
            return json(200, {
              access_token: ROTATED_ACCESS,
              expires_in: 3599,
              scope: DRIVE_GRANT.join(" "),
              token_type: "Bearer",
            });
          }
          return json(200, { files: [] });
        },
      });

      assert.equal(result.status, "read", `the refresh should have recovered: ${JSON.stringify(result)}`);

      const after = await listCredentialMetadata(a, idA, deps);
      assert.ok(after.status === "read");
      const refreshAfter = after.credentials.find((c) => c.kind === "oauth_refresh" && c.live);
      assert.ok(refreshAfter, "the refresh credential must not be destroyed when Google omits one");
      assert.equal(
        refreshAfter!.credentialId,
        refreshBefore.credentialId,
        "the SAME refresh credential row survives — Google omitted a replacement, so nothing replaced it",
      );

      /* And it still decrypts to the original secret, which is the only proof that matters. */
      const usable = await withDecryptedSecret(
        a,
        refreshAfter!.credentialId,
        async (secret) => secret === REFRESH_TOKEN,
        deps,
      );
      assert.ok(usable.status === "used" && usable.value === true, "and it is still the tenant's way back");

      /* The access credential WAS replaced — that is the half a refresh is supposed to change. */
      const accessAfter = after.credentials.find((c) => c.kind === "oauth_access" && c.live)!;
      const rotated = await withDecryptedSecret(
        a,
        accessAfter.credentialId,
        async (secret) => secret === ROTATED_ACCESS,
        deps,
      );
      assert.ok(rotated.status === "used" && rotated.value === true, "the access token was rotated");
    }

    /* ── 6. A PROVIDER REFRESH PRESERVES THE CONNECTION LIFECYCLE ─────────── */
    {
      /*
       * ── WHAT THIS REPLACED, AND WHY THE REPLACEMENT IS STRONGER ───────────
       *
       * INT-4's first implementation PINNED a defect here: every credential write demoted the
       * connection to `unverified`, so the read after a refresh refused and the capability died an
       * hour after it started working. That block asserted the broken behaviour so it could not be
       * changed by accident.
       *
       * The Director's correction moved the fix into the credential authority, as a distinct write
       * intent rather than a flag. So the pin is gone and these are the positive proofs that
       * replace it — every one of which would have FAILED against the old behaviour.
       */
      const state = await client.query<{
        connection_state: string;
        health: string;
        last_verified_at: string | null;
      }>(
        `select connection_state, health, last_verified_at from integrations where id = $1`,
        [idA],
      );
      assert.equal(
        state.rows[0]!.connection_state,
        "connected",
        "a successful provider refresh leaves the connection CONNECTED",
      );
      assert.equal(
        state.rows[0]!.health,
        "healthy",
        "health is unchanged — a refresh observed nothing new about whether the provider answers",
      );
      assert.ok(
        state.rows[0]!.last_verified_at,
        "verification evidence is preserved, not cleared",
      );

      /* And the capability is still usable — the whole point of the correction. */
      const nextRead = await readDriveMetadata(a, {}, {
        ...deps,
        fetchImpl: async () => json(200, { files: [] }),
      });
      assert.equal(
        nextRead.status,
        "read",
        "the read AFTER a refresh still works — the capability does not expire with the token",
      );
    }

    /* ── 6b. THE REFRESH INTENT CANNOT MINT `connected` ────────────────────── */
    {
      /*
       * The narrow intent must not become a way to carry a connection forward from nothing. Proved
       * against a SECOND connection that has never been verified: a refresh-style replacement is
       * either refused (draft) or leaves the row exactly where it was (unverified) — and in neither
       * case can it produce `connected`.
       */
      const second = await createConnection(
        a,
        { providerKey: GOOGLE_PROVIDER_KEY, name: "Google Workspace" },
        { getDb, now: () => NOW },
      );
      assert.ok(second.status === "created");
      const draftId = second.connection.integrationId;
      assert.equal(second.connection.connectionState, "draft");

      /*
       * THE HOLD IS EXERCISED DIRECTLY, because the credential layer refuses first.
       *
       * A draft connection has no live credential, so `replaceCredentialFromProviderRefresh`
       * returns `no-live-credential` before the draft guard is ever consulted — which makes that
       * guard defence in depth rather than the thing being tested. Calling the hold itself is what
       * makes the rule load-bearing instead of decorative, and a bite-proof that removes the guard
       * now goes red here.
       */
      const heldOnDraft = await db.transaction(async (tx) =>
        holdConnectionForProviderRefreshWithin(tx, a, draftId),
      );
      assert.equal(
        heldOnDraft.status,
        "refused",
        "a refresh cannot precede the credential it derives from",
      );
      if (heldOnDraft.status === "refused") {
        assert.equal(heldOnDraft.reason, "illegal-transition");
      }

      /* And through the credential layer it is refused too, one line earlier. */
      const onDraft = await replaceCredentialFromProviderRefresh(
        a,
        { integrationId: draftId, kind: "oauth_access", plaintext: "int4-fixture-token-draft" },
        deps,
      );
      assert.equal(onDraft.status, "refused", "the credential layer refuses a draft as well");

      /* Give it a credential the ordinary way — which correctly demotes it to `unverified`. */
      const supplied = await storeCredential(
        a,
        { integrationId: draftId, kind: "oauth_access", plaintext: "int4-fixture-token-supplied" },
        deps,
      );
      assert.ok(supplied.status === "stored");
      assert.equal(
        supplied.connectionState,
        "unverified",
        "a SUPPLIED secret still demotes — the ordinary rule is untouched",
      );

      /* Now a refresh-style replacement PRESERVES `unverified`. It does not promote. */
      const refreshed = await replaceCredentialFromProviderRefresh(
        a,
        { integrationId: draftId, kind: "oauth_access", plaintext: "int4-fixture-token-refreshed" },
        deps,
      );
      assert.ok(refreshed.status === "replaced");
      assert.equal(
        refreshed.connectionState,
        "unverified",
        "the refresh intent preserves state — it can never MINT `connected`",
      );

      const minted = await client.query<{ connection_state: string }>(
        `select connection_state from integrations where id = $1`,
        [draftId],
      );
      assert.equal(minted.rows[0]!.connection_state, "unverified", "and the row agrees");
    }

    /* ── 6c. THE ORDINARY RULE IS UNCHANGED, AND TERMINAL STAYS TERMINAL ───── */
    {
      /*
       * THE SHARPEST POSSIBLE CONTRAST: the SAME operation on the SAME row, under the two intents.
       * `replaceCredential` is what a human re-consent calls, and it still demotes. Only the intent
       * differs, which is exactly what a distinct function buys over a boolean.
       */
      const human = await replaceCredential(
        a,
        { integrationId: idA, kind: "oauth_access", plaintext: "int4-fixture-token-reconsent" },
        deps,
      );
      assert.ok(human.status === "replaced", `re-consent should replace: ${JSON.stringify(human)}`);
      assert.equal(
        human.connectionState,
        "unverified",
        "a human/new-secret write still demotes a connected row — the released rule survives",
      );

      /* Restore for the outage proof below. */
      await db.transaction(async (tx) =>
        recordVerifiedConnectionWithin(
          tx,
          a,
          idA,
          {
            externalAccountId: "104729000000000000009",
            externalAccountLabel: "director@acme.example",
            grantedScopes: [...DRIVE_GRANT],
          },
          NOW,
        ),
      );

      /* Terminal is terminal for the refresh intent too. */
      const ended = await disconnectConnection(a, idA, { getDb, now: () => NOW });
      assert.ok(ended.status === "transitioned");
      const onTerminal = await replaceCredentialFromProviderRefresh(
        a,
        { integrationId: idA, kind: "oauth_access", plaintext: "int4-fixture-token-terminal" },
        deps,
      );
      assert.equal(onTerminal.status, "refused", "a terminal connection takes no refreshed secret");
      if (onTerminal.status === "refused") {
        assert.equal(onTerminal.reason, "connection-terminal");
      }
    }

    /* ── 7. A DRIVE OUTAGE LEAVES THE GRANT EXACTLY AS IT WAS ──────────────── */
    {
      /*
       * 6c ended the original connection, and terminal is terminal — so this needs a NEW row, which
       * is exactly what reconnecting does in production.
       */
      const fresh = await createConnection(
        a,
        { providerKey: GOOGLE_PROVIDER_KEY, name: "Google Workspace" },
        { getDb, now: () => NOW },
      );
      assert.ok(fresh.status === "created");
      const liveId = fresh.connection.integrationId;
      await storeCredential(a, { integrationId: liveId, kind: "oauth_access", plaintext: ACCESS_TOKEN }, deps);

      await db.transaction(async (tx) =>
        recordVerifiedConnectionWithin(
          tx,
          a,
          liveId,
          {
            externalAccountId: "104729000000000000009",
            externalAccountLabel: "director@acme.example",
            grantedScopes: [...DRIVE_GRANT],
          },
          NOW,
        ),
      );

      const before = await client.query<{ connection_state: string; health: string }>(
        `select connection_state, health from integrations where id = $1`,
        [liveId],
      );
      assert.equal(before.rows[0]!.connection_state, "connected");

      for (const status of [429, 500, 503]) {
        const result = await readDriveMetadata(a, {}, {
          ...deps,
          fetchImpl: async () => json(status, { error: { code: status } }),
        });
        assert.equal(result.status, "provider-failed", `${status} is a provider failure`);
        if (result.status === "provider-failed") {
          assert.equal(result.failure, "transport", `${status} must never be auth`);
        }
      }
      const after = await client.query<{ connection_state: string; health: string }>(
        `select connection_state, health from integrations where id = $1`,
        [liveId],
      );
      assert.deepEqual(
        after.rows[0],
        before.rows[0],
        "a Drive outage writes NO lifecycle — the row is unchanged",
      );
    }

    /* ── 8. NO TOKEN IS EVER PERSISTED IN READABLE FORM ────────────────────── */
    {
      const rows = await client.query<{ ciphertext: string }>(
        `select ciphertext from integration_credentials where tenant_id = $1`,
        [TENANT_A],
      );
      for (const row of rows.rows) {
        for (const secret of [ACCESS_TOKEN, REFRESH_TOKEN, ROTATED_ACCESS]) {
          assert.ok(!row.ciphertext.includes(secret), "no token is stored in readable form");
        }
      }
    }

    console.log("int4-google-drive-metadata/tenant-isolation: all assertions passed");
  } finally {
    await client.end().catch(() => {});
    await handle.dispose?.().catch?.(() => {});
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
