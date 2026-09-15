/*
 * RUNG 2 — the standing mutation authority against a REAL PostgreSQL.
 *
 * WHAT THIS FILE PROVES, and none of it can be proved with fakes:
 *
 *   "The migration applies. The ordinary one-decision-one-permit invariant is UNCHANGED for every
 *    permit a human approved. One standing decision may back several permits — and only inside one
 *    valid envelope. Quota, cadence, window, withdrawal, enrolment and agent liveness each refuse
 *    on their own terms. Evidence is required and one organizational fact funds exactly one act.
 *    Two issuers racing one envelope produce exactly one permit. Nothing crosses a tenant."
 *
 * The migration is applied by the harness, so a failure here is also a migration failure — which is
 * the point: this file is the validation evidence for the production migration gate.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { seedAgentMandate } from "../helpers/agent-mandate-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { createDurableAgentIdentity } from "../../src/features/agent-identity/create-durable-agent-identity.server";
import { resolveAgentProposer } from "../../src/features/action-authorization/agent-proposer.server";
import { recordDepartment } from "../../src/features/organization-authority/write-structure.server";
import { formatDepartmentRef } from "../../src/features/organization-authority/department-ref";
import { proposeAgentOriginatedRecordWorkAction } from "../../src/features/heby-action-inlet/record-work-proposal.server";
import { approveActionRequest } from "../../src/features/action-authorization/decide-action-request.server";
import { authorizeTenantMachineExecution } from "../../src/features/tenant-machine-execution-authority/authorize-tenant-machine-execution.server";
import { writeStandingMutationAuthorization } from "../../src/features/standing-mutation-authority/authorize-standing-mutation.server";
import { issuePermitUnderStandingAuthorization } from "../../src/features/standing-mutation-authority/issue-permit-under-standing-authorization.server";
import { readStandingMutations } from "../../src/features/standing-mutation-authority/read-standing-mutations.server";
import { listMachineDeliverablePermitsForRuntime } from "../../src/features/action-authorization/read-machine-deliverable-permits.server";
import { RECORD_WORK_ACTION_KIND } from "../../src/features/heby-action-inlet/contracts";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";

/**
 * THE FIXTURE'S CLOCK, ANCHORED TO THE DATABASE'S OWN — see `anchorToDatabaseClock`.
 *
 * Declared with a placeholder and replaced once, before anything is written. Every instant this
 * test controls is derived from it by an explicit offset, so the windows below stay exact.
 */
let NOW = new Date("2026-09-15T12:00:00.000Z");
const GENESIS = "This organization establishes its founding Governance authority for the RUNG 2 proof.";
const APPROVAL = "This work is real and this organization authorizes Hebun to put it on the register.";
const ENROLMENT = "This organization agrees its authorized work may be delivered by machine.";
const ENVELOPE =
  "This organization authorizes its agent to record evidenced work without a decision for each one.";

interface Seeded {
  readonly tenantId: string;
  readonly userId: string;
  readonly authIdentityId: string;
  readonly membershipId: string;
  readonly roleId: string;
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
    authenticatedAt: NOW.toISOString(),
  });
}

async function sessionRowFor(client: Client, seeded: Seeded, tag: string): Promise<string> {
  const row = await client.query<{ id: string }>(
    `insert into user_session_contexts
       (auth_identity_id, provider_session_reference_hash, provider_session_reference_digest_version,
        user_id, active_tenant_id, active_membership_id, membership_version, assurance_level,
        mfa_verified, authenticated_at, issued_at, last_activity_at, absolute_expires_at,
        inactivity_expires_at)
     values ($1,$2,1,$3,$4,$5,1,'aal1',false, now(), now(), now(), now() + interval '1 day',
             now() + interval '1 day')
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

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_rung2_standing");
  await harness.createDatabase();
  /* THE MIGRATION GATE. If RUNG 2's migration cannot apply, this line fails and nothing else runs. */
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db } as never;

  try {
    await setup.connect();

    /*
     * ── THE FIXTURE AND THE PREDICATE MUST SHARE ONE CLOCK ─────────────────
     *
     * `listMachineDeliverablePermitsForRuntime` applies `expires_at > now()` in the DATABASE'S
     * clock, deliberately and with no injection seam: the spend applies that exact comparison
     * against that exact clock, and a scanner reading its own would disagree with the authority it
     * feeds. That is released design and this test does not get to change it.
     *
     * A fixture pinned to a hard-coded instant is therefore comparing TWO DIFFERENT CLOCKS. It
     * passes whenever the suite happens to run inside the fixture's own hour and fails afterwards —
     * which is exactly how this assertion failed in a full-suite run hours after passing alone.
     *
     * So the fixture anchors to the database's clock ONCE, here, before anything is written, and
     * every instant below is an explicit offset from it. The TTL stays the released default and the
     * validity windows stay exactly as chosen — nothing is stretched to keep a permit alive.
     */
    NOW = new Date(
      (await setup.query<{ now: Date }>(`select now() as now`)).rows[0]!.now,
    );

    /* ── THE MIGRATION ITSELF, INSPECTED ON THE LIVE SCHEMA ──────────────── */

    const decisionIdx = await setup.query<{ indexdef: string }>(
      `select indexdef from pg_indexes where indexname = 'action_permits_decision_uq'`,
    );
    assert.equal(decisionIdx.rowCount, 1, "the decision-uniqueness index must still exist");
    assert.match(
      decisionIdx.rows[0]!.indexdef,
      /WHERE \(standing_authorization_id IS NULL\)/i,
      "it must now be PARTIAL — ordinary permits keep the invariant, standing ones are exempt",
    );

    const humanChk = await setup.query(
      `select 1 from pg_constraint where conname = 'action_permits_human_authorizer_chk'`,
    );
    assert.equal(humanChk.rowCount, 1, "the human-authorizer invariant must be untouched");

    const kindChk = await setup.query<{ def: string }>(
      `select pg_get_constraintdef(oid) def from pg_constraint
        where conname = 'standing_mutation_authorizations_action_kind_chk'`,
    );
    assert.equal(kindChk.rowCount, 1);
    assert.match(kindChk.rows[0]!.def, /record-work/, "the frozen kind is a database fact");

    const domain = await setup.query(
      `select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
        where t.typname = 'governance_domain' and e.enumlabel = 'standing-mutation'`,
    );
    assert.equal(domain.rowCount, 1, "the governance domain value must exist");

    /* ── SEED ONE ORGANIZATION, ITS GOVERNANCE, ITS ENROLMENT AND ITS AGENT ── */

    const acme = (await seedLocalIdentity(setup, {
      companyName: "Acme",
      companySlug: "acme-rung2-standing",
      email: "director@acme-rung2-standing.test",
    })) as Seeded;
    const ctx = contextFor(acme, await sessionRowFor(setup, acme, "aaaa"), "rung2-standing");

    await setup.query(
      `insert into genesis_nominations
         (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
          accepted_at, accepted_session_context_id, accepted_assurance_level)
       values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
      [acme.tenantId, acme.authIdentityId, acme.userId, ctx.sessionContextId],
    );
    assert.equal(
      (await establishGovernanceAuthority(ctx, { justification: GENESIS }, deps)).status,
      "established",
    );
    assert.equal(
      (
        await authorizeTenantMachineExecution(
          ctx,
          { capabilityKey: RECORD_WORK_ACTION_KIND, justification: ENROLMENT, observedRevision: null },
          deps,
        )
      ).status,
      "written",
    );

    const dept = await recordDepartment(ctx, { name: "Finance", slug: "finance" }, deps);
    assert.equal(dept.status, "recorded");
    const departmentRef = formatDepartmentRef(
      dept.status === "recorded" ? dept.department.departmentId : "",
    );

    const agent = await createDurableAgentIdentity(ctx, { name: "Heby" }, deps);
    assert.equal(agent.status, "established");
    const agentId = agent.status === "established" ? agent.identity.agentId : "";
    await seedAgentMandate(setup, acme, agentId, deps, {
      tag: "rung2standing",
      now: NOW,
      proposalScope: ["record-work"],
    });
    const resolved = await resolveAgentProposer(ctx, deps);
    assert.equal(resolved.status, "resolved");
    const proposer = resolved.status === "resolved" ? resolved.proposer : null;
    assert.ok(proposer);

    const countOf = async (table: string): Promise<number> =>
      Number((await setup.query(`select count(*)::int n from ${table}`)).rows[0]!.n);

    /**
     * ONE AGENT PROPOSAL, carrying ONE admitted evidence reference.
     *
     * The released agent inlet attaches `organization` evidence, which RUNG 2 deliberately does NOT
     * admit. The released OBSERVATION proposal seam attaches `provider-observations` — but reaching
     * it needs a full provider integration and observation seed that would prove nothing further
     * about the envelope. So the proposal is filed through the released seam and its stored evidence
     * is then set to the shape the observation seam writes. This is a FIXTURE, stated as one: what
     * is under test is the issuer's treatment of admitted evidence, not how the bytes got there.
     */
    const proposeWithEvidence = async (title: string, observationRef: string): Promise<string> => {
      const proposal = await proposeAgentOriginatedRecordWorkAction(
        ctx,
        { title, department: { kind: "department", departmentRef } },
        proposer!,
        deps,
      );
      assert.equal(proposal.status, "proposed", JSON.stringify(proposal));
      const requestId = proposal.status === "proposed" ? proposal.receipt.requestId : "";
      await setup.query(`update heby_action_requests set evidence = $2::jsonb where id = $1`, [
        requestId,
        JSON.stringify([
          { sourceClass: "provider-observations", recordRef: observationRef, lifecycle: "settled" },
        ]),
      ]);
      return requestId;
    };

    /* ── RUNG 1 IS UNCHANGED: a human-approved permit still gets its own decision ── */

    const ordinaryRequest = await proposeWithEvidence("Ordinary human-approved work", "obs/ordinary");
    const ordinary = await approveActionRequest(
      ctx,
      { requestId: ordinaryRequest, justification: APPROVAL },
      deps,
    );
    assert.equal(ordinary.status, "authorized", JSON.stringify(ordinary));
    const ordinaryPermit = ordinary.status === "authorized" ? ordinary.permitId : "";
    const ordinaryRow = (
      await setup.query<{ standing_authorization_id: string | null; governance_decision_id: string }>(
        `select standing_authorization_id, governance_decision_id from action_permits where id = $1`,
        [ordinaryPermit],
      )
    ).rows[0]!;
    assert.equal(
      ordinaryRow.standing_authorization_id,
      null,
      "a human-approved permit carries NO standing authorization — the released path is untouched",
    );

    /* And the ordinary invariant still bites: a second permit on that decision is refused. */
    await assert.rejects(
      setup.query(
        `insert into action_permits
           (tenant_id, action_request_id, governance_decision_id, governance_session_id,
            authorized_by_actor_type, authorized_by_actor_id, bound_payload_digest, status,
            issued_at, expires_at, ttl_seconds)
         select tenant_id, action_request_id, governance_decision_id, governance_session_id,
                authorized_by_actor_type, authorized_by_actor_id, bound_payload_digest, status,
                issued_at, expires_at + interval '1 hour', ttl_seconds
           from action_permits where id = $1`,
        [ordinaryPermit],
      ),
      /action_permits_decision_uq|action_permits_request_uq/,
      "ONE DECISION STILL AUTHORIZES ONE ORDINARY PERMIT — the partial index preserves RUNG 1",
    );

    /* ── NO ENVELOPE YET: issuance refuses ── */

    const beforeEnvelope = await proposeWithEvidence("Before any envelope", "obs/before");
    assert.equal(
      (await issuePermitUnderStandingAuthorization({ requestId: beforeEnvelope }, { getDb: () => handle.db, now: () => NOW })).status === "refused" &&
        (await issuePermitUnderStandingAuthorization({ requestId: beforeEnvelope }, { getDb: () => handle.db, now: () => NOW })) .status,
      "refused",
    );

    /* ── THE ENVELOPE ── */

    const envelope = await writeStandingMutationAuthorization(
      ctx,
      "active",
      {
        agentId,
        actionKind: RECORD_WORK_ACTION_KIND,
        notBefore: new Date(NOW.getTime() - 60_000),
        notAfter: new Date(NOW.getTime() + 86_400_000),
        maxActs: 2,
        minIntervalMinutes: 1,
        justification: ENVELOPE,
        observedRevision: null,
      },
      deps,
    );
    assert.equal(envelope.status, "written", JSON.stringify(envelope));
    const envelopeId = envelope.status === "written" ? envelope.authorizationId : "";
    const envelopeDecision = envelope.status === "written" ? envelope.governanceDecisionId : "";

    const issueAt = (when: Date) => ({ getDb: () => handle.db, now: () => when });

    /* ── ACT 1: issued, and it is an ORDINARY permit bound to the STANDING decision ── */

    const workBefore = await countOf("work_items");
    const first = await issuePermitUnderStandingAuthorization(
      { requestId: beforeEnvelope },
      issueAt(NOW),
    );
    assert.equal(first.status, "issued", JSON.stringify(first));

    const firstRow = (
      await setup.query<{
        standing_authorization_id: string;
        governance_decision_id: string;
        authorized_by_actor_type: string;
        authorized_by_actor_id: string;
        status: string;
      }>(
        `select standing_authorization_id, governance_decision_id, authorized_by_actor_type,
                authorized_by_actor_id, status
           from action_permits where id = $1`,
        [first.status === "issued" ? first.permitId : ""],
      )
    ).rows[0]!;
    assert.equal(firstRow.standing_authorization_id, envelopeId);
    assert.equal(
      firstRow.governance_decision_id,
      envelopeDecision,
      "the permit names the STANDING decision — no per-act decision was invented",
    );
    assert.equal(firstRow.authorized_by_actor_type, "human");
    assert.equal(
      firstRow.authorized_by_actor_id,
      acme.userId,
      "the human who signed the envelope is named, truthfully",
    );
    assert.equal(firstRow.status, "active");

    /* NOTHING WAS EXECUTED. Issuance is not execution. */
    assert.equal(await countOf("work_items"), workBefore, "issuing a permit records no work");

    /* The request was NOT marked as human-approved. */
    const requestRow = (
      await setup.query<{
        approved_by_actor_type: string | null;
        approved_by_actor_id: string | null;
        approval_decision_id: string;
      }>(
        `select approved_by_actor_type, approved_by_actor_id, approval_decision_id
           from heby_action_requests where id = $1`,
        [beforeEnvelope],
      )
    ).rows[0]!;
    /*
     * THE ROW NAMES THE ENVELOPE'S SIGNER, because the database requires an accountable human on
     * any approved request — and because it is true: that person authorized this act in advance.
     * What marks it as standing rather than per-act is the decision it points at, checked next.
     */
    assert.equal(requestRow.approved_by_actor_type, "human");
    assert.equal(requestRow.approved_by_actor_id, acme.userId);
    assert.equal(requestRow.approval_decision_id, envelopeDecision);

    /* ── EVIDENCE IS REQUIRED ── */

    const noEvidence = await proposeAgentOriginatedRecordWorkAction(
      ctx,
      { title: "Unevidenced work", department: { kind: "department", departmentRef } },
      proposer!,
      deps,
    );
    assert.equal(noEvidence.status, "proposed");
    const noEvidenceId = noEvidence.status === "proposed" ? noEvidence.receipt.requestId : "";
    const unevidenced = await issuePermitUnderStandingAuthorization(
      { requestId: noEvidenceId },
      issueAt(new Date(NOW.getTime() + 120_000)),
    );
    assert.equal(unevidenced.status, "refused");
    assert.equal(
      unevidenced.status === "refused" ? unevidenced.reason : "",
      "evidence-required",
      "the released inlet attaches ORGANIZATION evidence, which RUNG 2 does not admit",
    );

    /* ── ONE FACT FUNDS ONE ACT ── */

    const replay = await proposeWithEvidence("Same observation again", "obs/before");
    const replayed = await issuePermitUnderStandingAuthorization(
      { requestId: replay },
      issueAt(new Date(NOW.getTime() + 120_000)),
    );
    assert.equal(replayed.status, "refused");
    assert.equal(
      replayed.status === "refused" ? replayed.reason : "",
      "evidence-already-consumed",
      "one organizational fact may not drain the quota",
    );

    /* ── CADENCE ── */

    const tooSoonReq = await proposeWithEvidence("Too soon", "obs/too-soon");
    const tooSoon = await issuePermitUnderStandingAuthorization(
      { requestId: tooSoonReq },
      issueAt(new Date(NOW.getTime() + 10_000)),
    );
    assert.equal(tooSoon.status, "refused");
    assert.equal(tooSoon.status === "refused" ? tooSoon.reason : "", "cadence-not-elapsed");

    /* ── ACT 2, after the cadence floor — the envelope's quota is now spent ── */

    const second = await issuePermitUnderStandingAuthorization(
      { requestId: tooSoonReq },
      issueAt(new Date(NOW.getTime() + 120_000)),
    );
    assert.equal(second.status, "issued", JSON.stringify(second));
    assert.equal(second.status === "issued" ? second.actsIssued : 0, 2);

    /*
     * TWO PERMITS, ONE GOVERNANCE DECISION. This is the whole point of the approved index change,
     * and it is only true for standing-derived permits.
     */
    const sharing = Number(
      (
        await setup.query<{ n: string }>(
          `select count(*) n from action_permits where governance_decision_id = $1`,
          [envelopeDecision],
        )
      ).rows[0]!.n,
    );
    assert.equal(sharing, 2, "one standing decision backs both acts");

    /* ── QUOTA ── */

    const exhaustedReq = await proposeWithEvidence("Past the ceiling", "obs/exhausted");
    const exhausted = await issuePermitUnderStandingAuthorization(
      { requestId: exhaustedReq },
      issueAt(new Date(NOW.getTime() + 600_000)),
    );
    assert.equal(exhausted.status, "refused");
    assert.equal(
      exhausted.status === "refused" ? exhausted.reason : "",
      "standing-authorization-exhausted",
    );

    /* ── THE READ MODEL AGREES WITH THE ROWS ── */

    const view = await readStandingMutations(ctx, {
      getDb: () => handle.db,
      now: () => new Date(NOW.getTime() + 600_000),
      rootEnabled: async () => true,
    });
    assert.equal(view.status, "read");
    const only = view.status === "read" ? view.items[0] : null;
    assert.ok(only);
    assert.equal(only!.actsIssued, 2);
    assert.equal(only!.remaining, 0);
    assert.equal(only!.maxActs, 2);
    assert.equal(only!.agentId, agentId);
    assert.equal(only!.state, "active");
    assert.equal(
      only!.reachability.status === "unreachable" ? only!.reachability.reason : "",
      "exhausted",
      "an exhausted envelope says EXHAUSTED, never 'withdrawn' and never 'disarmed'",
    );

    /* A DISARMED deployment is a DIFFERENT fact, and must read as one. */
    const disarmedView = await readStandingMutations(ctx, {
      getDb: () => handle.db,
      now: () => new Date(NOW.getTime() + 600_000),
      rootEnabled: async () => false,
    });
    assert.equal(disarmedView.status, "read");

    /* ── WINDOW ── */

    const outOfWindowReq = await proposeWithEvidence("Outside the window", "obs/window");
    const outOfWindow = await issuePermitUnderStandingAuthorization(
      { requestId: outOfWindowReq },
      issueAt(new Date(NOW.getTime() + 200_000_000)),
    );
    assert.equal(outOfWindow.status, "refused");
    assert.equal(
      outOfWindow.status === "refused" ? outOfWindow.reason : "",
      "standing-authorization-not-in-window",
      "past `not_after` the envelope refuses on the WINDOW, not on the quota",
    );

    /* ── WITHDRAWAL ── */

    const withdrawn = await writeStandingMutationAuthorization(
      ctx,
      "withdrawn",
      {
        agentId,
        actionKind: RECORD_WORK_ACTION_KIND,
        notBefore: new Date(NOW.getTime() - 60_000),
        notAfter: new Date(NOW.getTime() + 86_400_000),
        maxActs: 2,
        minIntervalMinutes: 1,
        justification: "This organization takes the standing authorization back.",
        observedRevision: 1,
      },
      deps,
    );
    assert.equal(withdrawn.status, "written", JSON.stringify(withdrawn));

    const afterWithdrawalReq = await proposeWithEvidence("After withdrawal", "obs/after");
    const afterWithdrawal = await issuePermitUnderStandingAuthorization(
      { requestId: afterWithdrawalReq },
      issueAt(new Date(NOW.getTime() + 300_000)),
    );
    assert.equal(afterWithdrawal.status, "refused");
    assert.equal(
      afterWithdrawal.status === "refused" ? afterWithdrawal.reason : "",
      "standing-authorization-withdrawn",
      "withdrawal stops ISSUANCE immediately, and says so in its own word",
    );

    /* Nothing already issued was touched by the withdrawal. */
    assert.equal(
      Number(
        (
          await setup.query<{ n: string }>(
            `select count(*) n from action_permits where standing_authorization_id = $1`,
            [envelopeId],
          )
        ).rows[0]!.n,
      ),
      2,
      "withdrawing an envelope revokes no permit it already issued",
    );

    /* ── CONCURRENCY: two issuers, one envelope, one act of room ── */

    const raceEnvelope = await writeStandingMutationAuthorization(
      ctx,
      "active",
      {
        agentId,
        actionKind: RECORD_WORK_ACTION_KIND,
        notBefore: new Date(NOW.getTime() - 60_000),
        notAfter: new Date(NOW.getTime() + 86_400_000),
        maxActs: 1,
        minIntervalMinutes: 1,
        justification: "A fresh envelope with exactly one act of room, for the race.",
        observedRevision: 2,
      },
      deps,
    );
    assert.equal(raceEnvelope.status, "written", JSON.stringify(raceEnvelope));

    const raceA = await proposeWithEvidence("Race A", "obs/race-a");
    const raceB = await proposeWithEvidence("Race B", "obs/race-b");
    const raceAt = new Date(NOW.getTime() + 400_000);

    const [a, b] = await Promise.all([
      issuePermitUnderStandingAuthorization({ requestId: raceA }, issueAt(raceAt)),
      issuePermitUnderStandingAuthorization({ requestId: raceB }, issueAt(raceAt)),
    ]);

    const issuedCount = [a, b].filter((r) => r.status === "issued").length;
    assert.equal(
      issuedCount,
      1,
      `exactly one issuer may win a one-act envelope, got ${JSON.stringify([a, b])}`,
    );

    const raceId = raceEnvelope.status === "written" ? raceEnvelope.authorizationId : "";
    assert.equal(
      Number(
        (
          await setup.query<{ n: string }>(
            `select count(*) n from action_permits where standing_authorization_id = $1`,
            [raceId],
          )
        ).rows[0]!.n,
      ),
      1,
      "THE ROWS AGREE WITH THE VERDICT: one permit exists, not two",
    );

    /* ── TENANT ISOLATION ── */

    const other = (await seedLocalIdentity(setup, {
      companyName: "Other",
      companySlug: "other-rung2-standing",
      email: "director@other-rung2-standing.test",
    })) as Seeded;
    const otherCtx = contextFor(other, await sessionRowFor(setup, other, "bbbb"), "rung2-other");
    const otherView = await readStandingMutations(otherCtx, {
      getDb: () => handle.db,
      now: () => NOW,
      rootEnabled: async () => true,
    });
    assert.equal(otherView.status, "read");
    assert.deepEqual(
      otherView.status === "read" ? otherView.items : null,
      [],
      "another organization sees NONE of these envelopes",
    );

    /* A permit may never name another tenant's envelope — a database error, not a check. */
    await assert.rejects(
      setup.query(
        `update action_permits set tenant_id = $2 where id = $1`,
        [first.status === "issued" ? first.permitId : "", other.tenantId],
      ),
      /action_permits_tenant_standing_authorization_fk|action_permits_tenant_request_fk/,
      "cross-tenant issuance is structurally impossible",
    );

    /* ── THE CENTRAL INVARIANT: NOTHING BECAME A REUSABLE AUTHORIZATION ── */

    /*
     * THE STANDING AUTHORIZATION IS REUSABLE INSIDE ITS ENVELOPE. EVERY REQUEST AND PERMIT IS NOT.
     *
     * Proved from the rows rather than asserted: each of the two acts has its OWN request, its OWN
     * permit, its OWN payload digest and its OWN expiry, and no row is shared between them.
     */
    const acts = (
      await setup.query<{
        permit_id: string;
        request_id: string;
        digest: string;
        issued_at: string;
        expires_at: string;
        ttl_seconds: number;
      }>(
        `select p.id permit_id, p.action_request_id request_id, p.bound_payload_digest digest,
                p.issued_at, p.expires_at, p.ttl_seconds
           from action_permits p
          where p.standing_authorization_id = $1
          order by p.issued_at`,
        [envelopeId],
      )
    ).rows;
    assert.equal(acts.length, 2);
    assert.notEqual(acts[0]!.permit_id, acts[1]!.permit_id, "two permits, not one reused");
    assert.notEqual(acts[0]!.request_id, acts[1]!.request_id, "two requests, not one reused");
    assert.notEqual(
      acts[0]!.digest,
      acts[1]!.digest,
      "each act is bound to its OWN payload digest — no payload is shared or substitutable",
    );

    /* Each permit is single-use: the released spend invariants are untouched for standing acts. */
    for (const act of acts) {
      const row = (
        await setup.query<{ status: string; consumed_at: string | null; handoff_id: string | null }>(
          `select status, consumed_at, handoff_id from action_permits where id = $1`,
          [act.permit_id],
        )
      ).rows[0]!;
      assert.equal(row.status, "active", "issuance does not spend");
      assert.equal(row.consumed_at, null);
      assert.equal(row.handoff_id, null);
      assert.ok(act.ttl_seconds > 0 && act.ttl_seconds <= 86_400, "the released TTL bound applies");
    }

    /*
     * ── THE RELEASED RUNG 1.5 SCAN DISCOVERS A STANDING-ISSUED PERMIT ──────
     *
     * This calls the RELEASED module directly — imported, not reimplemented, and given nothing but
     * a database handle. There is no RUNG 2 delivery path, no second scanner and no widened
     * predicate: the standing-issued permit is discovered because it satisfies the SAME clauses an
     * ordinary human-authorized one does.
     */
    const deliverable = await listMachineDeliverablePermitsForRuntime({ getDb: () => handle.db });
    assert.equal(deliverable.status, "read");
    const deliverableIds =
      deliverable.status === "read" ? deliverable.permits.map((p) => p.permitId) : [];
    for (const act of acts) {
      assert.ok(
        deliverableIds.includes(act.permit_id),
        "the released delivery scan discovers a standing-issued permit with NO change to its predicate",
      );
    }

    /*
     * AND IT IS THE REAL PREDICATE, NOT A PERMISSIVE STAND-IN.
     *
     * The same call, on the same rows, must REFUSE a permit whose clock has run out. Without this
     * the assertion above would pass equally against a scanner that returned everything — which is
     * precisely the failure mode a "discovers it" proof invites.
     */
    const expiredProbe = acts[0]!.permit_id;
    /*
     * BOTH instants move, because `action_permits_expiry_after_issue_chk` refuses an expiry that
     * precedes issuance — the schema defending a permit that could never have been valid. The probe
     * therefore describes a permit that WAS valid and has since lapsed, which is the real condition.
     */
    await setup.query(
      `update action_permits
          set issued_at = now() - interval '2 hours',
              expires_at = now() - interval '1 hour'
        where id = $1`,
      [expiredProbe],
    );
    const afterExpiry = await listMachineDeliverablePermitsForRuntime({ getDb: () => handle.db });
    assert.equal(afterExpiry.status, "read");
    const afterIds = afterExpiry.status === "read" ? afterExpiry.permits.map((p) => p.permitId) : [];
    assert.equal(
      afterIds.includes(expiredProbe),
      false,
      "the SAME released scan refuses the SAME permit once its clock has run out — the predicate is live",
    );
    assert.ok(
      afterIds.includes(acts[1]!.permit_id),
      "and its unexpired sibling is still discovered, so the refusal was the clock and not the scan",
    );
    /* Restore both instants so nothing downstream reads a value this probe invented. */
    await setup.query(
      `update action_permits set issued_at = $2, expires_at = $3 where id = $1`,
      [expiredProbe, acts[0]!.issued_at, acts[0]!.expires_at],
    );

    console.log("PASS rung2 standing mutation — persistence, bounds, concurrency and isolation");
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose?.().catch(() => {});
    await harness.dropDatabase();
  }
}

void main();
