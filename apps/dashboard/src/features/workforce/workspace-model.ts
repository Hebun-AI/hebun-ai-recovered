/*
 * workforce/workspace-model.ts — the read model for the Workforce Workspace
 * (Hebun UI Phase 11).
 *
 * PROVENANCE CONTRACT (no-fake-data):
 *
 *   Hebun has NO real, populated organizational-workforce identity model. The only
 *   "agent" data in the repository is the agent-crud seed roster (fabricated agent
 *   records with names, departments, capabilities, and costs) surfaced by the
 *   legacy /agents page — SYNTHETIC, deliberately NOT imported here. There is no
 *   human/employee identity model at all. The Executive Overview `active-agents`
 *   count is an OPERATIONAL runtime record count, not a set of organizational
 *   workforce identities, and is not converted into "N AI employees" here.
 *
 *   So this model carries only the workspace's INFORMATION MODEL as static
 *   explanatory structure — the two workforce entity types (Human, AI Agent) and
 *   the distinct concept layers the product must keep separate (Identity, Role,
 *   Capability, Responsibility, Assignment, Authority, Availability). It fabricates
 *   no worker, name, role, team, capability, assignment, workload, or capacity.
 *   Every directory-style region renders an honest empty state.
 */

/** A workforce entity type the model must eventually represent. Copy only. */
export interface EntityTypeView {
  readonly type: "human" | "ai-agent";
  readonly label: string;
  readonly describes: string;
  /** Honest count — no workforce identity is connected, so always 0. */
  readonly connected: 0;
}

const ENTITY_TYPES: readonly EntityTypeView[] = [
  {
    type: "human",
    label: "Human",
    describes: "A person who can perform or own work. No human workforce identity is connected.",
    connected: 0,
  },
  {
    type: "ai-agent",
    label: "AI Agent",
    describes: "A software agent that can perform work. Agent runtime activity is observed in Operations; it is not yet an organizational workforce identity.",
    connected: 0,
  },
];

/**
 * The concept layers the product must keep distinct — none collapses into another.
 * These are the workspace's information model, not populated records.
 */
export interface ConceptLayerView {
  readonly key: string;
  readonly label: string;
  readonly question: string;
  readonly notEqual: string;
}

const CONCEPT_LAYERS: readonly ConceptLayerView[] = [
  { key: "identity", label: "Identity", question: "Who or what is this?", notEqual: "An identity is not a role." },
  { key: "role", label: "Role", question: "What organizational function do they hold?", notEqual: "A role is not a capability." },
  { key: "capability", label: "Capability", question: "What can they actually do?", notEqual: "A capability is not a permission." },
  { key: "responsibility", label: "Responsibility", question: "What are they accountable for?", notEqual: "A responsibility is not an assignment." },
  { key: "assignment", label: "Assignment", question: "What specific work is delegated to them?", notEqual: "An assignment is not execution." },
  { key: "authority", label: "Authority", question: "What are they permitted to decide?", notEqual: "Authority is not capability or tool access." },
  { key: "availability", label: "Availability", question: "What is their current operational relationship to work?", notEqual: "Availability is not operational health." },
];

/**
 * The capability chain the model must support without collapsing its links. Static
 * explanatory structure — no capability is populated.
 */
export interface CapabilityChainLink {
  readonly key: string;
  readonly label: string;
  readonly describes: string;
}

const CAPABILITY_CHAIN: readonly CapabilityChainLink[] = [
  { key: "worker", label: "Worker", describes: "A human or AI agent." },
  { key: "capability", label: "Capability", describes: "What the worker can do." },
  { key: "tool", label: "Tool", describes: "The instrument a capability uses." },
  { key: "permission", label: "Permission", describes: "Whether use is allowed — granted by Governance, not by capability." },
  { key: "work", label: "Work", describes: "The actual task performed, observed in Operations." },
];

/** One inspector lens. Instructional only — nothing is selectable yet. */
export interface WorkforceLensView {
  readonly facet: string;
  readonly question: string;
}

const INSPECTOR_LENSES: readonly WorkforceLensView[] = [
  { facet: "Identity", question: "Who or what is this worker?" },
  { facet: "Role", question: "What function do they hold?" },
  { facet: "Capabilities", question: "What can they do?" },
  { facet: "Responsibilities", question: "What do they own?" },
  { facet: "Assignments", question: "What are they assigned to?" },
  { facet: "Authority", question: "What may they decide?" },
  { facet: "Activity", question: "What are they doing now?" },
  { facet: "Provenance", question: "Where did this identity come from?" },
];

export interface WorkforceWorkspaceModel {
  readonly entityTypes: readonly EntityTypeView[];
  readonly conceptLayers: readonly ConceptLayerView[];
  readonly capabilityChain: readonly CapabilityChainLink[];
  readonly inspectorLenses: readonly WorkforceLensView[];
  /** Populated workforce identities. Always empty: none is connected or fabricated. */
  readonly workers: readonly never[];
}

/** Build the Workforce Workspace model. Pure; fabricates nothing. */
export function getWorkforceWorkspaceModel(): WorkforceWorkspaceModel {
  return {
    entityTypes: ENTITY_TYPES,
    conceptLayers: CONCEPT_LAYERS,
    capabilityChain: CAPABILITY_CHAIN,
    inspectorLenses: INSPECTOR_LENSES,
    workers: [],
  };
}
