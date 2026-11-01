/*
 * APPROVED OUTCOME — what became of each approved agent proposal, against a real disposable Postgres.
 *
 * Internal acts write no `action_execution_attempts` row (GIA-1), so "approved minus attempts" reported
 * every executed internal act as never executed. The outcome of an internal act is the link the Work
 * Authority declared in the permit's own transaction. A spend without that link is UNKNOWN: not a
 * success, not "never executed".
 *
 * Rows come from the released writers. The two cases no writer can reach today (a legacy spend, a
 * contradictory link) are built exactly as tests/heby-verified-work-outcomes builds them. Provider
 * outcomes are proven in observation-postgres.ts on real attempts.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { seedAgentMandate } from "../helpers/agent-mandate-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { createDurableAgentIdentity } from "../../src/features/agent-identity/create-durable-agent-identity.server";
import { resolveAgentProposer, type AgentProposer } from "../../src/features/action-authorization/agent-proposer.server";
import { recordDepartment } from "../../src/features/organization-authority/write-structure.server";
import { formatDepartmentRef } from "../../src/features/organization-authority/department-ref";
import {
  proposeAgentOriginatedRecordWorkAction,
  proposeRecordWorkAction,
} from "../../src/features/heby-action-inlet/record-work-proposal.server";
import { proposeAgentOriginatedWorkStateAction } from "../../src/features/heby-action-inlet/work-state-proposal.server";
import { approveActionRequest } from "../../src/features/action-authorization/decide-action-request.server";
import { revokeActionPermit } from "../../src/features/action-authorization/revoke-action-permit.server";
import { executeRecordWork } from "../../src/features/governed-internal-action/execute-record-work.server";
import { executeSetWorkDeclaredState } from "../../src/features/governed-internal-action/execute-set-work-state.server";
import { recordWorkWithin } from "../../src/features/organizational-work/write-work.server";
import { readAgentOutcomeObservation } from "../../src/features/agent-outcome-observation/agent-outcome-projection.server";
import { APPROVED_OUTCOME_CLASSES } from "../../src/features/agent-outcome-observation/contracts";
import { asHumanTenantContext, type TenantContext } from "../../src/features/auth/tenant/tenant-context";

const GENESIS = "This organization establishes its founding Governance authority for the approved outcome proof.";
const JUSTIFY = "Decided for the approved outcome proof, recorded by the Director.";

type Seeded = Awaited<ReturnType<typeof seedLocalIdentity>>;

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_approved_outcomes");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db } as never;

  const organization = async (slug: string, hashChar: string) => {
    const org = (await seedLocalIdentity(setup, { companyName: slug, companySlug: slug, email: `director@${slug}.test` })) as Seeded;
    const session = (
      await setup.query<{ id: string }>(
        `insert into user_session_contexts (auth_identity_id, provider_session_reference_hash, provider_session_reference_digest_version,
           user_id, active_tenant_id, active_membership_id, membership_version, assurance_level, mfa_verified, authenticated_at,
           issued_at, last_activity_at, absolute_expires_at, inactivity_expires_at)
         values ($1,$2,1,$3,$4,$5,1,'aal1',false, now(), now(), now(), now() + interval '1 day', now() + interval '1 day') returning id`,
        [org.authIdentityId, hashChar.repeat(64), org.userId, org.tenantId, org.membershipId],
      )
    ).rows[0]!.id;
    const ctx: TenantContext = asHumanTenantContext({
      tenantId: org.tenantId, userId: org.userId, authIdentityId: org.authIdentityId, membershipId: org.membershipId,
      membershipVersion: 1, roleId: org.roleId, sessionContextId: session, provider: "local", assuranceLevel: "aal1",
      mfaVerified: false, requestId: slug, authenticatedAt: new Date().toISOString(),
    });
    await setup.query(
      `insert into genesis_nominations (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
         accepted_at, accepted_session_context_id, accepted_assurance_level)
       values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
      [org.tenantId, org.authIdentityId, org.userId, session],
    );
    assert.equal((await establishGovernanceAuthority(ctx, { justification: GENESIS }, deps)).status, "established");
    const dept = await recordDepartment(ctx, { name: "Finance", slug: "finance" }, deps);
    assert.equal(dept.status, "recorded");
    const departmentRef = formatDepartmentRef(dept.status === "recorded" ? dept.department.departmentId : "");
    const agent = await createDurableAgentIdentity(ctx, { name: "Heby", justification: "Register this agent for the test organization." }, deps);
    assert.equal(agent.status, "established");
    await seedAgentMandate(setup, org, agent.status === "established" ? agent.identity.agentId : "", deps, { tag: `${slug}1` });
    const resolved = await resolveAgentProposer(ctx, deps);
    assert.equal(resolved.status, "resolved", JSON.stringify(resolved));
    return { ctx, departmentRef, proposer: (resolved as { proposer: AgentProposer }).proposer };
  };

  try {
    const acme = await organization("approved-acme", "e");
    const globex = await organization("approved-globex", "f");

    let seq = 0;
    const file = async (org: typeof acme): Promise<string> => {
      const p = await proposeAgentOriginatedRecordWorkAction(
        org.ctx,
        { workScope: { kind: "organization" }, title: `Approved outcome ${++seq}`, department: { kind: "department", departmentRef: org.departmentRef } },
        org.proposer,
        deps,
      );
      assert.equal(p.status, "proposed", JSON.stringify(p));
      return p.status === "proposed" ? p.receipt.requestId : "";
    };
    const approve = async (requestId: string, ctx: TenantContext): Promise<string> => {
      const a = await approveActionRequest(ctx, { requestId, justification: JUSTIFY }, deps);
      assert.equal(a.status, "authorized", JSON.stringify(a));
      return a.status === "authorized" ? a.permitId : "";
    };
    const execute = async (org: typeof acme) => {
      const r = await executeRecordWork(org.ctx, { permitId: await approve(await file(org), org.ctx) }, deps);
      if (r.status !== "executed" || r.outcome.status !== "recorded") throw new Error(JSON.stringify(r));
      return { handoffId: r.handoffId, workItemId: r.outcome.workItem.workItemId };
    };
    const outcomes = async (ctx: TenantContext) => {
      const read = await readAgentOutcomeObservation(ctx, deps);
      assert.equal(read.status, "read", JSON.stringify(read));
      if (read.status !== "read") throw new Error("unreachable");
      const agent = read.agents[0]!;
      assert.equal(
        APPROVED_OUTCOME_CLASSES.reduce((sum, name) => sum + agent.governance.approvedOutcomes[name], 0),
        agent.governance.approved,
        "the classes are a partition of what was approved",
      );
      return agent.governance;
    };
    const none = { notStarted: 0, internalRecorded: 0, providerAccepted: 0, failedOrRefused: 0, unknown: 0 };

    /* An agent that has done nothing reports zeros, not a missing field. */
    assert.deepEqual((await outcomes(acme.ctx)).approvedOutcomes, none);

    /* 1 · RECORD-WORK EXECUTED — no attempt row, a declared link: the AP-5 shape. */
    const recorded = await execute(acme);
    const afterRecorded = await outcomes(acme.ctx);
    assert.deepEqual(afterRecorded.approvedOutcomes, { ...none, internalRecorded: 1 });
    assert.equal(afterRecorded.approvedWithoutExecution, 1, "still true and still reported: no attempt row exists");

    /* 2 · SET-WORK-DECLARED-STATE EXECUTED — the other declared link, read under its own action. */
    const state = await proposeAgentOriginatedWorkStateAction(acme.ctx, { workItemId: recorded.workItemId, toState: "active" }, acme.proposer, deps);
    assert.equal(state.status, "proposed", JSON.stringify(state));
    const stateRun = await executeSetWorkDeclaredState(
      acme.ctx,
      { permitId: await approve(state.status === "proposed" ? state.receipt.requestId : "", acme.ctx) },
      deps,
    );
    assert.equal(stateRun.status, "executed", JSON.stringify(stateRun));
    assert.deepEqual((await outcomes(acme.ctx)).approvedOutcomes, { ...none, internalRecorded: 2 });

    /* 3 · NOT STARTED — approved with a live permit; expired; revoked. None is a failure. */
    const livePermit = await approve(await file(acme), acme.ctx);
    const expiredPermit = await approve(await file(acme), acme.ctx);
    await setup.query(`update action_permits set issued_at = now() - interval '2 hours', expires_at = now() - interval '1 hour' where id = $1`, [expiredPermit]);
    const revokedPermit = await approve(await file(acme), acme.ctx);
    const revoked = await revokeActionPermit(acme.ctx, { permitId: revokedPermit, justification: JUSTIFY, revocationReason: "approved outcome proof" }, deps);
    assert.equal(revoked.status, "revoked", JSON.stringify(revoked));
    assert.deepEqual((await outcomes(acme.ctx)).approvedOutcomes, { ...none, internalRecorded: 2, notStarted: 3 });

    /* 4 · AN INTERNAL FAILURE ROLLS BACK — the spend reverts, so it reads as not started, truthfully. */
    const refused = await executeRecordWork(acme.ctx, { permitId: livePermit }, {
      ...(deps as object),
      recordWithin: async () => ({ status: "refused", reason: "department-unresolved" }),
    } as never);
    assert.equal(refused.status, "refused");
    assert.deepEqual((await outcomes(acme.ctx)).approvedOutcomes, { ...none, internalRecorded: 2, notStarted: 3 });

    /* 5 · A LEGACY SPEND — the permit is consumed and the work exists, but no link was written: UNKNOWN. */
    const legacy = await executeRecordWork(acme.ctx, { permitId: await approve(await file(acme), acme.ctx) }, {
      ...(deps as object),
      recordWithin: (tx: never, tenant: TenantContext, input: { title: string }, author: never) =>
        recordWorkWithin(tx, tenant, { ...input, dischargesHandoffId: undefined }, author),
    } as never);
    assert.equal(legacy.status, "executed", JSON.stringify(legacy));
    const legacyHandoff = legacy.status === "executed" ? legacy.handoffId : "";
    const afterLegacy = await outcomes(acme.ctx);
    assert.deepEqual(afterLegacy.approvedOutcomes, { ...none, internalRecorded: 2, notStarted: 3, unknown: 1 });
    assert.equal(afterLegacy.permitsConsumed, 3, "three spends, two proven: a spend is not a success");

    /* 6 · A CONTRADICTION — two rows claim one spend: unknown, never the first one found. */
    const twice = await execute(acme);
    await setup.query(
      `insert into audit_log
         select (jsonb_populate_record(null::audit_log, to_jsonb(a) || $2::jsonb)).*
           from audit_log a where a.entity_type = 'work_item' and a.action = 'work.recorded' and a.entity_id = $1 limit 1`,
      [twice.workItemId, JSON.stringify({ id: randomUUID(), entity_id: recorded.workItemId })],
    );
    assert.deepEqual((await outcomes(acme.ctx)).approvedOutcomes, { ...none, internalRecorded: 2, notStarted: 3, unknown: 2 });

    /* 7 · A HUMAN'S PROPOSAL IS NOT AN AGENT'S — it never enters these counts. */
    const human = await proposeRecordWorkAction(
      acme.ctx,
      { workScope: { kind: "organization" }, title: "Dictated by a person", department: { kind: "department", departmentRef: acme.departmentRef } },
      deps,
    );
    assert.equal(human.status, "proposed", JSON.stringify(human));
    await executeRecordWork(acme.ctx, { permitId: await approve(human.status === "proposed" ? human.receipt.requestId : "", acme.ctx) }, deps);
    assert.deepEqual((await outcomes(acme.ctx)).approvedOutcomes, { ...none, internalRecorded: 2, notStarted: 3, unknown: 2 });

    /* 8 · TENANT ISOLATION — another organization's row naming Acme's legacy spend proves nothing for Acme. */
    const foreign = await execute(globex);
    await setup.query(
      `insert into audit_log
         select (jsonb_populate_record(null::audit_log, to_jsonb(a) || $2::jsonb)).*
           from audit_log a where a.entity_type = 'work_item' and a.action = 'work.recorded' and a.entity_id = $1 limit 1`,
      [foreign.workItemId, JSON.stringify({ id: randomUUID(), metadata: { handoffId: legacyHandoff } })],
    );
    assert.deepEqual((await outcomes(acme.ctx)).approvedOutcomes, { ...none, internalRecorded: 2, notStarted: 3, unknown: 2 }, "Acme's unknown stays unknown");
    assert.deepEqual((await outcomes(globex.ctx)).approvedOutcomes, { ...none, internalRecorded: 1 }, "Globex sees only its own");

    /* 9 · AN UNREADABLE WORK OUTCOME IS NOT A ZERO — the whole read says so. */
    const noWorkRead = await readAgentOutcomeObservation(acme.ctx, {
      ...(deps as object),
      readWorkOutcomes: async () => ({ status: "unavailable" }),
    } as never);
    assert.deepEqual(noWorkRead, { status: "unavailable", reason: "work-outcome-authority-unavailable" });

    /* 10 · READING IS A READ. */
    const census = async () =>
      (await setup.query(`select (select count(*) from audit_log)::int a, (select count(*) from action_permits)::int p, (select count(*) from work_items)::int w`)).rows[0];
    const before = await census();
    await outcomes(acme.ctx);
    assert.deepEqual(await census(), before, "the read writes nothing");

    console.log("PASS approved-outcome-postgres (10 cases)");
  } finally {
    await setup.end().catch(() => {});
    await (handle as { dispose?: () => Promise<void> }).dispose?.().catch?.(() => {});
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
