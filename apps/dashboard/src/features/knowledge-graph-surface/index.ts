/*
 * knowledge-graph-surface — read-only Knowledge view onto the real canonical
 * knowledge read layer (Hebun UI Phase 21C). Only pure, client-safe modules are
 * re-exported; the server-only runtime binding (active-read.server) is imported
 * directly by server components.
 */

export * from "./contracts";
export { readKnowledgeGraphFrom, type KnowledgeGraphTenant } from "./read-service";
