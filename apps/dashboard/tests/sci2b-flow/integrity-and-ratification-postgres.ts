/*
 * SCI-2B — THE INTEGRITY-AT-INSERT FACT, VERIFIED RATIFICATION, AND THE COMPOSED VERDICT, AGAINST A
 * REAL POSTGRES DATABASE.
 *
 *   "Only the database can say a version was protected since creation; only Governance can say a
 *    version was ratified; and the admissibility verdict is ELIGIBLE only when both say yes about
 *    an active version of the caller's own tenant."
 *
 * Positive cases run the released writers (create, supersede, ratify, reject, retract). Negative
 * cases go straight to SQL. Disposable database, dropped on exit. No network.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
// Loaded FIRST: the schema barrel is the only safe entry point for src/db/schema/*.
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity, type SeededLocalIdentity } from "../helpers/r1-identity-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { createKnowledgeFact } from "../../src/features/knowledge/knowledge-create.server";
import { supersedeKnowledgeFact } from "../../src/features/knowledge/knowledge-supersede.server";
import { retractKnowledgeSource } from "../../src/features/knowledge/retract-source.server";
import { ratifyKnowledgeVersion, rejectKnowledgeVersion } from "../../src/features/knowledge-ratification/ratify-version.server";
import { createDurableKnowledgeWriter } from "../../src/features/knowledge/durable-knowledge-writer.server";
import { createDurableKnowledgeRepository } from "../../src/features/knowledge/durable-knowledge-repository.server";
import { auditActorFrom } from "../../src/features/governance-audit/knowledge-mutation-audit.server";
import { readKnowledgeRatificationDecisions } from "../../src/features/governance-decision/knowledge-ratification-read.server";
import { readKnowledgeAdmissibilityFacts, type KnowledgeAdmissibilityFactsDeps } from "../../src/features/secure-content-admissibility/knowledge-facts.server";
import { evaluateAdmissibility } from "../../src/features/secure-content-admissibility/evaluate";
import { asHumanTenantContext, type TenantContext } from "../../src/features/auth/tenant/tenant-context";

const NOW = new Date("2026-10-06T18:00:00.000Z");
const PURPOSE = "agent-record-work-grounding";
const DIGEST = "e".repeat(64);
const REASON = "Governance has reviewed this exact version and records its decision here.";
const STAMP = "knowledge_nodes_stamp_integrity_at_insert";

function contextFor(seeded: SeededLocalIdentity, sessionContextId: string): TenantContext {
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
    requestId: "sci2b-request",
    authenticatedAt: NOW.toISOString(),
  });
}

async function sessionRowFor(client: Client, seeded: SeededLocalIdentity, tag: string): Promise<string> {
  const row = await client.query<{ id: string }>(
    `insert into user_session_contexts
       (auth_identity_id, provider_session_reference_hash, provider_session_reference_digest_version,
        user_id, active_tenant_id, active_membership_id, membership_version, assurance_level,
        mfa_verified, authenticated_at, issued_at, last_activity_at, absolute_expires_at,
        inactivity_expires_at)
     values ($1, $2, 1, $3, $4, $5, 1, 'aal1', false, now(), now(), now(),
             now() + interval '1 day', now() + interval '1 hour')
     returning id`,
    [seeded.authIdentityId, tag.repeat(64).slice(0, 64), seeded.userId, seeded.tenantId, seeded.membershipId],
  );
  return row.rows[0]!.id;
}

async function establishGovernance(client: Client, seeded: SeededLocalIdentity, ctx: TenantContext, deps: never) {
  await client.query(
    `insert into genesis_nominations
       (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
        accepted_at, accepted_session_context_id, accepted_assurance_level)
     values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
    [seeded.tenantId, seeded.authIdentityId, seeded.userId, ctx.sessionContextId],
  );
  const result = await establishGovernanceAuthority(ctx, { justification: "Establishing Governance authority so Knowledge can be reviewed." }, deps);
  assert.equal(result.status, "established");
}

async function refused(client: Client, sql: string, params: unknown[] = []): Promise<string> {
  await client.query("begin");
  try {
    await client.query(sql, params);
  } catch (error) {
    await client.query("rollback");
    return (error as { code: string }).code;
  }
  await client.query("rollback");
  assert.fail(`expected PostgreSQL to refuse: ${sql}`);
}

async function integrity(client: Client, nodeId: string): Promise<boolean | null> {
  const r = await client.query<{ v: boolean | null }>("select integrity_protected_at_insert as v from knowledge_nodes where id = $1", [nodeId]);
  return r.rows[0]!.v;
}

/** A row inserted while SCI-2A's update guard is off — the shape every pre-SCI-2B row has. */
async function insertUnprotected(client: Client, tenantId: string, label: string, claimed: boolean | null): Promise<string> {
  await client.query("begin");
  await client.query("alter table knowledge_nodes disable trigger knowledge_nodes_version_immutable_update");
  const r = await client.query<{ id: string }>(
    `insert into knowledge_nodes (tenant_id, type, label, statement, provenance, integrity_protected_at_insert)
     values ($1, 'knowledge-statement', $2, 'Legacy text.', '{"origin":"human-authored"}', $3) returning id`,
    [tenantId, label, claimed],
  );
  await client.query("alter table knowledge_nodes enable trigger knowledge_nodes_version_immutable_update");
  await client.query("commit");
  return r.rows[0]!.id;
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_sci2b_admissibility");
  await harness.createDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db, now: () => NOW } as never;
  const dbDeps = { knowledge: { getDb: () => handle.db }, governance: { getDb: () => handle.db } };

  const realFetch = globalThis.fetch;
  let networkCalls = 0;
  globalThis.fetch = (async () => {
    networkCalls += 1;
    throw new Error("SCI-2B makes no network call");
  }) as typeof fetch;

  try {
    harness.migrateDatabase();
    await setup.connect();

    const writer = createDurableKnowledgeWriter(handle.db);
    const repo = createDurableKnowledgeRepository(handle.db);
    const knowledgeDeps = {
      resolveAuthority: async () => ({ authorized: true, roleType: "owner" }),
      getWriter: () => writer,
      getRepo: () => repo,
      getRepository: () => repo,
      now: () => NOW,
    } as never;
    const alice = await seedLocalIdentity(setup, { companyName: "Acme", companySlug: "acme-sci2b", email: "alice@sci2b.test", password: "alice-correct-password-7Qx" });
    const bob = await seedLocalIdentity(setup, { companyName: "Globex", companySlug: "globex-sci2b", email: "bob@sci2b.test", password: "bob-correct-password-4Lm" });
    const aliceCtx = contextFor(alice, await sessionRowFor(setup, alice, "a"));
    const bobCtx = contextFor(bob, await sessionRowFor(setup, bob, "b"));
    await establishGovernance(setup, alice, aliceCtx, deps);
    await establishGovernance(setup, bob, bobCtx, deps);

    const verdict = async (ctx: TenantContext, nodeId: string, d: KnowledgeAdmissibilityFactsDeps = dbDeps) =>
      evaluateAdmissibility(ctx.tenantId, PURPOSE, await readKnowledgeAdmissibilityFacts(ctx, nodeId, NOW, d));
    const create = async (ctx: TenantContext, factKey: string) => {
      const created = await createKnowledgeFact(ctx, { factKey, domainKey: "policies", scope: "company-wide", title: factKey, statement: `${factKey} statement.` }, knowledgeDeps);
      assert.equal(created.status, "created");
      if (created.status !== "created") throw new Error("unreachable");
      return { factId: created.identity.factId, nodeId: created.identity.newKnowledgeNodeId! };
    };

    /* ── SCHEMA: the release writer's insert is stamped by the database ─────────────────── */
    const v1 = await create(aliceCtx, "leave.policy");
    assert.equal(await integrity(setup, v1.nodeId), true, "a new version is stamped TRUE");

    /* The application cannot forge it: whatever an INSERT supplies, the trigger decides. */
    for (const supplied of ["null", "false", "true"]) {
      const r = await setup.query<{ v: boolean | null }>(
        `insert into knowledge_nodes (tenant_id, type, label, integrity_protected_at_insert)
         values ($1, 'knowledge-statement', $2, ${supplied}) returning integrity_protected_at_insert as v`,
        [alice.tenantId, `forge-${supplied}`],
      );
      assert.equal(r.rows[0]!.v, true, `INSERT supplying ${supplied} is stamped by the database`);
    }
    assert.equal(await refused(setup, "insert into knowledge_nodes (tenant_id, type, label, integrity_protected_at_insert) values ($1, 'x', 'bad', 'maybe')", [alice.tenantId]), "22P02");
    // While protection is off, a self-asserted TRUE is not believed: the stamp is NULL.
    const legacy = await insertUnprotected(setup, alice.tenantId, "legacy", true);
    assert.equal(await integrity(setup, legacy), null, "no protection at insert → not established");

    /* Frozen by SCI-2A: legacy NULL can never become TRUE; TRUE can never be cleared. */
    assert.equal(await refused(setup, "update knowledge_nodes set integrity_protected_at_insert = true where id = $1", [legacy]), "23001");
    assert.equal(await refused(setup, "update knowledge_nodes set integrity_protected_at_insert = null where id = $1", [v1.nodeId]), "23001");
    assert.equal((await setup.query("update knowledge_nodes set integrity_protected_at_insert = true where id = $1", [v1.nodeId])).rowCount, 1, "same value: no change");
    assert.equal(await refused(setup, "update knowledge_nodes set statement = 'rewritten' where id = $1", [v1.nodeId]), "23001", "SCI-2A content guard intact");
    assert.equal(await refused(setup, "delete from knowledge_nodes where id = $1", [v1.nodeId]), "23001");
    assert.equal(await refused(setup, "truncate knowledge_nodes cascade"), "23001");

    /* Supersede creates a NEW stamped version; the old one keeps its own stamp. */
    const superseded = await supersedeKnowledgeFact(aliceCtx, { factId: v1.factId, title: "leave.policy", statement: "leave.policy statement.", observedKnowledgeVersion: 1 }, knowledgeDeps);
    assert.equal(superseded.status, "superseded", "a same-text successor is allowed");
    if (superseded.status !== "superseded") throw new Error("unreachable");
    const v2 = superseded.identity.newKnowledgeNodeId;
    assert.equal(await integrity(setup, v2), true);

    /* ── RATIFICATION: the real K4 path still binds, and Governance verifies the claim ─────── */
    const ratified = await ratifyKnowledgeVersion(aliceCtx, { factId: v1.factId, knowledgeNodeId: v2, observedKnowledgeVersion: 2, justification: REASON }, deps);
    assert.equal(ratified.status, "ratified", JSON.stringify(ratified));
    const claim = (await setup.query<{ d: string }>("select ratification_decision_id::text d from knowledge_nodes where id = $1", [v2])).rows[0]!.d;
    const decisions = await readKnowledgeRatificationDecisions(aliceCtx, v2, dbDeps.governance);
    assert.deepEqual(decisions, { status: "read", ratifyDecisionIds: new Set([claim]) });
    assert.deepEqual(await readKnowledgeRatificationDecisions(bobCtx, v2, dbDeps.governance), { status: "read", ratifyDecisionIds: new Set() }, "another tenant sees no decision");

    /* ── SCI: the one ELIGIBLE shape ────────────────────────────────────────────────────── */
    assert.deepEqual(await verdict(aliceCtx, v2), { status: "eligible" });
    assert.deepEqual(await verdict(aliceCtx, v1.nodeId), { status: "ineligible", reason: "inactive-version" }, "superseded");
    assert.deepEqual(await verdict(bobCtx, v2), { status: "ineligible", reason: "tenant-mismatch" }, "another tenant's version");

    const unratified = await create(aliceCtx, "travel.policy");
    assert.deepEqual(await verdict(aliceCtx, unratified.nodeId), { status: "ineligible", reason: "ratification-required" });

    /* A REJECT decision is not a ratification, even when the row is made to claim it. */
    const rejectedFact = await create(aliceCtx, "gift.policy");
    const rejected = await rejectKnowledgeVersion(aliceCtx, { factId: rejectedFact.factId, knowledgeNodeId: rejectedFact.nodeId, observedKnowledgeVersion: 1, justification: REASON }, deps);
    assert.equal(rejected.status, "rejected", JSON.stringify(rejected));
    const rejectId = (await setup.query<{ id: string }>("select id::text from decision_records where subject_id = $1 and decision_type = 'reject'", [rejectedFact.nodeId])).rows[0]!.id;
    await setup.query("update knowledge_nodes set ratification_decision_id = $2 where id = $1", [rejectedFact.nodeId, rejectId]);
    assert.deepEqual(await verdict(aliceCtx, rejectedFact.nodeId), { status: "ineligible", reason: "ratification-required" }, "reject is not ratify");

    /* WRONG SUBJECT: a row claiming another version's genuine ratify decision. */
    await setup.query("update knowledge_nodes set ratification_decision_id = $2 where id = $1", [unratified.nodeId, claim]);
    assert.deepEqual(await verdict(aliceCtx, unratified.nodeId), { status: "ineligible", reason: "ratification-required" }, "a decision about another version");

    /* CROSS-TENANT: bob's own ratify decision, claimed by an alice row. */
    const bobFact = await create(bobCtx, "leave.policy");
    const bobRatified = await ratifyKnowledgeVersion(bobCtx, { factId: bobFact.factId, knowledgeNodeId: bobFact.nodeId, observedKnowledgeVersion: 1, justification: REASON }, deps);
    assert.equal(bobRatified.status, "ratified");
    assert.deepEqual(await verdict(bobCtx, bobFact.nodeId), { status: "eligible" }, "bob's own version is eligible to bob");
    const bobDecision = (await setup.query<{ d: string }>("select ratification_decision_id::text d from knowledge_nodes where id = $1", [bobFact.nodeId])).rows[0]!.d;
    const crossFact = await create(aliceCtx, "cross.policy");
    await setup.query("update knowledge_nodes set ratification_decision_id = $2 where id = $1", [crossFact.nodeId, bobDecision]);
    assert.deepEqual(await verdict(aliceCtx, crossFact.nodeId), { status: "ineligible", reason: "ratification-required" }, "another tenant's decision");

    /* LEGACY: ratified by the real path, but inserted without protection → integrity-unestablished. */
    const legacyFact = await setup.query<{ id: string }>(
      `insert into knowledge_facts (tenant_id, fact_key, domain_key, knowledge_scope, active_knowledge_node_id)
       values ($1, 'legacy.policy', 'policies', 'company-wide', $2) returning id`,
      [alice.tenantId, legacy],
    );
    const legacyRatified = await ratifyKnowledgeVersion(aliceCtx, { factId: legacyFact.rows[0]!.id, knowledgeNodeId: legacy, observedKnowledgeVersion: 1, justification: REASON }, deps);
    assert.equal(legacyRatified.status, "ratified", JSON.stringify(legacyRatified));
    assert.deepEqual(await verdict(aliceCtx, legacy), { status: "ineligible", reason: "integrity-unestablished" });

    /* RETRACTION still works (content kept, standing withdrawn) and the version becomes inactive. */
    const ingested = await writer.createFact(
      auditActorFrom(aliceCtx),
      { factKey: "handbook.0", domainKey: "policies", scope: "company-wide", title: "Handbook", statement: "Handbook text.", ingestion: { sourceTitle: "Handbook", sourceType: "plain-text", sourceDigest: DIGEST, chunkIndex: 0, chunkCount: 1 } } as never,
      NOW,
    );
    assert.equal(ingested.status, "created");
    if (ingested.status !== "created") throw new Error("unreachable");
    const handbook = ingested.identity.newKnowledgeNodeId!;
    assert.equal(await integrity(setup, handbook), true, "manual/pasted text is stamped like any other insert");
    const retracted = await retractKnowledgeSource(aliceCtx, { sourceDigest: DIGEST }, { getDb: () => handle.db, resolveAuthority: async () => ({ authorized: true, roleType: "owner" }), now: () => NOW } as never);
    assert.equal(retracted.status, "retracted", JSON.stringify(retracted));
    assert.deepEqual(await verdict(aliceCtx, handbook), { status: "ineligible", reason: "inactive-version" });

    /* ── UNAVAILABLE is not "not ratified" ──────────────────────────────────────────────── */
    const unavailable = { status: "unavailable", reason: "authoritative-facts-unavailable" };
    assert.deepEqual(await verdict(aliceCtx, v2, { ...dbDeps, knowledge: { getDb: () => null } }), unavailable, "Knowledge reader down");
    assert.deepEqual(await verdict(aliceCtx, v2, { ...dbDeps, governance: { getDb: () => null } }), unavailable, "Governance reader down");
    const throwing = { getDb: () => ({ execute: async () => { throw new Error("down"); } }) as never };
    assert.deepEqual(await verdict(aliceCtx, v2, { ...dbDeps, governance: throwing }), unavailable, "Governance read failed");
    assert.deepEqual(await verdict(aliceCtx, v2, { ...dbDeps, knowledge: throwing }), unavailable, "Knowledge read failed");

    /* ── SCHEMA BITE-PROOFS (each in a rolled-back transaction) ─────────────────────────── */
    const insertStamp = async (): Promise<boolean | null> => {
      const r = await setup.query<{ v: boolean | null }>(
        "insert into knowledge_nodes (tenant_id, type, label) values ($1, 'x', 'bite') returning integrity_protected_at_insert as v",
        [alice.tenantId],
      );
      return r.rows[0]!.v;
    };
    await setup.query("begin");
    await setup.query(`drop trigger "${STAMP}" on knowledge_nodes`);
    assert.notEqual(await insertStamp(), true, "BITE: without the stamp trigger, a new insert is not established");
    await setup.query("rollback");

    // The marker made mutable: SCI-2A's allowlist widened to include it, so legacy NULL → TRUE passes.
    const sci2a = readFileSync(`src/db/migrations/${readdirSync("src/db/migrations").find((f) => f.endsWith("_sci2a_knowledge_version_immutability.sql"))}`, "utf8");
    const widened = sci2a
      .slice(sci2a.indexOf("CREATE FUNCTION"), sci2a.indexOf("--> statement-breakpoint"))
      .replace("CREATE FUNCTION", "CREATE OR REPLACE FUNCTION")
      .replace("'updated_at', 'updated_by', 'updated_by_type'", "'updated_at', 'updated_by', 'updated_by_type', 'integrity_protected_at_insert'");
    await setup.query("begin");
    await setup.query(widened);
    const r = await setup.query("update knowledge_nodes set integrity_protected_at_insert = true where id = $1", [legacy]);
    assert.equal(r.rowCount, 1, "BITE: an allowlisted marker lets legacy NULL become TRUE — which the frozen check above refuses");
    await setup.query("rollback");
    assert.equal(await integrity(setup, legacy), null);
    assert.equal(await insertStamp(), true, "the shipped stamp is back after rollback");

    assert.equal(networkCalls, 0, "no provider or network call occurred");
    console.log("sci2b integrity-and-ratification-postgres checks passed");
  } finally {
    globalThis.fetch = realFetch;
    await handle.dispose().catch(() => undefined);
    await setup.end().catch(() => undefined);
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
