/*
 * external-recipients/read-external-recipients.server.ts — tenant-scoped recipient reads (R3R).
 *
 * ── EVERY READ IS TENANT-SCOPED, AND A FOREIGN REF READS AS NOTHING ──────────
 *
 * Each query carries `eq(tenantId, tenant.tenantId)` in the same `and(...)` as the id. A reference
 * to another tenant's recipient therefore resolves to NOTHING AT ALL rather than to a refusal that
 * would confirm the row exists — the difference between "not found" and "not yours" is itself a
 * disclosure, and this module never makes it.
 *
 * ── PROPOSAL ELIGIBILITY IS NOT THE SAME AS READABILITY ──────────────────────
 *
 * `listActiveRecipients` offers only ACTIVE rows, because an action prepared today should be
 * prepared against an address the tenant still stands behind. `resolveRecipientReference` reads
 * ANY status, because a retired recipient must stay resolvable forever: a permit, an audit entry
 * or a historical surface that names it has to keep meaning something. Exactly the split R3W drew
 * between "only current revisions are offered as evidence" and "a superseded revision stays
 * readable through `resolveWorkArtifactReference`".
 *
 * Server-only. Reads only — nothing here writes, and nothing here decides.
 */
import { and, asc, eq } from "drizzle-orm";
import { type ControlPlaneDatabase } from "@/db/client.server";
import { externalRecipients } from "@/db/schema/external-recipient";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { resolveGovernanceDbOrNull } from "@/features/governance-decision/bootstrap-authority.server";
import type { RecipientListing, ResolveRecipientResult } from "./contracts";
import { parseRecipientRef } from "./recipient-ref";
import { toRecipientView, type RecipientRow } from "./recipient-view";

export interface RecipientReadDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
}

/** Bounded so a listing can never become a data export. */
const LIST_LIMIT = 200;

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("External recipients are server-only.");
  }
}

const COLUMNS = {
  id: externalRecipients.id,
  displayName: externalRecipients.displayName,
  endpointKind: externalRecipients.endpointKind,
  endpointValue: externalRecipients.endpointValue,
  endpointDigest: externalRecipients.endpointDigest,
  status: externalRecipients.status,
  createdAt: externalRecipients.createdAt,
  createdBy: externalRecipients.createdBy,
  createdByType: externalRecipients.createdByType,
} as const;

/** Live recipients, oldest first. The only set that may be proposed as an action referent. */
export async function listActiveRecipients(
  tenant: TenantContext | null,
  deps: RecipientReadDeps = {},
): Promise<RecipientListing> {
  assertServerOnly();
  if (!tenant?.tenantId) {
    return { recipients: [], unavailableReason: "No authenticated tenant context." };
  }

  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return { recipients: [], unavailableReason: "Recipient persistence is not connected." };

  const rows = await db
    .select(COLUMNS)
    .from(externalRecipients)
    .where(
      and(
        eq(externalRecipients.tenantId, tenant.tenantId),
        eq(externalRecipients.status, "active"),
      ),
    )
    .orderBy(asc(externalRecipients.createdAt))
    .limit(LIST_LIMIT);

  return { recipients: (rows as RecipientRow[]).map(toRecipientView) };
}

/**
 * Retired recipients, for a surface that shows what a tenant used to hold.
 *
 * Separate from the active listing rather than a `status` parameter, so a caller cannot widen the
 * proposable set by passing an argument. The evidence path calls the active one and has no way to
 * reach this.
 */
export async function listRetiredRecipients(
  tenant: TenantContext | null,
  deps: RecipientReadDeps = {},
): Promise<RecipientListing> {
  assertServerOnly();
  if (!tenant?.tenantId) {
    return { recipients: [], unavailableReason: "No authenticated tenant context." };
  }

  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return { recipients: [], unavailableReason: "Recipient persistence is not connected." };

  const rows = await db
    .select(COLUMNS)
    .from(externalRecipients)
    .where(
      and(
        eq(externalRecipients.tenantId, tenant.tenantId),
        eq(externalRecipients.status, "retired"),
      ),
    )
    .orderBy(asc(externalRecipients.createdAt))
    .limit(LIST_LIMIT);

  return { recipients: (rows as RecipientRow[]).map(toRecipientView) };
}

/**
 * Resolve one exact reference, whatever its status.
 *
 * NEVER SUBSTITUTES. A ref that does not resolve is refused; it is not repaired, not fuzzy-matched
 * to a similar address, and not swapped for "the recipient with the same email". Silently
 * resolving to a different row is how an approved send reaches the wrong person.
 */
export async function resolveRecipientReference(
  tenant: TenantContext | null,
  recordRef: unknown,
  deps: RecipientReadDeps = {},
): Promise<ResolveRecipientResult> {
  assertServerOnly();
  if (!tenant?.tenantId) return { status: "refused", reason: "unauthenticated" };

  const parsed = parseRecipientRef(recordRef);
  if (!parsed) return { status: "refused", reason: "recipient-not-found" };

  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return { status: "refused", reason: "persistence-unavailable" };

  const rows = await db
    .select(COLUMNS)
    .from(externalRecipients)
    .where(
      and(
        eq(externalRecipients.id, parsed.recipientId),
        eq(externalRecipients.tenantId, tenant.tenantId),
      ),
    )
    .limit(1);

  const row = rows[0] as RecipientRow | undefined;
  if (!row) return { status: "refused", reason: "recipient-not-found" };
  return { status: "resolved", recipient: toRecipientView(row) };
}
