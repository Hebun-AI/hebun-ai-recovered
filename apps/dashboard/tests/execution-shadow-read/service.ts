import assert from "node:assert/strict";
import { runExecutionShadowRead } from "../../src/features/execution-shadow-read";
import type { CanonicalReadServices } from "../../src/features/canonical-read";
import type { MemoryExecutionLineageSummary } from "../../src/features/execution-shadow-read";

const input = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  executionId: "exec-1",
};

function memorySummary(): MemoryExecutionLineageSummary {
  return {
    source: "execution-session",
    execution: {
      id: "exec-1",
      version: "1",
      lifecycleStatus: "running",
      legacyStatus: "running",
      simulationMode: "offline",
    },
    command: {
      id: "cmd-1",
      version: "1",
      lifecycleStatus: "running",
      legacyStatus: "running",
      correlationId: "corr-1",
      causationId: "cause-1",
      idempotencyKey: "idem-1",
    },
    workflow: { id: "wf-1", version: "1", lifecycleStatus: "active" },
    task: { id: "task-1", lifecycleStatus: "running", legacyStatus: "planned" },
    plan: { id: "plan-1", version: "1" },
    goal: { id: "goal-1", version: "1" },
    mission: { id: "mission-1", version: "1" },
    completeness: "complete",
    warnings: [],
  };
}

function canonicalServices(
  override: Partial<Awaited<ReturnType<CanonicalReadServices["getExecutionLineage"]>>>,
): CanonicalReadServices {
  return {
    availability: async () => ({
      available: true,
      configured: true,
      source: "postgres",
      warnings: [],
    }),
    dispose: async () => undefined,
    resolveActor: async () => {
      throw new Error("not used");
    },
    selectCanonicalKnowledgeFact: async () => {
      throw new Error("not used");
    },
    getExecutionLineage: async () => ({
      kind: "execution-lineage",
      status: "resolved",
      availability: {
        available: true,
        configured: true,
        source: "postgres",
        warnings: [],
      },
      executionId: input.executionId,
      tenantId: input.tenantId,
      completeness: "complete",
      execution: {
        id: "exec-1",
        tenantId: input.tenantId,
        version: 1,
        lifecycleStatus: "running",
        legacyStatus: "running",
        simulationMode: "offline",
      },
      command: {
        id: "cmd-1",
        tenantId: input.tenantId,
        version: 1,
        lifecycleStatus: "running",
        legacyStatus: "running",
        correlationId: "corr-1",
        causationId: "cause-1",
        idempotencyKey: "idem-1",
      },
      workflow: {
        id: "wf-1",
        tenantId: input.tenantId,
        version: 1,
        lifecycleStatus: "active",
      },
      task: {
        id: "task-1",
        tenantId: input.tenantId,
        lifecycleStatus: "running",
        legacyStatus: "planned",
      },
      plan: { id: "plan-1", tenantId: input.tenantId, version: 1 },
      goal: { id: "goal-1", tenantId: input.tenantId, version: 1 },
      mission: { id: "mission-1", tenantId: input.tenantId, version: 1 },
      warnings: [],
      ...override,
    }),
  };
}

async function main() {
  const exact = await runExecutionShadowRead(input, {
    canonicalReadServices: canonicalServices({}),
    memorySummary: memorySummary(),
  });
  assert.equal(exact.status, "partial-match");
  assert.ok(exact.diff.mismatchCategories.includes("non-comparable field"));

  const partial = await runExecutionShadowRead(input, {
    canonicalReadServices: canonicalServices({}),
    memorySummary: { ...memorySummary(), mission: undefined, completeness: "partial" },
  });
  assert.equal(partial.status, "partial-match");

  const tenantMismatch = await runExecutionShadowRead(input, {
    canonicalReadServices: canonicalServices({
      status: "tenant-mismatch",
      completeness: "missing-root",
      execution: undefined,
      command: undefined,
      workflow: undefined,
      task: undefined,
      plan: undefined,
      goal: undefined,
      mission: undefined,
      reason: "execution-tenant-mismatch",
      error: {
        code: "tenant_mismatch",
        message: "tenant mismatch",
        retryable: false,
      },
    }),
    memorySummary: memorySummary(),
  });
  assert.equal(tenantMismatch.status, "tenant-mismatch");

  const unavailable = await runExecutionShadowRead(input, {
    canonicalReadServices: canonicalServices({
      status: "unavailable",
      completeness: "missing-root",
      execution: undefined,
      command: undefined,
      workflow: undefined,
      task: undefined,
      plan: undefined,
      goal: undefined,
      mission: undefined,
      reason: "missing_database_url",
      availability: {
        available: false,
        configured: false,
        source: "postgres",
        reason: "missing_database_url",
        warnings: [],
      },
      error: {
        code: "unavailable",
        message: "no db",
        retryable: false,
      },
    }),
    memorySummary: memorySummary(),
  });
  assert.equal(unavailable.status, "unavailable");

  const postgresOnly = await runExecutionShadowRead(input, {
    canonicalReadServices: canonicalServices({}),
  });
  assert.equal(postgresOnly.status, "postgres-only");

  const notFound = await runExecutionShadowRead(input, {
    canonicalReadServices: canonicalServices({
      status: "not-found",
      completeness: "missing-root",
      execution: undefined,
      command: undefined,
      workflow: undefined,
      task: undefined,
      plan: undefined,
      goal: undefined,
      mission: undefined,
      reason: "execution-not-found",
      error: {
        code: "not_found",
        message: "missing",
        retryable: false,
      },
    }),
  });
  assert.equal(notFound.status, "not-found");

  const invalid = await runExecutionShadowRead(
    { tenantId: "bad", executionId: "bad" },
    {
      canonicalReadServices: canonicalServices({}),
      memorySummary: memorySummary(),
    },
  );
  assert.equal(invalid.status, "invalid-input");

  console.log("execution-shadow-read service checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
