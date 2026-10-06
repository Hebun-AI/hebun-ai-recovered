/*
 * knowledge-grounding/contracts.ts — WF-3A: the complete, bounded set of Knowledge versions that
 * may be OFFERED as grounding for an agent's record-work proposal, and the contract a later
 * model-facing step must keep.
 *
 * It owns no truth. Knowledge answers which versions are active and their statements; retrieval
 * eligibility answers lifecycle, window and Governance rejection; Governance answers ratification;
 * SCI-2B answers admissibility for `agent-record-work-grounding`. This module only composes those
 * answers, applies the Director's release bound, orders the result and names it.
 *
 * RELEASE POLICY (Director, WF-3 design gate):
 *   - the set offered is the COMPLETE eligible universe, never a subset of it;
 *   - more than {@link KNOWLEDGE_GROUNDING_MAX_CANDIDATES} is a refusal, never a truncation, and no
 *     lexical, semantic or model selection exists to choose among them;
 *   - any required authoritative read unavailable is a refusal, never "ineligible";
 *   - a statement longer than {@link KNOWLEDGE_GROUNDING_MAX_STATEMENT_CODE_POINTS} refuses the whole
 *     universe — never truncated, summarized, split or silently dropped;
 *   - a grounded proposal must reference at least one offered candidate, by its alias only.
 *
 * PURE. No database, no model, no provider, no writer, no clock of its own. Inert: nothing in the
 * runtime consumes this yet.
 */
import type { KnowledgeSourceRecord } from "@/features/knowledge/contracts";
import { RETRIEVAL_MAX_LIMIT } from "@/features/knowledge-retrieval/contracts";
import {
  evaluateAdmissibility,
  type AdmissibilityFactsRead,
} from "@/features/secure-content-admissibility/evaluate";

/** The SCI-2B purpose this universe is composed for. The only one admitted. */
export const KNOWLEDGE_GROUNDING_PURPOSE = "agent-record-work-grounding" as const;

/** The release bound: the KT-5.2 bounded-universe ceiling, imported so the two cannot drift. */
export const KNOWLEDGE_GROUNDING_MAX_CANDIDATES = RETRIEVAL_MAX_LIMIT;

/**
 * The per-candidate statement bound, in Unicode code points (Director, WF-3A).
 *
 * A Hebun Release 1 product/security disclosure budget: 20 candidates × 2,000 = 40,000 code points at
 * most. It is NOT a provider token guarantee, NOT derived from the model's context window, NOT the
 * ingestion chunk target and NOT a storage limit (K2 authoring allows 20,000).
 */
export const KNOWLEDGE_GROUNDING_MAX_STATEMENT_CODE_POINTS = 2_000;

/** Code points, as K2 counts its own bounds — not UTF-16 code units. */
function codePointLength(value: string): number {
  return Array.from(value).length;
}

/**
 * One offered version, SERVER-SIDE. `knowledgeNodeId` is the exact version identity a later step
 * revalidates and persists; it is never rendered to a model — see {@link projectKnowledgeCandidatesForModel}.
 * SCI-2A makes a version row's statement immutable, so the node id names this exact text forever.
 */
export interface KnowledgeGroundingCandidate {
  readonly alias: string;
  readonly statement: string;
  readonly knowledgeNodeId: string;
  readonly factId: string;
}

/** What a model may be shown about one candidate: the alias it may cite and the statement. */
export interface ModelFacingKnowledgeCandidate {
  readonly alias: string;
  readonly statement: string;
}

export type KnowledgeGroundingRefusal =
  /** A required authoritative read failed or the listing was capped: the universe is unknowable. */
  | "authoritative-facts-unavailable"
  /** The universe was read and nothing in it is eligible. */
  | "no-eligible-knowledge"
  /** More eligible versions than the release bound. Refused whole, never cut. */
  | "knowledge-universe-exceeds-bound"
  /** An eligible version's statement exceeds the per-candidate bound. Refused whole, never cut. */
  | "knowledge-candidate-too-large";

export type KnowledgeGroundingUniverse =
  | { readonly status: "available"; readonly candidates: readonly KnowledgeGroundingCandidate[] }
  | { readonly status: "refused"; readonly reason: KnowledgeGroundingRefusal; readonly eligibleCount?: number };

/** One retrieval-eligible record with a statement, and SCI-2B's facts about its active version. */
export interface KnowledgeGroundingEntry {
  readonly record: KnowledgeSourceRecord;
  readonly facts: AdmissibilityFactsRead;
}

const refused = (reason: KnowledgeGroundingRefusal, eligibleCount?: number): KnowledgeGroundingUniverse =>
  eligibleCount === undefined ? { status: "refused", reason } : { status: "refused", reason, eligibleCount };

/** Plain code-unit comparison: no locale, no collation, the same answer on every runtime. */
const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * The deterministic order. It is the listing's own order, `(domain_key, fact_key)`, completed with
 * the rest of the fact's unique key (`knowledge_scope`) and then the version id, because the
 * listing's ORDER BY alone is not total. Identity only — nothing here measures usefulness.
 */
export function compareGroundingRecords(a: KnowledgeSourceRecord, b: KnowledgeSourceRecord): number {
  return (
    compare(a.domainKey, b.domainKey) ||
    compare(a.factKey, b.factKey) ||
    compare(a.scope, b.scope) ||
    compare(a.activeKnowledgeNodeId ?? "", b.activeKnowledgeNodeId ?? "")
  );
}

/** A statement that carries something to ground on. Checked, never rewritten. */
export function hasGroundingStatement(record: KnowledgeSourceRecord): boolean {
  return typeof record.statement === "string" && record.statement.trim().length > 0;
}

/**
 * Compose the universe from entries that already passed retrieval eligibility and the statement
 * check. SCI-2B decides each one; ONE unavailable verdict refuses the whole universe, because an
 * unknown version may be an eligible one and the result must be complete. Precedence after that:
 * count bound, then statement bound, then order, then aliases.
 */
export function assembleKnowledgeGroundingUniverse(
  trustedTenantId: string,
  entries: readonly KnowledgeGroundingEntry[],
): KnowledgeGroundingUniverse {
  const eligible: KnowledgeSourceRecord[] = [];
  for (const { record, facts } of entries) {
    const verdict = evaluateAdmissibility(trustedTenantId, KNOWLEDGE_GROUNDING_PURPOSE, facts);
    if (verdict.status === "unavailable") return refused("authoritative-facts-unavailable");
    // The verdict is about the version SCI read; it must be the version this record offers.
    if (verdict.status === "eligible" && facts.status === "read" && facts.facts.versionId === record.activeKnowledgeNodeId) {
      eligible.push(record);
    }
  }
  if (eligible.length === 0) return refused("no-eligible-knowledge", 0);
  if (eligible.length > KNOWLEDGE_GROUNDING_MAX_CANDIDATES) {
    return refused("knowledge-universe-exceeds-bound", eligible.length);
  }
  if (eligible.some((record) => codePointLength(record.statement!) > KNOWLEDGE_GROUNDING_MAX_STATEMENT_CODE_POINTS)) {
    return refused("knowledge-candidate-too-large", eligible.length);
  }
  return {
    status: "available",
    candidates: [...eligible].sort(compareGroundingRecords).map((record, index) => ({
      alias: `K${index + 1}`,
      statement: record.statement!,
      knowledgeNodeId: record.activeKnowledgeNodeId!,
      factId: record.factId,
    })),
  };
}

/** The model-facing projection: built field by field, so nothing else can ride along. */
export function projectKnowledgeCandidatesForModel(
  candidates: readonly KnowledgeGroundingCandidate[],
): readonly ModelFacingKnowledgeCandidate[] {
  return candidates.map((c) => ({ alias: c.alias, statement: c.statement }));
}

/** `K1`..`K99` shape. Membership, not shape, is the containment; shape only names malformed input. */
const ALIAS_SHAPE = /^K[1-9][0-9]?$/;

export type KnowledgeReferenceRefusal =
  /** Not an array, or an element that is not an alias-shaped string. */
  | "malformed-knowledge-reference"
  /** The same alias twice. */
  | "duplicate-knowledge-reference"
  /** Alias-shaped, but not one this invocation offered. */
  | "unknown-knowledge-reference"
  /** An empty list: Knowledge may have been supplied, but nothing was referenced as grounding. */
  | "no-knowledge-reference";

export type KnowledgeReferenceResult =
  | { readonly status: "referenced"; readonly referenced: readonly KnowledgeGroundingCandidate[] }
  | { readonly status: "refused"; readonly reason: KnowledgeReferenceRefusal };

/**
 * Turn a model's `knowledgeRefs` into the exact offered candidates, or refuse the whole value.
 *
 * Resolution is exact string equality against THIS invocation's in-memory candidates and nothing
 * else — a database id, another invocation's alias or a near-miss cannot resolve. Nothing is
 * stripped, deduplicated or repaired: one bad element refuses the list. Zero references is its own
 * refusal, because in Knowledge mode a proposal referencing nothing is not a grounded proposal.
 */
export function parseKnowledgeReferences(
  value: unknown,
  candidates: readonly KnowledgeGroundingCandidate[],
): KnowledgeReferenceResult {
  if (!Array.isArray(value)) return { status: "refused", reason: "malformed-knowledge-reference" };
  if (value.length === 0) return { status: "refused", reason: "no-knowledge-reference" };
  const seen = new Set<string>();
  const referenced: KnowledgeGroundingCandidate[] = [];
  for (const element of value) {
    if (typeof element !== "string" || !ALIAS_SHAPE.test(element)) {
      return { status: "refused", reason: "malformed-knowledge-reference" };
    }
    if (seen.has(element)) return { status: "refused", reason: "duplicate-knowledge-reference" };
    seen.add(element);
    const candidate = candidates.find((c) => c.alias === element);
    if (!candidate) return { status: "refused", reason: "unknown-knowledge-reference" };
    referenced.push(candidate);
  }
  return { status: "referenced", referenced };
}

/** The evidence reference for one exact Knowledge VERSION — the repository's `<kind>/<uuid>` shape. */
export function formatKnowledgeVersionRef(knowledgeNodeId: string): string {
  return `knowledge-version/${knowledgeNodeId}`;
}

export type KnowledgeRevalidation =
  | { readonly status: "valid" }
  | { readonly status: "refused"; readonly reason: "knowledge-reference-stale" | "authoritative-facts-unavailable" };

/**
 * Re-judge the REFERENCED versions just before a proposal is filed (WF-3 clause 9).
 *
 * Each must still be the exact version that was supplied, not Governance-rejected, and SCI-2B
 * ELIGIBLE now. Any unavailable read refuses as unavailable; any other failure refuses as stale.
 * Statement identity needs no comparison: SCI-2A makes a version row's statement immutable.
 */
export function judgeKnowledgeRevalidation(
  trustedTenantId: string,
  referenced: readonly KnowledgeGroundingCandidate[],
  rejectedNodeIds: ReadonlySet<string>,
  facts: readonly AdmissibilityFactsRead[],
): KnowledgeRevalidation {
  if (referenced.length === 0 || facts.length !== referenced.length) return { status: "refused", reason: "knowledge-reference-stale" };
  if (facts.some((f) => f.status !== "read")) return { status: "refused", reason: "authoritative-facts-unavailable" };
  for (let i = 0; i < referenced.length; i += 1) {
    const candidate = referenced[i]!;
    const read = facts[i]!;
    const verdict = evaluateAdmissibility(trustedTenantId, KNOWLEDGE_GROUNDING_PURPOSE, read);
    if (
      verdict.status !== "eligible" ||
      read.status !== "read" ||
      read.facts.versionId !== candidate.knowledgeNodeId ||
      rejectedNodeIds.has(candidate.knowledgeNodeId)
    ) {
      return { status: "refused", reason: "knowledge-reference-stale" };
    }
  }
  return { status: "valid" };
}
