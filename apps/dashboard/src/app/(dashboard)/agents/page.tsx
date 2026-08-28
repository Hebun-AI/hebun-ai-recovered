import { PageHeader } from "@/components/layout/page-header";
import { AgentsTruthSurface } from "@/components/agents/agents-truth-surface";
import {
  DurableAgentIdentityCard,
  type DurableIdentityBlock,
} from "@/components/agents/durable-agent-identity-card";
import { getAgentsTruthModel } from "@/features/workforce/agents-truth-model";
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";
import { readDurableAgentIdentityState } from "@/features/agent-identity/read-durable-agent-identity.server";
import { AgentOutcomeObservationSurface } from "@/components/agents/agent-outcome-observation";
import { readAgentOutcomeObservation } from "@/features/agent-outcome-observation/agent-outcome-projection.server";
import { AgentEvaluationSurface } from "@/components/agents/agent-evaluation";
import { deriveAgentEvaluationRead } from "@/features/agent-evaluation/agent-evaluation-projection.server";

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
 *
 * ── WHAT SELF-IMPROVING-AGENTS-1 ADDED, AND WHY IT SITS BELOW THE CEREMONY ───
 *
 * The Agent Outcome Observation surface answers, per durable agent, "what happened to what this
 * agent proposed" — composed entirely from records released phases already wrote. It is a READ: it
 * offers no control, and it is rendered BELOW the ceremony because the ceremony is the only thing
 * on this page that acts. Order encodes that: act first, observe second.
 *
 * It observes and measures. It does not evaluate, score, learn, adapt, or change any agent's
 * configuration, and there is no surface here through which it could.
 *
 * ── AND WHAT SELF-IMPROVING-AGENTS-2 ADDED BELOW IT ──────────────────────────
 *
 * The Agent Evaluation surface interprets that same observation — derived from it PURELY, with no
 * second read, so the two cards cannot disagree. Its derived figures are COVERAGE measures about
 * Hebun's own records, never grades: there is no score, no percentage, and no representation in
 * which either could be expressed. It names the dimensions it cannot answer rather than omitting
 * them, and it offers no control.
 */

export default async function AgentsPage() {
  const model = getAgentsTruthModel();
  const tenant = await resolveTenantContext();
  const identityState = await readDurableAgentIdentityState(tenant);
  /*
   * An unauthenticated reader is not asked about; the projection would refuse anyway, and this
   * keeps the surface's "unavailable" state meaning what it says — a store that did not answer.
   */
  const outcomes = await readAgentOutcomeObservation(tenant);
  /*
   * SIA-2 derives from the SAME observation, purely. Reading twice would double SIA-1's six
   * statements and let the two cards disagree on one page, because each read is its own instant.
   */
  const evaluation = deriveAgentEvaluationRead(outcomes);

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
        <AgentOutcomeObservationSurface observation={outcomes} />
        <AgentEvaluationSurface evaluation={evaluation} />
        <AgentsTruthSurface model={model} />
      </div>
    </>
  );
}
