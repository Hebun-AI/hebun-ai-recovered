/*
 * standing-observation-authority/read-standing-observations.server.ts — what this tenant has
 * standing permission to observe (TRH-23).
 *
 * READ-ONLY, and read-only in the way that can be proved: this module contains no insert, no update,
 * no delete and no transaction. It grants nothing, decides nothing, and starts nothing.
 *
 * ── EFFECTIVE IS DERIVED, NEVER STORED ───────────────────────────────────────
 *
 * The effective authorization for a lineage is the row with the highest `authorization_revision`.
 * That is applied HERE, on the read path, and in the writer, on the write path — and nowhere else.
 * There is no `is_current` column to disagree with it, which is why there is nothing to keep in
 * step.
 *
 * A lineage whose effective revision says `withdrawn` is REPORTED, not hidden. "Nothing is
 * authorized" and "this was authorized and then taken away" are different facts, and a reader that
 * filtered withdrawals would make the second unaskable.
 *
 * ── UNAVAILABLE IS NOT ABSENT ────────────────────────────────────────────────
 *
 * Telling a tenant it has authorized nothing when the truth is that the authority could not be
 * reached is a fabricated absence.
 *
 * Server-only.
 */
import { and, desc, eq } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { standingObservationAuthorizations } from "@/db/schema/standing-observation-authorization";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import type {
  StandingObservationAuthorizationRecord,
  StandingObservationHistoryResult,
  StandingObservationReadResult,
  StandingObservationScope,
} from "./contracts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Bounded so a listing is never a data export. */
const HISTORY_LIMIT = 200;

export interface StandingObservationReadDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
}

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("Standing observation reads are server-only.");
  }
}

function resolveDbOrNull(deps: StandingObservationReadDeps): ControlPlaneDatabase | null {
  if (deps.getDb) return deps.getDb();
  try {
    return getControlPlaneDb();
  } catch {
    return null;
  }
}

/** Every column a record needs, selected once so the two readers cannot drift. */
const RECORD_COLUMNS = {
  id: standingObservationAuthorizations.id,
  revision: standingObservationAuthorizations.authorizationRevision,
  state: standingObservationAuthorizations.state,
  providerKey: standingObservationAuthorizations.providerKey,
  capabilityKey: standingObservationAuthorizations.capabilityKey,
  subjectKind: standingObservationAuthorizations.subjectKind,
  subjectRef: standingObservationAuthorizations.subjectRef,
  integrationId: standingObservationAuthorizations.integrationId,
  intervalMinutes: standingObservationAuthorizations.intervalMinutes,
  governanceDecisionId: standingObservationAuthorizations.governanceDecisionId,
  governanceSessionId: standingObservationAuthorizations.governanceSessionId,
  authorizedByActorId: standingObservationAuthorizations.authorizedByActorId,
  authorizedAt: standingObservationAuthorizations.authorizedAt,
  supersedesAuthorizationId: standingObservationAuthorizations.supersedesAuthorizationId,
} as const;

type RecordRow = {
  readonly id: string;
  readonly revision: number;
  readonly state: "active" | "withdrawn";
  readonly providerKey: string;
  readonly capabilityKey: string;
  readonly subjectKind: string;
  readonly subjectRef: string;
  readonly integrationId: string;
  readonly intervalMinutes: number;
  readonly governanceDecisionId: string;
  readonly governanceSessionId: string;
  readonly authorizedByActorId: string;
  readonly authorizedAt: Date;
  readonly supersedesAuthorizationId: string | null;
};

function toRecord(row: RecordRow): StandingObservationAuthorizationRecord {
  return {
    authorizationId: row.id,
    authorizationRevision: row.revision,
    state: row.state,
    providerKey: row.providerKey,
    capabilityKey: row.capabilityKey,
    subjectKind: row.subjectKind,
    subjectRef: row.subjectRef,
    integrationId: row.integrationId,
    intervalMinutes: row.intervalMinutes,
    governanceDecisionId: row.governanceDecisionId,
    governanceSessionId: row.governanceSessionId,
    authorizedByActorId: row.authorizedByActorId,
    authorizedAt: row.authorizedAt.toISOString(),
    supersedesAuthorizationId: row.supersedesAuthorizationId,
  };
}

/**
 * The EFFECTIVE revision for one exact scope, or `null` when this tenant has never authorized it.
 *
 * Tenant-scoped by predicate. There is no unscoped and no cross-tenant query in this module, so a
 * caller can only ever ask about its own tenant; a scope belonging to another tenant returns `null`,
 * indistinguishable from one that was never authorized.
 */
export async function readEffectiveStandingObservation(
  tenant: Pick<TenantContext, "tenantId"> | null,
  scope: StandingObservationScope,
  deps: StandingObservationReadDeps = {},
): Promise<StandingObservationReadResult> {
  assertServerOnly();
  if (!tenant?.tenantId) return { status: "unavailable", reason: "no-authorized-tenant-context" };
  const db = resolveDbOrNull(deps);
  if (!db) return { status: "unavailable", reason: "persistence-not-configured" };
  if (!UUID_RE.test(tenant.tenantId)) return { status: "read", effective: null };

  try {
    const rows = await db
      .select(RECORD_COLUMNS)
      .from(standingObservationAuthorizations)
      .where(
        and(
          eq(standingObservationAuthorizations.tenantId, tenant.tenantId),
          eq(standingObservationAuthorizations.providerKey, scope.providerKey),
          eq(standingObservationAuthorizations.capabilityKey, scope.capabilityKey),
          eq(standingObservationAuthorizations.subjectRef, scope.subjectRef),
        ),
      )
      .orderBy(desc(standingObservationAuthorizations.authorizationRevision))
      .limit(1);

    const row = rows[0] as RecordRow | undefined;
    return { status: "read", effective: row ? toRecord(row) : null };
  } catch {
    return { status: "unavailable", reason: "persistence-unavailable" };
  }
}

/**
 * Every revision ever written for one scope, newest first.
 *
 * This is the whole point of append-only storage: a human can see that a scope was authorized on one
 * date, narrowed on another and withdrawn on a third, and each of those rows still says which
 * Governance decision caused it.
 */
export async function readStandingObservationHistory(
  tenant: Pick<TenantContext, "tenantId"> | null,
  scope: StandingObservationScope,
  deps: StandingObservationReadDeps = {},
): Promise<StandingObservationHistoryResult> {
  assertServerOnly();
  if (!tenant?.tenantId) return { status: "unavailable", reason: "no-authorized-tenant-context" };
  const db = resolveDbOrNull(deps);
  if (!db) return { status: "unavailable", reason: "persistence-not-configured" };
  if (!UUID_RE.test(tenant.tenantId)) return { status: "read", revisions: [] };

  try {
    const rows = await db
      .select(RECORD_COLUMNS)
      .from(standingObservationAuthorizations)
      .where(
        and(
          eq(standingObservationAuthorizations.tenantId, tenant.tenantId),
          eq(standingObservationAuthorizations.providerKey, scope.providerKey),
          eq(standingObservationAuthorizations.capabilityKey, scope.capabilityKey),
          eq(standingObservationAuthorizations.subjectRef, scope.subjectRef),
        ),
      )
      .orderBy(desc(standingObservationAuthorizations.authorizationRevision))
      .limit(HISTORY_LIMIT);

    return { status: "read", revisions: (rows as RecordRow[]).map(toRecord) };
  } catch {
    return { status: "unavailable", reason: "persistence-unavailable" };
  }
}

/**
 * Every lineage this tenant has ever touched, at its EFFECTIVE revision, newest authorization first.
 *
 * Withdrawn lineages are included, for the reason the header gives: "nothing is authorized" and "it
 * was taken away" are different answers and a reader must be able to tell them apart.
 */
export async function listEffectiveStandingObservations(
  tenant: Pick<TenantContext, "tenantId"> | null,
  deps: StandingObservationReadDeps = {},
): Promise<StandingObservationHistoryResult> {
  assertServerOnly();
  if (!tenant?.tenantId) return { status: "unavailable", reason: "no-authorized-tenant-context" };
  const db = resolveDbOrNull(deps);
  if (!db) return { status: "unavailable", reason: "persistence-not-configured" };
  if (!UUID_RE.test(tenant.tenantId)) return { status: "read", revisions: [] };

  try {
    const rows = (await db
      .select(RECORD_COLUMNS)
      .from(standingObservationAuthorizations)
      .where(eq(standingObservationAuthorizations.tenantId, tenant.tenantId))
      .orderBy(desc(standingObservationAuthorizations.authorizationRevision))
      .limit(HISTORY_LIMIT)) as RecordRow[];

    /*
     * ONE ROW PER LINEAGE, AND IT IS THE HIGHEST REVISION. The query is ordered by revision
     * descending, so the first row seen for a lineage key is its effective one. Doing the reduction
     * here rather than in SQL keeps the definition of "effective" identical to the one the single
     * -scope reader and the writer both apply.
     */
    const seen = new Set<string>();
    const effective: StandingObservationAuthorizationRecord[] = [];
    for (const row of rows) {
      const key = `${row.providerKey} ${row.capabilityKey} ${row.subjectRef}`;
      if (seen.has(key)) continue;
      seen.add(key);
      effective.push(toRecord(row));
    }
    return { status: "read", revisions: effective };
  } catch {
    return { status: "unavailable", reason: "persistence-unavailable" };
  }
}
