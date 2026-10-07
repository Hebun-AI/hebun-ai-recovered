import assert from "node:assert/strict";
import { Client } from "pg";
import { getSnapshot as getAgentSnapshot } from "../../src/features/agent-crud/agent-adapter";
import type { AgentCrudRecord } from "../../src/features/agent-crud/types";
import { runActorShadowRead } from "../../src/features/actor-shadow-read";
import { createCanonicalReadServices } from "../../src/features/canonical-read";
import { getDirectorDashboardSnapshot } from "../../src/features/director-dashboard/foundation";
import { DirectorAIRuntime } from "../../src/features/director-ai-runtime";
import { OrganizationalIntelligenceEngine } from "../../src/features/organizational-intelligence";
import {
  activeProvider,
  createRepository,
} from "../../src/features/persistence";
import type { PostgresPersistenceError } from "../../src/features/persistence/postgres-errors";
import { listRegisteredPersistenceProviders } from "../../src/features/persistence/provider-registry";
import { createPostgresAdapter } from "../../src/features/persistence/supabase-postgres-adapter";
import {
  ensureRuntimeProjectionRegistry,
  runtimeProjectionRegistry,
  type RuntimeProjectionCollection,
} from "../../src/features/runtime-projection";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";

const harness = createDisposablePostgresHarness("hebun_phase_3c3_verify");
const PROJECTION_COLLECTIONS: readonly RuntimeProjectionCollection[] = [
  "organization-runtime",
  "agent-runtime",
  "workflow-runtime",
  "goal-runtime",
  "mission-runtime",
  "knowledge-runtime",
  "memory-runtime",
  "decision-runtime",
  "executive-timeline-runtime",
];
const VOLATILE_KEYS = new Set([
  "generatedAt",
  "createdAt",
  "checkedAt",
  "lastRefreshedAt",
  "latencyMs",
  "lastDurationMs",
]);

function agent(id: string, name = id): AgentCrudRecord {
  return {
    id,
    name,
    slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
    description: `${name} digital employee`,
    department: "Marketing",
    category: "Specialist",
    owner: "Marketing",
    status: "idle",
    version: "v1.0.0",
    capabilities: ["research", "content"],
    provider: "reference-simulation-provider",
    model: "gpt-5.4-mini",
    tools: ["search", "analytics"],
    permissions: ["agent.read", "registry.read"],
    runtime: "simulation",
    memory: "Marketing working memory",
    knowledge: "Marketing playbooks",
    createdAt: "2026-07-16T10:00:00.000Z",
    updatedAt: "2026-07-16T10:00:00.000Z",
    createdBy: "Seed",
    updatedBy: "Seed",
    lifecycleStatus: "active",
    role: "Content Specialist",
    tasksToday: 3,
    costToday: 1.25,
    lastActive: "2026-07-16T09:55:00.000Z",
  };
}

async function expectCode(
  run: () => Promise<unknown>,
  code: string,
): Promise<void> {
  await assert.rejects(run, (error: PostgresPersistenceError) => error.code === code);
}

function projectionData(): Record<string, unknown> {
  return Object.fromEntries(
    PROJECTION_COLLECTIONS.map((collection) => {
      const snapshot = runtimeProjectionRegistry.getSnapshot(collection);
      assert.ok(snapshot, `Missing ${collection} snapshot.`);
      return [collection, snapshot.data];
    }),
  );
}

function semanticSnapshot<T>(value: T): unknown {
  return JSON.parse(
    JSON.stringify(value, (key, current) =>
      VOLATILE_KEYS.has(key) ? undefined : current,
    ),
  );
}

async function main(): Promise<void> {
  ensureRuntimeProjectionRegistry();
  const memoryBefore = getAgentSnapshot();
  const projectionsBefore = projectionData();
  const dashboardBefore = semanticSnapshot(await getDirectorDashboardSnapshot());
  const directorBefore = semanticSnapshot(DirectorAIRuntime.getRuntimeSurface());
  const intelligenceBefore = semanticSnapshot(
    OrganizationalIntelligenceEngine.getSnapshot(),
  );

  await harness.createDatabase();
  let adapter: ReturnType<typeof createPostgresAdapter<AgentCrudRecord>> | undefined;
  const setup = new Client({ connectionString: harness.dbUrl });
  try {
    harness.migrateDatabase();
    await setup.connect();
    const object = await setup.query<{ relation: string | null }>(
      "select to_regclass('public.agents')::text as relation",
    );
    assert.equal(object.rows[0]?.relation, "agents");

    const tenants = await setup.query<{ id: string }>(
      `insert into companies (name, slug)
       values ('Agent Tenant A', 'agent-tenant-a'),
              ('Agent Tenant B', 'agent-tenant-b')
       returning id`,
    );
    const tenantA = tenants.rows[0]!.id;
    const tenantB = tenants.rows[1]!.id;
    const departments = await setup.query<{ id: string; tenant_id: string }>(
      `insert into departments (tenant_id, name, slug)
       values ($1, 'Marketing', 'marketing'),
              ($2, 'Marketing', 'marketing')
       returning id, tenant_id`,
      [tenantA, tenantB],
    );
    const departmentA = departments.rows.find((row) => row.tenant_id === tenantA)!.id;
    const contextA = { tenantId: tenantA };
    const contextB = { tenantId: tenantB };
    const env: NodeJS.ProcessEnv = {
      HEBUN_PERSISTENCE_POSTGRES_DATABASE_URL: harness.dbUrl,
      HEBUN_CANONICAL_READ_DATABASE_URL: harness.dbUrl,
      NODE_ENV: "test",
    };

    adapter = createPostgresAdapter<AgentCrudRecord>({
      collection: "agents",
      seed: () => [],
      env,
    });
    assert.equal(activeProvider(), "memory");
    assert.deepEqual(adapter.manifest.supportedCollections, [
      "registries",
      "knowledge-nodes",
      "agents",
      "workflows",
      "memories",
    ]);
    assert.equal(adapter.manifest.transactional, true);
    assert.equal(adapter.manifest.tenantIsolation, false);

    const sample = agent("agent-content", "Content Agent");
    const missingTenantOperations: Array<() => Promise<unknown>> = [
      () => adapter!.load(),
      () => adapter!.save([]),
      () => adapter!.create(sample),
      () => adapter!.update(sample.id, { name: "Updated" }),
      () => adapter!.delete(sample.id),
      () => adapter!.restore(sample.id),
      () => adapter!.archive(sample.id),
      () => adapter!.exists(sample.id),
      () => adapter!.list(),
      () => adapter!.find(() => true),
      () => adapter!.clear(),
      () => adapter!.transaction(async () => undefined),
    ];
    for (const operation of missingTenantOperations) {
      await expectCode(operation, "PERSISTENCE_TENANT_REQUIRED");
    }

    let notifications = 0;
    const unsubscribe = adapter.subscribe(() => {
      notifications += 1;
    });
    assert.deepEqual(await adapter.load(contextA), []);
    assert.equal(notifications, 1);

    assert.deepEqual(await adapter.create(sample, contextA), sample);
    assert.equal(notifications, 2);
    const physical = await setup.query<{
      id: string;
      department_id: string;
      provider_profile: Record<string, unknown>;
    }>(
      `select id, department_id, provider_profile
         from agents
        where tenant_id = $1
          and provider_profile->'hebunAgentCrudV1'->>'logicalId' = $2`,
      [tenantA, sample.id],
    );
    const physicalId = physical.rows[0]!.id;
    assert.notEqual(physicalId, sample.id);
    assert.equal(physical.rows[0]?.department_id, departmentA);
    assert.equal(
      (physical.rows[0]?.provider_profile.hebunAgentCrudV1 as { logicalId?: string })
        .logicalId,
      sample.id,
    );

    await expectCode(
      () => adapter!.create(sample, contextA),
      "PERSISTENCE_LOGICAL_ID_CONFLICT",
    );
    await adapter.create(sample, contextB);
    assert.equal((await adapter.list(contextA)).length, 1);
    assert.equal((await adapter.list(contextB)).length, 1);

    await setup.query(
      `update agents
          set provider_profile = provider_profile ||
              '{"canonicalSibling":{"source":"preserved"}}'::jsonb,
              authority_ceiling = '{"maxRisk":"medium"}'::jsonb
        where id = $1`,
      [physicalId],
    );
    const updated = await adapter.update(
      sample.id,
      { status: "running", tasksToday: 4, updatedBy: "Director" },
      contextA,
    );
    assert.equal(updated?.status, "running");
    assert.equal(updated?.tasksToday, 4);
    const preserved = await setup.query<{
      provider_profile: { canonicalSibling?: { source?: string } };
      authority_ceiling: { maxRisk?: string };
    }>("select provider_profile, authority_ceiling from agents where id = $1", [
      physicalId,
    ]);
    assert.equal(preserved.rows[0]?.provider_profile.canonicalSibling?.source, "preserved");
    assert.equal(preserved.rows[0]?.authority_ceiling.maxRisk, "medium");

    await adapter.create(agent("alpha-agent", "Alpha Agent"), contextA);
    assert.deepEqual(
      (await adapter.list(contextA)).map((item) => item.id),
      ["agent-content", "alpha-agent"].sort(),
    );
    const repository = createRepository(adapter);
    assert.equal((await repository.findById(sample.id, contextA))?.id, sample.id);
    assert.equal(await adapter.exists(sample.id, contextA), true);

    assert.equal((await adapter.archive(sample.id, contextA))?.lifecycleStatus, "archived");
    assert.equal((await adapter.restore(sample.id, contextA))?.lifecycleStatus, "active");
    assert.equal((await adapter.delete(sample.id, contextA))?.lifecycleStatus, "deleted");
    assert.equal((await adapter.list(contextB))[0]?.lifecycleStatus, "active");

    const immutable = adapter.getSnapshot();
    assert.throws(() => {
      immutable[0]!.capabilities.push("mutated");
    });

    const beforeUnresolved = adapter.getSnapshot();
    const notificationsBeforeUnresolved = notifications;
    await expectCode(
      () =>
        adapter!.create(
          { ...agent("unresolved"), department: "Missing Department" },
          contextA,
        ),
      "PERSISTENCE_INVALID_RECORD_MAPPING",
    );
    assert.strictEqual(adapter.getSnapshot(), beforeUnresolved);
    assert.equal(notifications, notificationsBeforeUnresolved);

    const ambiguous = await setup.query<{ id: string }>(
      `insert into departments (tenant_id, name, slug)
       values ($1, 'Marketing', 'marketing-duplicate') returning id`,
      [tenantA],
    );
    await expectCode(() => adapter!.load(contextA), "PERSISTENCE_INVALID_RECORD_MAPPING");
    assert.strictEqual(adapter.getSnapshot(), beforeUnresolved);
    assert.equal(notifications, notificationsBeforeUnresolved);
    await setup.query("delete from departments where id = $1", [ambiguous.rows[0]!.id]);

    const invalid = await setup.query<{ id: string }>(
      `insert into agents (tenant_id, department_id, name, role, provider_profile)
       values ($1, $2, 'Invalid Agent', 'Invalid', null) returning id`,
      [tenantA, departmentA],
    );
    await expectCode(() => adapter!.load(contextA), "PERSISTENCE_INVALID_RECORD_MAPPING");
    assert.strictEqual(adapter.getSnapshot(), beforeUnresolved);
    assert.equal(notifications, notificationsBeforeUnresolved);
    await setup.query("delete from agents where id = $1", [invalid.rows[0]!.id]);

    const duplicate = await setup.query<{ id: string }>(
      /*
       * AP-1: two IN-SERVICE agents may no longer share a canonical name in one tenant
       * (`agents_tenant_name_in_service_uq`). The conflicting copy is written RETIRED, so it is still
       * a second physical row for the same logical id — the condition this assertion exists for.
       */
      `insert into agents
        (tenant_id, department_id, name, role, provider_profile,
         lifecycle_status, created_at, updated_at, retired_at)
       select tenant_id, department_id, name, role, provider_profile,
              lifecycle_status, created_at, updated_at, now()
         from agents
        where id = $1 returning id`,
      [physicalId],
    );
    await expectCode(() => adapter!.load(contextA), "PERSISTENCE_LOGICAL_ID_CONFLICT");
    assert.strictEqual(adapter.getSnapshot(), beforeUnresolved);
    assert.equal(notifications, notificationsBeforeUnresolved);
    await setup.query("delete from agents where id = $1", [duplicate.rows[0]!.id]);

    await adapter.load(contextA);
    const beforeCommitSnapshot = adapter.getSnapshot();
    const beforeCommitNotifications = notifications;
    await adapter.transaction(async (transactionAdapter) => {
      await transactionAdapter.create(agent("tx-one", "TX One"), contextA);
      await transactionAdapter.create(agent("tx-two", "TX Two"), contextA);
      assert.strictEqual(adapter!.getSnapshot(), beforeCommitSnapshot);
      assert.equal(notifications, beforeCommitNotifications);
    });
    assert.equal(notifications, beforeCommitNotifications + 1);
    assert.equal(await adapter.exists("tx-one", contextA), true);

    await expectCode(
      () =>
        adapter!.transaction(async (transactionAdapter) => {
          await transactionAdapter.create(agent("cross-tenant"), contextA);
          await transactionAdapter.create(agent("cross-tenant"), contextB);
        }),
      "PERSISTENCE_TENANT_MISMATCH",
    );
    assert.equal(await adapter.exists("cross-tenant", contextA), false);
    await expectCode(
      () =>
        adapter!.transaction((transactionAdapter) =>
          transactionAdapter.transaction(async () => undefined),
        ),
      "PERSISTENCE_OPERATION_UNSUPPORTED",
    );

    const beforeRollback = adapter.getSnapshot();
    const beforeRollbackNotifications = notifications;
    await expectCode(
      () =>
        adapter!.transaction(async (transactionAdapter) => {
          await transactionAdapter.create(agent("rollback"), contextA);
          throw new Error("rollback requested");
        }),
      "PERSISTENCE_TRANSACTION_FAILED",
    );
    assert.strictEqual(adapter.getSnapshot(), beforeRollback);
    assert.equal(notifications, beforeRollbackNotifications);
    assert.equal(await adapter.exists("rollback", contextA), false);

    const saved = agent("saved-agent", "Saved Agent");
    await adapter.save([saved], contextA);
    assert.deepEqual((await adapter.list(contextA)).map((item) => item.id), [saved.id]);
    const savedPhysical = await setup.query<{ id: string }>(
      `select id from agents
        where tenant_id = $1
          and provider_profile->'hebunAgentCrudV1'->>'logicalId' = $2`,
      [tenantA, saved.id],
    );
    const canonicalServices = createCanonicalReadServices({
      connectionString: harness.dbUrl,
    });
    try {
      const canonical = await canonicalServices.resolveActor({
        tenantId: tenantA,
        actorType: "agent",
        actorId: savedPhysical.rows[0]!.id,
      });
      assert.equal(canonical.status, "resolved");
      assert.equal(canonical.displayLabel, saved.name);
      assert.equal(canonical.department, saved.department);
      const shadow = await runActorShadowRead(
        {
          tenantId: tenantA,
          actorType: "agent",
          actorId: savedPhysical.rows[0]!.id,
        },
        {
          canonicalReadServices: canonicalServices,
          memorySummary: {
            source: "agent-crud",
            actorType: "agent",
            actorId: savedPhysical.rows[0]!.id,
            tenantId: tenantA,
            displayLabel: saved.name,
            lifecycleStatus: saved.lifecycleStatus,
            active: true,
            suspended: false,
            archived: false,
            department: saved.department,
          },
        },
      );
      assert.equal(shadow.diff.matchedFields.some((field) => field.field === "displayLabel"), true);
      assert.equal(shadow.diff.matchedFields.some((field) => field.field === "department"), true);
    } finally {
      await canonicalServices.dispose();
    }

    await setup.query(
      `insert into memories (tenant_id, agent_id, content)
       values ($1, $2, 'Agent reference guard')`,
      [tenantA, savedPhysical.rows[0]!.id],
    );
    const beforeReferencedClear = adapter.getSnapshot();
    const notificationsBeforeReferencedClear = notifications;
    await expectCode(() => adapter!.clear(contextA), "PERSISTENCE_INVALID_RECORD_MAPPING");
    assert.strictEqual(adapter.getSnapshot(), beforeReferencedClear);
    assert.equal(notifications, notificationsBeforeReferencedClear);
    await setup.query("delete from memories where tenant_id = $1", [tenantA]);

    const tenantBCount = (await adapter.list(contextB)).length;
    await adapter.clear(contextA);
    assert.deepEqual(adapter.getSnapshot(), []);
    assert.equal((await adapter.list(contextA)).length, 0);
    assert.equal((await adapter.list(contextB)).length, tenantBCount);

    const providers = await listRegisteredPersistenceProviders(env);
    const postgres = providers.find((provider) => provider.key === "postgres");
    assert.equal(postgres?.active, false);
    assert.equal(postgres?.status, "available");
    assert.deepEqual(postgres?.collections, [
      "registries",
      "knowledge-nodes",
      "agents",
      "workflows",
      "memories",
    ]);
    assert.equal(postgres?.health.state, "healthy");
    assert.equal((await adapter.health()).ok, true);
    assert.equal(activeProvider(), "memory");

    runtimeProjectionRegistry.refreshAll();
    assert.strictEqual(getAgentSnapshot(), memoryBefore);
    assert.deepEqual(projectionData(), projectionsBefore);
    assert.deepEqual(
      semanticSnapshot(await getDirectorDashboardSnapshot()),
      dashboardBefore,
    );
    assert.deepEqual(
      semanticSnapshot(DirectorAIRuntime.getRuntimeSurface()),
      directorBefore,
    );
    assert.deepEqual(
      semanticSnapshot(OrganizationalIntelligenceEngine.getSnapshot()),
      intelligenceBefore,
    );

    unsubscribe();
    const notificationsAfterUnsubscribe = notifications;
    await adapter.clear(contextB);
    assert.equal(notifications, notificationsAfterUnsubscribe);
  } finally {
    if (adapter) await adapter.dispose();
    await setup.end().catch(() => undefined);
    await harness.dropDatabase();
    const admin = new Client({ connectionString: harness.adminUrl });
    await admin.connect();
    try {
      const exists = await admin.query<{ exists: boolean }>(
        "select exists(select 1 from pg_database where datname = $1) as exists",
        [harness.dbName],
      );
      assert.equal(exists.rows[0]?.exists, false);
    } finally {
      await admin.end();
    }
  }

  console.log("postgres agents conformance checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
