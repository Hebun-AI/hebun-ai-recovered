/*
 * AMA-1 — the Agent Mandate Authority, against a REAL PostgreSQL database.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "An organization can record what ONE durable agent is FOR and the maximum surface inside which
 *    it may propose — under a human Governance decision, in one transaction, with an audit trail —
 *    and doing so grants nothing. Another tenant's agent cannot be bounded. A mandate cannot admit
 *    an action kind outside the released origination vocabulary. An AGENT cannot establish or widen
 *    its own mandate. A change leaves the previous revision byte-identical. `agents` is untouched.
 *    No permit, no execution attempt, no permission row, and no proposal enforcement appears."
 *
 * Every row is produced by the released writer that owns it. No adapter, no network, no credential.
 * Uses a disposable local database, dropped on exit.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { createDurableAgentIdentity } from "../../src/features/agent-identity/create-durable-agent-identity.server";
import { retireDurableAgentIdentity } from "../../src/features/agent-identity/retire-durable-agent-identity.server";
import { establishAgentMandate } from "../../src/features/agent-mandate/establish-agent-mandate.server";
import {
  readAgentMandateHistory,
  readEffectiveAgentMandate,
} from "../../src/features/agent-mandate/read-agent-mandate.server";
import {
  AGENT_MANDATE_AUDIT_ESTABLISHED,
  AGENT_MANDATE_AUDIT_REVISED,
  AGENT_MANDATE_BOUNDED_OUTCOME,
  AGENT_MANDATE_DOMAIN,
  AGENT_MANDATE_ENTITY_TYPE,
  AGENT_MANDATE_SUBJECT_TYPE,
} from "../../src/features/agent-mandate/contracts";
import { AGENT_ORIGINABLE_ACTION_KINDS } from "../../src/features/agent-origination/contracts";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";

const JUSTIFICATION =
  "This external message is a deliberate organizational act and I accept responsibility for it.";
const MANDATE_JUSTIFICATION =
  "I am bounding what this agent exists to do, and I accept responsibility for that bound.";

const PURPOSE =
  "Draft and propose outbound customer correspondence for review. It proposes; a human decides.";
const NARROWED_PURPOSE =
  "This agent is withdrawn from proposing anything while we review how it has been performing.";

interface Seeded {
  readonly tenantId: string;
  readonly userId: string;
  readonly authIdentityId: string;
  readonly membershipId: string;
  readonly roleId: string;
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
    authenticatedAt: new Date().toISOString(),
  });
}

async function count(client: Client, table: string): Promise<number> {
  const row = await client.query<{ n: number }>(`select count(*)::int as n from ${table}`);
  return row.rows[0]!.n;
}

async function rejects(client: Client, sql: string, params: unknown[], why: string): Promise<void> {
  await assert.rejects(() => client.query(sql, params), why);
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_ama1_mandate");
  await harness.createDatabase();
  harness.migrateDatabase();

  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const baseDeps = { getDb: () => handle.db };

  try {
    /* ═══════════════════════════════════════════════════════════════════════
     * 0. THE MIGRATION IS APPLIED, AND CARRIES NO ENFORCEMENT TRUTH.
     * ═════════════════════════════════════════════════════════════════════ */
    const columns = await setup.query<{ column_name: string; is_nullable: string }>(
      `select column_name, is_nullable from information_schema.columns
        where table_name = 'agent_mandates' order by column_name`,
    );
    assert.ok(columns.rows.length > 0, "the mandate table exists");
    const names = columns.rows.map((r) => r.column_name);

    /*
     * THE ABSENT COLUMNS ARE THE POINT. Every one of these would be a fact AMA-1 cannot prove, or a
     * second copy of a fact another authority owns.
     */
    for (const forbidden of [
      "status",
      "withdrawn",
      "withdrawn_at",
      "is_current",
      "is_effective",
      "superseded_at",
      "enforced",
      "enforced_at",
      "applied_at",
      "authority_ceiling",
      "permission_key",
      "permit_id",
      "provider_key",
      "score",
      "confidence",
    ]) {
      assert.ok(
        !names.includes(forbidden),
        `the mandate carries no '${forbidden}' — AMA-1 may not claim that fact`,
      );
    }

    for (const required of [
      "tenant_id",
      "agent_id",
      "mandate_revision",
      "purpose",
      "proposal_scope",
      "effective_from",
      "governance_decision_id",
      "governance_session_id",
      "established_by_actor_type",
      "established_by_actor_id",
    ]) {
      const row = columns.rows.find((r) => r.column_name === required);
      assert.ok(row, `${required} exists`);
      assert.equal(row!.is_nullable, "NO", `${required} is NOT NULL`);
    }

    const fk = await setup.query<{ n: number }>(
      `select count(*)::int as n from information_schema.table_constraints
        where constraint_name = 'agent_mandates_tenant_agent_fk' and constraint_type = 'FOREIGN KEY'`,
    );
    assert.equal(fk.rows[0]!.n, 1, "the composite tenant-safe foreign key exists");

    const domainAdded = await setup.query<{ n: number }>(
      `select count(*)::int as n from pg_enum e
         join pg_type t on t.oid = e.enumtypid
        where t.typname = 'governance_domain' and e.enumlabel = $1`,
      [AGENT_MANDATE_DOMAIN],
    );
    assert.equal(domainAdded.rows[0]!.n, 1, "the mandate governance domain exists");

    /* ═══════════════════════════════════════════════════════════════════════
     * 1. TWO TENANTS, EACH WITH GOVERNANCE AND ONE DURABLE AGENT.
     * ═════════════════════════════════════════════════════════════════════ */
    const acme = (await seedLocalIdentity(setup, {
      companyName: "Acme",
      companySlug: "acme-ama1",
      email: "director@acme.test",
    })) as Seeded;
    const globex = (await seedLocalIdentity(setup, {
      companyName: "Globex",
      companySlug: "globex-ama1",
      email: "director@globex.test",
    })) as Seeded;
    const acmeCtx = contextFor(acme, await sessionRowFor(setup, acme, "aaaa"), "ama1-acme");
    const globexCtx = contextFor(globex, await sessionRowFor(setup, globex, "bbbb"), "ama1-globex");

    for (const [seeded, ctx] of [
      [acme, acmeCtx],
      [globex, globexCtx],
    ] as const) {
      await setup.query(
        `insert into genesis_nominations
           (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
            accepted_at, accepted_session_context_id, accepted_assurance_level)
         values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
        [seeded.tenantId, seeded.authIdentityId, seeded.userId, ctx.sessionContextId],
      );
      assert.equal(
        (await establishGovernanceAuthority(ctx, { justification: JUSTIFICATION }, baseDeps)).status,
        "established",
      );
    }

    const acmeIdentity = await createDurableAgentIdentity(acmeCtx, { name: "Heby" }, baseDeps);
    const globexIdentity = await createDurableAgentIdentity(
      globexCtx,
      { name: "Globex Agent" },
      baseDeps,
    );
    assert.equal(acmeIdentity.status, "established");
    assert.equal(globexIdentity.status, "established");
    if (acmeIdentity.status !== "established" || globexIdentity.status !== "established") {
      throw new Error("unreachable");
    }
    const acmeAgentId = acmeIdentity.identity.agentId;
    const globexAgentId = globexIdentity.identity.agentId;

    /*
     * A BASELINE FOR THE AGENT ROW, taken BEFORE any mandate exists. Every claim about `agents`
     * being untouched is measured against this, not asserted.
     */
    const agentBefore = await setup.query(
      `select * from agents where id = $1`,
      [acmeAgentId],
    );
    assert.equal(agentBefore.rowCount, 1);

    /* ═══════════════════════════════════════════════════════════════════════
     * 2. NO MANDATE IS A REAL ANSWER, AND IT IS NOT "UNAVAILABLE".
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const none = await readEffectiveAgentMandate(acmeCtx, acmeAgentId, baseDeps);
      assert.equal(none.status, "known", "a reachable database with no mandate is KNOWN, not unavailable");
      if (none.status === "known") {
        assert.equal(none.mandate, null, "NO MANDATE != UNBOUNDED, and it is reported as null");
      }
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 3. A SCOPE OUTSIDE THE RELEASED VOCABULARY IS REFUSED WHOLE.
     * ═════════════════════════════════════════════════════════════════════ */
    for (const badScope of [
      ["grant-permission"],
      ["modify-governance-policy"],
      ["device-action"],
      ["send", "grant-permission"],
      ["SEND"],
      ["*"],
    ]) {
      const bad = await establishAgentMandate(
        acmeCtx,
        {
          agentId: acmeAgentId,
          purpose: PURPOSE,
          proposalScope: badScope,
          justification: MANDATE_JUSTIFICATION,
          observedMandateRevision: null,
        },
        baseDeps,
      );
      assert.equal(bad.status, "refused", `${JSON.stringify(badScope)} is refused`);
      if (bad.status === "refused") {
        assert.equal(
          bad.reason,
          "mandate-scope-invalid",
          "a scope naming anything outside the released vocabulary is refused WHOLE, never narrowed",
        );
      }
    }
    assert.equal(await count(setup, "agent_mandates"), 0, "a refused scope wrote nothing");

    /* ═══════════════════════════════════════════════════════════════════════
     * 4. ANOTHER TENANT'S AGENT IS UNRESOLVABLE — never "unauthorized", never bounded.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const crossTenant = await establishAgentMandate(
        acmeCtx,
        {
          agentId: globexAgentId,
          purpose: PURPOSE,
          proposalScope: ["send"],
          justification: MANDATE_JUSTIFICATION,
          observedMandateRevision: null,
        },
        baseDeps,
      );
      assert.equal(crossTenant.status, "refused");
      if (crossTenant.status === "refused") {
        assert.equal(
          crossTenant.reason,
          "agent-unresolvable",
          "another organization's agent is indistinguishable from one that never existed",
        );
      }
      assert.equal(await count(setup, "agent_mandates"), 0, "no cross-tenant row was written");
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 5. GOVERNANCE AUTHORITY IS REQUIRED — a member of the tenant is not enough.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const outsider = (await seedLocalIdentity(setup, {
        companyName: "Acme",
        companySlug: "acme-ama1-outsider",
        email: "founder@outsider.test",
      })) as Seeded;
      /*
       * A REAL, AUTHENTICATED HUMAN IN A REAL TENANT — and one with no Governance authority,
       * because no bootstrap decision names them. The refusal must be about authority, not about
       * authentication.
       */
      const outsiderCtx = contextFor(
        outsider,
        await sessionRowFor(setup, outsider, "cccc"),
        "ama1-outsider",
      );
      const outsiderAgent = await createDurableAgentIdentity(
        outsiderCtx,
        { name: "Outsider Agent" },
        baseDeps,
      );
      assert.equal(outsiderAgent.status, "established");
      if (outsiderAgent.status !== "established") throw new Error("unreachable");

      const refusedForAuthority = await establishAgentMandate(
        outsiderCtx,
        {
          agentId: outsiderAgent.identity.agentId,
          purpose: PURPOSE,
          proposalScope: ["send"],
          justification: MANDATE_JUSTIFICATION,
          observedMandateRevision: null,
        },
        baseDeps,
      );
      assert.equal(refusedForAuthority.status, "refused");
      if (refusedForAuthority.status === "refused") {
        assert.equal(
          refusedForAuthority.reason,
          "no-governance-authority",
          "a tenant with no bootstrap decision has no authority to bound anything",
        );
      }
      assert.equal(await count(setup, "agent_mandates"), 0, "an unauthorized attempt wrote nothing");
    }

    /*
     * THE SHARPER CASE: a real OWNER-BAND MEMBER OF ACME who is not the human the bootstrap
     * decision established. Their tenant HAS Governance authority; they are not it.
     *
     * This is the line that matters — `roles.type`, `authority_rank`, `memberships.authority_scope`
     * and `permissions` grant nothing here, exactly as K2 authorship grants nothing at K4's
     * ratification boundary. A tenant owner without Governance authority is refused exactly like a
     * stranger, and the refusal NAMES the difference.
     */
    {
      const colleague = await setup.query<{ id: string }>(
        `insert into users (email, name) values ($1,$1) returning id`,
        ["second-owner@acme.test"],
      );
      const colleagueUserId = colleague.rows[0]!.id;
      const colleagueIdentity = await setup.query<{ id: string }>(
        `insert into auth_identities (user_id, provider, issuer, subject, status, is_primary, verified_at)
         values ($1,'local','hebun-local',$2,'active',true, now()) returning id`,
        [colleagueUserId, "local:second-owner@acme.test"],
      );
      const colleagueMembership = await setup.query<{ id: string }>(
        `insert into memberships (tenant_id, user_id, role_id, status)
         values ($1,$2,$3,'active') returning id`,
        [acme.tenantId, colleagueUserId, acme.roleId],
      );
      const colleagueSeed: Seeded = {
        tenantId: acme.tenantId,
        userId: colleagueUserId,
        authIdentityId: colleagueIdentity.rows[0]!.id,
        membershipId: colleagueMembership.rows[0]!.id,
        roleId: acme.roleId,
      };
      const colleagueCtx = contextFor(
        colleagueSeed,
        await sessionRowFor(setup, colleagueSeed, "dddd"),
        "ama1-colleague",
      );

      const refusedForIdentity = await establishAgentMandate(
        colleagueCtx,
        {
          agentId: acmeAgentId,
          purpose: PURPOSE,
          proposalScope: ["send"],
          justification: MANDATE_JUSTIFICATION,
          observedMandateRevision: null,
        },
        baseDeps,
      );
      assert.equal(refusedForIdentity.status, "refused");
      if (refusedForIdentity.status === "refused") {
        assert.equal(
          refusedForIdentity.reason,
          "not-the-governance-authority",
          "an owner-band member of a governed tenant is still not the Governance authority",
        );
      }
      assert.equal(await count(setup, "agent_mandates"), 0, "a non-authority attempt wrote nothing");
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 6. THE FIRST MANDATE. One transaction: decision, session, mandate, two audit rows.
     * ═════════════════════════════════════════════════════════════════════ */
    const decisionsBefore = await count(setup, "decision_records");
    const sessionsBefore = await count(setup, "governance_sessions");
    const auditBefore = await count(setup, "audit_log");

    const first = await establishAgentMandate(
      acmeCtx,
      {
        agentId: acmeAgentId,
        purpose: PURPOSE,
        /* Deliberately duplicated: canonical form is the writer's invariant, proved below. */
        proposalScope: ["send", "send"],
        justification: MANDATE_JUSTIFICATION,
        observedMandateRevision: null,
      },
      baseDeps,
    );
    assert.equal(first.status, "established");
    if (first.status !== "established") throw new Error("unreachable");
    assert.equal(first.mandate.mandateRevision, 1, "the chain starts at revision 1");
    assert.equal(first.mandate.supersedesMandateId, null, "revision 1 supersedes nothing");
    assert.deepEqual(
      [...first.mandate.proposalScope],
      ["send"],
      "the stored scope is canonical: de-duplicated, in the released vocabulary's own order",
    );

    assert.equal(await count(setup, "decision_records"), decisionsBefore + 1, "exactly one decision");
    assert.equal(await count(setup, "governance_sessions"), sessionsBefore + 1, "exactly one session");
    assert.equal(await count(setup, "audit_log"), auditBefore + 2, "exactly two audit rows");

    /* The decision names the REVISION, not the agent. A decision for r1 is never a decision for r2. */
    const decision = await setup.query<{
      subject_type: string;
      subject_id: string;
      decision_type: string;
      outcome: string;
      actor_type: string;
      actor_id: string;
      authority_source_actor_type: string | null;
      bootstrap: boolean;
    }>(`select * from decision_records where id = $1`, [first.mandate.governanceDecisionId]);
    const d = decision.rows[0]!;
    assert.equal(d.subject_type, AGENT_MANDATE_SUBJECT_TYPE);
    assert.equal(d.subject_id, first.mandate.mandateId, "the subject IS the revision row");
    assert.equal(d.decision_type, "approve");
    assert.equal(
      d.outcome,
      AGENT_MANDATE_BOUNDED_OUTCOME,
      "the ledger says a bound was set — never that a membership was authorized",
    );
    assert.equal(d.actor_type, "human");
    assert.equal(d.actor_id, acme.userId);
    assert.equal(d.authority_source_actor_type, "human");
    assert.equal(d.bootstrap, false, "a mandate decision is never a genesis");

    const session = await setup.query<{ governance_domain: string; subject_type: string }>(
      `select * from governance_sessions where id = $1`,
      [first.mandate.governanceSessionId],
    );
    assert.equal(
      session.rows[0]!.governance_domain,
      AGENT_MANDATE_DOMAIN,
      "its own domain — not agent-registration, not action-authorization, not authority-delegation",
    );

    const mandateAudit = await setup.query<{
      action: string;
      entity_type: string;
      entity_id: string;
      result: string;
      metadata: Record<string, unknown>;
      source: string;
      simulation: boolean;
    }>(
      `select * from audit_log where entity_type = $1 order by occurred_at`,
      [AGENT_MANDATE_ENTITY_TYPE],
    );
    assert.equal(mandateAudit.rowCount, 1);
    assert.equal(mandateAudit.rows[0]!.action, AGENT_MANDATE_AUDIT_ESTABLISHED);
    assert.equal(mandateAudit.rows[0]!.entity_id, first.mandate.mandateId);
    assert.equal(mandateAudit.rows[0]!.result, "committed");
    assert.equal(mandateAudit.rows[0]!.simulation, false);
    assert.equal(mandateAudit.rows[0]!.source, "agent-mandate");
    assert.equal(
      mandateAudit.rows[0]!.metadata.enforced,
      false,
      "MANDATE RECORDED != PROPOSAL-ENFORCED, and every row says so",
    );

    /* ═══════════════════════════════════════════════════════════════════════
     * 7. `agents` IS BYTE-IDENTICAL. A mandate bounds an agent; it does not touch its identity.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const agentAfter = await setup.query(`select * from agents where id = $1`, [acmeAgentId]);
      assert.deepEqual(
        agentAfter.rows[0],
        agentBefore.rows[0],
        "the agent row is unchanged — version, authority_ceiling and every other column included",
      );
      const ceiling = await setup.query<{ n: number }>(
        `select count(*)::int as n from agents where authority_ceiling is not null`,
      );
      assert.equal(ceiling.rows[0]!.n, 0, "authority_ceiling has no writer, and AMA-1 did not become one");
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 8. A STALE HUMAN IS REFUSED, IN BOTH DIRECTIONS.
     * ═════════════════════════════════════════════════════════════════════ */
    for (const [observed, why] of [
      [null, "believing there is no mandate when there is"],
      [7, "believing the chain is further along than it is"],
    ] as const) {
      const stale = await establishAgentMandate(
        acmeCtx,
        {
          agentId: acmeAgentId,
          purpose: NARROWED_PURPOSE,
          proposalScope: [],
          justification: MANDATE_JUSTIFICATION,
          observedMandateRevision: observed,
        },
        baseDeps,
      );
      assert.equal(stale.status, "refused", why);
      if (stale.status === "refused") assert.equal(stale.reason, "stale-mandate-revision");
    }
    assert.equal(await count(setup, "agent_mandates"), 1, "a stale attempt wrote nothing");

    /* ═══════════════════════════════════════════════════════════════════════
     * 9. WITHDRAWAL IS A REVISION WITH AN EMPTY SCOPE — and revision 1 survives it intact.
     * ═════════════════════════════════════════════════════════════════════ */
    const revisionOneBefore = await setup.query(
      `select * from agent_mandates where id = $1`,
      [first.mandate.mandateId],
    );

    const second = await establishAgentMandate(
      acmeCtx,
      {
        agentId: acmeAgentId,
        purpose: NARROWED_PURPOSE,
        proposalScope: [],
        justification: MANDATE_JUSTIFICATION,
        observedMandateRevision: 1,
      },
      baseDeps,
    );
    assert.equal(second.status, "established");
    if (second.status !== "established") throw new Error("unreachable");
    assert.equal(second.mandate.mandateRevision, 2);
    assert.deepEqual([...second.mandate.proposalScope], [], "withdrawal permits nothing");
    assert.equal(
      second.mandate.supersedesMandateId,
      first.mandate.mandateId,
      "the chain names its predecessor",
    );
    assert.notEqual(
      second.mandate.governanceDecisionId,
      first.mandate.governanceDecisionId,
      "each revision carries its OWN Governance decision",
    );

    {
      const revisionOneAfter = await setup.query(
        `select * from agent_mandates where id = $1`,
        [first.mandate.mandateId],
      );
      assert.deepEqual(
        revisionOneAfter.rows[0],
        revisionOneBefore.rows[0],
        "the previous revision is byte-identical — nothing stamps it, nothing supersedes it in place",
      );
    }

    /* ONE EFFECTIVE MANDATE, and it is the highest ordinal. */
    {
      const effective = await readEffectiveAgentMandate(acmeCtx, acmeAgentId, baseDeps);
      assert.equal(effective.status, "known");
      if (effective.status === "known") {
        assert.ok(effective.mandate);
        assert.equal(effective.mandate!.mandateRevision, 2);
        assert.deepEqual([...effective.mandate!.proposalScope], []);
      }
      const history = await readAgentMandateHistory(acmeCtx, acmeAgentId, baseDeps);
      assert.equal(history.status, "known");
      if (history.status === "known") {
        assert.equal(history.revisions.length, 2, "both revisions remain readable");
        assert.deepEqual(
          history.revisions.map((r) => r.mandateRevision),
          [2, 1],
          "newest first, and revision 1 is still there",
        );
        assert.deepEqual(
          [...history.revisions[1]!.proposalScope],
          ["send"],
          "revision 1 still records exactly what its human authorized",
        );
      }
    }

    const revisedAudit = await setup.query<{ action: string; metadata: Record<string, unknown> }>(
      `select * from audit_log where entity_type = $1 and entity_id = $2`,
      [AGENT_MANDATE_ENTITY_TYPE, second.mandate.mandateId],
    );
    assert.equal(revisedAudit.rowCount, 1);
    assert.equal(revisedAudit.rows[0]!.action, AGENT_MANDATE_AUDIT_REVISED);
    assert.equal(revisedAudit.rows[0]!.metadata.enforced, false);

    /* ═══════════════════════════════════════════════════════════════════════
     * 10. A RETIRED AGENT IS REFUSED. Bounding what no longer proposes states nothing.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const globexMandate = await establishAgentMandate(
        globexCtx,
        {
          agentId: globexAgentId,
          purpose: PURPOSE,
          proposalScope: ["send"],
          justification: MANDATE_JUSTIFICATION,
          observedMandateRevision: null,
        },
        baseDeps,
      );
      assert.equal(globexMandate.status, "established", "each tenant bounds its own agent");

      const retired = await retireDurableAgentIdentity(
        globexCtx,
        { agentId: globexAgentId },
        baseDeps,
      );
      assert.equal(retired.status, "retired");

      const afterRetirement = await establishAgentMandate(
        globexCtx,
        {
          agentId: globexAgentId,
          purpose: PURPOSE,
          proposalScope: [],
          justification: MANDATE_JUSTIFICATION,
          observedMandateRevision: 1,
        },
        baseDeps,
      );
      assert.equal(afterRetirement.status, "refused");
      if (afterRetirement.status === "refused") {
        assert.equal(afterRetirement.reason, "agent-retired");
      }

      /* Its history stays readable. Retirement withdraws an agent, not the record of its bound. */
      const stillReadable = await readAgentMandateHistory(globexCtx, globexAgentId, baseDeps);
      assert.equal(stillReadable.status, "known");
      if (stillReadable.status === "known") assert.equal(stillReadable.revisions.length, 1);
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 11. TENANT ISOLATION ON THE READ SEAM. Acme cannot see Globex's mandate.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const crossRead = await readEffectiveAgentMandate(acmeCtx, globexAgentId, baseDeps);
      assert.equal(crossRead.status, "known");
      if (crossRead.status === "known") {
        assert.equal(crossRead.mandate, null, "another tenant's mandate is not visible, at all");
      }
      const crossHistory = await readAgentMandateHistory(acmeCtx, globexAgentId, baseDeps);
      assert.equal(crossHistory.status, "known");
      if (crossHistory.status === "known") assert.equal(crossHistory.revisions.length, 0);
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 12. NOTHING ELSE MOVED. The chain AMA-1 must not have touched.
     * ═════════════════════════════════════════════════════════════════════ */
    assert.equal(await count(setup, "action_permits"), 0, "no permit was minted");
    assert.equal(await count(setup, "action_execution_attempts"), 0, "no execution was attempted");
    assert.equal(await count(setup, "heby_action_requests"), 0, "no proposal was created");
    assert.equal(await count(setup, "permissions"), 0, "the permission catalog is still inert");
    assert.equal(await count(setup, "role_permissions"), 0, "no grant was written");
    assert.equal(await count(setup, "integration_credentials"), 0, "no provider was reached");
    assert.equal(
      await count(setup, "agent_improvement_hypotheses"),
      0,
      "the neighbouring agent authority was not touched",
    );

    /* ═══════════════════════════════════════════════════════════════════════
     * 13. THE DATABASE REFUSES BY RAW SQL WHAT THE WRITER REFUSES BY TYPE.
     *
     * These bypass every line of application code. If any of them SUCCEEDS, the guarantee lives in
     * TypeScript rather than in PostgreSQL, and a future writer could break it silently.
     * ═════════════════════════════════════════════════════════════════════ */
    const insert = `insert into agent_mandates
      (tenant_id, agent_id, mandate_revision, purpose, proposal_scope, effective_from,
       governance_decision_id, governance_session_id, established_by_actor_type,
       established_by_actor_id, supersedes_mandate_id)
      values ($1,$2,$3,$4,$5, now(), $6,$7,$8,$9,$10)`;

    const dec = first.mandate.governanceDecisionId;
    const ses = first.mandate.governanceSessionId;

    await rejects(
      setup,
      insert,
      [acme.tenantId, acmeAgentId, 3, PURPOSE, ["grant-permission"], dec, ses, "human", acme.userId, second.mandate.mandateId],
      "a scope outside the released vocabulary is refused BY THE DATABASE, not merely by the writer",
    );
    await rejects(
      setup,
      insert,
      [acme.tenantId, acmeAgentId, 3, PURPOSE, ["send", "send"], dec, ses, "human", acme.userId, second.mandate.mandateId],
      "a scope longer than the vocabulary it is drawn from is unrepresentable",
    );
    await rejects(
      setup,
      insert,
      [acme.tenantId, acmeAgentId, 3, PURPOSE, ["send"], dec, ses, "agent", acmeAgentId, second.mandate.mandateId],
      "an AGENT cannot establish or widen its own mandate — the database refuses the row",
    );
    await rejects(
      setup,
      insert,
      [acme.tenantId, globexAgentId, 3, PURPOSE, ["send"], dec, ses, "human", acme.userId, second.mandate.mandateId],
      "the composite key refuses another tenant's agent even by raw SQL",
    );
    await rejects(
      setup,
      insert,
      [acme.tenantId, acmeAgentId, 2, PURPOSE, ["send"], dec, ses, "human", acme.userId, second.mandate.mandateId],
      "two revisions cannot share an ordinal — this is what makes ONE EFFECTIVE mandate true",
    );
    await rejects(
      setup,
      insert,
      [acme.tenantId, acmeAgentId, 3, PURPOSE, ["send"], dec, ses, "human", acme.userId, null],
      "a later revision that names no predecessor is unrepresentable",
    );
    await rejects(
      setup,
      insert,
      [acme.tenantId, acmeAgentId, 3, PURPOSE, ["send"], dec, ses, "human", acme.userId, first.mandate.mandateId],
      "a revision already superseded cannot be superseded twice — the chain cannot fork",
    );
    await rejects(
      setup,
      insert,
      [acme.tenantId, acmeAgentId, 3, "   ", ["send"], dec, ses, "human", acme.userId, second.mandate.mandateId],
      "a purpose that says nothing is not a purpose",
    );

    /* The whole raw-SQL block wrote nothing. */
    assert.equal(await count(setup, "agent_mandates"), 3, "acme 2 + globex 1, and no forced row");

    /*
     * THE RELEASED VOCABULARY AND THE DATABASE CHECK AGREE. If a later phase widens one without the
     * other, this is where it is caught — and the safe direction is that the database is narrower.
     */
    const admitted = await setup.query<{ ok: boolean }>(
      `select ($1::text[] <@ array['send','record-work']::text[]) as ok`,
      [[...AGENT_ORIGINABLE_ACTION_KINDS]],
    );
    assert.equal(
      admitted.rows[0]!.ok,
      true,
      "every released originable kind is admissible by the table's own CHECK",
    );

    console.log("ama1-agent-mandate/mandate-postgres: OK");
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose().catch(() => {});
    await harness.dropDatabase();
  }
}

void main();
