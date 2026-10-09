/*
 * L-2b — suspension and reactivation through Agent Identity, decided by Governance, written atomically.
 * Real PostgreSQL, disposable database.
 *
 * Proven here:
 *   1  no reason → refused for both verbs, nothing written
 *   2  a non-owner, and an owner without Governance authority, are refused; nothing written
 *   3  another organization's agent is not found
 *   4  suspend = lifecycle 'suspended' + suspended_at + one `agent-lifecycle` decision (suspend →
 *      agent-suspended) + one session + one audit row; liveness and service status read "suspended"
 *   5  a second suspension is refused and writes nothing
 *   6  a suspended agent cannot be selected as proposer, gets no standing permit minted, and an
 *      already-issued permit is NOT spendable — but the permit itself is untouched (still `active`)
 *   7  reactivate = lifecycle 'active', suspended_at cleared, decision approve → agent-reactivated;
 *      a second reactivation is refused
 *   8  MEASURED RESIDUAL (Director decision pending, not endorsed): after reactivation the permit
 *      issued before suspension is spendable again, and the standing envelope issues again
 *   9  repeated transitions each record exactly one decision
 *  10  a suspended agent can be retired; a retired agent can be neither suspended nor reactivated
 *  11  disagreeing lifecycle fields (indeterminate) are refused, never repaired
 *  12  a legacy NULL-lifecycle agent suspends; untouched agents keep NULL
 *  13  a failing decision insert, or a failing audit insert, rolls the transition back
 *  14  concurrent suspensions: exactly one wins, the rest are refused agent-already-suspended
 *  15  a spend racing a suspension waits for it and is refused — it never executes after it
 *  16  a suspension racing a standing issuance waits for the issuance; the permit it minted then
 *      blocks reactivation
 *  17  an approval racing a reactivation waits for it (the approval boundary's FOR SHARE)
 *  18  an envelope authorization racing a suspension never commits an ACTIVE envelope for the
 *      now-suspended agent
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { seedAgentMandate, seedGovernanceAuthority } from "../helpers/agent-mandate-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { createDurableAgentIdentity } from "../../src/features/agent-identity/create-durable-agent-identity.server";
import { retireDurableAgentIdentity } from "../../src/features/agent-identity/retire-durable-agent-identity.server";
import {
  reactivateDurableAgentIdentity,
  suspendDurableAgentIdentity,
} from "../../src/features/agent-identity/suspend-durable-agent-identity.server";
import {
  readDurableAgentIdentityState,
  readDurableAgentRuntimeLiveness,
} from "../../src/features/agent-identity/read-durable-agent-identity.server";
import { resolveAgentProposer } from "../../src/features/action-authorization/agent-proposer.server";
import { recordDepartment } from "../../src/features/organization-authority/write-structure.server";
import { formatDepartmentRef } from "../../src/features/organization-authority/department-ref";
import { proposeAgentOriginatedRecordWorkAction } from "../../src/features/heby-action-inlet/record-work-proposal.server";
import { authorizeTenantMachineExecution } from "../../src/features/tenant-machine-execution-authority/authorize-tenant-machine-execution.server";
import { writeStandingMutationAuthorization } from "../../src/features/standing-mutation-authority/authorize-standing-mutation.server";
import { issuePermitUnderStandingAuthorization } from "../../src/features/standing-mutation-authority/issue-permit-under-standing-authorization.server";
import { executeRecordWorkAsMachine } from "../../src/features/governed-machine-execution/execute-record-work-as-machine.server";
import { RECORD_WORK_ACTION_KIND } from "../../src/features/heby-action-inlet/contracts";
import { approveActionRequest } from "../../src/features/action-authorization/decide-action-request.server";
import { readEffectiveAgentMandateForRuntime } from "../../src/features/agent-mandate/read-agent-mandate.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";

const GENESIS = "This organization establishes its founding Governance authority for the L-2b proof.";
const ENROLMENT = "This organization agrees its authorized work may be delivered by machine.";
const ENVELOPE = "This organization authorizes its agent to record evidenced work without a click each.";
const REGISTER = "Register this agent for the L-2b suspension proof organization.";
const SUSPEND = "Suspend this agent while its recent proposals are reviewed (L-2b proof).";
const REACTIVATE = "The review is complete; return this agent to service (L-2b proof).";
const RETIRE = "Withdraw this agent from service permanently (L-2b proof).";
const ARMED = async (): Promise<boolean> => true;

interface Seeded {
  readonly tenantId: string;
  readonly userId: string;
  readonly authIdentityId: string;
  readonly membershipId: string;
  readonly roleId: string;
}

function contextFor(seeded: Seeded, sessionContextId: string, requestId: string, userId = seeded.userId): TenantContext {
  return asHumanTenantContext({
    tenantId: seeded.tenantId,
    userId,
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

/** Holds racers after their locked read; the timeout releases a racer the row lock is still holding. */
function createReadBarrier(parties: number, timeoutMs: number): () => Promise<void> {
  let arrived = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const timer: NodeJS.Timeout = setTimeout(() => release(), timeoutMs);
  timer.unref?.();
  return async () => {
    arrived += 1;
    if (arrived >= parties) {
      clearTimeout(timer);
      release();
    }
    await gate;
  };
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_l2b_suspension");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db } as never;
  const getDb = () => handle.db;

  try {
    await setup.connect();
    let clock = new Date((await setup.query<{ now: Date }>(`select now() as now`)).rows[0]!.now);
    const tick = (): Date => (clock = new Date(clock.getTime() + 120_000));

    const countOf = async (table: string): Promise<number> =>
      Number((await setup.query(`select count(*)::int n from ${table}`)).rows[0]!.n);
    const ledger = async () => ({
      decisions: await countOf("decision_records"),
      sessions: await countOf("governance_sessions"),
      audit: await countOf("audit_log"),
    });
    const agentRow = async (id: string) =>
      (
        await setup.query<{
          suspended_at: Date | null;
          retired_at: Date | null;
          agent_lifecycle_status: string | null;
          version: number;
          name: string;
          updated_by: string | null;
          updated_by_type: string | null;
          replaced_by_agent_id: string | null;
          deleted_at: Date | null;
        }>(
          `select suspended_at, retired_at, agent_lifecycle_status, version, name, updated_by, updated_by_type,
                  replaced_by_agent_id, deleted_at
             from agents where id = $1`,
          [id],
        )
      ).rows[0]!;
    const permitStatus = async (permitId: string): Promise<string> =>
      (await setup.query<{ status: string }>(`select status from action_permits where id = $1`, [permitId])).rows[0]!
        .status;
    const lifecycleDecisions = async (agentId: string) =>
      (
        await setup.query<{ decision_type: string; outcome: string; governance_domain: string }>(
          `select d.decision_type, d.outcome, s.governance_domain
             from decision_records d join governance_sessions s on s.id = d.session_id
            where d.subject_type = 'agent-lifecycle' and d.subject_id = $1
            order by d.decided_at, d.created_at`,
          [agentId],
        )
      ).rows;

    /* ── SEED: ACME with Governance, machine delivery, a department, Heby, its mandate and envelope ── */
    const acme = (await seedLocalIdentity(setup, {
      companyName: "Acme",
      companySlug: "acme-l2b",
      email: "director@acme-l2b.test",
    })) as Seeded;
    const ctx = contextFor(acme, await sessionRowFor(setup, acme, "b1"), "l2b-acme");
    await setup.query(
      `insert into genesis_nominations
         (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
          accepted_at, accepted_session_context_id, accepted_assurance_level)
       values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
      [acme.tenantId, acme.authIdentityId, acme.userId, ctx.sessionContextId],
    );
    assert.equal((await establishGovernanceAuthority(ctx, { justification: GENESIS }, deps)).status, "established");
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
    const departmentRef = formatDepartmentRef(dept.status === "recorded" ? dept.department.departmentId : "");

    const register = async (who: TenantContext, name: string): Promise<string> => {
      const r = await createDurableAgentIdentity(who, { name, justification: REGISTER }, deps);
      assert.equal(r.status, "established", JSON.stringify(r));
      return r.status === "established" ? r.identity.agentId : "";
    };
    const heby = await register(ctx, "Heby");
    await seedAgentMandate(setup, acme, heby, deps, { tag: "l2bm1", proposalScope: ["record-work"] });
    const envelopeFor = (agentId: string, observedRevision: number | null) => ({
      agentId,
      actionKind: RECORD_WORK_ACTION_KIND,
      notBefore: new Date(clock.getTime() - 60_000),
      notAfter: new Date(clock.getTime() + 86_400_000),
      maxActs: 50,
      minIntervalMinutes: 1,
      justification: ENVELOPE,
      observedRevision,
    });
    const envelope = await writeStandingMutationAuthorization(ctx, "active", envelopeFor(heby, null), deps);
    assert.equal(envelope.status, "written", JSON.stringify(envelope));

    const resolvedProposer = await resolveAgentProposer(ctx, deps, { agentId: heby });
    assert.equal(resolvedProposer.status, "resolved");
    const proposer = resolvedProposer.status === "resolved" ? resolvedProposer.proposer : null;
    let evidenceSeq = 0;
    const propose = async (title: string, by = proposer): Promise<string> => {
      const proposal = await proposeAgentOriginatedRecordWorkAction(
        ctx,
        { workScope: { kind: "organization" as const }, title, department: { kind: "department", departmentRef } },
        by!,
        deps,
      );
      assert.equal(proposal.status, "proposed", JSON.stringify(proposal));
      const requestId = proposal.status === "proposed" ? proposal.receipt.requestId : "";
      await setup.query(`update heby_action_requests set evidence = $2::jsonb where id = $1`, [
        requestId,
        JSON.stringify([{ sourceClass: "provider-observations", recordRef: `obs/l2b-${++evidenceSeq}`, lifecycle: "settled" }]),
      ]);
      return requestId;
    };
    const issue = (requestId: string) =>
      issuePermitUnderStandingAuthorization({ requestId }, { getDb, now: () => tick(), armed: ARMED });
    const deliver = (permitId: string) => executeRecordWorkAsMachine({ permitId }, { getDb, armed: ARMED });

    /* Beta: another organization with its own agent. */
    const beta = (await seedLocalIdentity(setup, {
      companyName: "Beta",
      companySlug: "beta-l2b",
      email: "director@beta-l2b.test",
    })) as Seeded;
    const betaCtx = contextFor(beta, await sessionRowFor(setup, beta, "b2"), "l2b-beta");
    await seedGovernanceAuthority(setup, beta, deps, { tag: "0cb2" });
    const foreign = await register(betaCtx, "Foreign");

    /* ── (1) NO REASON → REFUSED, NOTHING WRITTEN ── */
    for (const verb of [suspendDurableAgentIdentity, reactivateDurableAgentIdentity]) {
      for (const justification of [undefined, "", "   "]) {
        const before = await ledger();
        /* A throw is folded into the result so the reason assertion — not an uncaught error — is what fails. */
        const r = await verb(ctx, { agentId: heby, justification }, deps).catch((error: unknown) => ({
          status: "threw",
          error: String(error).slice(0, 120),
        }));
        assert.deepEqual(r, { status: "refused", reason: "justification-required" }, "a reason is required for both verbs");
        assert.deepEqual(await ledger(), before, "a refused transition writes no decision, session or audit row");
      }
    }
    assert.deepEqual(
      await suspendDurableAgentIdentity(ctx, { agentId: "not-a-uuid", justification: SUSPEND }, deps),
      { status: "refused", reason: "malformed-agent-id" },
    );
    assert.deepEqual(await suspendDurableAgentIdentity(null, { agentId: heby, justification: SUSPEND }, deps), {
      status: "refused",
      reason: "no-authorized-tenant-context",
    });

    /* ── (2) AUTHORIZATION ── */
    const member = (
      await setup.query<{ id: string }>(`insert into users (email, name) values ('member@acme-l2b.test', 'Member') returning id`)
    ).rows[0]!.id;
    const memberCtx = contextFor(acme, ctx.sessionContextId, "l2b-member", member);
    const beforeAuthz = await ledger();
    assert.deepEqual(await suspendDurableAgentIdentity(memberCtx, { agentId: heby, justification: SUSPEND }, deps), {
      status: "refused",
      reason: "not-the-human-owner",
    }, "a non-owner member is refused as non-owner");
    /* An owner who does not hold Governance authority. Ownership alone is never enough. */
    const memberOwned = await register(ctx, "Owned By Member");
    await setup.query(`update agents set human_owner_id = $2 where id = $1`, [memberOwned, member]);
    assert.deepEqual(
      await suspendDurableAgentIdentity(memberCtx, { agentId: memberOwned, justification: SUSPEND }, deps),
      { status: "refused", reason: "not-the-governance-authority" },
      "an owner without Governance authority is refused",
    );
    const afterRegister = await ledger();
    assert.equal(afterRegister.decisions, beforeAuthz.decisions + 1, "only the registration above was recorded");
    assert.equal((await agentRow(heby)).agent_lifecycle_status, null);

    /* ── (3) TENANT ISOLATION ── */
    assert.deepEqual(await suspendDurableAgentIdentity(ctx, { agentId: foreign, justification: SUSPEND }, deps), {
      status: "refused",
      reason: "agent-identity-not-found",
    }, "another organization's agent is not found");
    assert.deepEqual(await reactivateDurableAgentIdentity(ctx, { agentId: foreign, justification: REACTIVATE }, deps), {
      status: "refused",
      reason: "agent-identity-not-found",
    });
    assert.deepEqual(await ledger(), afterRegister, "another organization's agent cannot be touched");
    assert.equal(await readDurableAgentRuntimeLiveness(beta.tenantId, foreign, deps), "in-service");

    /* Authority that exists BEFORE the suspension: one issued permit, one pending proposal. */
    const preIssuedRequest = await propose("Issued before the suspension");
    const preIssued = await issue(preIssuedRequest);
    assert.equal(preIssued.status, "issued", JSON.stringify(preIssued));
    const prePermit = preIssued.status === "issued" ? preIssued.permitId : "";
    const pendingRequest = await propose("Filed before the suspension, not yet issued");

    /* ── (4) SUSPEND ── */
    const versionBefore = (await agentRow(heby)).version;
    const permitsBefore = await countOf("action_permits");
    const before = await ledger();
    const suspended = await suspendDurableAgentIdentity(ctx, { agentId: heby, justification: SUSPEND }, deps);
    assert.equal(suspended.status, "suspended", JSON.stringify(suspended));
    const sRecord = suspended.status === "suspended" ? suspended.record : null;
    assert.deepEqual(
      await ledger(),
      { decisions: before.decisions + 1, sessions: before.sessions + 1, audit: before.audit + 1 },
      "exactly one decision, one session and one audit row",
    );
    const sRow = await agentRow(heby);
    assert.equal(sRow.agent_lifecycle_status, "suspended", "suspension writes lifecycle suspended");
    assert.ok(sRow.suspended_at, "suspended_at is stamped");
    assert.equal(sRow.retired_at, null, "suspension is not retirement");
    assert.equal(sRow.deleted_at, null);
    assert.equal(sRow.replaced_by_agent_id, null);
    assert.equal(sRow.name, "Heby");
    assert.equal(sRow.version, versionBefore + 1);
    assert.equal(sRow.updated_by, acme.userId);
    assert.equal(sRow.updated_by_type, "human");
    const sDecision = (
      await setup.query(
        `select d.*, s.governance_domain from decision_records d join governance_sessions s on s.id = d.session_id
          where d.id = $1`,
        [sRecord!.governanceDecisionId],
      )
    ).rows[0]!;
    assert.equal(sDecision.decision_type, "suspend");
    assert.equal(sDecision.outcome, "agent-suspended", "the outcome is agent-suspended");
    assert.equal(sDecision.governance_domain, "agent-lifecycle");
    assert.equal(sDecision.subject_type, "agent-lifecycle");
    assert.equal(sDecision.subject_id, heby);
    assert.equal(sDecision.justification, SUSPEND);
    assert.equal(sDecision.actor_id, acme.userId);
    const sAudit = (
      await setup.query<{ action: string; metadata: Record<string, unknown> }>(
        `select action, metadata from audit_log where entity_id = $1`,
        [sRecord!.governanceDecisionId],
      )
    ).rows;
    assert.equal(sAudit.length, 1);
    assert.equal(sAudit[0].action, "governance.decision.recorded");
    assert.equal(sAudit[0].metadata.decisionType, "suspend");
    assert.equal(sAudit[0].metadata.subjectId, heby);
    assert.equal(await readDurableAgentRuntimeLiveness(acme.tenantId, heby, deps), "not-in-service");
    const state = await readDurableAgentIdentityState(ctx, deps);
    const hebyState = state.status === "known" ? state.identities.find((i) => i.agentId === heby) : undefined;
    assert.equal(hebyState?.serviceStatus, "suspended", "every surface reads suspended, never retired");
    assert.equal(hebyState?.inService, false);
    assert.equal(await countOf("action_permits"), permitsBefore, "suspension mints and deletes no permit");
    assert.equal(await permitStatus(prePermit), "active", "suspension revokes nothing — the permit is untouched");

    /* ── (5) A SECOND SUSPENSION IS REFUSED ── */
    const afterSuspend = await ledger();
    assert.deepEqual(await suspendDurableAgentIdentity(ctx, { agentId: heby, justification: SUSPEND }, deps), {
      status: "refused",
      reason: "agent-already-suspended",
    });
    assert.deepEqual(await ledger(), afterSuspend);

    /* ── (6) RUNTIME: a suspended agent initiates nothing new, and spends nothing already issued ── */
    assert.deepEqual(await resolveAgentProposer(ctx, deps, { agentId: heby }), {
      status: "refused",
      reason: "selected-agent-retired",
    });
    const deniedIssue = await issue(pendingRequest);
    assert.equal(deniedIssue.status === "refused" ? deniedIssue.reason : "ISSUED", "agent-not-in-service");
    const workBefore = await countOf("work_items");
    const deniedSpend = await deliver(prePermit);
    assert.equal(
      deniedSpend.status === "refused"
        ? `${deniedSpend.reason}${deniedSpend.authorityReason ? `:${deniedSpend.authorityReason}` : ""}`
        : "EXECUTED",
      "agent-not-in-service:not-in-service",
    );
    assert.equal(await permitStatus(prePermit), "active", "a refused spend leaves the permit unspent");
    assert.equal(await countOf("work_items"), workBefore, "and records no work");

    /* ── (7) REACTIVATION IS REFUSED WHILE AUTHORITY GRANTED BEFORE IT IS STILL USABLE ── */
    const beforeBlocked = await ledger();
    assert.deepEqual(
      await reactivateDurableAgentIdentity(ctx, { agentId: heby, justification: REACTIVATE }, deps),
      { status: "refused", reason: "agent-has-usable-permits" },
      "an outstanding permit blocks reactivation",
    );
    assert.equal(await permitStatus(prePermit), "active", "the refusal revokes nothing");
    /* Clock simulation: the permit's TTL elapses (database clock, as the spend compares it). */
    await setup.query(
      `update action_permits set issued_at = now() - interval '2 hours', expires_at = now() - interval '1 hour' where id = $1`,
      [prePermit],
    );
    assert.deepEqual(
      await reactivateDurableAgentIdentity(ctx, { agentId: heby, justification: REACTIVATE }, deps),
      { status: "refused", reason: "agent-has-valid-standing-envelope" },
      "an expired permit no longer blocks, but a valid standing envelope does",
    );
    assert.deepEqual(await ledger(), beforeBlocked, "refused reactivations write no decision, session or audit row");

    /* ── (7a) WITHDRAWING A SUSPENDED AGENT'S ENVELOPE — the standing authority's own writer ── */
    const revisions = async (): Promise<number> =>
      Number((await setup.query(`select count(*)::int n from standing_mutation_authorizations where agent_id = $1`, [heby])).rows[0]!.n);
    const revisionsBefore = await revisions();
    const notWritten = (r: { status: string; reason?: string }) => (r.status === "refused" ? r.reason : r.status);
    assert.equal(
      notWritten(await writeStandingMutationAuthorization(memberCtx, "withdrawn", envelopeFor(heby, 1), deps)),
      "not-the-governance-authority",
      "an unauthorized withdrawal is still refused",
    );
    assert.equal(
      notWritten(await writeStandingMutationAuthorization(betaCtx, "withdrawn", envelopeFor(heby, 1), deps)),
      "agent-unresolvable",
      "a cross-tenant withdrawal is still refused",
    );
    assert.equal(
      notWritten(await writeStandingMutationAuthorization(ctx, "active", envelopeFor(heby, 1), deps)),
      "agent-not-in-service",
      "AUTHORIZING an envelope still requires the agent in service",
    );
    /* Atomicity: a failing decision insert leaves no revision behind, and the envelope still blocks. */
    await setup.query(`
      create function l2b_fail_envelope() returns trigger language plpgsql as $$
      begin raise exception 'l2b injected envelope failure'; end $$;
      create trigger l2b_fail_envelope before insert on decision_records
        for each row when (new.subject_type = 'standing_mutation_authorization') execute function l2b_fail_envelope();
    `);
    const faulted = await writeStandingMutationAuthorization(ctx, "withdrawn", envelopeFor(heby, 1), deps).catch(
      (error: unknown) => ({ status: "threw", reason: String(error).slice(0, 80) }),
    );
    assert.notEqual(faulted.status, "written", "a failing decision insert does not withdraw");
    await setup.query(`drop trigger l2b_fail_envelope on decision_records; drop function l2b_fail_envelope();`);
    assert.equal(await revisions(), revisionsBefore, "no revision survives a refused or failed withdrawal");
    assert.deepEqual(await ledger(), beforeBlocked, "and no decision, session or audit row");
    assert.deepEqual(
      await reactivateDurableAgentIdentity(ctx, { agentId: heby, justification: REACTIVATE }, deps),
      { status: "refused", reason: "agent-has-valid-standing-envelope" },
      "the envelope still blocks after the failed withdrawal",
    );

    const withdrawn = await writeStandingMutationAuthorization(ctx, "withdrawn", envelopeFor(heby, 1), deps);
    assert.equal(withdrawn.status, "written", `a suspended agent's envelope can be withdrawn (${JSON.stringify(withdrawn)})`);
    assert.equal(await revisions(), revisionsBefore + 1, "exactly one withdrawn revision");
    assert.equal(await readDurableAgentRuntimeLiveness(acme.tenantId, heby, deps), "not-in-service", "withdrawal does not reactivate the agent");
    assert.equal((await agentRow(heby)).agent_lifecycle_status, "suspended");
    const blockedIssue = await issue(pendingRequest);
    assert.notEqual(blockedIssue.status, "issued", "new issuance stays blocked while suspended");

    /* ── (7b) REACTIVATE ── */
    const beforeReactivate = await ledger();
    const reactivated = await reactivateDurableAgentIdentity(ctx, { agentId: heby, justification: REACTIVATE }, deps);
    assert.equal(reactivated.status, "reactivated", JSON.stringify(reactivated));
    assert.deepEqual(await ledger(), {
      decisions: beforeReactivate.decisions + 1,
      sessions: beforeReactivate.sessions + 1,
      audit: beforeReactivate.audit + 1,
    });
    const rRow = await agentRow(heby);
    assert.equal(rRow.agent_lifecycle_status, "active", "reactivation records an explicit lifecycle");
    assert.equal(rRow.suspended_at, null);
    assert.equal(rRow.version, versionBefore + 2);
    const decisions = await lifecycleDecisions(heby);
    assert.deepEqual(decisions.at(-1), {
      decision_type: "approve",
      outcome: "agent-reactivated",
      governance_domain: "agent-lifecycle",
    });
    assert.equal(await readDurableAgentRuntimeLiveness(acme.tenantId, heby, deps), "in-service");
    assert.deepEqual(await reactivateDurableAgentIdentity(ctx, { agentId: heby, justification: REACTIVATE }, deps), {
      status: "refused",
      reason: "agent-not-suspended",
    });

    /* ── (8) NOTHING GRANTED BEFORE THE SUSPENSION IS USABLE AFTER THE REACTIVATION ── */
    const workBeforeRevival = await countOf("work_items");
    assert.notEqual((await deliver(prePermit)).status, "executed", "the pre-suspension permit is not restored");
    assert.equal(await countOf("work_items"), workBeforeRevival);
    const reissued = await issue(pendingRequest);
    assert.equal(reissued.status === "refused" ? reissued.reason : "ISSUED", "standing-authorization-withdrawn", "the withdrawn envelope is not restored");

    /* ── (9) REPEATED TRANSITIONS ── */
    for (let round = 0; round < 2; round += 1) {
      assert.equal((await suspendDurableAgentIdentity(ctx, { agentId: heby, justification: SUSPEND }, deps)).status, "suspended");
      assert.equal(
        (await reactivateDurableAgentIdentity(ctx, { agentId: heby, justification: REACTIVATE }, deps)).status,
        "reactivated",
      );
    }
    assert.deepEqual(
      (await lifecycleDecisions(heby)).map((d) => d.outcome),
      ["agent-suspended", "agent-reactivated", "agent-suspended", "agent-reactivated", "agent-suspended", "agent-reactivated"],
      "every transition is its own decision, in order",
    );

    /* ── (10) RETIRED IS TERMINAL ── */
    assert.equal((await suspendDurableAgentIdentity(ctx, { agentId: heby, justification: SUSPEND }, deps)).status, "suspended");
    const retired = await retireDurableAgentIdentity(ctx, { agentId: heby, justification: RETIRE }, deps);
    assert.equal(retired.status, "retired", "a suspended agent can be retired");
    const retiredRow = await agentRow(heby);
    assert.equal(retiredRow.agent_lifecycle_status, "retired");
    assert.ok(retiredRow.suspended_at, "suspended_at stays as history");
    const retiredState = await readDurableAgentIdentityState(ctx, deps);
    assert.equal(
      retiredState.status === "known" ? retiredState.identities.find((i) => i.agentId === heby)?.serviceStatus : "",
      "retired",
    );
    const afterRetire = await ledger();
    assert.deepEqual(await suspendDurableAgentIdentity(ctx, { agentId: heby, justification: SUSPEND }, deps), {
      status: "refused",
      reason: "agent-identity-retired",
    }, "retired: suspend refused as retired");
    assert.deepEqual(await reactivateDurableAgentIdentity(ctx, { agentId: heby, justification: REACTIVATE }, deps), {
      status: "refused",
      reason: "agent-identity-retired",
    }, "retired: reactivate refused as retired");
    assert.deepEqual(await ledger(), afterRetire, "a retired agent is never reactivated, and nothing is written");
    assert.equal((await agentRow(heby)).agent_lifecycle_status, "retired");

    /* ── (11) INDETERMINATE IS REFUSED, NEVER REPAIRED ── */
    const odd = await register(ctx, "Odd");
    await setup.query(`update agents set agent_lifecycle_status = 'paused' where id = $1`, [odd]);
    const beforeOdd = await ledger();
    assert.deepEqual(await suspendDurableAgentIdentity(ctx, { agentId: odd, justification: SUSPEND }, deps), {
      status: "refused",
      reason: "agent-service-status-indeterminate",
    });
    await setup.query(`update agents set agent_lifecycle_status = 'suspended', suspended_at = null where id = $1`, [odd]);
    assert.deepEqual(await reactivateDurableAgentIdentity(ctx, { agentId: odd, justification: REACTIVATE }, deps), {
      status: "refused",
      reason: "agent-service-status-indeterminate",
    });
    assert.deepEqual(await ledger(), beforeOdd);
    assert.equal((await agentRow(odd)).agent_lifecycle_status, "suspended", "the disagreeing row is left as it was");

    /* ── (12) LEGACY NULL LIFECYCLE ── */
    const legacy = await register(ctx, "Legacy");
    const bystander = await register(ctx, "Bystander");
    assert.equal((await agentRow(legacy)).agent_lifecycle_status, null);
    assert.equal((await suspendDurableAgentIdentity(ctx, { agentId: legacy, justification: SUSPEND }, deps)).status, "suspended");
    assert.equal((await agentRow(bystander)).agent_lifecycle_status, null, "an untouched agent keeps its NULL lifecycle");
    assert.equal(await readDurableAgentRuntimeLiveness(acme.tenantId, bystander, deps), "in-service");

    /* ── (13) ATOMICITY: a failing decision or audit insert rolls the transition back ── */
    for (const [table, condition] of [
      ["decision_records", "new.subject_type = 'agent-lifecycle'"],
      ["audit_log", "new.metadata ->> 'subjectType' = 'agent-lifecycle'"],
    ] as const) {
      await setup.query(`
        create function l2b_fail() returns trigger language plpgsql as $$
        begin raise exception 'l2b injected failure'; end $$;
        create trigger l2b_fail before insert on ${table} for each row when (${condition}) execute function l2b_fail();
      `);
      const beforeFault = await ledger();
      const rowBefore = await agentRow(bystander);
      await assert.rejects(
        suspendDurableAgentIdentity(ctx, { agentId: bystander, justification: SUSPEND }, deps),
        /l2b injected failure|Failed query/,
      );
      assert.deepEqual(await ledger(), beforeFault, `${table} failure: nothing survives`);
      assert.deepEqual(await agentRow(bystander), rowBefore, `${table} failure: the agent is untouched`);
      const rowLegacy = await agentRow(legacy);
      await assert.rejects(
        reactivateDurableAgentIdentity(ctx, { agentId: legacy, justification: REACTIVATE }, deps),
        /l2b injected failure|Failed query/,
      );
      assert.deepEqual(await agentRow(legacy), rowLegacy, `${table} failure: the suspended agent stays suspended`);
      await setup.query(`drop trigger l2b_fail on ${table}; drop function l2b_fail();`);
    }

    /* ── (14) CONCURRENT SUSPENSIONS: exactly one wins ── */
    const RACERS = 3;
    const barrier = createReadBarrier(RACERS, 750);
    const beforeRace = await ledger();
    const racers = await Promise.all(
      Array.from({ length: RACERS }, () =>
        suspendDurableAgentIdentity(ctx, { agentId: bystander, justification: SUSPEND }, { ...(deps as object), afterRead: barrier }),
      ),
    );
    assert.equal(racers.filter((r) => r.status === "suspended").length, 1, "exactly one concurrent suspension commits");
    assert.deepEqual(
      [...new Set(racers.filter((r) => r.status === "refused").map((r) => (r.status === "refused" ? r.reason : "")))],
      ["agent-already-suspended"],
    );
    assert.equal((await ledger()).decisions, beforeRace.decisions + 1, "and exactly one decision is recorded");

    /* A fresh agent with its own mandate and envelope, for the races below. */
    const racer = await register(ctx, "Racer");
    await seedAgentMandate(setup, acme, racer, deps, { tag: "l2bm2", proposalScope: ["record-work"] });
    assert.equal((await writeStandingMutationAuthorization(ctx, "active", envelopeFor(racer, null), deps)).status, "written");
    const racerProposer = await resolveAgentProposer(ctx, deps, { agentId: racer });
    assert.equal(racerProposer.status, "resolved");
    const racerBy = racerProposer.status === "resolved" ? racerProposer.proposer : null;
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const HOLD_MS = 750;

    /* ── (15) SUSPEND vs SPEND: the spend waits on the agent row, then sees the suspension ── */
    const raceIssued = await issue(await propose("Spent while a suspension is in flight", racerBy));
    assert.equal(raceIssued.status, "issued", JSON.stringify(raceIssued));
    const racePermit = raceIssued.status === "issued" ? raceIssued.permitId : "";
    const workBeforeRace = await countOf("work_items");
    let spend: ReturnType<typeof deliver> | null = null;
    const suspendedDuringSpend = await suspendDurableAgentIdentity(ctx, { agentId: racer, justification: SUSPEND }, {
      ...(deps as object),
      afterRead: async () => {
        spend = deliver(racePermit);
        await sleep(HOLD_MS);
      },
    });
    assert.equal(suspendedDuringSpend.status, "suspended");
    const spent = await spend!;
    assert.notEqual(spent.status, "executed", "a spend racing a suspension never executes after it");
    assert.equal(await permitStatus(racePermit), "active", "the racing spend rolled back; the permit is unspent");
    assert.equal(await countOf("work_items"), workBeforeRace, "and no work was recorded");
    await setup.query(
      `update action_permits set issued_at = now() - interval '2 hours', expires_at = now() - interval '1 hour' where id = $1`,
      [racePermit],
    );
    await setup.query(
      `update standing_mutation_authorizations set not_before = now() - interval '2 hours', not_after = now() - interval '1 hour' where agent_id = $1`,
      [racer],
    );
    assert.equal((await reactivateDurableAgentIdentity(ctx, { agentId: racer, justification: REACTIVATE }, deps)).status, "reactivated");

    /* ── (16) SUSPEND vs STANDING ISSUANCE: the suspension waits for the issuance to commit ── */
    /* The closed envelope is withdrawn (the agent is in service again), then a fresh one decided. */
    assert.equal((await writeStandingMutationAuthorization(ctx, "withdrawn", envelopeFor(racer, 1), deps)).status, "written");
    assert.equal(
      (await writeStandingMutationAuthorization(ctx, "active", envelopeFor(racer, 2), deps)).status,
      "written",
      "a fresh envelope, a new Governance decision after reactivation",
    );
    const issuanceRequest = await propose("Issued while a suspension is in flight", racerBy);
    let suspensionSettled = false;
    let suspensionSettledDuringHold: boolean | null = null;
    let racingSuspension: Promise<unknown> | null = null;
    const heldIssuance = await issuePermitUnderStandingAuthorization(
      { requestId: issuanceRequest },
      {
        getDb,
        now: () => tick(),
        armed: ARMED,
        readMandate: async (...args: Parameters<typeof readEffectiveAgentMandateForRuntime>) => {
          racingSuspension = suspendDurableAgentIdentity(ctx, { agentId: racer, justification: SUSPEND }, deps).then((r) => {
            suspensionSettled = true;
            return r;
          });
          await sleep(HOLD_MS);
          suspensionSettledDuringHold = suspensionSettled;
          return readEffectiveAgentMandateForRuntime(...args);
        },
      },
    );
    assert.equal(suspensionSettledDuringHold, false, "a suspension waits for an in-flight standing issuance");
    assert.equal(heldIssuance.status, "issued", JSON.stringify(heldIssuance));
    assert.equal(((await racingSuspension!) as { status: string }).status, "suspended");
    assert.deepEqual(
      await reactivateDurableAgentIdentity(ctx, { agentId: racer, justification: REACTIVATE }, deps),
      { status: "refused", reason: "agent-has-usable-permits" },
      "the permit minted just before the suspension blocks reactivation",
    );

    /* ── (17) REACTIVATE vs APPROVAL: the approval waits for the reactivation, then sees it ── */
    const approvable = await register(ctx, "Approvable");
    await seedAgentMandate(setup, acme, approvable, deps, { tag: "l2bm3", proposalScope: ["record-work"] });
    const approvableBy = await resolveAgentProposer(ctx, deps, { agentId: approvable });
    const pendingForApproval = await propose("Approved while a reactivation is in flight", approvableBy.status === "resolved" ? approvableBy.proposer : null);
    assert.equal((await suspendDurableAgentIdentity(ctx, { agentId: approvable, justification: SUSPEND }, deps)).status, "suspended");
    assert.notEqual(
      (await approveActionRequest(ctx, { requestId: pendingForApproval, justification: ENVELOPE }, deps)).status,
      "authorized",
      "a suspended agent's proposal cannot be approved",
    );
    let approvalSettled = false;
    let approvalSettledDuringHold: boolean | null = null;
    let racingApproval: Promise<{ status: string }> | null = null;
    const reactivatedDuringApproval = await reactivateDurableAgentIdentity(ctx, { agentId: approvable, justification: REACTIVATE }, {
      ...(deps as object),
      afterRead: async () => {
        racingApproval = approveActionRequest(ctx, { requestId: pendingForApproval, justification: ENVELOPE }, deps).then((r) => {
          approvalSettled = true;
          return r;
        });
        await sleep(HOLD_MS);
        approvalSettledDuringHold = approvalSettled;
      },
    });
    assert.equal(approvalSettledDuringHold, false, "an approval waits for an in-flight reactivation");
    assert.equal(reactivatedDuringApproval.status, "reactivated");
    assert.equal((await racingApproval!).status, "authorized", "after it commits, the approval is a fresh human decision on an in-service agent");

    /* ── (18) SUSPEND vs ENVELOPE AUTHORIZATION: no active envelope lands after the suspension ── */
    const activeEnvelopes = async (agentId: string): Promise<number> =>
      Number(
        (
          await setup.query(
            `select count(*)::int n from standing_mutation_authorizations s
              where s.agent_id = $1 and s.state = 'active'
                and s.authorization_revision = (select max(authorization_revision) from standing_mutation_authorizations where agent_id = $1)`,
            [agentId],
          )
        ).rows[0]!.n,
      );
    assert.equal(await activeEnvelopes(approvable), 0, "the approvable agent holds no envelope before the race");
    let racingEnvelope: Promise<{ status: string; reason?: string }> | null = null;
    const suspendedDuringEnvelope = await suspendDurableAgentIdentity(ctx, { agentId: approvable, justification: SUSPEND }, {
      ...(deps as object),
      afterRead: async () => {
        racingEnvelope = writeStandingMutationAuthorization(ctx, "active", envelopeFor(approvable, null), deps);
        await sleep(HOLD_MS);
      },
    });
    assert.equal(suspendedDuringEnvelope.status, "suspended");
    const envelopeOutcome = await racingEnvelope!;
    assert.equal(
      envelopeOutcome.status === "refused" ? envelopeOutcome.reason : envelopeOutcome.status,
      "agent-not-in-service",
      "an envelope authorization racing a suspension is refused, not committed for a suspended agent",
    );
    assert.equal(await activeEnvelopes(approvable), 0, "no active envelope exists for the suspended agent");

    console.log("l2b suspension postgres: ok");
  } finally {
    await setup.end().catch(() => undefined);
    await handle.dispose?.().catch(() => {});
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
