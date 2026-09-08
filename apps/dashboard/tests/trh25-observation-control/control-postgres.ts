/*
 * TRH-25 PREREQUISITES — the operator's stop and the concurrency guarantee, against a REAL
 * PostgreSQL database.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "A Director-owned kill switch refuses every machine-principal provider read while it is off or
 *    unreadable, without altering any authorization; withdrawal still wins on its own terms; and
 *    two genuinely concurrent invocations against one authorization can produce AT MOST ONE
 *    recorded observation, while two DIFFERENT authorizations are not serialized against each
 *    other. Nothing here creates permission, schedules anything, or leaves state to reclaim."
 *
 * The provider is a FAKE FETCH. What is real is the database, the locking, and every authority.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import {
  authorizeStandingObservation,
  withdrawStandingObservation,
} from "../../src/features/standing-observation-authority/authorize-standing-observation.server";
import { mintObservationPrincipal } from "../../src/features/standing-observation-authority/observation-principal.server";
import { revalidateStandingObservation } from "../../src/features/standing-observation-authority/revalidate-standing-observation.server";
import { resolveObservationReadEnabled } from "../../src/features/standing-observation-authority/observation-read-control.server";
import { observeOnceUnderAuthorization } from "../../src/features/provider-observation-history/observe-once-under-authorization.server";
import { recordAuthorizedProviderObservation } from "../../src/features/provider-observation-history/write-provider-observation.server";
import {
  OBSERVATION_READ_CONTROL_KEY,
  MIN_OBSERVATION_INTERVAL_MINUTES,
} from "../../src/features/standing-observation-authority/contracts";
import {
  YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY,
  YOUTUBE_PROVIDER_KEY,
} from "../../src/features/provider-youtube/contracts";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";

const JUSTIFICATION =
  "I am authorizing this organization's own public channel to be observed on a bounded cadence, and I accept responsibility for that.";
const WITHDRAWAL =
  "We are pausing standing observation of this channel while we review what we do with the numbers.";

const CHANNEL_A = "UCtrh25alpha";
const CHANNEL_B = "UCtrh25beta";
const SUBJECT_KIND = "youtube-channel";
const subjectOf = (channel: string) => `youtube/channel/${channel}`;

interface Seeded {
  readonly tenantId: string;
  readonly userId: string;
  readonly authIdentityId: string;
  readonly membershipId: string;
  readonly roleId: string;
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

/** A YouTube that answers for one channel id. */
function fakeYouTube(channel: string, views: number): typeof fetch {
  return (async (input: string) => {
    const url = String(input);
    if (url.includes("/channels")) {
      if (!url.includes(`id=${channel}`) || url.includes("forHandle")) {
        return new Response(JSON.stringify({ items: [] }), {
          status: 200, headers: { "content-type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({
          items: [{
            id: channel,
            snippet: { title: "Fixture", customUrl: "@fixture", publishedAt: "2026-01-01T00:00:00Z" },
            statistics: { viewCount: String(views), subscriberCount: "0", videoCount: "0" },
            contentDetails: { relatedPlaylists: { uploads: `UU${channel.slice(2)}` } },
          }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    return new Response(JSON.stringify({ error: { message: "playlistNotFound" } }), {
      status: 404, headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
}

async function armControl(c: Client, enabled: boolean): Promise<void> {
  await c.query(
    `insert into provider_connectivity_controls (provider_key, director_enabled, control_source)
          values ($1, $2, 'local-operator-ceremony')
     on conflict (provider_key) do update set director_enabled = $2, updated_at = now()`,
    [OBSERVATION_READ_CONTROL_KEY, enabled],
  );
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_trh25_control");
  await harness.createDatabase();
  harness.migrateDatabase();

  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const getDb = () => handle.db;
  const baseDeps = { getDb };

  try {
    /* ═══ 0. NO SCHEMA WAS ADDED FOR ANY OF THIS ════════════════════════════ */
    const tables = await setup.query<{ table_name: string }>(
      `select table_name from information_schema.tables where table_schema = 'public'`,
    );
    for (const invented of [
      "observation_locks", "observation_leases", "observation_schedules", "observation_controls",
      "provider_read_controls", "kill_switches", "observation_runs",
    ]) {
      assert.ok(
        !tables.rows.some((r) => r.table_name === invented),
        `no '${invented}' table — the switch is a ROW in a released table and the lock is a transaction`,
      );
    }
    const controlCols = await setup.query<{ column_name: string }>(
      `select column_name from information_schema.columns where table_name = 'provider_connectivity_controls'`,
    );
    assert.ok(
      !controlCols.rows.some((r) => r.column_name === "tenant_id"),
      "the control is GLOBAL — one switch, every tenant, and the limitation is recorded not hidden",
    );

    /* ═══ 1. A TENANT, GOVERNANCE, A CONNECTION AND A CREDENTIAL ════════════ */
    const trh = await seedLocalIdentity(setup, {
      companyName: "Turkish Rug House", companySlug: "trh-25", email: "director@trh.test", roleType: "owner",
    });
    const ctx = contextFor(trh, await sessionRowFor(setup, trh, "bbb1"), "trh25");
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

    const connection = (
      await setup.query<{ id: string }>(
        `insert into integrations (tenant_id, provider_key, name, status, connection_state, health,
                                   last_verified_at, created_by, created_by_type)
         values ($1,'youtube','YouTube','connected','connected','healthy', now(), $2,'human') returning id`,
        [trh.tenantId, trh.userId],
      )
    ).rows[0]!.id;

    const { storeCredential } = await import("../../src/features/integration-credentials/credential-repository.server");
    const env = {
      HEBUN_INTEGRATION_ENCRYPTION_KEYS: `k1:${Buffer.alloc(32, 7).toString("base64")}`,
      HEBUN_INTEGRATION_ENCRYPTION_ACTIVE_KEY_ID: "k1",
    };
    assert.equal(
      (await storeCredential(ctx, { integrationId: connection, kind: "api_key", plaintext: "AIzaFIXTURE" }, { getDb, env })).status,
      "stored",
    );
    await setup.query(
      `update integrations set connection_state = 'connected', health = 'healthy',
              last_verified_at = now() where id = $1`,
      [connection],
    );

    const authA = await authorizeStandingObservation(
      ctx,
      {
        providerKey: YOUTUBE_PROVIDER_KEY, capabilityKey: YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY,
        subjectKind: SUBJECT_KIND, subjectRef: subjectOf(CHANNEL_A), integrationId: connection,
        intervalMinutes: MIN_OBSERVATION_INTERVAL_MINUTES, justification: JUSTIFICATION,
        observedAuthorizationRevision: null,
      },
      baseDeps,
    );
    assert.equal(authA.status, "authorized", `an authorization exists: ${JSON.stringify(authA)}`);
    if (authA.status !== "authorized") throw new Error("unreachable");
    const authAId = authA.authorization.authorizationId;

    /* Everything the switch must not touch, counted BEFORE it is ever consulted. */
    const beforeSwitch = {
      decisions: await count(setup, "decision_records"),
      authorizations: await count(setup, "standing_observation_authorizations"),
      sessions: await count(setup, "governance_sessions"),
      audit: await count(setup, "audit_log"),
    };

    /* ═══ K2. AN ABSENT / UNREADABLE SWITCH FAILS CLOSED ════════════════════ */
    const observeA = { getDb, env, fetchImpl: fakeYouTube(CHANNEL_A, 11) };
    const noRow = await observeOnceUnderAuthorization(authAId, observeA);
    assert.deepEqual(
      noRow,
      { status: "refused", reason: "observation-read-disabled" },
      "K2 — with NO control row at all, a fully authorized read is refused",
    );
    assert.equal(await count(setup, "provider_observations"), 0, "K2 — and nothing was written");

    const principalForUnreadable = await mintObservationPrincipal(authAId, baseDeps);
    assert.equal(principalForUnreadable.status, "minted");
    if (principalForUnreadable.status !== "minted") throw new Error("unreachable");
    const unreadable = await revalidateStandingObservation(principalForUnreadable.principal, {
      ...baseDeps,
      /* An authority that cannot be reached at all. "We could not find out" must never mean "yes". */
      controlRepo: null,
    });
    assert.deepEqual(
      unreadable,
      { status: "refused", reason: "observation-read-disabled" },
      "K2 — an UNREADABLE switch refuses exactly as a disabled one does",
    );

    const throwing = await revalidateStandingObservation(principalForUnreadable.principal, {
      ...baseDeps,
      controlRepo: { getControl: async () => { throw new Error("control plane down"); } },
    });
    assert.deepEqual(
      throwing,
      { status: "refused", reason: "observation-read-disabled" },
      "K2 — and a switch that THROWS refuses too, rather than propagating and being caught as something else",
    );

    /*
     * AND THE SEAM ITSELF FAILS CLOSED ON EVERY SHAPE OF "I DO NOT KNOW".
     *
     * Asserted directly, because the revalidator cannot reach one of these branches: a caller with
     * no usable control plane fails at the re-mint first. A defence-in-depth branch that no test
     * exercises is a branch that can be inverted without anything objecting, which is exactly the
     * kind of silent fail-open this switch exists to prevent.
     */
    assert.equal(
      await resolveObservationReadEnabled({ getDb: () => null }),
      false,
      "K2 — a named control plane that yields no handle fails closed rather than falling back",
    );
    assert.equal(
      await resolveObservationReadEnabled({ repo: null }),
      false,
      "K2 — and no durable authority at all fails closed",
    );

    /* ═══ K1. AN EXPLICITLY DISABLED SWITCH PREVENTS TRANSPORT ══════════════ */
    await armControl(setup, false);
    let providerCalls = 0;
    const countingFetch = (async (input: string) => {
      providerCalls += 1;
      return fakeYouTube(CHANNEL_A, 11)(input as unknown as RequestInfo);
    }) as unknown as typeof fetch;
    const disabled = await observeOnceUnderAuthorization(authAId, {
      getDb, env, fetchImpl: countingFetch,
    });
    assert.deepEqual(
      disabled,
      { status: "refused", reason: "observation-read-disabled" },
      "K1 — a disabled switch refuses",
    );
    assert.equal(providerCalls, 0, "K1 — and the PROVIDER WAS NEVER CONTACTED, which is the point");

    /* ═══ K5. THE SWITCH CREATED NOTHING AND ALTERED NOTHING ════════════════ */
    const authRowsWhileStopped = await setup.query<{ n: number }>(
      `select count(*)::int as n from standing_observation_authorizations`,
    );
    assert.equal(authRowsWhileStopped.rows[0]!.n, 1, "K5 — the switch created no authorization");
    const untouched = await setup.query<{ state: string; updated_at: Date; version: number }>(
      `select state, updated_at, version from standing_observation_authorizations`,
    );
    assert.equal(untouched.rows[0]!.state, "active", "K5 — a stopped read leaves the grant ACTIVE");
    assert.equal(untouched.rows[0]!.version, 1, "K5 — and untouched: a stop is not a withdrawal");
    /*
     * MEASURED AS A DELTA, never as an absolute: the fixture legitimately holds a bootstrap decision
     * and an authorization decision, and asserting "1" would have been a statement about the
     * fixture rather than about the switch.
     */
    for (const [table, was] of Object.entries(beforeSwitch)) {
      const name = { decisions: "decision_records", authorizations: "standing_observation_authorizations",
                     sessions: "governance_sessions", audit: "audit_log" }[table]!;
      assert.equal(
        await count(setup, name),
        was,
        `K5 — consulting the switch wrote no ${name} row: a stop creates nothing and revokes nothing`,
      );
    }

    /* ═══ K13. ARMED + AUTHORIZED + DUE STILL REACHES THE RELEASED PATH ═════ */
    await armControl(setup, true);
    const allowed = await observeOnceUnderAuthorization(authAId, observeA);
    assert.equal(allowed.status, "observed", `K13 — armed, the released read path is reached: ${JSON.stringify(allowed)}`);
    if (allowed.status !== "observed") throw new Error("unreachable");
    assert.equal(allowed.record.status, "recorded", "K13 — and exactly one observation is stored");
    assert.equal(await count(setup, "provider_observations"), 1);

    /* ═══ K8. TWO CONCURRENT INVOCATIONS → AT MOST ONE RECORDED OBSERVATION ══ */
    /*
     * A DETERMINISTIC RACE, NOT A HOPEFUL ONE.
     *
     * Firing two writers with `Promise.all` and finding one row proves nothing on its own: the two
     * transactions may simply not have overlapped, and an earlier version of this proof passed with
     * the row lock REMOVED for exactly that reason. So the overlap is constructed instead.
     *
     * A separate connection takes the authorization's row lock and HOLDS it. The writer must then
     * block — which is the property under test — while that connection commits a competing machine
     * observation. When the lock is released the writer wakes, re-evaluates its window against a
     * state that now contains the competitor, and refuses. Every step is forced, and none of it
     * depends on scheduling.
     */
    const raceBase = new Date(Date.now() + (MIN_OBSERVATION_INTERVAL_MINUTES + 5) * 60_000);

    const holder = new Client({ connectionString: harness.dbUrl });
    await holder.connect();
    let writerSettled = false;
    let writerResult: Awaited<ReturnType<typeof recordAuthorizedProviderObservation>> | null = null;
    try {
      await holder.query("begin");
      await holder.query(
        `select 1 from standing_observation_authorizations where id = $1 for update`,
        [authAId],
      );

      const blocked = await mintObservationPrincipal(authAId, baseDeps);
      assert.equal(blocked.status, "minted");
      if (blocked.status !== "minted") throw new Error("unreachable");

      const pending = recordAuthorizedProviderObservation(
        blocked.principal,
        { observedAt: raceBase.toISOString(), facts: { viewCount: 21 } },
        baseDeps,
      ).then((r) => {
        writerSettled = true;
        writerResult = r;
        return r;
      });

      /* THE WRITER MUST WAIT. If it does not, there is no mutual exclusion to speak of. */
      await new Promise((resolve) => setTimeout(resolve, 750));
      assert.equal(
        writerSettled,
        false,
        "K8 — a second writer BLOCKS on the authorization's row lock instead of proceeding beside it",
      );

      /* The lock holder commits a competing observation, three milliseconds LATER than the waiter's. */
      await holder.query(
        `insert into provider_observations (
           tenant_id, integration_id, provider_key, capability_key, subject_kind, subject_ref,
           observed_at, observed_by_actor_type, observed_by_actor_id,
           standing_authorization_id, invocation_id, facts, facts_digest)
         values ($1,$2,$3,$4,$5,$6,$7,null,null,$8,gen_random_uuid(),'{}'::jsonb,repeat('0',64))`,
        [
          trh.tenantId, connection, YOUTUBE_PROVIDER_KEY, YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY,
          SUBJECT_KIND, subjectOf(CHANNEL_A), new Date(raceBase.getTime() + 3).toISOString(), authAId,
        ],
      );
      await holder.query("commit");

      const settled = await pending;
      assert.deepEqual(
        settled,
        { status: "refused", reason: "cadence-window-already-observed" },
        `K8 — once the lock is released the waiter re-reads and refuses: ${JSON.stringify(writerResult)}`,
      );
    } finally {
      await holder.query("rollback").catch(() => undefined);
      await holder.end().catch(() => undefined);
    }

    const inWindow = await setup.query<{ n: number }>(
      `select count(*)::int as n from provider_observations
        where subject_ref = $1 and standing_authorization_id is not null
          and observed_at between $2 and $3`,
      [
        subjectOf(CHANNEL_A),
        new Date(raceBase.getTime() - 60_000).toISOString(),
        new Date(raceBase.getTime() + 60_000).toISOString(),
      ],
    );
    assert.equal(
      inWindow.rows[0]!.n,
      1,
      "K8 — exactly ONE observation exists for that cadence window, not two",
    );

    /* ═══ K9. DIFFERENT AUTHORIZATIONS ARE NOT SERIALIZED AGAINST EACH OTHER ═ */
    const authB = await authorizeStandingObservation(
      ctx,
      {
        providerKey: YOUTUBE_PROVIDER_KEY, capabilityKey: YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY,
        subjectKind: SUBJECT_KIND, subjectRef: subjectOf(CHANNEL_B), integrationId: connection,
        intervalMinutes: MIN_OBSERVATION_INTERVAL_MINUTES, justification: JUSTIFICATION,
        observedAuthorizationRevision: null,
      },
      baseDeps,
    );
    assert.equal(authB.status, "authorized");
    if (authB.status !== "authorized") throw new Error("unreachable");
    const authBId = authB.authorization.authorizationId;

    const pA = await mintObservationPrincipal(authAId, baseDeps);
    const pB = await mintObservationPrincipal(authBId, baseDeps);
    assert.ok(pA.status === "minted" && pB.status === "minted");
    if (pA.status !== "minted" || pB.status !== "minted") throw new Error("unreachable");
    const far = new Date(raceBase.getTime() + (MIN_OBSERVATION_INTERVAL_MINUTES + 5) * 60_000);
    const parallel = await Promise.all([
      recordAuthorizedProviderObservation(pA.principal, { observedAt: far.toISOString(), facts: { viewCount: 31 } }, baseDeps),
      recordAuthorizedProviderObservation(pB.principal, { observedAt: far.toISOString(), facts: { viewCount: 32 } }, baseDeps),
    ]);
    assert.deepEqual(
      parallel.map((r) => r.status),
      ["recorded", "recorded"],
      "K9 — two DIFFERENT authorizations both record: the lock is per-authorization, not global",
    );

    /* ═══ K10. A FAILED TRANSACTION LEAVES NO LOCK AND NO STATE ═════════════ */
    /*
     * The row lock IS the transaction, so proving release means proving the next writer is not
     * blocked after one fails. A deliberately invalid instant aborts inside the writer; the very
     * next legitimate write must still succeed immediately, which it cannot do if anything leaked.
     */
    const pFail = await mintObservationPrincipal(authBId, baseDeps);
    assert.equal(pFail.status, "minted");
    if (pFail.status !== "minted") throw new Error("unreachable");
    const broken = await recordAuthorizedProviderObservation(
      pFail.principal, { observedAt: "not-an-instant", facts: { viewCount: 1 } }, baseDeps,
    );
    assert.equal(broken.status, "refused", "K10 — a malformed write is refused");

    const pAfter = await mintObservationPrincipal(authBId, baseDeps);
    assert.equal(pAfter.status, "minted");
    if (pAfter.status !== "minted") throw new Error("unreachable");
    const afterFailure = await recordAuthorizedProviderObservation(
      pAfter.principal,
      { observedAt: new Date(far.getTime() + (MIN_OBSERVATION_INTERVAL_MINUTES + 5) * 60_000).toISOString(), facts: { viewCount: 33 } },
      baseDeps,
    );
    assert.equal(
      afterFailure.status,
      "recorded",
      "K10 — and the next writer proceeds at once: nothing was left locked or reserved",
    );

    /* ═══ K7. WITHDRAWAL WINS ON ITS OWN TERMS, ARMED OR NOT ═══════════════ */
    const withdrawn = await withdrawStandingObservation(
      ctx,
      {
        providerKey: YOUTUBE_PROVIDER_KEY, capabilityKey: YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY,
        subjectKind: SUBJECT_KIND, subjectRef: subjectOf(CHANNEL_B), justification: WITHDRAWAL,
        observedAuthorizationRevision: 1,
      },
      baseDeps,
    );
    assert.equal(withdrawn.status, "authorized", `the grant is withdrawn: ${JSON.stringify(withdrawn)}`);

    const afterWithdrawalArmed = await observeOnceUnderAuthorization(authBId, {
      getDb, env, fetchImpl: fakeYouTube(CHANNEL_B, 41),
    });
    assert.deepEqual(
      afterWithdrawalArmed,
      { status: "not-authorized", reason: "authorization-withdrawn" },
      "K7 — with the switch ARMED, a withdrawn lineage still refuses, and reports ITS OWN reason",
    );

    await armControl(setup, false);
    const afterWithdrawalStopped = await observeOnceUnderAuthorization(authBId, {
      getDb, env, fetchImpl: fakeYouTube(CHANNEL_B, 41),
    });
    assert.equal(
      afterWithdrawalStopped.status,
      "not-authorized",
      "K7 — and a disabled switch cannot DISGUISE a withdrawal: the more specific fact still wins",
    );
    await armControl(setup, true);

    /* ═══ K14 / K15 / K16. NOTHING ELSE MOVED ══════════════════════════════ */
    for (const table of [
      "action_permits", "action_execution_attempts", "knowledge_facts", "knowledge_nodes",
      "work_items", "work_artifacts", "agents", "agent_mandates",
    ]) {
      assert.equal(await count(setup, table), 0, `${table} is empty — observation reaches no other authority`);
    }
    assert.equal(await count(setup, "users"), 1, "K16 — no service user was created");
    assert.equal(await count(setup, "memberships"), 1, "K16 — and no machine membership");

    const humanRows = await setup.query<{ n: number }>(
      `select count(*)::int as n from provider_observations where observed_by_actor_type = 'human'`,
    );
    assert.equal(humanRows.rows[0]!.n, 0, "K14 — this suite wrote no human rows, and altered none");
    const machineRows = await setup.query<{ n: number }>(
      `select count(*)::int as n from provider_observations
        where observed_by_actor_type is null and standing_authorization_id is not null`,
    );
    assert.equal(
      machineRows.rows[0]!.n,
      await count(setup, "provider_observations"),
      "K14 — every row written here is machine-sourced with a NULL actor pair",
    );

    console.log(
      `trh25-observation-control/control-postgres: ${await count(setup, "provider_observations")} observations, ` +
        "1 concurrent race collapsed to 1 row, 0 permits, 0 executions, 0 invented tables",
    );
  } finally {
    await setup.end().catch(() => undefined);
    await handle.dispose().catch(() => undefined);
    await harness.dropDatabase();
  }
}

void main();
