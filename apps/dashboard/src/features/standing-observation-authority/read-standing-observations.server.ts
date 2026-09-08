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

/* ═══════════════════════════════════════════════════════════════════════════
 * TRH-25 — PLATFORM RUNTIME DISCOVERY. NOT A TENANT PRODUCT READ.
 *
 * ── WHY THIS SEAM HAS NO TENANT PARAMETER, AND WHY THAT IS THE SAFE SHAPE ───
 *
 * Every other reader here requires a tenant, because every other reader answers a question a
 * PERSON asked inside one organization. This one answers a question nobody asked: which
 * authorizations, across the whole deployment, may be attempted right now.
 *
 * A tenant parameter would be the dangerous shape, not the safe one. A trigger that could NAME a
 * tenant could CHOOSE one, and "the caller says tenantId = X and thereby operates on X" is the
 * exact attack the whole design exists to prevent. So there is no filter of any kind: no tenant,
 * no provider, no capability, no subject, no connection, no limit a caller can set. The scope of
 * every returned row is whatever that row says.
 *
 * WHAT IT RETURNS IS AN AUTHORIZATION ID AND FACTS ABOUT IT — never a permission. Holding one of
 * these rows authorizes nothing: the authoritative decision is still made later, by the
 * revalidator, immediately before transport, against a freshly re-read row.
 *
 * ── EFFECTIVE, ACTIVE, AND REDUCED THE SAME WAY AS EVERY OTHER READER ───────
 *
 * The reduction is deliberately IDENTICAL to `listEffectiveStandingObservations` — highest
 * revision per lineage wins — with the lineage key widened by tenant, because two organizations
 * may authorize the same provider, capability and subject. Re-deriving "effective" in SQL would
 * create a second definition of the word, free to disagree with the one the writer and every
 * reader already apply.
 *
 * Withdrawn lineages are dropped HERE rather than reported, because this seam's only consumer is a
 * runtime asking what to attempt, and "it was taken away" is not something to attempt. Human
 * readers still get the withdrawn rows from the tenant-scoped reader, which is unchanged.
 *
 * ── IT READS NOTHING ELSE ───────────────────────────────────────────────────
 *
 * One table. No credential, no connection health, no capability availability, no provider and no
 * Governance record is read here, and none is written. Server-only.
 * ═══════════════════════════════════════════════════════════════════════════ */

/** One authorization a runtime may ATTEMPT. Carries no permission and no secret. */
export interface EffectiveStandingObservation {
  readonly authorizationId: string;
  readonly tenantId: string;
  readonly authorizationRevision: number;
  readonly providerKey: string;
  readonly capabilityKey: string;
  readonly subjectKind: string;
  readonly subjectRef: string;
  readonly integrationId: string;
  readonly intervalMinutes: number;
}

export type ActiveStandingObservationsResult =
  | { readonly status: "read"; readonly authorizations: readonly EffectiveStandingObservation[] }
  | { readonly status: "unavailable"; readonly reason: "persistence-unavailable" };

/**
 * Every ACTIVE, EFFECTIVE standing observation authorization in the deployment.
 *
 * Takes no arguments beyond injection. There is no parameter through which a caller could narrow,
 * widen, order or target this — which is what makes it safe to expose to a machine trigger.
 */
export async function listActiveStandingObservationsForRuntime(
  deps: StandingObservationReadDeps = {},
): Promise<ActiveStandingObservationsResult> {
  assertServerOnly();
  const db = resolveDbOrNull(deps);
  if (!db) return { status: "unavailable", reason: "persistence-unavailable" };

  try {
    const rows = (await db
      .select({ ...RECORD_COLUMNS, tenantId: standingObservationAuthorizations.tenantId })
      .from(standingObservationAuthorizations)
      .orderBy(desc(standingObservationAuthorizations.authorizationRevision))) as (RecordRow & {
      readonly tenantId: string;
    })[];

    const seen = new Set<string>();
    const active: EffectiveStandingObservation[] = [];
    for (const row of rows) {
      /* THE LINEAGE KEY IS WIDENED BY TENANT and by nothing else — two organizations may hold the
       * same provider, capability and subject, and collapsing them would let one tenant's newer
       * revision hide another tenant's authorization entirely. */
      const key = `${row.tenantId} ${row.providerKey} ${row.capabilityKey} ${row.subjectRef}`;
      if (seen.has(key)) continue;
      seen.add(key);
      /* The EFFECTIVE revision decides. A withdrawn effective revision is not attemptable, and an
       * older active one beneath it must never resurrect the lineage. */
      if (row.state !== "active") continue;
      active.push({
        authorizationId: row.id,
        tenantId: row.tenantId,
        authorizationRevision: row.revision,
        providerKey: row.providerKey,
        capabilityKey: row.capabilityKey,
        subjectKind: row.subjectKind,
        subjectRef: row.subjectRef,
        integrationId: row.integrationId,
        intervalMinutes: row.intervalMinutes,
      });
    }
    return { status: "read", authorizations: active };
  } catch {
    return { status: "unavailable", reason: "persistence-unavailable" };
  }
}
