/*
 * PLAN-FOLLOW-UP-REFERENCE-V1 — the MACHINE door spends a linked follow-up exactly like the human
 * door, against a REAL disposable PostgreSQL database.
 *
 * `provenance-postgres.ts` proves the human executor. Agent-originated record-work is what machine
 * delivery spends in production, so this file proves the same two properties through
 * `executeRecordWorkAsMachine`: the relationship is written with the work in the spend transaction,
 * from the request's own provenance rows; and a source retired after approval refuses the spend,
 * leaves the permit active, and writes nothing. Origination is not repeated here — the verified
 * source ids are handed to the released agent inlet, which is where origination hands them.
 *
 * The arming switch is injected ARMED (no deployment row exists in a disposable database); the
 * tenant's own enrolment is written through the released Governance writer. The database is dropped
 * on exit.
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
import { proposeAgentOriginatedRecordWorkAction } from "../../src/features/heby-action-inlet/record-work-proposal.server";
import { approveActionRequest } from "../../src/features/action-authorization/decide-action-request.server";
import { executeRecordWorkAsMachine } from "../../src/features/governed-machine-execution/execute-record-work-as-machine.server";
import { authorizeTenantMachineExecution } from "../../src/features/tenant-machine-execution-authority/authorize-tenant-machine-execution.server";
import { recordWork } from "../../src/features/organizational-work/write-work.server";
import { RECORD_WORK_ACTION_KIND } from "../../src/features/heby-action-inlet/contracts";
import { asHumanTenantContext, type TenantContext } from "../../src/features/auth/tenant/tenant-context";

const GENESIS = "This organization establishes its founding Governance authority for the machine follow-up proof.";
const APPROVE = "Approved for the machine follow-up provenance proof, recorded by the Director.";

type Seeded = Awaited<ReturnType<typeof seedLocalIdentity>>;

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_pfr_machine");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db } as never;
  const armed = { getDb: () => handle.db, armed: async () => true } as never;

  const n = async (sql: string, args: unknown[] = []) => Number((await setup.query(sql, args)).rows[0]!.n);
  const works = () => n(`select count(*)::int n from work_items`);
  const followRows = () => n(`select count(*)::int n from work_item_follow_up_sources`);
  const permitStatus = async (id: string) =>
    (await setup.query<{ status: string }>(`select status from action_permits where id = $1`, [id])).rows[0]!.status;

  try {
    const org = (await seedLocalIdentity(setup, { companyName: "pfr-mach", companySlug: "pfr-mach", email: "director@pfr-mach.test" })) as Seeded;
    const session = (
      await setup.query<{ id: string }>(
        `insert into user_session_contexts (auth_identity_id, provider_session_reference_hash, provider_session_reference_digest_version,
           user_id, active_tenant_id, active_membership_id, membership_version, assurance_level, mfa_verified, authenticated_at,
           issued_at, last_activity_at, absolute_expires_at, inactivity_expires_at)
         values ($1,$2,1,$3,$4,$5,1,'aal1',false, now(), now(), now(), now() + interval '1 day', now() + interval '1 day') returning id`,
        [org.authIdentityId, "c".repeat(64), org.userId, org.tenantId, org.membershipId],
      )
    ).rows[0]!.id;
    const ctx: TenantContext = asHumanTenantContext({
      tenantId: org.tenantId, userId: org.userId, authIdentityId: org.authIdentityId, membershipId: org.membershipId,
      membershipVersion: 1, roleId: org.roleId, sessionContextId: session, provider: "local", assuranceLevel: "aal1",
      mfaVerified: false, requestId: "pfr-mach", authenticatedAt: new Date().toISOString(),
    });
    await setup.query(
      `insert into genesis_nominations (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
         accepted_at, accepted_session_context_id, accepted_assurance_level)
       values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
      [org.tenantId, org.authIdentityId, org.userId, session],
    );
    assert.equal((await establishGovernanceAuthority(ctx, { justification: GENESIS }, deps)).status, "established");
    assert.equal(
      (
        await authorizeTenantMachineExecution(
          ctx,
          {
            capabilityKey: RECORD_WORK_ACTION_KIND,
            justification: "This organization agrees that work it has already authorized may be delivered by machine.",
            observedRevision: null,
          },
          deps,
        )
      ).status,
      "written",
    );
    const agent = await createDurableAgentIdentity(ctx, { name: "Heby", justification: "Register this agent for the test organization." }, deps);
    assert.equal(agent.status, "established");
    const agentId = agent.status === "established" ? agent.identity.agentId : "";
    await seedAgentMandate(setup, org, agentId, deps, { tag: "pfrmach1", proposalScope: ["record-work"] });
    const resolved = await resolveAgentProposer(ctx, deps);
    assert.equal(resolved.status, "resolved");
    const proposer = resolved.status === "resolved" ? resolved.proposer : null;
    assert.ok(proposer);

    const work = async (title: string) => {
      const r = await recordWork(ctx, { title }, deps);
      assert.equal(r.status, "recorded", JSON.stringify(r));
      return r.status === "recorded" ? r.workItem.workItemId : "";
    };
    const [S1, S2] = [await work("Blocked loom repair"), await work("Blocked dye order")];

    /* A linked agent proposal, authorized by the Director — what origination files after verifying a binding. */
    const linkedPermit = async (title: string, sources: readonly string[]) => {
      const proposal = await proposeAgentOriginatedRecordWorkAction(
        ctx,
        { workScope: { kind: "organization" as const }, title, department: { kind: "organization-level" } } as never,
        proposer!,
        deps,
        undefined,
        undefined,
        undefined,
        sources,
      );
      assert.equal(proposal.status, "proposed", JSON.stringify(proposal));
      const requestId = proposal.status === "proposed" ? proposal.receipt.requestId : "";
      const approval = await approveActionRequest(ctx, { requestId, justification: APPROVE }, deps);
      assert.equal(approval.status, "authorized", JSON.stringify(approval));
      return { requestId, permitId: approval.status === "authorized" ? approval.permitId : "" };
    };

    /* ═══ 1. MACHINE SPEND: the relationship is written with the work, in plan order, authored system. ═══ */
    const first = await linkedPermit("Follow up the blocked items", [S1, S2]);
    const executed = await executeRecordWorkAsMachine({ permitId: first.permitId }, armed);
    assert.equal(executed.status, "executed", JSON.stringify(executed));
    assert.equal(await permitStatus(first.permitId), "consumed");
    const followUpId = (
      await setup.query<{ id: string }>(`select id from work_items where title = 'Follow up the blocked items'`)
    ).rows[0]!.id;
    const links = (
      await setup.query<{ source_work_item_id: string; action_request_id: string; ordinal: number; tenant_id: string; created_by_type: string }>(
        `select source_work_item_id, action_request_id, ordinal, tenant_id, created_by_type
           from work_item_follow_up_sources where work_item_id = $1 order by ordinal`,
        [followUpId],
      )
    ).rows;
    assert.deepEqual(
      links.map((l) => [l.source_work_item_id, l.action_request_id, l.ordinal, l.tenant_id]),
      [[S1, first.requestId, 0, org.tenantId], [S2, first.requestId, 1, org.tenantId]],
      "the machine door records the request's own sources, in order",
    );
    assert.ok(links.every((l) => l.created_by_type === "system"), "authored system, as every machine act is");

    /* ═══ 2. REVALIDATION AT MACHINE SPEND: a retired source refuses; the permit survives; nothing is written. ═══ */
    const second = await linkedPermit("Re-check the dye order", [S2]);
    await setup.query(`update work_items set lifecycle_status = 'archived' where id = $1`, [S2]);
    const [w0, f0] = [await works(), await followRows()];
    const refused = await executeRecordWorkAsMachine({ permitId: second.permitId }, armed);
    assert.equal(refused.status, "refused", JSON.stringify(refused));
    assert.equal(refused.status === "refused" ? refused.reason : "", "work-authority-refused");
    assert.equal(refused.status === "refused" ? refused.authorityReason : "", "follow-up-source-ineligible");
    assert.equal(await permitStatus(second.permitId), "active", "the permit is not spent");
    assert.deepEqual([await works(), await followRows()], [w0, f0], "no work row and no relationship row");

    console.log("plan-follow-up-reference-v1/machine-provenance-postgres: OK");
  } finally {
    await setup.end().catch(() => {});
    await (handle as { dispose?: () => Promise<void> }).dispose?.().catch?.(() => {});
    await harness.dropDatabase();
  }
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
