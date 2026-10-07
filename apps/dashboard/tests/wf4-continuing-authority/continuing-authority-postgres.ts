/*
 * WF-4 — an agent-proposed permit is spendable only while its agent is in service and its CURRENT
 * mandate admits the act. Real Postgres, through the released human door (`executeRecordWork`) and
 * the machine door's raw spend (`consumeActionPermitAsMachine`, minted directly so the executor's
 * APF-1 prechecks and arming are bypassed — the shared spend must refuse on its own).
 *
 * ISSUED != SPENDABLE NOW. A refusal leaves the permit `active` (not revoked), writes no work item and
 * no consumption audit, and is reversible: restoring the mandate makes the same permit spendable.
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
import { retireDurableAgentIdentity } from "../../src/features/agent-identity/retire-durable-agent-identity.server";
import { resolveAgentProposer } from "../../src/features/action-authorization/agent-proposer.server";
import { recordDepartment } from "../../src/features/organization-authority/write-structure.server";
import { formatDepartmentRef } from "../../src/features/organization-authority/department-ref";
import {
  proposeAgentOriginatedRecordWorkAction,
  proposeRecordWorkAction,
} from "../../src/features/heby-action-inlet/record-work-proposal.server";
import { approveActionRequest } from "../../src/features/action-authorization/decide-action-request.server";
import { revokeActionPermit } from "../../src/features/action-authorization/revoke-action-permit.server";
import { executeRecordWork } from "../../src/features/governed-internal-action/execute-record-work.server";
import { mintMachineExecutionPrincipal } from "../../src/features/action-authorization/machine-execution-principal.server";
import { consumeActionPermitAsMachine } from "../../src/features/action-authorization/consume-action-permit.server";
import { asHumanTenantContext, type TenantContext } from "../../src/features/auth/tenant/tenant-context";

const GENESIS = "This organization establishes its founding Governance authority for the WF-4 proof.";
const APPROVE = "Approved for the WF-4 continuing-authority proof, recorded by the Director.";

type Seeded = Awaited<ReturnType<typeof seedLocalIdentity>>;

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_wf4_continuing");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db } as never;

  const realFetch = globalThis.fetch;
  let fetches = 0;
  globalThis.fetch = (async (...a: Parameters<typeof fetch>) => {
    fetches += 1;
    return realFetch(...a);
  }) as typeof fetch;

  const count = async (sql: string, args: unknown[] = []) => Number((await setup.query(sql, args)).rows[0]!.n);
  const works = () => count(`select count(*)::int n from work_items`);
  const consumedAudits = () => count(`select count(*)::int n from audit_log where action = 'governance.action.permit.consumed'`);
  const permitStatus = async (id: string) =>
    (await setup.query<{ status: string }>(`select status from action_permits where id = $1`, [id])).rows[0]!.status;

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
    const agentId = agent.status === "established" ? agent.identity.agentId : "";
    let mandate = await seedAgentMandate(setup, org, agentId, deps, { tag: `${slug}1`, proposalScope: ["record-work"] });
    const revise = async (scope: string[], tag: string) => {
      mandate = await seedAgentMandate(setup, org, agentId, deps, { tag, proposalScope: scope, observedMandateRevision: mandate.mandateRevision });
    };
    return { org, ctx, departmentRef, agentId, revise };
  };

  try {
    const acme = await organization("wf4-acme", "a");
    const globex = await organization("wf4-globex", "b");
    const resolved = await resolveAgentProposer(acme.ctx, deps);
    assert.equal(resolved.status, "resolved");
    const proposer = resolved.status === "resolved" ? resolved.proposer : null;

    let seq = 0;
    const approve = async (requestId: string) => {
      const approval = await approveActionRequest(acme.ctx, { requestId, justification: APPROVE }, deps);
      assert.equal(approval.status, "authorized", JSON.stringify(approval));
      return approval.status === "authorized" ? approval.permitId : "";
    };
    const agentPermit = async () => {
      const p = await proposeAgentOriginatedRecordWorkAction(
        acme.ctx, { title: `WF-4 agent work ${++seq}`, department: { kind: "department", departmentRef: acme.departmentRef } }, proposer!, deps,
      );
      assert.equal(p.status, "proposed", JSON.stringify(p));
      return approve(p.status === "proposed" ? p.receipt.requestId : "");
    };
    const humanPermit = async () => {
      const p = await proposeRecordWorkAction(
        acme.ctx, { title: `WF-4 human work ${++seq}`, department: { kind: "department", departmentRef: acme.departmentRef } }, deps,
      );
      assert.equal(p.status, "proposed", JSON.stringify(p));
      return approve(p.status === "proposed" ? p.receipt.requestId : "");
    };
    const execute = (permitId: string) => executeRecordWork(acme.ctx, { permitId }, deps);
    const reasonOf = (r: Awaited<ReturnType<typeof execute>>) => (r.status === "refused" ? r.reason : r.status);
    /* A refusal must change nothing: permit active, no work, no consumption audit. */
    const refusedCleanly = async (permitId: string, expected: string, label: string) => {
      const [w, a] = [await works(), await consumedAudits()];
      assert.equal(reasonOf(await execute(permitId)), expected, label);
      assert.equal(await permitStatus(permitId), "active", `${label}: permit stays active (issued, not revoked)`);
      assert.equal(await works(), w, `${label}: no work item`);
      assert.equal(await consumedAudits(), a, `${label}: no consumption audit`);
    };

    /* 1 · valid agent + current mandate + active permit → executes. */
    assert.equal(reasonOf(await execute(await agentPermit())), "executed", "the released path still works");

    /* 3 · record-work withdrawn from the CURRENT mandate after issuance → refused, not revoked. */
    const p3 = await agentPermit();
    await acme.revise(["send"], "wf4m2");
    await refusedCleanly(p3, "agent-mandate-refused", "mandate narrowed");

    /* 4 · a later revision restoring record-work → the SAME permit is spendable again. */
    await acme.revise(["send", "record-work"], "wf4m3");
    assert.equal(reasonOf(await execute(p3)), "executed", "current mandate admits it again — reversible, nothing was revoked");

    /* 5 · manual Governance revocation is unchanged. */
    const p5 = await agentPermit();
    const revoked = await revokeActionPermit(acme.ctx, { permitId: p5, justification: APPROVE, revocationReason: "WF-4 proof" }, deps);
    assert.equal(revoked.status, "revoked", JSON.stringify(revoked));
    assert.equal(reasonOf(await execute(p5)), "permit-not-consumable", "a revoked permit refuses as before");

    /* 6 · an expired permit is unchanged. */
    const p6 = await agentPermit();
    await setup.query(`update action_permits set issued_at = now() - interval '2 hours', expires_at = now() - interval '1 hour' where id = $1`, [p6]);
    assert.equal(reasonOf(await execute(p6)), "permit-not-consumable", "an expired permit refuses as before");

    /* 8 · request names another organization's agent → fail closed. */
    const p8 = await agentPermit();
    await setup.query(
      `update heby_action_requests set proposed_by_actor_id = $2 where id = (select action_request_id from action_permits where id = $1)`,
      [p8, globex.agentId],
    );
    await refusedCleanly(p8, "agent-not-in-service", "cross-tenant agent");

    /* 9 · request depends on an agent that resolves to nothing → fail closed. */
    const p9 = await agentPermit();
    await setup.query(
      `update heby_action_requests set proposed_by_actor_id = $2 where id = (select action_request_id from action_permits where id = $1)`,
      [p9, randomUUID()],
    );
    await refusedCleanly(p9, "agent-not-in-service", "missing agent");

    /* 2 · the agent retires after issuance → refused, not revoked. Issue first, then retire. */
    const p2 = await agentPermit();
    const pMachine = await agentPermit();
    const pHuman = await humanPermit();
    const retired = await retireDurableAgentIdentity(acme.ctx, { agentId: acme.agentId }, deps);
    assert.equal(retired.status, "retired", JSON.stringify(retired));
    await refusedCleanly(p2, "agent-not-in-service", "agent retired");

    /* 10 · the machine door, minted directly — no executor precheck, no arming — still refuses. */
    const minted = await mintMachineExecutionPrincipal(handle.db, { permitId: pMachine });
    assert.equal(minted.status, "minted", JSON.stringify(minted));
    const machine = await consumeActionPermitAsMachine(minted.status === "minted" ? minted.principal : (null as never), deps);
    assert.deepEqual(machine, { status: "refused", reason: "agent-not-in-service" }, "the machine door cannot bypass the shared spend");
    assert.equal(await permitStatus(pMachine), "active");

    /* 7 · a human-proposed request needs no agent state — executes even with the agent retired. */
    assert.equal(reasonOf(await execute(pHuman)), "executed", "non-agent requests are unaffected");

    /* 12 · nothing here reaches a provider. */
    assert.equal(fetches, 0, "no network call");

    console.log("PASS wf4-continuing-authority continuing-authority-postgres (12 cases)");
  } finally {
    globalThis.fetch = realFetch;
    await setup.end().catch(() => {});
    await (handle as { dispose?: () => Promise<void> }).dispose?.().catch?.(() => {});
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
