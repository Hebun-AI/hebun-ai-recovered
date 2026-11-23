import { approvals } from "@/features/approvals/mock";
import { getSnapshot as getAgentSnapshot } from "@/features/agent-crud/agent-adapter";
import { getNodeSnapshot } from "@/features/knowledge-crud/node-adapter";
import { getSnapshot as getWorkflowSnapshot } from "@/features/workflow-crud/workflow-adapter";
import { employees, reviews, hrTickets, interviews, accessRequests, offboardings } from "@/features/hr/mock";
import type { AgentCrudRecord } from "@/features/agent-crud/types";
import { createProjectionBuilder } from "../projection-builder";
import type {
  AgentRuntimeModel,
  CompanyRuntimeModel,
  DepartmentRuntimeModel,
  HierarchyNodeRuntimeModel,
  HumanRuntimeModel,
  MembershipRuntimeModel,
  OrganizationRuntimeModel,
  OrganizationRuntimeSnapshot,
  RoleRuntimeModel,
  RuntimeEntityKind,
  RuntimeHealth,
  RuntimeHealthStatus,
  RuntimeIdentity,
  RuntimeLifecycle,
  RuntimeRef,
  RuntimeRelationships,
  RuntimeResponsibilities,
  RuntimeWorkItem,
} from "@/features/organization-runtime/types";

const COMPANY_ID = "company-hebun-ai";
const ORGANIZATION_ID = "organization-operating-company";
const DIRECTOR_ID = "human-director";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function makeIdentity(
  kind: RuntimeEntityKind,
  name: string,
  source: "memory" | "derived",
  id?: string,
): RuntimeIdentity {
  return {
    id: id ?? `${kind}-${slugify(name)}`,
    slug: slugify(name),
    name,
    kind,
    source,
  };
}

function makeRef(identity: RuntimeIdentity): RuntimeRef {
  return {
    kind: identity.kind,
    id: identity.id,
    label: identity.name,
  };
}

function lifecycle(status: RuntimeLifecycle["status"], updatedAt?: string): RuntimeLifecycle {
  return {
    status,
    updatedAt,
  };
}

function healthStatus(score: number): RuntimeHealthStatus {
  if (score >= 90) return "healthy";
  if (score >= 75) return "watch";
  return "critical";
}

function buildHealth(score: number, summary: string): RuntimeHealth {
  return {
    score,
    status: healthStatus(score),
    summary,
  };
}

function emptyResponsibilities(): RuntimeResponsibilities {
  return {
    assignedWork: [],
    responsibleWorkflows: [],
    responsibleGoals: [],
    responsibleMissions: [],
  };
}

function emptyRelationships(parent?: RuntimeRef): RuntimeRelationships {
  return {
    parent,
    children: [],
    memberships: [],
    ownership: {},
  };
}

type HumanSeed = {
  name: string;
  title: string;
  department?: string;
  sourceRecords: string[];
  onboardingProgress?: number;
};

function isAgentName(name: string, agentNames: Set<string>): boolean {
  return agentNames.has(name);
}

function inferDepartmentFromTitle(title: string): string | undefined {
  const lower = title.toLowerCase();
  if (lower.includes("design")) return "Design";
  if (lower.includes("eng")) return "Engineering";
  if (lower.includes("director")) return undefined;
  return undefined;
}

function rankRole(title: string): number {
  const lower = title.toLowerCase();
  if (lower.includes("director")) return 100;
  if (lower.includes("head")) return 90;
  if (lower.includes("manager")) return 85;
  if (lower.includes("lead")) return 80;
  if (lower.includes("agent")) return 70;
  if (lower.includes("engineer")) return 55;
  if (lower.includes("analyst")) return 52;
  if (lower.includes("specialist")) return 48;
  return 50;
}

function uniqueById<T extends { identity: { id: string } }>(records: T[]): T[] {
  const seen = new Set<string>();
  return records.filter((record) => {
    if (seen.has(record.identity.id)) return false;
    seen.add(record.identity.id);
    return true;
  });
}

function buildHumanSeeds(agents: AgentCrudRecord[]): HumanSeed[] {
  const agentNames = new Set(agents.map((agent) => agent.name));
  const byName = new Map<string, HumanSeed>();

  const upsert = (seed: HumanSeed) => {
    const existing = byName.get(seed.name);
    if (existing) {
      existing.sourceRecords = [...new Set([...existing.sourceRecords, ...seed.sourceRecords])];
      existing.department = existing.department ?? seed.department;
      existing.onboardingProgress = existing.onboardingProgress ?? seed.onboardingProgress;
      return;
    }
    byName.set(seed.name, seed);
  };

  upsert({
    name: "Director",
    title: "Director",
    sourceRecords: ["approvals", "goals", "memory"],
  });

  for (const employee of employees) {
    upsert({
      name: employee.name,
      title: employee.role,
      department: employee.department,
      sourceRecords: ["employees"],
      onboardingProgress: employee.onboardingProgress,
    });
  }

  for (const interview of interviews) {
    if (!isAgentName(interview.interviewer, agentNames)) {
      upsert({
        name: interview.interviewer,
        title: interview.interviewer,
        department: inferDepartmentFromTitle(interview.interviewer),
        sourceRecords: ["interviews"],
      });
    }
  }

  for (const review of reviews) {
    if (!isAgentName(review.reviewer, agentNames)) {
      upsert({
        name: review.reviewer,
        title: review.reviewer,
        department: inferDepartmentFromTitle(review.reviewer),
        sourceRecords: ["reviews"],
      });
    }
  }

  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function buildGoalItems(): RuntimeWorkItem[] {
  return getNodeSnapshot()
    .filter((node) => node.nodeType === "Goal" && node.lifecycleStatus === "active")
    .map((goal) => ({
      type: "goal",
      id: goal.id,
      label: goal.title,
      status: goal.status,
      detail: goal.description,
    }));
}

function buildMissionItems(): RuntimeWorkItem[] {
  return getNodeSnapshot()
    .filter(
      (node) =>
        node.lifecycleStatus === "active" &&
        node.nodeType === "Organization" &&
        node.tags.includes("goals"),
    )
    .slice(0, 3)
    .map((mission) => ({
      type: "mission",
      id: mission.id,
      label: mission.title,
      status: mission.status,
      detail: mission.description,
    }));
}

function buildOrganizationRuntimeProjection(): OrganizationRuntimeSnapshot {
  const agents = getAgentSnapshot().filter((record) => record.lifecycleStatus === "active");
  const workflows = getWorkflowSnapshot().filter((record) => record.lifecycleStatus === "active");

  const companyIdentity = makeIdentity("company", "Hebun AI", "derived", COMPANY_ID);
  const organizationIdentity = makeIdentity(
    "organization",
    "Operating Organization",
    "derived",
    ORGANIZATION_ID,
  );
  const companyRef = makeRef(companyIdentity);
  const organizationRef = makeRef(organizationIdentity);

  const goalItems = buildGoalItems();
  const missionItems = buildMissionItems();

  // P5-1: no compiled-in department fixtures; departments come only from the records below.
  const departmentSeedMap = new Map<string, { id: string; headAgent: string }>();
  const departmentNames = new Set<string>([
    ...agents.map((agent) => agent.department),
    ...employees.map((employee) => employee.department),
    ...workflows.map((workflow) => workflow.department),
  ]);

  const humanSeeds = buildHumanSeeds(agents);
  const humans: HumanRuntimeModel[] = humanSeeds.map((seed) => {
    const identity = makeIdentity("human", seed.name, "derived");
    const deptName = seed.department;
    const departmentRef = deptName
      ? makeRef(makeIdentity("department", deptName, "derived", `department-${slugify(deptName)}`))
      : undefined;
    const assignedWork: RuntimeWorkItem[] = [
      ...reviews
        .filter((review) => review.employee === seed.name || review.reviewer === seed.name)
        .map((review) => ({
          type: "review" as const,
          id: review.id,
          label: `${review.employee} performance review`,
          status: review.status,
          detail: review.cycle,
        })),
      ...hrTickets
        .filter((ticket) => ticket.employee === seed.name)
        .map((ticket) => ({
          type: "ticket" as const,
          id: ticket.id,
          label: ticket.topic,
          status: ticket.status,
          detail: ticket.updated,
        })),
      ...accessRequests
        .filter((request) => request.employee === seed.name)
        .map((request) => ({
          type: "approval" as const,
          id: request.id,
          label: `Access request for ${request.system}`,
          status: request.status,
        })),
      ...offboardings
        .filter((offboarding) => offboarding.employee === seed.name)
        .map((offboarding) => ({
          type: "approval" as const,
          id: offboarding.id,
          label: `Offboarding ${offboarding.step}`,
          status: String(offboarding.progress),
          detail: offboarding.lastDay,
        })),
    ];

    const healthScore =
      typeof seed.onboardingProgress === "number"
        ? Math.max(55, Math.min(100, seed.onboardingProgress))
        : seed.name === "Director"
          ? 96
          : 80;

    const relationships = emptyRelationships(departmentRef ?? organizationRef);
    relationships.reportsTo =
      seed.name === "Director"
        ? undefined
        : seed.department
          ? makeRef(
              makeIdentity(
                "agent",
                departmentSeedMap.get(seed.department)?.headAgent ?? "Director",
                "derived",
                `agent-${slugify(departmentSeedMap.get(seed.department)?.headAgent ?? "director")}`,
              ),
            )
          : makeRef(makeIdentity("human", "Director", "derived", DIRECTOR_ID));

    return {
      identity: {
        ...identity,
        id: seed.name === "Director" ? DIRECTOR_ID : identity.id,
      },
      lifecycle: lifecycle("active"),
      health: buildHealth(healthScore, `${seed.title} runtime profile`),
      relationships,
      responsibilities: {
        ...emptyResponsibilities(),
        assignedWork,
      },
      department: departmentRef,
      role: makeRef(makeIdentity("role", seed.title, "derived", `role-${slugify(seed.title)}`)),
      company: companyRef,
      organization: organizationRef,
      status:
        healthScore >= 90 ? "active" : healthScore >= 75 ? "watch" : "unknown",
      profile: {
        title: seed.title,
        sourceRecords: seed.sourceRecords,
      },
    };
  });

  const humanByName = new Map(humans.map((human) => [human.identity.name, human]));
  const directorRef = makeRef(humanByName.get("Director")?.identity ?? makeIdentity("human", "Director", "derived", DIRECTOR_ID));

  const departmentModels: DepartmentRuntimeModel[] = [...departmentNames]
    .sort((a, b) => a.localeCompare(b))
    .map((departmentName) => {
      const seed = departmentSeedMap.get(departmentName);
      const identity = makeIdentity(
        "department",
        departmentName,
        seed ? "memory" : "derived",
        seed?.id ?? `department-${slugify(departmentName)}`,
      );
      const departmentAgents = agents.filter((agent) => agent.department === departmentName);
      const departmentHumans = humans.filter(
        (human) => human.department?.label === departmentName,
      );
      const departmentWorkflows = workflows.filter(
        (workflow) => workflow.department === departmentName,
      );
      const errorAgents = departmentAgents.filter((agent) => agent.status === "error").length;
      const pausedAgents = departmentAgents.filter((agent) => agent.status === "paused").length;
      const failedWorkflows = departmentWorkflows.filter(
        (workflow) => workflow.status === "failed",
      ).length;
      const score = Math.max(
        30,
        Math.min(
          100,
          84 +
            departmentAgents.filter((agent) => agent.status === "running").length * 2 -
            errorAgents * 14 -
            pausedAgents * 6 -
            failedWorkflows * 9,
        ),
      );
      const ownerAgentName =
        seed?.headAgent ??
        departmentAgents.find((agent) => agent.role.toLowerCase().includes("manager"))?.name ??
        departmentAgents[0]?.name;
      const ownerRef = ownerAgentName
        ? makeRef(
            makeIdentity("agent", ownerAgentName, "derived", `agent-${slugify(ownerAgentName)}`),
          )
        : directorRef;

      const relationships = emptyRelationships(organizationRef);
      relationships.ownership = { owner: ownerRef, manager: ownerRef };
      relationships.reportsTo = directorRef;

      return {
        identity,
        lifecycle: lifecycle("active"),
        health: buildHealth(
          score,
          `${departmentAgents.length} agents · ${departmentWorkflows.length} workflows`,
        ),
        relationships,
        responsibilities: {
          assignedWork: departmentWorkflows.map((workflow) => ({
            type: "workflow" as const,
            id: workflow.id,
            label: workflow.name,
            status: workflow.status,
            detail: workflow.trigger,
          })),
          responsibleWorkflows: departmentWorkflows.map((workflow) => ({
            type: "workflow" as const,
            id: workflow.id,
            label: workflow.name,
            status: workflow.status,
            detail: workflow.trigger,
          })),
          responsibleGoals:
            departmentName === "Legal"
              ? goalItems.filter((goal) => goal.label.toLowerCase().includes("soc2"))
              : departmentName === "Finance"
                ? goalItems.filter((goal) => goal.label.toLowerCase().includes("cost"))
                : departmentName === "Sales"
                  ? goalItems.filter(
                      (goal) =>
                        goal.label.toLowerCase().includes("churn") ||
                        goal.label.toLowerCase().includes("enterprise"),
                    )
                  : [],
          responsibleMissions: [],
        },
        company: companyRef,
        organization: organizationRef,
        teams: [],
        humans: departmentHumans.map((human) => makeRef(human.identity)),
        agents: departmentAgents.map((agent) =>
          makeRef(makeIdentity("agent", agent.name, "memory", agent.id)),
        ),
        reportingLine: [directorRef, ownerRef],
      };
    });

  const departmentByName = new Map(
    departmentModels.map((department) => [department.identity.name, department]),
  );

  const agentModels: AgentRuntimeModel[] = agents.map((agent) => {
    const identity = makeIdentity("agent", agent.name, "memory", agent.id);
    const department = departmentByName.get(agent.department);
    const departmentRef = department ? makeRef(department.identity) : undefined;
    const ownerRef =
      department?.relationships.ownership.owner ??
      directorRef;
    const relationships = emptyRelationships(departmentRef ?? organizationRef);
    relationships.ownership = {
      owner: ownerRef,
      manager: ownerRef,
    };
    relationships.reportsTo = ownerRef;
    const relatedWorkflows = workflows.filter(
      (workflow) => workflow.ownerAgent === agent.name || workflow.assignedAgents.includes(agent.name),
    );
    const agentGoalCandidates =
      agent.department === "Legal"
        ? goalItems.filter((goal) => goal.label.toLowerCase().includes("soc2"))
        : agent.department === "Finance"
          ? goalItems.filter((goal) => goal.label.toLowerCase().includes("cost"))
          : agent.department === "Sales"
            ? goalItems.filter(
                (goal) =>
                  goal.label.toLowerCase().includes("churn") ||
                  goal.label.toLowerCase().includes("enterprise"),
              )
            : [];

    return {
      identity,
      lifecycle: lifecycle(agent.lifecycleStatus, agent.updatedAt),
      health: buildHealth(
        agent.status === "error"
          ? 58
          : agent.status === "paused"
            ? 74
            : agent.status === "idle"
              ? 84
              : 94,
        `${agent.tasksToday} tasks today · ${agent.lastActive}`,
      ),
      relationships,
      responsibilities: {
        assignedWork: relatedWorkflows.map((workflow) => ({
          type: "workflow" as const,
          id: workflow.id,
          label: workflow.name,
          status: workflow.status,
          detail: workflow.trigger,
        })),
        responsibleWorkflows: relatedWorkflows.map((workflow) => ({
          type: "workflow" as const,
          id: workflow.id,
          label: workflow.name,
          status: workflow.status,
          detail: workflow.trigger,
        })),
        responsibleGoals: agentGoalCandidates,
        responsibleMissions: [],
      },
      department: departmentRef,
      role: makeRef(makeIdentity("role", agent.role, "derived", `role-${slugify(agent.role)}`)),
      company: companyRef,
      organization: organizationRef,
      runtime: agent.runtime,
      provider: agent.provider,
      model: agent.model,
      status: agent.status,
    };
  });

  const roleMap = new Map<string, RoleRuntimeModel>();
  const upsertRole = (name: string, roleType: RoleRuntimeModel["roleType"], member: RuntimeRef) => {
    const id = `role-${slugify(name)}`;
    const existing = roleMap.get(id);
    if (existing) {
      if (!existing.members.some((item) => item.id === member.id)) {
        existing.members.push(member);
      }
      return;
    }
    roleMap.set(id, {
      identity: makeIdentity("role", name, "derived", id),
      lifecycle: lifecycle("derived"),
      health: buildHealth(92, `${name} runtime role`),
      relationships: emptyRelationships(companyRef),
      responsibilities: emptyResponsibilities(),
      roleType,
      authorityRank: rankRole(name),
      members: [member],
    });
  };

  for (const human of humans) {
    if (human.role) upsertRole(human.role.label, "human", makeRef(human.identity));
  }
  for (const agent of agentModels) {
    if (agent.role) upsertRole(agent.role.label, "agent", makeRef(agent.identity));
  }
  const roles = [...roleMap.values()].sort((a, b) => b.authorityRank - a.authorityRank);
  const roleById = new Map(roles.map((role) => [role.identity.id, role]));

  const humanMemberships = humans.map((human): MembershipRuntimeModel => {
    const department = human.department;
    const role = human.role ? roleById.get(human.role.id) : undefined;
    const relationships = emptyRelationships(department ?? organizationRef);
    relationships.ownership = {
      owner: human.relationships.ownership.owner,
      manager: human.relationships.reportsTo,
    };

    return {
      identity: makeIdentity(
        "membership",
        `${human.identity.name} membership`,
        "derived",
        `membership-${human.identity.id}`,
      ),
      lifecycle: lifecycle("active"),
      health: buildHealth(93, `${human.identity.name} organizational membership`),
      relationships,
      responsibilities: emptyResponsibilities(),
      actor: makeRef(human.identity),
      role: role ? makeRef(role.identity) : human.role,
      company: companyRef,
      organization: organizationRef,
      department,
      scope: department ? "department" : "company",
    };
  });

  const agentMemberships = agentModels.map((agent): MembershipRuntimeModel => {
    const relationships = emptyRelationships(agent.department ?? organizationRef);
    relationships.ownership = {
      owner: agent.relationships.ownership.owner,
      manager: agent.relationships.reportsTo,
    };

    return {
      identity: makeIdentity(
        "membership",
        `${agent.identity.name} membership`,
        "derived",
        `membership-${agent.identity.id}`,
      ),
      lifecycle: lifecycle("active"),
      health: buildHealth(95, `${agent.identity.name} runtime membership`),
      relationships,
      responsibilities: emptyResponsibilities(),
      actor: makeRef(agent.identity),
      role: agent.role,
      company: companyRef,
      organization: organizationRef,
      department: agent.department,
      scope: agent.department ? "department" : "organization",
    };
  });

  const memberships: MembershipRuntimeModel[] = [
    ...humanMemberships,
    ...agentMemberships,
  ];

  const membershipRefsByActorId = new Map<string, RuntimeRef[]>();
  for (const membership of memberships) {
    const list = membershipRefsByActorId.get(membership.actor.id) ?? [];
    list.push(makeRef(membership.identity));
    membershipRefsByActorId.set(membership.actor.id, list);
  }

  for (const human of humans) {
    human.relationships.memberships = membershipRefsByActorId.get(human.identity.id) ?? [];
    human.relationships.ownership = {
      owner: human.department
        ? departmentByName.get(human.department.label)?.relationships.ownership.owner
        : directorRef,
      manager: human.relationships.reportsTo,
    };
  }

  for (const agent of agentModels) {
    agent.relationships.memberships = membershipRefsByActorId.get(agent.identity.id) ?? [];
  }

  const organization: OrganizationRuntimeModel = {
    identity: organizationIdentity,
    lifecycle: lifecycle("derived"),
    health: buildHealth(
      Math.round(
        departmentModels.reduce((sum, department) => sum + department.health.score, 0) /
          Math.max(1, departmentModels.length),
      ),
      "Primary runtime organization",
    ),
    relationships: {
      ...emptyRelationships(companyRef),
      children: departmentModels.map((department) => makeRef(department.identity)),
      ownership: {
        owner: directorRef,
        manager: directorRef,
      },
    },
    responsibilities: {
      assignedWork: [],
      responsibleWorkflows: workflows.slice(0, 8).map((workflow) => ({
        type: "workflow" as const,
        id: workflow.id,
        label: workflow.name,
        status: workflow.status,
        detail: workflow.trigger,
      })),
      responsibleGoals: goalItems,
      responsibleMissions: missionItems,
    },
    company: companyRef,
    departments: departmentModels.map((department) => makeRef(department.identity)),
    humans: humans.map((human) => makeRef(human.identity)),
    agents: agentModels.map((agent) => makeRef(agent.identity)),
    teams: [],
  };

  const company: CompanyRuntimeModel = {
    identity: companyIdentity,
    lifecycle: lifecycle("derived"),
    health: buildHealth(
      Math.round(
        (organization.health.score +
          Math.round(
            agentModels.reduce((sum, agent) => sum + agent.health.score, 0) /
              Math.max(1, agentModels.length),
          )) /
          2,
      ),
      "Company-wide runtime posture",
    ),
    relationships: {
      ...emptyRelationships(),
      children: [organizationRef],
      ownership: {
        owner: directorRef,
        manager: directorRef,
      },
    },
    responsibilities: {
      assignedWork: approvals.map((approval) => ({
        type: "approval" as const,
        id: approval.id,
        label: approval.title,
        status: approval.risk,
        detail: approval.summary,
      })),
      responsibleWorkflows: organization.responsibilities.responsibleWorkflows,
      responsibleGoals: goalItems,
      responsibleMissions: missionItems,
    },
    organizations: [organizationRef],
    departments: departmentModels.map((department) => makeRef(department.identity)),
    humans: humans.map((human) => makeRef(human.identity)),
    agents: agentModels.map((agent) => makeRef(agent.identity)),
    teams: [],
    metrics: {
      departments: departmentModels.length,
      humans: humans.length,
      agents: agentModels.length,
      activeWorkflows: workflows.length,
      activeGoals: goalItems.length,
    },
  };

  const hierarchyNodes: HierarchyNodeRuntimeModel[] = [
    {
      identity: company.identity,
      parent: undefined,
      children: [organizationRef],
      owner: company.relationships.ownership.owner,
      manager: company.relationships.ownership.manager,
      depth: 0,
      lineage: [],
    },
    {
      identity: organization.identity,
      parent: companyRef,
      children: organization.departments,
      owner: organization.relationships.ownership.owner,
      manager: organization.relationships.ownership.manager,
      depth: 1,
      lineage: [companyRef],
    },
    ...departmentModels.map((department) => ({
      identity: department.identity,
      parent: organizationRef,
      children: [
        ...department.humans,
        ...department.agents,
      ],
      reportsTo: department.relationships.reportsTo,
      owner: department.relationships.ownership.owner,
      manager: department.relationships.ownership.manager,
      depth: 2,
      lineage: [companyRef, organizationRef],
    })),
    ...humans.map((human) => ({
      identity: human.identity,
      parent: human.department ?? organizationRef,
      children: [],
      reportsTo: human.relationships.reportsTo,
      owner: human.relationships.ownership.owner,
      manager: human.relationships.ownership.manager,
      depth: human.department ? 3 : 2,
      lineage: human.department
        ? [companyRef, organizationRef, human.department]
        : [companyRef, organizationRef],
    })),
    ...agentModels.map((agent) => ({
      identity: agent.identity,
      parent: agent.department ?? organizationRef,
      children: [],
      reportsTo: agent.relationships.reportsTo,
      owner: agent.relationships.ownership.owner,
      manager: agent.relationships.ownership.manager,
      depth: agent.department ? 3 : 2,
      lineage: agent.department
        ? [companyRef, organizationRef, agent.department]
        : [companyRef, organizationRef],
    })),
  ];

  return {
    company,
    organizations: [organization],
    departments: uniqueById(departmentModels),
    humans: uniqueById(humans),
    agents: uniqueById(agentModels),
    memberships: uniqueById(memberships),
    roles,
    hierarchy: hierarchyNodes,
  };
}

export const OrganizationProjectionBuilder = createProjectionBuilder({
  collection: "organization-runtime",
  owner: "Organization Runtime",
  dependencies: [],
  build: () => buildOrganizationRuntimeProjection(),
  count: (snapshot) =>
    snapshot.organizations.length +
    snapshot.departments.length +
    snapshot.humans.length +
    snapshot.agents.length +
    snapshot.memberships.length +
    snapshot.roles.length,
});
