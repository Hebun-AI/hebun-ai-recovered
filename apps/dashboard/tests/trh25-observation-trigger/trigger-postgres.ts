/*
 * TRH-25 — the automatic due-observation trigger, against a REAL PostgreSQL database and through
 * the REAL route handler.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "An authenticated machine request, carrying no scope of any kind, discovers a due standing
 *    authorization server-side and reaches the released TRH-24 read path. An unauthenticated one
 *    touches nothing. A not-due one contacts no provider. The operator's stop, withdrawal and
 *    cadence each refuse BEFORE transport. Two simultaneous triggers record at most one
 *    observation. A provider failure records nothing, and a persistence refusal is never reported
 *    as success. Governance, permits, executions, Knowledge, Work, agents and identities do not
 *    move, and the human observation path is unchanged."
 *
 * The provider is a FAKE FETCH. What is real is the database, the route, the authorities and the
 * concurrency.
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
import { listActiveStandingObservationsForRuntime } from "../../src/features/standing-observation-authority/read-standing-observations.server";
import { scanDueObservations } from "../../src/features/observation-trigger/scan-due-observations.server";
import { recordProviderObservation } from "../../src/features/provider-observation-history/write-provider-observation.server";
import {
  MIN_OBSERVATION_INTERVAL_MINUTES,
  OBSERVATION_READ_CONTROL_KEY,
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

const CHANNEL = "UCtrh25trigger";
const SUBJECT_KIND = "youtube-channel";
const SUBJECT_REF = `youtube/channel/${CHANNEL}`;
const SECRET = "trh25-fixture-trigger-secret";

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

let providerCalls = 0;

function fakeYouTube(views: number): typeof fetch {
  return (async (input: string) => {
    providerCalls += 1;
    const url = String(input);
    if (url.includes("/channels")) {
      if (!url.includes(`id=${CHANNEL}`) || url.includes("forHandle")) {
        return new Response(JSON.stringify({ items: [] }), {
          status: 200, headers: { "content-type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({
          items: [{
            id: CHANNEL,
            snippet: { title: "Fixture", customUrl: "@fixture", publishedAt: "2026-01-01T00:00:00Z" },
            statistics: { viewCount: String(views), subscriberCount: "0", videoCount: "0" },
            contentDetails: { relatedPlaylists: { uploads: "UUfixture" } },
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

const brokenYouTube = (async () => {
  providerCalls += 1;
  return new Response("upstream", { status: 503 });
}) as unknown as typeof fetch;

async function armControl(c: Client, enabled: boolean): Promise<void> {
  await c.query(
    `insert into provider_connectivity_controls (provider_key, director_enabled, control_source)
          values ($1, $2, 'local-operator-ceremony')
     on conflict (provider_key) do update set director_enabled = $2, updated_at = now()`,
    [OBSERVATION_READ_CONTROL_KEY, enabled],
  );
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_trh25_trigger");
  await harness.createDatabase();
  harness.migrateDatabase();

  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const getDb = () => handle.db;
  const baseDeps = { getDb };

  /* The route reads its secret and its database from the environment, exactly as production does. */
  process.env.DATABASE_URL = harness.dbUrl;
  process.env.HEBUN_CONTROL_PLANE_ALLOW_REMOTE = "true";
  process.env.HEBUN_OBSERVATION_TRIGGER_SECRET = SECRET;
  const { GET } = await import("../../src/app/api/observation/scan/route");
  const call = (headers: Record<string, string> = {}) =>
    GET(new Request("https://hebun.test/api/observation/scan", { headers }));

  try {
    /* ═══ 1. THE ROUTE REFUSES BEFORE IT READS ANYTHING ═════════════════════ */
    for (const [label, headers] of [
      ["no header at all", {}],
      ["an empty bearer", { authorization: "Bearer " }],
      ["a wrong secret", { authorization: "Bearer not-the-secret" }],
      ["a right secret with the wrong scheme", { authorization: `Basic ${SECRET}` }],
      ["the secret with no scheme", { authorization: SECRET }],
      ["a prefix of the secret", { authorization: `Bearer ${SECRET.slice(0, -1)}` }],
      ["the secret plus a suffix", { authorization: `Bearer ${SECRET}x` }],
    ] as const) {
      const res = await call(headers as Record<string, string>);
      assert.equal(res.status, 401, `unauthenticated (${label}) is refused`);
      assert.equal(await res.text(), "Unauthorized", "and told nothing about which half failed");
    }
    assert.equal(providerCalls, 0, "no unauthenticated request contacted a provider");
    assert.equal(await count(setup, "provider_observations"), 0, "and none read or wrote a row");

    /*
     * AN UNSET SECRET REFUSES EVEN A CORRECT-LOOKING CALL. An unconfigured deployment is CLOSED.
     */
    delete process.env.HEBUN_OBSERVATION_TRIGGER_SECRET;
    assert.equal(
      (await call({ authorization: `Bearer ${SECRET}` })).status,
      401,
      "with no secret configured, every request is refused — including the right one",
    );
    process.env.HEBUN_OBSERVATION_TRIGGER_SECRET = SECRET;

    /* ═══ 2. AUTHENTICATED, AND NOTHING TO DO ══════════════════════════════ */
    const empty = await call({ authorization: `Bearer ${SECRET}` });
    assert.equal(empty.status, 200, "an authenticated scan of an empty deployment succeeds");
    const emptyBody = (await empty.json()) as { considered: number; attempted: number; recorded: number };
    assert.deepEqual(
      { considered: emptyBody.considered, attempted: emptyBody.attempted, recorded: emptyBody.recorded },
      { considered: 0, attempted: 0, recorded: 0 },
      "with no authorizations there is nothing to consider",
    );
    assert.equal(providerCalls, 0, "and no provider was contacted");

    /*
     * AN UNREADABLE REGISTER IS NOT AN EMPTY ONE.
     *
     * "Nothing was due" and "we could not find out what was due" are different facts, and reporting
     * the second as the first would turn an outage into a silent, permanent pause that looks
     * healthy on every dashboard. Proved at both layers: the scan refuses, and the route answers
     * 503 rather than a cheerful 200 with zeros.
     */
    const blind = await scanDueObservations({ getDb: () => null });
    assert.deepEqual(
      blind,
      { status: "unavailable", reason: "persistence-unavailable" },
      "an unreadable register FAILS CLOSED and is never reported as an empty scan",
    );

    const savedUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    const unreadable = await call({ authorization: `Bearer ${SECRET}` });
    assert.equal(
      unreadable.status,
      503,
      "and the route reports a fault, never a successful scan of nothing",
    );
    process.env.DATABASE_URL = savedUrl;

    /* ═══ 3. A TENANT, GOVERNANCE, A CONNECTION, A CREDENTIAL, AN AUTHORIZATION ═══ */
    const trh = await seedLocalIdentity(setup, {
      companyName: "Turkish Rug House", companySlug: "trh-25-trigger", email: "director@trh.test", roleType: "owner",
    });
    const ctx = contextFor(trh, await sessionRowFor(setup, trh, "ccc1"), "trh25t");
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
    process.env.HEBUN_INTEGRATION_ENCRYPTION_KEYS = env.HEBUN_INTEGRATION_ENCRYPTION_KEYS;
    process.env.HEBUN_INTEGRATION_ENCRYPTION_ACTIVE_KEY_ID = "k1";
    assert.equal(
      (await storeCredential(ctx, { integrationId: connection, kind: "api_key", plaintext: "AIzaFIXTURE" }, { getDb, env })).status,
      "stored",
    );
    await setup.query(
      `update integrations set connection_state = 'connected', health = 'healthy',
              last_verified_at = now() where id = $1`,
      [connection],
    );

    const authorized = await authorizeStandingObservation(
      ctx,
      {
        providerKey: YOUTUBE_PROVIDER_KEY, capabilityKey: YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY,
        subjectKind: SUBJECT_KIND, subjectRef: SUBJECT_REF, integrationId: connection,
        intervalMinutes: MIN_OBSERVATION_INTERVAL_MINUTES, justification: JUSTIFICATION,
        observedAuthorizationRevision: null,
      },
      baseDeps,
    );
    assert.equal(authorized.status, "authorized");
    if (authorized.status !== "authorized") throw new Error("unreachable");
    const authorizationId = authorized.authorization.authorizationId;

    /*
     * GOVERNANCE, COUNTED BEFORE ANY SCAN RUNS. Everything below is measured as a DELTA against
     * this, because an absolute would be a statement about the fixture rather than about what the
     * trigger did.
     */
    const governanceBeforeScans = {
      decisions: await count(setup, "decision_records"),
      sessions: await count(setup, "governance_sessions"),
      authorizations: await count(setup, "standing_observation_authorizations"),
    };

    /* ═══ 4. THE REGISTER IS SERVER-SIDE AND TAKES NO SCOPE ════════════════ */
    const register = await listActiveStandingObservationsForRuntime(baseDeps);
    assert.equal(register.status, "read");
    if (register.status !== "read") throw new Error("unreachable");
    assert.equal(register.authorizations.length, 1, "one active authorization is discoverable");
    const discovered = register.authorizations[0]!;
    assert.equal(discovered.authorizationId, authorizationId);
    assert.equal(discovered.tenantId, trh.tenantId, "the tenant came from the ROW, not from a caller");
    assert.equal(discovered.subjectRef, SUBJECT_REF);
    assert.equal(discovered.integrationId, connection);

    /* ═══ 5. THE OPERATOR'S STOP REFUSES BEFORE TRANSPORT ══════════════════ */
    await armControl(setup, false);
    providerCalls = 0;
    const stopped = await call({ authorization: `Bearer ${SECRET}` });
    assert.equal(stopped.status, 200, "a stopped scan is a completed scan, not a server fault");
    const stoppedBody = (await stopped.json()) as {
      attempted: number; recorded: number;
      outcomes: readonly { outcome: { status: string; reason?: string } }[];
    };
    assert.equal(stoppedBody.recorded, 0, "nothing was recorded");
    assert.deepEqual(
      stoppedBody.outcomes.map((o) => [o.outcome.status, o.outcome.reason]),
      [["refused", "observation-read-disabled"]],
      "and the scan reports the operator's stop as ITSELF, not as a provider failure",
    );
    assert.equal(providerCalls, 0, "THE PROVIDER WAS NEVER CONTACTED — the stop precedes transport");
    assert.equal(await count(setup, "provider_observations"), 0);

    /* ═══ 6. ARMED AND DUE — THE RELEASED TRH-24 PATH IS REACHED ═══════════ */
    await armControl(setup, true);
    providerCalls = 0;
    const scanned = await scanDueObservations({ ...baseDeps, env, fetchImpl: fakeYouTube(11) });
    assert.equal(scanned.status, "scanned");
    if (scanned.status !== "scanned") throw new Error("unreachable");
    assert.equal(scanned.recorded, 1, `one due authorization was observed: ${JSON.stringify(scanned)}`);
    assert.equal(scanned.outcomes[0]!.outcome.status, "recorded");
    assert.ok(providerCalls > 0, "and the provider WAS contacted this time");

    const stored = await setup.query<{
      observed_by_actor_type: string | null; observed_by_actor_id: string | null;
      standing_authorization_id: string | null; invocation_id: string | null; tenant_id: string;
    }>(`select * from provider_observations`);
    assert.equal(stored.rows.length, 1, "exactly one observation exists");
    const row = stored.rows[0]!;
    assert.equal(row.observed_by_actor_type, null, "NO HUMAN ACTOR — no human session was involved");
    assert.equal(row.observed_by_actor_id, null);
    assert.equal(row.standing_authorization_id, authorizationId, "provenance is the authorization");
    assert.ok(row.invocation_id, "and the invocation that performed it");
    assert.equal(row.tenant_id, trh.tenantId);

    /* ═══ 7. NOT DUE — A SECOND SCAN CONTACTS NO PROVIDER ══════════════════ */
    providerCalls = 0;
    const notDue = await scanDueObservations({ ...baseDeps, env, fetchImpl: fakeYouTube(12) });
    assert.equal(notDue.status, "scanned");
    if (notDue.status !== "scanned") throw new Error("unreachable");
    assert.equal(notDue.attempted, 0, "nothing was attempted");
    assert.equal(notDue.outcomes[0]!.outcome.status, "not-due");
    assert.equal(providerCalls, 0, "and NO PROVIDER CALL was spent discovering that");
    assert.equal(await count(setup, "provider_observations"), 1);

    /* ═══ 8. TWO SIMULTANEOUS TRIGGERS → AT MOST ONE OBSERVATION ═══════════ */
    /*
     * Both scans are told the cadence has elapsed, so BOTH pass the courtesy check and both reach
     * the released composition. What stops the second row is the prerequisite concurrency
     * guarantee, not the trigger — which is the point: the trigger adds no protection of its own
     * and needs none.
     */
    const later = new Date(Date.now() + (MIN_OBSERVATION_INTERVAL_MINUTES + 5) * 60_000);
    providerCalls = 0;
    const [a, b] = await Promise.all([
      scanDueObservations({ ...baseDeps, env, fetchImpl: fakeYouTube(21), now: () => later }),
      scanDueObservations({ ...baseDeps, env, fetchImpl: fakeYouTube(21), now: () => later }),
    ]);
    const observationsAfterRace = await count(setup, "provider_observations");
    assert.equal(
      observationsAfterRace,
      2,
      `two simultaneous triggers add AT MOST ONE row: ${JSON.stringify([a, b])}`,
    );
    const recordedCount = [a, b].filter(
      (r) => r.status === "scanned" && r.recorded === 1,
    ).length;
    assert.equal(recordedCount, 1, "exactly one scan recorded");

    /*
     * AND THE LOSER SAYS SO. Counting rows proves the database held the line; this proves the
     * REPORT did too. A scan that called a suppressed write "recorded" would leave two successes in
     * a log beside one row, and the log is what an operator reads.
     */
    const raceStatuses = [a, b].flatMap((r) =>
      r.status === "scanned" ? r.outcomes.map((o) => o.outcome.status) : [],
    );
    /*
     * THE LOSER'S EXACT WORD IS TIMING-DEPENDENT AND THE INVARIANT IS NOT. If the winner commits
     * before the loser revalidates, the cadence ceiling refuses it and no provider is contacted at
     * all; if the loser is already past revalidation, the write suppresses it. Both are correct and
     * neither is a second success. Asserting one of them specifically would be asserting a schedule.
     */
    assert.equal(
      raceStatuses.filter((s) => s === "recorded").length,
      1,
      "exactly ONE of two simultaneous scans reports a recorded observation",
    );
    assert.ok(
      raceStatuses.every((s) => s === "recorded" || s === "refused" || s === "duplicate-suppressed"),
      `the loser is refused or suppressed, never a second success: ${JSON.stringify(raceStatuses)}`,
    );

    /* ═══ 9. A PROVIDER FAILURE RECORDS NOTHING ════════════════════════════ */
    const evenLater = new Date(later.getTime() + (MIN_OBSERVATION_INTERVAL_MINUTES + 5) * 60_000);
    const before = await count(setup, "provider_observations");
    const failed = await scanDueObservations({
      ...baseDeps, env, fetchImpl: brokenYouTube, now: () => evenLater,
    });
    assert.equal(failed.status, "scanned");
    if (failed.status !== "scanned") throw new Error("unreachable");
    assert.equal(failed.outcomes[0]!.outcome.status, "provider-failed");
    assert.equal(failed.recorded, 0, "a failed read is NOT reported as recorded");
    assert.equal(await count(setup, "provider_observations"), before, "and stored nothing");

    /*
     * EVERY SCAN SO FAR — stopped, armed, not-due, raced and failed — AUTHORED NO GOVERNANCE.
     * Measured here, before the withdrawal deliberately adds one, so the withdrawal cannot mask it.
     */
    assert.deepEqual(
      {
        decisions: await count(setup, "decision_records"),
        sessions: await count(setup, "governance_sessions"),
        authorizations: await count(setup, "standing_observation_authorizations"),
      },
      governanceBeforeScans,
      "no scan wrote a decision, a session or an authorization revision",
    );

    /* ═══ 10. WITHDRAWAL REFUSES, AND SAYS SO IN ITS OWN WORDS ═════════════ */
    assert.equal(
      (await withdrawStandingObservation(
        ctx,
        {
          providerKey: YOUTUBE_PROVIDER_KEY, capabilityKey: YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY,
          subjectKind: SUBJECT_KIND, subjectRef: SUBJECT_REF, justification: WITHDRAWAL,
          observedAuthorizationRevision: 1,
        },
        baseDeps,
      )).status,
      "authorized",
    );

    const afterWithdrawal = await listActiveStandingObservationsForRuntime(baseDeps);
    assert.equal(afterWithdrawal.status, "read");
    if (afterWithdrawal.status !== "read") throw new Error("unreachable");
    assert.deepEqual(
      afterWithdrawal.authorizations,
      [],
      "a withdrawn lineage is NOT attemptable — the register drops it entirely",
    );

    providerCalls = 0;
    const withdrawnScan = await scanDueObservations({
      ...baseDeps, env, fetchImpl: fakeYouTube(31), now: () => evenLater,
    });
    assert.equal(withdrawnScan.status, "scanned");
    if (withdrawnScan.status !== "scanned") throw new Error("unreachable");
    assert.deepEqual(
      { considered: withdrawnScan.considered, attempted: withdrawnScan.attempted },
      { considered: 0, attempted: 0 },
      "and the scan considers nothing",
    );
    assert.equal(providerCalls, 0, "no provider was contacted after withdrawal");

    /* ═══ 11. THE HUMAN PATH IS UNCHANGED ══════════════════════════════════ */
    const humanWrite = await recordProviderObservation(
      ctx,
      {
        providerKey: YOUTUBE_PROVIDER_KEY, capabilityKey: YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY,
        subjectKind: SUBJECT_KIND, subjectRef: SUBJECT_REF, integrationId: connection,
        observedAt: "2026-08-01T10:00:00.000Z", facts: { viewCount: 5 },
      },
      baseDeps,
    );
    assert.equal(humanWrite.status, "recorded", "the released human path still works");
    const human = await setup.query<{ n: number }>(
      `select count(*)::int as n from provider_observations
        where observed_by_actor_type = 'human' and standing_authorization_id is null`,
    );
    assert.equal(human.rows[0]!.n, 1, "and its row carries a human actor and NO authorization");

    /* ═══ 12. THE TRIGGER MOVED NOTHING ELSE ═══════════════════════════════ */
    for (const table of [
      "action_permits", "action_execution_attempts", "knowledge_facts", "knowledge_nodes",
      "work_items", "work_artifacts", "agents", "agent_mandates",
    ]) {
      assert.equal(await count(setup, table), 0, `${table} is empty — a trigger observes nothing else`);
    }
    assert.equal(await count(setup, "users"), 1, "no service user was created");
    assert.equal(await count(setup, "memberships"), 1, "no machine membership was created");
    assert.equal(
      await count(setup, "decision_records") - governanceBeforeScans.decisions,
      1,
      "exactly ONE decision was added after the scans began, and it is the human WITHDRAWAL",
    );

    console.log(
      `trh25-observation-trigger/trigger-postgres: ${await count(setup, "provider_observations")} observations ` +
        "(1 human, rest machine), 1 race collapsed, 0 permits, 0 executions, 0 machine identities",
    );
  } finally {
    await setup.end().catch(() => undefined);
    await handle.dispose().catch(() => undefined);
    await harness.dropDatabase();
  }
}

void main();
