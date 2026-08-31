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
 * ── THE DERIVED ATTACHMENT (E2-3) ────────────────────────────────────────────
 *
 * Agent outcome evidence arrives through the SAME kind of seam as everything else: a read owned by
 * the authority that produces it, `agent-outcome-observation`, which already owns the nine grouped
 * statements and the seven lifecycle stages. Live Map restates none of that ladder and touches
 * none of those tables.
 *
 * IT IS ATTACHED BY ID AND BY NOTHING ELSE. The agent node's identity is `identity.agentId` from
 * the identity authority, and the evidence is looked up by that same value. A name join would be a
 * guess — two agents may carry one name — and an order join would be a coincidence.
 *
 *     JOIN BY ID, NEVER BY NAME        AGENT NAME != AGENT IDENTITY
 *
 * AND IT STAYS A SECOND TRUTH CLASS. The node keeps `truth: "authoritative"` because the identity
 * authority vouches for it; the attachment carries `truthClass: "derived"` because nobody vouches
 * for a composition. They are separate fields with disjoint single-value unions, so neither can
 * become the other.
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
/*
 * IMPORTED BY FILE, and there is no barrel to import instead. This module is the outcome
 * authority's own Live Map seam: it reaches the released indexed read and nothing that writes.
 */
import { readLiveMapAgentOutcome } from "@/features/agent-outcome-observation/live-map-agent-outcome.server";
import {
  readAgentAwaitingDecision,
  type AgentAwaitingDecision,
  type AwaitingDecisionRead,
} from "@/features/action-authorization/awaiting-decision-aggregate.server";
import {
  ATTENTION_NON_CLAIMS,
  ATTENTION_OBSERVATION_AUTHORITY,
  ATTENTION_OBSERVATION_BASIS,
  elapsedSince,
} from "@/features/attention-observation/contracts";
import {
  LIVE_MAP_AGENT_OUTCOME_AUTHORITY,
  LIVE_MAP_AGENT_OUTCOME_BASIS,
  LIVE_MAP_AGENT_OUTCOME_NON_CLAIMS,
  LIVE_MAP_AGENT_OUTCOME_NOT_OBSERVED,
  LIVE_MAP_AGENT_OUTCOME_UNAVAILABLE,
  type LiveMapAgentOutcome,
  type LiveMapAgentOutcomeRead,
} from "@/features/agent-outcome-observation/live-map-agent-outcome.server";
import {
  LIVE_MAP_FRESHNESS,
  LIVE_MAP_INTELLIGENCE_COMPLETENESS_WORDING,
  LIVE_MAP_PEOPLE_ABSENT,
  LIVE_MAP_STRUCTURE_ABSENT,
  LIVE_MAP_STRUCTURE_NONE_RECORDED,
  liveMapStructureRecorded,
  type LiveMapDomain,
  type LiveMapDomainState,
  type LiveMapEdge,
  type LiveMapIntelligenceCompleteness,
  type LiveMapNode,
  type LiveMapNodeAttention,
  type LiveMapNodeIntelligence,
  type LiveMapProjection,
} from "./contracts";

export interface LiveMapDeps {
  readonly readOrganization?: (tenant: TenantContext | null) => Promise<OrganizationAuthorityRead>;
  readonly readAgentIdentity?: (tenant: TenantContext | null) => Promise<DurableAgentIdentityState>;
  readonly readAgentOutcome?: (tenant: TenantContext | null) => Promise<LiveMapAgentOutcomeRead>;
  /**
   * E2-4 — this tenant's per-agent awaiting-decision position, unbounded and grouped in one
   * statement. Injected like the other three, and contained like them: a failure leaves the node
   * intact and simply carries no duration.
   */
  readonly readAgentAwaiting?: (
    tenant: TenantContext | null,
  ) => Promise<AwaitingDecisionRead<readonly AgentAwaitingDecision[]>>;
  /** The single instant every duration on one reading is measured against. Injected for tests. */
  readonly now?: () => Date;
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
/**
 * The structure domain's state, read off the SAME organization authority the map already consults.
 *
 * Three states, never two. A read that failed reports `unavailable`; an organization that recorded
 * none reports `known-empty`, which is a real answer about the organization; recorded departments
 * report `known-empty` too — with a count — because this projection draws no department node and
 * `available` would promise nodes that are not there.
 */
function structureState(read: OrganizationAuthorityRead): LiveMapDomainState {
  if (read.status === "unavailable" || read.organization.structure.status === "unavailable") {
    return { status: "no-authority", detail: LIVE_MAP_STRUCTURE_ABSENT };
  }
  const departments = read.organization.structure.departments;
  if (departments.length === 0) {
    return { status: "known-empty", detail: LIVE_MAP_STRUCTURE_NONE_RECORDED };
  }
  const inService = departments.filter((department) => department.inService).length;
  return {
    status: "known-empty",
    detail: liveMapStructureRecorded(inService, departments.length - inService),
  };
}

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
 * The derived attachment for ONE agent node, resolved by durable agent id.
 *
 * THREE OUTCOMES, AND THEY ARE THREE. The evidence could not be read at all; the evidence was read
 * and holds no entry for this identity; the evidence was read and these are the counts. The first
 * two are different sentences and neither is a row of zeros, because a zero here is a MEASURED
 * zero — this agent filed nothing — and printing one over an unread observation would tell a
 * Director that a working agent has done nothing.
 *
 *     UNAVAILABLE != ZERO ACTIVITY
 *
 * The counts are carried across unchanged. Nothing is divided, combined or compared: the lifecycle
 * stages stay apart because each one is a different authority's fact, and one number claiming to
 * summarise them would be a claim no record supports.
 *
 *     APPROVED != EXECUTED    EXECUTED != SUCCESSFUL    FAILED != REFUSED    UNKNOWN != FAILED
 */
function agentIntelligence(
  outcome: LiveMapAgentOutcomeRead,
  agentId: string,
): LiveMapNodeIntelligence {
  if (outcome.status !== "read") {
    return {
      status: "unavailable",
      truthClass: "derived",
      sourceAuthority: LIVE_MAP_AGENT_OUTCOME_AUTHORITY,
      detail: LIVE_MAP_AGENT_OUTCOME_UNAVAILABLE,
    };
  }

  /* THE ONLY JOIN. The key is the identity authority's own id — never the name, never the order. */
  const observed: LiveMapAgentOutcome | undefined = outcome.byAgentId.get(agentId);
  if (!observed) {
    return {
      status: "unavailable",
      truthClass: "derived",
      sourceAuthority: LIVE_MAP_AGENT_OUTCOME_AUTHORITY,
      detail: LIVE_MAP_AGENT_OUTCOME_NOT_OBSERVED,
    };
  }

  return {
    status: "observed",
    truthClass: "derived",
    sourceAuthority: LIVE_MAP_AGENT_OUTCOME_AUTHORITY,
    basis: LIVE_MAP_AGENT_OUTCOME_BASIS,
    nonClaims: LIVE_MAP_AGENT_OUTCOME_NON_CLAIMS,
    groups: [
      {
        groupId: "proposals",
        label: "Proposals filed",
        measures: [
          {
            label: "Filed",
            value: observed.activity.proposalsFiled,
            note: "This agent filed a proposal. A human still had to read it.",
          },
          {
            label: "Awaiting a decision",
            value: observed.activity.pending,
            note:
              "Nobody has decided these yet. Hebun has no scheduler, so a proposal nobody decides " +
              "stays undecided rather than expiring.",
          },
          { label: "Withdrawn", value: observed.activity.withdrawn },
        ],
      },
      {
        groupId: "governance",
        label: "Governance outcome",
        measures: [
          {
            label: "Approved",
            value: observed.governance.approved,
            note: "An approval authorizes an act. It does not perform one.",
          },
          { label: "Rejected", value: observed.governance.rejected },
          {
            label: "Permits issued",
            value: observed.governance.permitsIssued,
            note: "A durable authorization to act exists, or existed. It is not an execution.",
          },
          { label: "Permits still active", value: observed.governance.permitsActive },
          { label: "Permits expired", value: observed.governance.permitsExpired },
          { label: "Permits consumed", value: observed.governance.permitsConsumed },
          { label: "Permits revoked", value: observed.governance.permitsRevoked },
          {
            label: "Approved, never executed",
            value: observed.governance.approvedWithoutExecution,
            note:
              "Approved proposals with no execution attempt behind them — the clearest statement " +
              "here that an approval is not a thing that happened.",
          },
        ],
      },
      {
        groupId: "execution",
        label: "Execution outcome",
        measures: [
          {
            label: "Attempts",
            value: observed.execution.attempts,
            note: "An authorization was spent and an attempt was recorded. It may not have worked.",
          },
          { label: "Awaiting an answer", value: observed.execution.pending },
          {
            label: "Accepted by the provider",
            value: observed.execution.accepted,
            note:
              "The provider took the request and returned its own id. Accepted is not delivered, " +
              "not received and not read.",
          },
          { label: "Refused", value: observed.execution.refused },
          {
            label: "Failed",
            value: observed.execution.failed,
            note: "A provider answered and declined, or the connection provably never came up.",
          },
          {
            label: "Unknown",
            value: observed.execution.unknown,
            note:
              "The request was sent and the answer was lost. This is not a failure — the external " +
              "effect may already have happened.",
          },
        ],
      },
    ],
  };
}

/**
 * How much of the evidence the join could place, as a projection-level statement.
 *
 * Absent when the evidence could not be read at all: a completeness figure over an unread
 * observation would be a number about nothing.
 */
function intelligenceCompleteness(
  outcome: LiveMapAgentOutcomeRead,
): LiveMapIntelligenceCompleteness | undefined {
  if (outcome.status !== "read") return undefined;
  return {
    unresolvedAgentProposals: outcome.unresolvedAgentProposals,
    detail:
      outcome.unresolvedAgentProposals === 0
        ? LIVE_MAP_INTELLIGENCE_COMPLETENESS_WORDING.placed
        : LIVE_MAP_INTELLIGENCE_COMPLETENESS_WORDING.unresolved,
  };
}

/**
 * Build the agent domain.
 *
 * THIS IS THE ONE DOMAIN WHERE `known-empty` IS A REAL ANSWER. The released reader separates "this
 * tenant has created no agent" from "the authority could not be reached" in its own type, so the
 * distinction is inherited rather than invented — and it is the only place Core claims it.
 */
/**
 * E2-4 — the elapsed annotation for ONE agent node, or nothing.
 *
 * Returned `undefined` — not a block of zeros — when the aggregate could not be read, when this
 * agent has nothing awaiting, or when the oldest instant is unusable. A node with no annotation is
 * a node this milestone has nothing to say about, and that is different from an agent with a wait
 * of zero.
 *
 *     UNAVAILABLE != ZERO DURATION        NOTHING AWAITING != A DURATION OF NOTHING
 */
function agentAttention(
  awaiting: AwaitingDecisionRead<readonly AgentAwaitingDecision[]>,
  agentId: string,
  evaluatedAt: string,
): LiveMapNodeAttention | undefined {
  if (awaiting.status !== "read") return undefined;
  const row = awaiting.value.find((entry) => entry.agentId === agentId);
  if (!row || row.awaiting === 0) return undefined;
  const oldest = elapsedSince(row.oldestFiledAt, evaluatedAt, "action-request.created_at");
  if (oldest === null) return undefined;
  return {
    truthClass: "derived",
    sourceAuthority: ATTENTION_OBSERVATION_AUTHORITY,
    basis: ATTENTION_OBSERVATION_BASIS,
    measures: [
      {
        label: "Oldest proposal awaiting a decision",
        value: oldest.label,
        basis: oldest.basis,
      },
    ],
    nonClaims: ATTENTION_NON_CLAIMS,
  };
}

function agentDomain(
  state: DurableAgentIdentityState,
  outcome: LiveMapAgentOutcomeRead,
  awaiting: AwaitingDecisionRead<readonly AgentAwaitingDecision[]>,
  evaluatedAt: string,
): LiveMapDomain {
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
    /*
     * THE SAME FACT THE FIRST DETAIL LINE STATES, AS A VALUE. `inService` is the identity
     * authority's own derivation; handing the surface a word to render keeps a visual map from
     * having to read a sentence to find out whether an agent is working.
     */
    status: identity.inService
      ? { label: "In service", tone: "active" as const }
      : { label: "Retired", tone: "retired" as const },
    /*
     * ATTACHED BY THE SAME ID THE NODE IS BUILT FROM. `identity.agentId` produced this node's
     * `nodeId` two lines above and it is the key here, so the evidence and the node cannot come
     * apart — there is one identifier, used twice.
     */
    intelligence: agentIntelligence(outcome, identity.agentId),
    /*
     * ATTACHED BY THE SAME ID, in its own field. Absent when this agent has nothing awaiting or the
     * aggregate could not be read — never a zero, and never merged into the block above.
     */
    attention: agentAttention(awaiting, identity.agentId, evaluatedAt),
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
  const readOutcome = deps.readAgentOutcome ?? ((t) => readLiveMapAgentOutcome(t));

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

  /*
   * ONE READ FOR THE WHOLE ORGANIZATION, whatever its size. The evidence arrives keyed by agent id
   * and every node then costs a map lookup, so nothing here iterates agents to fetch anything.
   *
   * A failure is contained exactly as the other two are, and it degrades to an UNREAD attachment on
   * an otherwise real node — never to an agent that appears to have done nothing.
   */
  let outcomeRead: LiveMapAgentOutcomeRead;
  try {
    outcomeRead = await readOutcome(tenant);
  } catch {
    outcomeRead = { status: "unavailable", reason: "read-failed" };
  }

  /*
   * E2-4 — a FOURTH read, contained exactly as the other three are. One grouped, unbounded
   * statement for the whole organization; a failure leaves every node intact and simply carries no
   * duration.
   */
  let awaitingRead: AwaitingDecisionRead<readonly AgentAwaitingDecision[]>;
  try {
    awaitingRead = await (deps.readAgentAwaiting ?? ((t: TenantContext | null) => readAgentAwaitingDecision(t)))(
      tenant,
    );
  } catch {
    awaitingRead = { status: "unavailable", reason: "read-failed" };
  }
  /* ONE instant for every duration in this reading. */
  const evaluatedAt = (deps.now?.() ?? new Date()).toISOString();

  const organization = organizationDomain(organizationRead);
  const agents = agentDomain(agentState, outcomeRead, awaitingRead, evaluatedAt);

  /*
   * ── STRUCTURE, AFTER OSA-1 ───────────────────────────────────────────────────
   *
   * This domain was a constant `no-authority` because no owner existed for it. One exists now, so
   * the constant became a FALSE claim about Hebun — the map would tell a Director "no authority for
   * departments" while the Organization surface listed theirs.
   *
   * The repair is the NARROWEST one that makes the map truthful, and it deliberately stops short of
   * the milestone OSA-0 deferred: the structure the map already receives — Live Map has read
   * `readOrganizationAuthority` since L4, and OSA-1 put structure inside that read — is reported as
   * a COUNT with the honest three states. No department NODE is drawn, no edge is invented, and no
   * new seam is called. Drawing departments is its own product milestone.
   *
   *     UNAVAILABLE != EMPTY        COUNTED != DRAWN
   *
   * `people` is untouched and stays `no-authority`: OSA-1 shipped no roster, so that sentence is
   * still exactly true.
   */
  const structure: LiveMapDomain = {
    domainId: "structure",
    label: "Departments & teams",
    state: structureState(organizationRead),
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
    intelligenceCompleteness: intelligenceCompleteness(outcomeRead),
  };
}
