/*
 * live-map/read-live-map.server.ts — L4. THE ONE PROJECTION SEAM.
 *
 * ── IT CONSUMES AUTHORITIES; IT DOES NOT REACH PAST THEM ─────────────────────
 *
 * Organization truth arrives through L3's `readOrganizationAuthority` and agent identity through
 * AGENT-ID-0's `readDurableAgentIdentityState`. Neither table is touched directly. That is the
 * whole architecture: reading `companies` here would be a SECOND interpretation of a fact L3
 * already owns, and two readers of one table are two answers waiting to disagree.
 *
 *     L3 READ AUTHORITY -> L4 PROJECTION          not          DATABASE TABLE -> L4
 *
 * The agent seam is imported by FILE, never through `@/features/agent-identity`, because that
 * barrel re-exports `createDurableAgentIdentity` and `retireDurableAgentIdentity`. A visualization
 * that pulls two lifecycle writers into its module graph has acquired authority it will never use
 * and cannot justify — which is exactly the L4 observation-surface gate.
 *
 * ── THE TENANT IS UNREPRESENTABLE AS AN ARGUMENT ─────────────────────────────
 *
 * The only parameter is the trusted `TenantContext`. There is no tenant, organization, slug or
 * filter argument, so no caller can point this at another organization — and both authorities
 * beneath it are themselves tenant-scoped with no widening parameter of their own.
 *
 * ── IT WRITES NOTHING, AND CAN REACH NOTHING THAT WRITES ─────────────────────
 *
 * No INSERT, no UPDATE, no DELETE, no transaction, no database handle at all: it holds no
 * `getControlPlaneDb`, because the authorities it composes hold theirs.
 *
 * Server-only.
 */
import { readOrganizationAuthority } from "@/features/organization-authority/read-organization.server";
import type { OrganizationAuthorityRead } from "@/features/organization-authority/contracts";
import { readDurableAgentIdentityState } from "@/features/agent-identity/read-durable-agent-identity.server";
import type { DurableAgentIdentityState } from "@/features/agent-identity/read-durable-agent-identity.server";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  LIVE_MAP_FRESHNESS,
  LIVE_MAP_PEOPLE_ABSENT,
  LIVE_MAP_STRUCTURE_ABSENT,
  type LiveMapDomain,
  type LiveMapEdge,
  type LiveMapNode,
  type LiveMapProjection,
} from "./contracts";

export interface LiveMapDeps {
  readonly readOrganization?: (tenant: TenantContext | null) => Promise<OrganizationAuthorityRead>;
  readonly readAgentIdentity?: (tenant: TenantContext | null) => Promise<DurableAgentIdentityState>;
}

/** Projection identities. Kind-prefixed so a node id can never be mistaken for a domain id. */
const organizationNodeId = (organizationId: string): string => `organization:${organizationId}`;
const agentNodeId = (agentId: string): string => `agent:${agentId}`;

/**
 * The sentence a reader sees when the organization authority could not answer.
 *
 * Every one of these is an ABSENCE OF AN ANSWER, never an organization. A map that renders a
 * nameless node here would be inventing the very thing L3 exists to refuse.
 */
const ORGANIZATION_UNAVAILABLE_DETAIL: Readonly<Record<string, string>> = Object.freeze({
  "no-tenant":
    "No organization is resolved for this session, so Hebun did not establish which organization to map.",
  "persistence-not-configured":
    "Durable storage is not configured for this deployment, so Hebun holds no organization record to map.",
  "organization-not-found":
    "This session names an organization Hebun cannot find as a live record. Nothing was substituted for it.",
  "read-failed":
    "Hebun could not read your organization. That is a read failure, not an organization with nothing in it.",
});

/** Build the organization domain from L3's answer, without reinterpreting any of it. */
function organizationDomain(read: OrganizationAuthorityRead): LiveMapDomain {
  if (read.status === "unavailable") {
    return {
      domainId: "organization",
      label: "Organization",
      state: {
        status: "unavailable",
        reason: read.reason,
        detail:
          ORGANIZATION_UNAVAILABLE_DETAIL[read.reason] ??
          "Hebun could not establish your organization.",
      },
    };
  }

  const organization = read.organization;
  const node: LiveMapNode = {
    nodeId: organizationNodeId(organization.organizationId),
    kind: "organization",
    label: organization.name,
    truth: "authoritative",
    sourceAuthority: "Organization Authority",
    /*
     * The member COUNT travels as a property of the organization, never as people nodes: Hebun has
     * no authority that lists them and membership carries no departmental placement, so drawing a
     * person would be claiming a placement nobody owns.
     */
    detail: [
      `Identifier: ${organization.slug}.`,
      `Lifecycle: ${organization.lifecycleStatus}.`,
      `Tenant status: ${organization.tenantStatus ?? "none recorded"}.`,
      `Human members: ${organization.humanMemberCount}.`,
      organization.provenanceDetail,
    ],
    openRoute: "/director/organization",
  };

  return {
    domainId: "organization",
    label: "Organization",
    state: { status: "available", nodes: [node] },
  };
}

/**
 * Build the agent domain.
 *
 * THIS IS THE ONE DOMAIN WHERE `known-empty` IS A REAL ANSWER. The released reader separates "this
 * tenant has created no agent" from "the authority could not be reached" in its own type, so the
 * distinction is inherited rather than invented — and it is the only place Core claims it.
 */
function agentDomain(state: DurableAgentIdentityState): LiveMapDomain {
  if (state.status === "unavailable") {
    return {
      domainId: "agents",
      label: "Agents",
      state: {
        status: "unavailable",
        reason: "identity-authority-unavailable",
        detail:
          "Hebun could not read this organization's durable agent identities. That is a read " +
          "failure, not an organization without agents.",
      },
    };
  }

  if (state.identities.length === 0) {
    return {
      domainId: "agents",
      label: "Agents",
      state: {
        status: "known-empty",
        detail:
          "The agent identity authority answered: this organization has established no durable " +
          "agent identity. This is a measured zero, not a missing read.",
      },
    };
  }

  const nodes: readonly LiveMapNode[] = state.identities.map((identity) => ({
    nodeId: agentNodeId(identity.agentId),
    kind: "agent",
    label: identity.name,
    truth: "authoritative",
    sourceAuthority: "Durable Agent Identity",
    /*
     * `inService` is rendered explicitly because retirement LEAVES THE ROW IN PLACE. A retired
     * identity drawn without its state would read as a working agent, which is the one thing the
     * retirement authority's own header warns a surface must never say.
     */
    detail: [
      identity.inService
        ? "In service."
        : `Retired${identity.retiredAt ? ` at ${identity.retiredAt}` : ""}. Its identity is permanent; it is not working.`,
      `Established: ${identity.createdAt}.`,
    ],
    openRoute: "/agents",
  }));

  return { domainId: "agents", label: "Agents", state: { status: "available", nodes } };
}

/**
 * THE ONE EDGE, AND ONLY WHEN BOTH ENDS ARE ON THE MAP.
 *
 * `agents.tenant_id` holds this organization's identity — L3 established that the organization IS
 * the tenant — so this restates a durable foreign key rather than inferring a relationship from
 * shared scope. If the organization is unavailable the agents are still real, but the relationship
 * has no visible far end, so nothing is drawn.
 */
function edgesFor(organization: LiveMapDomain, agents: LiveMapDomain): readonly LiveMapEdge[] {
  if (organization.state.status !== "available") return [];
  if (agents.state.status !== "available") return [];
  const organizationNode = organization.state.nodes[0];
  if (!organizationNode) return [];

  return agents.state.nodes.map((agent) => ({
    fromNodeId: agent.nodeId,
    toNodeId: organizationNode.nodeId,
    relation: "belongs-to",
    basis:
      "agents.tenant_id — the durable column whose value is this organization's own identity. " +
      "No departmental placement, ownership or assignment is claimed by this edge.",
  }));
}

/**
 * The Live Map projection for the authenticated human's own organization.
 *
 * Each authority is awaited independently and a failure of either is contained: the domain that
 * authority owns becomes unavailable while the other keeps its real answer. One unreachable
 * authority must not blank out the map.
 */
export async function readLiveMapProjection(
  tenant: TenantContext | null,
  deps: LiveMapDeps = {},
): Promise<LiveMapProjection> {
  if (typeof window !== "undefined") {
    throw new Error("Live Map projection reads are server-only.");
  }

  const readOrganization = deps.readOrganization ?? ((t) => readOrganizationAuthority(t));
  const readAgents = deps.readAgentIdentity ?? ((t) => readDurableAgentIdentityState(t));

  let organizationRead: OrganizationAuthorityRead;
  try {
    organizationRead = await readOrganization(tenant);
  } catch {
    organizationRead = { status: "unavailable", reason: "read-failed" };
  }

  let agentState: DurableAgentIdentityState;
  try {
    agentState = await readAgents(tenant);
  } catch {
    agentState = { status: "unavailable" };
  }

  const organization = organizationDomain(organizationRead);
  const agents = agentDomain(agentState);

  /*
   * Structure and people are represented, not omitted. Their state is `no-authority` — a claim
   * about Hebun, not about the organization — and it is constant today because no owner exists for
   * either. When one does, it becomes available HERE and the surface inherits it unchanged.
   */
  const structure: LiveMapDomain = {
    domainId: "structure",
    label: "Departments & teams",
    state: { status: "no-authority", detail: LIVE_MAP_STRUCTURE_ABSENT },
  };
  const people: LiveMapDomain = {
    domainId: "people",
    label: "People",
    state: { status: "no-authority", detail: LIVE_MAP_PEOPLE_ABSENT },
  };

  return {
    domains: [organization, agents, structure, people],
    edges: edgesFor(organization, agents),
    freshness: LIVE_MAP_FRESHNESS,
  };
}
