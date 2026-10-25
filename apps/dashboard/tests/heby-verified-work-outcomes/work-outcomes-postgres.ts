/*
 * HEBY-VERIFIED-WORK-OUTCOMES — against a real disposable Postgres.
 *
 * What a person sees about a `record-work` request they filed must come from the authorities that
 * own each fact, and the WORK ITEM must be the one the spend produced — named by the link
 * Organizational Work itself declared (`work.recorded` audit metadata `handoffId`, same transaction
 * as the spend), never matched by title, time or session.
 *
 *     PROPOSED != APPROVED != AUTHORIZED != EXECUTED != WORK ITEM NAMED
 *
 * Cases: executed (organization and domain scope), pending, approved-not-executed, expired,
 * rejected, failed execution, legacy spend with no declared link, contradictory link, a human row
 * claiming a handoff, cross-tenant, cross-user, unreadable authority, and reads that write nothing.
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
import { recordDepartment } from "../../src/features/organization-authority/write-structure.server";
import { formatDepartmentRef } from "../../src/features/organization-authority/department-ref";
import { recordWorkDomain } from "../../src/features/work-domain/write-work-domain.server";
import { proposeRecordWorkAction } from "../../src/features/heby-action-inlet/record-work-proposal.server";
import { approveActionRequest, rejectActionRequest } from "../../src/features/action-authorization/decide-action-request.server";
import { executeRecordWork } from "../../src/features/governed-internal-action/execute-record-work.server";
import { recordWorkWithin } from "../../src/features/organizational-work/write-work.server";
import { readGovernedWorkOutcomes } from "../../src/features/organizational-work/read-governed-work-outcomes.server";
import {
  readActionRequestLifecycle,
  readMyActionRequestLifecycles,
  type ActionRequestLifecycleView,
} from "../../src/features/action-authorization/read-action-authorizations.server";
import { describeRequestLifecycle, lifecycleNextStep } from "../../src/components/layout/heby/heby-origination-affordance";
import { readWorkRegister } from "../../src/features/organizational-work/read-work.server";
import { readActionPermits } from "../../src/features/action-authorization/read-action-authorizations.server";
import { buildQueue } from "../../src/features/approvals-dashboard/model";
import type { ApprovalsDashboardRead } from "../../src/features/approvals-dashboard/read-dashboard.server";
import { asHumanTenantContext, type TenantContext } from "../../src/features/auth/tenant/tenant-context";
import type { WorkScope } from "../../src/features/work-domain/work-scope";

const GENESIS = "This organization establishes its founding Governance authority for the work outcome proof.";
const JUSTIFY = "Decided for the Heby verified work outcome proof, recorded by the Director.";

type Seeded = Awaited<ReturnType<typeof seedLocalIdentity>>;

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_heby_work_outcomes");
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
    const domain = await recordWorkDomain(ctx, { name: "Engineering", slug: "engineering" }, deps);
    assert.equal(domain.status, "recorded", JSON.stringify(domain));
    const engineeringId = domain.status === "recorded" ? domain.workDomain.workDomainId : "";
    const agent = await createDurableAgentIdentity(ctx, { name: "Heby", justification: "Register this agent for the test organization." }, deps);
    assert.equal(agent.status, "established");
    await seedAgentMandate(setup, org, agent.status === "established" ? agent.identity.agentId : "", deps, { tag: `${slug}1`, proposalScope: ["record-work"] });
    return { ctx, departmentRef, engineeringId };
  };

  const counts = async () =>
    (
      await setup.query(
        `select (select count(*) from heby_action_requests)::int r, (select count(*) from action_permits)::int p,
                (select count(*) from decision_records)::int d, (select count(*) from work_items)::int w,
                (select count(*) from audit_log)::int a`,
      )
    ).rows[0];

  /* Append one more `work.recorded` row, copied from an existing one, with the fields a case needs. */
  const appendWorkAudit = async (fromWorkItemId: string, patch: Record<string, unknown>) =>
    setup.query(
      `insert into audit_log
         select (jsonb_populate_record(null::audit_log, to_jsonb(a) || $2::jsonb)).*
           from audit_log a
          where a.entity_type = 'work_item' and a.action = 'work.recorded' and a.entity_id = $1
          limit 1`,
      [fromWorkItemId, JSON.stringify({ id: randomUUID(), ...patch })],
    );

  try {
    const acme = await organization("outcome-acme", "c");
    const globex = await organization("outcome-globex", "d");

    let seq = 0;
    const file = async (ctx: TenantContext, departmentRef: string, workScope: WorkScope = { kind: "organization" }) => {
      const p = await proposeRecordWorkAction(
        ctx,
        { workScope, title: `Outcome work ${++seq}`, department: { kind: "department", departmentRef } },
        deps,
      );
      assert.equal(p.status, "proposed", JSON.stringify(p));
      return p.status === "proposed" ? p.receipt.requestId : "";
    };
    const request = (workScope?: WorkScope) => file(acme.ctx, acme.departmentRef, workScope);
    const approve = async (requestId: string, ctx = acme.ctx) => {
      const a = await approveActionRequest(ctx, { requestId, justification: JUSTIFY }, deps);
      assert.equal(a.status, "authorized", JSON.stringify(a));
      return a.status === "authorized" ? a.permitId : "";
    };
    const execute = async (permitId: string, ctx = acme.ctx) => {
      const r = await executeRecordWork(ctx, { permitId }, deps);
      assert.equal(r.status, "executed", JSON.stringify(r));
      if (r.status !== "executed" || r.outcome.status !== "recorded") throw new Error("unreachable");
      return { handoffId: r.handoffId, workItem: r.outcome.workItem };
    };
    const lifecycle = async (requestId: string, ctx: TenantContext = acme.ctx): Promise<ActionRequestLifecycleView> => {
      const r = await readActionRequestLifecycle(ctx, requestId, deps);
      assert.equal(r.status, "read", JSON.stringify(r));
      return r.status === "read" ? r.lifecycle : (null as never);
    };
    const words = async (requestId: string) => describeRequestLifecycle(await lifecycle(requestId)).join(" ");

    /* 1 · SUCCESS, organization-level: the work item the spend produced, by id, title and scope. */
    const okId = await request();
    const ok = await execute(await approve(okId));
    const okWork = ok.workItem;
    const v1 = await lifecycle(okId);
    assert.deepEqual(v1.workOutcome, {
      status: "recorded",
      workItemId: okWork.workItemId,
      title: okWork.title,
      scope: { kind: "organization" },
    });
    assert.match(await words(okId), new RegExp(`Executed .*Work item recorded: ${okWork.title}\\. Organization-level work · work item ${okWork.workItemId}\\.`));
    const audit = (
      await setup.query<{ metadata: { handoffId?: string } }>(`select metadata from audit_log where entity_type='work_item' and action='work.recorded' and entity_id=$1`, [okWork.workItemId])
    ).rows;
    assert.equal(audit.length, 1);
    assert.equal(audit[0]!.metadata.handoffId, ok.handoffId, "the work authority named the spend it discharged");

    /* 1b · SUCCESS, work-domain scope: the domain's own name, read from the domain row. */
    const domainId = await request({ kind: "domain", workDomainId: acme.engineeringId });
    const domainRun = await execute(await approve(domainId));
    const v1b = await lifecycle(domainId);
    assert.deepEqual(v1b.workOutcome, {
      status: "recorded",
      workItemId: domainRun.workItem.workItemId,
      title: domainRun.workItem.title,
      scope: { kind: "domain", name: "Engineering" },
    });
    assert.match(await words(domainId), /Work domain: Engineering · work item /);

    /* 2 · PENDING, 3 · APPROVED NOT EXECUTED, 4 · EXPIRED, 5 · REJECTED: no work outcome is claimed. */
    const pendingId = await request();
    const approvedId = await request();
    const approvedPermit = await approve(approvedId);
    const expiredId = await request();
    const expiredPermit = await approve(expiredId);
    await setup.query(`update action_permits set issued_at = now() - interval '2 hours', expires_at = now() - interval '1 hour' where id = $1`, [expiredPermit]);
    const rejectedId = await request();
    assert.equal((await rejectActionRequest(acme.ctx, { requestId: rejectedId, justification: JUSTIFY, rejectionReason: "no" }, deps)).status, "rejected");
    for (const [id, re] of [
      [pendingId, /Waiting for a human decision/],
      [approvedId, /Authorized and not yet executed/],
      [expiredId, /expired .* without being used\. Nothing was executed\./],
      [rejectedId, /Rejected .*Nothing will be executed\./],
    ] as const) {
      assert.equal((await lifecycle(id)).workOutcome, null, `no outcome for ${re}`);
      const text = await words(id);
      assert.match(text, re);
      assert.doesNotMatch(text, /Work item recorded|Work item reference/);
    }

    /*
     * ENTERPRISE-OPERATIONS-1 — the loop on real rows: each lifecycle names where its next step is
     * acted on, the executed work is on the register a human is linked to, and an expired
     * authorization is worded as one that cannot run.
     */
    assert.equal(lifecycleNextStep(v1)?.href, "/director/work", "an executed record-work leads to the register");
    for (const [id, href] of [[pendingId, "/approvals"], [approvedId, "/approvals"], [expiredId, null], [rejectedId, null]] as const) {
      assert.equal(lifecycleNextStep(await lifecycle(id))?.href ?? null, href, `next step for ${id}`);
    }
    const register = await readWorkRegister(acme.ctx, deps);
    assert.ok(register.status === "available" && register.items.some((item) => item.workItemId === okWork.workItemId), "the executed work item is on the register");
    const permits = await readActionPermits(acme.ctx, deps);
    assert.equal(permits.status, "read");
    if (permits.status === "read") {
      const queue = buildQueue({ content: [], purposes: { status: "unavailable" } } as unknown as ApprovalsDashboardRead, [], permits.items);
      const statusOf = (permitId: string) => queue.find((q) => q.kind === "permit" && q.permit.permitId === permitId)?.status;
      assert.equal(statusOf(expiredPermit), "Authorization expired · cannot be executed", "the real expired permit is not worded as executable");
      assert.equal(statusOf(approvedPermit), "Authorized · not yet executed");
      assert.equal((await setup.query<{ status: string }>(`select status from action_permits where id = $1`, [expiredPermit])).rows[0]!.status, "active", "the stored lifecycle is untouched: expiry is read, not written");
    }

    /* 6 · FAILED EXECUTION: the work authority refuses, the spend rolls back, nothing is claimed. */
    const failed = await executeRecordWork(acme.ctx, { permitId: approvedPermit }, {
      ...(deps as object),
      recordWithin: async () => ({ status: "refused", reason: "department-unresolved" }),
    } as never);
    assert.equal(failed.status, "refused");
    const v6 = await lifecycle(approvedId);
    assert.equal(v6.permit?.state, "active", "the authorization is still the human's to spend");
    assert.equal(v6.workOutcome, null);

    /* 7 · LEGACY SPEND — executed before the link existed: the truth is "reference unavailable". */
    const legacyId = await request();
    const legacy = await executeRecordWork(acme.ctx, { permitId: await approve(legacyId) }, {
      ...(deps as object),
      recordWithin: (tx: never, tenant: TenantContext, input: { title: string }, author: never) =>
        recordWorkWithin(tx, tenant, { ...input, dischargesHandoffId: undefined }, author),
    } as never);
    assert.equal(legacy.status, "executed", JSON.stringify(legacy));
    const v7 = await lifecycle(legacyId);
    assert.deepEqual(v7.workOutcome, { status: "reference-unavailable" });
    const legacyWords = await words(legacyId);
    assert.match(legacyWords, /Execution recorded\. Work item reference unavailable\./);
    assert.ok(
      legacy.status === "executed" && legacy.outcome.status === "recorded" && !legacyWords.includes(legacy.outcome.workItem.workItemId),
      "a work item with the same title exists, and it is NOT named: no title matching",
    );

    /* 8 · CONTRADICTION — two rows claim the same spend: unknown, never the first one found. */
    const twiceId = await request();
    const twice = await execute(await approve(twiceId));
    await appendWorkAudit(twice.workItem.workItemId, { entity_id: okWork.workItemId });
    assert.deepEqual((await lifecycle(twiceId)).workOutcome, { status: "reference-unavailable" });

    /* 9 · A HUMAN-AUTHORED row naming a spend is not a governed outcome, and cannot contradict one. */
    await appendWorkAudit(okWork.workItemId, { actor_type: "human", metadata: { handoffId: ok.handoffId } });
    assert.equal((await lifecycle(okId)).workOutcome?.status, "recorded");

    /* 10 · CROSS-TENANT — another organization's row naming Acme's spend changes nothing for Acme. */
    const globexReq = await file(globex.ctx, globex.departmentRef);
    const globexRun = await execute(await approve(globexReq, globex.ctx), globex.ctx);
    await appendWorkAudit(globexRun.workItem.workItemId, { metadata: { handoffId: ok.handoffId } });
    const acmeAfter = (await lifecycle(okId)).workOutcome;
    assert.ok(acmeAfter?.status === "recorded" && acmeAfter.workItemId === okWork.workItemId, "Globex's row is not in Acme's read");
    assert.deepEqual(await readActionRequestLifecycle(globex.ctx, okId, deps), { status: "not-found" }, "Globex cannot read Acme's request");
    const globexSeam = await readGovernedWorkOutcomes(globex.ctx, [ok.handoffId], deps);
    assert.ok(globexSeam.status === "read");
    assert.notEqual(globexSeam.byHandoff.get(ok.handoffId)?.workItemId, okWork.workItemId, "Acme's work item never appears in Globex's read");

    /* 11 · CROSS-USER — another member's executed request is not in this person's list. */
    const theirsId = await request();
    await execute(await approve(theirsId));
    await setup.query(`update heby_action_requests set created_by = $2 where id = $1`, [theirsId, randomUUID()]);
    const mine = await readMyActionRequestLifecycles(acme.ctx, deps);
    assert.equal(mine.status, "read");
    assert.ok(mine.status === "read" && !mine.items.some((i) => i.requestId === theirsId), "not mine, not listed");
    const listed = mine.status === "read" ? mine.items.find((i) => i.requestId === domainId) : undefined;
    assert.deepEqual(listed?.workOutcome, v1b.workOutcome, "the list carries the same outcome as the single read");

    /* 12 · MISSING AUTHORITATIVE DATA — no tenant or no database reads nothing and names nothing. */
    assert.deepEqual(await readGovernedWorkOutcomes(null, [ok.handoffId], deps), { status: "unavailable" });
    assert.deepEqual(await readGovernedWorkOutcomes(acme.ctx, [ok.handoffId], { getDb: () => null }), { status: "unavailable" });
    assert.deepEqual(await readGovernedWorkOutcomes(acme.ctx, [], deps), { status: "read", byHandoff: new Map() });

    /* 13 · Reading is a read. */
    const before = await counts();
    for (const id of [okId, domainId, pendingId, approvedId, expiredId, rejectedId, legacyId, twiceId]) await lifecycle(id);
    await readMyActionRequestLifecycles(acme.ctx, deps);
    assert.deepEqual(await counts(), before, "reads write nothing");

    console.log("PASS heby-verified-work-outcomes work-outcomes-postgres (13 cases)");
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
