/*
 * WORK-UPDATE-AGENT-SELECTION-1 — the work-state agent choice AGAINST A REAL DATABASE.
 *
 * A disposable local database, created by this process and dropped on exit. The model is a stub; no
 * provider is reached. Agents, mandates, a suspension and work items are written only inside it.
 *
 *   P1  one in-service agent: the list names it; a proposal WITHOUT a selection resolves it, as released
 *   P2  two in-service agents, no selection: refused `ambiguous-durable-agent-identity` before any
 *       invocation or model call
 *   P3  the list: in-service only (a suspended agent is absent), each with the responsibility the
 *       eligibility projection gives for this kind and the item's domain
 *   P4  explicit selection: the chosen agent is the invocation's agent and the request's proposer
 *   P5  invalid, suspended and foreign selections refuse at the resolver; a non-responsible selection
 *       refuses at the preflight — none registers an invocation or reaches the model
 *   P6  tenant isolation of the list: another organization's item is unavailable
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { createDurableAgentIdentity } from "../../src/features/agent-identity/create-durable-agent-identity.server";
import { suspendDurableAgentIdentity } from "../../src/features/agent-identity/suspend-durable-agent-identity.server";
import { establishAgentMandateWithResponsibility } from "../../src/features/agent-mandate/establish-agent-mandate.server";
import { recordWorkDomain } from "../../src/features/work-domain/write-work-domain.server";
import { proposeRecordWorkAction } from "../../src/features/heby-action-inlet/record-work-proposal.server";
import { approveActionRequest } from "../../src/features/action-authorization/decide-action-request.server";
import { executeRecordWork } from "../../src/features/governed-internal-action/execute-record-work.server";
import { originateWorkStateChange } from "../../src/features/agent-origination/originate-work-state.server";
import { asHumanTenantContext, type TenantContext } from "../../src/features/auth/tenant/tenant-context";
import {
  preflightWorkStateOrigination,
  readWorkStateAgentChoices,
} from "../../src/features/origination-availability/read-origination-availability.server";
import type { WorkScope } from "../../src/features/work-domain/work-scope";

const GENESIS = "I am establishing this organization's Governance authority so consequential acts can be decided.";
const APPROVE = "I have read this state change and I authorize it for this organization.";
const MANDATE = "I am bounding what this agent may propose and which work it is responsible for.";
const REGISTER = "Register this agent for the organization.";
const SUSPEND = "Suspend this agent while the work-state choice is proven.";
const PURPOSE = "Propose changes to the declared state of existing work items within the agent's assigned responsibility domains.";

type Seeded = { tenantId: string; userId: string; authIdentityId: string; membershipId: string; roleId: string };

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_wu_agent_selection");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const db = handle.db;
  const deps = { getDb: () => db } as never;
  const q = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await setup.query(sql, params)).rows as T[];
  const count = async (table: string) => Number((await q<{ n: number }>(`select count(*)::int as n from ${table}`))[0]!.n);

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
      mfaVerified: false, requestId: `wuas-${slug}`, authenticatedAt: new Date().toISOString(),
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
  let titles = 0;
  const domainItem = async (ctx: TenantContext, workDomainId: string): Promise<string> => {
    const p = await proposeRecordWorkAction(
      ctx,
      { title: `Work item ${++titles}`, department: { kind: "organization-level" }, workScope: { kind: "domain", workDomainId } } as never,
      deps,
    );
    assert.equal(p.status, "proposed", JSON.stringify(p));
    const a = await approveActionRequest(ctx, { requestId: p.status === "proposed" ? p.receipt.requestId : "", justification: APPROVE }, deps);
    assert.equal(a.status, "authorized");
    const e = await executeRecordWork(ctx, { permitId: a.status === "authorized" ? a.permitId : "" }, deps);
    assert.equal(e.status, "executed", JSON.stringify(e));
    return e.status === "executed" && e.outcome.status === "recorded" ? e.outcome.workItem.workItemId : "";
  };
  const agent = async (ctx: TenantContext, name: string, scope: string[], workDomainId: string): Promise<string> => {
    const r = await createDurableAgentIdentity(ctx, { name, justification: REGISTER }, deps);
    assert.equal(r.status, "established", JSON.stringify(r));
    const agentId = r.status === "established" ? r.identity.agentId : "";
    const m = await establishAgentMandateWithResponsibility(
      ctx,
      { agentId, purpose: PURPOSE, proposalScope: scope, justification: MANDATE, observedMandateRevision: null, responsibility: [{ kind: "domain", workDomainId }] },
      deps,
    );
    assert.equal(m.status, "established", JSON.stringify(m));
    return agentId;
  };

  let modelCalls = 0;
  const originationDeps = (ctx: TenantContext) => ({
    resolveTenant: async () => ctx,
    /* WORK-UPDATE-ORGANIZATION-SCOPE-1: the preflight takes the item's recorded scope, not a bare domain id. */
    preflight: (t: TenantContext, agentId: string, workScope: WorkScope) => preflightWorkStateOrigination(t, agentId, workScope, deps),
    resolveDirectorEnabled: async () => true,
    selectTransport: (() => ({ transport: {} as never, transportProvenance: "fake" as const })) as never,
    generate: (async () => {
      modelCalls++;
      return {
        status: "generated",
        result: { text: '{"kind":"set-work-declared-state","reason":"The person chose this state."}', provider: "stub", model: "stub-model", providerRequestId: `stub-${modelCalls}`, inputTokens: 1, outputTokens: 1 },
      };
    }) as never,
    agentIdentity: deps,
    proposal: deps,
    provenance: deps,
  });
  const propose = (ctx: TenantContext, workItemId: string, agentId?: string) =>
    originateWorkStateChange({ workItemId, toState: "active", ...(agentId === undefined ? {} : { agentId }) }, originationDeps(ctx));
  const proposerOf = async (requestId: string) =>
    (await q<{ t: string; id: string }>("select proposed_by_actor_type t, proposed_by_actor_id id from heby_action_requests where id=$1", [requestId]))[0]!;
  const lastInvocationAgent = async () =>
    (await q<{ agent_id: string }>("select agent_id from heby_origination_invocations order by created_at desc limit 1"))[0]!.agent_id;
  const STATE_KINDS = ["record-work", "set-work-declared-state"];

  try {
    const acme = await governed("acme-wuas");
    const globex = await governed("globex-wuas");
    const eng = await domain(acme, "engineering");
    const globexEng = await domain(globex, "engineering");

    /* ── P1 · ONE AGENT: released single-agent behaviour ── */
    const heby = await agent(acme, "Heby", STATE_KINDS, eng);
    const item1 = await domainItem(acme, eng);
    assert.deepEqual(await readWorkStateAgentChoices(acme, item1, deps), { status: "read", agents: [{ agentId: heby, name: "Heby", responsible: true }] }, "P1: the list names the one agent");
    const single = await propose(acme, item1);
    assert.equal(single.status, "proposed", JSON.stringify(single));
    assert.deepEqual(await proposerOf(single.status === "proposed" ? single.requestId : ""), { t: "agent", id: heby }, "P1: no selection, the one agent proposes");

    /* ── P2 · TWO AGENTS, NO SELECTION: ambiguous, before anything ── */
    const bolt = await agent(acme, "Bolt", STATE_KINDS, eng);
    const atlas = await agent(acme, "Atlas", ["record-work"], eng);
    const sleepy = await agent(acme, "Sleepy", STATE_KINDS, eng);
    assert.equal((await suspendDurableAgentIdentity(acme, { agentId: sleepy, justification: SUSPEND }, deps)).status, "suspended");
    const item2 = await domainItem(acme, eng);
    const [inv0, calls0, req0] = [await count("heby_origination_invocations"), modelCalls, await count("heby_action_requests")];
    const ambiguous = await propose(acme, item2);
    assert.deepEqual([ambiguous.status, ambiguous.status === "refused" ? ambiguous.reason : ""], ["refused", "ambiguous-durable-agent-identity"], "P2: refused, never a pick");

    /* ── P3 · THE LIST ── */
    const listed = await readWorkStateAgentChoices(acme, item2, deps);
    assert.deepEqual(
      listed.status === "read" ? [...listed.agents].sort((x, y) => x.name.localeCompare(y.name)) : listed,
      [
        { agentId: atlas, name: "Atlas", responsible: false },
        { agentId: bolt, name: "Bolt", responsible: true },
        { agentId: heby, name: "Heby", responsible: true },
      ],
      "P3: in service only (Sleepy is absent), responsibility for this kind and domain",
    );

    /* ── P5 · REFUSED SELECTIONS ── */
    const globexAgent = await agent(globex, "Gamma", STATE_KINDS, globexEng);
    for (const [label, selected, reason] of [
      ["invalid", "not-a-uuid", "selected-agent-unresolvable"],
      ["unknown", "55555555-5555-4555-8555-555555555555", "selected-agent-unresolvable"],
      ["foreign", globexAgent, "selected-agent-unresolvable"],
      ["suspended", sleepy, "selected-agent-retired"],
    ] as const) {
      const r = await propose(acme, item2, selected);
      assert.deepEqual([r.status, r.status === "refused" ? r.reason : ""], ["refused", reason], `P5: ${label} selection`);
    }
    const outside = await propose(acme, item2, atlas);
    assert.deepEqual([outside.status, outside.status === "refused" ? outside.detail : ""], ["refused", "action-outside-agent-mandate"], "P5: a non-responsible selection is refused by the preflight");
    assert.equal(await count("heby_origination_invocations"), inv0, "P2/P5: no refusal registered an invocation");
    assert.equal(modelCalls, calls0, "P2/P5: no refusal reached the model");
    assert.equal(await count("heby_action_requests"), req0, "P2/P5: no refusal filed a request");

    /* ── P4 · EXPLICIT SELECTION ── */
    const chosen = await propose(acme, item2, bolt);
    assert.equal(chosen.status, "proposed", JSON.stringify(chosen));
    assert.deepEqual(await proposerOf(chosen.status === "proposed" ? chosen.requestId : ""), { t: "agent", id: bolt }, "P4: the chosen agent is the proposer");
    assert.equal(await lastInvocationAgent(), bolt, "P4: and the invocation's agent");

    /* ── P6 · TENANT ISOLATION OF THE LIST ── */
    const globexItem = await domainItem(globex, globexEng);
    assert.deepEqual(await readWorkStateAgentChoices(acme, globexItem, deps), { status: "unavailable" }, "P6: a foreign item lists nobody");
    assert.deepEqual(await readWorkStateAgentChoices(globex, globexItem, deps), { status: "read", agents: [{ agentId: globexAgent, name: "Gamma", responsible: true }] }, "P6: its own tenant sees only its own agent");

    console.log("work-update-agent-selection-1/selection-postgres: OK");
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
