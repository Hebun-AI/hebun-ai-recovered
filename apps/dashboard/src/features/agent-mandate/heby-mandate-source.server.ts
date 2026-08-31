/*
 * agent-mandate/heby-mandate-source.server.ts — THE AGENT MANDATE AUTHORITY'S read projection of
 * itself, shaped for Heby grounding (AMA-3).
 *
 * ── WHY IT LIVES ON THIS SIDE OF THE BOUNDARY ────────────────────────────────
 *
 * G6C settled it, E2-1 followed it and E2-5 restated it: a projection belongs to the authority that
 * owns the facts, and the consumer imports the projection. So this file sits inside the mandate
 * authority, and Heby imports one function from it. Heby therefore never holds `agentMandates`,
 * never holds a database handle for mandate truth, and — the part that matters most here — never
 * holds `establishAgentMandate`.
 *
 * ── READ-ONLY, AND PROVABLY ──────────────────────────────────────────────────
 *
 * This module contains no insert, no update, no delete and no transaction, and it imports the READ
 * SEAM MODULE rather than the feature barrel. The barrel re-exports the writer; importing it would
 * put a Governance-bound mandate writer into Heby's import graph for the sake of a read, which is
 * the defect G6C repaired in that same graph and AMA-2 refused in the proposal writer's.
 *
 *     HEBY GROUNDS ON A MANDATE != HEBY HAS A MANDATE WRITER
 *
 * ── WHY A NEW CLASS, AND WHY NOT `agents` ────────────────────────────────────
 *
 * `agents` (E2-5) was the obvious-looking home and it is the wrong one, for a reason that file
 * states about itself: it is DERIVED — `authoritative: false` — because it carries eight recomputed
 * counts, and `SourceResolution.authoritative` is ONE boolean for a whole class, so "a class cannot
 * assert one standing and cite under another".
 *
 * A mandate is not derived. It is a durable, versioned, Governance-bound record that a human wrote,
 * and it is exactly as authoritative as the Governance decision that authorized it. Folding it into
 * `agents` would file the organization's own written statement of an agent's purpose under the same
 * standing as a recomputed count — understating the one thing on this page a human actually
 * decided.
 *
 * And the second reason is the one this repository has used for every class since `work-artifacts`:
 * A DIFFERENT AUTHORITY OWNER. Agent Outcome Observation owns what became of what an agent
 * proposed; Agent Mandate Authority owns what it may propose at all. Adding a class widens a
 * contract over an authority that was already released; it creates no authority.
 *
 *     RECORDED MANDATE  != DERIVED OBSERVATION
 *     NEW SOURCE CLASS  != NEW AUTHORITY
 *
 * ── WHAT IT MAY SAY, AND THE FIVE THINGS IT MAY NOT ──────────────────────────
 *
 * A mandate is a CEILING. AMA-1 froze the list of things it never means, and this module carries
 * that list into the model's context rather than trusting a prompt to remember it. Heby may say
 * "my current mandate allows me to propose X"; it may never say it is authorized to execute X, has
 * permission to perform X, can act without approval, holds Governance authority, or that everything
 * technically available to it is therefore permitted.
 *
 *     IN MANDATE   != AUTHORIZED
 *     IN MANDATE   != A PERMIT
 *     IN MANDATE   != EXECUTION
 *     NO MANDATE   != UNLIMITED MANDATE
 *     UNAVAILABLE  != NO MANDATE
 *
 * ── THREE ANSWERS, KEPT APART ────────────────────────────────────────────────
 *
 * The read seam's own three states survive into grounding unmerged: a mandate exists, no mandate
 * exists, or the authority could not be reached. Collapsing the last two would let Heby state, on a
 * database outage, that its organization had declined to bound it — the fabricated absence this
 * repository has repaired more than once, and here it would be Heby fabricating it about itself.
 *
 * ── WHAT IT STRUCTURALLY CANNOT SAY ──────────────────────────────────────────
 *
 * No credential, no secret, no provider payload, no model configuration, no permission row, no
 * role, no department, no manager, no `authority_ceiling`. Not because each is filtered here, but
 * because the released read seam carries none of them to filter.
 *
 * Server-only.
 */
import type { ResolvedSourceItem, SourceResolution } from "@/features/heby-runtime/contracts";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  readDurableAgentIdentityState,
  type DurableAgentIdentityRecord,
} from "@/features/agent-identity/read-durable-agent-identity.server";
import {
  readAgentMandateHistory,
  readEffectiveAgentMandate,
  type AgentMandateRevision,
} from "./read-agent-mandate.server";
import { MANDATE_DOES_NOT_MEAN, MANDATE_SCOPE_VOCABULARY } from "./contracts";

/**
 * Named for what it is, and for what it is not.
 *
 * A reader who sees this line must not conclude that Hebun has granted the agent anything. It
 * states the maximum surface inside which the agent may PROPOSE, and stops.
 */
export const AGENT_MANDATE_GROUNDING_PROVENANCE =
  "Agent Mandate Authority — this organization's recorded statement of what each durable agent is " +
  "FOR and the maximum surface inside which it may PROPOSE, read tenant-scoped from the session " +
  "and authoritative (authoritative: true). Each revision was written by a human under a bound " +
  "Governance decision and is never edited; the effective one is the highest revision. A mandate " +
  "is a CEILING and grants nothing: it carries no permission, no permit, no execution authority " +
  "and no Governance authority, and it can only ever SUBTRACT from what the agent could already " +
  "propose. It carries no credential, no provider configuration and no capability list, because " +
  "no authority for any of them is read here.";

/**
 * The refusal carried on the mandate item, held as its own constant.
 *
 * IT NAMES THE CLAIMS IT FORBIDS, which is what makes it useful to a model and what makes a
 * vocabulary ban fail on it. E2-4 through E2-8 each recorded that collision and AMA-2 recorded it
 * again on a refusal NAME; the settled remedy is to pin the denial BY EQUALITY and run any word ban
 * over only what the source CLAIMS. Keeping it separately named is what lets a test do both.
 */
export const AGENT_MANDATE_NON_CLAIM =
  "A mandate is the ceiling on what this agent may PROPOSE. It is not permission, not " +
  "authorization, not a permit, not execution authority and not Governance authority: every " +
  "proposal inside it still requires a human decision, and nothing inside it may run without one.";

/** What a mandate never means, carried with the record rather than left to a surface to remember. */
export const AGENT_MANDATE_NON_CLAIMS: readonly string[] = MANDATE_DOES_NOT_MEAN;

/**
 * The measured absence. An established fact about Hebun's records, and NOT a permission.
 *
 * The sentence must survive being read alone, because that is how a sentence reaches a model. So it
 * states the consequence — this agent may propose nothing — rather than leaving "no mandate" to be
 * completed by whoever reads it.
 */
export const AGENT_MANDATE_ABSENT_STATEMENT =
  "No mandate has been established for this agent. Hebun looked and found none — a measured " +
  "absence in this organization's records, never a permission: an agent with no mandate may " +
  "propose NOTHING, and its proposals are refused before anything is written.";

/** The withdrawal statement. An empty ceiling is a decision, and it reads as one. */
export const AGENT_MANDATE_WITHDRAWN_STATEMENT =
  "This mandate admits no action kinds. The organization recorded an empty ceiling, which is how " +
  "withdrawal is expressed — this agent may currently propose nothing, by decision rather than by " +
  "absence.";

export interface AgentMandateGroundingDeps {
  readonly readIdentities?: typeof readDurableAgentIdentityState;
  readonly readEffective?: typeof readEffectiveAgentMandate;
  readonly readHistory?: typeof readAgentMandateHistory;
}

function base(
  state: SourceResolution["state"],
  items: readonly ResolvedSourceItem[],
  unavailableReason?: string,
): SourceResolution {
  return {
    sourceClass: "agent-mandate",
    state,
    provenance: AGENT_MANDATE_GROUNDING_PROVENANCE,
    /*
     * TRUE, and the reason is the inverse of E2-5's. `agent_mandates` IS the record — every field
     * cited below is a stored column of a row a human wrote under a Governance decision, not a
     * figure recomputed on read. G6C's `governance` class declares `true` on exactly this basis.
     */
    authoritative: true,
    items,
    ...(unavailableReason === undefined ? {} : { unavailableReason }),
  };
}

const plural = (n: number, one: string, many = `${one}s`): string => (n === 1 ? one : many);

/** The scope, as prose that cannot be read as a grant. */
function scopeSentence(scope: readonly string[]): string {
  if (scope.length === 0) return AGENT_MANDATE_WITHDRAWN_STATEMENT;
  return (
    `May propose: ${scope.join(", ")} — ${scope.length} of ` +
    `${MANDATE_SCOPE_VOCABULARY.length} ${plural(MANDATE_SCOPE_VOCABULARY.length, "action kind")} ` +
    "this runtime admits for agent origination. Anything outside this list is refused before a " +
    "proposal is written."
  );
}

/**
 * One agent's effective mandate, as a grounding item.
 *
 * The PURPOSE is operator-authored prose, so it travels in `content` and never in `detail` —
 * E2-6's settled rule. `detail` flows into Heby's own validated response body, and a purpose
 * sentence that happened to read like a claim would become a sentence Heby appeared to be making.
 */
function effectiveItem(
  identity: DurableAgentIdentityRecord,
  mandate: AgentMandateRevision,
): ResolvedSourceItem {
  return {
    recordRef: `agent-mandate/${mandate.mandateId}`,
    label: `${identity.name} — effective mandate, revision ${mandate.mandateRevision}`,
    detail:
      `${scopeSentence(mandate.proposalScope)} ` +
      `Effective from ${mandate.effectiveFrom}, established by a human under Governance decision ` +
      `${mandate.governanceDecisionId} in session ${mandate.governanceSessionId}` +
      (mandate.supersedesMandateId === null
        ? ", and it is the first revision recorded for this agent"
        : `, superseding mandate ${mandate.supersedesMandateId}`) +
      `. The agent is ${identity.inService ? "in service" : "retired from service"}. ` +
      AGENT_MANDATE_NON_CLAIM,
    lifecycle: "settled",
    content: `recorded purpose: ${mandate.purpose}`,
  };
}

/** An agent nobody has bounded. A real answer, and never an unlimited one. */
function absentItem(identity: DurableAgentIdentityRecord): ResolvedSourceItem {
  return {
    recordRef: `agent-mandate:absent:${identity.agentId}`,
    label: `${identity.name} — no mandate recorded`,
    detail: `${AGENT_MANDATE_ABSENT_STATEMENT} ${AGENT_MANDATE_NON_CLAIM}`,
    lifecycle: "settled",
  };
}

/**
 * A superseded revision. Readable forever, and labelled as no longer effective.
 *
 * `lifecycle: "superseded"` is the retrieval layer's own vocabulary for exactly this, so a past
 * ceiling can never be cited as the current one.
 */
function historyItem(
  identity: DurableAgentIdentityRecord,
  revision: AgentMandateRevision,
): ResolvedSourceItem {
  return {
    recordRef: `agent-mandate/${revision.mandateId}`,
    label: `${identity.name} — superseded mandate, revision ${revision.mandateRevision}`,
    detail:
      `No longer effective. While it stood: ${scopeSentence(revision.proposalScope)} ` +
      `Effective from ${revision.effectiveFrom} under Governance decision ` +
      `${revision.governanceDecisionId}. Recorded revisions are never edited, so this is what was ` +
      "authorized at the time.",
    lifecycle: "superseded",
    content: `recorded purpose at revision ${revision.mandateRevision}: ${revision.purpose}`,
  };
}

/**
 * Read this tenant's durable agents and their recorded mandates, for Heby grounding.
 *
 * Tenant-scoped through the two released read seams — this module passes the server-resolved
 * context straight through and constructs no query. There is no parameter by which a caller could
 * name another tenant or another organization's agent, so those are not refused here; they are
 * UNREPRESENTABLE.
 *
 * THE IDENTITY AUTHORITY IS CONSULTED FIRST, and its unavailability is reported as its own outage.
 * A tenant whose agents could not be read has an unknown mandate, not an absent one.
 */
export async function readAgentMandateGroundingSource(
  tenant: TenantContext | null,
  deps: AgentMandateGroundingDeps = {},
): Promise<SourceResolution> {
  if (typeof window !== "undefined") {
    throw new Error("Agent mandate grounding reads are server-only.");
  }
  if (!tenant?.tenantId) {
    return base("unavailable", [], "no-authorized-tenant-context");
  }

  const readIdentities = deps.readIdentities ?? readDurableAgentIdentityState;
  const readEffective = deps.readEffective ?? readEffectiveAgentMandate;
  const readHistory = deps.readHistory ?? readAgentMandateHistory;

  const identityState = await readIdentities(tenant);
  if (identityState.status === "unavailable") {
    return base(
      "unavailable",
      [],
      "The durable agent identity authority could not be reached, so which agents exist — and " +
        "therefore what any of them is bounded to — is unknown. This is an unread state, never a " +
        "statement that this organization has no agents or no mandates.",
    );
  }

  if (identityState.identities.length === 0) {
    /*
     * RESOLVED, NOT UNAVAILABLE. Hebun looked and this organization has established no durable
     * agent. That is a real, measured answer about the organization, and reporting it as an outage
     * would be the mirror of the fabricated absence this class exists to avoid.
     */
    return base("resolved", [
      {
        recordRef: "agent-mandate:no-durable-agent",
        label: "No durable agent has been established",
        detail:
          "This organization has established no durable agent identity, so there is nothing for a " +
          "mandate to bound. Establishing an agent grants it nothing on its own: an agent with no " +
          "mandate may propose NOTHING. " +
          AGENT_MANDATE_NON_CLAIM,
        lifecycle: "settled",
      },
    ]);
  }

  const items: ResolvedSourceItem[] = [];

  for (const identity of identityState.identities) {
    const effective = await readEffective(tenant, identity.agentId);
    if (effective.status === "unavailable") {
      /*
       * ONE AGENT'S AUTHORITY WENT DARK. The whole class reports unavailable rather than listing
       * the others and silently omitting this one — a partial list read as complete is how "no
       * mandate" gets manufactured from an outage.
       */
      return base(
        "unavailable",
        [],
        `The mandate authority could not be read for ${identity.name}, so this organization's ` +
          "recorded ceilings are unknown. UNAVAILABLE is not NO MANDATE: nothing here says a " +
          "mandate does or does not exist.",
      );
    }

    if (!effective.mandate) {
      items.push(absentItem(identity));
      continue;
    }

    items.push(effectiveItem(identity, effective.mandate));

    /*
     * HISTORY IS ADDITIONAL, NEVER LOAD-BEARING. A history read that fails leaves the effective
     * mandate — the answer to "what may you propose" — intact, so it is not escalated to an outage
     * of the class. What it must never do is quietly look like "there were no earlier revisions",
     * so nothing is appended when it could not be read.
     */
    const history = await readHistory(tenant, identity.agentId);
    if (history.status !== "known") continue;
    for (const revision of history.revisions) {
      if (revision.mandateRevision === effective.mandate.mandateRevision) continue;
      items.push(historyItem(identity, revision));
    }
  }

  return base("resolved", items);
}
