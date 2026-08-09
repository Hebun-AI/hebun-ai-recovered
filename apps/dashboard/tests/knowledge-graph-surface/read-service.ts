import assert from "node:assert/strict";
import { readKnowledgeGraphFrom } from "../../src/features/knowledge-graph-surface/read-service";
import type { CanonicalReadAvailability } from "../../src/features/canonical-read";

/*
 * Knowledge Graph surface read service (Hebun UI Phase 21C).
 *
 * Proves the surface reports the honest state of the REAL canonical knowledge read
 * layer, fails closed without an authorized context, never enumerates a graph, and
 * never falls back to seeded/derived graph data.
 */

function availability(over: Partial<CanonicalReadAvailability>): CanonicalReadAvailability {
  return { available: false, configured: false, source: "postgres", warnings: [], ...over };
}

async function notConnectedWhenCanonicalUnavailable(): Promise<void> {
  const model = await readKnowledgeGraphFrom(
    async () =>
      availability({
        available: false,
        configured: false,
        reason: "missing_database_url",
        warnings: ["HEBUN_CANONICAL_READ_DATABASE_URL is not set."],
      }),
    { tenantId: "tenant-a" },
  );
  assert.equal(model.connection, "not-connected");
  assert.equal(model.configured, false);
  assert.equal(model.reason, "missing_database_url");
  assert.equal(model.nodes.length, 0);
  assert.equal(model.relationships.length, 0);
}

async function requiresAuthorizedContextWhenAvailableButNoTenant(): Promise<void> {
  const model = await readKnowledgeGraphFrom(
    async () => availability({ available: true, configured: true }),
    null,
  );
  assert.equal(model.connection, "requires-authorized-context");
  assert.equal(model.nodes.length, 0);
}

async function connectedEmptyWhenAvailableWithTenant(): Promise<void> {
  const model = await readKnowledgeGraphFrom(
    async () => availability({ available: true, configured: true }),
    { tenantId: "tenant-a" },
  );
  assert.equal(model.connection, "connected-empty", "governed read is by identity; nothing to enumerate");
  assert.equal(model.nodes.length, 0);
  assert.equal(model.relationships.length, 0);
}

async function readFailedWhenProbeThrows(): Promise<void> {
  const model = await readKnowledgeGraphFrom(async () => {
    throw new Error("probe boom");
  }, { tenantId: "tenant-a" });
  assert.equal(model.connection, "read-failed");
  assert.equal(model.nodes.length, 0);
}

async function neverPopulatesGraph(): Promise<void> {
  for (const state of [
    availability({ available: false }),
    availability({ available: true, configured: true }),
  ]) {
    const model = await readKnowledgeGraphFrom(async () => state, { tenantId: "t" });
    assert.equal(model.nodes.length, 0, "no seeded/derived nodes are ever produced");
    assert.equal(model.relationships.length, 0, "no fabricated relationships are ever produced");
    assert.equal(model.source, "canonical-postgres");
  }
}

async function main(): Promise<void> {
  await notConnectedWhenCanonicalUnavailable();
  await requiresAuthorizedContextWhenAvailableButNoTenant();
  await connectedEmptyWhenAvailableWithTenant();
  await readFailedWhenProbeThrows();
  await neverPopulatesGraph();
  console.log("knowledge-graph-surface read-service checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
