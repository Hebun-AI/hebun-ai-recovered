import assert from "node:assert/strict";
import { decisionProjection } from "../../src/features/decision-domain/mock";
import { directorWorkspaceProjection } from "../../src/features/director-workspace/mock";
import { enterpriseIntelligenceProjection, hebyEnterpriseContext } from "../../src/features/enterprise-intelligence/mock";
import { ENTERPRISE_PROJECTION_VERSION } from "../../src/features/enterprise-projections";
import { knowledgeProjection } from "../../src/features/knowledge-domain/mock";
import { organizationProjection } from "../../src/features/organization-domain/mock";
import { timelineProjection } from "../../src/features/timeline-domain/mock";

const projections = [
  organizationProjection,
  directorWorkspaceProjection,
  knowledgeProjection,
  timelineProjection,
  decisionProjection,
  enterpriseIntelligenceProjection,
  hebyEnterpriseContext,
];

for (const projection of projections) {
  assert.equal(projection.version, ENTERPRISE_PROJECTION_VERSION);
  assert.equal(projection.version, "1.0");
  assert.equal(projection.projectionId.length > 0, true);
  assert.equal(projection.generatedAt.length > 0, true);
  assert.equal(projection.source.kind, "Mock Adapter");
}

assert.equal(decisionProjection.authority, "Director");
assert.equal(decisionProjection.executionAllowed, false);
assert.deepEqual(hebyEnterpriseContext.disclosure, {
  simulated: true,
  authoritative: false,
  executionAllowed: false,
  authority: "Director",
});

console.log("enterprise projection contract conformance checks passed");
