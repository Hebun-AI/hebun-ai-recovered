/*
 * L-1a — one "in service" rule across the readers, and an approval that refuses a proposer who is
 * no longer in service. Real PostgreSQL, disposable database.
 *
 * Suspension has NO writer (L-1a adds none), so `suspended_at` and the out-of-allowlist lifecycle
 * values are set by this fixture with plain SQL — exactly the state a future writer would leave.
 * Retirement goes through the released retirement authority.
 *
 * Every refused approval is checked to have written NOTHING: no decision, no session, no permit, no
 * audit row, and the request still pending. Rejection stays open for every one of them.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { seedAgentMandate, seedGovernanceAuthority } from "../helpers/agent-mandate-seed";
import { createDurableAgentIdentity } from "../../src/features/agent-identity/create-durable-agent-identity.server";
import { retireDurableAgentIdentity } from "../../src/features/agent-identity/retire-durable-agent-identity.server";
import {
  readDurableAgentIdentityState,
  readDurableAgentRuntimeLiveness,
} from "../../src/features/agent-identity/read-durable-agent-identity.server";
import { resolveAgentProposer } from "../../src/features/action-authorization/agent-proposer.server";
import {
  approveActionRequest,
  rejectActionRequest,
} from "../../src/features/action-authorization/decide-action-request.server";
import { proposeAgentOriginatedRecordWorkAction } from "../../src/features/heby-action-inlet/record-work-proposal.server";
import { recordDepartment } from "../../src/features/organization-authority/write-structure.server";
import { setAgentPlacement } from "../../src/features/organization-authority/write-agent-placement.server";
import { readAgentPlacements } from "../../src/features/organization-authority/read-agent-placement.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";

const REGISTER = "Register this agent for the L-1a in-service proof organization.";
const APPROVE = "Approving this proposal after reviewing it for the L-1a proof.";
const REJECT = "Rejecting this proposal after reviewing it for the L-1a proof.";

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
      tag.padEnd(64, "0").slice(0, 64).replace(/[^0-9a-f]/g, "b"),
      seeded.userId,
      seeded.tenantId,
      seeded.membershipId,
    ],
  );
  return row.rows[0]!.id;
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_l1a_in_service");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  const blocker = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db } as never;

  try {
    await setup.connect();
    await blocker.connect();

    const countOf = async (table: string): Promise<number> =>
      Number((await setup.query(`select count(*)::int n from ${table}`)).rows[0]!.n);
    const snapshot = async () => ({
      decisions: await countOf("decision_records"),
      sessions: await countOf("governance_sessions"),
      permits: await countOf("action_permits"),
      audit: await countOf("audit_log"),
    });
    const requestStatus = async (id: string): Promise<string> =>
      (await setup.query<{ status: string }>(`select status from heby_action_requests where id = $1`, [id])).rows[0]!
        .status;

    /* ── SEED: two organizations, each Governance-authorized ───────────────── */
    const acme = (await seedLocalIdentity(setup, {
      companyName: "Acme",
      companySlug: "acme-l1a",
      email: "director@acme-l1a.test",
    })) as Seeded;
    const beta = (await seedLocalIdentity(setup, {
      companyName: "Beta",
      companySlug: "beta-l1a",
      email: "director@beta-l1a.test",
    })) as Seeded;
    const ctx = contextFor(acme, await sessionRowFor(setup, acme, "f1a1"), "l1a-acme");
    const betaCtx = contextFor(beta, await sessionRowFor(setup, beta, "f1b1"), "l1a-beta");

    const register = async (who: TenantContext, name: string): Promise<string> => {
      const r = await createDurableAgentIdentity(who, { name, justification: REGISTER }, deps);
      assert.equal(r.status, "established", JSON.stringify(r));
      return r.status === "established" ? r.identity.agentId : "";
    };

    /* Governance first (seedAgentMandate establishes it), so registration is admitted. */
    await seedGovernanceAuthority(setup, acme, deps, { tag: "0ac1" });
    await seedGovernanceAuthority(setup, beta, deps, { tag: "0be1" });

    const agentIds: Record<string, string> = {};
    for (const [index, name] of ["Ada", "Bram", "Cleo", "Dara", "Ezra"].entries()) {
      agentIds[name] = await register(ctx, name);
      await seedAgentMandate(setup, acme, agentIds[name]!, deps, { tag: `d${index}e${index}`, proposalScope: ["record-work"] });
    }
    const betaAgent = await register(betaCtx, "Foreign");

    let seq = 0;
    const propose = async (agentName: string): Promise<string> => {
      const resolved = await resolveAgentProposer(ctx, deps, { agentId: agentIds[agentName]! });
      assert.equal(resolved.status, "resolved", JSON.stringify(resolved));
      const proposer = resolved.status === "resolved" ? resolved.proposer : null;
      const proposal = await proposeAgentOriginatedRecordWorkAction(
        ctx,
        {
          title: `L-1a proof work ${++seq} by ${agentName}`,
          department: { kind: "organization-level" },
          workScope: { kind: "organization" },
        },
        proposer!,
        deps,
      );
      assert.equal(proposal.status, "proposed", JSON.stringify(proposal));
      return proposal.status === "proposed" ? proposal.receipt.requestId : "";
    };
    const approve = (requestId: string) => approveActionRequest(ctx, { requestId, justification: APPROVE }, deps);
    const reject = (requestId: string) =>
      rejectActionRequest(ctx, { requestId, justification: REJECT, rejectionReason: "Not this one." }, deps);

    /** A refused approval writes nothing and leaves the request pending. The reason comes first. */
    const approvalRefused = async (requestId: string, why: string): Promise<void> => {
      const before = await snapshot();
      const r = await approve(requestId);
      assert.equal(r.status === "refused" ? r.reason : `AUTHORIZED:${JSON.stringify(r)}`, "proposing-agent-not-in-service", why);
      assert.deepEqual(await snapshot(), before, `${why} — and writes no decision, session, permit or audit row`);
      assert.equal(await requestStatus(requestId), "pending", `${why} — and the request stays pending`);
    };
    const rejectionStillWorks = async (requestId: string, why: string): Promise<void> => {
      const r = await reject(requestId);
      assert.equal(r.status, "rejected", `${why}: ${JSON.stringify(r)}`);
      assert.equal(await requestStatus(requestId), "rejected");
    };
    const servingOf = async (agentId: string): Promise<boolean | undefined> => {
      const state = await readDurableAgentIdentityState(ctx, deps);
      assert.equal(state.status, "known");
      return state.status === "known" ? state.identities.find((i) => i.agentId === agentId)?.inService : undefined;
    };
    const setRow = (agentId: string, assignment: string) =>
      setup.query(`update agents set ${assignment} where id = $1`, [agentId]);

    /* ── (1) ACTIVE — NULL lifecycle and explicit 'active' are in service; approval issues a permit ── */
    assert.equal(await servingOf(agentIds.Ada!), true, "a freshly registered agent (NULL lifecycle) is in service");
    assert.equal(await readDurableAgentRuntimeLiveness(acme.tenantId, agentIds.Ada!, deps), "in-service");
    const adaRequest = await propose("Ada");
    const permitsBefore = await countOf("action_permits");
    const approved = await approve(adaRequest);
    assert.equal(approved.status, "authorized", JSON.stringify(approved));
    assert.equal(await countOf("action_permits"), permitsBefore + 1, "an in-service proposer's approval mints its permit");

    await setRow(agentIds.Ada!, `agent_lifecycle_status = 'active'`);
    assert.equal(await servingOf(agentIds.Ada!), true, "explicit 'active' is in service");
    assert.equal(await readDurableAgentRuntimeLiveness(acme.tenantId, agentIds.Ada!, deps), "in-service");
    const adaSecond = await propose("Ada");
    assert.equal((await approve(adaSecond)).status, "authorized", "and approval still works for it");

    /* ── (2) SUSPENDED — suspended_at alone takes an agent out of service everywhere ── */
    const bramRequest = await propose("Bram");
    await setRow(agentIds.Bram!, `suspended_at = now()`);
    assert.equal(await servingOf(agentIds.Bram!), false, "suspended_at → not in service (identity reader)");
    assert.equal(
      await readDurableAgentRuntimeLiveness(acme.tenantId, agentIds.Bram!, deps),
      "not-in-service",
      "suspended_at → not in service (runtime liveness)",
    );
    const bramSelect = await resolveAgentProposer(ctx, deps, { agentId: agentIds.Bram! });
    assert.equal(bramSelect.status, "refused", "a suspended agent cannot be selected as a proposer");
    await approvalRefused(bramRequest, "a suspended proposer's request cannot be approved");
    await rejectionStillWorks(bramRequest, "a suspended proposer's request can still be rejected");

    /* ── (3) A LIFECYCLE VALUE WITH NO WRITER — 'paused' was in service under the old rule ── */
    const cleoRequest = await propose("Cleo");
    await setRow(agentIds.Cleo!, `agent_lifecycle_status = 'paused'`);
    assert.equal(await servingOf(agentIds.Cleo!), false, "'paused' is out of the allowlist");
    assert.equal(await readDurableAgentRuntimeLiveness(acme.tenantId, agentIds.Cleo!, deps), "not-in-service");
    await approvalRefused(cleoRequest, "a paused proposer's request cannot be approved");

    /* ── (4) RETIRED — through the released retirement authority ── */
    const daraRequest = await propose("Dara");
    const retired = await retireDurableAgentIdentity(ctx, { agentId: agentIds.Dara!, justification: "Retiring this agent for the test organization (L-1b requires a reason)." }, deps);
    assert.equal(retired.status, "retired", JSON.stringify(retired));
    assert.equal(await servingOf(agentIds.Dara!), false);
    assert.equal(await readDurableAgentRuntimeLiveness(acme.tenantId, agentIds.Dara!, deps), "not-in-service");
    await approvalRefused(daraRequest, "a retired proposer's request cannot be approved");
    await rejectionStillWorks(daraRequest, "a retired proposer's request can still be rejected");

    /* ── (5) TENANT ISOLATION — another organization's agent is unknown here, never in service ── */
    assert.equal(
      await readDurableAgentRuntimeLiveness(acme.tenantId, betaAgent, deps),
      "unknown-agent",
      "Beta's in-service agent does not resolve inside Acme",
    );
    assert.equal(await readDurableAgentRuntimeLiveness(beta.tenantId, betaAgent, deps), "in-service");
    const forged = await propose("Ezra");
    await setup.query(`update heby_action_requests set proposed_by_actor_id = $2 where id = $1`, [forged, betaAgent]);
    await approvalRefused(forged, "a request naming another organization's agent cannot be approved");
    await setup.query(`update heby_action_requests set proposed_by_actor_id = $2 where id = $1`, [forged, agentIds.Ezra!]);

    /* ── (6) CONCURRENCY — a retirement holding the agent row blocks approval; approval then refuses ── */
    const ezraRequest = forged;
    await blocker.query("begin");
    await blocker.query(`select id from agents where id = $1 for update`, [agentIds.Ezra!]);
    await blocker.query(
      `update agents set retired_at = now(), agent_lifecycle_status = 'retired' where id = $1`,
      [agentIds.Ezra!],
    );
    const before = await snapshot();
    let settled = false;
    const pendingApproval = approve(ezraRequest).then((r) => {
      settled = true;
      return r;
    });
    await new Promise((resolve) => setTimeout(resolve, 400));
    assert.equal(settled, false, "approval waits on the agent row a retirement holds FOR UPDATE");
    await blocker.query("commit");
    const raced = await pendingApproval;
    assert.equal(raced.status === "refused" ? raced.reason : "AUTHORIZED", "proposing-agent-not-in-service",
      "once the retirement commits, the waiting approval sees it and refuses");
    assert.deepEqual(await snapshot(), before, "and the raced approval wrote nothing");
    assert.equal(await requestStatus(ezraRequest), "pending");

    /* The other order: an approval's FOR SHARE hold makes a retirement wait. */
    await setRow(agentIds.Ada!, `agent_lifecycle_status = null`);
    await blocker.query("begin");
    await blocker.query(`select id from agents where id = $1 for share`, [agentIds.Ada!]);
    let retireSettled = false;
    const pendingRetire = retireDurableAgentIdentity(ctx, { agentId: agentIds.Ada!, justification: "Retiring this agent for the test organization (L-1b requires a reason)." }, deps).then((r) => {
      retireSettled = true;
      return r;
    });
    await new Promise((resolve) => setTimeout(resolve, 400));
    assert.equal(retireSettled, false, "retirement waits while an approval holds the agent row FOR SHARE");
    await blocker.query("commit");
    assert.equal((await pendingRetire).status, "retired");

    /* ── (7) ALIGNMENT — placement asks the same rule ── */
    const dept = await recordDepartment(ctx, { name: "Operations", slug: "operations" }, deps);
    assert.equal(dept.status, "recorded");
    const departmentId = dept.status === "recorded" ? dept.department.departmentId : "";
    const placeBram = await setAgentPlacement(ctx, { agentId: agentIds.Bram!, departmentId, expectedDepartmentId: null }, deps);
    assert.equal(placeBram.status === "refused" ? placeBram.reason : "PLACED", "agent-retired",
      "a suspended agent cannot be placed (placement writer uses the shared rule)");
    const placements = await readAgentPlacements(ctx, deps);
    assert.equal(placements.status, "available");
    if (placements.status === "available") {
      const cleo = placements.placements.find((p) => p.agentId === agentIds.Cleo!);
      assert.equal(cleo?.agentInService, false, "the placement reader agrees: 'paused' is not in service");
    }

    console.log("l1a in-service postgres: ok");
  } finally {
    await blocker.end().catch(() => {});
    await setup.end().catch(() => {});
    await handle.dispose?.().catch(() => {});
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
