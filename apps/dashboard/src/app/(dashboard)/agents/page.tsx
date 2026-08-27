import { PageHeader } from "@/components/layout/page-header";
import { AgentsTruthSurface } from "@/components/agents/agents-truth-surface";
import {
  DurableAgentIdentityCard,
  type DurableIdentityBlock,
} from "@/components/agents/durable-agent-identity-card";
import { getAgentsTruthModel } from "@/features/workforce/agents-truth-model";
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";
import { readDurableAgentIdentityState } from "@/features/agent-identity/read-durable-agent-identity.server";

export const metadata = { title: "Agents — Hebun AI" };

/*
 * Agents — the authoritative Workforce surface (UI Phase 25B truth pass; AGENT-ID-0.1 durable pass).
 *
 * Workforce = WHO can perform work. This surface presents agent DEFINITIONS honestly:
 * a seeded, in-memory registry over the "memory" persistence provider, runtime "simulation".
 * It does NOT present seeded activity (tasks / cost / last-active / live status) as live
 * organizational truth, renders no pulsing "online" indicator, and implies no execution.
 * Neighbouring authority is not absorbed: execution → Operations, human authority → Decisions,
 * providers/models → Platform, memory → Knowledge. The real in-memory definition CRUD
 * (Command Bus, no database write) remains, explicitly framed inside the surface.
 *
 * ── WHAT AGENT-ID-0.1 ADDED, AND WHY IT SITS ABOVE EVERYTHING ELSE ───────────
 *
 * Exactly one thing on this page writes a canonical database row: the durable agent identity
 * ceremony. It is rendered FIRST, and the simulation below it now names itself at every control it
 * offers, so a reader is never choosing between two affordances that both look like "create a real
 * agent". Those are two different authorities and they must not be mistakable for each other:
 *
 *   durable identity   →  `features/agent-identity`, canonical Postgres, one per organization
 *   definition registry →  `features/agent-crud`, in-memory, per-process, writes no row
 *
 * The simulation is NOT promoted, NOT routed to the durable authority, and NOT removed. Its
 * capability is intact; only its labelling changed, because the defect was that it read as real.
 *
 * The tenant and the human are resolved SERVER-SIDE and passed as identifiers only. An
 * unauthenticated visitor sees an honest sign-in state; an unreachable control plane is reported as
 * UNKNOWN rather than as "no identity exists".
 */

export default async function AgentsPage() {
  const model = getAgentsTruthModel();
  const tenant = await resolveTenantContext();
  const identityState = await readDurableAgentIdentityState(tenant);

  /*
   * The two blocked reasons are distinct facts. `unauthenticated` is about the reader;
   * `authority-unavailable` is about the control plane. Neither is ever rendered as "none exists".
   */
  const block: DurableIdentityBlock | undefined = !tenant
    ? { kind: "unauthenticated" }
    : identityState.status === "unavailable"
      ? { kind: "authority-unavailable" }
      : undefined;

  return (
    <>
      <PageHeader
        title="Agents"
        context={`${model.seededDefinitionCount} seeded agent definitions · in-memory registry · runtime ${model.runtimeMode}`}
      />
      <div className="flex flex-col gap-6">
        <DurableAgentIdentityCard
          block={block}
          actingHumanId={tenant?.userId}
          tenantId={tenant?.tenantId}
          genesisSpent={identityState.status === "known" ? identityState.genesisSpent : false}
          identities={identityState.status === "known" ? identityState.identities : []}
        />
        <AgentsTruthSurface model={model} />
      </div>
    </>
  );
}
