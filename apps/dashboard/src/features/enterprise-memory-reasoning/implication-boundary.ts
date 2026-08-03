/**
 * Enterprise Memory Reasoning — implication boundary (Phase 3).
 *
 * The boundary through which classified implications enter and leave the
 * implication foundation. It validates a proposed implication set against declared
 * evidence and relations, then normalizes it into a canonical, immutable form. It
 * performs NO inference, NO derivation, and generates NO implications — it only
 * accepts, checks, and canonicalizes the implications it is given.
 */

import type { EvidenceSet } from "@/features/enterprise-memory-reasoning/evidence";
import type { ReasoningRelation } from "@/features/enterprise-memory-reasoning/relation";
import type { ClassifiedImplication } from "@/features/enterprise-memory-reasoning/implication-types";
import { normalizeImplications } from "@/features/enterprise-memory-reasoning/implication-normalization";
import { validateImplicationSet } from "@/features/enterprise-memory-reasoning/implication-validation";

/** A proposed set of classified implications entering the boundary. */
export interface ImplicationSet {
  readonly implications: readonly ClassifiedImplication[];
}

/** A validated, normalized, immutable set of implications leaving the boundary. */
export interface NormalizedImplicationSet {
  readonly implications: readonly ClassifiedImplication[];
}

/** The result of preparing an implication set: normalized, or an explicit failure. */
export type ImplicationSetResult =
  | { readonly ok: true; readonly value: NormalizedImplicationSet }
  | { readonly ok: false; readonly issues: readonly string[] };

/**
 * Validates then normalizes an implication set against the declared evidence and
 * relations. Pure and deterministic: the same input always produces the same
 * result. A validation failure yields explicit issues and no normalized set.
 */
export function normalizeImplicationSet(
  input: ImplicationSet,
  evidence: EvidenceSet,
  relations: readonly ReasoningRelation[],
): ImplicationSetResult {
  const validation = validateImplicationSet(input.implications, evidence, relations);
  if (!validation.ok) return { ok: false, issues: validation.issues };
  return { ok: true, value: Object.freeze({ implications: normalizeImplications(input.implications) }) };
}
