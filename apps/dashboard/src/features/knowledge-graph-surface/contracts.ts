/*
 * knowledge-graph-surface/contracts.ts — read-only presentation contract for the
 * Knowledge Graph surface (Hebun UI Phase 21C).
 *
 * The Knowledge Graph surface answers "what organizational relationships are known,
 * and what evidence supports them?" — read from the REAL canonical knowledge read
 * layer (features/canonical-read: public.knowledge_facts / public.knowledge_nodes)
 * through its governed availability probe. It never renders the legacy seeded graph
 * (mock registry records + hand-authored relationship blueprints) and never
 * fabricates a node, edge, relationship strength, confidence %, graph health,
 * coverage %, density, centrality, freshness, or count.
 *
 * The governed canonical read resolves knowledge facts by explicit identity — it is
 * an evidence/relationship inspector, not a whole-graph dump. So this model
 * enumerates nothing; it reports honest availability plus the graph semantics.
 */

/** Honest connection state of the canonical knowledge read layer. */
export type KnowledgeGraphConnection =
  /** The canonical read layer is not configured / not reachable. */
  | "not-connected"
  /** The layer is available, but reading requires an authorized organization context. */
  | "requires-authorized-context"
  /** Available under an authorized context; nothing is enumerable here (read is by identity). */
  | "connected-empty"
  /** The availability probe itself failed. */
  | "read-failed";

export interface KnowledgeGraphReadModel {
  readonly connection: KnowledgeGraphConnection;
  readonly source: "canonical-postgres";
  /** Whether the canonical read layer is configured (real probe field). */
  readonly configured: boolean;
  /** Machine reason for a non-connected/failed state. Never fabricated data. */
  readonly reason?: string;
  readonly warnings: readonly string[];
  /**
   * Canonical nodes/relationships are never enumerated here — the governed read is
   * by identity, and no seeded graph is presented. Always empty.
   */
  readonly nodes: readonly never[];
  readonly relationships: readonly never[];
}
