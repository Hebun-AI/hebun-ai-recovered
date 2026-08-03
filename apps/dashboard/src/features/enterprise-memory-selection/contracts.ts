/**
 * Enterprise Memory Selection — selection contracts.
 *
 * The selection layer sits between the Memory Query Engine and a future Reasoning
 * Engine. It consumes query results and deterministically narrows them into a
 * bounded, prioritized, explainable context. It performs NO reasoning, NO AI, NO
 * probabilistic ranking, NO embeddings, and NO semantic interpretation. Every
 * selection is a pure function of its input; identical input yields identical
 * output. Contracts reuse published persistence and memory shapes.
 */

import type {
  MemoryConfidenceLevel,
  MemoryId,
  MemoryLifecycleState,
  MemorySensitivity,
} from "@/features/enterprise-memory";
import type { MemoryVersion, PersistedMemoryRecord } from "@/features/enterprise-memory-persistence";
import type { PersistenceResult } from "@/features/enterprise-persistence";

/**
 * A deterministic prioritization criterion. Each maps to a fixed comparator.
 * These express preference order, not probability — nothing is scored or ranked
 * by likelihood.
 */
export type SelectionPriority =
  | "current-first"
  | "confidence-desc"
  | "newest-stored-first"
  | "oldest-stored-first"
  | "version-desc"
  | "version-asc";

/**
 * An explicit selection policy. Filters narrow the candidate set; prioritize
 * orders it; limit bounds the resulting context. Absent fields impose no
 * constraint. A policy is declarative data — it contains no behavior.
 */
export interface SelectionPolicy {
  readonly requireCurrent?: boolean;
  readonly lifecycleState?: MemoryLifecycleState;
  readonly minConfidenceLevel?: MemoryConfidenceLevel;
  readonly sensitivity?: MemorySensitivity;
  readonly category?: string;
  readonly prioritize?: readonly SelectionPriority[];
  readonly limit?: number;
}

/** Why a specific record was included in the bounded selection. */
export interface SelectionReason {
  readonly memoryId: MemoryId;
  readonly version: MemoryVersion;
  readonly reasons: readonly string[];
}

/**
 * The immutable output of a selection: the bounded, ordered records, a reason per
 * selected record, how many candidates were considered, and the policy applied.
 */
export interface SelectedMemoryContext {
  readonly selected: readonly PersistedMemoryRecord[];
  readonly reasons: readonly SelectionReason[];
  readonly totalConsidered: number;
  readonly appliedPolicy: SelectionPolicy;
}

/** The result of a selection: a bounded context, or an explicit validation failure. */
export type SelectionResult = PersistenceResult<SelectedMemoryContext>;
