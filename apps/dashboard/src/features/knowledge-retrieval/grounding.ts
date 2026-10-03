/*
 * knowledge-retrieval/grounding.ts — the GROUNDING SUFFICIENCY contract (RELEVANCE-2A). Pure. Not wired.
 *
 * ── RELEVANT IS NOT SUFFICIENT ──────────────────────────────────────────────
 *
 * RELEVANCE-1 measured the failure this module exists for. A task asked for organizational fact X;
 * the version stating X was not eligible for the purpose; a neighbouring version Y was. The judge
 * selected Y — correctly, because Y IS related to the task. Nothing downstream then distinguished
 * "Y is related to the task" from "Y supports the claim the task needs", so generation could answer
 * X out of Y.
 *
 * So relevance and grounding are separate questions with separate answers:
 *
 *     RELEVANCE   which eligible versions matter for this task?          ./relevance (a selector)
 *     GROUNDING   is what was selected enough to support the facts the    this module (an assessment)
 *                 task needs to state?
 *
 * ── WHAT THIS MODULE CAN AND CANNOT SAY ──────────────────────────────────────
 *
 * It can say a task needs no organizational facts (`not-required`); that nothing could be assessed
 * (`unavailable`, with the reason); that nothing usable was found (`insufficient`, with which kind of
 * nothing); and — the default for any selection — that related evidence exists but nobody has
 * verified it supports the claim (`relevant-unverified`).
 *
 * It says `sufficient` ONLY when a support verdict from a non-model verifier names selected versions.
 * How Hebun establishes that selected evidence directly supports a requested organizational claim is
 * an OPEN design gate: no verifier exists, and nothing in RELEVANCE-2A produces a verified verdict.
 * The port is declared so that the gate has a shape, not so that it appears answered.
 *
 * ── THE MODEL MAY ONLY DOWNGRADE ─────────────────────────────────────────────
 *
 * Nothing a relevance judge returns — a selection, a rank, a basis string, a judge kind — can move an
 * assessment to `sufficient`. A model is not a verifier: `GroundingVerifierKind` has no model member,
 * and a degraded relevance result is never promoted past `relevant-unverified`.
 *
 * ── WHAT IS NOT HERE ─────────────────────────────────────────────────────────
 *
 * No eligibility (upstream, Knowledge + Governance), no truth or standing, no Governance decision, no
 * generation, no readiness, no authorization. An outcome carries no permission to generate: combining
 * it with a task into "may preparation continue" is the preparing caller's decision. No database,
 * clock, network or model. Nothing in `src/app` or the rest of `src/features` imports this module.
 */
import type {
  RelevanceOutcome,
  RelevancePurpose,
  RelevanceSelection,
  TaskGroundingRequirement,
} from "./relevance";

/* ── requirement ─────────────────────────────────────────────────────────── */

/**
 * Whether the task needs organizational facts, declared by the preparing caller. The same vocabulary
 * the relevance contract declares — one term, not two. Deliberately NOT a list of required fact keys:
 * a caller working from natural language cannot generally know which fact would answer it.
 */
export type GroundingRequirement = TaskGroundingRequirement;

/* ── support (the open gate) ─────────────────────────────────────────────── */

/** Who may vouch that selected evidence supports a claim. There is no model member, by design. */
export type GroundingVerifierKind = "deterministic" | "human";

/**
 * A verifier's statement that specific SELECTED versions support the task's claim. No module produces
 * `verified` in RELEVANCE-2A — absence of a verdict is `unverified`, and `unverified` is the default.
 */
export type GroundingSupport =
  | { readonly status: "unverified" }
  | {
      readonly status: "verified";
      readonly verifierId: string;
      readonly verifierKind: GroundingVerifierKind;
      /** Node ids of the selected versions the verifier vouches for. Must be non-empty selections. */
      readonly supportedNodeIds: readonly string[];
    };

const UNVERIFIED: GroundingSupport = Object.freeze({ status: "unverified" });

/* ── outcome ──────────────────────────────────────────────────────────────── */

export type GroundingUnavailableReason =
  /** Upstream eligibility could not be established. "Could not tell" is not "none exist". */
  | "eligibility-unavailable"
  /** A candidate generator reported an impossible universe. */
  | "candidate-generation-invalid"
  /** The eligible set did not fit the bounded judge; nothing was judged. */
  | "candidate-set-over-bound"
  /** The judge answered, and its answer was void. */
  | "relevance-response-invalid"
  /** Relevance could not be obtained: judge unreachable, failed, purpose mismatch, empty task. */
  | "relevance-unavailable";

export type GroundingInsufficientReason =
  /** Nothing was eligible for the purpose. NONE EXISTS for this purpose. */
  | "none-eligible"
  /** Eligible versions existed; a generator surfaced none of them. */
  | "no-candidates"
  /** Eligible candidates were judged; none was relevant. NONE RELEVANT. */
  | "none-relevant";

export type GroundingUnverifiedReason =
  /** No support verdict was supplied — the RELEVANCE-2A default. */
  | "no-support-verdict"
  /** A verdict named versions that were not selected, or named none. It is not used. */
  | "support-outside-selection"
  /** Relevance ran a lesser method than declared; nothing downstream of it is promoted. */
  | "relevance-degraded";

export type GroundingOutcome =
  | {
      /** The task states no organizational fact. Selections, if any, are context — never support. */
      readonly status: "not-required";
      readonly purpose: RelevancePurpose;
      readonly context: readonly RelevanceSelection[];
    }
  | {
      readonly status: "unavailable";
      readonly purpose: RelevancePurpose;
      readonly reason: GroundingUnavailableReason;
      readonly detail?: string;
    }
  | {
      readonly status: "insufficient";
      readonly purpose: RelevancePurpose;
      readonly reason: GroundingInsufficientReason;
      /** For `none-relevant`: false means "none among generated candidates", not "none at all". */
      readonly exhaustive: boolean;
    }
  | {
      /** Related evidence was selected. Nobody has verified it supports the claim. Not sufficient. */
      readonly status: "relevant-unverified";
      readonly purpose: RelevancePurpose;
      readonly reason: GroundingUnverifiedReason;
      readonly selections: readonly RelevanceSelection[];
      readonly exhaustive: boolean;
    }
  | {
      readonly status: "sufficient";
      readonly purpose: RelevancePurpose;
      /** Exactly the selected versions the verifier vouched for. */
      readonly supportedBy: readonly RelevanceSelection[];
      readonly verifierId: string;
      readonly verifierKind: GroundingVerifierKind;
    };

/* ── assessment ───────────────────────────────────────────────────────────── */

function unavailableReasonOf(
  outcome: Extract<RelevanceOutcome, { status: "unavailable" }>,
): GroundingUnavailableReason {
  if (outcome.reason === "candidate-set-unavailable") {
    return outcome.detail === "candidate-generation-invalid" ? "candidate-generation-invalid" : "eligibility-unavailable";
  }
  if (outcome.reason === "judge-response-invalid") return "relevance-response-invalid";
  return "relevance-unavailable";
}

/**
 * Assess whether a relevance outcome grounds a task. Pure and total: every relevance status maps to
 * exactly one grounding status, and no failure is ever reported as an absence.
 */
export function assessGrounding(input: {
  readonly requirement: GroundingRequirement;
  readonly relevance: RelevanceOutcome;
  readonly support?: GroundingSupport;
}): GroundingOutcome {
  const { requirement, relevance } = input;
  const purpose = relevance.purpose;
  const support = input.support ?? UNVERIFIED;

  /*
   * A task that states no organizational fact is not blocked by missing, failed or over-bound
   * Knowledge. Whatever was selected travels as context only.
   */
  if (requirement === "no-organizational-facts-required") {
    const context = relevance.status === "selected" || relevance.status === "degraded" ? relevance.selections : [];
    return { status: "not-required", purpose, context };
  }

  switch (relevance.status) {
    case "unavailable":
      return { status: "unavailable", purpose, reason: unavailableReasonOf(relevance), detail: relevance.detail };
    case "over-bound":
      return { status: "unavailable", purpose, reason: "candidate-set-over-bound" };
    case "none-eligible":
      return { status: "insufficient", purpose, reason: "none-eligible", exhaustive: true };
    case "no-candidates":
      return { status: "insufficient", purpose, reason: "no-candidates", exhaustive: false };
    case "none-relevant":
      return { status: "insufficient", purpose, reason: "none-relevant", exhaustive: relevance.exhaustive };
    case "selected":
    case "degraded": {
      const unverified = (reason: GroundingUnverifiedReason): GroundingOutcome => ({
        status: "relevant-unverified",
        purpose,
        reason,
        selections: relevance.selections,
        exhaustive: relevance.exhaustive,
      });
      if (relevance.status === "degraded") return unverified("relevance-degraded");
      if (support.status !== "verified") return unverified("no-support-verdict");
      if (support.verifierKind !== "deterministic" && support.verifierKind !== "human") {
        return unverified("no-support-verdict");
      }
      const byNode = new Map(relevance.selections.map((selection) => [selection.candidate.nodeId, selection] as const));
      const supported = [...new Set(support.supportedNodeIds)].map((nodeId) => byNode.get(nodeId));
      if (supported.length === 0 || supported.some((selection) => selection === undefined)) {
        return unverified("support-outside-selection");
      }
      return {
        status: "sufficient",
        purpose,
        supportedBy: supported as RelevanceSelection[],
        verifierId: support.verifierId,
        verifierKind: support.verifierKind,
      };
    }
  }
}
