/*
 * APF-1 — AGENT CONTAINMENT CLOSURE, against a REAL PostgreSQL.
 *
 * WHAT THIS FILE PROVES:
 *
 *   "Every human-controlled stop — mandate withdrawal, agent retirement, organization suspension,
 *    the machine root control and envelope withdrawal — refuses at standing ISSUANCE, and the ones
 *    that can change after a permit exists refuse again at machine DELIVERY. A standing-issued
 *    permit is audited in the same transaction that mints it, naming the human who signed the
 *    envelope and the standing decision. Creating and retiring the durable agent needs the
 *    organization's Governance authority. Nothing crosses a tenant."
 *
 * Every row comes from the released writer that owns it, except the fixtures that have no writer
 * here: the session context, the genesis nomination, the evidence shape on a proposal (the same
 * fixture RUNG 2's issuance suite states), a tenant's lifecycle status, and one LEGACY agent row
 * owned by a human without Governance — a state APF-1 makes unreachable for new agents.
 *
 * `PREPARED != AUTHORIZED != EXECUTED`: every refusal below is asserted to leave the permit still
 * `active` and the work register unchanged.
 */
import assert from "node:assert/strict";
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
import { proposeAgentOriginatedRecordWorkAction } from "../../src/features/heby-action-inlet/record-work-proposal.server";
import { authorizeTenantMachineExecution } from "../../src/features/tenant-machine-execution-authority/authorize-tenant-machine-execution.server";
import { writeStandingMutationAuthorization } from "../../src/features/standing-mutation-authority/authorize-standing-mutation.server";
import { issuePermitUnderStandingAuthorization } from "../../src/features/standing-mutation-authority/issue-permit-under-standing-authorization.server";
import { executeRecordWorkAsMachine } from "../../src/features/governed-machine-execution/execute-record-work-as-machine.server";
import { readEffectiveAgentMandateForRuntime } from "../../src/features/agent-mandate/read-agent-mandate.server";
import { ACTION_AUDIT_APPROVED, ACTION_AUDIT_PERMIT_ISSUED } from "../../src/features/action-authorization/contracts";
import { RECORD_WORK_ACTION_KIND } from "../../src/features/heby-action-inlet/contracts";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";

const GENESIS = "This organization establishes its founding Governance authority for the APF-1 proof.";
const ENROLMENT = "This organization agrees its authorized work may be delivered by machine.";
const ENVELOPE = "This organization authorizes its agent to record evidenced work without a click each.";
const ARMED = async (): Promise<boolean> => true;
const DISARMED = async (): Promise<boolean> => false;

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

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_apf1_containment");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db } as never;
  const getDb = () => handle.db;

  try {
    await setup.connect();
    /* The database's own clock — the spend compares `expires_at > now()` there. */
    let clock = new Date((await setup.query<{ now: Date }>(`select now() as now`)).rows[0]!.now);
    /* Every issuance advances past the envelope's one-minute cadence floor. */
    const tick = (): Date => (clock = new Date(clock.getTime() + 120_000));

    const countOf = async (table: string): Promise<number> =>
      Number((await setup.query(`select count(*)::int n from ${table}`)).rows[0]!.n);
    const permitStatus = async (permitId: string): Promise<string> =>
      (await setup.query<{ status: string }>(`select status from action_permits where id = $1`, [permitId]))
        .rows[0]!.status;
    const setTenantStatus = (tenantId: string, status: string) =>
      setup.query(`update companies set tenant_status = $2 where id = $1`, [tenantId, status]);

    /* ── SEED: ACME — Governance, enrolment, department, agent, mandate, envelope ── */

    const acme = (await seedLocalIdentity(setup, {
      companyName: "Acme",
      companySlug: "acme-apf1",
      email: "director@acme-apf1.test",
    })) as Seeded;
    const ctx = contextFor(acme, await sessionRowFor(setup, acme, "a1"), "apf1-acme");

    /* (13, pre-Governance) No Governance exists yet: creating the agent is refused, writing nothing. */
    const beforeGovernance = await createDurableAgentIdentity(ctx, { name: "Heby", justification: "Register this agent for the test organization." }, deps);
    assert.deepEqual(
      beforeGovernance,
      { status: "refused", reason: "no-governance-authority" },
      "an organization with no Governance authority cannot create its agent",
    );
    assert.equal(await countOf("agents"), 0, "the refused ceremony wrote no agent row");

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

    /* (13) A live human of this organization who does NOT hold its Governance authority. */
    const outsider = (
      await setup.query<{ id: string }>(
        `insert into users (email, name) values ('member@acme-apf1.test', 'Member') returning id`,
      )
    ).rows[0]!.id;
    const outsiderCtx = contextFor(acme, ctx.sessionContextId, "apf1-outsider", outsider);
    assert.deepEqual(
      await createDurableAgentIdentity(outsiderCtx, { name: "Squatter", justification: "Register this agent for the test organization." }, deps),
      { status: "refused", reason: "not-the-governance-authority" },
      "an authenticated member without Governance authority cannot create the organization's agent",
    );
    assert.equal(await countOf("agents"), 0, "and the one-shot was NOT spent by that attempt");

    /* (12) The Governance-authorized human creates it. */
    const agent = await createDurableAgentIdentity(ctx, { name: "Heby", justification: "Register this agent for the test organization." }, deps);
    assert.equal(agent.status, "established", JSON.stringify(agent));
    const agentId = agent.status === "established" ? agent.identity.agentId : "";

    let mandate = await seedAgentMandate(setup, acme, agentId, deps, {
      tag: "apf1m1",
      proposalScope: ["record-work"],
    });
    const resolved = await resolveAgentProposer(ctx, deps);
    assert.equal(resolved.status, "resolved");
    const proposer = resolved.status === "resolved" ? resolved.proposer : null;

    const envelope = await writeStandingMutationAuthorization(
      ctx,
      "active",
      {
        agentId,
        actionKind: RECORD_WORK_ACTION_KIND,
        notBefore: new Date(clock.getTime() - 60_000),
        notAfter: new Date(clock.getTime() + 86_400_000),
        maxActs: 50,
        minIntervalMinutes: 1,
        justification: ENVELOPE,
        observedRevision: null,
      },
      deps,
    );
    assert.equal(envelope.status, "written", JSON.stringify(envelope));
    const envelopeDecision = envelope.status === "written" ? envelope.governanceDecisionId : "";

    let evidenceSeq = 0;
    const propose = async (title: string): Promise<string> => {
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
          { sourceClass: "provider-observations", recordRef: `obs/apf1-${++evidenceSeq}`, lifecycle: "settled" },
        ]),
      ]);
      return requestId;
    };
    const issue = (requestId: string, armed = ARMED) =>
      issuePermitUnderStandingAuthorization({ requestId }, { getDb, now: () => tick(), armed });
    const deliver = (permitId: string, armed = ARMED) => executeRecordWorkAsMachine({ permitId }, { getDb, armed });
    const issued = async (requestId: string): Promise<string> => {
      const r = await issue(requestId);
      assert.equal(r.status, "issued", JSON.stringify(r));
      return r.status === "issued" ? r.permitId : "";
    };
    /** A refused issuance writes NOTHING: no permit, no audit row. The reason is asserted FIRST. */
    const issueRefused = async (requestId: string, expected: string, why: string, armed = ARMED) => {
      const [permits, audits] = [await countOf("action_permits"), await countOf("audit_log")];
      const r = await issue(requestId, armed);
      assert.equal(r.status === "refused" ? r.reason : `ISSUED:${r.permitId}`, expected, why);
      assert.equal(await countOf("action_permits"), permits, `${why} — and mints no permit`);
      assert.equal(await countOf("audit_log"), audits, `${why} — and writes no audit row`);
    };
    /** A refused delivery spends nothing. The reason is asserted FIRST. */
    const deliveryRefused = async (permitId: string, expected: string, why: string, armed = ARMED) => {
      const work = await countOf("work_items");
      const r = await deliver(permitId, armed);
      assert.equal(
        r.status === "refused" ? `${r.reason}${r.authorityReason ? `:${r.authorityReason}` : ""}` : "EXECUTED",
        expected,
        why,
      );
      assert.equal(await permitStatus(permitId), "active", `${why} — and leaves the permit unspent`);
      assert.equal(await countOf("work_items"), work, `${why} — and records no work`);
    };

    /* ── (1) EVERY AUTHORITY PERMITS → issued, audited, and deliverable ─────── */

    const okRequest = await propose("Everything permits this act");
    const okPermit = await issued(okRequest);

    /* (11) THE AUDIT EVENT — exactly one, truthful, in the permit's transaction. */
    const audit = await setup.query<{
      action: string;
      actor_type: string;
      actor_id: string;
      entity_type: string;
      result: string;
      metadata: Record<string, unknown>;
    }>(`select action, actor_type, actor_id, entity_type, result, metadata from audit_log where entity_id = $1`, [
      okPermit,
    ]);
    assert.equal(audit.rowCount, 1, "exactly one audit event names the standing-issued permit");
    const event = audit.rows[0]!;
    assert.equal(event.action, ACTION_AUDIT_PERMIT_ISSUED);
    assert.equal(event.result, "committed");
    assert.equal(event.actor_type, "human", "no machine actor is invented");
    assert.equal(event.actor_id, acme.userId, "the actor is the human who signed the envelope");
    assert.equal(event.metadata.governanceDecisionId, envelopeDecision, "it names the STANDING decision");
    assert.equal(event.metadata.actionRequestId, okRequest);
    assert.equal(event.metadata.executed, false, "issuing is not executing");
    const permitRow = (
      await setup.query<{ authorized_by_actor_id: string; standing_authorization_id: string | null }>(
        `select authorized_by_actor_id, standing_authorization_id from action_permits where id = $1`,
        [okPermit],
      )
    ).rows[0]!;
    assert.equal(event.actor_id, permitRow.authorized_by_actor_id, "audit and permit name the same human");
    assert.ok(permitRow.standing_authorization_id, "the envelope provenance lives on the permit the event names");
    assert.equal(
      (
        await setup.query(`select 1 from audit_log where action = $1 and entity_id = $2`, [
          ACTION_AUDIT_APPROVED,
          okRequest,
        ])
      ).rowCount,
      0,
      "no per-act `approved` event is fabricated — no human deliberated this act",
    );

    const workBefore = await countOf("work_items");
    const executed = await deliver(okPermit);
    assert.equal(executed.status, "executed", JSON.stringify(executed));
    assert.equal(await countOf("work_items"), workBefore + 1, "the all-clear permit is delivered and recorded");

    /* ── (8) / (9) THE MACHINE ROOT CONTROL ─────────────────────────────────── */

    await issueRefused(await propose("Issued while disarmed"), "machine-execution-disarmed", "a disarmed deployment gets no permits minted for it", DISARMED);
    const disarmPermit = await issued(await propose("Disarmed after issuance"));
    await deliveryRefused(disarmPermit, "machine-execution-disarmed", "disarming after issuance stops delivery", DISARMED);

    /* ── (6) / (7) THE ORGANIZATION'S OWN LIFECYCLE ─────────────────────────── */

    const suspendedPermit = await issued(await propose("Suspended after issuance"));
    const suspendedRequest = await propose("Issued while suspended");
    await setTenantStatus(acme.tenantId, "suspended");
    await issueRefused(suspendedRequest, "tenant-not-active", "a suspended organization gets no permits minted for it");
    await deliveryRefused(suspendedPermit, "machine-execution-not-reachable:tenant-not-active", "suspending after issuance stops delivery");
    await setTenantStatus(acme.tenantId, "deleting");
    await issueRefused(suspendedRequest, "tenant-not-active", "any non-active lifecycle refuses");
    await setTenantStatus(acme.tenantId, "active");

    /* ── (2) / (3) THE MANDATE ──────────────────────────────────────────────── */

    const mandatePermit = await issued(await propose("Mandate withdrawn after issuance"));
    const mandateRequest = await propose("Issued after the mandate is withdrawn");
    mandate = await seedAgentMandate(setup, acme, agentId, deps, {
      tag: "apf1m2",
      proposalScope: [],
      observedMandateRevision: mandate.mandateRevision,
    });
    await issueRefused(mandateRequest, "action-outside-agent-mandate", "a withdrawn mandate refuses issuance even for a proposal filed while it admitted the act");
    await deliveryRefused(mandatePermit, "agent-mandate-refused:action-outside-agent-mandate", "withdrawing the mandate after issuance stops delivery — AUTHORIZED != STILL PERMITTED");
    /* An unreadable ceiling is never a permissive one. */
    const unreadable = await issuePermitUnderStandingAuthorization(
      { requestId: mandateRequest },
      {
        getDb,
        now: () => tick(),
        armed: ARMED,
        readMandate: async () => ({ status: "unavailable", reason: "read-failed" }),
      },
    );
    assert.equal(unreadable.status === "refused" && unreadable.reason, "agent-mandate-authority-unavailable");
    const unreadableDelivery = await executeRecordWorkAsMachine(
      { permitId: mandatePermit },
      { getDb, armed: ARMED, readMandate: async () => ({ status: "unavailable", reason: "read-failed" }) },
    );
    assert.equal(
      unreadableDelivery.status === "refused" && unreadableDelivery.authorityReason,
      "agent-mandate-authority-unavailable",
    );
    await seedAgentMandate(setup, acme, agentId, deps, {
      tag: "apf1m3",
      proposalScope: ["record-work"],
      observedMandateRevision: mandate.mandateRevision,
    });
    assert.equal(
      (await deliver(mandatePermit)).status,
      "executed",
      "the gate reads the EFFECTIVE mandate: restored, the same still-active permit is deliverable",
    );

    /* ── (14) NOTHING CROSSES A TENANT ──────────────────────────────────────── */

    const globex = (await seedLocalIdentity(setup, {
      companyName: "Globex",
      companySlug: "globex-apf1",
      email: "director@globex-apf1.test",
    })) as Seeded;
    const globexCtx = contextFor(globex, await sessionRowFor(setup, globex, "b1"), "apf1-globex");
    const crossRead = await readEffectiveAgentMandateForRuntime(globex.tenantId, agentId, deps);
    assert.deepEqual(
      crossRead,
      { status: "known", mandate: null },
      "Acme's agent read under Globex's tenant has no mandate — it fails closed, it does not cross",
    );
    assert.deepEqual(
      await retireDurableAgentIdentity(globexCtx, { agentId }, deps),
      { status: "refused", reason: "agent-identity-not-found" },
      "another organization's human cannot even locate Acme's agent",
    );
    await setTenantStatus(globex.tenantId, "suspended");
    assert.equal(
      (await issue(await propose("Another tenant's suspension is not ours"))).status,
      "issued",
      "suspending Globex does not stop Acme",
    );

    /* A LEGACY Globex agent owned by a human with no Governance — the pre-APF-1 squat state. */
    await setTenantStatus(globex.tenantId, "active");
    const legacyAgent = (
      await setup.query<{ id: string }>(
        `insert into agents (tenant_id, name, human_owner_type, human_owner_id, created_by, created_by_type)
         values ($1, 'Legacy', 'human', $2, $2, 'human') returning id`,
        [globex.tenantId, globex.userId],
      )
    ).rows[0]!.id;
    assert.deepEqual(
      await retireDurableAgentIdentity(globexCtx, { agentId: legacyAgent }, deps),
      { status: "refused", reason: "no-governance-authority" },
      "(13) owning an agent is no longer enough to retire it: Governance authority is also required",
    );

    /* ── (10) THE ENVELOPE ITSELF ───────────────────────────────────────────── */

    const withdrawn = await writeStandingMutationAuthorization(
      ctx,
      "withdrawn",
      {
        agentId,
        actionKind: RECORD_WORK_ACTION_KIND,
        notBefore: new Date(clock.getTime() - 60_000),
        notAfter: new Date(clock.getTime() + 86_400_000),
        maxActs: 50,
        minIntervalMinutes: 1,
        justification: "This organization takes the standing authorization back.",
        observedRevision: 1,
      },
      deps,
    );
    assert.equal(withdrawn.status, "written", JSON.stringify(withdrawn));
    const envelopeRequest = await propose("Issued after the envelope is withdrawn");
    await issueRefused(envelopeRequest, "standing-authorization-withdrawn", "a withdrawn envelope refuses issuance");
    /* Re-authorized, so the agent-service cases below run under a valid envelope. */
    const reauthorized = await writeStandingMutationAuthorization(
      ctx,
      "active",
      {
        agentId,
        actionKind: RECORD_WORK_ACTION_KIND,
        notBefore: new Date(clock.getTime() - 60_000),
        notAfter: new Date(clock.getTime() + 86_400_000),
        maxActs: 50,
        minIntervalMinutes: 1,
        justification: ENVELOPE,
        observedRevision: 2,
      },
      deps,
    );
    assert.equal(reauthorized.status, "written", JSON.stringify(reauthorized));


    /* ── (5) / (4) THE AGENT'S OWN SERVICE ──────────────────────────────────── */

    const retirePermit = await issued(await propose("Agent retired after issuance"));
    const retireRequest = await propose("Issued after the agent is retired");
    assert.deepEqual(
      await retireDurableAgentIdentity(outsiderCtx, { agentId }, deps),
      { status: "refused", reason: "not-the-human-owner" },
      "(13) a member without ownership or Governance cannot retire it",
    );
    const retired = await retireDurableAgentIdentity(ctx, { agentId }, deps);
    assert.equal(retired.status, "retired", "(12) the Governance-authorized owner retires it");
    await deliveryRefused(retirePermit, "agent-not-in-service:not-in-service", "retiring after issuance stops delivery");
    await issueRefused(retireRequest, "agent-not-in-service", "a retired agent gets no permits");

    console.log("PASS apf1 agent containment — issuance, delivery, audit, create/retire Governance, isolation");
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
