import { PageHeader } from "@/components/layout/page-header";
import { AgentsTruthSurface } from "@/components/agents/agents-truth-surface";
import {
  DurableAgentIdentityCard,
  type DurableIdentityBlock,
} from "@/components/agents/durable-agent-identity-card";
import { getAgentsTruthModel } from "@/features/workforce/agents-truth-model";
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";
import { readDurableAgentIdentityState } from "@/features/agent-identity/read-durable-agent-identity.server";
import {
  AgentMandateCard,
  type AgentMandateEntry,
  type MandateBlock,
} from "@/components/agents/agent-mandate-card";
import {
  readAgentMandateHistory,
  readEffectiveAgentMandate,
} from "@/features/agent-mandate/read-agent-mandate.server";
import { AgentOutcomeObservationSurface } from "@/components/agents/agent-outcome-observation";
import { readAgentOutcomeObservation } from "@/features/agent-outcome-observation/agent-outcome-projection.server";
import { AgentEvaluationSurface } from "@/components/agents/agent-evaluation";
import { deriveAgentEvaluationRead } from "@/features/agent-evaluation/agent-evaluation-projection.server";
import { AgentImprovementHypothesisSurface } from "@/components/agents/agent-improvement-hypothesis";
import { readImprovementHypotheses } from "@/features/agent-improvement-hypothesis/read-improvement-hypotheses.server";
import {
  AgentImprovementHypothesisFiling,
  type HypothesisFilingBlock,
} from "@/components/agents/agent-improvement-hypothesis-filing";

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
   * SIA-3 reads its own durable rows, so this IS a second read — unavoidably, because a hypothesis
   * is a stored record rather than something derivable from the observation. What it must never do
   * is re-derive the evidence: each row carries the snapshot it was filed against, so this card and
   * the two above it can differ and BOTH be right, which is exactly what a timestamped baseline is
   * for.
   */
  const hypotheses = await readImprovementHypotheses(tenant);

  /*
   * The two blocked reasons are distinct facts. `unauthenticated` is about the reader;
   * `authority-unavailable` is about the control plane. Neither is ever rendered as "none exists".
   */
  const block: DurableIdentityBlock | undefined = !tenant
    ? { kind: "unauthenticated" }
    : identityState.status === "unavailable"
      ? { kind: "authority-unavailable" }
      : undefined;

  /*
   * SIA-3.1's filing seam is offered only when there is something honest to file ABOUT: an
   * authenticated reader, and at least one durable agent still in service. A retired agent is not
   * a subject — proposing a change to something withdrawn from service changes nothing, and the
   * writer refuses it — so an organization whose only agent is retired is told that plainly rather
   * than being offered a control every use of which would be refused.
   *
   * An unreachable identity authority yields NO agents here, and the block below says "none is in
   * service", which would be a fabricated absence — so it is gated on `status === "known"` and an
   * unavailable authority falls to the same honest sentence the card above it already shows.
   */
  const identities = identityState.status === "known" ? identityState.identities : [];
  /*
   * AMA-3 — each durable agent's recorded ceiling, read through the mandate authority's own seams.
   *
   * READ PER AGENT, AND THE THREE ANSWERS ARE KEPT APART. `readEffectiveAgentMandate` returns
   * `known + mandate`, `known + null`, or `unavailable`, and this page carries all three down
   * unmerged. Collapsing the last two would tell a human, on a database outage, that their
   * organization had declined to bound its agent.
   *
   *     NO MANDATE  != UNLIMITED MANDATE
   *     UNAVAILABLE != NO MANDATE
   */
  const mandateEntries: AgentMandateEntry[] = [];
  for (const identity of identities) {
    const effective = await readEffectiveAgentMandate(tenant, identity.agentId);
    if (effective.status === "unavailable") {
      mandateEntries.push({
        identity,
        standing: { kind: "unavailable", reason: effective.reason },
      });
      continue;
    }
    /*
     * History is read only when a mandate exists — an agent nobody has bounded has no chain, and
     * asking for one would render an empty list that reads like "there were no earlier revisions"
     * when the honest answer is "there is no mandate at all".
     */
    const history = effective.mandate
      ? await readAgentMandateHistory(tenant, identity.agentId)
      : null;
    mandateEntries.push({
      identity,
      standing: {
        kind: "known",
        effective: effective.mandate,
        history: history?.status === "known" ? history.revisions : [],
      },
    });
  }

  const mandateBlock: MandateBlock | undefined = !tenant
    ? { kind: "unauthenticated" }
    : identityState.status !== "known"
      ? { kind: "identity-authority-unavailable" }
      : identities.length === 0
        ? { kind: "no-durable-agent" }
        : undefined;

  const filingBlock: HypothesisFilingBlock | undefined = !tenant
    ? { kind: "unauthenticated" }
    : identityState.status !== "known" || identities.every((identity) => !identity.inService)
      ? { kind: "no-agent-in-service" }
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
          identities={identities}
        />
        {/*
          * AMA-3 sits directly BELOW the identity ceremony and ABOVE everything derived, because
          * that is the order of the facts: an agent exists, then the organization records what it
          * is FOR, and only then is there anything to observe about what it proposed. It is the
          * second thing on this page that writes a database row, and the only other one.
          */}
        <AgentMandateCard block={mandateBlock} entries={mandateEntries} />
        <AgentOutcomeObservationSurface observation={outcomes} />
        <AgentEvaluationSurface evaluation={evaluation} />
        <AgentImprovementHypothesisSurface hypotheses={hypotheses} />
        {/*
         * SIA-3.1's filing control sits BELOW the record it writes into, deliberately. The two
         * cards above are the preparation — an observation and what SIA-2 derived from it — and
         * the hypothesis list above this one is what has already been filed. Reading comes before
         * writing on this page, and the order says so.
         *
         * It is a SEPARATE component from the hypothesis surface: that surface remains a server
         * component with no client boundary and nothing imported that could mutate, which is a
         * released proof worth keeping intact.
         */}
        <AgentImprovementHypothesisFiling block={filingBlock} identities={identities} />
        <AgentsTruthSurface model={model} />
      </div>
    </>
  );
}
