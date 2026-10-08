/*
 * origination-availability/read-origination-availability.server.ts — may a human be OFFERED governed
 * Agent origination right now? (WF-1)
 *
 * A READ PROJECTION. It owns no state, writes nothing and decides nothing. It asks the authorities
 * that already decide — proposer resolution, the Agent Mandate Authority and its ceiling, the
 * provider-ops view, the External AI Data-Use gate — and composes their answers. None of their logic
 * is repeated here, and nothing reads this projection to authorize anything: the origination seam
 * re-asks every one of them when the human confirms, and its answer wins.
 *
 * It reaches no model client, no transport send, no origination or request writer, no Governance,
 * permit or execution writer, and no disclosure audit writer. The gate it asks is the pure decision;
 * the record of a decision is written only by the generator, before a real egress. A firewall test
 * pins this module's import graph.
 *
 * Fails closed: any authority that cannot be read makes the option unavailable, never available.
 */
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import type { ControlPlaneDatabase } from "@/db/client.server";
import { resolveAgentProposer } from "@/features/action-authorization/agent-proposer.server";
import { refuseOutsideAgentMandate } from "@/features/action-authorization/agent-mandate-ceiling";
import { readDurableAgentIdentityState } from "@/features/agent-identity/read-durable-agent-identity.server";
import type { AgentSelection } from "@/features/agent-identity/contracts";
import { readEffectiveAgentMandate } from "@/features/agent-mandate/read-agent-mandate.server";
import {
  AGENT_ORIGINABLE_REGISTRY_KIND,
  RECORD_WORK_ORIGINATION_ALIAS,
} from "@/features/agent-origination/contracts";
import {
  readProviderOpsView,
  type ProviderOpsView,
} from "@/features/heby-provider-ops/provider-connectivity-projection.server";
import { authorizeExternalAiDisclosure } from "@/features/external-ai-data-use/authorize-external-ai-disclosure.server";
import type { DataClass } from "@/features/external-ai-data-use/contracts";
import type { AgentOriginationAvailability, OriginationUnavailableReason, WorkScopeOption } from "./contracts";
import { readWorkDomains } from "@/features/work-domain/read-work-domains.server";
import { listEligibleAgents } from "./list-eligible-agents.server";

/*
 * What the narrow origination path declares: the goal (`conversation`) and the organization's
 * structure (`organization`). The origination seam DERIVES its declaration from what it renders; a
 * test pins this constant to that derivation, so the two cannot drift silently.
 */
export const ORIGINATION_DECLARED_DATA_CLASSES: readonly DataClass[] = Object.freeze(["conversation", "organization"]);

export interface OriginationAvailabilityDeps {
  readonly resolveTenant: () => Promise<TenantContext | null>;
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly readProviderOps?: () => Promise<ProviderOpsView>;
}

const unavailable = (reason: OriginationUnavailableReason): AgentOriginationAvailability => ({ status: "unavailable", reason });

const PROPOSER_REASON: Readonly<Record<string, OriginationUnavailableReason>> = {
  "no-authorized-tenant-context": "tenant-unavailable",
  "no-durable-agent-identity": "no-agent",
  "durable-agent-identity-retired": "agent-retired",
  "ambiguous-durable-agent-identity": "multiple-agents",
  "selected-agent-unresolvable": "selected-agent-unresolvable",
  "selected-agent-retired": "agent-retired",
};

/**
 * AP-4B. Organization-level, then every IN-SERVICE work domain by slug, each with its eligible agents.
 * `null` when either authority cannot be read — never a partial list.
 */
async function readWorkScopeOptions(
  tenant: TenantContext,
  db: { readonly getDb?: () => ControlPlaneDatabase | null },
): Promise<readonly WorkScopeOption[] | null> {
  const domains = await readWorkDomains(tenant, db);
  if (domains.status !== "read") return null;
  const scopes = [
    { scope: { kind: "organization" as const }, label: "Organization-level" },
    ...domains.workDomains
      .filter((d) => d.inService)
      .map((d) => ({ scope: { kind: "domain" as const, workDomainId: d.workDomainId }, label: d.name })),
  ];
  const options: WorkScopeOption[] = [];
  for (const entry of scopes) {
    const eligible = await listEligibleAgents(tenant, entry.scope, db);
    if (eligible.status !== "read") return null;
    options.push({ ...entry, eligibleAgentIds: eligible.agents.map((a) => a.agentId) });
  }
  return options;
}

export async function readOriginationAvailability(
  deps: OriginationAvailabilityDeps,
  /* AP-1 — which agent the human is asking about; a lookup key the resolver verifies. */
  selection: AgentSelection = {},
): Promise<AgentOriginationAvailability> {
  if (typeof window !== "undefined") throw new Error("Origination availability is server-only.");
  const db = deps.getDb ? { getDb: deps.getDb } : {};
  try {
    const tenant = await deps.resolveTenant();
    if (!tenant?.tenantId || !tenant.userId) return unavailable("tenant-unavailable");

    /*
     * 1 · The selected agent, or exactly one in-service agent — by the resolver origination itself
     * uses, with the same selection, so this offer and the confirmation name the same agent.
     */
    const proposer = await resolveAgentProposer(tenant, db, selection);
    const identity = await readDurableAgentIdentityState(tenant, db);
    if (proposer.status === "refused") {
      if (proposer.reason === "ambiguous-durable-agent-identity" && identity.status === "known") {
        /* AP-1 — say WHO could be chosen, never choose. In service only; by the read's own order. */
        const workScopes = await readWorkScopeOptions(tenant, db);
        if (!workScopes) return unavailable("temporarily-unavailable");
        return {
          status: "unavailable",
          reason: "multiple-agents",
          candidates: identity.identities
            .filter((i) => i.inService)
            .map((i) => ({ agentId: i.agentId, name: i.name })),
          workScopes,
        };
      }
      return unavailable(PROPOSER_REASON[proposer.reason] ?? "temporarily-unavailable");
    }
    const agentId = proposer.proposer.agentId;

    const name = identity.status === "known" ? identity.identities.find((i) => i.agentId === agentId)?.name : undefined;
    if (!name) return unavailable("temporarily-unavailable");

    /* 2 · The mandate in effect admits record-work — through the one shared ceiling. */
    const mandate = await readEffectiveAgentMandate(tenant, agentId, db);
    const ceiling = refuseOutsideAgentMandate(mandate, AGENT_ORIGINABLE_REGISTRY_KIND[RECORD_WORK_ORIGINATION_ALIAS]);
    if (ceiling === "agent-mandate-authority-unavailable") return unavailable("temporarily-unavailable");
    if (ceiling === "no-agent-mandate") return unavailable("mandate-unavailable");
    if (ceiling) return unavailable("proposal-scope-unavailable");
    if (mandate.status !== "known" || !mandate.mandate) return unavailable("mandate-unavailable");

    /* 2b · AP-4B. Which kinds of work this agent is responsible for, among those in service. */
    const workScopes = await readWorkScopeOptions(tenant, db);
    if (!workScopes) return unavailable("temporarily-unavailable");
    if (!workScopes.some((o) => o.eligibleAgentIds.includes(agentId))) return unavailable("no-work-responsibility");

    /* 3 · The Director control, model configuration and transport permit an attempt. */
    const ops = await (deps.readProviderOps ?? (() => readProviderOpsView()))();
    if (ops.dispatch !== "permitted" || !ops.model) return unavailable("model-unavailable");

    /* 4 · Platform policy, tenant authorization and the attestation's model ids — the gate itself. */
    const decision = await authorizeExternalAiDisclosure(
      { tenantId: tenant.tenantId, actorUserId: tenant.userId, purpose: "agent-origination", dataClasses: ORIGINATION_DECLARED_DATA_CLASSES },
      ops.directorEnabled,
      ops.model,
      db,
    );
    if (decision.disposition !== "authorized") {
      return unavailable(
        decision.disposition === "unavailable" || decision.disposition === "provider-unavailable"
          ? "temporarily-unavailable"
          : decision.disposition === "operator-paused"
            ? "model-unavailable"
            : "external-ai-not-authorized",
      );
    }

    return {
      status: "available",
      agent: { agentId, name },
      mandate: {
        revision: mandate.mandate.mandateRevision,
        purpose: mandate.mandate.purpose,
        proposalScope: [...mandate.mandate.proposalScope],
      },
      originable: RECORD_WORK_ORIGINATION_ALIAS,
      workScopes,
    };
  } catch {
    return unavailable("temporarily-unavailable");
  }
}
