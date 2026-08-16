/*
 * R3A — Durable Authorization to Act, against a REAL PostgreSQL database.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "A human holding Tenant T's Governance authority can durably authorize ONE specific
 *    consequential action, with its parameters cryptographically frozen, producing a Governance
 *    decision and a bounded, expiring, revocable, single-spend permit that survives restart and
 *    yields an execution authorization exactly once — AND NOTHING IS EVER EXECUTED."
 *
 * Plus every attack case the Gate A threat model named.
 *
 * Uses a disposable local database, dropped on exit. The canonical database is never opened.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
// Loaded FIRST: the schema barrel is the only safe entry point for src/db/schema/*.
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { recordActionRequest } from "../../src/features/action-authorization/record-action-request.server";
import {
  approveActionRequest,
  rejectActionRequest,
  clampTtlSeconds,
} from "../../src/features/action-authorization/decide-action-request.server";
import { revokeActionPermit } from "../../src/features/action-authorization/revoke-action-permit.server";
import { consumeActionPermit } from "../../src/features/action-authorization/consume-action-permit.server";
import {
  readActionPermits,
  readPendingActionRequests,
} from "../../src/features/action-authorization/read-action-authorizations.server";
import {
  ACTION_APPROVED_OUTCOME,
  ACTION_AUTHORIZATION_DOMAIN,
  ACTION_PERMIT_REVOKED_OUTCOME,
  ACTION_PERMIT_SUBJECT_TYPE,
  ACTION_REJECTED_OUTCOME,
  ACTION_REQUEST_SUBJECT_TYPE,
  PERMIT_MAX_TTL_SECONDS,
} from "../../src/features/action-authorization/contracts";
import { digestCanonicalAction } from "../../src/features/action-authorization/canonical-payload";
import type { HebyPreparedAction } from "../../src/features/heby-actions/contracts";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

/*
 * ── THE ISSUANCE CLOCK IS READ FROM THE DATABASE, NEVER FROM THE CALENDAR ────
 *
 * This was a fixed literal — `2026-08-16T09:00:00.000Z` — and that made the file a time bomb.
 * Approval derives `expires_at = injectedNow + ttlSeconds` (default 3600s), while consumption
 * checks `expires_at > now()` against the DATABASE clock, deliberately: a caller that could pass
 * its own `now` could also pass a convenient one. Two clock domains, and a literal in one of them.
 * The permit issued at 09:00Z therefore stopped being spendable at 10:00Z real time, and every
 * "live permit" assertion in this file failed permanently from that instant on.
 *
 * The fix is to make the fixture agree with the clock that actually adjudicates it, NOT to let the
 * caller's clock reach the expiry predicate. Production semantics are untouched: `consumeActionPermit`
 * still asks PostgreSQL what time it is.
 *
 * Assigned once in `main`, before anything is issued. Section 13 already ages permits with
 * `now() - interval` in SQL, so deterministic expiry keeps working exactly as written.
 */
let NOW: Date;

/** The adjudicating clock itself, so issuance and consumption cannot drift apart. */
async function readDatabaseNow(client: Client): Promise<Date> {
  const row = await client.query<{ now: Date }>("select now() as now");
  return row.rows[0]!.now;
}

const JUSTIFICATION =
  "This external message is a deliberate organizational act and I accept responsibility for it.";

interface Seeded {
  readonly tenantId: string;
  readonly userId: string;
  readonly authIdentityId: string;
  readonly membershipId: string;
  readonly roleId: string;
}

/** A durable session row, because Governance authority is resolved from one. */
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

function contextFor(seeded: Seeded, sessionContextId: string): TenantContext {
  return {
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
    requestId: "r3a-request",
    authenticatedAt: NOW.toISOString(),
  };
}

/** A prepared CONSEQUENTIAL_MUTATION exactly as the Heby lifecycle would hand it over. */
function preparedAction(overrides: Partial<HebyPreparedAction> = {}): HebyPreparedAction {
  return {
    actionId: "act_deadbeef",
    actionKind: "send-external-communication",
    toolId: "heby.operations.send-communication",
    capability: "operations.communication",
    sideEffect: "CONSEQUENTIAL_MUTATION",
    reversibility: "irreversible",
    ownerWorkspace: "operations",
    requestingWorkspace: "operations",
    target: { kind: "record", ref: "contact-7781", label: "Ayşe Yılmaz" },
    arguments: { channel: "email", subject: "Quarterly summary", urgent: false },
    argumentsValid: true,
    evidence: [],
    provenance: ["heby-actions registry"],
    provenanceCovered: ["what-was-found"],
    uncertainty: "supported",
    expectedEffect: "Sends one external email to the named contact.",
    consequences: ["The recipient receives a message.", "This cannot be unsent."],
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
    idempotencyKey: "idem_deadbeef",
    limitations: [],
    ...overrides,
  } as HebyPreparedAction;
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_r3a_authorization");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  /* Before anything is issued: adopt the clock that will adjudicate every expiry below. */
  NOW = await readDatabaseNow(setup);
  const handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db, now: () => NOW } as never;

  try {
    const acme = (await seedLocalIdentity(setup, {
      companyName: "Acme",
      companySlug: "acme-r3a",
      email: "director@acme.test",
    })) as Seeded;
    const globex = (await seedLocalIdentity(setup, {
      companyName: "Globex",
      companySlug: "globex-r3a",
      email: "other@globex.test",
    })) as Seeded;

    const acmeCtx = contextFor(acme, await sessionRowFor(setup, acme, "aaaa"));
    const globexCtx = contextFor(globex, await sessionRowFor(setup, globex, "bbbb"));

    /*
     * Governance authority is established the only way the repository allows: an accepted G2.1
     * genesis entitlement, then the bootstrap decision that spends it. BOTH tenants get their own,
     * so the cross-tenant cases below prove isolation rather than merely proving that a stranger
     * with no authority anywhere is refused — a much weaker claim.
     */
    const establish = async (seeded: Seeded, ctx: TenantContext) => {
      await setup.query(
        `insert into genesis_nominations
           (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
            accepted_at, accepted_session_context_id, accepted_assurance_level)
         values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
        [seeded.tenantId, seeded.authIdentityId, seeded.userId, ctx.sessionContextId],
      );
      assert.equal(
        (await establishGovernanceAuthority(ctx, { justification: JUSTIFICATION }, deps)).status,
        "established",
      );
    };
    await establish(acme, acmeCtx);
    await establish(globex, globexCtx);

    /* ── 1. A prepared action becomes a durable, digest-frozen request ────── */
    const recorded = await recordActionRequest(acmeCtx, preparedAction(), deps);
    assert.equal(recorded.status, "recorded", "a REQUIRES_HUMAN_REVIEW action must persist");
    const requestId = recorded.status === "recorded" ? recorded.requestId : "";
    const digest = recorded.status === "recorded" ? recorded.payloadDigest : "";
    assert.match(digest, /^[0-9a-f]{64}$/, "the binding must be a SHA-256 hex digest");

    /* The digest is reproducible from the same content, and only from it. */
    assert.equal(
      digest,
      digestCanonicalAction({
        actionKind: "send-external-communication",
        toolId: "heby.operations.send-communication",
        targetKind: "record",
        targetRef: "contact-7781",
        payload: { channel: "email", subject: "Quarterly summary", urgent: false },
      }),
      "same payload must produce the same digest",
    );

    /* ── 2. No permit exists yet. APPROVAL ≠ PERMIT, and neither has happened ─ */
    {
      const permits = await setup.query(`select count(*)::int as n from action_permits`);
      assert.equal(permits.rows[0]!.n, 0, "a pending request must mint no permit");
    }

    /* ── 3. A duplicate proposal for the same act is refused ───────────────── */
    {
      const again = await recordActionRequest(acmeCtx, preparedAction(), deps);
      assert.equal(again.status, "refused");
      assert.equal(again.status === "refused" ? again.reason : "", "already-pending");
    }

    /* ── 4. Only authorizable classes reach a human ────────────────────────── */
    for (const [state, side, expected] of [
      ["EXECUTION_ELIGIBLE", "READ_ONLY", "not-authorizable"],
      ["RESTRICTED", "DEVICE_ACTION", "not-authorizable"],
      ["REQUIRES_HUMAN_REVIEW", "DEVICE_ACTION", "side-effect-not-authorizable"],
    ] as const) {
      const res = await recordActionRequest(
        acmeCtx,
        preparedAction({ lifecycleState: state, sideEffect: side } as never),
        deps,
      );
      assert.equal(res.status, "refused", `${state}/${side} must not persist`);
      assert.equal(res.status === "refused" ? res.reason : "", expected);
    }

    /* ── 5. A stranger to Governance cannot approve ────────────────────────── */
    {
      const foreign = await approveActionRequest(
        globexCtx,
        { requestId, justification: JUSTIFICATION },
        deps,
      );
      assert.equal(foreign.status, "refused");
      assert.equal(
        foreign.status === "refused" ? foreign.reason : "",
        "request-unresolvable",
        "another tenant's request must not even resolve",
      );
    }

    /* ── 6. Approval mints exactly one permit, atomically ──────────────────── */
    const approved = await approveActionRequest(
      acmeCtx,
      { requestId, justification: JUSTIFICATION, requestedTtlSeconds: 3600 },
      deps,
    );
    assert.equal(approved.status, "authorized", "the Governance authority must be able to approve");
    const permitId = approved.status === "authorized" ? approved.permitId : "";
    const decisionId = approved.status === "authorized" ? approved.decisionId : "";

    {
      const decision = await setup.query(
        `select decision_type, subject_type, subject_id, outcome, actor_type
           from decision_records where id = $1`,
        [decisionId],
      );
      assert.equal(decision.rows[0]!.decision_type, "approve");
      assert.equal(decision.rows[0]!.subject_type, ACTION_REQUEST_SUBJECT_TYPE);
      assert.equal(decision.rows[0]!.subject_id, requestId);
      assert.equal(decision.rows[0]!.outcome, ACTION_APPROVED_OUTCOME);
      assert.equal(decision.rows[0]!.actor_type, "human");

      const session = await setup.query(
        `select governance_domain from governance_sessions
          where id = (select session_id from decision_records where id = $1)`,
        [decisionId],
      );
      assert.equal(
        session.rows[0]!.governance_domain,
        ACTION_AUTHORIZATION_DOMAIN,
        "an action authorization must not borrow another domain",
      );

      const permit = await setup.query(
        `select status, bound_payload_digest, ttl_seconds, expires_at > issued_at as bounded
           from action_permits where id = $1`,
        [permitId],
      );
      assert.equal(permit.rows[0]!.status, "active");
      assert.equal(permit.rows[0]!.bound_payload_digest, digest, "the permit must bind the digest");
      assert.equal(permit.rows[0]!.bounded, true, "expiry must be after issuance");
    }

    /* ── 7. Audit: approved + issued, exactly once each, and executed = false ─ */
    {
      const audit = await setup.query(
        `select action, count(*)::int as n, bool_and((metadata->>'executed') = 'false') as never_executed
           from audit_log where tenant_id = $1 and action like 'governance.action.%'
          group by action order by action`,
        [acme.tenantId],
      );
      const byAction = Object.fromEntries(audit.rows.map((r) => [r.action, r.n]));
      assert.equal(byAction["governance.action.approved"], 1, "one approval event");
      assert.equal(byAction["governance.action.permit.issued"], 1, "one issuance event");
      assert.ok(
        audit.rows.every((r) => r.never_executed === true),
        "every authorization event must record executed = false",
      );
    }

    /* ── 8. Approving twice is refused ─────────────────────────────────────── */
    {
      const again = await approveActionRequest(
        acmeCtx,
        { requestId, justification: JUSTIFICATION },
        deps,
      );
      assert.equal(again.status, "refused");
      assert.equal(again.status === "refused" ? again.reason : "", "request-not-pending");
    }

    /* ── 9. Consumption yields exactly one authorization, and nothing runs ─── */
    const spent = await consumeActionPermit(acmeCtx, { permitId }, deps);
    assert.equal(spent.status, "authorized", "a live permit must be spendable once");
    if (spent.status === "authorized") {
      assert.equal(spent.authorization.permitId, permitId);
      assert.equal(spent.authorization.boundPayloadDigest, digest);
      assert.equal(spent.authorization.authorizationDecisionId, decisionId);
      assert.deepEqual(spent.authorization.canonicalPayload, {
        channel: "email",
        subject: "Quarterly summary",
        urgent: false,
      });
      assert.match(spent.authorization.handoffId, /^[0-9a-f-]{36}$/);
      assert.ok(
        !Object.keys(spent.authorization).some((k) => /secret|token|password|credential/i.test(k)),
        "an execution authorization must carry no secret material",
      );
    }

    /* ── 10. SINGLE SPEND. The second attempt gets nothing ─────────────────── */
    {
      const replay = await consumeActionPermit(acmeCtx, { permitId }, deps);
      assert.equal(replay.status, "refused");
      assert.equal(replay.status === "refused" ? replay.reason : "", "permit-not-consumable");
    }

    /* ── 11. A consumed permit cannot be revoked, and stays consumed ───────── */
    {
      const late = await revokeActionPermit(
        acmeCtx,
        { permitId, justification: JUSTIFICATION, revocationReason: "changed my mind" },
        deps,
      );
      assert.equal(late.status, "refused");
      assert.equal(late.status === "refused" ? late.reason : "", "permit-not-active");
    }

    /* ── 12. Revocation on a fresh permit really works, and blocks spending ── */
    {
      const r2 = await recordActionRequest(
        acmeCtx,
        preparedAction({
          actionId: "act_second",
          arguments: { channel: "email", subject: "Second note", urgent: true },
        } as never),
        deps,
      );
      const secondRequestId = r2.status === "recorded" ? r2.requestId : "";
      const a2 = await approveActionRequest(
        acmeCtx,
        { requestId: secondRequestId, justification: JUSTIFICATION },
        deps,
      );
      const secondPermitId = a2.status === "authorized" ? a2.permitId : "";

      const revoked = await revokeActionPermit(
        acmeCtx,
        {
          permitId: secondPermitId,
          justification: JUSTIFICATION,
          revocationReason: "The recipient asked us not to send it.",
        },
        deps,
      );
      assert.equal(revoked.status, "revoked", "revocation must be implemented, not merely declared");

      const decision = await setup.query(
        `select decision_type, subject_type, outcome from decision_records where id = $1`,
        [revoked.status === "revoked" ? revoked.decisionId : ""],
      );
      assert.equal(decision.rows[0]!.decision_type, "revoke");
      assert.equal(decision.rows[0]!.subject_type, ACTION_PERMIT_SUBJECT_TYPE);
      assert.equal(
        decision.rows[0]!.outcome,
        ACTION_PERMIT_REVOKED_OUTCOME,
        "revoking a permit must not be labelled as revoking Governance authority",
      );

      const afterRevoke = await consumeActionPermit(acmeCtx, { permitId: secondPermitId }, deps);
      assert.equal(afterRevoke.status, "refused", "a revoked permit must be unspendable");

      /* The approved request keeps its history: revocation adds, never erases. */
      const req = await setup.query(`select status from heby_action_requests where id = $1`, [
        secondRequestId,
      ]);
      assert.equal(req.rows[0]!.status, "approved", "revocation must not rewrite the approval");
    }

    /* ── 13. EXPIRY blocks consumption, using the database clock ───────────── */
    {
      const r3 = await recordActionRequest(
        acmeCtx,
        preparedAction({
          actionId: "act_third",
          arguments: { channel: "email", subject: "Third note", urgent: false },
        } as never),
        deps,
      );
      const thirdRequestId = r3.status === "recorded" ? r3.requestId : "";
      const a3 = await approveActionRequest(
        acmeCtx,
        { requestId: thirdRequestId, justification: JUSTIFICATION },
        deps,
      );
      const thirdPermitId = a3.status === "authorized" ? a3.permitId : "";

      /*
       * Age the permit rather than back-dating its expiry alone.
       * `action_permits_expiry_after_issue_chk` refuses `expires_at < issued_at`, which is the
       * correct behaviour and worth stating: an operator cannot quietly retro-expire a live
       * authorization instead of revoking it, because revocation is the auditable act and expiry
       * is not. So the whole permit is moved into the past, consistently.
       */
      await setup.query(
        `update action_permits
            set issued_at = now() - interval '2 hours',
                expires_at = now() - interval '1 hour'
          where id = $1`,
        [thirdPermitId],
      );
      const expired = await consumeActionPermit(acmeCtx, { permitId: thirdPermitId }, deps);
      assert.equal(expired.status, "refused", "an expired permit must be unspendable");
      assert.equal(
        expired.status === "refused" ? expired.reason : "",
        "permit-not-consumable",
      );

      /* And the surface reports it as expired even though the column still says active. */
      const view = await readActionPermits(acmeCtx, { getDb: () => handle.db } as never);
      assert.equal(view.status, "read");
      if (view.status === "read") {
        const row = view.items.find((i) => i.permitId === thirdPermitId);
        assert.equal(row?.state, "expired", "expiry must be derived at read time");
        assert.equal(row?.executed, false, "the surface must state nothing was executed");
      }
    }

    /* ── 14. DIGEST MISMATCH. A drifted payload cannot be spent ────────────── */
    let stillActivePermitId = "";
    {
      const r4 = await recordActionRequest(
        acmeCtx,
        preparedAction({
          actionId: "act_fourth",
          arguments: { channel: "email", subject: "Fourth note", urgent: false },
        } as never),
        deps,
      );
      const fourthRequestId = r4.status === "recorded" ? r4.requestId : "";
      const a4 = await approveActionRequest(
        acmeCtx,
        { requestId: fourthRequestId, justification: JUSTIFICATION },
        deps,
      );
      const fourthPermitId = a4.status === "authorized" ? a4.permitId : "";

      /* Tamper with the approved parameters exactly as an attacker would. */
      await setup.query(
        `update heby_action_requests
            set canonical_payload = jsonb_set(canonical_payload, '{subject}', '"Wire the money"')
          where id = $1`,
        [fourthRequestId],
      );

      const tampered = await consumeActionPermit(acmeCtx, { permitId: fourthPermitId }, deps);
      assert.equal(tampered.status, "refused", "a changed parameter must refuse");
      assert.equal(tampered.status === "refused" ? tampered.reason : "", "digest-mismatch");

      /* And the permit was NOT burned by the refusal — the spend rolled back with it. */
      const still = await setup.query(`select status from action_permits where id = $1`, [
        fourthPermitId,
      ]);
      assert.equal(still.rows[0]!.status, "active", "a content refusal must not consume the permit");
      stillActivePermitId = fourthPermitId;

      /* Approval of a drifted request is refused for the same reason. */
      const r5 = await recordActionRequest(
        acmeCtx,
        preparedAction({
          actionId: "act_fifth",
          arguments: { channel: "email", subject: "Fifth note", urgent: false },
        } as never),
        deps,
      );
      const fifthId = r5.status === "recorded" ? r5.requestId : "";
      await setup.query(
        `update heby_action_requests
            set canonical_payload = jsonb_set(canonical_payload, '{subject}', '"Something else"')
          where id = $1`,
        [fifthId],
      );
      const drifted = await approveActionRequest(
        acmeCtx,
        { requestId: fifthId, justification: JUSTIFICATION },
        deps,
      );
      assert.equal(drifted.status, "refused");
      assert.equal(drifted.status === "refused" ? drifted.reason : "", "digest-mismatch");
    }

    /* ── 15. Rejection is a decision, and frees the duplicate slot ─────────── */
    {
      const r6 = await recordActionRequest(
        acmeCtx,
        preparedAction({
          actionId: "act_sixth",
          arguments: { channel: "email", subject: "Sixth note", urgent: false },
        } as never),
        deps,
      );
      const sixthId = r6.status === "recorded" ? r6.requestId : "";

      const noReason = await rejectActionRequest(
        acmeCtx,
        { requestId: sixthId, justification: JUSTIFICATION, rejectionReason: "  " },
        deps,
      );
      assert.equal(noReason.status, "refused");
      assert.equal(
        noReason.status === "refused" ? noReason.reason : "",
        "rejection-reason-required",
        "a refusal nobody can review is not a decision",
      );

      const rejected = await rejectActionRequest(
        acmeCtx,
        {
          requestId: sixthId,
          justification: JUSTIFICATION,
          rejectionReason: "We do not contact customers on a Sunday.",
        },
        deps,
      );
      assert.equal(rejected.status, "rejected");

      const decision = await setup.query(
        `select decision_type, outcome from decision_records where id = $1`,
        [rejected.status === "rejected" ? rejected.decisionId : ""],
      );
      assert.equal(decision.rows[0]!.decision_type, "reject");
      assert.equal(decision.rows[0]!.outcome, ACTION_REJECTED_OUTCOME);

      const permits = await setup.query(
        `select count(*)::int as n from action_permits where action_request_id = $1`,
        [sixthId],
      );
      assert.equal(permits.rows[0]!.n, 0, "a rejected request must mint no permit");

      /* The same act may now be proposed again — a refusal is not a permanent ban. */
      const reproposed = await recordActionRequest(
        acmeCtx,
        preparedAction({
          actionId: "act_sixth",
          arguments: { channel: "email", subject: "Sixth note", urgent: false },
        } as never),
        deps,
      );
      assert.equal(reproposed.status, "recorded", "rejection must free the duplicate slot");
    }

    /* ── 16. TTL is server-bounded; a client may not widen it ──────────────── */
    assert.equal(clampTtlSeconds(999_999_999), PERMIT_MAX_TTL_SECONDS, "TTL must be clamped");
    assert.equal(clampTtlSeconds(-5), 60, "TTL must have a floor");
    {
      const r7 = await recordActionRequest(
        acmeCtx,
        preparedAction({
          actionId: "act_seventh",
          arguments: { channel: "email", subject: "Seventh", urgent: false },
        } as never),
        deps,
      );
      const seventhId = r7.status === "recorded" ? r7.requestId : "";
      const a7 = await approveActionRequest(
        acmeCtx,
        { requestId: seventhId, justification: JUSTIFICATION, requestedTtlSeconds: 10_000_000 },
        deps,
      );
      const row = await setup.query(`select ttl_seconds from action_permits where id = $1`, [
        a7.status === "authorized" ? a7.permitId : "",
      ]);
      assert.equal(row.rows[0]!.ttl_seconds, PERMIT_MAX_TTL_SECONDS);
    }

    /* ── 17. DATABASE-ENFORCED INVARIANTS, not application hopes ───────────── */

    /* An agent may never be the authorizing actor. */
    await assert.rejects(
      setup.query(
        `insert into action_permits
           (tenant_id, action_request_id, governance_decision_id, governance_session_id,
            authorized_by_actor_type, authorized_by_actor_id, bound_payload_digest,
            expires_at, ttl_seconds)
         select tenant_id, action_request_id, governance_decision_id, governance_session_id,
                'agent', authorized_by_actor_id, bound_payload_digest,
                issued_at + interval '1 hour', 3600
           from action_permits where id = $1`,
        [permitId],
      ),
      /action_permits_human_authorizer_chk/,
      "human supremacy must be a database fact",
    );

    /* A permit with no Governance decision is not a representable row. */
    await assert.rejects(
      setup.query(
        `insert into action_permits
           (tenant_id, action_request_id, governance_decision_id, governance_session_id,
            authorized_by_actor_type, authorized_by_actor_id, bound_payload_digest,
            expires_at, ttl_seconds)
         values ($1, $2, null, null, 'human', $3, repeat('a', 64), now() + interval '1 hour', 3600)`,
        [acme.tenantId, requestId, acme.userId],
      ),
      /null value in column|not-null constraint/i,
      "no permit without a Governance decision",
    );

    /*
     * Consumption cannot be claimed without naming the handoff. Asserted against a permit that is
     * still ACTIVE — re-stating `consumed` on an already-consumed row is a satisfied no-op, and a
     * test that used one would prove nothing while looking like it did.
     */
    await assert.rejects(
      setup.query(`update action_permits set status = 'consumed' where id = $1`, [
        stillActivePermitId,
      ]),
      /action_permits_consumed/,
      "consumed without evidence must be unrepresentable",
    );

    /* And a handoff cannot be claimed without moving the status. */
    await assert.rejects(
      setup.query(`update action_permits set handoff_id = gen_random_uuid() where id = $1`, [
        stillActivePermitId,
      ]),
      /action_permits_consumed/,
      "a handoff without a consumption is unrepresentable",
    );

    /* A device action can never be stored as an authorizable request. */
    await assert.rejects(
      setup.query(
        `update heby_action_requests set side_effect = 'DEVICE_ACTION' where id = $1`,
        [requestId],
      ),
      /heby_action_requests_no_device_action_chk/,
      "Computer Use must not be authorizable through R3A",
    );

    /* A digest that is not a SHA-256 hex string is refused. */
    await assert.rejects(
      setup.query(`update action_permits set bound_payload_digest = $1 where id = $2`, [
        "not-a-digest".padEnd(64, "z"),
        permitId,
      ]),
      /action_permits_bound_digest_chk/,
      "the binding must structurally be a SHA-256 digest",
    );

    /*
     * CROSS-TENANT: a permit may not point at another tenant's request.
     *
     * Expressed as an UPDATE of the tenant rather than an INSERT, deliberately. Copying a permit
     * row would trip `action_permits_decision_uq` first — a real constraint, but the wrong one, and
     * a test that passed on it would be asserting decision uniqueness while claiming to prove
     * tenant isolation. Moving the tenant reaches the composite foreign key and nothing else.
     */
    await assert.rejects(
      setup.query(`update action_permits set tenant_id = $1 where id = $2`, [
        globex.tenantId,
        permitId,
      ]),
      /action_permits_tenant_request_fk|violates foreign key/i,
      "a permit must not reach across tenants",
    );

    /* The same invariant from the other side: a request may not be re-homed under a permit. */
    await assert.rejects(
      setup.query(`update heby_action_requests set tenant_id = $1 where id = $2`, [
        globex.tenantId,
        requestId,
      ]),
      /action_permits_tenant_request_fk|violates foreign key/i,
      "an approved request must not be moved out from under its permit",
    );

    /* ── 18. RESTART SAFETY. A brand-new connection sees the same truth ────── */
    {
      const reopened = createControlPlaneDb(harness.dbUrl);
      try {
        const view = await readActionPermits(acmeCtx, { getDb: () => reopened.db } as never);
        assert.equal(view.status, "read");
        if (view.status === "read") {
          const row = view.items.find((i) => i.permitId === permitId);
          assert.equal(row?.state, "consumed", "a spent permit must stay spent across a restart");
          assert.equal(row?.boundPayloadDigest, digest);
        }
        const pending = await readPendingActionRequests(acmeCtx, {
          getDb: () => reopened.db,
        } as never);
        assert.equal(pending.status, "read");
      } finally {
        await reopened.dispose().catch(() => {});
      }
    }

    /* ── 19. TENANT ISOLATION on every read ────────────────────────────────── */
    {
      const foreignPending = await readPendingActionRequests(globexCtx, {
        getDb: () => handle.db,
      } as never);
      assert.equal(foreignPending.status, "read");
      if (foreignPending.status === "read") {
        assert.equal(foreignPending.items.length, 0, "Globex must not see Acme's proposals");
      }
      const foreignPermits = await readActionPermits(globexCtx, { getDb: () => handle.db } as never);
      assert.equal(foreignPermits.status, "read");
      if (foreignPermits.status === "read") {
        assert.equal(foreignPermits.items.length, 0, "Globex must not see Acme's permits");
      }
    }

    /* ── 20. NOTHING WAS EXECUTED. The whole point ─────────────────────────── */
    {
      const executed = await setup.query(
        `select count(*)::int as n from audit_log
          where tenant_id = $1 and (metadata->>'executed') <> 'false'`,
        [acme.tenantId],
      );
      assert.equal(executed.rows[0]!.n, 0, "no authorization event may claim execution");

      const executions = await setup.query(`select count(*)::int as n from executions`);
      assert.equal(executions.rows[0]!.n, 0, "R3A must write no execution row");
    }

    console.log("PASS r3a durable authorization (postgres)");
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose().catch(() => {});
    await harness.dropDatabase();
  }
}

void main();
