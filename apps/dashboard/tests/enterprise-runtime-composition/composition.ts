import assert from "node:assert/strict";
import {
  composeEnterpriseProjectionProvider,
  composeEnterpriseRuntime,
  getActiveEnterpriseProjectionProvider,
  getActiveEnterpriseRepositories,
  resolveEnterpriseRepositoryMode,
} from "../../src/features/enterprise-runtime-composition";
import { ENTERPRISE_PROJECTION_VERSION } from "../../src/features/enterprise-projections";

async function main(): Promise<void> {
const defaultProvider = composeEnterpriseProjectionProvider();
const explicitInMemoryProvider = composeEnterpriseProjectionProvider({ repositoryMode: "in-memory" });
const activeRuntime = composeEnterpriseRuntime();

assert.equal(resolveEnterpriseRepositoryMode(), "in-memory");
assert.equal(resolveEnterpriseRepositoryMode("postgresql"), "postgresql");
assert.equal(defaultProvider, explicitInMemoryProvider);
assert.equal(getActiveEnterpriseProjectionProvider(), defaultProvider);
assert.equal(activeRuntime.projectionProvider, defaultProvider);
assert.equal(activeRuntime.repositories, getActiveEnterpriseRepositories());
assert.equal(Object.isFrozen(activeRuntime), true);
assert.equal(Object.isFrozen(activeRuntime.repositories), true);
assert.throws(
  () => composeEnterpriseProjectionProvider({ repositoryMode: "runtime" }),
  /Unsupported enterprise repository mode: runtime/,
);
assert.throws(
  () => composeEnterpriseProjectionProvider({ repositoryMode: "postgresql" }),
  /require a connection string/,
);

const projections = await Promise.all([
  defaultProvider.getDirectorWorkspaceProjection(),
  defaultProvider.getOrganizationProjection(),
  defaultProvider.getKnowledgeProjection(),
  defaultProvider.getTimelineProjection(),
  defaultProvider.getDecisionProjection(),
  defaultProvider.getEnterpriseIntelligenceProjection(),
  defaultProvider.getHebyContextProjection(),
]);

for (const projection of projections) {
  assert.equal(projection.version, ENTERPRISE_PROJECTION_VERSION);
  assert.equal(projection.source.kind, "Mock Adapter");
  assert.equal(projection.projectionId.length > 0, true);
}

const timelineContext = await defaultProvider.getTimelineContextProjection();
assert.equal(timelineContext.recentDecisions.length, 3);
assert.equal(timelineContext.recentKnowledge.length, 3);
assert.equal(timelineContext.hebySuggestions.length, 3);

console.log("enterprise Runtime composition checks passed");
}

void main();
