import { agentAdapter } from "../../src/features/agent-crud/agent-adapter";
import type { AgentCrudRecord } from "../../src/features/agent-crud/types";
import { workflowAdapter } from "../../src/features/workflow-crud/workflow-adapter";
import type { WorkflowCrudRecord } from "../../src/features/workflow-crud/types";

/*
 * Test-owned CRUD fixtures (P5-1).
 *
 * The agent and workflow CRUD stores no longer seed compiled-in records. Suites that prove how
 * engines CLASSIFY or DERIVE from such records load these instead, with the shape the deleted seed
 * produced (createdBy "Seed", runtime "simulation"). Nothing in src imports this file.
 */
const AT = "2026-01-01T00:00:00.000Z";

export function fixtureAgent(name: string, department: string): AgentCrudRecord {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return {
    id: `agent-fixture-${slug}`,
    name,
    slug,
    description: `${name} for ${department}.`,
    department,
    category: "Fixture",
    owner: department,
    status: "idle",
    version: "v1.0.0",
    capabilities: ["Fixture", `${department} execution`],
    provider: "reference-simulation-provider",
    model: "gpt-5.4",
    tools: ["search"],
    permissions: ["agent.read"],
    runtime: "simulation",
    memory: `${department} working memory`,
    knowledge: `${department} playbooks and procedures`,
    createdAt: AT,
    updatedAt: AT,
    createdBy: "Seed",
    updatedBy: "Seed",
    lifecycleStatus: "active",
    role: "Fixture",
    tasksToday: 0,
    costToday: 0,
    lastActive: "never",
  };
}

export function fixtureWorkflow(name: string, department: string, ownerAgent: string): WorkflowCrudRecord {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return {
    id: `workflow-fixture-${slug}`,
    name,
    slug,
    description: `${name} workflow triggered by fixture.`,
    department,
    category: "Workflow Automation",
    owner: ownerAgent,
    status: "idle",
    version: "v1.0.0",
    trigger: "fixture",
    steps: ["Receive trigger: fixture", `Assign ${ownerAgent}`, "Record workflow outcome"],
    assignedAgents: [ownerAgent],
    dependencies: [],
    approvalPolicy: "not-required",
    executionMode: "event-driven",
    retryPolicy: "1 retry",
    timeout: 900,
    runtime: "simulation",
    createdAt: AT,
    updatedAt: AT,
    createdBy: "Seed",
    updatedBy: "Seed",
    lifecycleStatus: "active",
    ownerAgent,
    successRate: 100,
    runsToday: 0,
    lastRun: "never",
  };
}

/** Loads a small two-department roster with one workflow each into the in-memory CRUD stores. */
export async function loadCrudFixtures(): Promise<void> {
  await agentAdapter.save([fixtureAgent("Support Agent", "Operations"), fixtureAgent("Invoice Agent", "Finance")]);
  await workflowAdapter.save([
    fixtureWorkflow("Customer Support", "Operations", "Support Agent"),
    fixtureWorkflow("Invoice Lifecycle", "Finance", "Invoice Agent"),
  ]);
}
