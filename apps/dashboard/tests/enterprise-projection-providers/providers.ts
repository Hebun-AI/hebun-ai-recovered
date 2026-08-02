import assert from "node:assert/strict";
import {
  getDecisionProjection,
  getDirectorWorkspaceProjection,
  getEnterpriseIntelligenceProjection,
  getHebyContextProjection,
  getKnowledgeProjection,
  getOrganizationProjection,
  getTimelineProjection,
} from "../../src/features/enterprise-projection-providers";
import { ENTERPRISE_PROJECTION_VERSION } from "../../src/features/enterprise-projections";

const projections = [
  getDirectorWorkspaceProjection(),
  getOrganizationProjection(),
  getKnowledgeProjection(),
  getTimelineProjection(),
  getDecisionProjection(),
  getEnterpriseIntelligenceProjection(),
  getHebyContextProjection(),
];

for (const projection of projections) {
  assert.equal(projection.version, ENTERPRISE_PROJECTION_VERSION);
  assert.equal(projection.source.kind, "Mock Adapter");
  assert.equal(projection.projectionId.length > 0, true);
}

assert.equal(getDecisionProjection().authority, "Director");
assert.equal(getDecisionProjection().executionAllowed, false);
assert.equal(getHebyContextProjection().disclosure.executionAllowed, false);

console.log("enterprise projection provider checks passed");
