/*
 * WORK-UPDATE V1 — `set-work-declared-state` AGAINST A REAL DATABASE.
 *
 * The T1 transaction contract, proved on the released schema with the real origination, the real
 * proposal writer, the real Governance approval, the released permit spend and the Work Authority's
 * governed door. The model is a stub that answers a fixed envelope and records what it was shown;
 * no provider is reached. A disposable local database, dropped on exit.
 *
 * Proved, each against a measured before/after:
 *   T1  a Work refusal after the spend rolls the spend back (permit `active`, nothing written)
 *   T2  a spend refusal leaves Work untouched, including a refusal thrown inside consume's savepoint
 *   T3  concurrent executions of one permit perform exactly one change
 *   T4  two permits racing on one item: the second re-reads under the row lock and is refused
 *   T5  `fromState` is checked under the lock: a writer holding the lock changes the state, the
 *       waiting execution re-reads it and refuses
 *   T6  tenant isolation at origination and at execution
 *   T7  responsibility and mandate at origination (no request filed) and at execution (refused)
 *   T8  the model is shown no work data, and the declared classes are `conversation` only
 *   T9  record-work is unchanged beside it
 *   T10 the read-only pre-model preflight: a revoked responsibility, a withdrawn kind, an unreadable
 *       mandate and a missing preflight all refuse with no invocation and no model call; a mandate
 *       revised WHILE the model runs is still refused by the one writer (the authoritative check)
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { createDurableAgentIdentity } from "../../src/features/agent-identity/create-durable-agent-identity.server";
import { establishAgentMandateWithResponsibility } from "../../src/features/agent-mandate/establish-agent-mandate.server";
import { recordWorkDomain } from "../../src/features/work-domain/write-work-domain.server";
import { proposeRecordWorkAction } from "../../src/features/heby-action-inlet/record-work-proposal.server";
import { approveActionRequest } from "../../src/features/action-authorization/decide-action-request.server";
import { revokeActionPermit } from "../../src/features/action-authorization/revoke-action-permit.server";
import { executeRecordWork } from "../../src/features/governed-internal-action/execute-record-work.server";
import { executeSetWorkDeclaredState } from "../../src/features/governed-internal-action/execute-set-work-state.server";
import { retireWork, setWorkDeclaredState, recordWork } from "../../src/features/organizational-work/write-work.server";
import {
  originateWorkStateChange,
  WORK_STATE_ORIGINATION_GOALS,
} from "../../src/features/agent-origination/originate-work-state.server";
import { asHumanTenantContext, type TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { preflightWorkStateOrigination } from "../../src/features/origination-availability/read-origination-availability.server";

const GENESIS = "I am establishing this organization's Governance authority so consequential acts can be decided.";
const APPROVE = "I have read this state change and I authorize it for this organization.";
const MANDATE = "I am bounding what this agent may propose and which work it is responsible for.";
const PURPOSE =
  "Assist authorized people in proposing changes to the declared state of existing work items within the agent's assigned responsibility domains.";

type Seeded = { tenantId: string; userId: string; authIdentityId: string; membershipId: string; roleId: string };
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_work_update_v1");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const db = handle.db;
  const deps = { getDb: () => db } as never;
  const q = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await setup.query(sql, params)).rows as T[];
  const count = async (table: string, where = "true", params: unknown[] = []) =>
    Number((await q<{ n: number }>(`select count(*)::int as n from ${table} where ${where}`, params))[0]!.n);
  const permitState = async (id: string) => (await q<{ status: string }>("select status from action_permits where id=$1", [id]))[0]!.status;
  const item = async (id: string) =>
    (await q<{ declared_state: string; updated_by_type: string }>("select declared_state, updated_by_type from work_items where id=$1", [id]))[0]!;
  const snapshot = async () =>
    JSON.stringify(
      await q(
        `select (select count(*) from audit_log) a, (select count(*) from heby_action_requests) r,
                (select count(*) from heby_origination_invocations) i,
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
      mfaVerified: false, requestId: `wu1-${slug}`, authenticatedAt: new Date().toISOString(),
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
  const domain = async (ctx: TenantContext, slug: string): Promise<string> => {
    const r = await recordWorkDomain(ctx, { slug, name: slug }, deps);
    assert.equal(r.status, "recorded");
    return r.status === "recorded" ? r.workDomain.workDomainId : "";
  };
  /* A domain-scoped work item, through the released governed record-work path. */
  let titles = 0;
  const domainItem = async (ctx: TenantContext, workDomainId: string): Promise<string> => {
    const title = `Work item ${++titles}`;
    const p = await proposeRecordWorkAction(
      ctx,
      { title, department: { kind: "organization-level" }, workScope: { kind: "domain", workDomainId } } as never,
      deps,
    );
    assert.equal(p.status, "proposed", JSON.stringify(p));
    const a = await approveActionRequest(ctx, { requestId: p.status === "proposed" ? p.receipt.requestId : "", justification: APPROVE }, deps);
    assert.equal(a.status, "authorized");
    const e = await executeRecordWork(ctx, { permitId: a.status === "authorized" ? a.permitId : "" }, deps);
    assert.equal(e.status, "executed", JSON.stringify(e));
    return e.status === "executed" && e.outcome.status === "recorded" ? e.outcome.workItem.workItemId : "";
  };

  /* The stub model: answers `reply`, records exactly what it was shown. */
  const shown: { request: unknown; disclosure: unknown }[] = [];
  let reply = '{"kind":"set-work-declared-state","reason":"The person asked for this state; it is theirs to decide."}';
  /* T10 — runs inside the model call, i.e. after the preflight admitted and before the writer asks. */
  let duringGenerate: (() => Promise<void>) | null = null;
  const originationDeps = (ctx: TenantContext) => ({
    resolveTenant: async () => ctx,
    preflight: (t: TenantContext, agentId: string, workDomainId: string) => preflightWorkStateOrigination(t, agentId, workDomainId, deps),
    resolveDirectorEnabled: async () => true,
    selectTransport: (() => ({ transport: {} as never, transportProvenance: "fake" as const })) as never,
    generate: (async (request: unknown, options: { disclosure?: unknown }) => {
      shown.push({ request, disclosure: options.disclosure });
      if (duringGenerate) await duringGenerate();
      return {
        status: "generated",
        result: { text: reply, provider: "stub", model: "stub-model", providerRequestId: `stub-${shown.length}`, inputTokens: 1, outputTokens: 1 },
      };
    }) as never,
    agentIdentity: deps,
    proposal: deps,
    provenance: deps,
  });
  const propose = async (ctx: TenantContext, workItemId: string, toState: string) =>
    originateWorkStateChange({ workItemId, toState }, originationDeps(ctx));
  const approvedPermit = async (ctx: TenantContext, workItemId: string, toState: string): Promise<string> => {
    const o = await propose(ctx, workItemId, toState);
    assert.equal(o.status, "proposed", JSON.stringify(o));
    const a = await approveActionRequest(ctx, { requestId: o.status === "proposed" ? o.requestId : "", justification: APPROVE }, deps);
    assert.equal(a.status, "authorized", JSON.stringify(a));
    return a.status === "authorized" ? a.permitId : "";
  };
  const execute = (ctx: TenantContext, permitId: string) => executeSetWorkDeclaredState(ctx, { permitId }, deps);

  try {
    const acme = await governed("acme-wu1");
    const globex = await governed("globex-wu1");
    const eng = await domain(acme, "engineering");
    const fin = await domain(acme, "finance");
    const globexEng = await domain(globex, "engineering");

    const agentR = await createDurableAgentIdentity(acme, { name: "Heby", justification: "Register this agent for the organization." }, deps);
    assert.equal(agentR.status, "established");
    const agentId = agentR.status === "established" ? agentR.identity.agentId : "";
    let revision = 0;
    const mandate = async (scope: string[], responsibility: unknown[]) => {
      const r = await establishAgentMandateWithResponsibility(
        acme,
        { agentId, purpose: PURPOSE, proposalScope: scope, justification: MANDATE, observedMandateRevision: revision === 0 ? null : revision, responsibility },
        deps,
      );
      assert.equal(r.status, "established", JSON.stringify(r));
      revision++;
    };

    /* ── T7a · NO KIND IN THE MANDATE: refused by the preflight, before the model; nothing is filed. ── */
    await mandate(["record-work"], [{ kind: "domain", workDomainId: eng }]);
    const engItem = await domainItem(acme, eng);
    const finItem = await domainItem(acme, fin);
    const before7 = await count("heby_action_requests");
    const shown7 = shown.length;
    const inv7 = await count("heby_origination_invocations");
    const outside = await propose(acme, engItem, "active");
    assert.deepEqual([outside.status, outside.status === "refused" ? outside.detail : ""], ["refused", "action-outside-agent-mandate"]);
    assert.equal(await count("heby_action_requests"), before7, "T7a: no request without the kind in the mandate");
    assert.equal(shown.length, shown7, "T10: a kind outside the mandate is refused before any model call");
    assert.equal(await count("heby_origination_invocations"), inv7, "T10: and before any invocation is registered");

    await mandate(["record-work", "set-work-declared-state"], [{ kind: "domain", workDomainId: eng }]);

    /* ── T7b · RESPONSIBILITY AT ORIGINATION: an item in a domain the agent is not responsible for. ── */
    const notMine = await propose(acme, finItem, "active");
    assert.deepEqual([notMine.status, notMine.status === "refused" ? notMine.detail : ""], ["refused", "work-outside-agent-responsibility"], "T7b: responsibility refuses at origination");
    assert.equal(await count("heby_action_requests"), before7, "T7b: no request outside the agent's responsibility");
    assert.equal(shown.length, shown7, "T10: responsibility is checked before any model call");
    assert.equal(await count("heby_origination_invocations"), inv7, "T10: and before any invocation is registered");

    /* ── refusals before any model call: unscoped, retired, same state, invalid state, foreign ── */
    const unscoped = await recordWork(acme, { title: "Unscoped item" }, deps);
    const unscopedId = unscoped.status === "recorded" ? unscoped.workItem.workItemId : "";
    const shownBefore = shown.length;
    const invBefore = await count("heby_origination_invocations");
    for (const [id, to, reason] of [
      [unscopedId, "active", "work-not-domain-scoped"],
      [engItem, "planned", "state-unchanged"],
      [engItem, "finished", "invalid-target-state"],
      ["not-an-id", "active", "work-unresolved"],
    ] as const) {
      const r = await propose(acme, id, to);
      assert.deepEqual([r.status, r.status === "refused" ? r.reason : ""], ["refused", reason]);
    }
    assert.equal(shown.length, shownBefore, "no model call for a refusal Hebun could already see");
    assert.equal(await count("heby_origination_invocations"), invBefore, "and no invocation registered");

    /* ── T6a · TENANT AT ORIGINATION: Globex's item does not resolve for Acme. ── */
    const globexItem = await domainItem(globex, globexEng);
    const foreign = await propose(acme, globexItem, "active");
    assert.deepEqual([foreign.status, foreign.status === "refused" ? foreign.reason : ""], ["refused", "work-unresolved"]);
    assert.equal(shown.length, shownBefore, "T6a: a foreign item is refused before any model call");

    /* ── T8 · WHAT THE MODEL WAS SHOWN, on a real proposal. ── */
    const p1 = await propose(acme, engItem, "active");
    assert.equal(p1.status, "proposed", JSON.stringify(p1));
    const seen = shown[shown.length - 1]!;
    const req = seen.request as { userPrompt: string; evidence: unknown[] };
    assert.equal(req.userPrompt, WORK_STATE_ORIGINATION_GOALS.active, "T8: the goal is the fixed Hebun sentence");
    assert.deepEqual(req.evidence, [], "T8: no grounding line");
    assert.deepEqual((seen.disclosure as { dataClasses: string[]; purpose: string }).dataClasses, ["conversation"]);
    assert.equal((seen.disclosure as { purpose: string }).purpose, "agent-origination");
    const everything = JSON.stringify(seen.request);
    for (const secret of [engItem, "Work item", eng, "planned", "work-item/", "work-domain/"]) {
      assert.ok(!everything.includes(secret), `T8: the model was not shown ${secret}`);
    }
    const filed = (await q<{ payload: Record<string, unknown>; target_ref: string; status: string; proposed_by_actor_type: string }>(
      "select canonical_payload payload, target_ref, status, proposed_by_actor_type from heby_action_requests where id=$1",
      [p1.status === "proposed" ? p1.requestId : ""],
    ))[0]!;
    assert.deepEqual(filed.payload, {
      workItemRef: `work-item/${engItem}`,
      fromState: "planned",
      toState: "active",
      workScope: "domain",
      workDomainRef: `work-domain/${eng}`,
    });
    assert.equal(filed.target_ref, `work-item/${engItem}`);
    assert.equal(filed.status, "pending");
    assert.equal(filed.proposed_by_actor_type, "agent");
    assert.equal((await item(engItem)).declared_state, "planned", "a proposal changes nothing");

    /* ── T1 · A WORK REFUSAL AFTER THE SPEND ROLLS THE SPEND BACK. ── */
    const a1 = await approveActionRequest(acme, { requestId: p1.status === "proposed" ? p1.requestId : "", justification: APPROVE }, deps);
    const permit1 = a1.status === "authorized" ? a1.permitId : "";
    assert.equal((await setWorkDeclaredState(acme, { workItemId: engItem, declaredState: "blocked" }, deps)).status, "recorded");
    let snap = await snapshot();
    const stale = await execute(acme, permit1);
    assert.deepEqual([stale.status, stale.status === "refused" ? stale.authorityReason : ""], ["refused", "work-state-changed"], "T1: a stale fromState is refused under the lock");
    assert.equal(await permitState(permit1), "active", "T1: the spend rolled back with the refusal");
    assert.equal(await snapshot(), snap, "T1: nothing at all was written");
    /* Restore the state the proposal was made from: the SAME permit then executes, once. */
    assert.equal((await setWorkDeclaredState(acme, { workItemId: engItem, declaredState: "planned" }, deps)).status, "recorded");
    const done = await execute(acme, permit1);
    assert.equal(done.status, "executed", JSON.stringify(done));
    assert.equal(await permitState(permit1), "consumed");
    assert.deepEqual(await item(engItem), { declared_state: "active", updated_by_type: "system" });
    const audit = (await q<{ actor_type: string; metadata: Record<string, unknown> }>(
      "select actor_type, metadata from audit_log where action='work.state-declared' and entity_id=$1 order by recorded_at desc limit 1",
      [engItem],
    ))[0]!;
    assert.equal(audit.actor_type, "system", "the audit row says the system performed it");
    assert.equal(audit.metadata.declaredState, "active");
    assert.equal(audit.metadata.handoffId, done.status === "executed" ? done.handoffId : "", "and names the permit spend");
    const replay = await execute(acme, permit1);
    assert.deepEqual([replay.status, replay.status === "refused" ? replay.reason : ""], ["refused", "permit-not-consumable"], "a replay changes nothing");

    /* ── T1b · RETIRED AND RE-SCOPED TARGETS ALSO ROLL THE SPEND BACK. ── */
    const engItem2 = await domainItem(acme, eng);
    const permitRetired = await approvedPermit(acme, engItem2, "active");
    assert.equal((await retireWork(acme, { workItemId: engItem2 }, deps)).status, "recorded");
    snap = await snapshot();
    const retired = await execute(acme, permitRetired);
    assert.deepEqual([retired.status, retired.status === "refused" ? retired.authorityReason : ""], ["refused", "work-retired"]);
    assert.equal(await permitState(permitRetired), "active");
    assert.equal(await snapshot(), snap);

    const engItem3 = await domainItem(acme, eng);
    const permitMoved = await approvedPermit(acme, engItem3, "blocked");
    await q("alter table work_items disable trigger user");
    await q("update work_items set work_domain_id=$1 where id=$2", [fin, engItem3]);
    await q("alter table work_items enable trigger user");
    snap = await snapshot();
    const moved = await execute(acme, permitMoved);
    assert.deepEqual([moved.status, moved.status === "refused" ? moved.authorityReason : ""], ["refused", "work-scope-changed"], "T1b: an item moved to another domain is refused under the lock");
    assert.equal(await permitState(permitMoved), "active");
    assert.equal(await snapshot(), snap);

    /* ── T2 · A SPEND REFUSAL LEAVES WORK UNTOUCHED. ── */
    const engItem4 = await domainItem(acme, eng);
    const permitRevoked = await approvedPermit(acme, engItem4, "active");
    assert.equal(
      (await revokeActionPermit(acme, { permitId: permitRevoked, justification: "Withdrawing this authorization before it is spent.", revocationReason: "test" }, deps)).status,
      "revoked",
    );
    snap = await snapshot();
    const revoked = await execute(acme, permitRevoked);
    assert.deepEqual([revoked.status, revoked.status === "refused" ? revoked.reason : ""], ["refused", "permit-not-consumable"]);
    assert.equal(await snapshot(), snap);
    assert.equal((await item(engItem4)).declared_state, "planned");

    /* T2b · digest drift, refused INSIDE consume's savepoint: permit stays active, Work untouched. */
    const permitDrift = await approvedPermit(acme, engItem4, "complete");
    const driftRequest = (await q<{ action_request_id: string }>("select action_request_id from action_permits where id=$1", [permitDrift]))[0]!.action_request_id;
    await q("alter table heby_action_requests disable trigger user");
    await q(`update heby_action_requests set canonical_payload = jsonb_set(canonical_payload, '{toState}', '"blocked"') where id=$1`, [driftRequest]);
    await q("alter table heby_action_requests enable trigger user");
    snap = await snapshot();
    const drift = await execute(acme, permitDrift);
    assert.deepEqual([drift.status, drift.status === "refused" ? drift.reason : ""], ["refused", "permit-not-consumable"]);
    assert.equal(await permitState(permitDrift), "active", "T2b: the savepoint refusal spent nothing");
    assert.equal(await snapshot(), snap, "T2b: nothing written");

    /* ── T3 · CONCURRENT EXECUTIONS OF ONE PERMIT: exactly one change. ── */
    const engItem5 = await domainItem(acme, eng);
    const permitRace = await approvedPermit(acme, engItem5, "active");
    const auditBefore = await count("audit_log", "action='work.state-declared' and entity_id=$1", [engItem5]);
    const race = await Promise.all([execute(acme, permitRace), execute(acme, permitRace)]);
    assert.deepEqual(race.map((r) => r.status).sort(), ["executed", "refused"]);
    const loser = race.find((r) => r.status === "refused");
    assert.equal(loser?.status === "refused" ? loser.reason : "", "permit-not-consumable");
    assert.equal(await count("audit_log", "action='work.state-declared' and entity_id=$1", [engItem5]), auditBefore + 1, "T3: one change");

    /* ── T4 · TWO PERMITS RACING ON ONE ITEM FROM THE SAME STATE. ── */
    const engItem6 = await domainItem(acme, eng);
    const permitA = await approvedPermit(acme, engItem6, "active");
    const permitB = await approvedPermit(acme, engItem6, "blocked");
    const pair = await Promise.all([execute(acme, permitA), execute(acme, permitB)]);
    const won = pair.filter((r) => r.status === "executed");
    const lost = pair.filter((r) => r.status === "refused");
    assert.equal(won.length, 1, "T4: exactly one executes");
    assert.equal(lost[0]?.status === "refused" ? lost[0].authorityReason : "", "work-state-changed", "T4: the other is refused under the lock");
    const lostPermit = pair[0]!.status === "refused" ? permitA : permitB;
    assert.equal(await permitState(lostPermit), "active", "T4: the loser's permit is untouched");

    /* ── T5 · fromState IS CHECKED UNDER THE ROW LOCK. ── */
    const engItem7 = await domainItem(acme, eng);
    const permitLock = await approvedPermit(acme, engItem7, "active");
    const holder = new Client({ connectionString: harness.dbUrl });
    await holder.connect();
    await holder.query("begin");
    await holder.query("select id from work_items where id=$1 for update", [engItem7]);
    const waiting = execute(acme, permitLock);
    await sleep(400);
    await holder.query("update work_items set declared_state='blocked' where id=$1", [engItem7]);
    await holder.query("commit");
    await holder.end();
    const afterWait = await waiting;
    assert.deepEqual(
      [afterWait.status, afterWait.status === "refused" ? afterWait.authorityReason : ""],
      ["refused", "work-state-changed"],
      "T5: the execution waited on the lock, re-read the row and refused",
    );
    assert.equal(await permitState(permitLock), "active");
    assert.equal((await item(engItem7)).declared_state, "blocked");

    /* ── T6b · TENANT AT EXECUTION: Globex cannot spend Acme's permit. ── */
    const engItem8 = await domainItem(acme, eng);
    const permitForeign = await approvedPermit(acme, engItem8, "active");
    snap = await snapshot();
    const crossed = await execute(globex, permitForeign);
    assert.deepEqual([crossed.status, crossed.status === "refused" ? crossed.reason : ""], ["refused", "permit-not-consumable"]);
    assert.equal(await permitState(permitForeign), "active");
    assert.equal(await snapshot(), snap);

    /* ── T7c · RESPONSIBILITY AT EXECUTION: withdrawn after approval, the spend refuses. ── */
    await mandate(["record-work", "set-work-declared-state"], [{ kind: "domain", workDomainId: fin }]);
    snap = await snapshot();
    const withdrawn = await execute(acme, permitForeign);
    assert.deepEqual([withdrawn.status, withdrawn.status === "refused" ? withdrawn.reason : ""], ["refused", "agent-mandate-refused"]);
    assert.equal(await permitState(permitForeign), "active", "T7c: refused before anything was spent");
    assert.equal(await snapshot(), snap);
    await mandate(["record-work", "set-work-declared-state"], [{ kind: "domain", workDomainId: eng }]);

    /* ── T10 · THE PRE-MODEL PREFLIGHT, and the writer behind it. ── */
    const engItem10 = await domainItem(acme, eng);
    const quiet = async (label: string, run: () => Promise<{ status: string; detail?: string }>, detail: string) => {
      const [s0, i0, r0] = [shown.length, await count("heby_origination_invocations"), await count("heby_action_requests")];
      const r = await run();
      assert.deepEqual([r.status, r.detail], ["refused", detail], `T10 ${label}`);
      assert.equal(shown.length, s0, `T10 ${label}: no model call`);
      assert.equal(await count("heby_origination_invocations"), i0, `T10 ${label}: no invocation registered`);
      assert.equal(await count("heby_action_requests"), r0, `T10 ${label}: nothing filed`);
    };
    /* T10a · responsibility REVOKED after an earlier successful proposal for the same domain. */
    await mandate(["record-work", "set-work-declared-state"], [{ kind: "domain", workDomainId: fin }]);
    await quiet("revoked responsibility", () => propose(acme, engItem10, "active") as never, "work-outside-agent-responsibility");
    /* T10b · the whole mandate's scope withdrawn. */
    await mandate([], []);
    await quiet("withdrawn scope", () => propose(acme, engItem10, "active") as never, "action-outside-agent-mandate");
    await mandate(["record-work", "set-work-declared-state"], [{ kind: "domain", workDomainId: eng }]);
    /* T10c · the mandate cannot be read: fail closed. */
    await quiet(
      "unreadable mandate",
      () => originateWorkStateChange({ workItemId: engItem10, toState: "active" }, { ...originationDeps(acme), preflight: (t, a, w) => preflightWorkStateOrigination(t, a, w, { getDb: () => null }) }) as never,
      "agent-mandate-authority-unavailable",
    );
    /* T10d · no preflight supplied: nothing is asked. */
    await quiet(
      "missing preflight",
      () => originateWorkStateChange({ workItemId: engItem10, toState: "active" }, { ...originationDeps(acme), preflight: undefined as never }) as never,
      "agent-mandate-authority-unavailable",
    );
    /* T10e · a preflight that throws is a refusal, not a pass. */
    await quiet(
      "throwing preflight",
      () => originateWorkStateChange({ workItemId: engItem10, toState: "active" }, { ...originationDeps(acme), preflight: async () => { throw new Error("boom"); } }) as never,
      "agent-mandate-authority-unavailable",
    );
    /* T10f · CONCURRENT REVISION: the preflight admits, the mandate loses the domain while the model runs,
     * and the one writer — the authoritative check — refuses. The model was called; nothing is filed. */
    {
      const [s0, i0, r0] = [shown.length, await count("heby_origination_invocations"), await count("heby_action_requests")];
      duringGenerate = () => mandate(["record-work", "set-work-declared-state"], [{ kind: "domain", workDomainId: fin }]);
      const raced = await propose(acme, engItem10, "active");
      duringGenerate = null;
      assert.deepEqual([raced.status, raced.status === "refused" ? raced.detail : ""], ["refused", "work-outside-agent-responsibility"], "T10f: the writer refuses a revision made after the preflight");
      assert.equal(shown.length, s0 + 1, "T10f: the preflight had admitted, so the model was asked");
      assert.equal(await count("heby_action_requests"), r0, "T10f: nothing filed");
      assert.equal(await count("heby_origination_invocations"), i0 + 1);
      const settled = (await q<{ filing_outcome: string; filing_refusal: string }>(
        "select filing_outcome, filing_refusal from heby_origination_invocations order by finalized_at desc nulls last limit 1",
      ))[0]!;
      assert.deepEqual([settled.filing_outcome, settled.filing_refusal], ["refused", "work-outside-agent-responsibility"], "T10f: the invocation records the writer's refusal");
      await mandate(["record-work", "set-work-declared-state"], [{ kind: "domain", workDomainId: eng }]);
    }
    /* T10g · restored responsibility: the same item proposes again. */
    const back = await propose(acme, engItem10, "active");
    assert.equal(back.status, "proposed", JSON.stringify(back));

    /* ── the model declines, or breaks the contract: nothing is filed. ── */
    const engItem9 = await domainItem(acme, eng);
    const requestsBefore = await count("heby_action_requests");
    reply = '{"kind":"none","reason":"Nothing here needs a proposal."}';
    const declined = await propose(acme, engItem9, "complete");
    assert.deepEqual([declined.status, declined.status === "refused" ? declined.reason : ""], ["refused", "no-action-proposed"]);
    reply = '{"kind":"record-work","reason":"A different act."}';
    const wrongKind = await propose(acme, engItem9, "complete");
    assert.deepEqual([wrongKind.status, wrongKind.status === "refused" ? wrongKind.reason : ""], ["refused", "unsupported-action-kind"]);
    reply = 'Sure! {"kind":"set-work-declared-state","reason":"x"}';
    const prose = await propose(acme, engItem9, "complete");
    assert.deepEqual([prose.status, prose.status === "refused" ? prose.reason : ""], ["refused", "not-a-structured-object"]);
    assert.equal(await count("heby_action_requests"), requestsBefore, "a decline or a broken reply files nothing");

    /* ── T9 · RECORD-WORK UNCHANGED BESIDE IT, and no machine or standing row anywhere. ── */
    await domainItem(acme, eng);
    assert.equal(await count("action_execution_attempts"), 0, "no execution-attempt row for an internal act");
    assert.equal(await count("heby_action_requests", "action_kind='set-work-declared-state' and standing_authorization_id is not null"), 0);

    console.log("work-update-v1/work-state-postgres: OK");
  } finally {
    await setup.end();
    await handle.dispose();
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
