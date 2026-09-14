/*
 * RUNG 1 — A MACHINE SPENDS ONE EXACT AUTHORIZED PERMIT, against real PostgreSQL.
 *
 * WHAT THIS SUITE IS TRYING TO BREAK, in order: the arming gate, the principal's refusal to be
 * handed a tenant, the allowlist, the single-spend statement, the transaction boundary, and the
 * claim that a machine-triggered act is honestly distinguishable from a human-triggered one.
 *
 * The most important assertions here are the ones about what did NOT happen. A refusal that leaves
 * a spent permit behind would be worse than no capability at all, so every refusal below re-reads
 * the permit and the work register rather than trusting the returned reason.
 *
 * NOTHING IS MOCKED THAT DECIDES ANYTHING. The database is real, the permits are real, the agent
 * identity and its mandate are real, and the only injected dependency that changes an outcome is
 * the Director's arming switch — which has no row in this harness and would otherwise fail closed
 * for every case, including the ones that must succeed.
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
import { recordDepartment, retireDepartment } from "../../src/features/organization-authority/write-structure.server";
import { formatDepartmentRef } from "../../src/features/organization-authority/department-ref";
import {
  proposeAgentOriginatedRecordWorkAction,
  proposeRecordWorkAction,
} from "../../src/features/heby-action-inlet/record-work-proposal.server";
import { approveActionRequest } from "../../src/features/action-authorization/decide-action-request.server";
import { executeRecordWork } from "../../src/features/governed-internal-action/execute-record-work.server";
import { executeRecordWorkAsMachine } from "../../src/features/governed-machine-execution/execute-record-work-as-machine.server";
import { retireDurableAgentIdentity } from "../../src/features/agent-identity/retire-durable-agent-identity.server";
import { RECORD_WORK_ACTION_KIND } from "../../src/features/heby-action-inlet/contracts";
import { authorizeTenantMachineExecution } from "../../src/features/tenant-machine-execution-authority/authorize-tenant-machine-execution.server";
import { resolveMachineExecutionReachability } from "../../src/features/tenant-machine-execution-authority/resolve-machine-execution-reachability.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";

const NOW = new Date();
const GENESIS_JUSTIFICATION =
  "This organization establishes its founding Governance authority for the machine execution acceptance.";
const APPROVAL_JUSTIFICATION =
  "This work is real and this organization authorizes Hebun to put it on the register.";

/** The Director's switch, ARMED. Injected, because no deployment has a row for this key yet. */
const ARMED = { armed: async () => true };
/** The released default: no row, no authority, no execution. */
const DISARMED = { armed: async () => false };

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


async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_rung1_machine");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db } as never;
  /* The same deps, plus the Director's switch. `as never` keeps the released call sites terse. */
  const withSwitch = (extra: object) => ({ getDb: () => handle.db, ...extra }) as never;

  try {
    await setup.connect();

    const acme = (await seedLocalIdentity(setup, {
      companyName: "Acme",
      companySlug: "acme-rung1",
      email: "director@acme-rung1.test",
    })) as Seeded;

    const acmeCtx = contextFor(acme, await sessionRowFor(setup, acme, "aaaa"), "rung1-acme");

    await setup.query(
      `insert into genesis_nominations
         (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
          accepted_at, accepted_session_context_id, accepted_assurance_level)
       values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
      [acme.tenantId, acme.authIdentityId, acme.userId, acmeCtx.sessionContextId],
    );
    assert.equal(
      (await establishGovernanceAuthority(acmeCtx, { justification: GENESIS_JUSTIFICATION }, deps)).status,
      "established",
    );

    /*
     * ── THE RUNG 2 PREREQUISITE, SATISFIED SO THIS SUITE STILL TESTS ITS OWN PROPERTIES ──────
     *
     * Machine execution now requires TWO permissions: the deployment operator's root switch, which
     * every case below already supplies through `withSwitch`, and THIS ORGANIZATION'S OWN
     * Governance decision to participate at all.
     *
     * Without the enrolment, every case here would refuse at the new gate and this file would
     * silently stop proving what it exists to prove — the permit's single spend, the replay
     * refusal, the atomic rollback. So Acme is enrolled once, through the released writer, by the
     * same Governance authority established above. THE ABSENCE of that enrolment is proved to
     * refuse immediately below, and again in `tests/rung2-tenant-containment`.
     */
    {
      const unenrolled = await resolveMachineExecutionReachability(
        acme.tenantId,
        RECORD_WORK_ACTION_KIND,
        withSwitch(ARMED),
      );
      assert.equal(
        unenrolled.status === "refused" && unenrolled.reason,
        "tenant-not-authorized",
        "an ARMED deployment still refuses an organization that never enrolled",
      );
    }
    assert.equal(
      (
        await authorizeTenantMachineExecution(
          acmeCtx,
          {
            capabilityKey: RECORD_WORK_ACTION_KIND,
            justification:
              "Acme agrees that work it has already authorized may be delivered by machine, and I accept responsibility for that.",
            observedRevision: null,
          },
          deps,
        )
      ).status,
      "written",
      "Acme's own Governance enrolled it in machine delivery",
    );

    const dept = await recordDepartment(acmeCtx, { name: "Finance", slug: "finance" }, deps);
    assert.equal(dept.status, "recorded");
    const departmentId = dept.status === "recorded" ? dept.department.departmentId : "";
    const departmentRef = formatDepartmentRef(departmentId);

    const agent = await createDurableAgentIdentity(acmeCtx, { name: "Heby" }, deps);
    assert.equal(agent.status, "established");
    const agentId = agent.status === "established" ? agent.identity.agentId : "";
    await seedAgentMandate(setup, acme, agentId, deps, {
      tag: "rung1",
      now: NOW,
      proposalScope: ["record-work"],
    });

    const resolved = await resolveAgentProposer(acmeCtx, deps);
    assert.equal(resolved.status, "resolved");
    const proposer = resolved.status === "resolved" ? resolved.proposer : null;
    assert.ok(proposer);

    const countOf = async (table: string): Promise<number> => {
      const r = await setup.query<{ n: string }>(`select count(*)::text as n from ${table}`);
      return Number(r.rows[0]!.n);
    };
    const permitRow = async (id: string) => {
      const r = await setup.query<{ status: string; consumed_at: string | null }>(
        `select status, consumed_at from action_permits where id=$1`,
        [id],
      );
      return r.rows[0]!;
    };

    /** File an AGENT-proposed record-work request and have the Director authorize it. */
    const agentPermit = async (title: string): Promise<string> => {
      const proposal = await proposeAgentOriginatedRecordWorkAction(
        acmeCtx,
        { title, department: { kind: "department", departmentRef } },
        proposer!,
        deps,
      );
      assert.equal(proposal.status, "proposed", JSON.stringify(proposal));
      const approval = await approveActionRequest(
        acmeCtx,
        {
          requestId: proposal.status === "proposed" ? proposal.receipt.requestId : "",
          justification: APPROVAL_JUSTIFICATION,
        },
        deps,
      );
      assert.equal(approval.status, "authorized", JSON.stringify(approval));
      return approval.status === "authorized" ? approval.permitId : "";
    };

    /* ═══ 1. DISARMED REFUSES, AND READS NOTHING ═══════════════════════════ */
    {
      const permitId = await agentPermit("Disarmed must not spend this");
      const refused = await executeRecordWorkAsMachine({ permitId }, withSwitch(DISARMED));
      assert.equal(refused.status, "refused");
      assert.equal(
        refused.status === "refused" ? refused.reason : "",
        "machine-execution-disarmed",
        "the switch is read before anything else",
      );
      assert.equal((await permitRow(permitId)).status, "active", "and the authorization was not burned");
      assert.equal(await countOf("work_items"), 0, "and nothing was recorded");
    }

    /* ═══ 2. A PERMIT THAT DOES NOT EXIST ══════════════════════════════════ */
    {
      const missing = await executeRecordWorkAsMachine(
        { permitId: "00000000-0000-4000-8000-000000000000" },
        withSwitch(ARMED),
      );
      assert.equal(missing.status === "refused" && missing.reason, "permit-unresolved");
    }

    /* ═══ 3. A HUMAN-PROPOSED PERMIT IS NOT MACHINE-TRIGGERABLE ════════════
     *
     * A human who proposes an act and never returns to perform it has not asked for it to be
     * performed unattended. This is also why GIA-2 placement is unreachable from here: placement
     * has no agent-proposal seam at all, so every placement permit is human-proposed.
     * ══════════════════════════════════════════════════════════════════════ */
    let humanPermitId = "";
    {
      const proposal = await proposeRecordWorkAction(
        acmeCtx,
        { title: "A human proposed this", department: { kind: "department", departmentRef } },
        deps,
      );
      assert.equal(proposal.status, "proposed", JSON.stringify(proposal));
      const approval = await approveActionRequest(
        acmeCtx,
        {
          requestId: proposal.status === "proposed" ? proposal.receipt.requestId : "",
          justification: APPROVAL_JUSTIFICATION,
        },
        deps,
      );
      assert.equal(approval.status, "authorized");
      humanPermitId = approval.status === "authorized" ? approval.permitId : "";

      const refused = await executeRecordWorkAsMachine({ permitId: humanPermitId }, withSwitch(ARMED));
      assert.equal(refused.status === "refused" && refused.reason, "not-agent-proposed");
      assert.equal((await permitRow(humanPermitId)).status, "active", "and it stays the human's to spend");
    }

    /* ═══ 4. AN EXPIRED PERMIT IS NOT SPENDABLE ════════════════════════════ */
    {
      const permitId = await agentPermit("Expired before anyone spent it");
      /* BOTH instants move: `action_permits_expiry_after_issue_chk` forbids an expiry before issue. */
      await setup.query(
        `update action_permits
            set issued_at = now() - interval '2 hours', expires_at = now() - interval '1 minute'
          where id=$1`,
        [permitId],
      );
      const refused = await executeRecordWorkAsMachine({ permitId }, withSwitch(ARMED));
      assert.equal(refused.status === "refused" && refused.reason, "permit-not-consumable", JSON.stringify(refused));
      assert.equal((await permitRow(permitId)).status, "active", "an expired permit is refused, not consumed");
      assert.equal(await countOf("work_items"), 0);
    }

    /* ═══ 5. A DOMAIN REFUSAL LEAVES NOTHING BEHIND ════════════════════════
     * The department is retired AFTER the Director authorized the act, so the Work Authority
     * refuses inside the spend transaction. The permit must survive it.
     * ══════════════════════════════════════════════════════════════════════ */
    {
      const doomedDept = await recordDepartment(acmeCtx, { name: "Doomed", slug: "doomed" }, deps);
      assert.equal(doomedDept.status, "recorded");
      const doomedRef = formatDepartmentRef(
        doomedDept.status === "recorded" ? doomedDept.department.departmentId : "",
      );
      const proposal = await proposeAgentOriginatedRecordWorkAction(
        acmeCtx,
        { title: "Work for a department about to close", department: { kind: "department", departmentRef: doomedRef } },
        proposer!,
        deps,
      );
      assert.equal(proposal.status, "proposed", JSON.stringify(proposal));
      const approval = await approveActionRequest(
        acmeCtx,
        {
          requestId: proposal.status === "proposed" ? proposal.receipt.requestId : "",
          justification: APPROVAL_JUSTIFICATION,
        },
        deps,
      );
      assert.equal(approval.status, "authorized");
      const permitId = approval.status === "authorized" ? approval.permitId : "";

      assert.equal(
        (await retireDepartment(acmeCtx, { departmentId: doomedDept.status === "recorded" ? doomedDept.department.departmentId : "" }, deps)).status,
        "recorded",
      );

      const before = await countOf("work_items");
      const refused = await executeRecordWorkAsMachine({ permitId }, withSwitch(ARMED));
      assert.equal(refused.status === "refused" && refused.reason, "work-authority-refused");
      assert.equal((await permitRow(permitId)).status, "active", "THE SPEND ROLLED BACK WITH THE MUTATION");
      assert.equal(await countOf("work_items"), before, "and no work row exists");
    }

    /* ═══ 6. THE MACHINE EXECUTES, AND THE TRUTH IS LEGIBLE ════════════════ */
    const permitId = await agentPermit("Quarterly close, recorded unattended");
    const executed = await executeRecordWorkAsMachine({ permitId }, withSwitch(ARMED));
    assert.equal(executed.status, "executed", JSON.stringify(executed));
    if (executed.status !== "executed") throw new Error("unreachable");
    assert.equal(executed.agentId, agentId, "the trigger is the agent that originated the request");

    assert.equal((await permitRow(permitId)).status, "consumed");
    assert.ok((await permitRow(permitId)).consumed_at !== null);

    {
      const work = await setup.query<{
        tenant_id: string;
        created_by: string | null;
        created_by_type: string;
      }>(`select tenant_id, created_by, created_by_type from work_items order by created_at desc limit 1`);
      const row = work.rows[0]!;
      assert.equal(row.tenant_id, acme.tenantId, "the row landed in the permit's own tenant");
      assert.equal(row.created_by, null, "NO HUMAN IS NAMED — there was no session to correlate to");
      assert.equal(row.created_by_type, "system", "HEBUN performed it, exactly as it does for a human trigger");
    }

    {
      const audit = await setup.query<{ actor_type: string; actor_id: string; request_id: string | null }>(
        `select actor_type, actor_id, request_id from audit_log
          where entity_type='work_item' order by occurred_at desc limit 1`,
      );
      const row = audit.rows[0]!;
      assert.equal(row.actor_type, "system", "an agent PROPOSES, it never PERFORMS — the released rule holds");
      assert.equal(row.actor_id, agentId, "and the correlation names the agent, because no session existed");
      assert.equal(row.request_id, executed.invocationId, "tying the audit to the invocation that caused it");
    }

    /* ═══ 7. REPLAY ════════════════════════════════════════════════════════ */
    {
      const before = await countOf("work_items");
      const replay = await executeRecordWorkAsMachine({ permitId }, withSwitch(ARMED));
      assert.equal(replay.status === "refused" && replay.reason, "permit-not-active");
      assert.equal(await countOf("work_items"), before, "one authorization, one act");
    }

    /* ═══ 8. THE HUMAN PATH IS UNCHANGED ═══════════════════════════════════ */
    {
      const human = await executeRecordWork(acmeCtx, { permitId: humanPermitId }, deps);
      assert.equal(human.status, "executed", "the released human door still works");
      const work = await setup.query<{ created_by: string | null; created_by_type: string }>(
        `select created_by, created_by_type from work_items order by created_at desc limit 1`,
      );
      assert.equal(work.rows[0]!.created_by, acme.userId, "and still correlates to the human's session");
      assert.equal(work.rows[0]!.created_by_type, "system");
    }

    /* ═══ 9. A RETIRED AGENT'S AUTHORIZED PERMIT IS REFUSED BEFORE THE SPEND ═══
     *
     * PROVENANCE IS NOT ELIGIBILITY. The request keeps saying an agent proposed it — that is
     * history and is never rewritten. What changes is whether that principal may still act, and
     * a permit authorized while the agent was in service must not outlive the agent.
     *
     * ORDER MATTERS HERE: the permit is minted while the agent is live, exactly as a future
     * scanner would discover it, and the agent is retired only afterwards. That is the race the
     * gate exists for — eligible at discovery, retired before execution.
     */
    {
      const permitId = await agentPermit("Authorized while the agent was still in service");
      const workBefore = await countOf("work_items");

      assert.equal(
        (
          await retireDurableAgentIdentity(
            acmeCtx,
            { agentId },
            deps,
          )
        ).status,
        "retired",
        "the agent authority retired it through its own ceremony",
      );

      const refused = await executeRecordWorkAsMachine({ permitId }, withSwitch(ARMED));
      assert.equal(
        refused.status === "refused" && refused.reason,
        "agent-not-in-service",
        JSON.stringify(refused),
      );
      assert.equal(
        refused.status === "refused" ? refused.authorityReason : "",
        "not-in-service",
        "and the agent authority's own word is carried, not invented here",
      );

      assert.equal(
        (await permitRow(permitId)).status,
        "active",
        "THE PERMIT WAS NOT SPENT — the refusal happens before the spend",
      );
      assert.equal(await countOf("work_items"), workBefore, "and no work row was written");

      /* PROVENANCE SURVIVED. Retiring an agent rewrites no history. */
      const proposer = await setup.query<{ t: string; id: string }>(
        `select proposed_by_actor_type t, proposed_by_actor_id id from heby_action_requests
          order by created_at desc limit 1`,
      );
      assert.equal(proposer.rows[0]!.t, "agent", "the request still records that an agent proposed it");
      assert.equal(proposer.rows[0]!.id, agentId, "naming the same agent it always named");
    }

    console.log("rung1 machine-triggered record-work (PostgreSQL): all assertions passed");
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose?.().catch(() => {});
    await harness.dropDatabase();
  }
}

void main();
