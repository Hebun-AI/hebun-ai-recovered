import assert from "node:assert/strict";
import {
  composeEnterpriseProjectionProvider,
  composeEnterpriseRuntime,
  getActiveEnterpriseProjectionProvider,
  getActiveEnterpriseRepositories,
  resolveEnterpriseProjectionProviderMode,
} from "../../src/features/enterprise-runtime-composition";
import { ENTERPRISE_PROJECTION_VERSION } from "../../src/features/enterprise-projections";

const defaultProvider = composeEnterpriseProjectionProvider();
const explicitMockProvider = composeEnterpriseProjectionProvider("mock");
const activeRuntime = composeEnterpriseRuntime();

assert.equal(resolveEnterpriseProjectionProviderMode(), "mock");
assert.equal(resolveEnterpriseProjectionProviderMode("mock"), "mock");
assert.equal(defaultProvider, explicitMockProvider);
assert.equal(getActiveEnterpriseProjectionProvider(), defaultProvider);
assert.equal(activeRuntime.projectionProvider, defaultProvider);
assert.equal(activeRuntime.repositories, getActiveEnterpriseRepositories());
assert.equal(Object.isFrozen(activeRuntime), true);
assert.equal(Object.isFrozen(activeRuntime.repositories), true);
assert.throws(
  () => composeEnterpriseProjectionProvider("runtime"),
  /Unsupported enterprise projection provider mode: runtime/,
);

const projections = [
  defaultProvider.getDirectorWorkspaceProjection(),
  defaultProvider.getOrganizationProjection(),
  defaultProvider.getKnowledgeProjection(),
  defaultProvider.getTimelineProjection(),
  defaultProvider.getDecisionProjection(),
  defaultProvider.getEnterpriseIntelligenceProjection(),
  defaultProvider.getHebyContextProjection(),
];

for (const projection of projections) {
  assert.equal(projection.version, ENTERPRISE_PROJECTION_VERSION);
  assert.equal(projection.source.kind, "Mock Adapter");
  assert.equal(projection.projectionId.length > 0, true);
}

const timelineContext = defaultProvider.getTimelineContextProjection();
assert.equal(timelineContext.recentDecisions.length, 3);
assert.equal(timelineContext.recentKnowledge.length, 3);
assert.equal(timelineContext.hebySuggestions.length, 3);

console.log("enterprise Runtime composition checks passed");
