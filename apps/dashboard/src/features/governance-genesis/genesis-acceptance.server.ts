/*
 * governance-genesis/genesis-acceptance.server.ts — KEY 2 of the two-key genesis ceremony (G2.1).
 *
 * WHAT THIS MODULE MAY DO, EXHAUSTIVELY: read this tenant's genesis nomination, and move exactly one
 * `pending` row to `accepted` when the CURRENTLY AUTHENTICATED human is the one it names.
 *
 * WHAT IT CANNOT DO, BY CONSTRUCTION:
 *   - it cannot CREATE a nomination. There is no insert in this file, and no product surface in the
 *     repository has one. Self-nomination therefore has no representation, rather than being
 *     forbidden by a check somebody could later remove;
 *   - it cannot create a Governance decision. It never touches `governance_sessions` or
 *     `decision_records`, and does not import their schema;
 *   - it cannot grant a role, a permission, a provider, or any execution authority;
 *   - it cannot accept on behalf of somebody else, or for another tenant.
 *
 * NOTHING IS CLIENT-SUPPLIED. `acceptGenesisNomination` takes a `TenantContext` and nothing else.
 * The tenant, the user, the identity, the session and the assurance level are all resolved
 * server-side from the durable session row. A forged `tenantId`, `userId`, `authIdentityId`,
 * `roleId`, `status` or `acceptedAt` has no parameter to arrive in — the attack is unrepresentable,
 * not merely rejected.
 *
 * ONE-TIME BY DATABASE PREDICATE, NOT BY READ-THEN-WRITE. The update carries
 * `where status = 'pending'`. A replay, a double-submit, or two concurrent acceptances all resolve
 * in Postgres: exactly one update affects a row and every other affects zero. This is the K3 lesson
 * applied to a constitutional act — the database is the final defense, never the application's
 * earlier read.
 *
 * Server-only.
 */
import { and, eq } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { genesisNominations } from "@/db/schema/genesis-nomination";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { recordGenesisNominationWithin } from "@/features/governance-audit/genesis-nomination-audit.server";
import {
  type GenesisAcceptanceResult,
  type GenesisNominationLookup,
  type GenesisNominationView,
} from "./contracts";

export interface GenesisDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly now?: () => Date;
}

/** The control-plane database, or an honest `null` when it is not configured. */
export function resolveGenesisDbOrNull(): ControlPlaneDatabase | null {
  if (!process.env.DATABASE_URL?.trim()) return null;
  try {
    return getControlPlaneDb();
  } catch {
    return null;
  }
}

/** True when the durable store backing genesis nominations is actually configured. */
export function isGenesisPersistenceConfigured(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return Boolean(env.DATABASE_URL?.trim());
}

/**
 * Read this tenant's genesis nomination, if any.
 *
 * Tenant-scoped by predicate. `viewerIsNominatedHuman` is computed from the SESSION's identity and
 * user — the surface is never told who the nominated human is, only whether it is the viewer, so
 * the page cannot become a way to enumerate other people.
 */
export async function readGenesisNomination(
  tenant: TenantContext | null,
  deps: GenesisDeps = {},
): Promise<GenesisNominationLookup> {
  if (typeof window !== "undefined") {
    throw new Error("Genesis nomination reads are server-only.");
  }
  if (!tenant?.tenantId) {
    return { status: "unavailable", reason: "no-authorized-tenant-context" };
  }
  const db = (deps.getDb ?? resolveGenesisDbOrNull)();
  if (!db) return { status: "unavailable", reason: "persistence-unavailable" };

  try {
    const rows = await db
      .select()
      .from(genesisNominations)
      .where(eq(genesisNominations.tenantId, tenant.tenantId))
      .limit(1);
    const row = rows[0];
    if (!row) return { status: "read", nomination: null };

    const view: GenesisNominationView = {
      nominationId: row.id,
      status: row.status,
      nominatedAt: row.nominatedAt.toISOString(),
      acceptedAt: row.acceptedAt ? row.acceptedAt.toISOString() : null,
      // BOTH must match. A row whose identity and user disagree can never be viewed as the
      // viewer's own, and can never be accepted — see acceptGenesisNomination.
      viewerIsNominatedHuman:
        row.nominatedAuthIdentityId === tenant.authIdentityId &&
        row.nominatedUserId === tenant.userId,
    };
    return { status: "read", nomination: view };
  } catch {
    return { status: "unavailable", reason: "persistence-unavailable" };
  }
}

/**
 * Accept this tenant's pending genesis nomination as the authenticated human.
 *
 * The acceptance and its audit row commit in ONE transaction: "entitlement accepted but no history"
 * and "history claims an acceptance that rolled back" are excluded by the transaction, not by hoping.
 *
 * Refusals are NOT audited. That is the boundary G1 already drew and this phase repeats: a wrong
 * human, a wrong tenant or a replay is an event about a principal, not a change to the tenant's
 * entitlement. Recording it here would both duplicate an authority and let an unauthorised caller
 * append to a tenant's ledger at will.
 */
export async function acceptGenesisNomination(
  tenant: TenantContext | null,
  deps: GenesisDeps = {},
): Promise<GenesisAcceptanceResult> {
  if (typeof window !== "undefined") {
    throw new Error("Genesis acceptance is server-only.");
  }
  if (!tenant?.tenantId || !tenant.userId || !tenant.authIdentityId) {
    return { status: "refused", reason: "unauthenticated" };
  }
  const db = (deps.getDb ?? resolveGenesisDbOrNull)();
  if (!db) return { status: "refused", reason: "persistence-unavailable" };
  const now = (deps.now ?? (() => new Date()))();

  try {
    const rows = await db
      .select()
      .from(genesisNominations)
      .where(eq(genesisNominations.tenantId, tenant.tenantId))
      .limit(1);
    const row = rows[0];
    if (!row) return { status: "refused", reason: "no-nomination" };

    /*
     * The identity gate. BOTH the durable identity and the canonical user must be the session's own.
     * Checking both is what makes a mismatched row (one whose identity and user belong to different
     * people) unacceptable rather than exploitable: no session can ever satisfy both halves of it.
     */
    if (
      row.nominatedAuthIdentityId !== tenant.authIdentityId ||
      row.nominatedUserId !== tenant.userId
    ) {
      return { status: "refused", reason: "not-the-nominated-human" };
    }
    if (row.status === "accepted") return { status: "refused", reason: "already-accepted" };
    if (row.status === "revoked") return { status: "refused", reason: "revoked" };

    let accepted = false;
    await db.transaction(async (tx) => {
      /*
       * The read above informed the refusal wording; THIS predicate is the authority. Between the
       * two, another request may have accepted the same nomination — `status = 'pending'` means
       * that request wins and this one updates nothing.
       */
      const updated = await tx
        .update(genesisNominations)
        .set({
          status: "accepted",
          acceptedAt: now,
          acceptedSessionContextId: tenant.sessionContextId,
          // Recorded from the SESSION, never claimed. Today this is always aal1.
          acceptedAssuranceLevel: tenant.assuranceLevel,
          updatedAt: now,
          updatedBy: tenant.userId,
          updatedByType: "human",
        })
        .where(
          and(
            eq(genesisNominations.id, row.id),
            eq(genesisNominations.tenantId, tenant.tenantId),
            eq(genesisNominations.nominatedAuthIdentityId, tenant.authIdentityId),
            eq(genesisNominations.nominatedUserId, tenant.userId),
            eq(genesisNominations.status, "pending"),
          ),
        )
        .returning({ id: genesisNominations.id });

      if (updated.length === 0) {
        // Somebody else got there first. Nothing changed, and no history is written for a
        // no-op — the row's existing `accepted` state is already the truthful record.
        return;
      }

      await recordGenesisNominationWithin(
        tx,
        {
          tenantId: tenant.tenantId,
          userId: tenant.userId,
          requestId: tenant.requestId,
          sessionContextId: tenant.sessionContextId,
        },
        {
          action: "governance.genesis-nomination.accepted",
          nominationId: row.id,
          metadata: {
            nominatedUserId: row.nominatedUserId,
            nominatedAuthIdentityId: row.nominatedAuthIdentityId,
            nominationSource: row.nominationSource,
            assuranceLevel: tenant.assuranceLevel,
            mfaVerified: false,
          },
        },
        now,
      );
      accepted = true;
    });

    return accepted
      ? { status: "accepted", nominationId: row.id, acceptedAt: now.toISOString() }
      : { status: "refused", reason: "already-accepted" };
  } catch {
    return { status: "refused", reason: "persistence-unavailable" };
  }
}
