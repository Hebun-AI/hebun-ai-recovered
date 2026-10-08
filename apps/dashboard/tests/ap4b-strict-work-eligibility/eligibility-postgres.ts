/*
 * AP-4B — STRICT AGENT WORK ELIGIBILITY, AGAINST A REAL DATABASE (PG18, disposable).
 *
 * Every row is written by the released writer that owns it. Two organizations; Acme has work domains
 * `engineering` and `finance` and two agents: Heby {organization, engineering} and Ledger {finance}.
 *
 *   L1 no unscoped record-work: a proposal with no scope is refused, by the inlet and — for a
 *      contradictory scope that passes the tool schema — by the one writer every inlet reaches.
 *   L2 the inlet resolves the domain: another tenant's is not-found, a retired one is retired.
 *   L3 a human-scoped proposal → approval → spend records work WITH its scope (write-once columns).
 *   L4 the agent inlet admits only the work its mandate's responsibility names.
 *   L5 the scope is digest-bound: two scopes are two payloads; approval cannot change the scope and
 *      the permit binds the same scoped digest.
 *   L6 a responsibility withdrawn after approval stops the spend (fail closed, permit stays active);
 *      re-granted, the same permit spends and the work carries the approved scope.
 *   L7 a domain retired after approval stops the spend — the agent's grant no longer admits, and for
 *      a human proposal the Work Authority refuses — the permit stays active.
 *   L8 listEligibleAgents is a read-only projection: right agents per scope, writes nothing.
 *   L9 the direct human WORK-1 path stays unscoped (NULL/NULL).
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { createDurableAgentIdentity } from "../../src/features/agent-identity/create-durable-agent-identity.server";
import { establishAgentMandateWithResponsibility } from "../../src/features/agent-mandate/establish-agent-mandate.server";
import { recordWorkDomain, retireWorkDomain } from "../../src/features/work-domain/write-work-domain.server";
import { resolveAgentProposer } from "../../src/features/action-authorization/agent-proposer.server";
import {
  proposeAgentOriginatedRecordWorkAction,
  proposeRecordWorkAction,
} from "../../src/features/heby-action-inlet/record-work-proposal.server";
import { approveActionRequest } from "../../src/features/action-authorization/decide-action-request.server";
import { recordActionRequest } from "../../src/features/action-authorization/record-action-request.server";
import { prepareAction } from "../../src/features/heby-actions/action-preparer";
import { RECORD_WORK_ACTION_KIND } from "../../src/features/heby-action-inlet/contracts";
import { formatOrganizationRef } from "../../src/features/organization-authority/organization-ref";
import { readOrganizationAuthority } from "../../src/features/organization-authority/read-organization.server";
import { executeRecordWork } from "../../src/features/governed-internal-action/execute-record-work.server";
import { recordWork } from "../../src/features/organizational-work/write-work.server";
import { listEligibleAgents } from "../../src/features/origination-availability/list-eligible-agents.server";
import { asHumanTenantContext, type TenantContext } from "../../src/features/auth/tenant/tenant-context";
import type { AgentProposer } from "../../src/features/action-authorization/agent-proposer.server";
import type { WorkScope } from "../../src/features/work-domain/work-scope";

const GENESIS = "I am establishing this organization's Governance authority so consequential acts can be decided.";
const APPROVE = "This work is real and I want it on the organization's register.";
const MANDATE = "I am bounding what this agent may propose and which work it is responsible for.";
const PURPOSE = "Proposes organizational work records for a human to review and decide on.";
const ORG: WorkScope = { kind: "organization" };

type Seeded = { tenantId: string; userId: string; authIdentityId: string; membershipId: string; roleId: string };

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_ap4b_eligibility");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db } as never;
  const n = async (sql: string, params: unknown[] = []) => (await setup.query<{ n: number }>(sql.replace(/^select count\(\*\)/, "select count(*)::int as n"), params)).rows[0]!.n;

  const governed = async (slug: string): Promise<TenantContext> => {
    const s = (await seedLocalIdentity(setup, { companyName: slug, companySlug: slug, email: `director@${slug}.test` })) as Seeded;
    const session = (
      await setup.query<{ id: string }>(
        `insert into user_session_contexts
           (auth_identity_id, provider_session_reference_hash, provider_session_reference_digest_version,
            user_id, active_tenant_id, active_membership_id, membership_version, assurance_level,
            mfa_verified, authenticated_at, issued_at, last_activity_at, absolute_expires_at, inactivity_expires_at)
         values ($1, md5($2) || md5($2), 1, $3, $4, $5, 1, 'aal1', false, now(), now(), now(),
                 now() + interval '1 day', now() + interval '1 hour') returning id`,
        [s.authIdentityId, slug, s.userId, s.tenantId, s.membershipId],
      )
    ).rows[0]!.id;
    const ctx = asHumanTenantContext({
      tenantId: s.tenantId, userId: s.userId, authIdentityId: s.authIdentityId, membershipId: s.membershipId,
      membershipVersion: 1, roleId: s.roleId, sessionContextId: session, provider: "local", assuranceLevel: "aal1",
      mfaVerified: false, requestId: `ap4b-${slug}`, authenticatedAt: new Date().toISOString(),
    });
    await setup.query(
      `insert into genesis_nominations (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
         accepted_at, accepted_session_context_id, accepted_assurance_level)
       values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
      [s.tenantId, s.authIdentityId, s.userId, session],
    );
    assert.equal((await establishGovernanceAuthority(ctx, { justification: GENESIS }, deps)).status, "established");
    return ctx;
  };
  const domain = async (ctx: TenantContext, slug: string, name: string): Promise<string> => {
    const r = await recordWorkDomain(ctx, { slug, name }, deps);
    assert.equal(r.status, "recorded");
    return r.status === "recorded" ? r.workDomain.workDomainId : "";
  };

  try {
    const acme = await governed("acme-ap4b");
    const globex = await governed("globex-ap4b");
    const eng = await domain(acme, "engineering", "Engineering");
    const fin = await domain(acme, "finance", "Finance");
    const old = await domain(acme, "legacy-ops", "Legacy Ops");
    assert.equal((await retireWorkDomain(acme, { workDomainId: old }, deps)).status, "recorded");
    const foreign = await domain(globex, "engineering", "Engineering");

    const agent = async (name: string) => {
      const r = await createDurableAgentIdentity(acme, { name, justification: "Register this agent for the organization." }, deps);
      assert.equal(r.status, "established");
      return r.status === "established" ? r.identity.agentId : "";
    };
    const heby = await agent("Heby");
    const ledger = await agent("Ledger");
    const grant = async (agentId: string, observed: number | null, responsibility: unknown[]) => {
      const r = await establishAgentMandateWithResponsibility(
        acme,
        { agentId, purpose: PURPOSE, proposalScope: ["record-work"], justification: MANDATE, observedMandateRevision: observed, responsibility },
        deps,
      );
      assert.equal(r.status, "established", JSON.stringify(r));
    };
    await grant(heby, null, [{ kind: "organization" }, { kind: "domain", workDomainId: eng }]);
    await grant(ledger, null, [{ kind: "domain", workDomainId: fin }]);
    const proposerOf = async (agentId: string): Promise<AgentProposer> => {
      const r = await resolveAgentProposer(acme, deps, { agentId });
      assert.equal(r.status, "resolved");
      if (r.status !== "resolved") throw new Error("unreachable");
      return r.proposer;
    };
    const hebyP = await proposerOf(heby);
    const ledgerP = await proposerOf(ledger);
    const D = (id: string): WorkScope => ({ kind: "domain", workDomainId: id });
    const human = (title: string, workScope: unknown) =>
      proposeRecordWorkAction(acme, { title, department: { kind: "organization-level" }, workScope } as never, deps);
    const byAgent = (p: AgentProposer, title: string, workScope: WorkScope) =>
      proposeAgentOriginatedRecordWorkAction(acme, { title, department: { kind: "organization-level" }, workScope }, p, deps);
    const requestIdOf = (r: Awaited<ReturnType<typeof human>>) => {
      assert.equal(r.status, "proposed", JSON.stringify(r));
      return r.status === "proposed" ? r.receipt.requestId : "";
    };
    const approve = async (requestId: string) => {
      const a = await approveActionRequest(acme, { requestId, justification: APPROVE }, deps);
      assert.equal(a.status, "authorized");
      return a.status === "authorized" ? a.permitId : "";
    };
    const permitStatus = async (permitId: string) =>
      (await setup.query<{ status: string }>(`select status from action_permits where id = $1`, [permitId])).rows[0]!.status;
    const workScopeOf = async (title: string) =>
      (await setup.query<{ k: string | null; d: string | null }>(`select work_scope_kind k, work_domain_id d from work_items where title = $1`, [title])).rows;

    /* L1 — no unscoped record-work. */
    const before = await n(`select count(*) from heby_action_requests`);
    for (const scope of [undefined, null, {}, { kind: "org" }, { kind: "domain" }]) {
      const r = await human("Unscoped work", scope);
      assert.ok(r.status === "refused" && r.reason === "invalid-work-scope", `L1: ${JSON.stringify(scope)}`);
    }
    /* The tool schema requires `workScope`, but a domain scope with no reference passes it: the writer refuses. */
    const org = await readOrganizationAuthority(acme, deps);
    assert.equal(org.status, "available");
    const orgRef = formatOrganizationRef(org.status === "available" ? org.organization.organizationId : "");
    const contradictory = prepareAction({
      actionKind: RECORD_WORK_ACTION_KIND,
      requestingWorkspace: "command",
      target: { kind: "record", ref: orgRef, label: "acme-ap4b", sourceClass: "organization" },
      proposedArguments: { title: "Contradictory scope", departmentScope: "organization-level", workScope: "domain" },
      evidence: [{ sourceClass: "organization", recordRef: orgRef, lifecycle: "settled" }],
    });
    assert.equal(contradictory.lifecycleState, "REQUIRES_HUMAN_REVIEW", "L1: the schema alone admits it");
    const writerRefusal = await recordActionRequest(acme, contradictory, deps);
    assert.deepEqual(writerRefusal, { status: "refused", reason: "work-scope-required" }, "L1: the one writer refuses a scope it cannot read");
    assert.equal(await n(`select count(*) from heby_action_requests`), before, "L1: nothing filed");

    /* L2 — the domain is resolved by the Work Domain Authority's reader, in THIS tenant. */
    const foreignR = await human("Foreign domain work", D(foreign));
    assert.ok(foreignR.status === "refused" && foreignR.reason === "work-domain-not-found", "L2: another tenant's domain");
    const retiredR = await human("Retired domain work", D(old));
    assert.ok(retiredR.status === "refused" && retiredR.reason === "work-domain-retired", "L2: retired domain");

    /* L3 — human-scoped proposal → approval → spend; the work row carries the approved scope. */
    const engTitle = "Engineering supplier audit";
    const engPermit = await approve(requestIdOf(await human(engTitle, D(eng))));
    assert.equal((await executeRecordWork(acme, { permitId: engPermit }, deps)).status, "executed");
    assert.deepEqual(await workScopeOf(engTitle), [{ k: "domain", d: eng }], "L3: domain scope written");
    const orgTitle = "Organization offsite planning";
    const orgPermit = await approve(requestIdOf(await human(orgTitle, ORG)));
    assert.equal((await executeRecordWork(acme, { permitId: orgPermit }, deps)).status, "executed");
    assert.deepEqual(await workScopeOf(orgTitle), [{ k: "organization", d: null }], "L3: organization scope written");

    /* L4 — the agent inlet admits only what responsibility names. */
    const outside = await byAgent(hebyP, "Heby finance work", D(fin));
    assert.ok(outside.status === "refused" && outside.authorityRefusal === "work-outside-agent-responsibility", `L4: ${JSON.stringify(outside)}`);
    const ledgerOrg = await byAgent(ledgerP, "Ledger org work", ORG);
    assert.ok(ledgerOrg.status === "refused" && ledgerOrg.authorityRefusal === "work-outside-agent-responsibility", "L4: a domain grant covers no organization work");
    const hebyEngReq = requestIdOf(await byAgent(hebyP, "Heby engineering work", D(eng)));
    requestIdOf(await byAgent(hebyP, "Heby organization work", ORG));
    const ledgerFinReq = requestIdOf(await byAgent(ledgerP, "Ledger finance work", D(fin)));

    /* L5 — the scope is digest-bound and approval cannot change it. */
    const twinA = requestIdOf(await human("Twin work", ORG));
    const twinB = requestIdOf(await human("Twin work", D(eng)));
    const req = async (id: string) =>
      (await setup.query<{ digest: string; payload: Record<string, unknown> }>(`select payload_digest digest, canonical_payload payload from heby_action_requests where id = $1`, [id])).rows[0]!;
    assert.notEqual((await req(twinA)).digest, (await req(twinB)).digest, "L5: two scopes, two digests");
    const frozen = await req(twinB);
    const smuggled = await approveActionRequest(acme, { requestId: twinB, justification: APPROVE, workScope: ORG, payload: { workScope: "organization" } } as never, deps);
    assert.equal(smuggled.status, "authorized");
    const after = await req(twinB);
    assert.deepEqual(after, frozen, "L5: approval changed neither the payload nor its digest");
    const bound = (await setup.query<{ d: string }>(`select bound_payload_digest d from action_permits where action_request_id = $1`, [twinB])).rows[0]!.d;
    assert.equal(bound, frozen.digest, "L5: the permit binds the approved scoped digest");
    assert.equal(after.payload["workScope"], "domain");

    /* L6 — responsibility withdrawn after approval: the spend fails closed; re-granted, it spends. */
    const hebyPermit = await approve(hebyEngReq);
    await grant(heby, 1, [{ kind: "organization" }]);
    const stopped = await executeRecordWork(acme, { permitId: hebyPermit }, deps);
    assert.notEqual(stopped.status, "executed", "L6: withdrawn responsibility stops the spend");
    assert.equal(await permitStatus(hebyPermit), "active", "L6: the permit stays active");
    assert.deepEqual(await workScopeOf("Heby engineering work"), [], "L6: no work row");
    await grant(heby, 2, [{ kind: "organization" }, { kind: "domain", workDomainId: eng }]);
    assert.equal((await executeRecordWork(acme, { permitId: hebyPermit }, deps)).status, "executed", "L6: re-granted, the same permit spends");
    assert.deepEqual(await workScopeOf("Heby engineering work"), [{ k: "domain", d: eng }]);

    /* L8 (part) — the projection before finance retires. */
    const counts = async () => [await n(`select count(*) from audit_log`), await n(`select count(*) from decision_records`), await n(`select count(*) from heby_action_requests`)];
    const countsBefore = await counts();
    const ids = async (scope: WorkScope) => {
      const r = await listEligibleAgents(acme, scope, deps);
      assert.equal(r.status, "read");
      return r.status === "read" ? r.agents.map((a) => a.agentId) : [];
    };
    assert.deepEqual(await ids(D(eng)), [heby], "L8: engineering → Heby");
    assert.deepEqual(await ids(D(fin)), [ledger], "L8: finance → Ledger");
    assert.deepEqual(await ids(ORG), [heby], "L8: organization → Heby");
    assert.deepEqual(await counts(), countsBefore, "L8: the projection writes nothing");

    /* L7 — a domain retired after approval stops the spend, for an agent and for a human proposal. */
    const ledgerPermit = await approve(ledgerFinReq);
    const humanFinTitle = "Finance close checklist";
    const humanFinPermit = await approve(requestIdOf(await human(humanFinTitle, D(fin))));
    assert.equal((await retireWorkDomain(acme, { workDomainId: fin }, deps)).status, "recorded");
    assert.notEqual((await executeRecordWork(acme, { permitId: ledgerPermit }, deps)).status, "executed", "L7: agent grant no longer admits");
    const humanStopped = await executeRecordWork(acme, { permitId: humanFinPermit }, deps);
    assert.ok(humanStopped.status === "refused" && humanStopped.reason === "work-authority-refused", `L7: ${JSON.stringify(humanStopped)}`);
    assert.equal(await permitStatus(ledgerPermit), "active");
    assert.equal(await permitStatus(humanFinPermit), "active");
    assert.deepEqual(await ids(D(fin)), [], "L8: a retired domain has no eligible agent");

    /* L9 — the direct human path stays unscoped. */
    assert.equal((await recordWork(acme, { title: "Directly recorded work" }, deps)).status, "recorded");
    assert.deepEqual(await workScopeOf("Directly recorded work"), [{ k: null, d: null }], "L9: NULL/NULL");

    console.log("ap4b-strict-work-eligibility/eligibility-postgres: passed");
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose().catch(() => {});
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
