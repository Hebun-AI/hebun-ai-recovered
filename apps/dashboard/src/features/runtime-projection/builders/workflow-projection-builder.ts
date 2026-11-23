import type { AgentEmployeeRuntimeModel } from "@/features/agent-runtime/types";
import type { HumanRuntimeModel, OrganizationRuntimeSnapshot } from "@/features/organization-runtime/types";
import { getNodeSnapshot } from "@/features/knowledge-crud/node-adapter";
import { getSnapshot as getMemorySnapshot } from "@/features/memory-crud/memory-adapter";
import type { GoalRuntimeModel } from "@/features/goal-runtime/types";
import type { MissionRuntimeModel } from "@/features/mission-runtime/types";
import { getSnapshot as getWorkflowSnapshot } from "@/features/workflow-crud/workflow-adapter";
import type { WorkflowCrudRecord } from "@/features/workflow-crud/types";
import { WorkflowContextService } from "@/features/workflow-runtime/workflow-context-service";
import { WorkflowDependencyService } from "@/features/workflow-runtime/workflow-dependency-service";
import { WorkflowHealthService } from "@/features/workflow-runtime/workflow-health-service";
import { WorkflowHierarchyService } from "@/features/workflow-runtime/workflow-hierarchy-service";
import { WorkflowProgressService } from "@/features/workflow-runtime/workflow-progress-service";
import { WorkflowResponsibilityService } from "@/features/workflow-runtime/workflow-responsibility-service";
import type {
  WorkflowReadinessProfile,
  WorkflowRuntimeModel,
  WorkflowRuntimeRef,
  WorkflowRuntimeWorkItem,
  WorkflowStatusSummary,
} from "@/features/workflow-runtime/types";
import { createProjectionBuilder } from "../projection-builder";

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function toDepartmentRef(
  workflow: WorkflowCrudRecord,
  organization: OrganizationRuntimeSnapshot,
): WorkflowRuntimeRef | undefined {
  const department = organization.departments.find(
    (candidate) => candidate.identity.name === workflow.department,
  );

  return department
    ? {
        kind: "department",
        id: department.identity.id,
        label: department.identity.name,
      }
    : undefined;
}

function buildAssignedAgents(workflow: WorkflowCrudRecord, agents: AgentEmployeeRuntimeModel[]): AgentEmployeeRuntimeModel[] {
  return agents.filter(
    (agent) =>
      workflow.assignedAgents.includes(agent.identity.name) ||
      agent.identity.name === workflow.ownerAgent,
  );
}

function buildResponsibleHumans(
  workflow: WorkflowCrudRecord,
  departmentId: string | undefined,
  humans: HumanRuntimeModel[],
): WorkflowRuntimeRef[] {
  return humans
    .filter((human) => (departmentId ? human.department?.id === departmentId : true))
    .slice(0, 3)
    .map((human) => ({
      kind: "human",
      id: human.identity.id,
      label: human.identity.name,
    }));
}

function buildCurrentTasks(workflow: WorkflowCrudRecord): WorkflowRuntimeWorkItem[] {
  return workflow.steps.map((step, index) => ({
    type: "task",
    id: `${workflow.id}-task-${index + 1}`,
    label: step,
    status: workflow.status === "failed" && index === workflow.steps.length - 1 ? "blocked" : workflow.status,
    detail: `Step ${index + 1} of ${workflow.steps.length}`,
  }));
}

function buildReadiness(workflow: WorkflowCrudRecord, assignedAgents: AgentEmployeeRuntimeModel[]): WorkflowReadinessProfile {
  if (assignedAgents.length === 0) {
    return {
      status: "unavailable",
      score: 0,
      blockers: 1,
      summary: "No assigned agent runtime is available for this workflow.",
    };
  }

  const totalScore = assignedAgents.reduce((sum, agent) => sum + agent.executionReadiness.score, 0);
  const blockers = assignedAgents.reduce((sum, agent) => sum + agent.executionReadiness.blockers, 0);
  const needsHumanReview = workflow.approvalPolicy !== "not-required";
  const score = Math.max(0, Math.min(100, Math.round(totalScore / assignedAgents.length - (needsHumanReview ? 8 : 0))));
  const status =
    workflow.status === "failed" || blockers >= 3
      ? "blocked"
      : score >= 80
        ? "ready"
        : score >= 60
          ? "watch"
          : "blocked";

  return {
    status,
    score,
    blockers: blockers + (needsHumanReview ? 1 : 0),
    summary: needsHumanReview
      ? `${assignedAgents.length} agents linked · approval review required`
      : `${assignedAgents.length} agents linked · ${blockers} blockers`,
  };
}

function buildPriority(workflow: WorkflowCrudRecord, mission?: WorkflowRuntimeWorkItem, goal?: WorkflowRuntimeWorkItem): WorkflowRuntimeModel["priority"] {
  if (workflow.status === "failed") return "critical";
  if (goal?.status === "review" || mission?.status === "review") return "high";
  if (workflow.status === "running") return "high";
  if (workflow.status === "scheduled") return "medium";
  return "low";
}

function buildBlockingIssues(
  workflow: WorkflowCrudRecord,
  assignedAgents: AgentEmployeeRuntimeModel[],
  readiness: WorkflowReadinessProfile,
): string[] {
  const issues: string[] = [];
  if (workflow.status === "failed") {
    issues.push("Workflow is currently failed and needs operational review.");
  }
  if (workflow.approvalPolicy !== "not-required") {
    issues.push(`Approval policy ${workflow.approvalPolicy} is gating full readiness.`);
  }
  if (readiness.blockers > 0) {
    issues.push(`${readiness.blockers} readiness blockers are attached to assigned workflow agents.`);
  }
  for (const agent of assignedAgents) {
    if (agent.status === "error" || agent.executionReadiness.status === "not-ready") {
      issues.push(`${agent.identity.name} is reducing dispatch confidence for this workflow.`);
    }
  }
  return [...new Set(issues)].slice(0, 4);
}

function buildStatusSummary(
  workflow: WorkflowCrudRecord,
  progressSummary: string,
  readiness: WorkflowReadinessProfile,
): WorkflowStatusSummary {
  return {
    headline: `${workflow.status} · ${workflow.successRate}% success`,
    detail: `${progressSummary} · ${readiness.summary}`,
  };
}

function projectWorkflow(
  workflow: WorkflowCrudRecord,
  allWorkflows: WorkflowCrudRecord[],
  agents: AgentEmployeeRuntimeModel[],
  humans: HumanRuntimeModel[],
  organizationProjection: OrganizationRuntimeSnapshot,
  missions: readonly MissionRuntimeModel[],
  goals: readonly GoalRuntimeModel[],
): WorkflowRuntimeModel {
  const company = organizationProjection.company;
  const organization = organizationProjection.organizations[0];
  const mission = WorkflowResponsibilityService.buildMission(workflow, missions);
  const goal = WorkflowResponsibilityService.buildGoal(workflow, goals);
  const plan = WorkflowResponsibilityService.buildPlan(
    workflow,
    undefined,
    goals,
  );
  const department = toDepartmentRef(workflow, organizationProjection);
  const assignedAgentModels = buildAssignedAgents(workflow, agents);
  const readiness = buildReadiness(workflow, assignedAgentModels);
  const blockingIssues = buildBlockingIssues(workflow, assignedAgentModels, readiness);
  const { health, risk } = WorkflowHealthService.buildHealth(
    workflow,
    readiness,
    assignedAgentModels,
    blockingIssues,
  );
  const progress = WorkflowProgressService.buildProgress(workflow);
  const parentWorkflow = WorkflowHierarchyService.buildParentWorkflow(workflow, allWorkflows, plan?.id);
  const childWorkflows = WorkflowHierarchyService.buildChildWorkflows(workflow, allWorkflows, plan?.id);
  const assignedAgents = assignedAgentModels.map((agent) => ({
    kind: "agent" as const,
    id: agent.identity.id,
    label: agent.identity.name,
  }));
  const responsibleHumans = buildResponsibleHumans(workflow, department?.id, humans);
  const currentTasks = buildCurrentTasks(workflow);
  const dependencies = WorkflowDependencyService.buildDependencies(workflow);
  const nodes = getNodeSnapshot();
  const memories = getMemorySnapshot();
  const learningReferences = WorkflowContextService.buildLearningReferences(workflow, nodes);
  const knowledgeReferences = WorkflowContextService.buildKnowledgeReferences(workflow, nodes);
  const memoryReferences = WorkflowContextService.buildMemoryReferences(workflow, memories);

  return {
    identity: {
      id: workflow.id,
      slug: workflow.slug,
      name: workflow.name,
      kind: "workflow",
      source: "memory",
    },
    mission,
    goal,
    plan,
    parentWorkflow,
    childWorkflows,
    assignedAgents,
    responsibleHumans,
    currentTasks,
    dependencies,
    executionStatus: workflow.status,
    lifecycle: {
      status: workflow.lifecycleStatus === "active" ? "active" : "archived",
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt,
    },
    health,
    progress,
    priority: buildPriority(workflow, mission, goal),
    risk,
    timeline: {
      trigger: workflow.trigger,
      lastRun: workflow.lastRun,
    },
    blockingIssues,
    readiness,
    learningReferences,
    knowledgeReferences,
    memoryReferences,
    statusSummary: buildStatusSummary(workflow, progress.summary, readiness),
    company: {
      kind: "company",
      id: company.identity.id,
      label: company.identity.name,
    },
    organization: organization
      ? {
          kind: "organization",
          id: organization.identity.id,
          label: organization.identity.name,
        }
      : {
          kind: "organization",
          id: slugify(company.identity.id),
          label: company.identity.name,
        },
    department,
    relationships: {
      parent: parentWorkflow ?? department,
      children: childWorkflows,
      supportedMission: mission
        ? { kind: "mission", id: mission.id, label: mission.label }
        : undefined,
      supportedGoal: goal
        ? { kind: "goal", id: goal.id, label: goal.label }
        : undefined,
      supportedPlan: plan
        ? { kind: "plan", id: plan.id, label: plan.label }
        : undefined,
    },
  };
}

function buildWorkflowProjection(
  organization: OrganizationRuntimeSnapshot,
  agents: AgentEmployeeRuntimeModel[],
  missions: readonly MissionRuntimeModel[],
  goals: readonly GoalRuntimeModel[],
): WorkflowRuntimeModel[] {
  const workflows = getWorkflowSnapshot().filter(
    (workflow) => workflow.lifecycleStatus === "active"
  );
  const humans = organization.humans;
  return workflows.map((workflow) =>
    projectWorkflow(
      workflow,
      workflows,
      agents,
      humans,
      organization,
      missions,
      goals,
    ),
  );
}

export const WorkflowProjectionBuilder = createProjectionBuilder({
  collection: "workflow-runtime",
  owner: "Workflow Runtime",
  dependencies: [
    "organization-runtime",
    "agent-runtime",
    "mission-runtime",
    "goal-runtime",
  ],
  build: (context) => {
    const organization =
      context.getSnapshot<OrganizationRuntimeSnapshot>("organization-runtime");
    const agents =
      context.getSnapshot<AgentEmployeeRuntimeModel[]>("agent-runtime");
    const missions =
      context.getSnapshot<MissionRuntimeModel[]>("mission-runtime");
    const goals = context.getSnapshot<GoalRuntimeModel[]>("goal-runtime");
    if (!organization || !agents || !missions || !goals) {
      throw new Error(
        "Workflow projection requires organization, agent, mission, and goal projections.",
      );
    }
    return buildWorkflowProjection(
      organization.data,
      agents.data,
      missions.data,
      goals.data,
    );
  },
  count: (snapshot) => snapshot.length,
});
