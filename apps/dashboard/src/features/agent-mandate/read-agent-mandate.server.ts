/*
 * agent-mandate/read-agent-mandate.server.ts — reading what an agent is FOR (AMA-1).
 *
 * READ-ONLY, and read-only in the way that can be proved: this module contains no insert, no
 * update, no delete and no transaction. It grants nothing, decides nothing, enforces nothing and
 * starts nothing.
 *
 * ── EFFECTIVE IS DERIVED, NEVER STORED ───────────────────────────────────────
 *
 * The effective mandate is the revision with the highest `mandate_revision` for that agent. There
 * is no `is_current` column, no `superseded_at`, and no pointer on `agents` — so there is nothing
 * a writer could forget to maintain and nothing that can disagree with the rows themselves.
 *
 * ── THE THREE ANSWERS ARE THREE ANSWERS ──────────────────────────────────────
 *
 *   known + mandate     this agent's purpose is bounded, and here is the bound
 *   known + null        this agent has NO mandate — nobody has bounded it
 *   unavailable         Hebun could not look
 *
 * `NO MANDATE != UNBOUNDED` and `UNAVAILABLE != NO MANDATE` are the two sentences this shape
 * exists to keep separate. A caller that collapsed either would state, on a database outage, that
 * an organization had declined to bound an agent — a fabricated absence, which is the defect this
 * repository has repaired more than once.
 *
 * A fourth answer is deliberately impossible: there is no "allowed" and no "permitted" here. This
 * seam reports a recorded bound. Whether any act may occur is answered by Governance, by the action
 * authorization chain, and by execution — three authorities, none of them this one.
 *
 * ── TENANT-SCOPED BY PREDICATE, WITH NO WAY TO ASK OTHERWISE ─────────────────
 *
 * Every query in this module filters on the resolved tenant. There is no unscoped read, no
 * cross-tenant read, and no parameter through which a caller could request one — another
 * organization's mandate is indistinguishable from one that never existed.
 *
 * Server-only.
 */
import { and, desc, eq } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { agentMandates } from "@/db/schema/agent-mandate";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { isMandateScopeKind, type MandateScopeKind } from "./contracts";

export interface AgentMandateReadDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  /** Bound on a history read. A ceiling on the page, never a filter on truth. */
  readonly limit?: number;
}

/** The default history page. Stated so a short list is never read as "this is everything". */
export const DEFAULT_MANDATE_HISTORY_LIMIT = 50;

/**
 * One recorded revision.
 *
 * It carries the bound, its provenance and its place in the chain. It deliberately carries NO
 * `isCurrent`, `isEffective`, `allowed` or `enforced` field: the first two are the caller's own
 * arithmetic over the ordinals, and the last two are claims this authority may not make.
 */
export interface AgentMandateRevision {
  readonly mandateId: string;
  readonly agentId: string;
  readonly mandateRevision: number;
  readonly purpose: string;
  readonly proposalScope: readonly MandateScopeKind[];
  readonly effectiveFrom: string;
  readonly governanceDecisionId: string;
  readonly governanceSessionId: string;
  readonly establishedByActorId: string;
  readonly supersedesMandateId: string | null;
}

export type EffectiveAgentMandateRead =
  /** `mandate` is `null` when this agent has no mandate at all. That is a real answer. */
  | { readonly status: "known"; readonly mandate: AgentMandateRevision | null }
  | { readonly status: "unavailable"; readonly reason: string };

export type AgentMandateHistoryRead =
  | {
      readonly status: "known";
      readonly revisions: readonly AgentMandateRevision[];
      /** The page bound that was applied, so a caller can tell a full page from a complete list. */
      readonly limit: number;
    }
  | { readonly status: "unavailable"; readonly reason: string };

function resolveDbOrNull(deps: AgentMandateReadDeps): ControlPlaneDatabase | null {
  if (deps.getDb) return deps.getDb();
  try {
    return getControlPlaneDb();
  } catch {
    return null;
  }
}

/**
 * Project a stored scope back into the typed vocabulary.
 *
 * A stored member outside the released vocabulary is DROPPED rather than surfaced, and that case is
 * unreachable through the writer and refused by the table's own CHECK. It is handled anyway,
 * because the alternative is a typed value that lies about what the vocabulary admits — and if a
 * later phase ever narrows the vocabulary, a historical row naming the removed kind must not make
 * this seam claim the kind is still admissible.
 */
function typedScope(stored: readonly string[] | null): readonly MandateScopeKind[] {
  if (!stored) return [];
  return stored.filter(isMandateScopeKind);
}

function project(row: {
  id: string;
  agentId: string;
  mandateRevision: number;
  purpose: string;
  proposalScope: string[] | null;
  effectiveFrom: Date | string;
  governanceDecisionId: string;
  governanceSessionId: string;
  establishedByActorId: string;
  supersedesMandateId: string | null;
}): AgentMandateRevision {
  return {
    mandateId: row.id,
    agentId: row.agentId,
    mandateRevision: row.mandateRevision,
    purpose: row.purpose,
    proposalScope: typedScope(row.proposalScope),
    effectiveFrom:
      row.effectiveFrom instanceof Date
        ? row.effectiveFrom.toISOString()
        : new Date(row.effectiveFrom).toISOString(),
    governanceDecisionId: row.governanceDecisionId,
    governanceSessionId: row.governanceSessionId,
    establishedByActorId: row.establishedByActorId,
    supersedesMandateId: row.supersedesMandateId,
  };
}

const SELECTION = {
  id: agentMandates.id,
  agentId: agentMandates.agentId,
  mandateRevision: agentMandates.mandateRevision,
  purpose: agentMandates.purpose,
  proposalScope: agentMandates.proposalScope,
  effectiveFrom: agentMandates.effectiveFrom,
  governanceDecisionId: agentMandates.governanceDecisionId,
  governanceSessionId: agentMandates.governanceSessionId,
  establishedByActorId: agentMandates.establishedByActorId,
  supersedesMandateId: agentMandates.supersedesMandateId,
} as const;

/**
 * The mandate currently in effect for ONE agent in the caller's tenant.
 *
 * The agent id is the only caller-supplied value, and it is compared rather than interpolated. The
 * tenant comes from an already-resolved server-side context; there is no parameter for one.
 */
export async function readEffectiveAgentMandate(
  tenant: TenantContext | null,
  agentId: string,
  deps: AgentMandateReadDeps = {},
): Promise<EffectiveAgentMandateRead> {
  if (typeof window !== "undefined") {
    throw new Error("Agent mandate reads are server-only.");
  }
  if (!tenant?.tenantId) return { status: "unavailable", reason: "no-authorized-tenant-context" };
  const id = typeof agentId === "string" ? agentId.trim() : "";
  /*
   * A MALFORMED ID IS NOT AN OUTAGE. It cannot name an agent, so the honest answer is that this
   * tenant holds no mandate for it — the same answer a real id with no mandate produces.
   */
  if (!id) return { status: "known", mandate: null };

  const db = resolveDbOrNull(deps);
  if (!db) return { status: "unavailable", reason: "persistence-not-configured" };

  try {
    const rows = await db
      .select(SELECTION)
      .from(agentMandates)
      .where(and(eq(agentMandates.tenantId, tenant.tenantId), eq(agentMandates.agentId, id)))
      /* Effective = the highest ordinal. Derived here, stored nowhere. */
      .orderBy(desc(agentMandates.mandateRevision))
      .limit(1);

    const row = rows[0];
    return { status: "known", mandate: row ? project(row) : null };
  } catch {
    return { status: "unavailable", reason: "read-failed" };
  }
}

/**
 * Every recorded revision for ONE agent, newest first.
 *
 * History is what makes a change reviewable: an earlier revision is never edited and never deleted,
 * so this returns exactly what each human authorized, at the time they authorized it.
 */
export async function readAgentMandateHistory(
  tenant: TenantContext | null,
  agentId: string,
  deps: AgentMandateReadDeps = {},
): Promise<AgentMandateHistoryRead> {
  if (typeof window !== "undefined") {
    throw new Error("Agent mandate reads are server-only.");
  }
  const limit = deps.limit ?? DEFAULT_MANDATE_HISTORY_LIMIT;
  if (!tenant?.tenantId) return { status: "unavailable", reason: "no-authorized-tenant-context" };
  const id = typeof agentId === "string" ? agentId.trim() : "";
  if (!id) return { status: "known", revisions: [], limit };

  const db = resolveDbOrNull(deps);
  if (!db) return { status: "unavailable", reason: "persistence-not-configured" };

  try {
    const rows = await db
      .select(SELECTION)
      .from(agentMandates)
      .where(and(eq(agentMandates.tenantId, tenant.tenantId), eq(agentMandates.agentId, id)))
      .orderBy(desc(agentMandates.mandateRevision))
      .limit(limit);

    return { status: "known", revisions: rows.map(project), limit };
  } catch {
    return { status: "unavailable", reason: "read-failed" };
  }
}
