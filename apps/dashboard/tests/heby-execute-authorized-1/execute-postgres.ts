/*
 * HEBY-EXECUTE-AUTHORIZED-1 — performing an already-authorized internal act from Heby, against a real
 * disposable PostgreSQL with the released writers. The browser control calls the two named server
 * actions Approvals calls; those wrap exactly the executors driven here with the session's tenant.
 *
 *   X1  a pending request has no permit: not executable from Heby, and nothing can be spent for it
 *   X2  after a human approval the lifecycle carries the permit id and the act is offered
 *   X3  a member without Governance authority is refused; the permit stays active, nothing is written
 *   X4  another organization cannot spend it; the lifecycle is not even readable there
 *   X5  the authority performs it; the re-read lifecycle — not the click — states the Work record
 *   X6  once spent it is no longer offered, and a second spend is refused
 *   X7  set-work-declared-state: the same, and a stale state is refused without spending the permit
 *   X8  "Your requests" carries the same permit id and offers only active internal acts
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
import { describeRequestLifecycle } from "../../src/components/layout/heby/heby-origination-affordance";
import { executableFromHeby } from "../../src/components/layout/heby/heby-execute-authorized";
import { asHumanTenantContext, type TenantContext } from "../../src/features/auth/tenant/tenant-context";
import type { WorkScope } from "../../src/features/work-domain/work-scope";

const GENESIS = "I am establishing this organization's Governance authority so consequential acts can be decided.";
const APPROVE = "I have read this act and I authorize it for this organization.";
const MANDATE = "I am bounding what this agent may propose and which work it is responsible for.";
const PURPOSE =
  "Assist authorized people in proposing changes to the declared state of existing work items within the agent's assigned responsibility.";

let networkCalls = 0;
globalThis.fetch = (() => {
  networkCalls++;
  throw new Error("REAL NETWORK REACHED");
}) as typeof fetch;

type Seeded = { tenantId: string; userId: string; authIdentityId: string; membershipId: string; roleId: string };

let finished = false;
process.on("exit", (code) => {
  if (code === 0 && !finished) {
    console.error("heby-execute-authorized-1/execute-postgres: exited before completing");
    process.exitCode = 1;
  }
});

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_hea1_execute");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const db = handle.db;
  const deps = { getDb: () => db } as never;
  const q = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await setup.query(sql, params)).rows as T[];
  const counts = async () =>
    JSON.stringify(await q(`select (select count(*) from work_items) w, (select count(*) from audit_log) a,
      (select md5(coalesce(string_agg(p.id::text || p.status, '|' order by p.id), '')) from action_permits p) p`));

  const sessionFor = async (s: Seeded, tag: string, requestId: string): Promise<TenantContext> => {
    const session = (
      await q<{ id: string }>(
        `insert into user_session_contexts
           (auth_identity_id, provider_session_reference_hash, provider_session_reference_digest_version,
            user_id, active_tenant_id, active_membership_id, membership_version, assurance_level,
            mfa_verified, authenticated_at, issued_at, last_activity_at, absolute_expires_at, inactivity_expires_at)
         values ($1, md5($2) || md5($2), 1, $3, $4, $5, 1, 'aal1', false, now(), now(), now(),
                 now() + interval '1 day', now() + interval '1 hour') returning id`,
        [s.authIdentityId, tag, s.userId, s.tenantId, s.membershipId],
      )
    )[0]!.id;
    return asHumanTenantContext({
      tenantId: s.tenantId, userId: s.userId, authIdentityId: s.authIdentityId, membershipId: s.membershipId,
      membershipVersion: 1, roleId: s.roleId, sessionContextId: session, provider: "local", assuranceLevel: "aal1",
      mfaVerified: false, requestId, authenticatedAt: new Date().toISOString(),
    });
  };
  const governed = async (slug: string): Promise<{ ctx: TenantContext; seed: Seeded }> => {
    const s = (await seedLocalIdentity(setup, { companyName: slug, companySlug: slug, email: `director@${slug}.test` })) as Seeded;
    const ctx = await sessionFor(s, slug, `hea1-${slug}`);
    await q(
      `insert into genesis_nominations (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
         accepted_at, accepted_session_context_id, accepted_assurance_level)
       values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
      [s.tenantId, s.authIdentityId, s.userId, ctx.sessionContextId],
    );
    assert.equal((await establishGovernanceAuthority(ctx, { justification: GENESIS }, deps)).status, "established");
    return { ctx, seed: s };
  };
  const member = async (tenantId: string, email: string): Promise<TenantContext> => {
    const user = (await q<{ id: string }>(`insert into users (email, name) values ($1, $1) returning id`, [email]))[0]!.id;
    const identity = (await q<{ id: string }>(
      `insert into auth_identities (user_id, provider, issuer, subject, status, is_primary, verified_at)
       values ($1, 'local', 'hebun-local', $2, 'active', true, now()) returning id`, [user, `local:${email}`]))[0]!.id;
    const role = (await q<{ id: string }>(`insert into roles (tenant_id, name, type) values ($1, $2, 'owner') returning id`, [tenantId, `Role ${email}`]))[0]!.id;
    const membership = (await q<{ id: string }>(
      `insert into memberships (tenant_id, user_id, role_id, status) values ($1, $2, $3, 'active') returning id`, [tenantId, user, role]))[0]!.id;
    return sessionFor({ tenantId, userId: user, authIdentityId: identity, membershipId: membership, roleId: role }, email, "hea1-member");
  };
  const lifecycle = async (ctx: TenantContext, id: string): Promise<ActionRequestLifecycleView> => {
    const r = await readActionRequestLifecycle(ctx, id, deps);
    assert.equal(r.status, "read", JSON.stringify(r));
    return (r as { lifecycle: ActionRequestLifecycleView }).lifecycle;
  };
  const say = (v: ActionRequestLifecycleView) => describeRequestLifecycle(v).join(" ");

  try {
    const { ctx: acme } = await governed("acme-hea1");
    const { ctx: globex } = await governed("globex-hea1");
    const clerk = await member((await q<{ t: string }>("select active_tenant_id t from user_session_contexts where id = $1", [acme.sessionContextId]))[0]!.t, "clerk@acme-hea1.test");

    /* ── X1 · pending: no permit, nothing offered ── */
    const p = await proposeRecordWorkAction(acme, { title: "Prepare the launch checklist", department: { kind: "organization-level" }, workScope: { kind: "organization" } } as never, deps);
    assert.equal(p.status, "proposed", JSON.stringify(p));
    const requestId = p.status === "proposed" ? p.receipt.requestId : "";
    const pending = await lifecycle(acme, requestId);
    assert.equal(pending.permit, null, "X1: no permit before a decision");
    assert.equal(executableFromHeby(pending), false, "X1: nothing to perform before a human decides");

    /* ── X2 · approved: the permit id is on the lifecycle and the act is offered ── */
    const approved = await approveActionRequest(acme, { requestId, justification: APPROVE }, deps);
    assert.equal(approved.status, "authorized", JSON.stringify(approved));
    const permitId = approved.status === "authorized" ? approved.permitId : "";
    const ready = await lifecycle(acme, requestId);
    assert.equal(ready.permit?.permitId, permitId, "X2: the lifecycle names the permit the decision minted");
    assert.equal(ready.permit?.state, "active");
    assert.equal(executableFromHeby(ready), true, "X2: offered");
    assert.match(say(ready), /Authorized and not yet executed/);

    /* ── X3 · a member without Governance authority is refused; nothing changes ── */
    const before = await counts();
    const byClerk = await executeRecordWork(clerk, { permitId }, deps);
    assert.deepEqual(byClerk, { status: "refused", reason: "not-the-governance-authority" }, "X3");
    assert.equal(await counts(), before, "X3: no work row, no audit row, the permit unchanged");
    const stillReady = await lifecycle(acme, requestId);
    assert.equal(stillReady.permit?.state, "active", "X3: the authorization is still unspent");
    assert.doesNotMatch(say(stillReady), /Executed|recorded/, "X3: a refusal is never worded as an effect");

    /* ── X4 · another organization ── */
    const byGlobex = await executeRecordWork(globex, { permitId }, deps);
    assert.equal(byGlobex.status, "refused", "X4: another organization cannot spend it");
    assert.equal(await counts(), before, "X4: nothing changed");
    assert.equal((await readActionRequestLifecycle(globex, requestId, deps)).status, "not-found", "X4: not even readable there");

    /* ── X5 · the authority performs it; the re-read states the Work record ── */
    const done = await executeRecordWork(acme, { permitId }, deps);
    assert.equal(done.status, "executed", JSON.stringify(done));
    const after = await lifecycle(acme, requestId);
    assert.equal(after.permit?.state, "consumed", "X5: spent");
    assert.equal(after.workOutcome?.status, "recorded", "X5: the Work Authority's record is linked");
    assert.match(say(after), /Executed/, "X5: the sentence comes from the re-read");
    const workItemId = done.status === "executed" && done.outcome.status === "recorded" ? done.outcome.workItem.workItemId : "";
    assert.equal((await q("select 1 from work_items where id = $1", [workItemId])).length, 1, "X5: the row exists");

    /* ── X6 · no longer offered; a second spend is refused ── */
    assert.equal(executableFromHeby(after), false, "X6: a spent permit is not offered");
    const again = await executeRecordWork(acme, { permitId }, deps);
    assert.deepEqual(again, { status: "refused", reason: "permit-not-consumable" }, "X6");

    /* ── X7 · set-work-declared-state ── */
    const agentR = await createDurableAgentIdentity(acme, { name: "Heby", justification: "Register this agent for the organization." }, deps);
    const agentId = agentR.status === "established" ? agentR.identity.agentId : "";
    const m = await establishAgentMandateWithResponsibility(
      acme,
      { agentId, purpose: PURPOSE, proposalScope: ["record-work", "set-work-declared-state"], justification: MANDATE, observedMandateRevision: null, responsibility: [{ kind: "organization" }] },
      deps,
    );
    assert.equal(m.status, "established", JSON.stringify(m));
    let n = 0;
    const proposeState = async (toState: string): Promise<string> => {
      const r = await originateWorkStateChange({ workItemId, toState }, {
        resolveTenant: async () => acme,
        preflight: (t: TenantContext, a: string, scope: WorkScope) => preflightWorkStateOrigination(t, a, scope, deps),
        resolveDirectorEnabled: async () => true,
        selectTransport: (() => ({ transport: {} as never, transportProvenance: "fake" as const })) as never,
        generate: (async () => ({
          status: "generated",
          result: { text: '{"kind":"set-work-declared-state","reason":"The person asked for this state."}', provider: "stub", model: "stub-model", providerRequestId: `stub-${++n}`, inputTokens: 1, outputTokens: 1 },
        })) as never,
        agentIdentity: deps, proposal: deps, provenance: deps,
      } as never);
      assert.equal(r.status, "proposed", JSON.stringify(r));
      return r.status === "proposed" ? r.requestId : "";
    };
    const activeRequest = await proposeState("active");
    const staleRequest = await proposeState("blocked");
    const activate = await approveActionRequest(acme, { requestId: activeRequest, justification: APPROVE }, deps);
    const block = await approveActionRequest(acme, { requestId: staleRequest, justification: APPROVE }, deps);
    assert.ok(activate.status === "authorized" && block.status === "authorized");
    const stateView = await lifecycle(acme, activeRequest);
    assert.equal(executableFromHeby(stateView), true, "X7: a state change is offered once authorized");
    const changed = await executeSetWorkDeclaredState(acme, { permitId: stateView.permit!.permitId }, deps);
    assert.equal(changed.status, "executed", JSON.stringify(changed));
    const stateAfter = await lifecycle(acme, activeRequest);
    assert.equal(stateAfter.workOutcome?.status, "recorded", "X7: the Work Authority recorded the change");
    assert.equal((await q<{ s: string }>("select declared_state s from work_items where id = $1", [workItemId]))[0]!.s, "active");
    /* The second was proposed from `planned`; the item is now `active`, so the authority refuses it. */
    const staleView = await lifecycle(acme, staleRequest);
    const beforeStale = await counts();
    const stale = await executeSetWorkDeclaredState(acme, { permitId: staleView.permit!.permitId }, deps);
    assert.equal(stale.status, "refused", "X7: a stale change is refused");
    assert.equal(await counts(), beforeStale, "X7: nothing written, the permit not spent");
    assert.equal((await lifecycle(acme, staleRequest)).permit?.state, "active", "X7: still active after the refusal");

    /* ── X8 · Your requests ── */
    const mine = await readMyActionRequestLifecycles(acme, deps);
    assert.equal(mine.status, "read");
    if (mine.status === "read") {
      const offered = mine.items.filter(executableFromHeby).map((i) => i.requestId);
      assert.deepEqual(offered, [staleRequest], "X8: only the still-active internal act is offered");
      for (const item of mine.items) if (item.permit) assert.match(item.permit.permitId, /^[0-9a-f-]{36}$/, "X8: every permit is named");
    }

    assert.equal(networkCalls, 0, "no network");
    finished = true;
    console.log("heby-execute-authorized-1 execute-postgres: X1–X8 ok");
  } finally {
    await setup.end().catch(() => {});
    await (handle as { dispose?: () => Promise<void> }).dispose?.().catch?.(() => {});
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
