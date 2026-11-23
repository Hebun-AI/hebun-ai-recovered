import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { DirectorAIRuntime } from "../../src/features/director-ai-runtime";
import type { TransformationDomainAssessment, TransformationGap, TransformationInitiative } from "../../src/features/enterprise-transformation-runtime";
import { EnterpriseTransformationEngine } from "../../src/features/enterprise-transformation-runtime";
import { OrganizationalIntelligenceEngine } from "../../src/features/organizational-intelligence";
import { loadCrudFixtures } from "../helpers/crud-fixtures";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function withoutGeneratedAt<T extends { generatedAt: string }>(value: T): Omit<T, "generatedAt"> {
  const next = { ...value };
  delete (next as { generatedAt?: string }).generatedAt;
  return next;
}

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitize);
  }
  if (value && typeof value === "object") {
    const next: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      if (key === "generatedAt" || key === "retrievalTimeMs") continue;
      next[key] = sanitize(nested);
    }
    return next;
  }
  return value;
}

function baseObservations() {
  return clone(OrganizationalIntelligenceEngine.getSnapshot().observations);
}

async function main(): Promise<void> {
  // P5-1 (D7): the CRUD stores no longer seed fixtures; this suite supplies its own roster.
  await loadCrudFixtures();
  const empty = baseObservations();
  empty.departments = [];
  empty.humans = [];
  empty.agents = [];
  empty.workflows = [];
  empty.governance.metrics.activePolicies = 0;
  empty.governance.policies = [];
  empty.learning.totalSignals = 0;
  empty.learning.relatedAgents = 0;
  empty.learning.relatedWorkflows = 0;
  empty.knowledge.totalReferences = 0;
  empty.knowledge.verifiedKnowledge = 0;
  empty.memory.totalReferences = 0;
  empty.memory.lowCoverageWorkflows = 0;
  empty.performanceSeed.knowledgeCoverage = 0;
  const emptySnapshot = EnterpriseTransformationEngine.buildSnapshot(empty);
  assert.equal(emptySnapshot.overallMaturity.level, 0, "empty organization should be unobserved");

  const structured = baseObservations();
  const structuredSnapshot = EnterpriseTransformationEngine.buildSnapshot(structured);
  const emptyOrganizationDomain = emptySnapshot.domainAssessments.find((assessment: TransformationDomainAssessment) => assessment.domain === "organization");
  const structuredOrganizationDomain = structuredSnapshot.domainAssessments.find((assessment: TransformationDomainAssessment) => assessment.domain === "organization");
  assert.ok(structuredOrganizationDomain);
  assert.ok(emptyOrganizationDomain);
  assert.ok(
    structuredOrganizationDomain!.maturity.level > emptyOrganizationDomain!.maturity.level,
    "structured organization should raise organization maturity",
  );

  const ownerlessAgents = baseObservations();
  ownerlessAgents.agents = ownerlessAgents.agents.map((agent) => ({ ...agent, owner: undefined }));
  const ownerlessSnapshot = EnterpriseTransformationEngine.buildSnapshot(ownerlessAgents);
  assert.ok(
    ownerlessSnapshot.gaps.some((gap: TransformationGap) => gap.summary.includes("no explicit owner")),
    "agents without owners should create a gap",
  );

  const unlinkedWorkflows = baseObservations();
  unlinkedWorkflows.workflows = unlinkedWorkflows.workflows.map((workflow) => ({
    ...workflow,
    goal: undefined,
    plan: undefined,
  }));
  const unlinkedSnapshot = EnterpriseTransformationEngine.buildSnapshot(unlinkedWorkflows);
  assert.ok(
    unlinkedSnapshot.gaps.some((gap: TransformationGap) => gap.summary.includes("missing Goal or Plan lineage")),
    "workflows without lineage should create a gap",
  );

  const healthyLinked = baseObservations();
  healthyLinked.workflows = healthyLinked.workflows.map((workflow) => ({
    ...workflow,
    goal: workflow.goal ?? { type: "goal", id: "goal-test", label: "Test Goal" },
    plan: workflow.plan ?? { type: "plan", id: "plan-test", label: "Test Plan" },
    assignedAgents:
      workflow.assignedAgents.length > 0
        ? workflow.assignedAgents
        : [{ kind: "agent", id: "agent-test", label: "Test Agent" }],
    responsibleHumans:
      workflow.responsibleHumans.length > 0
        ? workflow.responsibleHumans
        : [{ kind: "human", id: "human-test", label: "Test Human" }],
    health: { ...workflow.health, score: 95, status: "healthy" },
    executionStatus: "running",
    blockingIssues: [],
    knowledgeReferences: workflow.knowledgeReferences.length > 0 ? workflow.knowledgeReferences : [{ type: "knowledge", id: "k1", label: "Knowledge" }],
    memoryReferences: workflow.memoryReferences.length > 0 ? workflow.memoryReferences : [{ type: "memory", id: "m1", label: "Memory" }],
    readiness: { ...workflow.readiness, score: 92, status: "ready", blockers: 0 },
    progress: { ...workflow.progress, successRate: 96, runsToday: Math.max(1, workflow.progress.runsToday) },
  }));
  const healthySnapshot = EnterpriseTransformationEngine.buildSnapshot(healthyLinked);
  const healthyWorkflowDomain = healthySnapshot.domainAssessments.find((assessment: TransformationDomainAssessment) => assessment.domain === "workflows");
  const unlinkedWorkflowDomain = unlinkedSnapshot.domainAssessments.find((assessment: TransformationDomainAssessment) => assessment.domain === "workflows");
  assert.ok(healthyWorkflowDomain && unlinkedWorkflowDomain);
  assert.ok(
    healthyWorkflowDomain!.maturity.level >= unlinkedWorkflowDomain!.maturity.level,
    "healthy linked workflows should improve operational maturity",
  );

  const missingKnowledge = baseObservations();
  missingKnowledge.knowledge.totalReferences = 0;
  missingKnowledge.knowledge.verifiedKnowledge = 0;
  missingKnowledge.knowledge.lowCoverageWorkflows = missingKnowledge.workflows.length;
  missingKnowledge.workflows = missingKnowledge.workflows.map((workflow) => ({
    ...workflow,
    knowledgeReferences: [],
  }));
  const missingKnowledgeSnapshot = EnterpriseTransformationEngine.buildSnapshot(missingKnowledge);
  const missingKnowledgeDomain = missingKnowledgeSnapshot.domainAssessments.find((assessment: TransformationDomainAssessment) => assessment.domain === "knowledge");
  assert.ok(missingKnowledgeDomain);
  assert.ok(missingKnowledgeDomain!.readiness.score < structuredSnapshot.overallReadiness.score);

  const missingGovernance = baseObservations();
  missingGovernance.governance.metrics.activePolicies = 0;
  missingGovernance.governance.metrics.health = 40;
  missingGovernance.governance.metrics.complianceScore = 40;
  missingGovernance.governance.policies = [];
  const missingGovernanceSnapshot = EnterpriseTransformationEngine.buildSnapshot(missingGovernance);
  const governanceDomain = missingGovernanceSnapshot.domainAssessments.find((assessment: TransformationDomainAssessment) => assessment.domain === "governance");
  assert.ok(governanceDomain);
  assert.ok(governanceDomain!.readiness.score < 70, "missing governance should lower governance readiness");

  const aiNativeCandidate = baseObservations();
  aiNativeCandidate.learning.totalSignals = 0;
  aiNativeCandidate.learning.relatedAgents = 0;
  aiNativeCandidate.learning.relatedWorkflows = 0;
  const aiNativeSnapshot = EnterpriseTransformationEngine.buildSnapshot(aiNativeCandidate);
  assert.notEqual(aiNativeSnapshot.overallMaturity.level, 5, "missing learning evidence should prevent AI-native maturity");

  assert.ok(
    structuredSnapshot.initiatives.every((initiative: TransformationInitiative) => initiative.status === "proposed"),
    "initiatives must remain proposed only",
  );

  const deterministicA = EnterpriseTransformationEngine.buildSnapshot(baseObservations());
  const deterministicB = EnterpriseTransformationEngine.buildSnapshot(baseObservations());
  assert.deepEqual(
    sanitize(withoutGeneratedAt(deterministicA)),
    sanitize(withoutGeneratedAt(deterministicB)),
    "roadmap and snapshot should be deterministic",
  );

  const liveA = EnterpriseTransformationEngine.getSnapshot();
  const liveB = EnterpriseTransformationEngine.getSnapshot();
  assert.deepEqual(
    sanitize(withoutGeneratedAt(liveA)),
    sanitize(withoutGeneratedAt(liveB)),
    "repeated snapshots should be structurally stable",
  );

  const transformationInput = EnterpriseTransformationEngine.buildSnapshot(baseObservations());
  const beforeDirectorAI = clone(transformationInput);
  const directorAI = DirectorAIRuntime.getRuntimeSurface({
    transformationSnapshot: transformationInput,
  });
  assert.deepEqual(
    transformationInput,
    beforeDirectorAI,
    "Director AI should consume transformation results without mutation",
  );
  assert.equal(
    directorAI.context.transformation.summary,
    transformationInput.summary,
    "Director AI context should include transformation results",
  );

  const emptyStateFile = readFileSync(
    path.resolve(process.cwd(), "src/components/director-dashboard/ai-transformation-section.tsx"),
    "utf8",
  );
  assert.match(
    emptyStateFile,
    /Transformation evidence is still insufficient/,
    "dashboard empty state should stay honest",
  );

  console.log("enterprise-transformation-runtime foundation checks passed");
}

void main();
