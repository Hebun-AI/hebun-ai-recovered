/*
 * RA-AUTH-1 — THE PREPARATION-ONLY MANDATE KIND, AGAINST A REAL DATABASE (PG18, disposable).
 *
 * Every row is written by the released writer that owns it. Two organizations; Acme has work domains
 * `research` and `finance` and two agents: Researcher (prepare-research, research domain) and Ledger
 * (record-work, finance domain).
 *
 *   D1 the migration: the CHECK admits `prepare-research`, refuses an invented kind; the enum holds
 *      `research-report` beside every released type
 *   D2 the writer: `prepare-research` requires a responsibility, and a research mandate is stored
 *   D3 the preparation ceiling on the real read: admitted for its own domain only
 *   D4 cross-tenant: Globex reads no mandate for Acme's agent — refused
 *   D5 withdrawal and supersession: the newest revision decides; the old one admits nothing
 *   D6 no action path: the research agent originates nothing, is eligible for no action, and the
 *      eligibility seam refuses to answer for a preparation kind
 *   D7 the general writer refuses a research report; nothing consequential was written
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { createDurableAgentIdentity } from "../../src/features/agent-identity/create-durable-agent-identity.server";
import { establishAgentMandateWithResponsibility } from "../../src/features/agent-mandate/establish-agent-mandate.server";
import { readEffectiveAgentMandate } from "../../src/features/agent-mandate/read-agent-mandate.server";
import { recordWorkDomain } from "../../src/features/work-domain/write-work-domain.server";
import { resolveAgentProposer } from "../../src/features/action-authorization/agent-proposer.server";
import { proposeAgentOriginatedRecordWorkAction } from "../../src/features/heby-action-inlet/record-work-proposal.server";
import { refuseOutsideAgentPreparation } from "../../src/features/action-authorization/agent-mandate-ceiling";
import { AGENT_ORIGINABLE_REGISTRY_KIND } from "../../src/features/agent-origination/contracts";
import { listEligibleAgents } from "../../src/features/origination-availability/list-eligible-agents.server";
import { createWorkArtifact } from "../../src/features/work-artifacts/write-work-artifacts.server";
import { asHumanTenantContext, type TenantContext } from "../../src/features/auth/tenant/tenant-context";
import type { WorkScope } from "../../src/features/work-domain/work-scope";

const GENESIS = "I am establishing this organization's Governance authority so consequential acts can be decided.";
const MANDATE = "I am bounding what this agent may do and which work it is responsible for.";
const PURPOSE = "Prepares sourced research reports for a person to review before anything follows.";
const KIND = "prepare-research" as const;

type Seeded = { tenantId: string; userId: string; authIdentityId: string; membershipId: string; roleId: string };

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_ra_auth_1");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db } as never;
  const n = async (sql: string, params: unknown[] = []) =>
    (await setup.query<{ n: number }>(sql.replace(/^select count\(\*\)/, "select count(*)::int as n"), params)).rows[0]!.n;

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
      mfaVerified: false, requestId: `ra-auth-1-${slug}`, authenticatedAt: new Date().toISOString(),
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
    /* D1 — the migration's two changes, as the database states them. */
    const check = (
      await setup.query<{ def: string }>(`select pg_get_constraintdef(oid) as def from pg_constraint where conname = 'agent_mandates_scope_subset_chk'`)
    ).rows[0]!.def;
    assert.match(check, /'prepare-research'/, "D1: the scope CHECK admits prepare-research");
    for (const kind of ["send", "record-work", "set-work-declared-state"]) assert.match(check, new RegExp(`'${kind}'`), `D1: ${kind} is still admitted`);
    const enumValues = (
      await setup.query<{ v: string }>(`select unnest(enum_range(null::work_artifact_type))::text as v`)
    ).rows.map((r) => r.v);
    assert.deepEqual(enumValues, ["operational-plan", "message-draft", "content-draft", "research-report"], "D1: the enum appends research-report");

    const acme = await governed("acme-ra");
    const globex = await governed("globex-ra");
    const research = await domain(acme, "research", "Research");
    const finance = await domain(acme, "finance", "Finance");
    const D = (workDomainId: string): WorkScope => ({ kind: "domain", workDomainId });

    const agent = async (name: string) => {
      const r = await createDurableAgentIdentity(acme, { name, justification: "Register this agent for the organization." }, deps);
      assert.equal(r.status, "established");
      return r.status === "established" ? r.identity.agentId : "";
    };
    const researcher = await agent("Researcher");
    const ledger = await agent("Ledger");
    const mandate = (agentId: string, observed: number | null, proposalScope: string[], responsibility: unknown[]) =>
      establishAgentMandateWithResponsibility(
        acme,
        { agentId, purpose: PURPOSE, proposalScope, justification: MANDATE, observedMandateRevision: observed, responsibility },
        deps,
      );

    /*
     * D1 (storage) — the CHECK itself, with the writer bypassed. `session_replication_role = replica`
     * skips foreign keys and triggers but still enforces CHECK constraints, so the only thing that can
     * refuse these rows is the scope CHECK. Both inserts run in a transaction that is rolled back.
     */
    const rawInsert = async (scope: string[]) => {
      await setup.query("begin");
      try {
        await setup.query("set local session_replication_role = replica");
        await setup.query(
          `insert into agent_mandates (tenant_id, agent_id, mandate_revision, purpose, proposal_scope, effective_from,
             governance_decision_id, governance_session_id, established_by_actor_type, established_by_actor_id)
           values ($1, $2, 1, $3, $4, now(), gen_random_uuid(), gen_random_uuid(), 'human', $5)`,
          [acme.tenantId, researcher, PURPOSE, scope, acme.userId],
        );
        return "inserted";
      } catch (error) {
        const e = error as { code?: string; constraint?: string };
        return `${e.code ?? "error"}:${e.constraint ?? ""}`;
      } finally {
        await setup.query("rollback");
      }
    };
    assert.equal(await rawInsert([KIND]), "inserted", "D1: the CHECK admits the preparation kind");
    assert.equal(await rawInsert([KIND, "grant-permission"]), "23514:agent_mandates_scope_subset_chk", "D1: an invented kind beside it violates the scope CHECK");
    assert.equal(await rawInsert(["send", "record-work", "set-work-declared-state", KIND, KIND]), "23514:agent_mandates_scope_subset_chk", "D1: the cardinality bound still holds");
    assert.equal(await n(`select count(*) from agent_mandates`), 0, "D1: the raw block wrote nothing");

    /* D2 — the writer. */
    const noResponsibility = await mandate(researcher, null, [KIND], []);
    assert.deepEqual(noResponsibility, { status: "refused", reason: "responsibility-required" }, "D2: prepare-research requires a responsibility");
    const first = await mandate(researcher, null, [KIND], [{ kind: "domain", workDomainId: research }]);
    assert.equal(first.status, "established", JSON.stringify(first));
    const stored = (
      await setup.query<{ s: string[] }>(`select proposal_scope s from agent_mandates where agent_id = $1 order by mandate_revision desc limit 1`, [researcher])
    ).rows[0]!.s;
    assert.deepEqual(stored, [KIND], "D2: the stored scope is exactly the preparation kind");
    assert.equal((await mandate(ledger, null, ["record-work"], [{ kind: "domain", workDomainId: finance }])).status, "established");

    /* D3 — the preparation ceiling on the real read. */
    const readR = await readEffectiveAgentMandate(acme, researcher, deps);
    assert.equal(refuseOutsideAgentPreparation(readR, KIND, D(research)), null, "D3: admitted for its own domain");
    assert.equal(refuseOutsideAgentPreparation(readR, KIND, D(finance)), "work-outside-agent-responsibility", "D3: not for another domain");
    assert.equal(refuseOutsideAgentPreparation(readR, KIND, { kind: "organization" }), "work-outside-agent-responsibility", "D3: not for organization work");
    const readL = await readEffectiveAgentMandate(acme, ledger, deps);
    assert.equal(refuseOutsideAgentPreparation(readL, KIND, D(finance)), "action-outside-agent-mandate", "D3: a record-work mandate prepares no research");

    /* D4 — another tenant reads no mandate for Acme's agent. */
    const foreign = await readEffectiveAgentMandate(globex, researcher, deps);
    assert.equal(refuseOutsideAgentPreparation(foreign, KIND, D(research)), "no-agent-mandate", "D4: cross-tenant is refused");

    /* D5 — withdrawal supersedes; the newest revision decides. */
    assert.equal(first.status === "established" && first.mandate.mandateRevision, 1);
    assert.equal((await mandate(researcher, 1, [], [])).status, "established", "D5: withdrawal is recorded as a new revision");
    const withdrawn = await readEffectiveAgentMandate(acme, researcher, deps);
    assert.equal(refuseOutsideAgentPreparation(withdrawn, KIND, D(research)), "action-outside-agent-mandate", "D5: withdrawn admits nothing");
    assert.equal(refuseOutsideAgentPreparation(readR, KIND, D(research)), null, "D5: (the stale read taken before still says what it said)");
    assert.equal((await mandate(researcher, 2, [KIND], [{ kind: "domain", workDomainId: research }])).status, "established", "D5: re-granted");
    assert.equal(refuseOutsideAgentPreparation(await readEffectiveAgentMandate(acme, researcher, deps), KIND, D(research)), null, "D5: the newest revision admits again");

    /* D6 — no action path. */
    const before = {
      requests: await n(`select count(*) from heby_action_requests`),
      permits: await n(`select count(*) from action_permits`),
      work: await n(`select count(*) from work_items`),
    };
    const proposer = await resolveAgentProposer(acme, deps, { agentId: researcher });
    assert.equal(proposer.status, "resolved", "D6: the research agent is an in-service proposer identity");
    if (proposer.status !== "resolved") throw new Error("unreachable");
    const originated = await proposeAgentOriginatedRecordWorkAction(
      acme,
      { title: "Research the market", department: { kind: "organization-level" }, workScope: D(research) },
      proposer.proposer,
      deps,
    );
    assert.ok(
      originated.status === "refused" && "authorityRefusal" in originated && originated.authorityRefusal === "action-outside-agent-mandate",
      `D6: the research agent originates nothing — refused by the mandate ceiling (${JSON.stringify(originated)})`,
    );
    for (const kind of ["record-work", "set-work-declared-state"] as const) {
      const eligible = await listEligibleAgents(acme, D(research), deps, AGENT_ORIGINABLE_REGISTRY_KIND[kind]);
      assert.equal(eligible.status, "read");
      assert.ok(eligible.status === "read" && !eligible.agents.some((a) => a.agentId === researcher), `D6: not eligible for ${kind}`);
    }
    assert.equal((await listEligibleAgents(acme, D(research), deps, KIND)).status, "unavailable", "D6: a preparation kind is no action to be eligible for");

    /* D7 — the general writer refuses a research report. */
    const general = await createWorkArtifact(acme, { artifactType: "research-report" as never, title: "Market scan", content: "x" }, "operations", deps);
    assert.notEqual(general.status, "created", `D7: the general writer refuses research-report (${JSON.stringify(general)})`);
    assert.equal(await n(`select count(*) from work_artifacts where artifact_type = 'research-report'`), 0, "D7: no research report exists");
    assert.deepEqual(
      {
        requests: await n(`select count(*) from heby_action_requests`),
        permits: await n(`select count(*) from action_permits`),
        work: await n(`select count(*) from work_items`),
      },
      before,
      "D6/D7: no request, permit or work item was written",
    );

    console.log("ra-auth-1/preparation-postgres: passed");
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
