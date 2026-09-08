/*
 * TRH-23 — the Standing Observation Authority, against a REAL PostgreSQL database.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "A human Governance decision can durably authorize ONE exact recurring provider-read scope, and
 *    the system can derive a bounded EPHEMERAL ObservationPrincipal from that active authorization
 *    without granting that principal human, Governance, Work, Knowledge, execution, credential-write
 *    or provider-write authority. Withdrawal is a NEW revision and the predecessor stays
 *    byte-identical. A withdrawn or superseded revision mints nothing. Another tenant's connection
 *    cannot be authorized. An AGENT cannot authorize. Nothing is observed, nothing is scheduled, and
 *    no provider is contacted."
 *
 * Every row is produced by the released writer that owns it. No adapter, no network, no credential
 * is decrypted. Uses a disposable local database, dropped on exit.
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
import {
  listEffectiveStandingObservations,
  readEffectiveStandingObservation,
  readStandingObservationHistory,
} from "../../src/features/standing-observation-authority/read-standing-observations.server";
import {
  isObservationPrincipal,
  mintObservationPrincipal,
  tenantScopeOf,
} from "../../src/features/standing-observation-authority/observation-principal.server";
import { revalidateStandingObservation } from "../../src/features/standing-observation-authority/revalidate-standing-observation.server";
import {
  MIN_OBSERVATION_INTERVAL_MINUTES,
  STANDING_OBSERVATION_AUDIT_AUTHORIZED,
  STANDING_OBSERVATION_AUDIT_WITHDRAWN,
  STANDING_OBSERVATION_AUTHORIZED_OUTCOME,
  STANDING_OBSERVATION_DOMAIN,
  STANDING_OBSERVATION_ENTITY_TYPE,
  STANDING_OBSERVATION_SUBJECT_TYPE,
  STANDING_OBSERVATION_WITHDRAWN_OUTCOME,
  OBSERVATION_READ_CONTROL_KEY,
} from "../../src/features/standing-observation-authority/contracts";
import { YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY, YOUTUBE_PROVIDER_KEY } from "../../src/features/provider-youtube/contracts";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";

const JUSTIFICATION =
  "I am authorizing this organization's own public channel to be observed on a bounded cadence, and I accept responsibility for that.";
const WITHDRAWAL_JUSTIFICATION =
  "We are pausing standing observation of this channel while we review what we do with the numbers.";

const SUBJECT_KIND = "youtube-channel";
const SUBJECT_REF = "youtube/channel/UCstandingfixture";
const OTHER_SUBJECT_REF = "youtube/channel/UCotherfixture";

const SCOPE = {
  providerKey: YOUTUBE_PROVIDER_KEY,
  capabilityKey: YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY,
  subjectKind: SUBJECT_KIND,
  subjectRef: SUBJECT_REF,
} as const;

interface Seeded {
  readonly tenantId: string;
  readonly userId: string;
  readonly authIdentityId: string;
  readonly membershipId: string;
  readonly roleId: string;
}

async function sessionRowFor(client: Client, seeded: Seeded, tag: string): Promise<string> {
  const row = await client.query<{ id: string }>(
    `insert into user_session_contexts
       (auth_identity_id, provider_session_reference_hash, provider_session_reference_digest_version,
        user_id, active_tenant_id, active_membership_id, membership_version, assurance_level,
        mfa_verified, authenticated_at, issued_at, last_activity_at, absolute_expires_at,
        inactivity_expires_at)
     values ($1, $2, 1, $3, $4, $5, 1, 'aal1', false, now(), now(), now(),
             now() + interval '1 day', now() + interval '1 hour')
     returning id`,
    [
      seeded.authIdentityId,
      tag.padEnd(64, "0").slice(0, 64).replace(/[^0-9a-f]/g, "a"),
      seeded.userId,
      seeded.tenantId,
      seeded.membershipId,
    ],
  );
  return row.rows[0]!.id;
}

function contextFor(seeded: Seeded, sessionContextId: string, requestId: string): TenantContext {
  return asHumanTenantContext({
    tenantId: seeded.tenantId,
    userId: seeded.userId,
    authIdentityId: seeded.authIdentityId,
    membershipId: seeded.membershipId,
    membershipVersion: 1,
    roleId: seeded.roleId,
    sessionContextId,
    provider: "local",
    assuranceLevel: "aal1",
    mfaVerified: false,
    requestId,
    authenticatedAt: new Date().toISOString(),
  });
}

async function count(client: Client, table: string): Promise<number> {
  const row = await client.query<{ n: number }>(`select count(*)::int as n from ${table}`);
  return row.rows[0]!.n;
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_trh23_standing");
  await harness.createDatabase();
  harness.migrateDatabase();

  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const baseDeps = { getDb: () => handle.db };

  try {
    /* ═══════════════════════════════════════════════════════════════════════
     * 0. THE MIGRATION IS APPLIED, AND CARRIES NO SCHEDULER TRUTH.
     * ═════════════════════════════════════════════════════════════════════ */
    const columns = await setup.query<{ column_name: string; is_nullable: string }>(
      `select column_name, is_nullable from information_schema.columns
        where table_name = 'standing_observation_authorizations' order by column_name`,
    );
    assert.ok(columns.rows.length > 0, "the standing authorization table exists");
    const names = columns.rows.map((r) => r.column_name);

    /*
     * THE ABSENT COLUMNS ARE THE POINT. Every one of these is either a fact TRH-23 cannot prove, or
     * a piece of a runtime that does not exist, or a durable machine identity the discovery rejected
     * on evidence.
     */
    for (const forbidden of [
      "expires_at",
      "revoked_at",
      "revoked_by",
      "superseded_at",
      "is_current",
      "is_effective",
      "consumed_at",
      "last_run_at",
      "next_run_at",
      "observation_count",
      "cron",
      "cron_expression",
      "timezone",
      "retry_policy",
      "backfill_window",
      "scheduler_state",
      "principal_id",
      "service_account_id",
      "api_key",
      "credential_id",
      "secret",
      "handle",
    ]) {
      assert.ok(
        !names.includes(forbidden),
        `the authorization carries no '${forbidden}' — TRH-23 may not claim that fact`,
      );
    }

    for (const required of [
      "tenant_id",
      "authorization_revision",
      "state",
      "provider_key",
      "capability_key",
      "subject_kind",
      "subject_ref",
      "integration_id",
      "interval_minutes",
      "governance_decision_id",
      "governance_session_id",
      "authorized_by_actor_type",
      "authorized_by_actor_id",
      "authorized_at",
    ]) {
      const row = columns.rows.find((r) => r.column_name === required);
      assert.ok(row, `${required} exists`);
      assert.equal(row!.is_nullable, "NO", `${required} is NOT NULL`);
    }

    const fk = await setup.query<{ n: number }>(
      `select count(*)::int as n from information_schema.table_constraints
        where constraint_name = 'standing_observation_authorizations_tenant_integration_fk'
          and constraint_type = 'FOREIGN KEY'`,
    );
    assert.equal(fk.rows[0]!.n, 1, "the composite tenant-safe connection foreign key exists");

    /* ═══════════════════════════════════════════════════════════════════════
     * 1. TWO TENANTS, EACH WITH A GOVERNANCE AUTHORITY AND A CONNECTION.
     * ═════════════════════════════════════════════════════════════════════ */
    const trh = await seedLocalIdentity(setup, {
      companyName: "Turkish Rug House",
      companySlug: "turkish-rug-house-trh23",
      email: "director@trh.test",
      roleType: "owner",
    });
    const other = await seedLocalIdentity(setup, {
      companyName: "Another Organization",
      companySlug: "another-org-trh23",
      email: "director@other.test",
      roleType: "owner",
    });

    const trhSession = await sessionRowFor(setup, trh, "aaaa1");
    const otherSession = await sessionRowFor(setup, other, "bbbb2");
    const trhTenant = contextFor(trh, trhSession, "trh23-authorize");
    const otherTenant = contextFor(other, otherSession, "trh23-other");

    /*
     * GENESIS FIRST. `establishGovernanceAuthority` refuses without an ACCEPTED nomination — the
     * pre-Governance entitlement G2.1 owns. Seeding it here is the same fixture AMA-1 uses, and it
     * is the reason the bootstrap below succeeds rather than the reason it is trusted.
     */
    for (const [seeded, tenant, who] of [
      [trh, trhTenant, "TRH"],
      [other, otherTenant, "the other organization"],
    ] as const) {
      await setup.query(
        `insert into genesis_nominations
           (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
            accepted_at, accepted_session_context_id, accepted_assurance_level)
         values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
        [seeded.tenantId, seeded.authIdentityId, seeded.userId, tenant.sessionContextId],
      );
      const bootstrap = await establishGovernanceAuthority(
        tenant,
        { justification: `Establishing ${who}'s Governance authority for this test fixture.` },
        baseDeps,
      );
      assert.equal(bootstrap.status, "established", `${who} has a Governance authority`);
    }

    const connectionFor = async (tenantId: string, userId: string, name: string): Promise<string> =>
      (
        await setup.query<{ id: string }>(
          `insert into integrations (tenant_id, provider_key, name, status, created_by, created_by_type)
           values ($1, 'youtube', $2, 'pending', $3, 'human') returning id`,
          [tenantId, name, userId],
        )
      ).rows[0]!.id;

    const trhConnection = await connectionFor(trh.tenantId, trh.userId, "YouTube");
    const otherConnection = await connectionFor(other.tenantId, other.userId, "YouTube");
    const trhGoogleConnection = (
      await setup.query<{ id: string }>(
        `insert into integrations (tenant_id, provider_key, name, status, created_by, created_by_type)
         values ($1, 'google-workspace', 'Google', 'pending', $2, 'human') returning id`,
        [trh.tenantId, trh.userId],
      )
    ).rows[0]!.id;

    const before = {
      authorizations: await count(setup, "standing_observation_authorizations"),
      decisions: await count(setup, "decision_records"),
      sessions: await count(setup, "governance_sessions"),
      permits: await count(setup, "action_permits"),
      observations: await count(setup, "provider_observations"),
      credentials: await count(setup, "integration_credentials"),
      agents: await count(setup, "agents"),
      mandates: await count(setup, "agent_mandates"),
      knowledge: await count(setup, "knowledge_facts"),
      work: await count(setup, "work_items"),
      executions: await count(setup, "action_execution_attempts"),
      users: await count(setup, "users"),
      memberships: await count(setup, "memberships"),
      sessionContexts: await count(setup, "user_session_contexts"),
    };
    assert.equal(before.authorizations, 0, "nothing is authorized before the ceremony");

    /* ═══════════════════════════════════════════════════════════════════════
     * 2. REFUSALS THAT DO NOT WRITE. Every one leaves the ledger where it was.
     * ═════════════════════════════════════════════════════════════════════ */
    const authorize = (
      tenant: TenantContext | null,
      overrides: Partial<{
        providerKey: string;
        capabilityKey: string;
        subjectKind: string;
        subjectRef: string;
        integrationId: string;
        intervalMinutes: number;
        justification: string;
        observedAuthorizationRevision: number | null;
      }> = {},
    ) =>
      authorizeStandingObservation(
        tenant,
        {
          providerKey: SCOPE.providerKey,
          capabilityKey: SCOPE.capabilityKey,
          subjectKind: SCOPE.subjectKind,
          subjectRef: SCOPE.subjectRef,
          integrationId: trhConnection,
          intervalMinutes: MIN_OBSERVATION_INTERVAL_MINUTES,
          justification: JUSTIFICATION,
          observedAuthorizationRevision: null,
          ...overrides,
        },
        baseDeps,
      );

    const refusals: readonly (readonly [string, Awaited<ReturnType<typeof authorize>>])[] = [
      ["no tenant at all", await authorize(null)],
      ["a justification too short to be a reason", await authorize(trhTenant, { justification: "no" })],
      [
        "a capability outside the observable allow-list",
        await authorize(trhTenant, { capabilityKey: "youtube.channel.public.write" }),
      ],
      [
        "a provider outside the observable allow-list",
        await authorize(trhTenant, { providerKey: "google-workspace" }),
      ],
      [
        "a subject kind that does not belong to this capability",
        await authorize(trhTenant, { subjectKind: "drive-file" }),
      ],
      ["an empty subject", await authorize(trhTenant, { subjectRef: "   " })],
      [
        "a cadence under the floor",
        await authorize(trhTenant, { intervalMinutes: MIN_OBSERVATION_INTERVAL_MINUTES - 1 }),
      ],
      ["a fractional cadence", await authorize(trhTenant, { intervalMinutes: 90.5 })],
      [
        "ANOTHER TENANT'S CONNECTION",
        await authorize(trhTenant, { integrationId: otherConnection }),
      ],
      [
        "a connection belonging to a different provider",
        await authorize(trhTenant, { integrationId: trhGoogleConnection }),
      ],
      [
        "a stale view of the lineage",
        await authorize(trhTenant, { observedAuthorizationRevision: 7 }),
      ],
    ];
    for (const [label, result] of refusals) {
      assert.equal(result.status, "refused", `${label} is refused`);
    }
    assert.equal(
      (refusals.find(([l]) => l === "ANOTHER TENANT'S CONNECTION")![1] as { reason: string }).reason,
      "connection-unresolvable",
      "another tenant's connection is indistinguishable from one that never existed",
    );
    assert.equal(
      (refusals.find(([l]) => l.startsWith("a connection belonging"))![1] as { reason: string })
        .reason,
      "connection-provider-mismatch",
      "and a wrong-provider connection of your OWN is a different, honest answer",
    );

    assert.equal(
      await count(setup, "standing_observation_authorizations"),
      0,
      "not one refusal wrote a row",
    );
    assert.equal(
      await count(setup, "decision_records"),
      before.decisions,
      "and not one refusal wrote a Governance decision",
    );

    /*
     * A MEMBER WHO IS NOT THE GOVERNANCE AUTHORITY IS REFUSED EXACTLY LIKE A STRANGER.
     * The other tenant's Governance authority may not authorize inside TRH.
     */
    const crossTenant = await authorizeStandingObservation(
      { ...otherTenant, tenantId: trh.tenantId } as TenantContext,
      {
        providerKey: SCOPE.providerKey,
        capabilityKey: SCOPE.capabilityKey,
        subjectKind: SCOPE.subjectKind,
        subjectRef: SCOPE.subjectRef,
        integrationId: trhConnection,
        intervalMinutes: MIN_OBSERVATION_INTERVAL_MINUTES,
        justification: JUSTIFICATION,
        observedAuthorizationRevision: null,
      },
      baseDeps,
    );
    assert.equal(crossTenant.status, "refused", "a foreign Governance authority is refused");
    assert.equal(
      (crossTenant as { reason: string }).reason,
      "not-the-governance-authority",
      "and told why, without being told anything about the tenant it aimed at",
    );

    /* ═══════════════════════════════════════════════════════════════════════
     * 3. REVISION 1 — THE AUTHORIZATION ITSELF.
     * ═════════════════════════════════════════════════════════════════════ */
    const first = await authorize(trhTenant, { intervalMinutes: 360 });
    assert.equal(first.status, "authorized", "the Governance authority may authorize");
    const r1 = (first as { authorization: { authorizationId: string; authorizationRevision: number; state: string; supersedesAuthorizationId: string | null; governanceDecisionId: string } }).authorization;
    assert.equal(r1.authorizationRevision, 1, "the lineage starts at revision 1");
    assert.equal(r1.state, "active");
    assert.equal(r1.supersedesAuthorizationId, null, "revision 1 supersedes nothing");

    const storedRow = await setup.query<{
      tenant_id: string;
      state: string;
      provider_key: string;
      capability_key: string;
      subject_kind: string;
      subject_ref: string;
      integration_id: string;
      interval_minutes: number;
      authorized_by_actor_type: string;
      authorized_by_actor_id: string;
    }>(
      `select tenant_id, state, provider_key, capability_key, subject_kind, subject_ref,
              integration_id, interval_minutes, authorized_by_actor_type, authorized_by_actor_id
         from standing_observation_authorizations where id = $1`,
      [r1.authorizationId],
    );
    const stored = storedRow.rows[0]!;
    assert.equal(stored.tenant_id, trh.tenantId, "filed under the acting tenant, never an argument");
    assert.equal(stored.provider_key, YOUTUBE_PROVIDER_KEY);
    assert.equal(stored.capability_key, YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY);
    assert.equal(stored.subject_ref, SUBJECT_REF, "the PROVIDER's reference, not a typed handle");
    assert.equal(stored.integration_id, trhConnection);
    assert.equal(stored.interval_minutes, 360);
    assert.equal(stored.authorized_by_actor_type, "human", "and a human authorized it");
    assert.equal(stored.authorized_by_actor_id, trh.userId);

    /* THE GOVERNANCE ROW SAYS WHAT IT ACTUALLY WAS — not "a human was admitted". */
    const decision = await setup.query<{
      decision_type: string;
      subject_type: string;
      subject_id: string;
      outcome: string;
      actor_type: string;
      bootstrap: boolean;
    }>(
      `select decision_type, subject_type, subject_id, outcome, actor_type, bootstrap
         from decision_records where id = $1`,
      [r1.governanceDecisionId],
    );
    const d1 = decision.rows[0]!;
    assert.equal(d1.subject_type, STANDING_OBSERVATION_SUBJECT_TYPE);
    assert.equal(d1.subject_id, r1.authorizationId, "the decision names the REVISION, not the lineage");
    assert.equal(d1.outcome, STANDING_OBSERVATION_AUTHORIZED_OUTCOME);
    assert.notEqual(d1.outcome, "membership-authorized", "`approve` did not fall through to I1's branch");
    assert.equal(d1.actor_type, "human");
    assert.equal(d1.bootstrap, false);

    const domainRow = await setup.query<{ governance_domain: string }>(
      `select governance_domain from governance_sessions where id = $1`,
      [r1 && (first as { authorization: { governanceSessionId: string } }).authorization.governanceSessionId],
    );
    assert.equal(
      domainRow.rows[0]!.governance_domain,
      STANDING_OBSERVATION_DOMAIN,
      "and it is filed in its own ledger domain",
    );

    const auditRow = await setup.query<{ action: string; entity_id: string; metadata: Record<string, unknown> }>(
      `select action, entity_id, metadata from audit_log where entity_type = $1 order by occurred_at`,
      [STANDING_OBSERVATION_ENTITY_TYPE],
    );
    assert.equal(auditRow.rows.length, 1, "exactly one standing-observation audit row");
    assert.equal(auditRow.rows[0]!.action, STANDING_OBSERVATION_AUDIT_AUTHORIZED);
    assert.equal(auditRow.rows[0]!.entity_id, r1.authorizationId);
    assert.equal(
      auditRow.rows[0]!.metadata.collected,
      false,
      "and history says on the row itself that nothing was collected",
    );

    /* ═══════════════════════════════════════════════════════════════════════
     * 4. THE EPHEMERAL PRINCIPAL — MINTED FROM THE ROW, AND FROM NOTHING ELSE.
     * ═════════════════════════════════════════════════════════════════════ */
    const minted = await mintObservationPrincipal(r1.authorizationId, baseDeps);
    assert.equal(minted.status, "minted", "an active authorization mints a principal");
    const principal = (minted as { principal: import("../../src/features/standing-observation-authority/observation-principal.server").ObservationPrincipal }).principal;

    assert.ok(isObservationPrincipal(principal), "and it carries the runtime brand");
    assert.equal(principal.tenantId, trh.tenantId, "the tenant came from the ROW, not from a caller");
    assert.equal(principal.providerKey, YOUTUBE_PROVIDER_KEY);
    assert.equal(principal.capabilityKey, YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY);
    assert.equal(principal.subjectRef, SUBJECT_REF);
    assert.equal(principal.integrationId, trhConnection);
    assert.equal(principal.intervalMinutes, 360);
    assert.equal(principal.authorizationRevision, 1);
    assert.match(principal.invocationId, /^[0-9a-f-]{36}$/, "and this run has its own identity");

    /* A FORGED PRINCIPAL IS NOT A PRINCIPAL. The brand is a runtime symbol, not a type-level hope. */
    const forged = {
      tenantId: other.tenantId,
      authorizationId: r1.authorizationId,
      authorizationRevision: 1,
      providerKey: YOUTUBE_PROVIDER_KEY,
      capabilityKey: YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY,
      subjectKind: SUBJECT_KIND,
      subjectRef: SUBJECT_REF,
      integrationId: otherConnection,
      intervalMinutes: 60,
      invocationId: "forged",
    };
    assert.equal(isObservationPrincipal(forged), false, "an object of the right shape is still not one");

    /* THE TENANT SCOPE CARRIES THE TENANT AND NOTHING ELSE. */
    const scope = tenantScopeOf(principal);
    assert.deepEqual(Object.keys(scope), ["tenantId"], "no human, no session, no request identity");

    /* NOTHING WAS PERSISTED BY MINTING. */
    assert.equal(
      await count(setup, "standing_observation_authorizations"),
      1,
      "minting a principal wrote no row",
    );

    /* ═══════════════════════════════════════════════════════════════════════
     * 5. THE PRE-TRANSPORT REVALIDATOR. It reaches no provider and opens no secret.
     * ═════════════════════════════════════════════════════════════════════ */
    /*
     * The connection is `pending` and holds no credential, so the authoritative check REFUSES — and
     * that is the correct outcome, not a defect. An authorization is not a connection, and a
     * capability being authorized does not make it available.
     */
    /*
     * TRH-25 PREREQUISITE, AND ITS PRECEDENCE STATED RATHER THAN ASSUMED. The operator's stop is
     * consulted BEFORE the connection, capability and credential reads, so a stopped deployment
     * touches no tenant data at all. With no control row this fixture would therefore refuse with
     * `observation-read-disabled` and never reach the property below — so the switch is armed
     * first, and the ORIGINAL assertion is preserved exactly as it was written.
     */
    const stoppedFirst = await revalidateStandingObservation(principal, baseDeps);
    assert.equal(
      (stoppedFirst as { reason?: string }).reason,
      "observation-read-disabled",
      "with no control row, the stop precedes every operational read",
    );
    await setup.query(
      `insert into provider_connectivity_controls (provider_key, director_enabled, control_source)
            values ($1, true, 'local-operator-ceremony')`,
      [OBSERVATION_READ_CONTROL_KEY],
    );

    const notAvailable = await revalidateStandingObservation(principal, baseDeps);
    assert.equal(notAvailable.status, "refused", "an unverified connection cannot be read through");
    assert.ok(
      ["capability-not-available", "connection-unhealthy"].includes(
        (notAvailable as { reason: string }).reason,
      ),
      `and the refusal names the connection or the capability, not the authorization: ${(notAvailable as { reason: string }).reason}`,
    );

    /* SUBSTITUTION FAILS. A principal cannot be edited into a different scope. */
    for (const [label, mutated] of [
      ["tenant", { ...principal, tenantId: other.tenantId }],
      ["provider", { ...principal, providerKey: "google-workspace" }],
      ["capability", { ...principal, capabilityKey: "youtube.channel.public.write" }],
      ["subject", { ...principal, subjectRef: OTHER_SUBJECT_REF }],
      ["connection", { ...principal, integrationId: otherConnection }],
    ] as const) {
      const result = await revalidateStandingObservation(mutated, baseDeps);
      assert.equal(result.status, "refused", `${label} substitution is refused`);
      assert.notEqual(
        (result as { reason: string }).reason,
        "capability-not-available",
        `${label} substitution is caught by the binding comparison, before availability is even asked`,
      );
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 6. RE-AUTHORIZING THE SAME SCOPE IDENTICALLY CHANGES NOTHING, AND SAYS SO.
     * ═════════════════════════════════════════════════════════════════════ */
    const identical = await authorize(trhTenant, {
      intervalMinutes: 360,
      observedAuthorizationRevision: 1,
    });
    assert.equal(identical.status, "refused", "an identical re-authorization is refused");
    assert.equal(
      (identical as { reason: string }).reason,
      "already-authorized",
      "a second Governance decision that changes nothing is not recorded",
    );

    /* ═══════════════════════════════════════════════════════════════════════
     * 7. REVISION 2 — NARROWING THE CADENCE. THE PREDECESSOR IS UNTOUCHED.
     * ═════════════════════════════════════════════════════════════════════ */
    const r1Bytes = await setup.query(
      `select * from standing_observation_authorizations where id = $1`,
      [r1.authorizationId],
    );

    const second = await authorize(trhTenant, {
      intervalMinutes: 1440,
      observedAuthorizationRevision: 1,
    });
    assert.equal(second.status, "authorized", "the cadence may be narrowed by a new revision");
    const r2 = (second as { authorization: { authorizationId: string; authorizationRevision: number; supersedesAuthorizationId: string | null } }).authorization;
    assert.equal(r2.authorizationRevision, 2);
    assert.equal(r2.supersedesAuthorizationId, r1.authorizationId, "and it names its predecessor");

    const r1After = await setup.query(
      `select * from standing_observation_authorizations where id = $1`,
      [r1.authorizationId],
    );
    assert.deepEqual(
      r1After.rows[0],
      r1Bytes.rows[0],
      "REVISION 1 IS BYTE-IDENTICAL — nothing was stamped, updated or superseded in place",
    );

    /* THE STALE ID NO LONGER MINTS. */
    const stale = await mintObservationPrincipal(r1.authorizationId, baseDeps);
    assert.equal(stale.status, "refused", "a superseded revision mints nothing");
    assert.equal(
      (stale as { reason: string }).reason,
      "authorization-superseded",
      "and `superseded` means exactly one thing: a newer ACTIVE revision replaced it",
    );

    /* AND THE PRINCIPAL MINTED FROM IT IS NOW WORTHLESS. */
    const staleRevalidation = await revalidateStandingObservation(principal, baseDeps);
    assert.equal(staleRevalidation.status, "refused", "a principal held across a revision is refused");
    assert.equal((staleRevalidation as { reason: string }).reason, "authorization-superseded");

    /* ═══════════════════════════════════════════════════════════════════════
     * 8. WITHDRAWAL — A NEW REVISION, AND THE ANSWER TO THE DIRECTOR'S QUESTION.
     * ═════════════════════════════════════════════════════════════════════ */
    const liveBeforeWithdrawal = await mintObservationPrincipal(r2.authorizationId, baseDeps);
    assert.equal(liveBeforeWithdrawal.status, "minted", "revision 2 is live and mints");
    const heldPrincipal = (liveBeforeWithdrawal as { principal: import("../../src/features/standing-observation-authority/observation-principal.server").ObservationPrincipal }).principal;

    const withdrawal = await withdrawStandingObservation(
      trhTenant,
      {
        providerKey: SCOPE.providerKey,
        capabilityKey: SCOPE.capabilityKey,
        subjectKind: SCOPE.subjectKind,
        subjectRef: SCOPE.subjectRef,
        justification: WITHDRAWAL_JUSTIFICATION,
        observedAuthorizationRevision: 2,
      },
      baseDeps,
    );
    assert.equal(withdrawal.status, "authorized", "withdrawal is a write, and it succeeds");
    const r3 = (withdrawal as { authorization: { authorizationId: string; authorizationRevision: number; state: string; integrationId: string; intervalMinutes: number; governanceDecisionId: string } }).authorization;
    assert.equal(r3.authorizationRevision, 3);
    assert.equal(r3.state, "withdrawn");
    assert.equal(r3.integrationId, trhConnection, "a withdrawal carries the connection forward");
    assert.equal(r3.intervalMinutes, 1440, "and the cadence, rather than letting a caller re-point either");

    const withdrawalDecision = await setup.query<{ decision_type: string; outcome: string }>(
      `select decision_type, outcome from decision_records where id = $1`,
      [r3.governanceDecisionId],
    );
    assert.equal(withdrawalDecision.rows[0]!.decision_type, "revoke");
    assert.equal(withdrawalDecision.rows[0]!.outcome, STANDING_OBSERVATION_WITHDRAWN_OUTCOME);
    assert.notEqual(
      withdrawalDecision.rows[0]!.outcome,
      "governance-authority-revoked",
      "`revoke` did not fall through to G3's branch — nobody's authority was taken away",
    );

    /*
     * THE DIRECTOR'S QUESTION, ANSWERED BY EXECUTION RATHER THAN BY PROSE.
     *
     * `heldPrincipal` was minted BEFORE the withdrawal — the 11:59:59 trigger. The authoritative
     * check runs after it, and refuses.
     */
    const afterWithdrawal = await revalidateStandingObservation(heldPrincipal, baseDeps);
    assert.equal(afterWithdrawal.status, "refused", "a principal minted before revocation is refused");
    assert.equal(
      (afterWithdrawal as { reason: string }).reason,
      "authorization-withdrawn",
      "and it is told that the permission was WITHDRAWN, not merely that a newer revision exists",
    );

    const mintAfterWithdrawal = await mintObservationPrincipal(r2.authorizationId, baseDeps);
    assert.equal(mintAfterWithdrawal.status, "refused", "and the id mints nothing any more");

    /*
     * AND HISTORY SAYS A SCOPE WAS WITHDRAWN, IN ITS OWN WORD.
     *
     * The audit vocabulary distinguishes the two acts. A withdrawal filed as an authorization would
     * make "when did we stop?" unanswerable from the ledger.
     */
    const withdrawalAudit = await setup.query<{ action: string; metadata: Record<string, unknown> }>(
      `select action, metadata from audit_log
        where entity_type = $1 and entity_id = $2`,
      [STANDING_OBSERVATION_ENTITY_TYPE, r3.authorizationId],
    );
    assert.equal(withdrawalAudit.rows.length, 1, "one audit row for the withdrawal");
    assert.equal(withdrawalAudit.rows[0]!.action, STANDING_OBSERVATION_AUDIT_WITHDRAWN);
    assert.equal(
      withdrawalAudit.rows[0]!.metadata.collected,
      false,
      "and it too says that nothing was collected",
    );

    /* WITHDRAWING NOTHING IS REFUSED. */
    const doubleWithdrawal = await withdrawStandingObservation(
      trhTenant,
      {
        providerKey: SCOPE.providerKey,
        capabilityKey: SCOPE.capabilityKey,
        subjectKind: SCOPE.subjectKind,
        subjectRef: SCOPE.subjectRef,
        justification: WITHDRAWAL_JUSTIFICATION,
        observedAuthorizationRevision: 3,
      },
      baseDeps,
    );
    assert.equal(doubleWithdrawal.status, "refused", "there is nothing left to withdraw");
    assert.equal((doubleWithdrawal as { reason: string }).reason, "no-active-authorization");

    /* ═══════════════════════════════════════════════════════════════════════
     * 9. RE-AUTHORIZATION IS A NEW REVISION, NEVER A REACTIVATION.
     * ═════════════════════════════════════════════════════════════════════ */
    const reauthorized = await authorize(trhTenant, {
      intervalMinutes: 720,
      observedAuthorizationRevision: 3,
    });
    assert.equal(reauthorized.status, "authorized");
    const r4 = (reauthorized as { authorization: { authorizationId: string; authorizationRevision: number; state: string; governanceDecisionId: string } }).authorization;
    assert.equal(r4.authorizationRevision, 4, "re-authorization is revision 4, not a revived revision 2");
    assert.equal(r4.state, "active");
    assert.notEqual(r4.governanceDecisionId, r3.governanceDecisionId, "under a NEW Governance decision");

    const withdrawnStillWithdrawn = await setup.query<{ state: string }>(
      `select state from standing_observation_authorizations where id = $1`,
      [r3.authorizationId],
    );
    assert.equal(
      withdrawnStillWithdrawn.rows[0]!.state,
      "withdrawn",
      "and the withdrawn revision is still withdrawn — no row was reactivated",
    );

    /* ═══════════════════════════════════════════════════════════════════════
     * 10. THE READERS. EFFECTIVE IS DERIVED; HISTORY IS COMPLETE.
     * ═════════════════════════════════════════════════════════════════════ */
    const effective = await readEffectiveStandingObservation(trhTenant, SCOPE, baseDeps);
    assert.equal(effective.status, "read");
    assert.equal((effective as { effective: { authorizationRevision: number } }).effective!.authorizationRevision, 4);

    const history = await readStandingObservationHistory(trhTenant, SCOPE, baseDeps);
    assert.equal(history.status, "read");
    assert.deepEqual(
      (history as { revisions: readonly { authorizationRevision: number; state: string }[] }).revisions.map(
        (r) => `${r.authorizationRevision}:${r.state}`,
      ),
      ["4:active", "3:withdrawn", "2:active", "1:active"],
      "every revision survives, newest first, and the withdrawal is visible rather than hidden",
    );

    /* ANOTHER TENANT SEES NOTHING, AND CANNOT TELL WHY. */
    const foreignRead = await readEffectiveStandingObservation(otherTenant, SCOPE, baseDeps);
    assert.equal(foreignRead.status, "read");
    assert.equal(
      (foreignRead as { effective: unknown }).effective,
      null,
      "another tenant's scope is indistinguishable from one that never existed",
    );

    const listed = await listEffectiveStandingObservations(trhTenant, baseDeps);
    assert.equal(listed.status, "read");
    assert.equal(
      (listed as { revisions: readonly unknown[] }).revisions.length,
      1,
      "one lineage, at its effective revision — not four rows",
    );

    /* ═══════════════════════════════════════════════════════════════════════
     * 11. AN AGENT MAY NEVER AUTHORIZE — AND POSTGRES SAYS SO INDEPENDENTLY.
     * ═════════════════════════════════════════════════════════════════════ */
    await assert.rejects(
      () =>
        setup.query(
          `insert into standing_observation_authorizations
             (tenant_id, authorization_revision, state, provider_key, capability_key, subject_kind,
              subject_ref, integration_id, interval_minutes, governance_decision_id,
              governance_session_id, authorized_by_actor_type, authorized_by_actor_id, authorized_at)
           values ($1, 1, 'active', 'youtube', $2, $3, $4, $5, 60, $6, $7, 'agent', $8, now())`,
          [
            trh.tenantId,
            YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY,
            SUBJECT_KIND,
            "youtube/channel/UCagentattempt",
            trhConnection,
            r1.governanceDecisionId,
            (first as { authorization: { governanceSessionId: string } }).authorization.governanceSessionId,
            trh.userId,
          ],
        ),
      /standing_observation_authorizations_human_authorizer_chk/,
      "an agent authorizer is refused by PostgreSQL, not by an application check",
    );

    /* A FIRST REVISION MAY NOT BE A WITHDRAWAL. */
    await assert.rejects(
      () =>
        setup.query(
          `insert into standing_observation_authorizations
             (tenant_id, authorization_revision, state, provider_key, capability_key, subject_kind,
              subject_ref, integration_id, interval_minutes, governance_decision_id,
              governance_session_id, authorized_by_actor_type, authorized_by_actor_id, authorized_at)
           values ($1, 1, 'withdrawn', 'youtube', $2, $3, $4, $5, 60, $6, $7, 'human', $8, now())`,
          [
            trh.tenantId,
            YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY,
            SUBJECT_KIND,
            "youtube/channel/UCneverauthorized",
            trhConnection,
            r1.governanceDecisionId,
            (first as { authorization: { governanceSessionId: string } }).authorization.governanceSessionId,
            trh.userId,
          ],
        ),
      /standing_observation_authorizations_first_revision_active_chk/,
      "you cannot withdraw what was never authorized",
    );

    /* THE CADENCE FLOOR IS IN THE DATABASE, NOT ONLY IN THE APPLICATION. */
    await assert.rejects(
      () =>
        setup.query(
          `insert into standing_observation_authorizations
             (tenant_id, authorization_revision, state, provider_key, capability_key, subject_kind,
              subject_ref, integration_id, interval_minutes, governance_decision_id,
              governance_session_id, authorized_by_actor_type, authorized_by_actor_id, authorized_at)
           values ($1, 1, 'active', 'youtube', $2, $3, $4, $5, 1, $6, $7, 'human', $8, now())`,
          [
            trh.tenantId,
            YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY,
            SUBJECT_KIND,
            "youtube/channel/UChammering",
            trhConnection,
            r1.governanceDecisionId,
            (first as { authorization: { governanceSessionId: string } }).authorization.governanceSessionId,
            trh.userId,
          ],
        ),
      /standing_observation_authorizations_interval_chk/,
      "a one-minute cadence cannot be written even by a caller that never read the constant",
    );

    /* ═══════════════════════════════════════════════════════════════════════
     * 12. THE NON-EFFECTS. Four authorizations, and nothing else in the system moved.
     * ═════════════════════════════════════════════════════════════════════ */
    const after = {
      authorizations: await count(setup, "standing_observation_authorizations"),
      decisions: await count(setup, "decision_records"),
      sessions: await count(setup, "governance_sessions"),
      permits: await count(setup, "action_permits"),
      observations: await count(setup, "provider_observations"),
      credentials: await count(setup, "integration_credentials"),
      agents: await count(setup, "agents"),
      mandates: await count(setup, "agent_mandates"),
      knowledge: await count(setup, "knowledge_facts"),
      work: await count(setup, "work_items"),
      executions: await count(setup, "action_execution_attempts"),
      users: await count(setup, "users"),
      memberships: await count(setup, "memberships"),
      sessionContexts: await count(setup, "user_session_contexts"),
    };

    assert.equal(after.authorizations, 4, "four revisions: authorize, narrow, withdraw, re-authorize");
    assert.equal(after.decisions - before.decisions, 4, "one Governance decision each, and no more");
    assert.equal(after.sessions - before.sessions, 4, "one Governance session each");

    for (const untouched of [
      "permits",
      "observations",
      "credentials",
      "agents",
      "mandates",
      "knowledge",
      "work",
      "executions",
      "users",
      "memberships",
      "sessionContexts",
    ] as const) {
      assert.equal(
        after[untouched],
        before[untouched],
        `${untouched} did not move — authorizing observation authorizes nothing else`,
      );
    }

    /*
     * NO PROVIDER OBSERVATION EXISTS. This is the sentence the whole phase rests on: a tenant now
     * has standing permission to be observed on a cadence, and NOTHING HAS OBSERVED IT.
     */
    assert.equal(after.observations, 0, "AUTHORIZED != OBSERVED, measured rather than asserted");

    console.log(
      `trh23-standing-observation/authorization-postgres: 4 revisions, 4 decisions, 0 observations, ` +
        `1 principal minted and refused at the authoritative check`,
    );
  } finally {
    await setup.end().catch(() => undefined);
    await handle.dispose().catch(() => undefined);
    await harness.dropDatabase();
  }
}

void main();
