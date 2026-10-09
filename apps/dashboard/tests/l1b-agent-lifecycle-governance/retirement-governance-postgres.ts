/*
 * L-1b — retirement is a Governance decision, written atomically with the transition and its audit.
 * Real PostgreSQL, disposable database, migrated through 76.
 *
 * Proven here:
 *   1  no reason → refused, nothing written
 *   2  one retirement = one `agent-lifecycle` decision (revoke → agent-retired) + one session + one
 *      `governance.decision.recorded` audit row, all naming the agent
 *   3  the registration decision is untouched — history is preserved, not rewritten
 *   4  a second retirement is refused and records nothing
 *   5  another organization's agent is not found, and nothing is written
 *   6  a failing decision insert rolls the whole retirement back (agent still in service)
 *   7  a failing audit insert rolls the decision AND the transition back
 *   8  a `revoke` on this subject is not read as a revoked Governance delegation
 *   9  the decision authority refuses a decision type with no lifecycle outcome (L-2b took suspend/approve)
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { seedGovernanceAuthority } from "../helpers/agent-mandate-seed";
import { createDurableAgentIdentity } from "../../src/features/agent-identity/create-durable-agent-identity.server";
import { retireDurableAgentIdentity } from "../../src/features/agent-identity/retire-durable-agent-identity.server";
import { readDurableAgentRuntimeLiveness } from "../../src/features/agent-identity/read-durable-agent-identity.server";
import { resolveGovernanceAuthority } from "../../src/features/governance-decision/authority-read.server";
import { writeGovernanceDecisionWithin } from "../../src/features/governance-decision/decision-authority.server";
import { AGENT_LIFECYCLE_SUBJECT_TYPE } from "../../src/features/agent-identity/contracts";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";

const REGISTER = "Register this agent for the L-1b retirement proof organization.";
const RETIRE = "This agent is withdrawn from service for the L-1b retirement proof.";

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
    [seeded.authIdentityId, tag.padEnd(64, "0").slice(0, 64), seeded.userId, seeded.tenantId, seeded.membershipId],
  );
  return row.rows[0]!.id;
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_l1b_retirement_governance");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db } as never;

  try {
    await setup.connect();

    const countOf = async (table: string): Promise<number> =>
      Number((await setup.query(`select count(*)::int n from ${table}`)).rows[0]!.n);
    const ledger = async () => ({
      decisions: await countOf("decision_records"),
      sessions: await countOf("governance_sessions"),
      audit: await countOf("audit_log"),
    });
    const agentRow = async (id: string) =>
      (
        await setup.query<{ retired_at: Date | null; agent_lifecycle_status: string | null; version: number; name: string; human_owner_id: string }>(
          `select retired_at, agent_lifecycle_status, version, name, human_owner_id from agents where id = $1`,
          [id],
        )
      ).rows[0]!;

    /* ── SEED ── */
    const acme = (await seedLocalIdentity(setup, {
      companyName: "Acme",
      companySlug: "acme-l1b",
      email: "director@acme-l1b.test",
    })) as Seeded;
    const beta = (await seedLocalIdentity(setup, {
      companyName: "Beta",
      companySlug: "beta-l1b",
      email: "director@beta-l1b.test",
    })) as Seeded;
    const ctx = contextFor(acme, await sessionRowFor(setup, acme, "c1a1"), "l1b-acme");
    const betaCtx = contextFor(beta, await sessionRowFor(setup, beta, "c1b1"), "l1b-beta");
    await seedGovernanceAuthority(setup, acme, deps, { tag: "0ca1" });
    await seedGovernanceAuthority(setup, beta, deps, { tag: "0cb1" });

    const register = async (who: TenantContext, name: string): Promise<string> => {
      const r = await createDurableAgentIdentity(who, { name, justification: REGISTER }, deps);
      assert.equal(r.status, "established", JSON.stringify(r));
      return r.status === "established" ? r.identity.agentId : "";
    };
    const atlas = await register(ctx, "Atlas");
    const borea = await register(ctx, "Borea");
    const cleo = await register(ctx, "Cleo");
    const foreign = await register(betaCtx, "Foreign");

    /* ── (1) NO REASON → REFUSED, NOTHING WRITTEN ── */
    for (const justification of [undefined, "", "   "]) {
      const before = await ledger();
      const versionBefore = (await agentRow(atlas)).version;
      /* A throw is folded into the result so the reason assertion — not an uncaught error — is what fails. */
      const r = await retireDurableAgentIdentity(ctx, { agentId: atlas, justification }, deps).catch(
        (error: unknown) => ({ status: "threw", error: String(error).slice(0, 120) }),
      );
      assert.deepEqual(r, { status: "refused", reason: "justification-required" }, `reason ${JSON.stringify(justification)} is refused`);
      assert.deepEqual(await ledger(), before, "a refused retirement writes no decision, session or audit row");
      assert.equal((await agentRow(atlas)).version, versionBefore, "and leaves the agent untouched");
    }

    /* ── (2) ONE RETIREMENT = ONE DECISION + ONE SESSION + ONE AUDIT ROW ── */
    const registrationBefore = (
      await setup.query(`select * from decision_records where subject_id = $1 order by decided_at`, [atlas])
    ).rows;
    assert.equal(registrationBefore.length, 1, "Atlas has exactly its registration decision so far");

    const before = await ledger();
    const retired = await retireDurableAgentIdentity(ctx, { agentId: atlas, justification: RETIRE }, deps);
    assert.equal(retired.status, "retired", JSON.stringify(retired));
    const after = await ledger();
    assert.deepEqual(
      after,
      { decisions: before.decisions + 1, sessions: before.sessions + 1, audit: before.audit + 1 },
      "exactly one decision, one session and one audit row per retirement",
    );
    const decisionId = retired.status === "retired" ? retired.retirement.governanceDecisionId : "";
    const sessionId = retired.status === "retired" ? retired.retirement.governanceSessionId : "";

    const decision = (
      await setup.query(
        `select d.*, s.governance_domain, s.subject_type as session_subject_type, s.subject_id as session_subject_id
           from decision_records d join governance_sessions s on s.id = d.session_id where d.id = $1`,
        [decisionId],
      )
    ).rows[0]!;
    assert.equal(decision.session_id, sessionId);
    assert.equal(decision.tenant_id, acme.tenantId);
    assert.equal(decision.subject_type, "agent-lifecycle");
    assert.equal(decision.subject_id, atlas);
    assert.equal(decision.decision_type, "revoke");
    assert.equal(decision.outcome, "agent-retired", "the outcome is agent-retired, never a revoked Governance authority");
    assert.equal(decision.governance_domain, "agent-lifecycle", "filed in its own domain");
    assert.equal(decision.session_subject_type, "agent-lifecycle");
    assert.equal(decision.justification, RETIRE, "the human's reason is the decision's justification");
    assert.equal(decision.actor_type, "human");
    assert.equal(decision.actor_id, acme.userId);

    const audit = (
      await setup.query<{ action: string; tenant_id: string; actor_id: string; metadata: Record<string, unknown> }>(
        `select action, tenant_id, actor_id, metadata from audit_log where entity_id = $1`,
        [decisionId],
      )
    ).rows;
    assert.equal(audit.length, 1, "one audit row names the decision");
    assert.equal(audit[0].action, "governance.decision.recorded");
    assert.equal(audit[0].tenant_id, acme.tenantId);
    assert.equal(audit[0].actor_id, acme.userId);
    assert.equal(audit[0].metadata.subjectType, "agent-lifecycle");
    assert.equal(audit[0].metadata.subjectId, atlas);
    assert.equal(audit[0].metadata.decisionType, "revoke");

    const row = await agentRow(atlas);
    assert.equal(row.agent_lifecycle_status, "retired");
    assert.ok(row.retired_at, "retired_at is stamped");
    assert.equal(row.version, 2, "the row advanced exactly one version");
    assert.equal(row.name, "Atlas");
    assert.equal(row.human_owner_id, acme.userId);
    assert.equal(await readDurableAgentRuntimeLiveness(acme.tenantId, atlas, deps), "not-in-service");

    /* ── (3) HISTORY PRESERVED — the registration decision is byte-identical ── */
    const registrationAfter = (
      await setup.query(`select * from decision_records where subject_id = $1 and subject_type = 'agent'`, [atlas])
    ).rows;
    assert.deepEqual(registrationAfter, registrationBefore, "the registration decision is untouched by retirement");

    /* ── (4) A SECOND RETIREMENT IS REFUSED AND RECORDS NOTHING ── */
    const again = await retireDurableAgentIdentity(ctx, { agentId: atlas, justification: RETIRE }, deps);
    assert.deepEqual(again, { status: "refused", reason: "agent-identity-already-retired" });
    assert.deepEqual(await ledger(), after, "a refused second retirement writes nothing");

    /* ── (5) TENANT ISOLATION ── */
    const cross = await retireDurableAgentIdentity(ctx, { agentId: foreign, justification: RETIRE }, deps);
    assert.deepEqual(cross, { status: "refused", reason: "agent-identity-not-found" });
    assert.deepEqual(await ledger(), after, "another organization's agent cannot be retired, and nothing is written");
    assert.equal(await readDurableAgentRuntimeLiveness(beta.tenantId, foreign, deps), "in-service");

    /* ── (6) A FAILING DECISION INSERT ROLLS EVERYTHING BACK ── */
    await setup.query(`
      create function l1b_fail_decision() returns trigger language plpgsql as $$
      begin raise exception 'l1b injected decision failure'; end $$;
      create trigger l1b_fail_decision before insert on decision_records
        for each row when (new.subject_type = 'agent-lifecycle') execute function l1b_fail_decision();
    `);
    await assert.rejects(
      retireDurableAgentIdentity(ctx, { agentId: borea, justification: RETIRE }, deps),
      /l1b injected decision failure|Failed query/,
      "a failing decision insert surfaces as an error",
    );
    assert.deepEqual(await ledger(), after, "decision failure: no decision, session or audit row survives");
    assert.equal((await agentRow(borea)).retired_at, null, "decision failure: the agent is still in service");
    assert.equal(await readDurableAgentRuntimeLiveness(acme.tenantId, borea, deps), "in-service");
    await setup.query(`drop trigger l1b_fail_decision on decision_records; drop function l1b_fail_decision();`);

    /* ── (7) A FAILING AUDIT INSERT ROLLS THE DECISION AND THE TRANSITION BACK ── */
    await setup.query(`
      create function l1b_fail_audit() returns trigger language plpgsql as $$
      begin raise exception 'l1b injected audit failure'; end $$;
      create trigger l1b_fail_audit before insert on audit_log
        for each row when (new.metadata ->> 'subjectType' = 'agent-lifecycle') execute function l1b_fail_audit();
    `);
    await assert.rejects(
      retireDurableAgentIdentity(ctx, { agentId: borea, justification: RETIRE }, deps),
      /l1b injected audit failure|Failed query/,
      "a failing audit insert surfaces as an error",
    );
    assert.deepEqual(await ledger(), after, "audit failure: the decision and session were rolled back too");
    assert.equal((await agentRow(borea)).retired_at, null, "audit failure: the agent is still in service");
    await setup.query(`drop trigger l1b_fail_audit on audit_log; drop function l1b_fail_audit();`);

    /* With the faults removed the same retirement commits normally. */
    assert.equal((await retireDurableAgentIdentity(ctx, { agentId: borea, justification: RETIRE }, deps)).status, "retired");

    /* ── (8) A `revoke` ON THIS SUBJECT IS NOT A REVOKED GOVERNANCE DELEGATION ── */
    const authority = await resolveGovernanceAuthority(ctx, deps);
    assert.equal(authority.authorized, true, "the Director still holds Governance authority after two retirements");

    /* ── (9) A TYPE WITH NO LIFECYCLE OUTCOME IS REFUSED ON THE AGENT-LIFECYCLE SUBJECT ── */
    const beforeWrong = await ledger();
    await assert.rejects(
      handle.db.transaction((tx) =>
        writeGovernanceDecisionWithin(
          tx as never,
          ctx,
          authority,
          { decisionType: "ratify", subjectType: AGENT_LIFECYCLE_SUBJECT_TYPE, subjectId: cleo, justification: RETIRE },
          new Date(),
        ),
      ),
      /agent-lifecycle-decision-type-unsupported/,
    );
    assert.deepEqual(await ledger(), beforeWrong, "an unsupported lifecycle decision type records nothing");
    assert.equal(await readDurableAgentRuntimeLiveness(acme.tenantId, cleo, deps), "in-service");

    console.log("l1b retirement governance postgres: ok");
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
