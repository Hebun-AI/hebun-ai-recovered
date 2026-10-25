/*
 * OPERATIONAL-RELIABILITY-1 — EO1-WORKSTATE-LIFECYCLE-WORDING-1, against a real disposable PostgreSQL.
 *
 * An executed `set-work-declared-state` request was worded in Heby as an external act ("no delivery
 * attempt is recorded, so no effect can be claimed") with no register link, because Heby's internal
 * kinds omitted it. What a person reads must now come from the authority that owns each fact:
 *
 *     PROPOSED != APPROVED != EXECUTED (permit spent) != APPLIED (Work Authority's own record)
 *
 *   S1  executed: the `work.state-declared` row naming the spend names the item; wording and next step
 *   S2  the person's request history shows the same
 *   S3  approved, not executed: no outcome, next step is Approvals
 *   S4  refused under the row lock: the permit stays active, nothing is claimed
 *   S5  a spent permit with no Work Authority record: executed, effect NOT claimed, "Check the register"
 *   S6  links are per action: a state change is never read as recorded work, nor the reverse
 *   S7  another tenant reads nothing
 *   S8  the reads write nothing
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { createDurableAgentIdentity } from "../../src/features/agent-identity/create-durable-agent-identity.server";
import { establishAgentMandateWithResponsibility } from "../../src/features/agent-mandate/establish-agent-mandate.server";
import { proposeRecordWorkAction } from "../../src/features/heby-action-inlet/record-work-proposal.server";
import { approveActionRequest } from "../../src/features/action-authorization/decide-action-request.server";
import { executeRecordWork } from "../../src/features/governed-internal-action/execute-record-work.server";
import { executeSetWorkDeclaredState } from "../../src/features/governed-internal-action/execute-set-work-state.server";
import { originateWorkStateChange } from "../../src/features/agent-origination/originate-work-state.server";
import { preflightWorkStateOrigination } from "../../src/features/origination-availability/read-origination-availability.server";
import {
  readActionRequestLifecycle,
  readMyActionRequestLifecycles,
  type ActionRequestLifecycleView,
} from "../../src/features/action-authorization/read-action-authorizations.server";
import { readGovernedWorkOutcomes } from "../../src/features/organizational-work/read-governed-work-outcomes.server";
import { WORK_AUDIT_STATE_DECLARED } from "../../src/features/organizational-work/work-contracts";
import { describeRequestLifecycle, lifecycleNextStep } from "../../src/components/layout/heby/heby-origination-affordance";
import { asHumanTenantContext, type TenantContext } from "../../src/features/auth/tenant/tenant-context";
import type { WorkScope } from "../../src/features/work-domain/work-scope";

const GENESIS = "I am establishing this organization's Governance authority so consequential acts can be decided.";
const APPROVE = "I have read this state change and I authorize it for this organization.";
const MANDATE = "I am bounding what this agent may propose and which work it is responsible for.";
const PURPOSE =
  "Assist authorized people in proposing changes to the declared state of existing work items within the agent's assigned responsibility.";

type Seeded = { tenantId: string; userId: string; authIdentityId: string; membershipId: string; roleId: string };

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_or1_work_state");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const db = handle.db;
  const deps = { getDb: () => db } as never;
  const q = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await setup.query(sql, params)).rows as T[];
  const snapshot = async () =>
    JSON.stringify(
      await q(
        `select (select count(*) from audit_log) a, (select count(*) from heby_action_requests) r,
                (select md5(coalesce(string_agg(p.id::text || p.status, '|' order by p.id), '')) from action_permits p) p,
                (select md5(coalesce(string_agg(t::text, '|' order by t.id), '')) from work_items t) w`,
      ),
    );

  const governed = async (slug: string): Promise<TenantContext> => {
    const s = (await seedLocalIdentity(setup, { companyName: slug, companySlug: slug, email: `director@${slug}.test` })) as Seeded;
    const session = (
      await q<{ id: string }>(
        `insert into user_session_contexts
           (auth_identity_id, provider_session_reference_hash, provider_session_reference_digest_version,
            user_id, active_tenant_id, active_membership_id, membership_version, assurance_level,
            mfa_verified, authenticated_at, issued_at, last_activity_at, absolute_expires_at, inactivity_expires_at)
         values ($1, md5($2) || md5($2), 1, $3, $4, $5, 1, 'aal1', false, now(), now(), now(),
                 now() + interval '1 day', now() + interval '1 hour') returning id`,
        [s.authIdentityId, slug, s.userId, s.tenantId, s.membershipId],
      )
    )[0]!.id;
    const ctx = asHumanTenantContext({
      tenantId: s.tenantId, userId: s.userId, authIdentityId: s.authIdentityId, membershipId: s.membershipId,
      membershipVersion: 1, roleId: s.roleId, sessionContextId: session, provider: "local", assuranceLevel: "aal1",
      mfaVerified: false, requestId: `or1-${slug}`, authenticatedAt: new Date().toISOString(),
    });
    await q(
      `insert into genesis_nominations (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
         accepted_at, accepted_session_context_id, accepted_assurance_level)
       values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
      [s.tenantId, s.authIdentityId, s.userId, session],
    );
    assert.equal((await establishGovernanceAuthority(ctx, { justification: GENESIS }, deps)).status, "established");
    return ctx;
  };

  let titles = 0;
  const workItem = async (ctx: TenantContext): Promise<{ workItemId: string; handoffId: string }> => {
    const workScope: WorkScope = { kind: "organization" };
    const p = await proposeRecordWorkAction(ctx, { title: `Reliability item ${++titles}`, department: { kind: "organization-level" }, workScope } as never, deps);
    assert.equal(p.status, "proposed", JSON.stringify(p));
    const a = await approveActionRequest(ctx, { requestId: p.status === "proposed" ? p.receipt.requestId : "", justification: APPROVE }, deps);
    assert.equal(a.status, "authorized");
    const e = await executeRecordWork(ctx, { permitId: a.status === "authorized" ? a.permitId : "" }, deps);
    assert.equal(e.status, "executed", JSON.stringify(e));
    return e.status === "executed" && e.outcome.status === "recorded"
      ? { workItemId: e.outcome.workItem.workItemId, handoffId: e.handoffId }
      : { workItemId: "", handoffId: "" };
  };

  const originationDeps = (ctx: TenantContext) => ({
    resolveTenant: async () => ctx,
    preflight: (t: TenantContext, agentId: string, workScope: WorkScope) => preflightWorkStateOrigination(t, agentId, workScope, deps),
    resolveDirectorEnabled: async () => true,
    selectTransport: (() => ({ transport: {} as never, transportProvenance: "fake" as const })) as never,
    generate: (async () => ({
      status: "generated",
      result: { text: '{"kind":"set-work-declared-state","reason":"The person asked for this state."}', provider: "stub", model: "stub-model", providerRequestId: `stub-${++titles}`, inputTokens: 1, outputTokens: 1 },
    })) as never,
    agentIdentity: deps,
    proposal: deps,
    provenance: deps,
  });
  const proposeState = async (ctx: TenantContext, workItemId: string, toState: string): Promise<string> => {
    const r = await originateWorkStateChange({ workItemId, toState }, originationDeps(ctx));
    assert.equal(r.status, "proposed", JSON.stringify(r));
    return r.status === "proposed" ? r.requestId : "";
  };
  const approve = async (ctx: TenantContext, requestId: string): Promise<string> => {
    const a = await approveActionRequest(ctx, { requestId, justification: APPROVE }, deps);
    assert.equal(a.status, "authorized", JSON.stringify(a));
    return a.status === "authorized" ? a.permitId : "";
  };
  const lifecycle = async (ctx: TenantContext, id: string): Promise<ActionRequestLifecycleView> => {
    const r = await readActionRequestLifecycle(ctx, id, deps);
    assert.equal(r.status, "read", JSON.stringify(r));
    return (r as { lifecycle: ActionRequestLifecycleView }).lifecycle;
  };
  const say = (v: ActionRequestLifecycleView) => describeRequestLifecycle(v).join(" ");

  try {
    const acme = await governed("acme-or1");
    const globex = await governed("globex-or1");
    const agentR = await createDurableAgentIdentity(acme, { name: "Heby", justification: "Register this agent for the organization." }, deps);
    const agentId = agentR.status === "established" ? agentR.identity.agentId : "";
    const m = await establishAgentMandateWithResponsibility(
      acme,
      { agentId, purpose: PURPOSE, proposalScope: ["record-work", "set-work-declared-state"], justification: MANDATE, observedMandateRevision: null, responsibility: [{ kind: "organization" }] },
      deps,
    );
    assert.equal(m.status, "established", JSON.stringify(m));

    /* ── S1 · executed, and the Work Authority's own record names the spend ── */
    const one = await workItem(acme);
    const executedRequest = await proposeState(acme, one.workItemId, "active");
    const executedPermit = await approve(acme, executedRequest);
    const done = await executeSetWorkDeclaredState(acme, { permitId: executedPermit }, deps);
    assert.equal(done.status, "executed", JSON.stringify(done));
    const stateHandoff = done.status === "executed" ? done.handoffId : "";
    const linkRows = await q<{ actor_type: string; entity_id: string }>(
      "select actor_type, entity_id from audit_log where action=$1 and metadata->>'handoffId'=$2",
      [WORK_AUDIT_STATE_DECLARED, stateHandoff],
    );
    assert.deepEqual(linkRows, [{ actor_type: "system", entity_id: one.workItemId }], "fixture: one system-authored state-declared row names the spend");

    const v1 = await lifecycle(acme, executedRequest);
    assert.equal(v1.permit?.state, "consumed");
    assert.deepEqual(
      v1.workOutcome,
      { status: "recorded", workItemId: one.workItemId, title: "Reliability item 1", scope: { kind: "organization" }, stateChange: { fromState: "planned", toState: "active" } },
      "S1: the outcome is the item the spend changed, with the approved change",
    );
    assert.match(say(v1), /The work register recorded the change: Reliability item 1 moved from planned to active\./);
    assert.match(say(v1), new RegExp(`Work item ${one.workItemId}\\.`));
    assert.doesNotMatch(say(v1), /delivery attempt|no effect can be claimed|provider/i, "S1: never worded as an external act");
    assert.deepEqual(lifecycleNextStep(v1), { href: "/director/work", label: "Open the work register" });

    /* ── S2 · the person's own request history says the same ── */
    const mine = await readMyActionRequestLifecycles(acme, deps);
    assert.equal(mine.status, "read");
    const listed = mine.status === "read" ? mine.items.find((i) => i.requestId === executedRequest) : undefined;
    assert.ok(listed, "S2: the executed request is in the person's history");
    assert.deepEqual(listed!.workOutcome, v1.workOutcome, "S2: same outcome in the list as in the single read");

    /* ── S3 · approved, not executed ── */
    const two = await workItem(acme);
    const pendingRequest = await proposeState(acme, two.workItemId, "blocked");
    await approve(acme, pendingRequest);
    const v3 = await lifecycle(acme, pendingRequest);
    assert.equal(v3.workOutcome, null, "S3: no outcome before execution");
    assert.match(say(v3), /Authorized and not yet executed/);
    assert.equal(lifecycleNextStep(v3)?.href, "/approvals");

    /* ── S4 · refused under the row lock: the permit stays active, nothing is claimed ── */
    const three = await workItem(acme);
    const raceRequest = await proposeState(acme, three.workItemId, "active");
    const racePermit = await approve(acme, raceRequest);
    await q("update work_items set declared_state='blocked' where id=$1", [three.workItemId]);
    const raced = await executeSetWorkDeclaredState(acme, { permitId: racePermit }, deps);
    assert.equal(raced.status, "refused", JSON.stringify(raced));
    const v4 = await lifecycle(acme, raceRequest);
    assert.equal(v4.permit?.state, "active", "S4: the refused act spent nothing");
    assert.equal(v4.workOutcome, null);
    assert.doesNotMatch(say(v4), /recorded the change|Executed/, "S4: no execution or effect is claimed");

    /* ── S5 · a spent permit with no Work Authority record: executed is not applied ── */
    const four = await workItem(acme);
    const orphanRequest = await proposeState(acme, four.workItemId, "complete");
    const orphanPermit = await approve(acme, orphanRequest);
    /* Disposable database only: a spend whose change is not recorded, the state this wording must survive. */
    await q("update action_permits set status='consumed', consumed_at=now(), handoff_id=gen_random_uuid() where id=$1", [orphanPermit]);
    const v5 = await lifecycle(acme, orphanRequest);
    assert.equal(v5.permit?.state, "consumed");
    assert.deepEqual(v5.workOutcome, { status: "reference-unavailable" });
    assert.match(say(v5), /Hebun could not confirm the work register's record of this change, so no effect is claimed here\./);
    assert.doesNotMatch(say(v5), /recorded the change|moved from|one transaction/, "S5: the permit alone proves no effect");
    assert.deepEqual(lifecycleNextStep(v5), { href: "/director/work", label: "Check the work register" });

    /* ── S6 · links are per action ── */
    const asRecorded = await readGovernedWorkOutcomes(acme, [stateHandoff, one.handoffId], deps);
    assert.equal(asRecorded.status, "read");
    assert.deepEqual([...(asRecorded.status === "read" ? asRecorded.byHandoff.keys() : [])], [one.handoffId], "S6: a state change is not recorded work");
    const asState = await readGovernedWorkOutcomes(acme, [stateHandoff, one.handoffId], deps, WORK_AUDIT_STATE_DECLARED);
    assert.deepEqual([...(asState.status === "read" ? asState.byHandoff.keys() : [])], [stateHandoff], "S6: recorded work is not a state change");
    const recordWorkView = await lifecycle(acme, (await q<{ id: string }>("select r.id from heby_action_requests r join action_permits p on p.action_request_id=r.id where p.handoff_id=$1", [one.handoffId]))[0]!.id);
    assert.match(say(recordWorkView), /Work item recorded: Reliability item 1\./, "S6: record-work wording is unchanged");
    assert.equal(recordWorkView.workOutcome?.status === "recorded" && "stateChange" in recordWorkView.workOutcome, false);

    /* ── S7 · another tenant reads nothing ── */
    assert.equal((await readActionRequestLifecycle(globex, executedRequest, deps)).status, "not-found");
    const foreign = await readGovernedWorkOutcomes(globex, [stateHandoff], deps, WORK_AUDIT_STATE_DECLARED);
    assert.equal(foreign.status === "read" ? foreign.byHandoff.size : -1, 0, "S7: a foreign spend is not linked");
    assert.equal((await readGovernedWorkOutcomes(acme, [stateHandoff], deps, "work.retired" as never)).status, "unavailable", "S7: no action outside the closed pair");

    /* ── S8 · the reads wrote nothing ── */
    const before = await snapshot();
    await lifecycle(acme, executedRequest);
    await lifecycle(acme, orphanRequest);
    await readMyActionRequestLifecycles(acme, deps);
    await readGovernedWorkOutcomes(acme, [stateHandoff], deps, WORK_AUDIT_STATE_DECLARED);
    assert.equal(await snapshot(), before, "S8: lifecycle and outcome reads write nothing");
    console.log("operational-reliability-1/work-state-lifecycle-postgres: OK");
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
