import assert from "node:assert/strict";
import { createInMemoryEnterpriseRepositories } from "../../src/features/enterprise-persistence";

const repositories = createInMemoryEnterpriseRepositories();

assert.equal(Object.isFrozen(repositories), true);
assert.notEqual(repositories.organization, repositories.knowledge);
assert.equal(repositories.organization.loadOrganization().status, "Success");
assert.equal(repositories.knowledge.loadKnowledge().status, "Success");
assert.equal(repositories.timeline.loadTimeline().status, "Success");
assert.equal(repositories.timeline.loadRecentContext().status, "Success");
assert.equal(repositories.decision.loadDecisions().status, "Success");
assert.equal(repositories.enterpriseIntelligence.loadEnterpriseIntelligence().status, "Success");
assert.equal(repositories.enterpriseIntelligence.loadDirectorWorkspace().status, "Success");
assert.equal(repositories.hebyContext.loadHebyContext().status, "Success");

assert.deepEqual(
  repositories.organization.loadOrganization(),
  repositories.organization.loadOrganization(),
);
assert.deepEqual(
  repositories.timeline.loadRecentContext(),
  repositories.timeline.loadRecentContext(),
);

console.log("in-memory enterprise repository checks passed");
