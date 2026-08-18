/*
 * knowledge/company-understanding-read.server.ts — the Company Understanding read seam (R6B).
 *
 * ── IT IS A DOOR, NOT AN AUTHORITY ───────────────────────────────────────────
 *
 * Three lines of work: open the gates the Knowledge reads already open, ask the canonical
 * repository for its per-domain counts, hand them to the pure projection. It resolves no second
 * authority, opens no writer, calls no model, contacts no provider, writes no audit row, and
 * persists nothing — a projection that stored itself would immediately become a second, staler
 * source of truth about Knowledge.
 *
 * ── THE SAME FAIL-CLOSED ORDER, FOR THE SAME REASON ──────────────────────────
 *
 *   1. an authorized TenantContext must exist (the client never supplies one),
 *   2. durable persistence must be configured,
 *   3. only then is anything read, and only within that tenant.
 *
 * The unavailable reasons are `knowledge-read.server.ts`'s own vocabulary rather than a new one:
 * this reads the same authority through the same repository, so a reader who learns what
 * `persistence-not-configured` means on one surface has learned it for both.
 *
 * ── NO SEPARATE AUTHORITY GATE, AND WHY THAT IS CORRECT ──────────────────────
 *
 * Authoring Knowledge needs the owner/director band; READING it needs a tenant. This is a read, and
 * it shows nothing `/knowledge` does not already show the same viewer through `listKnowledgeSources`
 * — counts derived from records they can already see. Adding a band check here would be a second
 * authority over one question, and a stricter one than the data it guards.
 *
 * Server-only.
 */

import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  resolveKnowledgeRepoOrNull,
  type DurableKnowledgeRepository,
} from "./durable-knowledge-repository.server";
import { projectCompanyUnderstanding, type CompanyUnderstandingView } from "./company-understanding";

/** The narrow slice of a TenantContext this read depends on. */
export type CompanyUnderstandingTenant = Pick<TenantContext, "tenantId">;

export interface CompanyUnderstandingReadDeps {
  /** Returns the durable repository, or null when persistence is not configured. */
  readonly getRepo?: () => DurableKnowledgeRepository | null;
  /** Injected clock, so coverage and freshness derivation are deterministic in tests. */
  readonly now?: () => Date;
}

/** Why the view could not be produced. Each names the missing thing exactly. */
export type CompanyUnderstandingUnavailableReason =
  /** No authorized tenant context — the read failed closed and touched nothing. */
  | "no-authorized-tenant-context"
  /** The durable control-plane database is not configured. */
  | "persistence-not-configured"
  /** The aggregate itself failed. */
  | "read-failed";

export type CompanyUnderstandingResult =
  | { readonly status: "read"; readonly view: CompanyUnderstandingView }
  | {
      readonly status: "unavailable";
      readonly reason: CompanyUnderstandingUnavailableReason;
      readonly detail: string;
    };

function assertServerRuntime(): void {
  if (typeof window !== "undefined") {
    throw new Error("Company Understanding reads are server-only.");
  }
}

/**
 * The organization's coverage across the declared areas.
 *
 * Honest when empty: a tenant holding nothing gets every declared category reported as MISSING,
 * which is its real state — never a seeded or flattering one.
 */
export async function readCompanyUnderstanding(
  tenant: CompanyUnderstandingTenant | null,
  deps: CompanyUnderstandingReadDeps = {},
): Promise<CompanyUnderstandingResult> {
  assertServerRuntime();

  if (!tenant?.tenantId) {
    return {
      status: "unavailable",
      reason: "no-authorized-tenant-context",
      detail: "No authorized organization context, so nothing was read.",
    };
  }

  const repo = (deps.getRepo ?? resolveKnowledgeRepoOrNull)();
  if (!repo) {
    return {
      status: "unavailable",
      reason: "persistence-not-configured",
      detail:
        "Durable persistence is not configured, so the canonical Knowledge tables cannot be read.",
    };
  }

  const now = (deps.now ?? (() => new Date()))();

  try {
    const counts = await repo.countFactsByDomain({ tenantId: tenant.tenantId }, now);
    return { status: "read", view: projectCompanyUnderstanding(counts, now) };
  } catch (error) {
    return {
      status: "unavailable",
      reason: "read-failed",
      detail: error instanceof Error ? error.message : "Company Understanding read failed.",
    };
  }
}
