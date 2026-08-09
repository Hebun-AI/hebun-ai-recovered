/*
 * registry-directory/directory.ts — the honest Registries reference directory
 * (Hebun UI Phase 21C).
 *
 * Registries is a Knowledge L2 reference/catalog surface: a directory of the
 * organizational registries, who owns their authority, and their honest connection
 * state. Knowledge is a READ-ONLY reference map — it is not a second authority for
 * any registry, and it does not mutate one.
 *
 * These descriptors are STRUCTURAL FACTS only, grounded in real code: the registry
 * ids, titles, entity types, and L3 routes come from features/registries structure,
 * and the authority/owner/persistence/connection classification is derived from the
 * Phase 21A architecture audit. This module imports NO mock data. It surfaces NO
 * record count, daily growth, health %, synchronization %, coverage %, freshness
 * timestamp, or sample record — those fields exist only as fabricated values in the
 * legacy mock and are deliberately not represented here.
 */

/** How the registry's data is currently held. */
export type RegistryPersistence = "mock-static" | "in-memory-engine" | "canonical-postgres" | "none";

/** Honest connection state of the registry to an authoritative feed. */
export type RegistryConnection = "reference-not-connected" | "connected" | "not-available";

/** Standing of the registry's L3 detail surface. */
export type RegistryDetailStatus = "mock-backed-legacy" | "no-detail" | "authoritative";

export interface RegistryDescriptor {
  readonly id: string;
  readonly title: string;
  readonly entityType: string;
  /** The real L3 route, when one exists. Absent when there is no detail surface. */
  readonly route?: string;
  /** The workspace whose surface is authoritative for this registry's entities. */
  readonly authoritativeOwner: string;
  /** The subsystem that owns the entity's lifecycle. */
  readonly ownerSubsystem: string;
  readonly persistence: RegistryPersistence;
  readonly connection: RegistryConnection;
  /** Who may mutate these records — never Knowledge. */
  readonly mutationOwner: string;
  readonly provenance: "none" | "declared" | "governed";
  readonly detailStatus: RegistryDetailStatus;
  /** Optional honesty note (e.g. where authoritative management actually lives). */
  readonly note?: string;
}

/*
 * The directory. Ids / titles / entity types / routes mirror the real registry
 * structure; authority/persistence/connection are the honest Phase 21A findings.
 * Every persistence is "mock-static" and every connection is "reference-not-connected"
 * because the current L3 detail is mock-backed and no authoritative feed is wired.
 */
export const REGISTRY_DIRECTORY: readonly RegistryDescriptor[] = [
  {
    id: "agents",
    title: "Agent Registry",
    entityType: "Agent",
    route: "/director/registries/agents",
    authoritativeOwner: "Workforce",
    ownerSubsystem: "agent-crud · agent-runtime",
    persistence: "mock-static",
    connection: "reference-not-connected",
    mutationOwner: "Workforce · Agents",
    provenance: "none",
    detailStatus: "mock-backed-legacy",
  },
  {
    id: "goals",
    title: "Goal Registry",
    entityType: "Goal",
    route: "/director/registries/goals",
    authoritativeOwner: "Command",
    ownerSubsystem: "goal-runtime",
    persistence: "mock-static",
    connection: "reference-not-connected",
    mutationOwner: "Command · Strategic Goals",
    provenance: "none",
    detailStatus: "mock-backed-legacy",
    note: "Authoritative goal management is Command · Strategic Goals. Knowledge shows registry metadata only.",
  },
  {
    id: "plans",
    title: "Plan Registry",
    entityType: "Plan",
    route: "/director/registries/plans",
    authoritativeOwner: "Operations",
    ownerSubsystem: "planning",
    persistence: "mock-static",
    connection: "reference-not-connected",
    mutationOwner: "Operations · Planning",
    provenance: "none",
    detailStatus: "mock-backed-legacy",
  },
  {
    id: "executions",
    title: "Execution Registry",
    entityType: "Execution",
    route: "/director/registries/executions",
    authoritativeOwner: "Operations",
    ownerSubsystem: "execution-engine",
    persistence: "mock-static",
    connection: "reference-not-connected",
    mutationOwner: "Operations · Executions",
    provenance: "none",
    detailStatus: "mock-backed-legacy",
  },
  {
    id: "experience",
    title: "Experience Registry",
    entityType: "Experience",
    route: "/director/registries/experience",
    authoritativeOwner: "Intelligence",
    ownerSubsystem: "experience store",
    persistence: "mock-static",
    connection: "reference-not-connected",
    mutationOwner: "Intelligence",
    provenance: "none",
    detailStatus: "mock-backed-legacy",
  },
  {
    id: "learning",
    title: "Learning Registry",
    entityType: "Learning",
    route: "/director/registries/learning",
    authoritativeOwner: "Intelligence",
    ownerSubsystem: "learning engine",
    persistence: "mock-static",
    connection: "reference-not-connected",
    mutationOwner: "Intelligence",
    provenance: "none",
    detailStatus: "mock-backed-legacy",
  },
  {
    id: "tools",
    title: "Tool Registry",
    entityType: "Tool",
    route: "/director/registries/tools",
    authoritativeOwner: "Platform",
    ownerSubsystem: "provider · tools",
    persistence: "mock-static",
    connection: "reference-not-connected",
    mutationOwner: "Platform · Providers",
    provenance: "none",
    detailStatus: "mock-backed-legacy",
  },
  {
    id: "models",
    title: "Model Registry",
    entityType: "Model",
    route: "/director/registries/models",
    authoritativeOwner: "Platform",
    ownerSubsystem: "provider · model routing",
    persistence: "mock-static",
    connection: "reference-not-connected",
    mutationOwner: "Platform · Providers",
    provenance: "none",
    detailStatus: "mock-backed-legacy",
  },
  {
    id: "capabilities",
    title: "Capability Registry",
    entityType: "Capability",
    route: "/director/registries/capabilities",
    authoritativeOwner: "Platform",
    ownerSubsystem: "capability planner",
    persistence: "mock-static",
    connection: "reference-not-connected",
    mutationOwner: "Platform",
    provenance: "none",
    detailStatus: "mock-backed-legacy",
  },
  {
    id: "events",
    title: "Event Registry",
    entityType: "Event",
    route: "/director/registries/events",
    authoritativeOwner: "Platform",
    ownerSubsystem: "enterprise-event-bus",
    persistence: "mock-static",
    connection: "reference-not-connected",
    mutationOwner: "Platform · Event Bus",
    provenance: "none",
    detailStatus: "mock-backed-legacy",
  },
  {
    id: "workflows",
    title: "Workflow Registry",
    entityType: "Workflow",
    route: "/director/registries/workflows",
    authoritativeOwner: "Operations",
    ownerSubsystem: "workflow-crud · workflow-runtime",
    persistence: "mock-static",
    connection: "reference-not-connected",
    mutationOwner: "Operations · Workflows",
    provenance: "none",
    detailStatus: "mock-backed-legacy",
  },
  {
    id: "entities",
    title: "Business Entity Registry",
    entityType: "Business entity",
    route: "/director/registries/entities",
    authoritativeOwner: "Operations",
    ownerSubsystem: "organization · entity service",
    persistence: "mock-static",
    connection: "reference-not-connected",
    mutationOwner: "Operations",
    provenance: "none",
    detailStatus: "mock-backed-legacy",
  },
  {
    id: "governance",
    title: "Governance Registry",
    entityType: "Governance record",
    route: "/director/registries/governance",
    authoritativeOwner: "Governance",
    ownerSubsystem: "governance core",
    persistence: "mock-static",
    connection: "reference-not-connected",
    mutationOwner: "Governance",
    provenance: "none",
    detailStatus: "mock-backed-legacy",
  },
  {
    id: "risk",
    title: "Risk Registry",
    entityType: "Risk",
    route: "/director/registries/risk",
    authoritativeOwner: "Governance",
    ownerSubsystem: "risk engine",
    persistence: "mock-static",
    connection: "reference-not-connected",
    mutationOwner: "Governance · Risk",
    provenance: "none",
    detailStatus: "mock-backed-legacy",
  },
  {
    id: "policies",
    title: "Policy Registry",
    entityType: "Policy",
    authoritativeOwner: "Governance",
    ownerSubsystem: "policy engine",
    persistence: "mock-static",
    connection: "reference-not-connected",
    mutationOwner: "Governance · Policies",
    provenance: "none",
    detailStatus: "no-detail",
    note: "Authoritative policy management is Governance. No registry detail route exists.",
  },
];
