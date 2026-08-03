/**
 * Enterprise Memory Context — context assembly contracts.
 *
 * The context assembly layer sits between the Memory Selection Engine and a
 * future Reasoning Engine. It consumes a selected context and deterministically
 * assembles it: deduplicate, order, bound, and group — while preserving each
 * record's metadata and its selection explanation. It performs NO reasoning, NO
 * inference, NO summarization, NO synthesis, NO AI ranking, and NO semantic
 * interpretation. Every assembly is a pure function of its input.
 */

import type { PersistedMemoryRecord } from "@/features/enterprise-memory-persistence";
import type { SelectionReason } from "@/features/enterprise-memory-selection";
import type { PersistenceResult } from "@/features/enterprise-persistence";

/** The field a context is grouped by. "none" produces a single group. */
export type AssemblyGroupKey = "none" | "category" | "sensitivity" | "lifecycle" | "memory-id";

/** The deterministic ordering applied to records before grouping. */
export type AssemblyOrder = "preserve-selection" | "memory-id-asc" | "version-desc" | "stored-newest";

/** The deterministic deduplication strategy. */
export type AssemblyDedup = "none" | "by-identity" | "by-memory-latest" | "by-memory-first";

/** An explicit, declarative assembly policy. */
export interface AssemblyPolicy {
  readonly dedup?: AssemblyDedup;
  readonly order?: AssemblyOrder;
  readonly groupBy?: AssemblyGroupKey;
  readonly limit?: number;
}

/** A record paired with its preserved selection explanation. */
export interface AssembledEntry {
  readonly record: PersistedMemoryRecord;
  readonly selectionReason?: SelectionReason;
}

/** A named group of assembled entries. */
export interface AssembledGroup {
  readonly key: string;
  readonly entries: readonly AssembledEntry[];
}

/** The immutable output of an assembly: ordered groups plus provenance of the run. */
export interface AssembledContext {
  readonly groups: readonly AssembledGroup[];
  readonly totalRecords: number;
  readonly sourceSelectionSize: number;
  readonly appliedPolicy: AssemblyPolicy;
}

/** The result of an assembly: a context, or an explicit validation failure. */
export type AssemblyResult = PersistenceResult<AssembledContext>;
