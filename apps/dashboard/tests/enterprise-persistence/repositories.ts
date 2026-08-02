import assert from "node:assert/strict";
import { createInMemoryEnterpriseRepositories } from "../../src/features/enterprise-persistence";

async function main(): Promise<void> {
const repositories = createInMemoryEnterpriseRepositories();

assert.equal(Object.isFrozen(repositories), true);
assert.notEqual(repositories.organization, repositories.knowledge);
assert.equal((await repositories.organization.loadOrganization()).status, "Success");
assert.equal((await repositories.knowledge.loadKnowledge()).status, "Success");
assert.equal((await repositories.timeline.loadTimeline()).status, "Success");
assert.equal((await repositories.timeline.loadRecentContext()).status, "Success");
assert.equal((await repositories.decision.loadDecisions()).status, "Success");
assert.equal((await repositories.enterpriseIntelligence.loadEnterpriseIntelligence()).status, "Success");
assert.equal((await repositories.enterpriseIntelligence.loadDirectorWorkspace()).status, "Success");
assert.equal((await repositories.hebyContext.loadHebyContext()).status, "Success");

assert.deepEqual(
  repositories.organization.loadOrganization(),
  repositories.organization.loadOrganization(),
);
assert.deepEqual(
  repositories.timeline.loadRecentContext(),
  repositories.timeline.loadRecentContext(),
);

console.log("in-memory enterprise repository checks passed");
}

void main();
