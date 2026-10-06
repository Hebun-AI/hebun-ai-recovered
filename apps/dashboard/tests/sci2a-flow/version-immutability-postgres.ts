/*
 * SCI-2A — KNOWLEDGE VERSION DATABASE IMMUTABILITY, AGAINST A REAL POSTGRES DATABASE.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "SAME KNOWLEDGE VERSION ID => SAME VERSION-DEFINING CONTENT — enforced by PostgreSQL itself,
 *    whatever SQL reaches it, while ratification, retraction and supersession keep working."
 *
 * Every negative case goes straight to SQL, bypassing every application guard: that is the point.
 * Every positive case runs the REAL released writer. Disposable database, dropped on exit.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
// Loaded FIRST: the schema barrel is the only safe entry point for src/db/schema/*.
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity, type SeededLocalIdentity } from "../helpers/r1-identity-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { createKnowledgeFact } from "../../src/features/knowledge/knowledge-create.server";
import { supersedeKnowledgeFact } from "../../src/features/knowledge/knowledge-supersede.server";
import { retractKnowledgeSource } from "../../src/features/knowledge/retract-source.server";
import { ratifyKnowledgeVersion } from "../../src/features/knowledge-ratification/ratify-version.server";
import { createDurableKnowledgeWriter } from "../../src/features/knowledge/durable-knowledge-writer.server";
import { createDurableKnowledgeRepository } from "../../src/features/knowledge/durable-knowledge-repository.server";
import { auditActorFrom } from "../../src/features/governance-audit/knowledge-mutation-audit.server";
import { createPostgresAdapter } from "../../src/features/persistence/supabase-postgres-adapter";
import type { KnowledgeNodeRecord } from "../../src/features/knowledge-crud/types";
import { asHumanTenantContext, type TenantContext } from "../../src/features/auth/tenant/tenant-context";

const NOW = new Date("2026-10-06T12:00:00.000Z");
const DIGEST = "f".repeat(64);
const FUNCTION_NAME = "knowledge_nodes_guard_version_immutability";
/* SCI-2B adds a fourth, separate trigger (the integrity-at-insert stamp); these three stay SCI-2A's. */
const TRIGGERS = [
  "knowledge_nodes_version_immutable_delete",
  "knowledge_nodes_version_immutable_truncate",
  "knowledge_nodes_version_immutable_update",
];
/** The columns the two in-place authorities own. Everything else is version-defining. */
const POST_CREATION_STATE = [
  "ratification_decision_id",
  "governance_session_id",
  "ratified_by_actor_type",
  "ratified_by_actor_id",
  "ratified_at",
  "knowledge_lifecycle_status",
  "retired_at",
  "updated_at",
  "updated_by",
  "updated_by_type",
];

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
    requestId: "sci2a-request",
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

async function establishGovernance(
  client: Client,
  seeded: SeededLocalIdentity,
  ctx: TenantContext,
  deps: never,
): Promise<void> {
  await client.query(
    `insert into genesis_nominations
       (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
        accepted_at, accepted_session_context_id, accepted_assurance_level)
     values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
    [seeded.tenantId, seeded.authIdentityId, seeded.userId, ctx.sessionContextId],
  );
  const result = await establishGovernanceAuthority(
    ctx,
    { justification: "Establishing Governance authority so Knowledge can be reviewed." },
    deps,
  );
  assert.equal(result.status, "established");
}

/** The version-defining projection of one row: the whole row minus the post-creation state. */
async function definingSnapshot(client: Client, nodeId: string): Promise<unknown> {
  const result = await client.query<{ row: unknown }>(
    "select to_jsonb(n) - $2::text[] as row from knowledge_nodes n where id = $1",
    [nodeId, POST_CREATION_STATE],
  );
  assert.ok(result.rows[0], `knowledge version ${nodeId} still exists`);
  return result.rows[0]!.row;
}

/** Runs one statement inside a savepoint so a refusal does not poison the connection. */
async function refusedOn(client: Client, sql: string, params: unknown[]): Promise<{ code: string; message: string }> {
  await client.query("begin");
  try {
    await client.query(sql, params);
  } catch (error) {
    await client.query("rollback");
    const pgError = error as { code: string; message: string };
    return { code: pgError.code, message: pgError.message };
  }
  await client.query("rollback");
  assert.fail(`expected PostgreSQL to refuse: ${sql}`);
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_sci2a_immutability");
  await harness.createDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db, now: () => NOW } as never;

  /* 19. NO PROVIDER OR NETWORK CALL. Any fetch from anything below fails the file. */
  const realFetch = globalThis.fetch;
  let networkCalls = 0;
  globalThis.fetch = (async () => {
    networkCalls += 1;
    throw new Error("SCI-2A makes no network call");
  }) as typeof fetch;

  try {
    harness.migrateDatabase();
    await setup.connect();

    /* ── 0. THE PROTECTION IS INSTALLED, AND IS EXACTLY THREE TRIGGERS ON ONE FUNCTION ─────── */
    {
      const triggers = await setup.query<{ tgname: string; proname: string }>(
        `select t.tgname, p.proname from pg_trigger t join pg_proc p on p.oid = t.tgfoid
          where t.tgrelid = 'public.knowledge_nodes'::regclass and not t.tgisinternal order by t.tgname`,
      );
      const guards = triggers.rows.filter((row) => row.proname === FUNCTION_NAME);
      assert.deepEqual(guards.map((row) => row.tgname), TRIGGERS);
    }

    const writer = createDurableKnowledgeWriter(handle.db);
    const repo = createDurableKnowledgeRepository(handle.db);
    const knowledgeDeps = {
      resolveAuthority: async () => ({ authorized: true, roleType: "owner" }),
      getWriter: () => writer,
      getRepo: () => repo,
      getRepository: () => repo,
      now: () => NOW,
    } as never;

    const alice = await seedLocalIdentity(setup, {
      companyName: "Acme",
      companySlug: "acme-sci2a",
      email: "alice@sci2a.test",
      password: "alice-correct-password-7Qx",
    });
    const bob = await seedLocalIdentity(setup, {
      companyName: "Globex",
      companySlug: "globex-sci2a",
      email: "bob@sci2a.test",
      password: "bob-correct-password-4Lm",
    });
    const aliceCtx = contextFor(alice, await sessionRowFor(setup, alice, "a"));
    const bobCtx = contextFor(bob, await sessionRowFor(setup, bob, "b"));
    await establishGovernance(setup, alice, aliceCtx, deps);

    /* ── 1. INSERTING A KNOWLEDGE VERSION SUCCEEDS (real writer) ──────────────────────────── */
    const created = await createKnowledgeFact(
      aliceCtx,
      {
        factKey: "pricing.policy",
        domainKey: "commerce",
        scope: "company-wide",
        title: "Pricing policy",
        statement: "Discounts above 20 percent require a second approver.",
      },
      knowledgeDeps,
    );
    assert.equal(created.status, "created");
    if (created.status !== "created") throw new Error("unreachable");
    const factId = created.identity.factId;
    const v1 = created.identity.newKnowledgeNodeId!;
    const v1Before = await definingSnapshot(setup, v1);

    const bobFact = await createKnowledgeFact(
      bobCtx,
      { factKey: "pricing.policy", domainKey: "commerce", scope: "company-wide", title: "Globex", statement: "Globex text." },
      knowledgeDeps,
    );
    assert.equal(bobFact.status, "created");
    if (bobFact.status !== "created") throw new Error("unreachable");
    const bobNode = bobFact.identity.newKnowledgeNodeId!;
    const bobBefore = await definingSnapshot(setup, bobNode);

    /* ── 2. AN UPDATE THAT REPEATS UNCHANGED PROTECTED VALUES IS NOT A MUTATION ───────────── */
    {
      const repeated = await setup.query(
        `update knowledge_nodes
            set tenant_id = tenant_id, type = type, label = label, statement = statement,
                provenance = provenance, source_attribution = source_attribution,
                knowledge_version = knowledge_version,
                supersedes_knowledge_node_id = supersedes_knowledge_node_id,
                domain_key = domain_key, knowledge_scope = knowledge_scope,
                created_at = created_at, created_by = created_by, updated_at = updated_at
          where id = $1`,
        [v1],
      );
      assert.equal(repeated.rowCount, 1, "an ORM-shaped update carrying unchanged values passes");
      // Semantic, not textual: the same JSON written with different spacing and key order.
      const provenance = await setup.query<{ text: string }>(
        "select provenance::text as text from knowledge_nodes where id = $1",
        [v1],
      );
      const reordered = JSON.stringify(
        Object.fromEntries(Object.entries(JSON.parse(provenance.rows[0]!.text)).reverse()),
        null,
        2,
      );
      await setup.query("update knowledge_nodes set provenance = $2::jsonb where id = $1", [v1, reordered]);
      assert.deepEqual(await definingSnapshot(setup, v1), v1Before);
    }

    /* ── 3-11. EVERY VERSION-DEFINING COLUMN REFUSES A CHANGE, INCLUDING NULL TRANSITIONS ─── */
    const mutations: ReadonlyArray<readonly [column: string, sql: string, params?: unknown[]]> = [
      ["statement", "statement = 'Discounts above 5 percent require nothing.'"],
      ["statement", "statement = null"],
      ["label", "label = 'Rewritten title'"],
      ["type", "type = 'other'"],
      ["provenance", `provenance = provenance || '{"origin":"forged"}'::jsonb`],
      ["provenance", "provenance = null"],
      ["source_attribution", `source_attribution = '{"source":"forged"}'::jsonb`],
      ["tenant_id", "tenant_id = $2", [bob.tenantId]],
      ["knowledge_version", "knowledge_version = 7"],
      ["supersedes_knowledge_node_id", "supersedes_knowledge_node_id = $2", [bobNode]],
      ["domain_key", "domain_key = 'other-domain'"],
      ["knowledge_scope", "knowledge_scope = null"],
      ["category_key", "category_key = 'forged'"],
      ["created_at", "created_at = created_at - interval '1 year'"],
      ["created_by", "created_by = $2", [bob.userId]],
      ["created_by", "created_by = null"],
      ["created_by_type", "created_by_type = 'agent'"],
      ["id", "id = gen_random_uuid()"],
      ["ref_id", "ref_id = 'legacy-address'"],
      ["owner_actor_id", "owner_actor_id = $2", [bob.userId]],
      ["references", `"references" = '["forged"]'::jsonb`],
      ["dependencies", `dependencies = '["forged"]'::jsonb`],
      ["memory_refs", `memory_refs = '["forged"]'::jsonb`],
      ["knowledge_authority", "knowledge_authority = 'authoritative'"],
      ["knowledge_health", "knowledge_health = 'current'"],
      ["effective_from", "effective_from = now()"],
      ["effective_until", "effective_until = now()"],
      ["next_review_at", "next_review_at = now()"],
      ["review_cadence", "review_cadence = 'P1D'"],
      ["freshness_evaluated_at", "freshness_evaluated_at = now()"],
      ["deprecated_at", "deprecated_at = now()"],
      ["steward_actor_id", "steward_actor_id = $2", [bob.userId]],
      ["version", "version = version + 1"],
      ["lifecycle_status", "lifecycle_status = 'archived'"],
      ["deleted_at", "deleted_at = now()"],
      ["deleted_by", "deleted_by = $2", [bob.userId]],
    ];
    for (const [column, assignment, extra = []] of mutations) {
      const refused = await refusedOn(
        setup,
        `update knowledge_nodes set ${assignment} where id = $1`,
        [v1, ...extra],
      );
      assert.equal(refused.code, "23001", `${column}: refused as restrict_violation`);
      assert.match(refused.message, new RegExp(`\\(.*\\b${column}\\b.*\\)$`), `${column}: the refusal names the column`);
    }
    // A protected change cannot ride along with a legitimate lifecycle change.
    const mixed = await refusedOn(
      setup,
      "update knowledge_nodes set knowledge_lifecycle_status = 'retired', statement = 'smuggled' where id = $1",
      [v1],
    );
    assert.equal(mixed.code, "23001");
    assert.deepEqual(await definingSnapshot(setup, v1), v1Before, "v1 is byte-identical after every refusal");

    /* ── 12. DELETE AND TRUNCATE ARE REFUSED; RETRACTION IS NOT DELETION ─────────────────── */
    {
      assert.equal((await refusedOn(setup, "delete from knowledge_nodes where id = $1", [v1])).code, "23001");
      assert.equal((await refusedOn(setup, "delete from knowledge_nodes where tenant_id = $1", [alice.tenantId])).code, "23001");
      assert.equal((await refusedOn(setup, "truncate knowledge_nodes cascade", [])).code, "23001");
      assert.equal((await refusedOn(setup, "truncate companies cascade", [])).code, "23001", "a cascade cannot reach it either");
    }

    /* ── 15-16. SUPERSESSION INSERTS A NEW ROW, LEAVES THE OLD ONE, MOVES THE FACT BY CAS ─── */
    const superseded = await supersedeKnowledgeFact(
      aliceCtx,
      { factId, title: "Pricing policy", statement: "Discounts above 15 percent require a second approver.", observedKnowledgeVersion: 1 },
      knowledgeDeps,
    );
    assert.equal(superseded.status, "superseded");
    if (superseded.status !== "superseded") throw new Error("unreachable");
    const v2 = superseded.identity.newKnowledgeNodeId;
    assert.notEqual(v2, v1, "a correction is a new row");
    assert.deepEqual(await definingSnapshot(setup, v1), v1Before, "the superseded version is untouched");
    {
      const fact = await setup.query<{ active: string; previous: string; version: number }>(
        `select active_knowledge_node_id as active, previous_knowledge_node_id as previous, fact_version as version
           from knowledge_facts where id = $1`,
        [factId],
      );
      assert.deepEqual(fact.rows[0], { active: v2, previous: v1, version: 2 }, "the fact CAS selected v2");
      const next = await setup.query<{ supersedes: string; version: number }>(
        "select supersedes_knowledge_node_id as supersedes, knowledge_version as version from knowledge_nodes where id = $1",
        [v2],
      );
      assert.deepEqual(next.rows[0], { supersedes: v1, version: 2 });
    }
    const v2Before = await definingSnapshot(setup, v2);

    /* ── 13. RATIFICATION SUCCEEDS AND WRITES ONLY WHAT IT OWNS (real authority, real DB) ─── */
    {
      const ratified = await ratifyKnowledgeVersion(
        aliceCtx,
        {
          factId,
          knowledgeNodeId: v2,
          observedKnowledgeVersion: 2,
          justification: "Governance has reviewed this exact version and records its decision here.",
        },
        deps,
      );
      assert.equal(ratified.status, "ratified", JSON.stringify(ratified));
      const row = await setup.query<{ decision: string | null; at: Date | null }>(
        "select ratification_decision_id as decision, ratified_at as at from knowledge_nodes where id = $1",
        [v2],
      );
      assert.ok(row.rows[0]!.decision, "the Governance linkage was bound");
      assert.equal(row.rows[0]!.at?.toISOString(), NOW.toISOString());
      assert.deepEqual(await definingSnapshot(setup, v2), v2Before, "ratification changed no version-defining column");
      // Ratified content is as immutable as any other.
      assert.equal((await refusedOn(setup, "update knowledge_nodes set statement = 'x' where id = $1", [v2])).code, "23001");
    }

    /* ── 14. RETRACTION SUCCEEDS AND WITHDRAWS WITHOUT REWRITING ─────────────────────────── */
    {
      const ingested = await writer.createFact(
        auditActorFrom(aliceCtx),
        {
          factKey: "handbook.chunk-0",
          domainKey: "policies",
          scope: "company-wide",
          title: "Handbook chunk",
          statement: "Ingested handbook text.",
          ingestion: { sourceTitle: "Handbook", sourceType: "plain-text", sourceDigest: DIGEST, chunkIndex: 0, chunkCount: 1 },
        } as never,
        NOW,
      );
      assert.equal(ingested.status, "created");
      if (ingested.status !== "created") throw new Error("unreachable");
      const node = ingested.identity.newKnowledgeNodeId!;
      const before = await definingSnapshot(setup, node);

      const retracted = await retractKnowledgeSource(aliceCtx, { sourceDigest: DIGEST }, {
        getDb: () => handle.db,
        resolveAuthority: async () => ({ authorized: true, roleType: "owner" }),
        now: () => NOW,
      } as never);
      assert.equal(retracted.status, "retracted", JSON.stringify(retracted));
      const row = await setup.query<{ lifecycle: string; retired: Date | null }>(
        "select knowledge_lifecycle_status as lifecycle, retired_at as retired from knowledge_nodes where id = $1",
        [node],
      );
      assert.equal(row.rows[0]!.lifecycle, "retired");
      assert.equal(row.rows[0]!.retired?.toISOString(), NOW.toISOString());
      assert.deepEqual(await definingSnapshot(setup, node), before, "the retracted version's content survives");
    }

    /* ── 17. THE LEGACY ADAPTER'S IN-PLACE SQL IS REFUSED WHEN IT REACHES THE DATABASE ───── */
    {
      const env = {
        HEBUN_PERSISTENCE_POSTGRES_DATABASE_URL: harness.dbUrl,
        NODE_ENV: "test",
      } as NodeJS.ProcessEnv;
      const adapter = createPostgresAdapter<KnowledgeNodeRecord>({ collection: "knowledge-nodes", seed: () => [], env });
      /*
       * Its own tenant: the adapter refuses to hydrate a tenant holding canonical (ref_id-less)
       * versions at all, so it can only ever be driven against legacy-only data.
       */
      const legacyTenant = (
        await setup.query<{ id: string }>("insert into companies (name, slug) values ('Legacy', 'legacy-sci2a') returning id")
      ).rows[0]!.id;
      const context = { tenantId: legacyTenant };
      try {
        const legacy: KnowledgeNodeRecord = {
          id: "legacy:goal",
          title: "Legacy goal",
          slug: "legacy-goal",
          description: "Legacy statement",
          nodeType: "Goal",
          ownerType: "organization",
          ownerId: "director",
          confidence: 90,
          importance: "high",
          status: "verified",
          version: "v1.0.0",
          source: "legacy",
          tags: ["legacy"],
          createdAt: NOW.toISOString(),
          updatedAt: NOW.toISOString(),
          createdBy: "Seed",
          updatedBy: "Seed",
          lifecycleStatus: "active",
        };
        await adapter.create(legacy, context);
        const physical = await setup.query<{ id: string }>(
          "select id from knowledge_nodes where tenant_id = $1 and ref_id = $2",
          [legacyTenant, legacy.id],
        );
        const legacyNode = physical.rows[0]!.id;
        const legacyBefore = await definingSnapshot(setup, legacyNode);

        /*
         * Through the adapter: every mutating path fails. The adapter maps 23001 to its generic
         * "operation failed" code, so the cause is proven separately below by replaying its SQL.
         */
        const failedInPostgres = (error: { code?: string }) => error.code === "PERSISTENCE_POSTGRES_UNAVAILABLE";
        await assert.rejects(() => adapter.update(legacy.id, { title: "Rewritten", description: "Rewritten" }, context), failedInPostgres);
        await assert.rejects(() => adapter.update(legacy.id, { confidence: 10 }, context), failedInPostgres);
        await assert.rejects(() => adapter.archive(legacy.id, context), failedInPostgres);
        await assert.rejects(() => adapter.delete(legacy.id, context), failedInPostgres);
        await assert.rejects(() => adapter.save([], context), failedInPostgres);
        await assert.rejects(() => adapter.clear(context), failedInPostgres);
        assert.equal((await adapter.health()).ok, true, "PostgreSQL is reachable: the failures are refusals");

        /*
         * The adapter's OWN statements, read from its source and sent straight to PostgreSQL: the
         * refusal is the trigger's, whatever routing or ref_id guard sits in front of them.
         */
        const adapterSource = readFileSync("src/features/persistence/supabase-postgres-adapter.ts", "utf8");
        const statement = (start: string) => {
          const at = adapterSource.indexOf(start);
          assert.ok(at >= 0, `the adapter still issues: ${start}`);
          // Up to the closing delimiter of whichever literal it opened: a template or a string.
          return adapterSource.slice(at, adapterSource.indexOf(adapterSource[at - 1]!, at));
        };
        const replays: ReadonlyArray<readonly [string, unknown[]]> = [
          [
            statement("update knowledge_nodes\n          set type = $3"),
            [legacyTenant, legacy.id, "Goal", "Legacy goal", "Rewritten statement", "{}", "active", NOW],
          ],
          [statement("update knowledge_nodes\n              set lifecycle_status = $3"), [legacyTenant, legacy.id, "deleted"]],
          [statement("delete from knowledge_nodes where tenant_id = $1 and not"), [legacyTenant, []]],
        ];
        for (const [sql, params] of replays) {
          assert.equal((await refusedOn(setup, sql, params)).code, "23001", sql.split("\n")[0]);
        }
        assert.deepEqual(await definingSnapshot(setup, legacyNode), legacyBefore);
        assert.deepEqual(await definingSnapshot(setup, v1), v1Before);
      } finally {
        await adapter.dispose();
      }
    }

    /* ── 18. TENANT ISOLATION IS INTACT ──────────────────────────────────────────────────── */
    {
      const crossTenant = await supersedeKnowledgeFact(
        bobCtx,
        { factId, title: "Hijack", statement: "Globex rewrites Acme.", observedKnowledgeVersion: 2 },
        knowledgeDeps,
      );
      assert.notEqual(crossTenant.status, "superseded", "another tenant cannot correct this fact");
      assert.deepEqual(await definingSnapshot(setup, bobNode), bobBefore, "tenant B's version is untouched by A's acts");
      const counts = await setup.query<{ tenant_id: string; n: string }>(
        "select tenant_id, count(*)::text as n from knowledge_nodes group by tenant_id order by tenant_id",
      );
      const byTenant = Object.fromEntries(counts.rows.map((row) => [row.tenant_id, Number(row.n)]));
      assert.equal(byTenant[bob.tenantId], 1);
      assert.equal(byTenant[alice.tenantId], 3, "v1, v2 and the ingested chunk");
    }

    assert.equal(networkCalls, 0, "no provider or network call occurred");
    console.log("sci2a version-immutability-postgres checks passed");
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
