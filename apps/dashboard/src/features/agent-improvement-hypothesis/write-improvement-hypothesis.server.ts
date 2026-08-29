/*
 * agent-improvement-hypothesis/write-improvement-hypothesis.server.ts — THE ONE writer of an
 * Improvement Hypothesis (SIA-3).
 *
 * ── WHAT IT MAY DO ───────────────────────────────────────────────────────────
 *
 * Record that a human, holding a resolved tenant context, filed an evidence-backed hypothesis
 * about ONE durable agent's selection behaviour.
 *
 * ── WHAT IT MAY NOT DO, AND WHY NONE OF IT IS AVAILABLE HERE ─────────────────
 *
 * It cannot authorize itself: it writes no `decision_records` row, imports no Governance writer,
 * and resolves no Governance authority. It cannot mutate the agent: it imports the agent identity
 * READ seam and no agent writer, so `agents` is unreachable for update from this module. It mints
 * no permit, calls no provider, reads no credential, and writes neither Memory, Learning,
 * Knowledge nor telemetry — none of those modules is imported.
 *
 * ── THE EVIDENCE IS READ, NOT ACCEPTED ───────────────────────────────────────
 *
 * This is the single most important property of this writer.
 *
 * A caller supplies WHICH weakness it means (a closed key) and the prose of its hypothesis. It does
 * NOT supply the numbers. The writer reads them itself, at write time, through SIA-1's released
 * tenant-scoped projection, and stores what it read together with the instant it read it.
 *
 * A caller therefore cannot cite evidence that does not exist, cannot inflate a count, and cannot
 * attribute another tenant's numbers to its own agent — not because it is checked afterwards, but
 * because there is no parameter through which it could be said. Fabricated evidence is
 * unrepresentable rather than rejected.
 *
 * ── AND UNAVAILABLE EVIDENCE STAYS UNAVAILABLE ───────────────────────────────
 *
 * If the observation cannot be read, this REFUSES. It does not store zeros. "Hebun could not look"
 * and "Hebun looked and found none" are different facts, and a row claiming the second when the
 * first was true would be a fabricated absence — the defect this lineage has repaired three times.
 *
 * Server-only.
 */
import { and, eq } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { agentImprovementHypotheses } from "@/db/schema/agent-improvement-hypothesis";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { readDurableAgentIdentityState } from "@/features/agent-identity/read-durable-agent-identity.server";
/*
 * SIA-1'S OWN PER-AGENT FACT SEAMS, and not its composed projection.
 *
 * The composed `AgentOutcomeObservation` deliberately does not carry a raw agent id — a released
 * SIA-1 decision — so a hypothesis about ONE agent cannot be matched against it without either
 * matching on a display name (which nothing makes unique) or widening a released contract. Reading
 * the fact seams instead keeps SIA-1's shape exactly as it was released, adds no query of its own,
 * and leaves the durable source facts owned by SIA-1.
 */
import {
  readAgentProposalFacts,
  readAgentSelectionFacts,
  type AgentProposalFacts,
  type AgentSelectionFacts,
} from "@/features/agent-outcome-observation/read-agent-outcome-facts.server";
import {
  EVIDENCE_FINDING_KEYS,
  EVIDENCE_SOURCE,
  IMPROVEMENT_TARGETS,
  type EvidenceFindingKey,
  type ImprovementTarget,
} from "./contracts";

/* ═══════════════════════════════════════════════════════════════════════════
 * BOUNDS — stated, so a refusal is never a surprise
 * ═════════════════════════════════════════════════════════════════════════ */

/**
 * Prose bounds. Generous enough for a real argument, bounded because an unbounded text column
 * reachable from a request is a denial-of-service surface and a place to hide a payload.
 */
export const MAX_CANDIDATE_CHANGE_CHARACTERS = 2_000;
export const MAX_EXPECTED_EFFECT_CHARACTERS = 1_000;
export const MAX_LIMITATIONS_CHARACTERS = 1_000;
/** Short enough that a hypothesis cannot be argued in the field meant to bound it. */
export const MIN_PROSE_CHARACTERS = 12;

export type HypothesisRefusal =
  /** No server-resolved tenant, or no human. There is no parameter that could supply one. */
  | "unauthenticated"
  | "persistence-unavailable"
  /** The improvement target is outside the closed vocabulary. */
  | "invalid-improvement-target"
  /** The evidence key is outside the closed vocabulary. */
  | "invalid-evidence-finding"
  /** The candidate change, expected effect or limitations are missing or out of bounds. */
  | "hypothesis-prose-required"
  /**
   * The identity authority could not be reached. DISTINCT from "no such agent": telling a tenant
   * that owns an agent that it owns none would be a fabricated absence.
   */
  | "agent-identity-authority-unavailable"
  /** No durable agent with that id exists IN THIS TENANT. Another tenant's agent resolves here. */
  | "agent-unresolvable"
  /** The agent exists and has been withdrawn from service. */
  | "agent-retired"
  /**
   * The observation could not be read, so the evidence cannot be established. NEVER downgraded to
   * a hypothesis citing zero.
   */
  | "evidence-unavailable"
  /**
   * The agent has no observation this finding could be drawn from. A hypothesis resting on a zero
   * denominator is not evidence-backed; it is a guess with a citation attached.
   */
  | "no-evidence-yet"
  /** The named predecessor is not a hypothesis in this tenant. */
  | "supersedes-unresolvable";

export type HypothesisResult =
  | { readonly status: "filed"; readonly hypothesisId: string; readonly filedAt: string }
  | { readonly status: "refused"; readonly reason: HypothesisRefusal };

export interface HypothesisWriteDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly now?: () => Date;
  /** Injected only so a test can drive the released seams; production resolves them itself. */
  readonly readSelection?: typeof readAgentSelectionFacts;
  readonly readProposals?: typeof readAgentProposalFacts;
}

function refused(reason: HypothesisRefusal): HypothesisResult {
  return { status: "refused", reason };
}

function resolveDb(deps: HypothesisWriteDeps): ControlPlaneDatabase | null {
  if (deps.getDb) return deps.getDb();
  try {
    return getControlPlaneDb();
  } catch {
    return null;
  }
}

function boundedProse(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length < MIN_PROSE_CHARACTERS || trimmed.length > max) return null;
  return trimmed;
}

/**
 * The observed weakness, as a part and its whole.
 *
 * ONE mapping, and every entry points at a count SIA-1 already publishes. The pair is stored and
 * never divided: nothing here computes a rate, and `value <= total` is a database CHECK so the pair
 * can never describe an impossible observation.
 *
 * `provenance-coverage` deliberately takes the UNtraceable count as its numerator, so every entry
 * in this table means the same thing — "this many, out of this many, are the observed weakness".
 * A mapping where one row meant the opposite would make the column unreadable.
 */
function observedWeakness(
  selection: AgentSelectionFacts | undefined,
  proposals: AgentProposalFacts | undefined,
  key: EvidenceFindingKey,
): { readonly value: number; readonly total: number } {
  if (key === "provenance-coverage") {
    const withLink = proposals?.withInvocationLink ?? 0;
    const withoutLink = proposals?.withoutInvocationLink ?? 0;
    return { value: withoutLink, total: withLink + withoutLink };
  }

  /*
   * NO ROW MEANS NO ATTRIBUTED INVOCATION, which is a zero DENOMINATOR and therefore refused below
   * as "no evidence yet" — never stored as a zero numerator, which would read as a clean record.
   */
  if (!selection) return { value: 0, total: 0 };
  const total = selection.attributed;
  switch (key) {
    case "selection-invalid":
      return { value: selection.stateSelectionInvalid, total };
    case "no-action":
      return { value: selection.stateNoAction, total };
    case "dispatch-failed":
      return { value: selection.stateDispatchFailed, total };
    case "not-dispatched":
      return { value: selection.stateNotDispatched, total };
    case "outcome-unrecorded":
      return { value: selection.stateRegistered, total };
    case "filing-refused":
      return { value: selection.filingRefused, total };
    case "filing-failed":
      return { value: selection.filingFailed, total };
  }
}

/**
 * File one Improvement Hypothesis.
 *
 * The caller supplies the subject agent, the closed target and evidence keys, and its prose. It
 * cannot supply the tenant, the author, the evidence numbers, the observation instant, or the
 * timestamp — every one of those is server-derived.
 */
export async function fileImprovementHypothesis(
  tenant: TenantContext | null,
  input: {
    readonly agentId: string;
    readonly improvementTarget: string;
    readonly evidenceFindingKey: string;
    readonly candidateChange: string;
    readonly expectedEffect: string;
    readonly limitations: string;
    /** Optional lineage. Naming a predecessor withdraws nothing — see the schema comment. */
    readonly supersedesHypothesisId?: string | null;
  },
  deps: HypothesisWriteDeps = {},
): Promise<HypothesisResult> {
  if (typeof window !== "undefined") {
    throw new Error("Improvement hypotheses are server-only.");
  }
  if (!tenant?.tenantId || !tenant.userId) return refused("unauthenticated");

  /* ── The closed vocabularies, checked before anything is read. ── */
  if (!IMPROVEMENT_TARGETS.includes(input?.improvementTarget as ImprovementTarget)) {
    return refused("invalid-improvement-target");
  }
  if (!EVIDENCE_FINDING_KEYS.includes(input?.evidenceFindingKey as EvidenceFindingKey)) {
    return refused("invalid-evidence-finding");
  }
  const improvementTarget = input.improvementTarget as ImprovementTarget;
  const evidenceFindingKey = input.evidenceFindingKey as EvidenceFindingKey;

  const candidateChange = boundedProse(input?.candidateChange, MAX_CANDIDATE_CHANGE_CHARACTERS);
  const expectedEffect = boundedProse(input?.expectedEffect, MAX_EXPECTED_EFFECT_CHARACTERS);
  const limitations = boundedProse(input?.limitations, MAX_LIMITATIONS_CHARACTERS);
  /*
   * ALL THREE ARE REQUIRED, and `limitations` is required for the same reason as the other two. A
   * hypothesis that states no limitation is being presented as a finding.
   */
  if (!candidateChange || !expectedEffect || !limitations) {
    return refused("hypothesis-prose-required");
  }

  const agentId = typeof input?.agentId === "string" ? input.agentId.trim() : "";
  if (!agentId) return refused("agent-unresolvable");

  const db = resolveDb(deps);
  if (!db) return refused("persistence-unavailable");
  const now = (deps.now ?? (() => new Date()))();

  /*
   * ── THE SUBJECT, VERIFIED THROUGH THE RELEASED READ SEAM ──────────────────
   *
   * Tenant-scoped by that seam, so another organization's agent is indistinguishable from one that
   * never existed. The composite foreign key on the row repeats this structurally; this read exists
   * to produce an honest refusal rather than a constraint error.
   */
  const identityState = await readDurableAgentIdentityState(tenant, { getDb: deps.getDb });
  if (identityState.status !== "known") return refused("agent-identity-authority-unavailable");
  const identity = identityState.identities.find((candidate) => candidate.agentId === agentId);
  if (!identity) return refused("agent-unresolvable");
  /*
   * A RETIRED AGENT IS REFUSED. The evidence about it is historical and stays readable, but a
   * candidate change to the future behaviour of an agent withdrawn from service proposes altering
   * something that no longer acts.
   */
  if (!identity.inService) return refused("agent-retired");

  /*
   * ── THE EVIDENCE, READ RATHER THAN ACCEPTED ───────────────────────────────
   *
   * Through SIA-1's projection, tenant-scoped, for this agent only.
   */
  const [selectionRead, proposalRead] = await Promise.all([
    (deps.readSelection ?? readAgentSelectionFacts)(tenant, { getDb: deps.getDb }),
    (deps.readProposals ?? readAgentProposalFacts)(tenant, { getDb: deps.getDb }),
  ]);
  /*
   * BOTH must be readable, even though only one is consulted for any given key. A hypothesis filed
   * while half the evidence layer is unreachable would be resting on a record nobody could confirm.
   */
  if (selectionRead.status !== "read") return refused("evidence-unavailable");
  if (proposalRead.status !== "read") return refused("evidence-unavailable");

  const weakness = observedWeakness(
    selectionRead.rows.find((row) => row.agentId === agentId),
    proposalRead.rows.find((row) => row.agentId === agentId),
    evidenceFindingKey,
  );
  /*
   * A ZERO DENOMINATOR IS AN ABSENCE, NOT A RESULT. Nothing has been observed that this finding
   * could be drawn from, so there is no evidence for a hypothesis to rest on.
   */
  if (weakness.total <= 0) return refused("no-evidence-yet");

  /* ── Optional lineage, resolved in this tenant or refused. ── */
  const supersedesRaw =
    typeof input?.supersedesHypothesisId === "string" ? input.supersedesHypothesisId.trim() : "";
  let supersedesHypothesisId: string | null = null;
  if (supersedesRaw) {
    try {
      const predecessor = await db
        .select({ id: agentImprovementHypotheses.id })
        .from(agentImprovementHypotheses)
        .where(
          and(
            eq(agentImprovementHypotheses.id, supersedesRaw),
            eq(agentImprovementHypotheses.tenantId, tenant.tenantId),
          ),
        )
        .limit(1);
      if (predecessor.length === 0) return refused("supersedes-unresolvable");
      supersedesHypothesisId = predecessor[0]!.id;
    } catch {
      return refused("supersedes-unresolvable");
    }
  }

  try {
    const rows = await db
      .insert(agentImprovementHypotheses)
      .values({
        tenantId: tenant.tenantId,
        agentId,
        improvementTarget,
        evidenceFindingKey,
        /* The authoritative column, from the released mapping — never from the caller. */
        evidenceSource: EVIDENCE_SOURCE[evidenceFindingKey],
        evidenceObservedValue: weakness.value,
        evidenceObservedTotal: weakness.total,
        /*
         * WHEN the evidence was read, which is this instant — the read happened above. Storing the
         * instant is what makes the two counts a measurement rather than a claim about now.
         */
        evidenceObservedAt: now,
        candidateChange,
        expectedEffect,
        limitations,
        /*
         * THE ACTUAL AUTHOR. A human filed this, through a request carrying their resolved context.
         * No Director is invented, and no agent is credited with authoring a hypothesis about
         * itself — the database CHECK refuses anything but `human` independently of this line.
         */
        proposedByActorType: "human",
        proposedByActorId: tenant.userId,
        supersedesHypothesisId,
        createdAt: now,
        createdBy: tenant.userId,
        createdByType: "human",
        updatedAt: now,
        updatedBy: tenant.userId,
        updatedByType: "human",
      })
      .returning({ id: agentImprovementHypotheses.id });

    const hypothesisId = rows[0]?.id;
    if (!hypothesisId) return refused("persistence-unavailable");
    return { status: "filed", hypothesisId, filedAt: now.toISOString() };
  } catch {
    return refused("persistence-unavailable");
  }
}
