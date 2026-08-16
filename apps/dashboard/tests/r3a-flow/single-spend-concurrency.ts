/*
 * R3A — the single-spend invariant under REAL concurrency.
 *
 * THE CLAIM THIS FILE EXISTS TO PROVE:
 *
 *   "When N callers race to spend one permit, EXACTLY ONE receives an execution authorization,
 *    and the permit is consumed exactly once."
 *
 * A sequential test cannot prove this. `consume → refuse` in a loop passes just as happily against
 * a `check → then update` implementation, which is precisely the shape that produces two sends
 * from one approval. So the spends here are issued in parallel against real PostgreSQL, on
 * separate pooled connections, so the database's row locking is the thing under test.
 *
 * The revocation race is included for the same reason: a revoke and a spend arriving together must
 * not both succeed, or an authorization is withdrawn and used at the same instant.
 *
 * Uses a disposable local database, dropped on exit. The canonical database is never opened.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { recordActionRequest } from "../../src/features/action-authorization/record-action-request.server";
import { approveActionRequest } from "../../src/features/action-authorization/decide-action-request.server";
import { consumeActionPermit } from "../../src/features/action-authorization/consume-action-permit.server";
import { revokeActionPermit } from "../../src/features/action-authorization/revoke-action-permit.server";
import type { HebyPreparedAction } from "../../src/features/heby-actions/contracts";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

/*
 * ── THE ISSUANCE CLOCK IS READ FROM THE DATABASE, NEVER FROM THE CALENDAR ────
 *
 * A fixed literal here made this file a time bomb: approval derives
 * `expires_at = injectedNow + 3600s`, while the single-spend `UPDATE … WHERE expires_at > now()`
 * is adjudicated by the DATABASE clock — deliberately, because a caller that could pass its own
 * `now` could also pass a convenient one. A permit issued at a hard-coded 09:00Z became unspendable
 * at 10:00Z real time, and "exactly one caller may spend a permit" then measured zero winners
 * forever: the race was still correct, there was simply nothing left to win.
 *
 * Reading the adjudicating clock is the safe fix. The predicate is NOT relaxed.
 */
let NOW: Date;

/** The adjudicating clock itself, so issuance and consumption cannot drift apart. */
async function readDatabaseNow(client: Client): Promise<Date> {
  const row = await client.query<{ now: Date }>("select now() as now");
  return row.rows[0]!.now;
}

const JUSTIFICATION =
  "This action is a deliberate organizational act and I accept responsibility for the outcome.";

interface Seeded {
  readonly tenantId: string;
  readonly userId: string;
  readonly authIdentityId: string;
  readonly membershipId: string;
  readonly roleId: string;
}

function prepared(subject: string): HebyPreparedAction {
  return {
    actionId: `act_${subject}`,
    actionKind: "send-external-communication",
    toolId: "heby.operations.send-communication",
    capability: "operations.communication",
    sideEffect: "CONSEQUENTIAL_MUTATION",
    reversibility: "irreversible",
    ownerWorkspace: "operations",
    requestingWorkspace: "operations",
    target: { kind: "record", ref: "contact-1", label: "Contact" },
    arguments: { channel: "email", subject },
    argumentsValid: true,
    evidence: [],
    provenance: [],
    provenanceCovered: [],
    uncertainty: "supported",
    expectedEffect: "Sends one external email.",
    consequences: ["This cannot be unsent."],
    capabilityGate: {
      status: "not-connected",
      toolExists: true,
      available: false,
      workspacePermitted: true,
      targetValid: true,
      evidenceSufficient: true,
      reasons: [],
    },
    governanceGate: { status: "not-connected", required: true, evaluatorConnected: false, reasons: [] },
    authorityGate: {
      status: "unmet",
      requirement: "human-review-required",
      hebyMayAct: false,
      humanReviewRequired: true,
      reasons: [],
    },
    staleness: { freshness: "not-required", expired: false, reasons: [] },
    lifecycleState: "REQUIRES_HUMAN_REVIEW",
    idempotencyKey: `idem_${subject}`,
    limitations: [],
  } as HebyPreparedAction;
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_r3a_singlespend");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  /* Before anything is issued: adopt the clock that will adjudicate the race below. */
  NOW = await readDatabaseNow(setup);
  const handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db, now: () => NOW } as never;

  try {
    const acme = (await seedLocalIdentity(setup, {
      companyName: "Acme",
      companySlug: "acme-r3a-spend",
      email: "director@acme.test",
    })) as Seeded;

    const session = await setup.query<{ id: string }>(
      `insert into user_session_contexts
         (auth_identity_id, provider_session_reference_hash, provider_session_reference_digest_version,
          user_id, active_tenant_id, active_membership_id, membership_version, assurance_level,
          mfa_verified, authenticated_at, issued_at, last_activity_at, absolute_expires_at,
          inactivity_expires_at)
       values ($1, $2, 1, $3, $4, $5, 1, 'aal1', false, now(), now(), now(),
               now() + interval '1 day', now() + interval '1 hour')
       returning id`,
      [acme.authIdentityId, "a".repeat(64), acme.userId, acme.tenantId, acme.membershipId],
    );

    const ctx: TenantContext = {
      tenantId: acme.tenantId,
      userId: acme.userId,
      authIdentityId: acme.authIdentityId,
      membershipId: acme.membershipId,
      membershipVersion: 1,
      roleId: acme.roleId,
      sessionContextId: session.rows[0]!.id,
      provider: "local",
      assuranceLevel: "aal1",
      mfaVerified: false,
      requestId: "r3a-spend",
      authenticatedAt: NOW.toISOString(),
    };

    await setup.query(
      `insert into genesis_nominations
         (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
          accepted_at, accepted_session_context_id, accepted_assurance_level)
       values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
      [acme.tenantId, acme.authIdentityId, acme.userId, ctx.sessionContextId],
    );
    assert.equal(
      (await establishGovernanceAuthority(ctx, { justification: JUSTIFICATION }, deps)).status,
      "established",
    );

    const issuePermit = async (subject: string): Promise<string> => {
      const req = await recordActionRequest(ctx, prepared(subject), deps);
      assert.equal(req.status, "recorded");
      const approval = await approveActionRequest(
        ctx,
        { requestId: req.status === "recorded" ? req.requestId : "", justification: JUSTIFICATION },
        deps,
      );
      assert.equal(approval.status, "authorized");
      return approval.status === "authorized" ? approval.permitId : "";
    };

    /* ── RACE 1: eight callers, one permit ─────────────────────────────────── */
    {
      const permitId = await issuePermit("race-one");

      const attempts = await Promise.all(
        Array.from({ length: 8 }, () => consumeActionPermit(ctx, { permitId }, deps)),
      );

      const winners = attempts.filter((a) => a.status === "authorized");
      assert.equal(winners.length, 1, "exactly one caller may spend a permit");

      /* Every loser must be honestly refused — never a silent success, never a crash. */
      const losers = attempts.filter((a) => a.status === "refused");
      assert.equal(losers.length, 7, "every other caller must be refused");
      assert.ok(
        losers.every((l) => l.status === "refused" && l.reason === "permit-not-consumable"),
        "a lost race is not a persistence failure",
      );

      /* One handoff exists, and it is the winner's. */
      const row = await setup.query(
        `select status, handoff_id, consumed_at from action_permits where id = $1`,
        [permitId],
      );
      assert.equal(row.rows[0]!.status, "consumed");
      assert.equal(
        row.rows[0]!.handoff_id,
        winners[0]!.status === "authorized" ? winners[0]!.authorization.handoffId : null,
        "the stored handoff must be the one the winner received",
      );

      /* Exactly one consumption event — not eight, not zero. */
      const audit = await setup.query(
        `select count(*)::int as n from audit_log
          where action = 'governance.action.permit.consumed' and entity_id = $1`,
        [permitId],
      );
      assert.equal(audit.rows[0]!.n, 1, "a lost race must leave no audit residue");
    }

    /* ── RACE 2: revoke and spend arriving together ────────────────────────── */
    {
      const permitId = await issuePermit("race-two");

      const [revocation, consumption] = await Promise.all([
        revokeActionPermit(
          ctx,
          {
            permitId,
            justification: JUSTIFICATION,
            revocationReason: "Withdrawn while a caller was spending it.",
          },
          deps,
        ),
        consumeActionPermit(ctx, { permitId }, deps),
      ]);

      const revoked = revocation.status === "revoked";
      const consumed = consumption.status === "authorized";
      assert.ok(
        revoked !== consumed,
        "a permit must be either revoked or spent, never both and never neither",
      );

      const row = await setup.query(`select status from action_permits where id = $1`, [permitId]);
      assert.ok(
        ["revoked", "consumed"].includes(String(row.rows[0]!.status)),
        "the row must settle on exactly one terminal state",
      );
      assert.equal(
        row.rows[0]!.status,
        revoked ? "revoked" : "consumed",
        "the stored state must match whichever caller actually won",
      );
    }

    /* ── RACE 3: two approvals of one request ──────────────────────────────── */
    {
      const req = await recordActionRequest(ctx, prepared("race-three"), deps);
      const requestId = req.status === "recorded" ? req.requestId : "";

      const attempts = await Promise.all([
        approveActionRequest(ctx, { requestId, justification: JUSTIFICATION }, deps),
        approveActionRequest(ctx, { requestId, justification: JUSTIFICATION }, deps),
      ]);
      const authorized = attempts.filter((a) => a.status === "authorized");
      assert.equal(authorized.length, 1, "one request may yield only one permit");

      const permits = await setup.query(
        `select count(*)::int as n from action_permits where action_request_id = $1`,
        [requestId],
      );
      assert.equal(permits.rows[0]!.n, 1, "a lost approval race must leave no permit behind");

      const decisions = await setup.query(
        `select count(*)::int as n from decision_records
          where subject_id = $1 and decision_type = 'approve'`,
        [requestId],
      );
      assert.equal(
        decisions.rows[0]!.n,
        1,
        "a lost approval race must leave no orphan Governance decision",
      );
    }

    console.log("PASS r3a single-spend concurrency (postgres)");
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose().catch(() => {});
    await harness.dropDatabase();
  }
}

void main();
