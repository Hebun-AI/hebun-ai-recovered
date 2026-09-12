/*
 * INSTAGRAM ACCOUNT REPLACEMENT — the switch lifecycle, against a real PostgreSQL.
 *
 * ── WHAT THIS REPLACED, AND WHY ─────────────────────────────────────────────
 *
 * The released switch flow reused the tenant's existing integration row. Production settled it:
 * Meta authorized the new account, the credential authority superseded the old token, and
 * `recordVerifiedConnectionWithin` refused with `account-changed` — three times — leaving the
 * connection `unverified` while holding a live credential for an account the row did not name.
 *
 * A first repair added an `allowAccountChange` escape hatch to the authority. It was WITHDRAWN. The
 * integration authority had said the right thing all along — "Connecting a different account is a
 * NEW connection, not an update" — and the schema already agreed: the unique index is PARTIAL and
 * keyed on the external account, and `revokedAt` is documented as "never cleared — reconnecting
 * creates a NEW row".
 *
 * So a switch now builds the replacement on its own row. The incumbent stays connected and keeps
 * its credential until the replacement is verified AND recorded; only then is it retired. Nothing
 * needs to be rolled back, because nothing was taken away in the first place.
 *
 * THIS IS ACCOUNT REPLACEMENT, NOT MULTI-ACCOUNT. Two live rows exist only inside the switch
 * window. Whether the model could support two permanent accounts is a separate question nobody has
 * asked and this file does not answer.
 */
import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import { Client } from "pg";

import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
/* Loaded FIRST on purpose: the schema barrel is the only safe entry point for `src/db/schema/*`. */
import { createControlPlaneDb } from "../../src/db/client.server";
import {
  createConnection,
  listConnections,
  recordVerifiedConnectionWithin,
} from "../../src/features/integration-authority/integration-repository.server";
import {
  storeCredential,
  listCredentialMetadata,
  hasLiveCredential,
} from "../../src/features/integration-credentials/credential-repository.server";
import { retireSupersededConnection } from "../../src/features/provider-connection-lifecycle/disconnect-connection.server";
import { INTEGRATION_ENCRYPTION_ENV_KEYS } from "../../src/features/secret-encryption/key-registry.server";
import { INSTAGRAM_PROVIDER_KEY } from "../../src/features/provider-instagram/contracts";
import {
  mintInstagramOAuthState,
  verifyInstagramOAuthState,
} from "../../src/features/provider-instagram/instagram-oauth-state.server";
import { buildInstagramConnectionModel } from "../../src/features/instagram-connection-surface/model";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const ACCOUNT_A = "28295264780115792";
const ACCOUNT_B = "17998877665544332";
const LABEL_A = "@turkishrughousecom · Instagram Login";
const LABEL_B = "@diodbacom · Instagram Login";
const SCOPES = ["instagram_business_basic"];
const STATE_SECRET = randomBytes(32).toString("base64");

const ENV = {
  [INTEGRATION_ENCRYPTION_ENV_KEYS.keys]: `k1:${randomBytes(32).toString("base64")}`,
  [INTEGRATION_ENCRYPTION_ENV_KEYS.activeKeyId]: "k1",
};

async function seedTenant(db: Client, slug: string): Promise<TenantContext> {
  const co = await db.query<{ id: string }>(
    `insert into companies (name, slug, tenant_status) values ($1,$2,'active') returning id`,
    [slug, slug],
  );
  const tenantId = co.rows[0]!.id;
  const u = await db.query<{ id: string }>(`insert into users (email) values ($1) returning id`, [
    `owner@${slug}.test`,
  ]);
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
    sessionContextId: "00000000-0000-4000-8000-00000000000e",
    provider: "local" as never,
    assuranceLevel: "aal1",
    mfaVerified: false,
    requestId: `switch-${slug}`,
    authenticatedAt: new Date().toISOString(),
  } as never);
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_ig_switch");
  await harness.createDatabase();
  const db = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db, env: ENV } as const;

  try {
    harness.migrateDatabase();
    await db.connect();

    const a = await seedTenant(db, "switch-a");
    const b = await seedTenant(db, "switch-b");

    /** Create a row the way the start route does. */
    const newRow = async (tenant: TenantContext): Promise<string> => {
      const created = await createConnection(
        tenant,
        { providerKey: INSTAGRAM_PROVIDER_KEY, name: "Instagram" },
        deps,
      );
      assert.equal(created.status, "created", `create refused: ${JSON.stringify(created)}`);
      return created.status === "created" ? created.connection.integrationId : "";
    };

    /** Store a credential the way the callback does for a fresh row. */
    const putCredential = async (tenant: TenantContext, integrationId: string, token: string) => {
      const stored = await storeCredential(
        tenant,
        { integrationId, kind: "oauth_access", plaintext: token },
        deps,
      );
      assert.equal(stored.status, "stored", `store refused: ${JSON.stringify(stored)}`);
    };

    /** Record a verified account the way the callback does — no permission parameter exists. */
    const record = async (
      tenant: TenantContext,
      integrationId: string,
      account: string,
      label: string,
    ) =>
      handle.db.transaction(async (tx) =>
        recordVerifiedConnectionWithin(
          tx,
          tenant,
          integrationId,
          { externalAccountId: account, externalAccountLabel: label, grantedScopes: SCOPES },
          new Date(),
        ),
      );

    const stateOf = async (integrationId: string) => {
      const r = await db.query<{ st: string; ext: string | null; h: string }>(
        `select connection_state st, external_account_id ext, health h from integrations where id=$1`,
        [integrationId],
      );
      return r.rows[0]!;
    };

    const viewsOf = async (tenant: TenantContext) => {
      const l = await listConnections(tenant, deps);
      assert.equal(l.status, "read");
      return l.status === "read" ? l.connections : [];
    };

    /* Tenant A connects account A. Tenant B connects the SAME account — the production shape. */
    const integrationA = await newRow(a);
    await putCredential(a, integrationA, "token-a");
    assert.equal((await record(a, integrationA, ACCOUNT_A, LABEL_A)).status, "verified");

    const foreign = await newRow(b);
    await putCredential(b, foreign, "token-b");
    assert.equal((await record(b, foreign, ACCOUNT_A, LABEL_A)).status, "verified");

    /* ═══ 1. SAME-ACCOUNT RECONNECT USES THE SAME ROW AND SUCCEEDS ══════ */
    {
      const before = (await viewsOf(a)).length;
      const again = await record(a, integrationA, ACCOUNT_A, LABEL_A);
      assert.equal(again.status, "verified", "re-verifying the same account is not a change");
      assert.equal((await viewsOf(a)).length, before, "a reconnect creates NO new row");
      const row = await stateOf(integrationA);
      assert.equal(row.st, "connected");
      assert.equal(row.ext, ACCOUNT_A);
    }

    /* ═══ 7. AN ORDINARY NON-SWITCH A → B STILL FAILS CLOSED ═══════════ */
    {
      /*
       * The released invariant, unwaived and now unwaivable — there is no parameter that could
       * permit this. It is asserted BEFORE the switch below so the row is still the incumbent.
       */
      const refused = await record(a, integrationA, ACCOUNT_B, LABEL_B);
      assert.equal(refused.status, "refused", "a silent rebind must not pass");
      assert.equal(refused.status === "refused" && refused.reason, "account-changed");
      const row = await stateOf(integrationA);
      assert.equal(row.ext, ACCOUNT_A, "the row is untouched — the refusal precedes any write");
      assert.equal(row.st, "connected", "and the connection is still usable");
      assert.equal(await hasLiveCredential(a, integrationA, deps), true);
    }

    /* ═══ 2 + 3. A SWITCH BUILDS A SEPARATE ROW; A STAYS ACTIVE ════════ */
    const candidate = await newRow(a);
    {
      assert.notEqual(candidate, integrationA, "the replacement is a DISTINCT integration");
      await putCredential(a, candidate, "token-b-for-a");

      /* B is not verified yet. A must be completely unaffected. */
      const incumbent = await stateOf(integrationA);
      assert.equal(incumbent.st, "connected", "A is still connected while B is unverified");
      assert.equal(incumbent.ext, ACCOUNT_A);
      assert.equal(incumbent.h, "healthy", "…and still healthy");
      assert.equal(await hasLiveCredential(a, integrationA, deps), true, "A's token is untouched");

      const cand = await stateOf(candidate);
      assert.equal(cand.ext, null, "the candidate names no account yet");
      assert.notEqual(cand.st, "connected", "and is not connected");

      /* THE SURFACE STILL SHOWS THE WORKING CONNECTION, not the half-built one. */
      const model = buildInstagramConnectionModel(await viewsOf(a), true);
      assert.equal(model.state, "connected", "the page still reports a working connection");
      assert.equal(model.accountLabel, LABEL_A, "…and still names the incumbent account");
    }

    /* ═══ 5. A FAILED B VERIFICATION LEAVES A COMPLETELY USABLE ════════ */
    {
      /*
       * A verification failure means the callback simply never reaches the record step. Nothing is
       * rolled back because nothing was taken: this asserts the state after that early exit.
       */
      const incumbent = await stateOf(integrationA);
      assert.equal(incumbent.st, "connected");
      assert.equal(incumbent.ext, ACCOUNT_A);
      assert.equal(await hasLiveCredential(a, integrationA, deps), true);
      const aCreds = await listCredentialMetadata(a, integrationA, deps);
      assert.equal(
        aCreds.status === "read" ? aCreds.credentials.filter((c) => c.live).length : -1,
        1,
        "A still holds exactly one live credential — none was superseded by the attempt",
      );
    }

    /* ═══ 6. A FAILED B RECORDING ALSO LEAVES A USABLE ═════════════════ */
    {
      /*
       * A REAL refusal, not a simulated one: recording an accountless fact against an
       * account-bearing provider is refused by the released identity rule.
       */
      const refused = await handle.db.transaction(async (tx) =>
        recordVerifiedConnectionWithin(
          tx,
          a,
          candidate,
          { externalAccountId: null, externalAccountLabel: LABEL_B, grantedScopes: SCOPES },
          new Date(),
        ),
      );
      assert.equal(refused.status, "refused", "the candidate's recording failed");
      assert.equal(
        refused.status === "refused" && refused.reason,
        "account-identity-mismatch",
        "…for the released reason",
      );
      const incumbent = await stateOf(integrationA);
      assert.equal(incumbent.st, "connected", "A is STILL connected after B's recording failed");
      assert.equal(await hasLiveCredential(a, integrationA, deps), true, "and still spendable");
    }

    /* ═══ 4 + 11. B RECORDED, THEN A RETIRED — IN THAT ORDER ═══════════ */
    {
      const recorded = await record(a, candidate, ACCOUNT_B, LABEL_B);
      assert.equal(recorded.status, "verified", "the replacement is recorded on its own row");

      /* Both are live for this instant. That window is the whole reason A was never touched. */
      assert.equal((await stateOf(integrationA)).st, "connected", "A is still connected here");
      assert.equal((await stateOf(candidate)).st, "connected");

      const retired = await retireSupersededConnection(a, integrationA, deps);
      assert.equal(
        retired.status,
        "hebun-access-ended",
        `retiring the incumbent refused: ${JSON.stringify(retired)}`,
      );

      const old = await stateOf(integrationA);
      assert.equal(old.st, "disconnected", "A is disconnected — never `revoked`");
      assert.equal(old.h, "unknown", "…and its health is reset rather than asserted");
      assert.equal(
        old.ext,
        ACCOUNT_A,
        "…while still naming the account it held, so history stays readable",
      );

      const now = await stateOf(candidate);
      assert.equal(now.st, "connected");
      assert.equal(now.ext, ACCOUNT_B, "B is the active account");

      /* NO DUPLICATE ACTIVE CREDENTIAL. */
      assert.equal(await hasLiveCredential(a, integrationA, deps), false, "A's token is revoked");
      assert.equal(await hasLiveCredential(a, candidate, deps), true, "B's token is live");
      const liveRows = await db.query<{ n: string }>(
        `select count(*)::text n from integration_credentials c
           join integrations i on i.id = c.integration_id
          where i.tenant_id=$1 and c.revoked_at is null`,
        [a.tenantId],
      );
      assert.equal(liveRows.rows[0]!.n, "1", "exactly ONE live credential remains for this tenant");

      /* And exactly one non-terminal connection — no lingering multi-account state. */
      const liveConns = await db.query<{ n: string }>(
        `select count(*)::text n from integrations
          where tenant_id=$1 and connection_state not in ('disconnected','revoked')`,
        [a.tenantId],
      );
      assert.equal(liveConns.rows[0]!.n, "1", "the switch window is closed — one live connection");

      /* The surface now names the replacement. */
      const model = buildInstagramConnectionModel(await viewsOf(a), true);
      assert.equal(model.state, "connected");
      assert.equal(model.accountLabel, LABEL_B, "the page names the new account");
    }

    /* ═══ 8. TENANT ISOLATION SURVIVES ALL OF IT ═══════════════════════ */
    {
      const other = await stateOf(foreign);
      assert.equal(
        other.ext,
        ACCOUNT_A,
        "tenant B still holds the account tenant A just switched away from",
      );
      assert.equal(other.st, "connected", "and is still connected");
      assert.equal(await hasLiveCredential(b, foreign, deps), true, "with a live credential");

      /* A cannot retire it, and the refusal discloses nothing. */
      const stolen = await retireSupersededConnection(a, foreign, deps);
      assert.equal(stolen.status, "refused", "one tenant cannot retire another's connection");
      assert.equal((await stateOf(foreign)).st, "connected", "B's row did not move");
      assert.equal(await hasLiveCredential(b, foreign, deps), true, "B's credential survives");

      /* Nor can A record against it. */
      const forged = await record(a, foreign, ACCOUNT_B, LABEL_B);
      assert.equal(forged.status, "refused");
      assert.equal(
        forged.status === "refused" && forged.reason,
        "not-found",
        "…and it looks like absence, disclosing nothing about another tenant",
      );
    }

    /* ═══ 12. RETIREMENT IS TERMINAL AND SAFE TO REPEAT ════════════════ */
    {
      const again = await retireSupersededConnection(a, integrationA, deps);
      assert.equal(again.status, "refused", "a terminal row refuses a second transition");
      assert.equal(
        again.status === "refused" && again.reason,
        "connection-illegal-transition",
        "…and says which half declined, rather than pretending to succeed",
      );
      assert.equal((await stateOf(integrationA)).st, "disconnected", "still disconnected");
    }

    /* ═══ 9. OBSERVATIONS OF THE OLD ACCOUNT SURVIVE, WITH PROVENANCE ══ */
    {
      /*
       * Written directly: this fixture is about SURVIVAL across a replacement, not about the
       * observation writer's contract, which has its own suite. HUMAN provenance, because the
       * schema admits the actor pair or a standing authorization — never both.
       */
      await db.query(
        `insert into provider_observations
           (tenant_id, provider_key, capability_key, subject_kind, subject_ref, integration_id,
            observed_at, recorded_at, facts, facts_digest,
            observed_by_actor_type, observed_by_actor_id)
         values ($1,'instagram','instagram.account.public.read','instagram-account',
                 $2,$3, now(), now(), '{"followersCount":7}'::jsonb, repeat('b',64), 'human', $4)`,
        [a.tenantId, `instagram/account/${ACCOUNT_A}`, integrationA, a.userId],
      );

      const survived = await db.query<{ n: string; ref: string; st: string }>(
        `select count(*)::text n, min(o.subject_ref) ref, min(i.connection_state) st
           from provider_observations o
           join integrations i on i.id = o.integration_id
          where o.tenant_id=$1 and o.integration_id=$2`,
        [a.tenantId, integrationA],
      );
      assert.equal(survived.rows[0]!.n, "1", "the observation is still there");
      assert.equal(
        survived.rows[0]!.ref,
        `instagram/account/${ACCOUNT_A}`,
        "…still naming the account it described",
      );
      assert.equal(
        survived.rows[0]!.st,
        "disconnected",
        "…and still attached to the RETIRED connection, not moved onto the replacement",
      );
    }

    /* ═══ 10. THE SIGNED INTENT AND THE SUPERSEDE TARGET ARE UNFORGEABLE ═ */
    {
      const sessionReference = "session-reference-fixture";

      const plain = mintInstagramOAuthState(
        { tenantId: a.tenantId, sessionReference, integrationId: candidate },
        STATE_SECRET,
      );
      assert.equal(plain.payload.accountSwitch, false, "a switch is never implied by default");
      assert.equal(
        plain.payload.supersedesIntegrationId,
        undefined,
        "and an ordinary connect retires nothing",
      );

      const asked = mintInstagramOAuthState(
        {
          tenantId: a.tenantId,
          sessionReference,
          integrationId: candidate,
          accountSwitch: true,
          supersedesIntegrationId: integrationA,
        },
        STATE_SECRET,
      );
      const round = verifyInstagramOAuthState(
        {
          cookieValue: asked.cookieValue,
          stateParameter: asked.stateParameter,
          sessionReference,
          tenantId: a.tenantId,
        },
        STATE_SECRET,
      );
      assert.ok(round.ok, "the signed state verifies");
      assert.equal(round.ok && round.payload.accountSwitch, true, "the intent survives the trip");
      assert.equal(
        round.ok && round.payload.supersedesIntegrationId,
        integrationA,
        "…and so does the row it retires",
      );

      /*
       * EDITING EITHER FIELD BREAKS THE SIGNATURE. This is what stops a visitor from aiming the
       * retirement at a connection of their choosing, or from turning a reconnect into a rebind.
       */
      const [body, sig] = plain.cookieValue.split(".");
      const decoded = JSON.parse(Buffer.from(body!, "base64url").toString("utf8")) as Record<
        string,
        unknown
      >;
      decoded.accountSwitch = true;
      decoded.supersedesIntegrationId = foreign; /* another tenant's row, for good measure */
      const forgedBody = Buffer.from(JSON.stringify(decoded), "utf8").toString("base64url");
      const forged = verifyInstagramOAuthState(
        {
          cookieValue: `${forgedBody}.${sig}`,
          stateParameter: plain.stateParameter,
          sessionReference,
          tenantId: a.tenantId,
        },
        STATE_SECRET,
      );
      assert.equal(forged.ok, false, "an edited payload fails the signature check");
      assert.equal(forged.ok === false && forged.reason, "bad-signature");

      /* Mismatched tenant, session and nonce all still fail closed. */
      const base = {
        cookieValue: asked.cookieValue,
        stateParameter: asked.stateParameter,
        sessionReference,
        tenantId: a.tenantId,
      };
      for (const [label, input, reason] of [
        ["tenant", { ...base, tenantId: b.tenantId }, "tenant-mismatch"],
        ["session", { ...base, sessionReference: "another-session" }, "session-mismatch"],
        ["nonce", { ...base, stateParameter: "not-the-minted-nonce" }, "nonce-mismatch"],
      ] as const) {
        const out = verifyInstagramOAuthState(input, STATE_SECRET);
        assert.equal(out.ok, false, `${label} mismatch is refused`);
        assert.equal(out.ok === false && out.reason, reason);
      }

      /*
       * A STATE MINTED BEFORE THESE FIELDS EXISTED READS AS "NO SWITCH, RETIRE NOTHING". Backward
       * compatibility is a safety property here: anything in flight during a deploy must degrade to
       * the stricter answer, never into a silent rebind or an unasked-for retirement.
       */
      const legacy = JSON.parse(
        Buffer.from(plain.cookieValue.split(".")[0]!, "base64url").toString("utf8"),
      ) as Record<string, unknown>;
      delete legacy.accountSwitch;
      delete legacy.supersedesIntegrationId;
      const legacyBody = Buffer.from(JSON.stringify(legacy), "utf8").toString("base64url");
      const legacySig = createHmac("sha256", STATE_SECRET)
        .update(`state:${legacyBody}`)
        .digest("base64url");
      const old = verifyInstagramOAuthState(
        {
          cookieValue: `${legacyBody}.${legacySig}`,
          stateParameter: plain.stateParameter,
          sessionReference,
          tenantId: a.tenantId,
        },
        STATE_SECRET,
      );
      assert.ok(old.ok, "an older-shaped state still verifies");
      assert.notEqual(old.ok && old.payload.accountSwitch, true, "absent intent is not a switch");
      assert.equal(
        old.ok && old.payload.supersedesIntegrationId,
        undefined,
        "and absent supersede retires nothing",
      );
    }

    console.log("Instagram account replacement (PostgreSQL): all assertions passed");
  } finally {
    await db.end().catch(() => {});
    await handle.dispose?.().catch(() => {});
    await harness.dropDatabase();
  }
}

void main();
