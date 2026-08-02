import assert from "node:assert/strict";
import { Client } from "pg";
import { decisionProjection } from "../../src/features/decision-domain/mock";
import { directorWorkspaceProjection } from "../../src/features/director-workspace/mock";
import { enterpriseIntelligenceOverview, enterpriseIntelligenceProjection, hebyEnterpriseContext, unifiedEnterpriseHealth } from "../../src/features/enterprise-intelligence/mock";
import { composeEnterpriseRuntime } from "../../src/features/enterprise-runtime-composition";
import { knowledgeProjection } from "../../src/features/knowledge-domain/mock";
import { organizationProjection } from "../../src/features/organization-domain/mock";
import { hebyTimelineSuggestions, recentTimelineDecisions, recentTimelineKnowledge, timelineProjection } from "../../src/features/timeline-domain/mock";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";

async function main(): Promise<void> {
const harness = createDisposablePostgresHarness("hebun_enterprise_projection");
let runtime: ReturnType<typeof composeEnterpriseRuntime> | undefined;

try {
  await harness.createDatabase();
  harness.migrateDatabase();

  const client = new Client({ connectionString: harness.dbUrl });
  await client.connect();
  try {
    const seeds = [
      ["organization", organizationProjection],
      ["knowledge", knowledgeProjection],
      ["timeline", timelineProjection],
      ["timeline-context", { recentDecisions: recentTimelineDecisions, recentKnowledge: recentTimelineKnowledge, hebySuggestions: hebyTimelineSuggestions }],
      ["decision", decisionProjection],
      ["enterprise-intelligence", { ...enterpriseIntelligenceProjection, domainHealth: enterpriseIntelligenceOverview, unifiedHealth: unifiedEnterpriseHealth }],
      ["director-workspace", directorWorkspaceProjection],
      ["heby-context", hebyEnterpriseContext],
    ] as const;

    for (const [key, payload] of seeds) {
      await client.query(
        `insert into enterprise_projection_snapshots (projection_key, payload, concurrency_token)
         values ($1, $2, $3)`,
        [key, JSON.stringify(payload), `${key}-v1`],
      );
    }
  } finally {
    await client.end();
  }

  runtime = composeEnterpriseRuntime({ repositoryMode: "postgresql", postgresConnectionString: harness.dbUrl });
  const repositories = runtime.repositories;
  assert.equal(Object.isFrozen(runtime), true);
  assert.equal(Object.isFrozen(repositories), true);
  assert.equal((await repositories.organization.loadOrganization()).status, "Success");
  assert.equal((await repositories.knowledge.loadKnowledge()).status, "Success");
  assert.equal((await repositories.timeline.loadTimeline()).status, "Success");
  assert.equal((await repositories.timeline.loadRecentContext()).status, "Success");
  assert.equal((await repositories.decision.loadDecisions()).status, "Success");
  assert.equal((await repositories.enterpriseIntelligence.loadEnterpriseIntelligence()).status, "Success");
  assert.equal((await repositories.enterpriseIntelligence.loadDirectorWorkspace()).status, "Success");
  assert.equal((await repositories.hebyContext.loadHebyContext()).status, "Success");
  assert.equal((await runtime.projectionProvider.getOrganizationProjection()).projectionId, organizationProjection.projectionId);
} finally {
  await runtime?.close();
  await harness.dropDatabase();
}

console.log("PostgreSQL enterprise repository integration checks passed");
}

void main();
