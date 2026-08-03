/**
 * Enterprise Memory Reasoning — evidence contracts.
 *
 * Evidence grounds reasoning in memory. An EvidenceReference points at a specific
 * persisted memory version by identity only — it carries no content and never
 * copies memory. Reasoning is bounded to the evidence memory supports; it never
 * references anything memory did not admit. Contracts only.
 */

import type { MemoryId, MemoryNamespace } from "@/features/enterprise-memory";
import type { MemoryVersion } from "@/features/enterprise-memory-persistence";
import type { ReasoningStatement } from "@/features/enterprise-memory-reasoning/contracts";

/** A reference to one persisted memory version that grounds a reasoning artifact. */
export interface EvidenceReference {
  readonly memoryId: MemoryId;
  readonly namespace: MemoryNamespace;
  readonly version: MemoryVersion;
}

/** An immutable, ordered set of evidence references with a short description. */
export interface EvidenceItem {
  readonly reference: EvidenceReference;
  readonly describedBy: ReasoningStatement;
}

/** The complete evidence available to a reasoning artifact. */
export interface EvidenceSet {
  readonly items: readonly EvidenceItem[];
}
