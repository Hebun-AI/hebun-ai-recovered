/*
 * knowledge/current-versions-read.server.ts — the Knowledge half of the review observation (KGA).
 *
 * ── IT IS A DOOR, NOT AN AUTHORITY ───────────────────────────────────────────
 *
 * The same three lines of work `company-understanding-read.server.ts` does: open the gates the
 * Knowledge reads already open, ask the canonical repository, hand back what it said. It resolves
 * no second authority, opens no writer, calls no model, contacts no provider, writes no audit row
 * and persists nothing.
 *
 * ── WHAT IT DELIBERATELY DOES NOT KNOW ───────────────────────────────────────
 *
 * Whether any of these versions has been decided. That question belongs to Governance and is asked
 * of Governance; this seam would answer it wrongly if it tried, because a REJECTED version carries
 * no mark anywhere in Knowledge. Keeping the ignorance here is what makes the composition above
 * attributable to two owners instead of to neither.
 *
 * ── FAIL-CLOSED IN THE SAME ORDER, FOR THE SAME REASON ───────────────────────
 *
 *   1. an authorized TenantContext must exist (the client never supplies one),
 *   2. durable persistence must be configured,
 *   3. only then is anything read, and only within that tenant.
 *
 * The unavailable reasons are `knowledge-read.server.ts`'s own vocabulary rather than a new one.
 *
 * No band check: this returns identities and one timestamp, never a statement, and the caller is
 * a server-side observation that renders neither.
 *
 * Server-only.
 */
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  resolveKnowledgeRepoOrNull,
  type CurrentKnowledgeVersion,
  type DurableKnowledgeRepository,
} from "./durable-knowledge-repository.server";

export interface CurrentVersionsReadDeps {
  /** Returns the durable repository, or null when persistence is not configured. */
  readonly getRepo?: () => DurableKnowledgeRepository | null;
  /** Injected clock, so the in-force window is evaluated against one pinned instant. */
  readonly now?: () => Date;
}

export type CurrentVersionsRead =
  | { readonly status: "read"; readonly versions: readonly CurrentKnowledgeVersion[] }
  | { readonly status: "unavailable"; readonly reason: string };

/**
 * Every current, in-force Knowledge version this tenant holds.
 *
 * An EMPTY list is a measured answer — this organization holds no current Knowledge — and is
 * returned as `read`, never as unavailable. The distinction is the one E2-4 keeps everywhere:
 *
 *     UNAVAILABLE != NOTHING TO REVIEW
 */
export async function readCurrentKnowledgeVersions(
  tenant: Pick<TenantContext, "tenantId"> | null,
  deps: CurrentVersionsReadDeps = {},
): Promise<CurrentVersionsRead> {
  if (typeof window !== "undefined") {
    throw new Error("Current Knowledge version reads are server-only.");
  }
  if (!tenant?.tenantId) {
    return { status: "unavailable", reason: "no-authorized-tenant-context" };
  }

  const repo = (deps.getRepo ?? resolveKnowledgeRepoOrNull)();
  if (!repo) return { status: "unavailable", reason: "persistence-not-configured" };

  try {
    const versions = await repo.listCurrentVersions(
      { tenantId: tenant.tenantId },
      deps.now?.() ?? new Date(),
    );
    return { status: "read", versions };
  } catch {
    return { status: "unavailable", reason: "read-failed" };
  }
}
