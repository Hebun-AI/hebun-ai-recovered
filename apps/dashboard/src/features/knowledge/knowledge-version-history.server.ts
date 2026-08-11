/*
 * knowledge/knowledge-version-history.server.ts — the version chain of ONE Knowledge fact (K3).
 *
 * NO SECOND HISTORY AUTHORITY. Version history is RECONSTRUCTED from the canonical relationships
 * that already exist — `knowledge_facts.active_knowledge_node_id` and each node's
 * `supersedes_knowledge_node_id` — not from a parallel table. This is deliberately a different thing
 * from G1's `audit_log`, which records ATTEMPTS (including refused ones); this reader answers only
 * "which versions of this fact exist, and which one is active".
 *
 * CYCLE-SAFE BY CONSTRUCTION. Corrupt data can produce N3 → N2 → N3. The walk therefore carries a
 * seen-set and a hard bound, stops the moment it revisits a node, and REPORTS the integrity it
 * found. It never repairs corruption, never silently drops it, and never recurses.
 *
 * Every step is tenant-scoped: a supersedes link pointing at another tenant's node simply does not
 * resolve, and the chain is reported as broken rather than followed across the boundary.
 *
 * Read-only. Server-only.
 */

import { and, eq } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { knowledgeFacts } from "@/db/schema/knowledge-fact";
import { knowledgeNodes } from "@/db/schema/knowledge";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import type {
  KnowledgeVersionChainIntegrity,
  KnowledgeVersionHistory,
  KnowledgeVersionView,
} from "./supersede-contracts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One node as the chain walk reads it. Annotated explicitly so the self-referential walk types. */
interface VersionRow {
  readonly id: string;
  readonly label: string;
  readonly statement: string | null;
  readonly knowledgeVersion: number;
  readonly lifecycleStatus: string | null;
  readonly authorityClass: string | null;
  readonly ratifiedAt: Date | null;
  readonly ratificationDecisionId: string | null;
  readonly createdAt: Date;
  readonly createdBy: string | null;
  readonly supersedes: string | null;
}

/** Hard bound on chain length. A fact with more versions than this reports `truncated`. */
export const KNOWLEDGE_VERSION_CHAIN_LIMIT = 50;

export interface KnowledgeVersionHistoryDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly limit?: number;
}

function iso(value: Date | string | null): string {
  if (!value) return "";
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function resolveDbOrNull(): ControlPlaneDatabase | null {
  if (!process.env.DATABASE_URL?.trim()) return null;
  try {
    return getControlPlaneDb();
  } catch {
    return null;
  }
}

/**
 * Walk one fact's version chain, newest first, within the authorized tenant.
 *
 * Fails closed: no tenant, no persistence, or an unknown/foreign fact yields an honest unavailable
 * state rather than a partial or borrowed history.
 */
export async function readKnowledgeVersionHistory(
  tenant: Pick<TenantContext, "tenantId"> | null,
  factId: string,
  deps: KnowledgeVersionHistoryDeps = {},
): Promise<KnowledgeVersionHistory> {
  if (typeof window !== "undefined") throw new Error("Knowledge version history is server-only.");
  if (!tenant?.tenantId) return { status: "unavailable", reason: "no-authorized-tenant-context" };
  const db = (deps.getDb ?? resolveDbOrNull)();
  if (!db) return { status: "unavailable", reason: "persistence-not-configured" };
  if (!UUID_RE.test(tenant.tenantId) || !UUID_RE.test(factId)) {
    return { status: "unavailable", reason: "not-found" };
  }

  try {
    const factRows = await db
      .select({ activeNodeId: knowledgeFacts.activeKnowledgeNodeId })
      .from(knowledgeFacts)
      .where(and(eq(knowledgeFacts.id, factId), eq(knowledgeFacts.tenantId, tenant.tenantId)))
      .limit(1);

    const activeNodeId = factRows[0]?.activeNodeId ?? null;
    // Unknown fact, another tenant's fact, and a fact with no active node are all "not-found" —
    // the caller learns nothing about which.
    if (!factRows[0] || !activeNodeId) return { status: "unavailable", reason: "not-found" };

    const bound = Math.max(1, Math.min(deps.limit ?? KNOWLEDGE_VERSION_CHAIN_LIMIT, KNOWLEDGE_VERSION_CHAIN_LIMIT));
    const versions: KnowledgeVersionView[] = [];
    const seen = new Set<string>();
    let integrity: KnowledgeVersionChainIntegrity = "complete";
    let cursor: string | null = activeNodeId;

    while (cursor) {
      if (seen.has(cursor)) {
        // Corrupt data pointed back at a node already walked. Stop; do not repair, do not recurse.
        integrity = "cycle-detected";
        break;
      }
      if (versions.length >= bound) {
        integrity = "truncated";
        break;
      }
      seen.add(cursor);

      const rows: readonly VersionRow[] = (await db
        .select({
          id: knowledgeNodes.id,
          label: knowledgeNodes.label,
          statement: knowledgeNodes.statement,
          knowledgeVersion: knowledgeNodes.knowledgeVersion,
          lifecycleStatus: knowledgeNodes.knowledgeLifecycleStatus,
          authorityClass: knowledgeNodes.knowledgeAuthority,
          ratifiedAt: knowledgeNodes.ratifiedAt,
          ratificationDecisionId: knowledgeNodes.ratificationDecisionId,
          createdAt: knowledgeNodes.createdAt,
          createdBy: knowledgeNodes.createdBy,
          supersedes: knowledgeNodes.supersedesKnowledgeNodeId,
        })
        .from(knowledgeNodes)
        // Tenant-scoped at EVERY step: a link into another tenant does not resolve.
        .where(and(eq(knowledgeNodes.id, cursor), eq(knowledgeNodes.tenantId, tenant.tenantId)))
        .limit(1)) as readonly VersionRow[];

      const node: VersionRow | undefined = rows[0];
      if (!node) {
        // The link pointed at a node that is missing or not this tenant's. Truthfully broken.
        integrity = "broken-link";
        break;
      }

      versions.push({
        knowledgeVersion: node.knowledgeVersion,
        title: node.label,
        statement: node.statement,
        active: node.id === activeNodeId,
        lifecycleStatus: node.lifecycleStatus,
        authorityClass: node.authorityClass,
        ratified: Boolean(node.ratificationDecisionId ?? node.ratifiedAt),
        createdAt: iso(node.createdAt),
        createdBy: node.createdBy,
        supersedesEarlier: node.supersedes !== null,
      });

      cursor = node.supersedes;
    }

    return { status: "read", versions, integrity };
  } catch (error) {
    return {
      status: "unavailable",
      reason: "read-failed",
      detail: error instanceof Error ? error.message : "Version history read failed.",
    };
  }
}
