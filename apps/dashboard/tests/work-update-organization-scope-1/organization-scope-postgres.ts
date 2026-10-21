/*
 * WORK-UPDATE-ORGANIZATION-SCOPE-1 — `set-work-declared-state` for ORGANIZATION-LEVEL work, against a
 * real disposable PostgreSQL database.
 *
 * The released origination, proposal writer, Governance approval, permit spend and Work door; the
 * model is a stub that records what it was shown. Dropped on exit.
 *
 *   O1  an organization grant admits organization work; a domain grant does not
 *   O2  an organization grant does not admit domain work
 *   O3  NULL scope stays refused before any model call, under every grant
 *   O4  the organization payload is exactly { workItemRef, fromState, toState, workScope }
 *   O5  a domain payload — and its digest — is byte-for-byte the released shape
 *   O6  the human door executes an organization change once, authored system
 *   O7  scope and state are re-checked under the row lock: a mismatch refuses, the permit stays active,
 *       nothing is written
 *   O8  the machine door refuses the kind (its allowlist is record-work only); the permit stays active
 *   O9  another tenant cannot spend the permit
 *   O10 the model is shown no work data
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
import { executeRecordWork } from "../../src/features/governed-internal-action/execute-record-work.server";
import { executeSetWorkDeclaredState } from "../../src/features/governed-internal-action/execute-set-work-state.server";
import { executeRecordWorkAsMachine } from "../../src/features/governed-machine-execution/execute-record-work-as-machine.server";
import { recordWork } from "../../src/features/organizational-work/write-work.server";
import { originateWorkStateChange, WORK_STATE_ORIGINATION_GOALS } from "../../src/features/agent-origination/originate-work-state.server";
import { digestCanonicalAction } from "../../src/features/action-authorization/canonical-payload";
import { asHumanTenantContext, type TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { preflightWorkStateOrigination } from "../../src/features/origination-availability/read-origination-availability.server";
import type { WorkScope } from "../../src/features/work-domain/work-scope";

const GENESIS = "I am establishing this organization's Governance authority so consequential acts can be decided.";
const APPROVE = "I have read this state change and I authorize it for this organization.";
const MANDATE = "I am bounding what this agent may propose and which work it is responsible for.";
const PURPOSE =
  "Assist authorized people in proposing changes to the declared state of existing work items within the agent's assigned responsibility.";

type Seeded = { tenantId: string; userId: string; authIdentityId: string; membershipId: string; roleId: string };

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_wu_org_scope");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const db = handle.db;
  const deps = { getDb: () => db } as never;
  const q = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await setup.query(sql, params)).rows as T[];
  const count = async (table: string) => Number((await q<{ n: number }>(`select count(*)::int as n from ${table}`))[0]!.n);
  const permitState = async (id: string) => (await q<{ status: string }>("select status from action_permits where id=$1", [id]))[0]!.status;
  const stateOf = async (id: string) =>
    (await q<{ declared_state: string; updated_by_type: string }>("select declared_state, updated_by_type from work_items where id=$1", [id]))[0]!;
  const snapshot = async () =>
    JSON.stringify(
      await q(
        `select (select count(*) from audit_log) a, (select count(*) from heby_action_requests) r,
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
      mfaVerified: false, requestId: `wuos-${slug}`, authenticatedAt: new Date().toISOString(),
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

  /* Scoped work through the released governed record-work path (a human proposal). */
  let titles = 0;
  const scopedItem = async (ctx: TenantContext, workScope: WorkScope): Promise<string> => {
    const p = await proposeRecordWorkAction(ctx, { title: `Work item ${++titles}`, department: { kind: "organization-level" }, workScope } as never, deps);
    assert.equal(p.status, "proposed", JSON.stringify(p));
    const a = await approveActionRequest(ctx, { requestId: p.status === "proposed" ? p.receipt.requestId : "", justification: APPROVE }, deps);
    assert.equal(a.status, "authorized");
    const e = await executeRecordWork(ctx, { permitId: a.status === "authorized" ? a.permitId : "" }, deps);
    assert.equal(e.status, "executed", JSON.stringify(e));
    return e.status === "executed" && e.outcome.status === "recorded" ? e.outcome.workItem.workItemId : "";
  };

  const shown: unknown[] = [];
  const originationDeps = (ctx: TenantContext) => ({
    resolveTenant: async () => ctx,
    preflight: (t: TenantContext, agentId: string, workScope: WorkScope) => preflightWorkStateOrigination(t, agentId, workScope, deps),
    resolveDirectorEnabled: async () => true,
    selectTransport: (() => ({ transport: {} as never, transportProvenance: "fake" as const })) as never,
    generate: (async (request: unknown) => {
      shown.push(request);
      return {
        status: "generated",
        result: { text: '{"kind":"set-work-declared-state","reason":"The person asked for this state."}', provider: "stub", model: "stub-model", providerRequestId: `stub-${shown.length}`, inputTokens: 1, outputTokens: 1 },
      };
    }) as never,
    agentIdentity: deps,
    proposal: deps,
    provenance: deps,
  });
  const propose = (ctx: TenantContext, workItemId: string, toState: string) => originateWorkStateChange({ workItemId, toState }, originationDeps(ctx));
  const approve = async (ctx: TenantContext, requestId: string) => {
    const a = await approveActionRequest(ctx, { requestId, justification: APPROVE }, deps);
    assert.equal(a.status, "authorized", JSON.stringify(a));
    return a.status === "authorized" ? a.permitId : "";
  };
  const requestRow = async (id: string) =>
    (await q<{ payload: Record<string, unknown>; payload_digest: string; action_kind: string; tool_id: string; target_kind: string; target_ref: string }>(
      "select canonical_payload payload, payload_digest, action_kind, tool_id, target_kind, target_ref from heby_action_requests where id=$1",
      [id],
    ))[0]!;

  try {
    const acme = await governed("acme-wuos");
    const globex = await governed("globex-wuos");
    const eng = (await recordWorkDomain(acme, { slug: "engineering", name: "Engineering" }, deps)) as { status: string; workDomain: { workDomainId: string } };
    const engId = eng.workDomain.workDomainId;

    const orgItem = await scopedItem(acme, { kind: "organization" });
    const domainItem = await scopedItem(acme, { kind: "domain", workDomainId: engId });
    const unscoped = await recordWork(acme, { title: "Legacy unscoped item" }, deps);
    const nullItem = unscoped.status === "recorded" ? unscoped.workItem.workItemId : "";
    assert.deepEqual(
      (await q("select work_scope_kind k, work_domain_id d from work_items where id = any($1) order by created_at", [[orgItem, domainItem, nullItem]])).map((r) => (r as { k: string | null }).k),
      ["organization", "domain", null],
      "fixture: one item of each recorded scope",
    );

    const agentR = await createDurableAgentIdentity(acme, { name: "Heby", justification: "Register this agent for the organization." }, deps);
    const agentId = agentR.status === "established" ? agentR.identity.agentId : "";
    let revision = 0;
    const mandate = async (responsibility: unknown[]) => {
      const r = await establishAgentMandateWithResponsibility(
        acme,
        { agentId, purpose: PURPOSE, proposalScope: ["record-work", "set-work-declared-state"], justification: MANDATE, observedMandateRevision: revision === 0 ? null : revision, responsibility },
        deps,
      );
      assert.equal(r.status, "established", JSON.stringify(r));
      revision++;
    };
    const refusedBeforeModel = async (id: string, detailOrReason: string, label: string) => {
      const [s0, r0] = [shown.length, await count("heby_action_requests")];
      const r = await propose(acme, id, "active");
      assert.equal(r.status, "refused", label);
      const why = r.status === "refused" ? [r.reason, (r as { detail?: string }).detail] : [];
      assert.ok(why.includes(detailOrReason as never), `${label}: ${JSON.stringify(r)}`);
      assert.equal(shown.length, s0, `${label}: no model call`);
      assert.equal(await count("heby_action_requests"), r0, `${label}: no request`);
    };

    /* ── O1 (negative) · a DOMAIN grant does not cover organization work. ── */
    await mandate([{ kind: "domain", workDomainId: engId }]);
    await refusedBeforeModel(orgItem, "work-outside-agent-responsibility", "O1: domain grant, organization item");

    /* ── O5 · the domain proposal is the released shape, and so is its digest. ── */
    const d = await propose(acme, domainItem, "active");
    assert.equal(d.status, "proposed", JSON.stringify(d));
    const dRow = await requestRow(d.status === "proposed" ? d.requestId : "");
    const releasedDomainPayload = {
      workItemRef: `work-item/${domainItem}`,
      fromState: "planned",
      toState: "active",
      workScope: "domain",
      workDomainRef: `work-domain/${engId}`,
    };
    assert.deepEqual(dRow.payload, releasedDomainPayload, "O5: domain payload unchanged");
    assert.equal(
      dRow.payload_digest,
      digestCanonicalAction({ actionKind: dRow.action_kind, toolId: dRow.tool_id, targetKind: dRow.target_kind, targetRef: dRow.target_ref, payload: releasedDomainPayload } as never),
      "O5: the domain digest is the digest of the released shape",
    );

    /* ── O3 · NULL scope stays refused, under a domain grant … ── */
    await refusedBeforeModel(nullItem, "work-not-domain-scoped", "O3: NULL scope, domain grant");

    /* ── O2 · an ORGANIZATION grant does not cover domain work. ── */
    await mandate([{ kind: "organization" }]);
    const otherDomainItem = await scopedItem(acme, { kind: "domain", workDomainId: engId });
    await refusedBeforeModel(otherDomainItem, "work-outside-agent-responsibility", "O2: organization grant, domain item");
    /* … and under an organization grant. */
    await refusedBeforeModel(nullItem, "work-not-domain-scoped", "O3: NULL scope, organization grant");

    /* ── O1 · an organization grant admits organization work; O4 · the payload is exactly bound. ── */
    const o = await propose(acme, orgItem, "active");
    assert.equal(o.status, "proposed", JSON.stringify(o));
    const oRequest = o.status === "proposed" ? o.requestId : "";
    const oRow = await requestRow(oRequest);
    assert.deepEqual(oRow.payload, { workItemRef: `work-item/${orgItem}`, fromState: "planned", toState: "active", workScope: "organization" }, "O4: organization payload, no domain reference");
    assert.equal(oRow.target_ref, `work-item/${orgItem}`);

    /* ── O10 · the model saw no work data, for either scope. ── */
    for (const request of shown.slice(-2)) {
      const r = request as { userPrompt: string; evidence: unknown[] };
      assert.equal(r.userPrompt, WORK_STATE_ORIGINATION_GOALS.active, "O10: the fixed goal sentence");
      assert.deepEqual(r.evidence, [], "O10: no grounding line");
      const text = JSON.stringify(request);
      for (const secret of [orgItem, domainItem, engId, "Work item", "work-item/", "work-domain/"]) {
        assert.ok(!text.includes(secret), `O10: the model was not shown ${secret}`);
      }
    }
    /* The scope never reaches the model: a domain and an organization proposal send the same request. */
    const sans = (r: unknown) => JSON.stringify(r).replace(/"correlationId":"[^"]*",?/, "");
    assert.equal(sans(shown[shown.length - 1]), sans(shown[shown.length - 2]), "O10: identical model requests for both scopes");

    /* ── O8 · the machine door refuses this kind; the permit stays active, nothing written. ── */
    const permit = await approve(acme, oRequest);
    let snap = await snapshot();
    const machine = await executeRecordWorkAsMachine({ permitId: permit }, { getDb: () => db, armed: async () => true } as never);
    assert.equal(machine.status, "refused");
    assert.equal(machine.status === "refused" ? machine.reason : "", "action-kind-not-machine-executable", JSON.stringify(machine));
    assert.equal(await permitState(permit), "active", "O8: the machine door spent nothing");
    assert.equal(await snapshot(), snap, "O8: nothing written");

    /* ── O9 · another tenant cannot spend it. ── */
    const crossed = await executeSetWorkDeclaredState(globex, { permitId: permit }, deps);
    assert.deepEqual([crossed.status, crossed.status === "refused" ? crossed.reason : ""], ["refused", "permit-not-consumable"]);
    assert.equal(await permitState(permit), "active");
    assert.equal(await snapshot(), snap);

    /* ── O7a · scope re-checked under the lock: an organization item re-scoped to a domain refuses. ── */
    await q("alter table work_items disable trigger user");
    await q("update work_items set work_scope_kind='domain', work_domain_id=$1 where id=$2", [engId, orgItem]);
    await q("alter table work_items enable trigger user");
    snap = await snapshot();
    const moved = await executeSetWorkDeclaredState(acme, { permitId: permit }, deps);
    assert.deepEqual([moved.status, moved.status === "refused" ? moved.authorityReason : ""], ["refused", "work-scope-changed"], "O7a: scope mismatch");
    assert.equal(await permitState(permit), "active", "O7a: the spend rolled back");
    assert.equal(await snapshot(), snap, "O7a: nothing written");
    await q("alter table work_items disable trigger user");
    await q("update work_items set work_scope_kind='organization', work_domain_id=null where id=$1", [orgItem]);
    await q("alter table work_items enable trigger user");

    /* ── O7b · state re-checked under the lock. ── */
    await q("alter table work_items disable trigger user");
    await q("update work_items set declared_state='blocked' where id=$1", [orgItem]);
    await q("alter table work_items enable trigger user");
    snap = await snapshot();
    const stale = await executeSetWorkDeclaredState(acme, { permitId: permit }, deps);
    assert.deepEqual([stale.status, stale.status === "refused" ? stale.authorityReason : ""], ["refused", "work-state-changed"], "O7b: state mismatch");
    assert.equal(await permitState(permit), "active");
    assert.equal(await snapshot(), snap);
    await q("alter table work_items disable trigger user");
    await q("update work_items set declared_state='planned' where id=$1", [orgItem]);
    await q("alter table work_items enable trigger user");

    /* ── O6 · the human door executes the organization change once, authored system. ── */
    const done = await executeSetWorkDeclaredState(acme, { permitId: permit }, deps);
    assert.equal(done.status, "executed", JSON.stringify(done));
    assert.equal(await permitState(permit), "consumed");
    assert.deepEqual(await stateOf(orgItem), { declared_state: "active", updated_by_type: "system" });
    const replay = await executeSetWorkDeclaredState(acme, { permitId: permit }, deps);
    assert.deepEqual([replay.status, replay.status === "refused" ? replay.reason : ""], ["refused", "permit-not-consumable"], "O6: single use");

    console.log("work-update-organization-scope-1/organization-scope-postgres: OK");
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
