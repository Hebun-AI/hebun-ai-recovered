/*
 * HEBY-REQUEST-LIFECYCLE — what happened to one filed request, read back through the released rows.
 * Real Postgres, real released writers (propose → approve/reject → executeRecordWork / revoke).
 *
 *   - every state the rows can be in reads back as that state, and the Heby wording says no more;
 *   - another organization's request, an invented id and a non-id all read as `not-found`;
 *   - no session tenant → unavailable;
 *   - reading writes nothing and reaches no provider;
 *   - a rejection reason (Governance text) is never projected.
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
import { resolveAgentProposer } from "../../src/features/action-authorization/agent-proposer.server";
import { recordDepartment } from "../../src/features/organization-authority/write-structure.server";
import { formatDepartmentRef } from "../../src/features/organization-authority/department-ref";
import {
  proposeAgentOriginatedRecordWorkAction,
  proposeRecordWorkAction,
} from "../../src/features/heby-action-inlet/record-work-proposal.server";
import { approveActionRequest, rejectActionRequest } from "../../src/features/action-authorization/decide-action-request.server";
import { revokeActionPermit } from "../../src/features/action-authorization/revoke-action-permit.server";
import { executeRecordWork } from "../../src/features/governed-internal-action/execute-record-work.server";
import {
  MY_ACTION_REQUESTS_LIMIT,
  readActionRequestLifecycle,
  readMyActionRequestLifecycles,
} from "../../src/features/action-authorization/read-action-authorizations.server";
import { describeRequestLifecycle } from "../../src/components/layout/heby/heby-origination-affordance";
import { asHumanTenantContext, type TenantContext } from "../../src/features/auth/tenant/tenant-context";

const GENESIS = "This organization establishes its founding Governance authority for the lifecycle proof.";
const JUSTIFY = "Decided for the Heby request lifecycle proof, recorded by the Director.";
const SECRET_REASON = "lifecycle-secret-rejection-reason";

type Seeded = Awaited<ReturnType<typeof seedLocalIdentity>>;

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_heby_request_lifecycle");
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
    await seedAgentMandate(setup, org, agentId, deps, { tag: `${slug}1`, proposalScope: ["record-work"] });
    return { ctx, departmentRef };
  };

  const authorityCounts = async () =>
    (
      await setup.query(
        `select (select count(*) from heby_action_requests)::int r, (select count(*) from action_permits)::int p,
                (select count(*) from decision_records)::int d, (select count(*) from work_items)::int w,
                (select count(*) from audit_log)::int a, (select count(*) from action_execution_attempts)::int x`,
      )
    ).rows[0];

  try {
    const acme = await organization("lifecycle-acme", "a");
    const globex = await organization("lifecycle-globex", "b");
    const resolved = await resolveAgentProposer(acme.ctx, deps);
    assert.equal(resolved.status, "resolved");
    const proposer = resolved.status === "resolved" ? resolved.proposer : null;

    let seq = 0;
    const work = () => ({
      workScope: { kind: "organization" as const },
      title: `Lifecycle work ${++seq}`,
      department: { kind: "department" as const, departmentRef: acme.departmentRef },
    });
    const agentRequest = async () => {
      const p = await proposeAgentOriginatedRecordWorkAction(acme.ctx, work(), proposer!, deps);
      assert.equal(p.status, "proposed", JSON.stringify(p));
      return p.status === "proposed" ? p.receipt.requestId : "";
    };
    const humanRequest = async () => {
      const p = await proposeRecordWorkAction(acme.ctx, work(), deps);
      assert.equal(p.status, "proposed", JSON.stringify(p));
      return p.status === "proposed" ? p.receipt.requestId : "";
    };
    const approve = async (requestId: string) => {
      const a = await approveActionRequest(acme.ctx, { requestId, justification: JUSTIFY }, deps);
      assert.equal(a.status, "authorized", JSON.stringify(a));
      return a.status === "authorized" ? a.permitId : "";
    };
    const read = async (requestId: string, ctx: TenantContext | null = acme.ctx) =>
      readActionRequestLifecycle(ctx, requestId, deps);
    const lifecycle = async (requestId: string) => {
      const r = await read(requestId);
      assert.equal(r.status, "read", JSON.stringify(r));
      return r.status === "read" ? r.lifecycle : (null as never);
    };
    const words = async (requestId: string) => describeRequestLifecycle(await lifecycle(requestId)).join(" ");

    /* 1 · pending, agent-proposed. */
    const pending = await agentRequest();
    const v1 = await lifecycle(pending);
    assert.equal(v1.requestId, pending);
    assert.equal(v1.proposedByActorType, "agent");
    assert.deepEqual(v1.decision, { status: "pending" });
    assert.equal(v1.permit, null);
    assert.equal(v1.execution, null);
    assert.match(await words(pending), /by an agent\..*Waiting for a human decision/);

    /* 2 · approved, permit active, nothing executed. */
    const approvedId = await agentRequest();
    const permitId = await approve(approvedId);
    const v2 = await lifecycle(approvedId);
    assert.equal(v2.decision.status, "approved");
    assert.equal(v2.decision.status === "approved" && v2.decision.standing, false, "a human decided this one");
    assert.equal(v2.permit?.state, "active");
    assert.match(await words(approvedId), /Approved .* by a human decision\. Authorized and not yet executed\./);

    /* 3 · executed through the released internal door → consumed; the wording says executed. */
    const executed = await executeRecordWork(acme.ctx, { permitId }, deps);
    assert.equal(executed.status, "executed", JSON.stringify(executed));
    const v3 = await lifecycle(approvedId);
    assert.equal(v3.permit?.state, "consumed");
    assert.ok(v3.permit?.consumedAt);
    assert.equal(v3.execution, null, "an internal act has no external attempt row");
    assert.match(await words(approvedId), /Executed .*the change is recorded\./);

    /* 4 · rejected; the reason is never projected. */
    const rejectedId = await humanRequest();
    const rej = await rejectActionRequest(acme.ctx, { requestId: rejectedId, justification: JUSTIFY, rejectionReason: SECRET_REASON }, deps);
    assert.equal(rej.status, "rejected", JSON.stringify(rej));
    const v4 = await lifecycle(rejectedId);
    assert.equal(v4.decision.status, "rejected");
    assert.equal(v4.proposedByActorType, "human");
    assert.ok(!JSON.stringify(v4).includes(SECRET_REASON), "the Governance reason is not in the read");
    assert.match(await words(rejectedId), /by a person\..*Rejected .*Nothing will be executed\./);

    /* 5 · revoked. */
    const revokedId = await agentRequest();
    const revokedPermit = await approve(revokedId);
    const rv = await revokeActionPermit(acme.ctx, { permitId: revokedPermit, justification: JUSTIFY, revocationReason: SECRET_REASON }, deps);
    assert.equal(rv.status, "revoked", JSON.stringify(rv));
    assert.equal((await lifecycle(revokedId)).permit?.state, "revoked");
    assert.ok(!JSON.stringify(await read(revokedId)).includes(SECRET_REASON), "the revocation reason is not in the read");
    assert.match(await words(revokedId), /revoked .*Nothing was executed under it\./);

    /* 6 · expired (derived from the clock, never stored). */
    const expiredId = await agentRequest();
    const expiredPermit = await approve(expiredId);
    await setup.query(`update action_permits set issued_at = now() - interval '2 hours', expires_at = now() - interval '1 hour' where id = $1`, [expiredPermit]);
    assert.equal((await lifecycle(expiredId)).permit?.state, "expired");
    assert.match(await words(expiredId), /expired .* without being used\. Nothing was executed\./);

    /* 7 · tenant isolation and malformed input: indistinguishable not-found. */
    assert.deepEqual(await read(pending, globex.ctx), { status: "not-found" }, "another organization cannot read it");
    assert.deepEqual(await read(randomUUID()), { status: "not-found" });
    assert.deepEqual(await read("not-an-id"), { status: "not-found" });
    assert.deepEqual(await read(undefined as never), { status: "not-found" });
    assert.equal((await read(pending, null)).status, "unavailable", "no session tenant reads nothing");

    /* 7b · HEBY-MY-REQUESTS — this person's own requests, newest first, each with its lifecycle. */
    const mine = async (ctx: TenantContext | null = acme.ctx) => {
      const r = await readMyActionRequestLifecycles(ctx, deps);
      assert.equal(r.status, "read", JSON.stringify(r));
      return r.status === "read" ? r : (null as never);
    };
    const filed = [pending, approvedId, rejectedId, revokedId, expiredId];
    const m1 = await mine();
    assert.deepEqual(new Set(m1.items.map((i) => i.requestId)), new Set(filed), "human and agent proposals this person asked for");
    assert.equal(m1.more, false);
    for (let i = 1; i < m1.items.length; i += 1) {
      assert.ok(m1.items[i - 1]!.proposedAt >= m1.items[i]!.proposedAt, "newest first");
    }
    const byId = new Map(m1.items.map((i) => [i.requestId, i]));
    assert.equal(byId.get(approvedId)!.permit?.state, "consumed", "the list carries the same lifecycle as the single read");
    assert.deepEqual(byId.get(approvedId), (await lifecycle(approvedId)), "list item == single read, field for field");
    assert.match(byId.get(pending)!.label, /^Lifecycle work \d+ · Finance$/, "labelled by the recorded title and target");
    assert.ok(!JSON.stringify(m1).includes(SECRET_REASON), "no Governance reason in the list");
    /* Another member of the SAME organization filed this one: it is theirs, not this person's. */
    const theirs = await humanRequest();
    await setup.query(`update heby_action_requests set created_by = $2 where id = $1`, [theirs, randomUUID()]);
    assert.ok(!(await mine()).items.some((i) => i.requestId === theirs), "another member's request is not listed");
    assert.equal((await read(theirs)).status, "read", "(it stays readable by id inside the tenant, as before)");
    assert.equal((await mine(globex.ctx)).items.length, 0, "another organization lists none of these");
    assert.equal((await readMyActionRequestLifecycles(null, deps)).status, "unavailable", "no session reads nothing");
    /* The window: at most MY_ACTION_REQUESTS_LIMIT, and it says when there are more. */
    while ((await mine()).items.length < MY_ACTION_REQUESTS_LIMIT) await humanRequest();
    assert.equal((await mine()).more, false, "exactly the limit is not 'more'");
    const newest = await humanRequest();
    const m2 = await mine();
    assert.equal(m2.items.length, MY_ACTION_REQUESTS_LIMIT);
    assert.equal(m2.more, true, "one past the limit is reported, never silently dropped");
    assert.equal(m2.items[0]!.requestId, newest, "the newest is first");

    /* 8 · reading is a read: nothing moves, no provider is reached. */
    const before = await authorityCounts();
    for (const id of [pending, approvedId, rejectedId, revokedId, expiredId]) await read(id);
    await read(pending, globex.ctx);
    await mine();
    await mine(globex.ctx);
    assert.deepEqual(await authorityCounts(), before, "reads write nothing");
    assert.equal(fetches, 0, "no network call");

    console.log("PASS heby-request-lifecycle lifecycle-postgres (9 cases)");
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
