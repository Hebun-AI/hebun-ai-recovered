/*
 * TRH-24 — machine-sourced manual observation, against a REAL PostgreSQL database.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "One manually initiated, Governance-authorized machine provider READ can be stored with truthful
 *    authorization + invocation provenance and NO human actor. The existing human-sourced row stays
 *    valid. Exactly one provenance mode is representable. One invocation stores at most one sample.
 *    A withdrawn or superseded authorization observes nothing. The cadence ceiling refuses a second
 *    read. A failed provider read stores nothing and spends no ceiling. No permit, no execution, no
 *    Governance decision, no Knowledge, no Work, no scheduler and no machine identity appears."
 *
 * The provider is a FAKE FETCH. This suite proves the composition, the provenance and the
 * constraints — never that YouTube answers, which is not a fact a test can own.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { authorizeStandingObservation, withdrawStandingObservation } from "../../src/features/standing-observation-authority/authorize-standing-observation.server";
import { mintObservationPrincipal } from "../../src/features/standing-observation-authority/observation-principal.server";
import { observeOnceUnderAuthorization } from "../../src/features/provider-observation-history/observe-once-under-authorization.server";
import { recordAuthorizedProviderObservation } from "../../src/features/provider-observation-history/write-provider-observation.server";
import { recordProviderObservation } from "../../src/features/provider-observation-history/write-provider-observation.server";
import { readProviderObservations, readLatestAuthorizedObservationAt } from "../../src/features/provider-observation-history/read-provider-observations.server";
import { YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY, YOUTUBE_PROVIDER_KEY } from "../../src/features/provider-youtube/contracts";
import { MIN_OBSERVATION_INTERVAL_MINUTES, OBSERVATION_READ_CONTROL_KEY } from "../../src/features/standing-observation-authority/contracts";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";

const JUSTIFICATION =
  "I am authorizing this organization's own public channel to be observed on a bounded cadence, and I accept responsibility for that.";
const WITHDRAWAL =
  "We are pausing standing observation of this channel while we review what we do with the numbers.";

const CHANNEL_ID = "UCtrh24fixture";
const SUBJECT_REF = `youtube/channel/${CHANNEL_ID}`;
const SUBJECT_KIND = "youtube-channel";

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

/** A YouTube that answers. Two calls: the channel, then its (absent) uploads playlist. */
function fakeYouTube(views: number): typeof fetch {
  return (async (input: string) => {
    const url = String(input);
    if (url.includes("/channels")) {
      /*
       * THE FAKE ANSWERS ONLY FOR THE AUTHORIZED CHANNEL ID, AND OTHERWISE REPORTS NOTHING.
       *
       * It does NOT assert: an assertion thrown inside `fetch` is caught by the released transport
       * and surfaces as a generic transport failure, which would make a subject-substitution bug
       * indistinguishable from a network problem. Answering "no such channel" instead lets the
       * substitution fail as what it is.
       */
      if (!url.includes(`id=${CHANNEL_ID}`) || url.includes("forHandle")) {
        return new Response(JSON.stringify({ items: [] }), {
          status: 200, headers: { "content-type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({
          items: [{
            id: CHANNEL_ID,
            snippet: { title: "Fixture Channel", customUrl: "@fixture", publishedAt: "2026-01-01T00:00:00Z" },
            statistics: { viewCount: String(views), subscriberCount: "0", videoCount: "0" },
            contentDetails: { relatedPlaylists: { uploads: "UUtrh24fixture" } },
          }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    /* A channel reporting zero videos whose uploads playlist 404s — the released TRH-20 exception. */
    return new Response(JSON.stringify({ error: { message: "playlistNotFound" } }), {
      status: 404, headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
}

/** A YouTube that does not answer. */
const brokenYouTube = (async () =>
  new Response("upstream", { status: 503 })) as unknown as typeof fetch;

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_trh24_machine");
  await harness.createDatabase();
  harness.migrateDatabase();

  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const getDb = () => handle.db;
  const baseDeps = { getDb };

  try {
    /* ═══ 0. THE MIGRATION EVOLVED THE PROVENANCE, AND SAYS SO ═══════════════ */
    const cols = await setup.query<{ column_name: string; is_nullable: string }>(
      `select column_name, is_nullable from information_schema.columns
        where table_name = 'provider_observations' order by column_name`,
    );
    const nullable = new Map(cols.rows.map((r) => [r.column_name, r.is_nullable]));
    assert.equal(nullable.get("observed_by_actor_type"), "YES", "the human actor pair is now nullable");
    assert.equal(nullable.get("observed_by_actor_id"), "YES");
    assert.equal(nullable.get("standing_authorization_id"), "YES", "and so is the machine pair");
    assert.equal(nullable.get("invocation_id"), "YES");
    for (const forbidden of ["service_account_id", "machine_user_id", "principal_id", "next_run_at", "schedule_id"]) {
      assert.ok(!nullable.has(forbidden), `no '${forbidden}' — TRH-24 invents no machine identity`);
    }

    const checks = await setup.query<{ conname: string }>(
      `select conname from pg_constraint where conrelid = to_regclass($1) and contype = 'c' order by conname`,
      ["public.provider_observations"],
    );
    assert.deepEqual(
      checks.rows.map((r) => r.conname),
      [
        "provider_observations_human_actor_pair_chk",
        "provider_observations_machine_provenance_pair_chk",
        "provider_observations_provenance_mode_chk",
      ],
      "three provenance invariants, and no others",
    );

    /* ═══ 1. A TENANT, GOVERNANCE, A CONNECTION AND A CREDENTIAL ═════════════ */
    const trh = await seedLocalIdentity(setup, {
      companyName: "Turkish Rug House", companySlug: "trh-24", email: "director@trh.test", roleType: "owner",
    });
    const ctx = contextFor(trh, await sessionRowFor(setup, trh, "aaa1"), "trh24");

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
        /*
         * A VERIFIED connection. `last_verified_at` is not decoration: the released capability
         * authority reports `unverified` without it, and refuses the read — which is correct, and
         * is why the fixture has to satisfy it rather than the authority being relaxed.
         */
        `insert into integrations (tenant_id, provider_key, name, status, connection_state, health,
                                   last_verified_at, created_by, created_by_type)
         values ($1,'youtube','YouTube','connected','connected','healthy', now(), $2,'human') returning id`,
        [trh.tenantId, trh.userId],
      )
    ).rows[0]!.id;

    /* A real encrypted api_key, through the released credential authority. */
    const { storeCredential } = await import("../../src/features/integration-credentials/credential-repository.server");
    /* `keyId:base64Key`, comma-separated — the released registry's own encoding, not JSON. */
    const env = {
      HEBUN_INTEGRATION_ENCRYPTION_KEYS: `k1:${Buffer.alloc(32, 7).toString("base64")}`,
      HEBUN_INTEGRATION_ENCRYPTION_ACTIVE_KEY_ID: "k1",
    };
    const stored = await storeCredential(
      ctx, { integrationId: connection, kind: "api_key", plaintext: "AIzaFIXTUREKEY" }, { getDb, env },
    );
    assert.equal(stored.status, "stored", `the fixture connection holds one live api_key: ${JSON.stringify(stored)}`);

    /*
     * ATTACHING A CREDENTIAL MOVES THE CONNECTION BACK TO `unverified`, by released INT-2 doctrine:
     * a new secret has not been confirmed against the provider yet. Verification is a released
     * ceremony that spends a real provider call, which this suite deliberately does not perform — so
     * the fixture states the verified outcome directly, AFTER the attach rather than before it.
     */
    await setup.query(
      `update integrations set connection_state = 'connected', health = 'healthy',
              last_verified_at = now() where id = $1`,
      [connection],
    );

    /* ═══ 2. THE EXISTING HUMAN ROW STILL SATISFIES THE NEW SCHEMA ═══════════ */
    const humanWrite = await recordProviderObservation(
      ctx,
      {
        providerKey: YOUTUBE_PROVIDER_KEY, capabilityKey: YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY,
        subjectKind: SUBJECT_KIND, subjectRef: SUBJECT_REF, integrationId: connection,
        observedAt: "2026-09-01T10:00:00.000Z", facts: { viewCount: 5 },
      },
      baseDeps,
    );
    assert.equal(humanWrite.status, "recorded", "the released human path is unchanged and still works");

    const humanRow = await setup.query<{
      observed_by_actor_type: string | null; observed_by_actor_id: string | null;
      standing_authorization_id: string | null; invocation_id: string | null;
    }>(`select observed_by_actor_type, observed_by_actor_id, standing_authorization_id, invocation_id
          from provider_observations`);
    assert.equal(humanRow.rows[0]!.observed_by_actor_type, "human");
    assert.equal(humanRow.rows[0]!.observed_by_actor_id, trh.userId);
    assert.equal(humanRow.rows[0]!.standing_authorization_id, null, "a human row carries no authorization");
    assert.equal(humanRow.rows[0]!.invocation_id, null);

    /* ═══ 3. THE DATABASE REFUSES EVERY DISHONEST PROVENANCE ═════════════════ */
    const rawInsert = (cols: string, vals: string, params: unknown[]) =>
      setup.query(
        `insert into provider_observations
           (tenant_id, integration_id, provider_key, capability_key, subject_kind, subject_ref,
            observed_at, facts, facts_digest${cols})
         values ($1,$2,'youtube',$3,$4,$5,now(),'{}'::jsonb,repeat('a',64)${vals})`,
        [trh.tenantId, connection, YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY, SUBJECT_KIND, SUBJECT_REF, ...params],
      );

    await assert.rejects(
      () => rawInsert("", "", []),
      /provider_observations_provenance_mode_chk/,
      "EMPTY provenance is refused — an unattributed observation is unrepresentable",
    );
    await assert.rejects(
      () => rawInsert(", observed_by_actor_type", ", 'human'", []),
      /provider_observations_human_actor_pair_chk/,
      "half a human pair is refused",
    );
    await assert.rejects(
      () => rawInsert(", standing_authorization_id", ", $6", [randomUUID()]),
      /provider_observations_machine_provenance_pair_chk/,
      "half a machine pair is refused",
    );

    /* ═══ 4. AUTHORIZE, THEN OBSERVE ONCE ════════════════════════════════════ */
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
    const authorizationId = (authorized as { authorization: { authorizationId: string } }).authorization.authorizationId;

    /*
     * THE HUMAN BASELINE DOES NOT BLOCK THE FIRST MACHINE READ.
     *
     * A human observed this exact scope minutes ago. The cadence ceiling bounds exercises of the
     * STANDING AUTHORIZATION, and a human read is not one — it never touches the authorization at
     * all. If this assertion ever fails, the ceiling has silently become retroactive.
     */
    const cadenceBefore = await readLatestAuthorizedObservationAt(
      { tenantId: trh.tenantId },
      { providerKey: YOUTUBE_PROVIDER_KEY, capabilityKey: YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY, subjectRef: SUBJECT_REF },
      baseDeps,
    );
    assert.equal(cadenceBefore.status, "read");
    assert.equal(
      (cadenceBefore as { observedAt: string | null }).observedAt,
      null,
      "the human baseline is not counted against the authorization's cadence ceiling",
    );

    const before = {
      observations: await count(setup, "provider_observations"),
      permits: await count(setup, "action_permits"),
      executions: await count(setup, "action_execution_attempts"),
      decisions: await count(setup, "decision_records"),
      authorizations: await count(setup, "standing_observation_authorizations"),
      credentials: await count(setup, "integration_credentials"),
      knowledge: await count(setup, "knowledge_facts"),
      work: await count(setup, "work_items"),
      agents: await count(setup, "agents"),
      mandates: await count(setup, "agent_mandates"),
      users: await count(setup, "users"),
      memberships: await count(setup, "memberships"),
      audit: await count(setup, "audit_log"),
    };

    /*
     * ═══ 3B. THE OPERATOR'S STOP GATES THIS SUITE'S OWN SUCCESS (TRH-25 prerequisite) ═══
     *
     * Nothing below could run before this block existed. The kill switch fails closed on an ABSENT
     * row, so a freshly migrated deployment refuses every machine read until an operator arms one —
     * and this released acceptance suite proving that first, in its own fixture, is a stronger
     * statement than a dedicated test asserting it in isolation: the manual TRH-24 ceremony has no
     * exemption, and if it ever gained one this assertion is where it would surface.
     */
    const stopped = await observeOnceUnderAuthorization(authorizationId, {
      getDb, env, fetchImpl: fakeYouTube(99),
    });
    assert.deepEqual(
      stopped,
      { status: "refused", reason: "observation-read-disabled" },
      "with no control row, a fully authorized machine read is refused and no provider is contacted",
    );
    assert.equal(
      await count(setup, "provider_observations"),
      before.observations,
      "a stopped read writes nothing at all",
    );

    /* The operator arms it — the row the deployment-possession ceremony writes, written directly. */
    await setup.query(
      `insert into provider_connectivity_controls (provider_key, director_enabled, control_source)
            values ($1, true, 'local-operator-ceremony')`,
      [OBSERVATION_READ_CONTROL_KEY],
    );

    const observeDeps = { getDb, env, fetchImpl: fakeYouTube(99) };
    const outcome = await observeOnceUnderAuthorization(authorizationId, observeDeps);
    assert.equal(outcome.status, "observed", `one authorized machine read succeeds: ${JSON.stringify(outcome)}`);
    if (outcome.status !== "observed") throw new Error("unreachable");
    assert.equal(outcome.record.status, "recorded", "and exactly one observation is stored");

    /* ═══ 5. THE STORED ROW TELLS THE TRUTH ═════════════════════════════════ */
    const machine = await setup.query<{
      observed_by_actor_type: string | null; observed_by_actor_id: string | null;
      standing_authorization_id: string | null; invocation_id: string | null;
      tenant_id: string; integration_id: string; provider_key: string; capability_key: string;
      subject_kind: string; subject_ref: string; facts: Record<string, unknown>;
    }>(`select * from provider_observations where invocation_id is not null`);
    assert.equal(machine.rows.length, 1, "exactly one machine-sourced row");
    const m = machine.rows[0]!;
    assert.equal(m.observed_by_actor_type, null, "NO HUMAN ACTOR — because no human performed it");
    assert.equal(m.observed_by_actor_id, null);
    assert.equal(m.standing_authorization_id, authorizationId, "the authorization that made it legitimate");
    assert.equal(m.invocation_id, outcome.invocationId, "and the run that performed it");
    assert.equal(m.tenant_id, trh.tenantId, "the tenant is the authorization's");
    assert.equal(m.integration_id, connection, "through the connection the authorization named");
    assert.equal(m.provider_key, YOUTUBE_PROVIDER_KEY, "the provider is the authorization's");
    assert.equal(m.capability_key, YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY, "the capability is the authorization's");
    assert.equal(m.subject_ref, SUBJECT_REF, "the subject is the authorization's, never a caller's");

    /* NO SECRET, NO RAW PAYLOAD. The closed projection is all that is stored. */
    const factsText = JSON.stringify(m.facts);
    for (const trace of ["AIza", "key=", "Authorization", "etag", "kind\":\"youtube#", "items"]) {
      assert.ok(!factsText.includes(trace), `the stored facts carry no ${trace}`);
    }

    /* The reader reports the mode rather than making a caller guess. */
    const read = await readProviderObservations(ctx, {}, baseDeps);
    assert.equal(read.status, "read");
    const modes = (read as { observations: readonly { provenance: string }[] }).observations.map((o) => o.provenance);
    assert.deepEqual([...modes].sort(), ["human", "standing-authorization"], "both modes are readable and distinguished");

    /* ═══ 6. IDEMPOTENCY — ONE INVOCATION, AT MOST ONE SAMPLE ═══════════════ */
    /*
     * The SAME principal is used twice, with DIFFERENT instants and DIFFERENT facts. The instant
     * index therefore cannot be what refuses the second write — only the invocation index can, which
     * is precisely the property under test. The instants are in the past so that the cadence read,
     * which takes the newest, is unaffected by this fixture.
     */
    const p6 = await mintObservationPrincipal(authorizationId, baseDeps);
    assert.equal(p6.status, "minted");
    if (p6.status !== "minted") throw new Error("unreachable");

    const firstWrite = await recordAuthorizedProviderObservation(
      p6.principal, { observedAt: "2026-08-01T10:00:00.000Z", facts: { viewCount: 7 } }, baseDeps,
    );
    assert.equal(firstWrite.status, "recorded", "one invocation stores its sample");

    const replay = await recordAuthorizedProviderObservation(
      p6.principal, { observedAt: "2026-08-02T10:00:00.000Z", facts: { viewCount: 8 } }, baseDeps,
    );
    assert.equal(replay.status, "refused", "and cannot store a second");
    assert.equal(
      (replay as { reason: string }).reason, "invocation-already-recorded",
      `told as a REPLAY of one run, not as a duplicate of one moment: ${JSON.stringify(replay)}`,
    );

    /* A FORGED PRINCIPAL IS REFUSED AT RUNTIME. */
    const forged = await recordAuthorizedProviderObservation(
      {
        tenantId: trh.tenantId, authorizationId, authorizationRevision: 1,
        providerKey: YOUTUBE_PROVIDER_KEY, capabilityKey: YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY,
        subjectKind: SUBJECT_KIND, subjectRef: SUBJECT_REF, integrationId: connection,
        intervalMinutes: 60, invocationId: randomUUID(),
      } as never,
      { observedAt: "2026-08-03T10:00:00.000Z", facts: { viewCount: 1 } },
      baseDeps,
    );
    assert.equal(forged.status, "refused", "a manufactured principal cannot file an observation");
    assert.equal(
      (forged as { reason: string }).reason, "not-an-observation-principal",
      "an object of the right shape is not a principal",
    );

    /* ═══ 7. THE CADENCE CEILING REFUSES A SECOND READ ══════════════════════ */
    const tooSoon = await observeOnceUnderAuthorization(authorizationId, observeDeps);
    assert.equal(tooSoon.status, "refused", "a second read inside the interval is refused");
    assert.equal((tooSoon as { reason: string }).reason, "observed-too-recently");

    /* AND IT IS A CEILING, NOT A SCHEDULE: past it, the same call is permitted again. */
    const later = new Date(Date.now() + (MIN_OBSERVATION_INTERVAL_MINUTES + 1) * 60_000);
    const afterInterval = await observeOnceUnderAuthorization(authorizationId, {
      ...observeDeps, clock: () => later, fetchImpl: fakeYouTube(101), now: () => later,
    });
    assert.equal(afterInterval.status, "observed", "once the interval has elapsed, one more is allowed");
    /*
     * ACCOUNTING: 1 human baseline + 1 machine read (step 4) + 1 idempotency fixture (step 6)
     * + 1 machine read past the interval (here) = 4. Equal values would NOT have collapsed any of
     * them, which is TRH-21's rule kept intact by a phase that added a second provenance mode.
     */
    assert.equal(await count(setup, "provider_observations"), 4, "four distinct observations");

    /* ═══ 8. A FAILED PROVIDER READ STORES NOTHING AND SPENDS NO CEILING ════ */
    const beforeFailure = await count(setup, "provider_observations");
    const evenLater = new Date(later.getTime() + (MIN_OBSERVATION_INTERVAL_MINUTES + 1) * 60_000);
    const failed = await observeOnceUnderAuthorization(authorizationId, {
      ...observeDeps, fetchImpl: brokenYouTube, clock: () => evenLater, now: () => evenLater,
    });
    assert.equal(failed.status, "provider-failed", "the provider did not answer");
    assert.equal(await count(setup, "provider_observations"), beforeFailure, "and NOTHING was recorded");

    const retry = await observeOnceUnderAuthorization(authorizationId, {
      ...observeDeps, fetchImpl: fakeYouTube(103), clock: () => evenLater, now: () => evenLater,
    });
    assert.equal(retry.status, "observed", "a retry after a failure is permitted — a failure spends no ceiling");

    /* ═══ 9. WITHDRAWAL STOPS EVERYTHING ════════════════════════════════════ */
    const withdrawn = await withdrawStandingObservation(
      ctx,
      {
        providerKey: YOUTUBE_PROVIDER_KEY, capabilityKey: YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY,
        subjectKind: SUBJECT_KIND, subjectRef: SUBJECT_REF, justification: WITHDRAWAL,
        observedAuthorizationRevision: 1,
      },
      baseDeps,
    );
    assert.equal(withdrawn.status, "authorized");

    const muchLater = new Date(evenLater.getTime() + 10 * 24 * 60 * 60_000);
    const afterWithdrawal = await observeOnceUnderAuthorization(authorizationId, {
      ...observeDeps, clock: () => muchLater, now: () => muchLater,
    });
    assert.equal(afterWithdrawal.status, "not-authorized", "a withdrawn authorization observes nothing");
    assert.equal((afterWithdrawal as { reason: string }).reason, "authorization-withdrawn");

    /* ═══ 10. THE NON-EFFECTS ═══════════════════════════════════════════════ */
    const after = {
      observations: await count(setup, "provider_observations"),
      permits: await count(setup, "action_permits"),
      executions: await count(setup, "action_execution_attempts"),
      decisions: await count(setup, "decision_records"),
      authorizations: await count(setup, "standing_observation_authorizations"),
      credentials: await count(setup, "integration_credentials"),
      knowledge: await count(setup, "knowledge_facts"),
      work: await count(setup, "work_items"),
      agents: await count(setup, "agents"),
      mandates: await count(setup, "agent_mandates"),
      users: await count(setup, "users"),
      memberships: await count(setup, "memberships"),
      audit: await count(setup, "audit_log"),
    };

    for (const untouched of ["permits", "executions", "credentials", "knowledge", "work", "agents", "mandates", "users", "memberships"] as const) {
      assert.equal(after[untouched], before[untouched], `${untouched} did not move — observing observes nothing else`);
    }
    assert.equal(after.decisions - before.decisions, 1, "one decision, and it is the WITHDRAWAL — observing creates none");
    assert.equal(after.authorizations - before.authorizations, 1, "one revision, and it is the withdrawal");
    assert.equal(after.audit - before.audit, 2, "two audit rows, both the withdrawal's — an observation audits nothing");

    console.log(
      `trh24-machine-observation/observation-postgres: ${after.observations} observations ` +
        `(1 human, ${after.observations - 1} machine), 0 permits, 0 executions, 0 machine identities`,
    );
  } finally {
    await setup.end().catch(() => undefined);
    await handle.dispose().catch(() => undefined);
    await harness.dropDatabase();
  }
}

void main();
