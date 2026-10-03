/*
 * knowledge-retrieval/relevance.ts — the RELEVANCE contract (RELEVANCE-0). Pure. Not wired.
 *
 * ── FOUR QUESTIONS, FOUR OWNERS ──────────────────────────────────────────────
 *
 *     ELIGIBILITY        may this version participate in this purpose?     Knowledge + Governance
 *     RELEVANCE          among eligible versions, which matter for the task?    this module
 *     GROUNDING NEED     does the task require organizational facts?       the preparing caller
 *     MAY IT PROCEED     given the need and the outcome, may preparation go on?  the preparing caller
 *
 * This module answers the second question only. It receives a set that eligibility already built and
 * can only NARROW it: a judge sees nothing outside the set and may return nothing outside it, and the
 * identity of every selection is copied from the set, never from the judge. Nothing here decides
 * whether anything may be generated — an outcome carries no such field, and `TaskGroundingRequirement`
 * is declared here only so a later preparation authority and this contract share one vocabulary.
 *
 * A PURPOSE IS NOT AN AUTHORIZATION. `public-content-grounding` names which eligibility policy the
 * caller applied upstream; it is carried so a set built for one purpose cannot serve another. This
 * module never reads truth or Governance standing and cannot make a withheld version eligible.
 *
 * ── WHAT IS NOT HERE ─────────────────────────────────────────────────────────
 *
 * No database, clock, session, network, model or provider. No judge implementation: the port is
 * declared, and RELEVANCE-0 supplies only deterministic implementations in tests and the benchmark.
 * Nothing in `src/app` or the rest of `src/features` imports this module yet; runtime retrieval is
 * unchanged. No score here is truth, confidence or standing.
 */
import { RETRIEVAL_MAX_LIMIT } from "./contracts";

/* ── purpose and grounding vocabulary ──────────────────────────────────────── */

/**
 * Why Knowledge is being retrieved. Server-derived, never accepted from a client.
 *
 * `internal-answer` is today's Heby behaviour: the base retrieval eligibility and nothing more.
 * `public-content-grounding` is the purpose a future public-content gate will establish upstream
 * (the Knowledge Trust programme requires ratified and Governance-cleared versions); RELEVANCE-0
 * implements no such gate.
 */
export type RelevancePurpose = "internal-answer" | "public-content-grounding";
export const RELEVANCE_PURPOSES: readonly RelevancePurpose[] = Object.freeze([
  "internal-answer",
  "public-content-grounding",
]);

/**
 * Whether a task needs organizational facts. Declared by the PREPARING caller, not inferred here.
 *
 * A caption that states what the organization sells needs grounding; a caption written purely in the
 * organization's voice, claiming nothing about it, may not. Combining this with a relevance outcome
 * into "may preparation continue" is the caller's decision — no function in this module does it.
 */
export type TaskGroundingRequirement = "organizational-facts-required" | "no-organizational-facts-required";

/* ── bounds ───────────────────────────────────────────────────────────────── */

/** At most this many candidates reach a judge. Equal to the retrieval ceiling: no wider sweep. */
export const RELEVANCE_MAX_CANDIDATES = RETRIEVAL_MAX_LIMIT;
/** At most this many selections come back. */
export const RELEVANCE_MAX_SELECTIONS = 8;
/** A candidate's text is the minimum a judge needs: title and statement, bounded. */
export const RELEVANCE_MAX_CANDIDATE_TEXT = 600;
/** The task text, bounded like a Heby prompt. */
export const RELEVANCE_MAX_TASK_TEXT = 4000;
/** A judge's stated basis for one selection — a short code or phrase, never a document. */
export const RELEVANCE_MAX_BASIS_TEXT = 120;

/* ── the candidate set ─────────────────────────────────────────────────── */

/**
 * One version the caller ALREADY established as eligible for the request's purpose. Eligibility is
 * not derived here: base retrieval eligibility (current, not rejected, in force) and any purpose
 * policy belong to Knowledge and Governance, upstream. This module only bounds what it is given.
 */
export interface RelevanceSource {
  readonly nodeId: string;
  readonly factId: string;
  readonly factKey: string;
  readonly knowledgeVersion: number;
  readonly domainKey: string;
  readonly title: string;
  readonly statement: string | null;
}

/** The exact version a judge may see, and only what it needs to judge relevance. */
export interface RelevanceCandidate {
  readonly nodeId: string;
  readonly factId: string;
  readonly factKey: string;
  readonly knowledgeVersion: number;
  readonly domainKey: string;
  /** Title and statement, bounded by `RELEVANCE_MAX_CANDIDATE_TEXT`. No provenance, no standing. */
  readonly text: string;
  readonly textTruncated: boolean;
}

export type RelevanceCandidateSet =
  | {
      readonly status: "built";
      readonly purpose: RelevancePurpose;
      readonly candidates: readonly RelevanceCandidate[];
      /** How many versions upstream eligibility withheld for this purpose. Reported, never re-judged. */
      readonly withheldCount: number;
      /** True when more sources were eligible than `RELEVANCE_MAX_CANDIDATES`. */
      readonly truncated: boolean;
    }
  | {
      readonly status: "unavailable";
      readonly purpose: RelevancePurpose;
      /** Upstream eligibility could not be established. "Could not tell" never means "eligible". */
      readonly reason: "eligibility-unavailable";
    };

function candidateText(source: RelevanceSource): { readonly text: string; readonly truncated: boolean } {
  const full = source.statement ? `${source.title} — ${source.statement}` : source.title;
  return full.length > RELEVANCE_MAX_CANDIDATE_TEXT
    ? { text: full.slice(0, RELEVANCE_MAX_CANDIDATE_TEXT), truncated: true }
    : { text: full, truncated: false };
}

/**
 * Bound an eligible set for one purpose. Order is preserved (the caller's candidate generation
 * decides it), duplicates by node are dropped, and the set is capped. Nothing is added, and nothing
 * is filtered on any standing — that already happened upstream.
 */
export function buildRelevanceCandidateSet(input: {
  readonly purpose: RelevancePurpose;
  readonly eligibility:
    | { readonly status: "established"; readonly eligible: readonly RelevanceSource[]; readonly withheldCount: number }
    | { readonly status: "unavailable" };
}): RelevanceCandidateSet {
  const { purpose, eligibility } = input;
  if (eligibility.status !== "established") return { status: "unavailable", purpose, reason: "eligibility-unavailable" };
  const seen = new Set<string>();
  const admitted: RelevanceCandidate[] = [];
  for (const source of eligibility.eligible) {
    if (seen.has(source.nodeId)) continue;
    seen.add(source.nodeId);
    const { text, truncated } = candidateText(source);
    admitted.push({
      nodeId: source.nodeId,
      factId: source.factId,
      factKey: source.factKey,
      knowledgeVersion: source.knowledgeVersion,
      domainKey: source.domainKey,
      text,
      textTruncated: truncated,
    });
  }
  return {
    status: "built",
    purpose,
    candidates: admitted.slice(0, RELEVANCE_MAX_CANDIDATES),
    withheldCount: eligibility.withheldCount,
    truncated: admitted.length > RELEVANCE_MAX_CANDIDATES,
  };
}

/* ── the judge port ───────────────────────────────────────────────────────── */

/** What a judge sees: the task, the purpose, and the bounded candidates. Nothing else. */
export interface RelevanceJudgeInput {
  readonly purpose: RelevancePurpose;
  readonly task: string;
  readonly candidates: readonly { readonly candidateId: string; readonly text: string }[];
  readonly limit: number;
}

export type RelevanceJudgeVerdict =
  | {
      readonly status: "judged";
      /** Candidate ids in relevance order. Must be members of the input, distinct, within `limit`. */
      readonly selected: readonly { readonly candidateId: string; readonly basis: string }[];
      /** Set when the judge ran a lesser method than it is declared as. */
      readonly degradedReason?: string;
    }
  | { readonly status: "unavailable"; readonly reason: string };

/**
 * A provider-neutral relevance judge. It may read the input and return candidate ids; it holds no
 * reference to Knowledge, Governance, a database or an execution path, and nothing it returns is
 * used except as an index into the set it was given.
 */
export interface RelevanceJudge {
  readonly judgeId: string;
  readonly kind: "deterministic" | "model";
  judge(input: RelevanceJudgeInput): Promise<RelevanceJudgeVerdict>;
}

/* ── outcome ──────────────────────────────────────────────────────────────── */

export interface RelevanceJudgeProvenance {
  readonly judgeId: string;
  readonly kind: RelevanceJudge["kind"];
}

/** One selection. The candidate is the SET's object; the judge contributed only rank and basis. */
export interface RelevanceSelection {
  readonly candidate: RelevanceCandidate;
  readonly rank: number;
  readonly basis: string;
}

export type RelevanceUnavailableReason =
  | "candidate-set-unavailable"
  | "purpose-mismatch"
  | "empty-task"
  | "judge-unavailable"
  | "judge-failed"
  /** The judge named a non-member, repeated an id, or exceeded the limit. The whole verdict is void. */
  | "judge-response-invalid";

/**
 * The relevance outcome. Note what it does not carry: no truth, no standing, no confidence, and no
 * permission to generate. `none-relevant` and `none-eligible` are different facts and stay separate.
 */
export type RelevanceOutcome =
  | {
      readonly status: "selected" | "degraded";
      readonly purpose: RelevancePurpose;
      readonly selections: readonly RelevanceSelection[];
      readonly candidateCount: number;
      readonly judge: RelevanceJudgeProvenance;
      readonly degradedReason: string | null;
    }
  | {
      /** Eligible candidates existed; the judge found none relevant to this task. */
      readonly status: "none-relevant";
      readonly purpose: RelevancePurpose;
      readonly candidateCount: number;
      readonly judge: RelevanceJudgeProvenance;
    }
  | {
      /** Nothing was eligible for this purpose, so no judge was asked. */
      readonly status: "none-eligible";
      readonly purpose: RelevancePurpose;
      readonly withheldCount: number;
    }
  | {
      readonly status: "unavailable";
      readonly purpose: RelevancePurpose;
      readonly reason: RelevanceUnavailableReason;
      readonly detail?: string;
    };

export interface RelevanceRequest {
  readonly purpose: RelevancePurpose;
  /** The task as the preparing caller states it. Bounded; never rewritten here. */
  readonly task: string;
  /** Clamped to 1..`RELEVANCE_MAX_SELECTIONS`. */
  readonly limit?: number;
}

export function resolveRelevanceLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) return RELEVANCE_MAX_SELECTIONS;
  return Math.min(Math.max(Math.trunc(limit), 1), RELEVANCE_MAX_SELECTIONS);
}

/**
 * Ask a judge which members of an eligible set matter for a task.
 *
 * Fail closed on every boundary: a set that could not be built, a purpose that does not match the
 * set, a judge that is unavailable or throws, and a verdict that names anything outside the set all
 * produce `unavailable`. A verdict is accepted whole or not at all — a partly invalid answer is not
 * trimmed into a valid-looking one.
 */
export async function selectRelevant(
  request: RelevanceRequest,
  set: RelevanceCandidateSet,
  judge: RelevanceJudge,
): Promise<RelevanceOutcome> {
  const purpose = request.purpose;
  if (set.status !== "built") {
    return { status: "unavailable", purpose, reason: "candidate-set-unavailable", detail: set.reason };
  }
  if (set.purpose !== purpose) return { status: "unavailable", purpose, reason: "purpose-mismatch" };
  const task = typeof request.task === "string" ? request.task.trim().slice(0, RELEVANCE_MAX_TASK_TEXT) : "";
  if (!task) return { status: "unavailable", purpose, reason: "empty-task" };
  if (set.candidates.length === 0) return { status: "none-eligible", purpose, withheldCount: set.withheldCount };

  const limit = resolveRelevanceLimit(request.limit);
  const byId = new Map(set.candidates.map((candidate) => [candidate.nodeId, candidate] as const));
  const provenance: RelevanceJudgeProvenance = { judgeId: judge.judgeId, kind: judge.kind };

  let verdict: RelevanceJudgeVerdict;
  try {
    verdict = await judge.judge({
      purpose,
      task,
      candidates: set.candidates.map((candidate) => ({ candidateId: candidate.nodeId, text: candidate.text })),
      limit,
    });
  } catch {
    return { status: "unavailable", purpose, reason: "judge-failed" };
  }
  if (!verdict || verdict.status !== "judged" || !Array.isArray(verdict.selected)) {
    return {
      status: "unavailable",
      purpose,
      reason: "judge-unavailable",
      detail: verdict && verdict.status === "unavailable" ? verdict.reason : undefined,
    };
  }

  if (verdict.selected.length > limit) {
    return { status: "unavailable", purpose, reason: "judge-response-invalid", detail: "over-limit" };
  }
  const chosen = new Set<string>();
  const selections: RelevanceSelection[] = [];
  for (const [index, item] of verdict.selected.entries()) {
    const candidate = typeof item?.candidateId === "string" ? byId.get(item.candidateId) : undefined;
    if (!candidate) return { status: "unavailable", purpose, reason: "judge-response-invalid", detail: "non-member" };
    if (chosen.has(candidate.nodeId)) {
      return { status: "unavailable", purpose, reason: "judge-response-invalid", detail: "duplicate" };
    }
    chosen.add(candidate.nodeId);
    const basis = typeof item.basis === "string" ? item.basis.slice(0, RELEVANCE_MAX_BASIS_TEXT) : "";
    selections.push({ candidate, rank: index + 1, basis });
  }

  if (selections.length === 0) {
    return { status: "none-relevant", purpose, candidateCount: set.candidates.length, judge: provenance };
  }
  const degradedReason = typeof verdict.degradedReason === "string" && verdict.degradedReason ? verdict.degradedReason : null;
  return {
    status: degradedReason ? "degraded" : "selected",
    purpose,
    selections,
    candidateCount: set.candidates.length,
    judge: provenance,
    degradedReason,
  };
}
