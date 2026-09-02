/*
 * GIA-1 — THE FIRST GOVERNED INTERNAL ACT, PERFORMED AGAINST A REAL DATABASE.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "A proposal to record organizational work is filed by a human or, inside a mandate, by a
 *    durable agent. It records NOTHING. A human decides it at the Governance surface and a permit
 *    is minted. A SEPARATE act spends that permit, and in that ONE transaction the Organizational
 *    Work Authority creates EXACTLY ONE work item, authored `system`, with ONE audit event authored
 *    `system`. The proposer and the authorizer are preserved SEPARATELY from the performer. A
 *    replay creates no second item. No external provider is called and no execution attempt row
 *    exists. Every refusal ABORTS the transaction: the permit reverts to active and nothing at all
 *    was written."
 *
 * The pins:
 *
 *   AGENT PROPOSED   != HUMAN AUTHORIZED != PERMIT ISSUED != SYSTEM EXECUTED != MUTATION SUCCESSFUL
 *   IN MANDATE       != AUTHORIZED
 *   REVERSIBLE       != ERASABLE
 *   AUTHORIZED BY A HUMAN != AUTHORED BY A HUMAN
 *
 * Every row is produced by the released writer that owns it. No adapter, no network, no model, no
 * credential. Uses a disposable local database, dropped on exit.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { seedAgentMandate } from "../helpers/agent-mandate-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { createDurableAgentIdentity } from "../../src/features/agent-identity/create-durable-agent-identity.server";
import { establishAgentMandate } from "../../src/features/agent-mandate/establish-agent-mandate.server";
import { resolveAgentProposer } from "../../src/features/action-authorization/agent-proposer.server";
import {
  recordDepartment,
  retireDepartment,
} from "../../src/features/organization-authority/write-structure.server";
import { formatDepartmentRef } from "../../src/features/organization-authority/department-ref";
import {
  proposeAgentOriginatedRecordWorkAction,
  proposeRecordWorkAction,
} from "../../src/features/heby-action-inlet/record-work-proposal.server";
import { proposeSendAction } from "../../src/features/heby-action-inlet/send-proposal.server";
import { createExternalRecipient } from "../../src/features/external-recipients/write-external-recipients.server";
import { createWorkArtifact } from "../../src/features/work-artifacts/write-work-artifacts.server";
import { approveActionRequest } from "../../src/features/action-authorization/decide-action-request.server";
import { executeRecordWork } from "../../src/features/governed-internal-action/execute-record-work.server";
import { executeAuthorizedAction } from "../../src/features/action-execution/execute-authorized-action.server";
import { retireWork } from "../../src/features/organizational-work/write-work.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";

const NOW = new Date("2026-09-02T09:00:00.000Z");

const GENESIS_JUSTIFICATION =
  "I am establishing this organization's Governance authority so consequential acts can be decided.";
const APPROVAL_JUSTIFICATION =
  "This work is real, it belongs to this department, and I want it on the register.";
const MANDATE_JUSTIFICATION =
  "This agent may propose work records for the departments it observes, and nothing else.";
const MANDATE_PURPOSE =
  "Watches the organization's departments and proposes work records a human then decides.";

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
  const harness = createDisposablePostgresHarness("hebun_gia1_internal_act");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);

  const deps = { getDb: () => handle.db } as never;
  const writeDeps = { getDb: () => handle.db, now: () => NOW } as never;

  const countOf = async (table: string): Promise<number> =>
    (await setup.query<{ n: number }>(`select count(*)::int as n from ${table}`)).rows[0]!.n;

  const permitRow = async (permitId: string) =>
    (
      await setup.query<{
        status: string;
        consumedAt: string | null;
        handoffId: string | null;
        actionKind: string;
      }>(
        `select p.status, p.consumed_at as "consumedAt", p.handoff_id as "handoffId",
                r.action_kind as "actionKind"
           from action_permits p join heby_action_requests r on r.id = p.action_request_id
          where p.id = $1`,
        [permitId],
      )
    ).rows[0]!;

  try {
    /* ═══════════════════════════════════════════════════════════════════════
     * 0. TWO ORGANIZATIONS, EACH GOVERNED, EACH WITH ONE DEPARTMENT.
     * ═════════════════════════════════════════════════════════════════════ */
    const acme = (await seedLocalIdentity(setup, {
      companyName: "Acme",
      companySlug: "acme-gia1",
      email: "director@acme-gia1.test",
    })) as Seeded;
    const globex = (await seedLocalIdentity(setup, {
      companyName: "Globex",
      companySlug: "globex-gia1",
      email: "director@globex-gia1.test",
    })) as Seeded;

    const acmeCtx = contextFor(acme, await sessionRowFor(setup, acme, "aaaa"), "gia1-acme");
    const globexCtx = contextFor(globex, await sessionRowFor(setup, globex, "bbbb"), "gia1-globex");

    for (const [seeded, ctx, label] of [
      [acme, acmeCtx, "acme"],
      [globex, globexCtx, "globex"],
    ] as const) {
      await setup.query(
        `insert into genesis_nominations
           (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
            accepted_at, accepted_session_context_id, accepted_assurance_level)
         values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
        [seeded.tenantId, seeded.authIdentityId, seeded.userId, ctx.sessionContextId],
      );
      const genesis = await establishGovernanceAuthority(
        ctx,
        { justification: GENESIS_JUSTIFICATION },
        deps,
      );
      assert.equal(genesis.status, "established", `${label} governance established`);
    }

    const acmeDept = await recordDepartment(acmeCtx, { name: "Finance", slug: "finance" }, deps);
    assert.equal(acmeDept.status, "recorded");
    const acmeDepartmentId =
      acmeDept.status === "recorded" ? acmeDept.department.departmentId : "";
    const acmeDepartmentRef = formatDepartmentRef(acmeDepartmentId);

    const globexDept = await recordDepartment(globexCtx, { name: "Legal", slug: "legal" }, deps);
    assert.equal(globexDept.status, "recorded");
    const globexDepartmentRef = formatDepartmentRef(
      globexDept.status === "recorded" ? globexDept.department.departmentId : "",
    );

    /* ═══════════════════════════════════════════════════════════════════════
     * 1. A PROPOSAL RECORDS NOTHING.
     * ═════════════════════════════════════════════════════════════════════ */
    assert.equal(await countOf("work_items"), 0, "no work exists before anything is proposed");

    const proposal = await proposeRecordWorkAction(
      acmeCtx,
      { title: "Q3 supplier audit", departmentRef: acmeDepartmentRef },
      deps,
    );
    assert.equal(proposal.status, "proposed", "the human proposal was filed");
    const requestId = proposal.status === "proposed" ? proposal.receipt.requestId : "";

    assert.equal(await countOf("work_items"), 0, "PROPOSED != RECORDED — the register is untouched");
    assert.equal(await countOf("action_permits"), 0, "and nothing was authorized");
    assert.equal(
      await countOf("action_execution_attempts"),
      0,
      "and no execution attempt exists — this act has no external phase",
    );

    /* THE PROPOSER IS THE HUMAN, recorded as such, and it is not a decision. */
    const proposed = (
      await setup.query<{ proposerType: string; proposerId: string; status: string }>(
        `select proposed_by_actor_type as "proposerType", proposed_by_actor_id as "proposerId", status
           from heby_action_requests where id = $1`,
        [requestId],
      )
    ).rows[0]!;
    assert.equal(proposed.proposerType, "human");
    assert.equal(proposed.proposerId, acme.userId);
    assert.equal(proposed.status, "pending", "a proposal is pending, never approved by filing");

    /* THE SAME PROPOSAL TWICE IS THE SAME PROPOSAL. R3A's digest index decides this, not this file. */
    const duplicate = await proposeRecordWorkAction(
      acmeCtx,
      { title: "Q3 supplier audit", departmentRef: acmeDepartmentRef },
      deps,
    );
    assert.equal(duplicate.status, "refused");
    assert.equal(duplicate.status === "refused" ? duplicate.reason : "", "already-pending");
    assert.equal(await countOf("heby_action_requests"), 1, "and no duplicate row was filed");

    /* ═══════════════════════════════════════════════════════════════════════
     * 2. A HUMAN DECIDES. A PERMIT EXISTS. NOTHING HAS HAPPENED.
     * ═════════════════════════════════════════════════════════════════════ */
    const approval = await approveActionRequest(
      acmeCtx,
      { requestId, justification: APPROVAL_JUSTIFICATION },
      deps,
    );
    assert.equal(approval.status, "authorized", "the Director authorized the act");
    const permitId = approval.status === "authorized" ? approval.permitId : "";

    assert.equal(await countOf("work_items"), 0, "AUTHORIZED != EXECUTED — still no work item");
    const beforeSpend = await permitRow(permitId);
    assert.equal(beforeSpend.status, "active");
    assert.equal(beforeSpend.consumedAt, null);
    assert.equal(beforeSpend.handoffId, null);
    assert.equal(beforeSpend.actionKind, "record-work");

    /* THE AUTHORIZER IS THE HUMAN, on a decision record of their own. */
    const decision = (
      await setup.query<{ actorType: string | null; actorId: string | null; outcome: string }>(
        `select actor_type as "actorType", actor_id as "actorId", outcome
           from decision_records where id = $1`,
        [approval.status === "authorized" ? approval.decisionId : ""],
      )
    ).rows[0]!;
    assert.equal(decision.actorType, "human", "a human authorized it");
    assert.equal(decision.actorId, acme.userId);

    /* ═══════════════════════════════════════════════════════════════════════
     * 3. THE SYSTEM EXECUTES. ONE WORK ITEM, AUTHORED `system`.
     * ═════════════════════════════════════════════════════════════════════ */
    const executed = await executeRecordWork(acmeCtx, { permitId }, deps);
    assert.equal(executed.status, "executed", "the permit was spent and the work was recorded");
    const workItemId =
      executed.status === "executed" && executed.outcome.status === "recorded"
        ? executed.outcome.workItem.workItemId
        : "";
    assert.ok(workItemId, "and the Work Authority returned its own record");

    assert.equal(await countOf("work_items"), 1, "EXACTLY ONE work item exists");
    const work = (
      await setup.query<{
        tenantId: string;
        title: string;
        departmentId: string | null;
        createdBy: string | null;
        createdByType: string | null;
        updatedByType: string | null;
        accountableActorId: string | null;
      }>(
        `select tenant_id as "tenantId", title, department_id as "departmentId",
                created_by as "createdBy", created_by_type as "createdByType",
                updated_by_type as "updatedByType", accountable_actor_id as "accountableActorId"
           from work_items where id = $1`,
        [workItemId],
      )
    ).rows[0]!;
    assert.equal(work.tenantId, acme.tenantId, "in the authorizing organization, and only there");
    assert.equal(work.title, "Q3 supplier audit", "exactly the approved title");
    assert.equal(work.departmentId, acmeDepartmentId, "exactly the approved department");
    /*
     * THE LOAD-BEARING ROW. `created_by_type` says who PERFORMED it — the system — and `created_by`
     * stays the human whose session the act happened under. Collapsing them would put a person's
     * name on a mutation they did not perform.
     */
    assert.equal(work.createdByType, "system", "the SYSTEM authored this state");
    assert.equal(work.updatedByType, "system");
    assert.equal(work.createdBy, acme.userId, "correlated to the session, never a claim of authorship");
    assert.equal(work.accountableActorId, null, "and nobody was made accountable by this act");

    /* ONE AUDIT EVENT, AUTHORED `system`, AND NO SECOND EXECUTION LEDGER. */
    const workAudit = (
      await setup.query<{ actorType: string; actorId: string; action: string; entityType: string }>(
        `select actor_type as "actorType", actor_id as "actorId", action, entity_type as "entityType"
           from audit_log where entity_id = $1 and entity_type = 'work_item'`,
        [workItemId],
      )
    ).rows;
    assert.equal(workAudit.length, 1, "exactly one work audit event");
    assert.equal(workAudit[0]!.action, "work.recorded");
    assert.equal(workAudit[0]!.actorType, "system", "the audit says the system performed it");
    assert.equal(workAudit[0]!.actorId, acme.userId, "under this human's session");
    assert.equal(
      await countOf("action_execution_attempts"),
      0,
      "NO SECOND EXECUTION LEDGER — the work row and its audit event ARE the outcome record",
    );

    /* THE PERMIT IS SPENT, ONCE, AND CARRIES ITS HANDOFF. */
    const afterSpend = await permitRow(permitId);
    assert.equal(afterSpend.status, "consumed");
    assert.ok(afterSpend.consumedAt);
    assert.equal(afterSpend.handoffId, executed.status === "executed" ? executed.handoffId : null);

    /* ═══════════════════════════════════════════════════════════════════════
     * 4. REPLAY CREATES NO SECOND ITEM.
     * ═════════════════════════════════════════════════════════════════════ */
    const replay = await executeRecordWork(acmeCtx, { permitId }, deps);
    assert.equal(replay.status, "refused");
    assert.equal(replay.status === "refused" ? replay.reason : "", "permit-not-consumable");
    assert.equal(await countOf("work_items"), 1, "still exactly one work item");

    /* ═══════════════════════════════════════════════════════════════════════
     * 5. THE CLOSED SET IS ENFORCED PER PERMIT, INSIDE THE TRANSACTION.
     *
     * A permit that authorized a SEND cannot be spent by the internal executor, and the refusal
     * ABORTS the spend rather than burning the Director's authorization.
     * ═════════════════════════════════════════════════════════════════════ */
    const recipient = await createExternalRecipient(
      acmeCtx,
      { displayName: "Ayşe Yılmaz", endpointKind: "email", endpointValue: "ayse@example.test" },
      writeDeps,
    );
    assert.equal(recipient.status, "created");
    const draft = await createWorkArtifact(
      acmeCtx,
      { artifactType: "message-draft", title: "Quarterly summary", content: "Merhaba Ayşe," },
      "operations",
      writeDeps,
    );
    assert.equal(draft.status, "created");
    const sendProposal = await proposeSendAction(
      acmeCtx,
      {
        recipientRef: recipient.status === "created" ? recipient.recipient.recordRef : "",
        draftRef: draft.status === "created" ? draft.ref : "",
      },
      deps,
    );
    assert.equal(sendProposal.status, "proposed");
    const sendApproval = await approveActionRequest(
      acmeCtx,
      {
        requestId: sendProposal.status === "proposed" ? sendProposal.receipt.requestId : "",
        justification: APPROVAL_JUSTIFICATION,
      },
      deps,
    );
    assert.equal(sendApproval.status, "authorized");
    const sendPermitId = sendApproval.status === "authorized" ? sendApproval.permitId : "";

    const wrongKind = await executeRecordWork(acmeCtx, { permitId: sendPermitId }, deps);
    assert.equal(wrongKind.status, "refused");
    assert.equal(
      wrongKind.status === "refused" ? wrongKind.reason : "",
      "action-kind-mismatch",
      "the internal executor refuses a permit that authorized an external send",
    );
    const sendPermitAfter = await permitRow(sendPermitId);
    assert.equal(
      sendPermitAfter.status,
      "active",
      "and the refusal ABORTED the spend — the authorization is still the Director's",
    );
    assert.equal(await countOf("work_items"), 1, "and nothing was written");
    assert.equal(await countOf("action_execution_attempts"), 0, "and nothing was attempted");

    /*
     * THE OTHER DIRECTION. The external executor refuses a record-work permit too. A fresh
     * record-work permit is minted for it, because the first one is spent.
     */
    const secondProposal = await proposeRecordWorkAction(
      acmeCtx,
      { title: "Warehouse safety review", departmentRef: acmeDepartmentRef },
      deps,
    );
    assert.equal(secondProposal.status, "proposed");
    const secondApproval = await approveActionRequest(
      acmeCtx,
      {
        requestId: secondProposal.status === "proposed" ? secondProposal.receipt.requestId : "",
        justification: APPROVAL_JUSTIFICATION,
      },
      deps,
    );
    assert.equal(secondApproval.status, "authorized");
    const secondPermitId = secondApproval.status === "authorized" ? secondApproval.permitId : "";

    const wrongExecutor = await executeAuthorizedAction(
      acmeCtx,
      { permitId: secondPermitId },
      { getDb: () => handle.db, adapter: null } as never,
    );
    assert.equal(
      wrongExecutor.status,
      "refused",
      "the EXTERNAL executor refuses a permit that authorized an internal act",
    );
    assert.equal(
      (await permitRow(secondPermitId)).status,
      "active",
      "and it spent nothing doing so",
    );
    assert.equal(await countOf("action_execution_attempts"), 0, "and recorded no attempt");
    assert.equal(await countOf("work_items"), 1, "and wrote no work");

    /* ═══════════════════════════════════════════════════════════════════════
     * 6. TENANT ISOLATION IS THE SPEND PREDICATE, NOT A FILTER.
     * ═════════════════════════════════════════════════════════════════════ */
    const foreign = await executeRecordWork(globexCtx, { permitId: secondPermitId }, deps);
    assert.equal(foreign.status, "refused");
    assert.equal(
      foreign.status === "refused" ? foreign.reason : "",
      "permit-not-consumable",
      "another organization's permit is not consumable — and not distinguishable from an absent one",
    );
    assert.equal(await countOf("work_items"), 1, "and no row appeared in either organization");

    /* A refused proposal cannot reach across either: Globex's department is not Acme's. */
    const crossTenant = await proposeRecordWorkAction(
      acmeCtx,
      { title: "Cross-tenant attempt", departmentRef: globexDepartmentRef },
      deps,
    );
    assert.equal(crossTenant.status, "refused");
    assert.equal(
      crossTenant.status === "refused" ? crossTenant.reason : "",
      "department-not-found",
      "a foreign department is not found, never refused in a way that confirms it exists",
    );

    /* ═══════════════════════════════════════════════════════════════════════
     * 7. THE WORLD CHANGING UNDER A VALID AUTHORIZATION ABORTS THE ACT.
     *
     * The department is retired AFTER the permit was minted. The Work Authority refuses inside the
     * transaction, so the spend rolls back: no work row, and the permit is still the Director's.
     * ═════════════════════════════════════════════════════════════════════ */
    const doomedDept = await recordDepartment(acmeCtx, { name: "Logistics", slug: "logistics" }, deps);
    assert.equal(doomedDept.status, "recorded");
    const doomedRef = formatDepartmentRef(
      doomedDept.status === "recorded" ? doomedDept.department.departmentId : "",
    );
    const doomedProposal = await proposeRecordWorkAction(
      acmeCtx,
      { title: "Fleet contract renewal", departmentRef: doomedRef },
      deps,
    );
    assert.equal(doomedProposal.status, "proposed");
    const doomedApproval = await approveActionRequest(
      acmeCtx,
      {
        requestId: doomedProposal.status === "proposed" ? doomedProposal.receipt.requestId : "",
        justification: APPROVAL_JUSTIFICATION,
      },
      deps,
    );
    assert.equal(doomedApproval.status, "authorized");
    const doomedPermitId = doomedApproval.status === "authorized" ? doomedApproval.permitId : "";

    const retired = await retireDepartment(
      acmeCtx,
      { departmentId: doomedDept.status === "recorded" ? doomedDept.department.departmentId : "" },
      deps,
    );
    assert.equal(retired.status, "recorded", "the department was retired after the permit existed");

    const stale = await executeRecordWork(acmeCtx, { permitId: doomedPermitId }, deps);
    assert.equal(stale.status, "refused");
    assert.equal(
      stale.status === "refused" ? stale.reason : "",
      "work-authority-refused",
      "the OWNING authority refused, and its reason is carried rather than re-interpreted",
    );
    assert.equal(
      stale.status === "refused" ? stale.authorityReason : "",
      "department-unresolved",
      "verbatim, from the authority that owns departments' effect on work",
    );
    assert.equal(await countOf("work_items"), 1, "the transaction aborted — no row was written");
    assert.equal(
      (await permitRow(doomedPermitId)).status,
      "active",
      "and a failed act leaves an authorization a human can spend again",
    );

    /* And proposing against a retired department never reaches a decision at all. */
    const retiredProposal = await proposeRecordWorkAction(
      acmeCtx,
      { title: "Anything at all", departmentRef: doomedRef },
      deps,
    );
    assert.equal(retiredProposal.status, "refused");
    assert.equal(retiredProposal.status === "refused" ? retiredProposal.reason : "", "department-retired");

    /* ═══════════════════════════════════════════════════════════════════════
     * 8. AN AGENT MAY PROPOSE ONLY INSIDE A MANDATE THAT NAMES THIS KIND.
     * ═════════════════════════════════════════════════════════════════════ */
    const agent = await createDurableAgentIdentity(acmeCtx, { name: "Heby" }, deps);
    assert.equal(agent.status, "established");
    const agentId = agent.status === "established" ? agent.identity.agentId : "";

    const proposer = await resolveAgentProposer(acmeCtx, deps);
    assert.equal(proposer.status, "resolved", "the durable agent is the authoritative proposer");
    const verifiedProposer = proposer.status === "resolved" ? proposer.proposer : null;
    assert.ok(verifiedProposer);

    /* (a) NO MANDATE — nobody has bounded this agent. NO MANDATE != UNLIMITED MANDATE. */
    const requestsBefore = await countOf("heby_action_requests");
    const unmandated = await proposeAgentOriginatedRecordWorkAction(
      acmeCtx,
      { title: "Agent proposed this", departmentRef: acmeDepartmentRef },
      verifiedProposer!,
      deps,
    );
    assert.equal(unmandated.status, "refused");
    assert.equal(
      unmandated.status === "refused" ? unmandated.authorityRefusal : "",
      "no-agent-mandate",
      "an unbounded agent proposes nothing",
    );
    assert.equal(await countOf("heby_action_requests"), requestsBefore, "and no row was filed");

    /* (b) A MANDATE THAT DOES NOT NAME `record-work` refuses this kind and permits the other. */
    const sendOnly = await seedAgentMandate(setup, acme, agentId, deps, {
      tag: "gia1send",
      now: NOW,
      proposalScope: ["send"],
    });
    assert.equal(sendOnly.mandateRevision, 1);

    const outOfScope = await proposeAgentOriginatedRecordWorkAction(
      acmeCtx,
      { title: "Agent proposed this", departmentRef: acmeDepartmentRef },
      verifiedProposer!,
      deps,
    );
    assert.equal(outOfScope.status, "refused");
    assert.equal(
      outOfScope.status === "refused" ? outOfScope.authorityRefusal : "",
      "action-outside-agent-mandate",
      "a mandate that does not name this kind refuses it",
    );
    assert.equal(await countOf("heby_action_requests"), requestsBefore, "and still no row was filed");

    /* (c) A MANDATE THAT NAMES IT admits the proposal — and admits NOTHING else. */
    const widened = await establishAgentMandate(
      acmeCtx,
      {
        agentId,
        purpose: MANDATE_PURPOSE,
        proposalScope: ["record-work"],
        justification: MANDATE_JUSTIFICATION,
        observedMandateRevision: 1,
      },
      writeDeps,
    );
    assert.equal(widened.status, "established", "a human recorded a mandate naming this kind");

    const agentProposal = await proposeAgentOriginatedRecordWorkAction(
      acmeCtx,
      { title: "Supplier contract review", departmentRef: acmeDepartmentRef },
      verifiedProposer!,
      deps,
    );
    assert.equal(agentProposal.status, "proposed", "and only then may the agent propose");
    const agentRequestId =
      agentProposal.status === "proposed" ? agentProposal.receipt.requestId : "";

    /* IN MANDATE != AUTHORIZED. It is pending, and no permit exists for it. */
    const agentRow = (
      await setup.query<{ proposerType: string; proposerId: string; status: string }>(
        `select proposed_by_actor_type as "proposerType", proposed_by_actor_id as "proposerId", status
           from heby_action_requests where id = $1`,
        [agentRequestId],
      )
    ).rows[0]!;
    assert.equal(agentRow.proposerType, "agent", "the proposer is the agent");
    assert.equal(agentRow.proposerId, agentId, "the real durable agent, never the human");
    assert.equal(agentRow.status, "pending", "and it is waiting for a person");

    /* ═══════════════════════════════════════════════════════════════════════
     * 9. THREE ACTORS, THREE ROLES, ONE ACT — AND NONE OF THEM COLLAPSES.
     * ═════════════════════════════════════════════════════════════════════ */
    const agentApproval = await approveActionRequest(
      acmeCtx,
      { requestId: agentRequestId, justification: APPROVAL_JUSTIFICATION },
      deps,
    );
    assert.equal(agentApproval.status, "authorized");
    const agentPermitId = agentApproval.status === "authorized" ? agentApproval.permitId : "";

    const agentExecuted = await executeRecordWork(acmeCtx, { permitId: agentPermitId }, deps);
    assert.equal(agentExecuted.status, "executed");
    const agentWorkItemId =
      agentExecuted.status === "executed" && agentExecuted.outcome.status === "recorded"
        ? agentExecuted.outcome.workItem.workItemId
        : "";

    const attribution = (
      await setup.query<{
        proposerType: string;
        proposerId: string;
        approverType: string | null;
        approverId: string | null;
        createdByType: string | null;
        createdBy: string | null;
      }>(
        `select r.proposed_by_actor_type as "proposerType", r.proposed_by_actor_id as "proposerId",
                r.approved_by_actor_type as "approverType", r.approved_by_actor_id as "approverId",
                w.created_by_type as "createdByType", w.created_by as "createdBy"
           from heby_action_requests r, work_items w
          where r.id = $1 and w.id = $2`,
        [agentRequestId, agentWorkItemId],
      )
    ).rows[0]!;
    assert.equal(attribution.proposerType, "agent", "AGENT PROPOSED");
    assert.equal(attribution.proposerId, agentId);
    assert.equal(attribution.approverType, "human", "HUMAN AUTHORIZED");
    assert.equal(attribution.approverId, acme.userId);
    assert.equal(attribution.createdByType, "system", "SYSTEM EXECUTED");
    assert.equal(
      attribution.createdBy,
      acme.userId,
      "and the human's id is a session correlation on the row, never its authorship",
    );
    assert.notEqual(
      attribution.proposerId,
      attribution.approverId,
      "the proposer and the authorizer are preserved separately",
    );

    assert.equal(await countOf("work_items"), 2, "exactly two work items exist, one per spent permit");
    assert.equal(
      await countOf("action_execution_attempts"),
      0,
      "and not one external execution attempt was ever created",
    );

    /* ═══════════════════════════════════════════════════════════════════════
     * 10. REVERSIBLE MEANS RETIRABLE. IT DOES NOT MEAN ERASABLE.
     * ═════════════════════════════════════════════════════════════════════ */
    const inverse = await retireWork(acmeCtx, { workItemId: agentWorkItemId }, deps);
    assert.equal(inverse.status, "recorded", "the deterministic inverse exists and is the authority's");

    assert.equal(await countOf("work_items"), 2, "RETIREMENT IS NOT DELETION — the row is still there");
    const retiredWork = (
      await setup.query<{ lifecycleStatus: string; createdByType: string | null }>(
        `select lifecycle_status as "lifecycleStatus", created_by_type as "createdByType"
           from work_items where id = $1`,
        [agentWorkItemId],
      )
    ).rows[0]!;
    assert.notEqual(retiredWork.lifecycleStatus, "active", "it is retired");
    assert.equal(
      retiredWork.createdByType,
      "system",
      "and it still says the system created it — history is not rewritten by withdrawing the item",
    );
    const stillAudited = (
      await setup.query<{ n: number }>(
        `select count(*)::int as n from audit_log where entity_id = $1 and action = 'work.recorded'`,
        [agentWorkItemId],
      )
    ).rows[0]!.n;
    assert.equal(stillAudited, 1, "the creation event survives the retirement");
    assert.equal(
      (await permitRow(agentPermitId)).status,
      "consumed",
      "and the permit stays spent — retiring the work does not return the authorization",
    );

    console.log("gia1-governed-internal-action/internal-act-postgres: OK");
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose().catch(() => {});
    await harness.dropDatabase();
  }
}

void main();
