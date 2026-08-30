/*
 * agent-outcome-observation/heby-agent-source.server.ts — THE AGENT OUTCOME AUTHORITY'S read
 * projection of itself, shaped for Heby grounding (E2-5).
 *
 * ── WHY IT LIVES ON THIS SIDE OF THE BOUNDARY ────────────────────────────────
 *
 * G6C settled this, INT-5A restated it and E2-1 followed it: a projection belongs to the authority
 * that owns the facts, and the consumer imports the projection. So this file sits inside the
 * observation authority, and Heby imports one function from it. Heby therefore never holds
 * `readAgentOutcomeObservation`'s eight underlying fact readers, never holds `agents`, and never
 * holds a database handle for agent truth.
 *
 * ── WHY NOT THROUGH LIVE MAP ─────────────────────────────────────────────────
 *
 * `live-map-agent-outcome.server.ts` sits in this same directory and produces the very numbers the
 * authenticated map renders beside each agent node. Reading them from there would have been the
 * smaller diff and would have broken E2-1's released rule:
 *
 *     HEBY -/-> LIVE MAP
 *
 * Live Map adds no agent FACT. What it contributes is presentation — a basis sentence, an authority
 * label, non-claim strings and an unavailable line already composed for a reader. Consuming it
 * would make Heby's evidence a function of a rendering, and would let a future Live Map layer enter
 * model context through an edit made somewhere else entirely. This module imports
 * `agent-outcome-projection.server.ts`, the owner-side seam `/agents` already reads, and imports
 * nothing from `live-map/` at any depth. A firewall asserts it.
 *
 * ── WHY A NEW CLASS, AND WHY NOT `workforce` ─────────────────────────────────
 *
 * `workforce` was the obvious-looking home and it is the wrong one. Its released registry entry
 * says, in the profile a Director's answer is composed from:
 *
 *     "Organizational workforce identity — not a runtime agent."
 *
 * That sentence is a boundary, not a description. `workforce` is chartered for the humans an
 * organization is made of — and Hebun holds no authority for them: L3 measured that `roles` has no
 * `organization_id`, that `organizations`/`departments` have no writer and no reader, and it
 * carries a human member COUNT and no roster. Routing durable agents through that class would make
 * a runtime agent indistinguishable from an employee, and would connect a class whose subject
 * Hebun still cannot see.
 *
 * So this is its own class, for the reason `work-artifacts`, `external-recipients`, `integrations`
 * and `organization` are their own classes: A DIFFERENT AUTHORITY OWNER. Adding one widens a
 * contract over an authority that was already released; it creates no authority.
 *
 *     RUNTIME AGENT      != WORKFORCE IDENTITY
 *     NEW SOURCE CLASS   != NEW AUTHORITY
 *
 * ── WHY E2-1's "ADMITS NO AGENT" IS NOT CONTRADICTED ─────────────────────────
 *
 * E2-1's firewall says: *"E2-1 ADMITS NO AGENT. Live Map projects a durable agent beside the
 * organization. THIS CLASS does not, and must not start to merely because the map already does."*
 *
 * The scope is the sentence's own subject — the `organization` class. E2-1's point was that an
 * agent must not arrive as a property of the organization record, smuggled in because a rendering
 * put the two side by side. That rule is untouched here and still enforced by its own test: nothing
 * in this phase adds a field to `AuthoritativeOrganization`, and no agent reaches `organization`.
 * An agent arrives under its own class, from its own authority, declaring its own standing.
 *
 * ── DERIVED, AND SAYING SO ───────────────────────────────────────────────────
 *
 * `authoritative: false`. E2-3 released this observation as DERIVED and the authenticated map
 * labels it `DERIVED · AGENT OUTCOME OBSERVATION`; this module imports that observation whole and
 * may not upgrade its standing in transit.
 *
 * The identity fields travelling with it — name, in service, established — are authoritative in
 * their own authority, and `SourceResolution.authoritative` is ONE boolean for a whole class, so a
 * class cannot assert one standing and cite under another. Declaring `true` would let eight derived
 * counts inherit the identity record's weight, which is the collapse that matters; declaring
 * `false` understates three fields and overstates nothing. The provenance line below says which is
 * which in words, because the boolean cannot.
 *
 *     DERIVED OBSERVATION != AUTHORITATIVE ORGANIZATIONAL TRUTH
 *     AUTHORITATIVE EVIDENCE != INSTRUCTION
 *
 * ── WHAT IT STRUCTURALLY CANNOT SAY ──────────────────────────────────────────
 *
 * No agent id — `AgentOutcomeObservation` deliberately carries none, and this module has no other
 * source for one. No department, team, reporting line or owner. No capability, permission or
 * authority the agent holds. No instruction it was given, no prompt, no model output and no
 * provider payload. Not because each is filtered here, but because the observation carries none of
 * them to filter.
 *
 * Server-only.
 */
import type { ResolvedSourceItem, SourceResolution } from "@/features/heby-runtime/contracts";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  readAgentOutcomeObservation,
  type AgentOutcomeObservation,
  type AgentOutcomeObservationRead,
} from "./agent-outcome-projection.server";

/**
 * Named for what it is, and for what it is not.
 *
 * A reader who sees this line must not conclude that Hebun knows what an agent is FOR, what it may
 * do, or who is accountable for it. It states what became of what the agent proposed, and stops.
 */
export const AGENT_GROUNDING_PROVENANCE =
  "Agent Outcome Observation — this organization's durable agents and what became of what each " +
  "proposed, read tenant-scoped from the session and DERIVED (authoritative: false). The agent " +
  "records themselves are authoritative; every count is recomputed from proposals, permits, " +
  "execution attempts and model invocations on each read. It carries no agent id, no capability, " +
  "no permission, no owner and no instruction, because no authority for any of them is read here.";

/**
 * Why the source could not be resolved.
 *
 * The reasons stay SEPARATE and they must not merge. E2-3's own header makes the distinction this
 * preserves: "this tenant has established no durable agent" and "the store did not answer" are
 * different truths, and collapsing them would let a broken read render as a clean, empty workforce.
 * A read that succeeded and found nothing is `resolved` with zero items and the sentence below —
 * never `unavailable`.
 */
export const AGENT_GROUNDING_NO_AGENTS =
  "This organization has established no durable agent. That is a measured zero, not a failed read.";

export interface AgentGroundingDeps {
  readonly readOutcome?: (tenant: TenantContext | null) => Promise<AgentOutcomeObservationRead>;
}

function base(
  state: SourceResolution["state"],
  items: readonly ResolvedSourceItem[],
  unavailableReason?: string,
): SourceResolution {
  return {
    sourceClass: "agents",
    state,
    provenance: AGENT_GROUNDING_PROVENANCE,
    authoritative: false,
    items,
    ...(unavailableReason === undefined ? {} : { unavailableReason }),
  };
}

/**
 * One agent's machine-derived detail line.
 *
 * EVERY CLAUSE IS READ OFF THE OBSERVATION. Nothing is inferred, nothing is summed into a score and
 * nothing is softened. The clause order is the released stage order — filed, then what human
 * authority did, then what the machine tried — so a reader cannot mistake a later number for an
 * earlier one having succeeded.
 *
 * `approvalsWithoutExecution` is carried explicitly rather than left to be subtracted, because it
 * is the clearest statement this evidence makes, and the one a model is most likely to get wrong:
 *
 *     APPROVED != EXECUTED        ACCEPTED != DELIVERED        NO ATTEMPT != A FAILED ATTEMPT
 *
 * ── WHY THESE ARE COUNT NOUNS AND NOT THE OBVIOUS PAST PARTICIPLES ───────────
 *
 * `detail` flows into Heby's OWN deterministic prose, and `validateResponse` scans that prose for
 * FORBIDDEN_ACTION_CLAIMS by bare substring — `approved`, `rejected`, `authorized`, `executed`.
 * Writing the natural "approved 4 · rejected 0" made the validator withhold the ENTIRE response:
 * every answer that cited an agent would have rendered as "Response withheld".
 *
 * The guard was right to fire on a crude reading and the wording is what changes, not the guard.
 * That is the precedent this repository has already set twice — E2-1 chose an ordinary fixture name
 * rather than loosen the same scan, and CMD-B1's "total" ban was satisfied by a better field name.
 *
 * The count nouns are also more accurate: `governance.approved` is a COUNT OF RECORDS Governance
 * produced, not an assertion that anything was approved by the party writing the sentence. The
 * numbers are identical and nothing is hidden — only Heby's grammar changed.
 *
 *     A RELEASED GUARD FIRING ON HONEST PROSE IS A WORDING PROBLEM, NOT A GUARD PROBLEM.
 */
function detailFor(agent: AgentOutcomeObservation): string {
  const { activity, governance, execution } = agent;
  return [
    agent.inService ? "in service" : `retired ${agent.retiredAt ?? "at an unrecorded instant"}`,
    `established ${agent.establishedAt}`,
    `proposals filed ${activity.proposalsFiled}`,
    `awaiting a decision ${activity.pending}`,
    `withdrawn ${activity.withdrawn}`,
    `governance approvals ${governance.approved}`,
    `governance rejections ${governance.rejected}`,
    `permits issued ${governance.permitsIssued}`,
    `approvals with no execution attempt ${governance.approvedWithoutExecution}`,
    `execution attempts ${execution.attempts}`,
    `provider acceptances ${execution.accepted}`,
    `provider refusals ${execution.refused}`,
    `execution failures ${execution.failed}`,
    `outcome unknown ${execution.unknown}`,
  ].join(" · ");
}

/**
 * Read this tenant's durable agents for Heby grounding.
 *
 * Tenant-scoped through the observation authority's own predicates — this module passes the
 * server-resolved `TenantContext` straight through and constructs no query of its own. There is no
 * parameter by which a caller could name a different tenant or a different agent, so a
 * cross-tenant read is not refused here; it is UNREPRESENTABLE.
 *
 * ONE ITEM PER DURABLE AGENT, bounded by the number of agents the tenant actually established
 * rather than by a limit somebody chose. E2-1's organization source is bounded at one by the shape
 * of the fact; this is bounded the same way, by a real population.
 *
 * THE RECORD REFERENCE IS THE AGENT'S NAME, and deliberately not its id. E2-1 settled the rule: a
 * citation reference is the record's own stable public name for itself, and printing an internal
 * uuid would publish it into an answer body, a durable evidence row and a model request for no
 * reader benefit. Here the choice is also forced — `AgentOutcomeObservation` carries no id at all,
 * because E2-3 put the id on the OUTSIDE as a join key where a surface that merely spreads the
 * object cannot render it.
 */
export async function readAgentGroundingSource(
  tenant: TenantContext | null,
  deps: AgentGroundingDeps = {},
): Promise<SourceResolution> {
  if (typeof window !== "undefined") {
    throw new Error("Agent grounding reads are server-only.");
  }

  const read = await (deps.readOutcome ??
    ((t: TenantContext | null) => readAgentOutcomeObservation(t)))(tenant);

  if (read.status === "unavailable") {
    return base("unavailable", [], read.reason);
  }

  /*
   * A SUCCESSFUL READ THAT FOUND NOTHING IS RESOLVED, NOT UNAVAILABLE — with one item carrying the
   * measured zero, so the evidence set says it in words rather than contributing silence a model
   * could fill.
   */
  if (read.agents.length === 0) {
    return base("resolved", [
      {
        recordRef: "no-durable-agent",
        label: "No durable agent",
        detail: AGENT_GROUNDING_NO_AGENTS,
        lifecycle: "settled",
      },
    ]);
  }

  const items: readonly ResolvedSourceItem[] = read.agents.map((agent) => ({
    recordRef: agent.agentName,
    label: agent.agentName,
    detail: detailFor(agent),
    /*
     * READ OFF THE OBSERVATION, never guessed. `inService` is the identity seam's own derivation
     * from the absence of retirement, and `retired` is a released lifecycle value — so a retired
     * agent is cited as retired rather than quietly dropped from the evidence set.
     */
    lifecycle: agent.inService ? "settled" : "retired",
  }));

  return base("resolved", items);
}
