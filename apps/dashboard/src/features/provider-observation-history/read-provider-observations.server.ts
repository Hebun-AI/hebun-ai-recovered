/*
 * provider-observation-history/read-provider-observations.server.ts — the read seam (TRH-21).
 *
 * ── WHAT IT RETURNS, AND WHAT IT REFUSES TO ──────────────────────────────────
 *
 * Stored observations for ONE tenant, newest first, bounded. That is all.
 *
 * It computes NO delta, NO rate, NO direction, NO cadence, NO score and NO summary. TRH-21 stores
 * history and derives nothing from it, and this file is where that restraint has to be visible:
 * a "helpful" subtraction here would be the first derived metric, with no owner and no rule about
 * how many samples earn a word like *trend*.
 *
 * Two rows are two rows. Whether they mean anything is a question this seam cannot answer and does
 * not try to.
 *
 * Server-only.
 */
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { providerObservations } from "@/db/schema/provider-observation";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import type { ObservationFacts, StoredProviderObservation } from "./contracts";

/** One page. A history read is a bounded page, never "everything ever observed". */
export const MAX_OBSERVATIONS_PER_READ = 50 as const;

export interface ProviderObservationReadDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
}

export interface ProviderObservationQuery {
  readonly providerKey?: string;
  /**
   * WHICH CAPABILITY'S OBSERVATIONS. Optional, and omitting it means "any".
   *
   * ── WHY THIS EXISTS, AND WHAT IT COST TO LEARN ──────────────────────────
   *
   * While a provider had exactly one observable capability, "the newest observation for this
   * provider" was an unambiguous question and this predicate was unnecessary. A second Instagram
   * capability made it ambiguous, and the ambiguity did not announce itself: the account surface
   * asked for the newest Instagram observation, received a MEDIA row, found none of the account
   * fact keys on it, and truthfully reported every one of them as "the provider did not report
   * this" — about facts the provider had reported hours earlier.
   *
   * The lesson is the shape of the failure rather than the missing line. The authorize ceremony hit
   * the same ambiguity on the same day and REFUSED, because it could not know which scope a human
   * meant. This seam could not refuse — a read has to return something — so it returned the wrong
   * row and let a projection describe it. A filter a caller cannot express is a filter every caller
   * silently omits.
   *
   * Different capabilities of one provider carry DIFFERENT FACT VOCABULARIES. A consumer that
   * understands one of them must say which one it means.
   */
  readonly capabilityKey?: string;
  readonly subjectRef?: string;
  /**
   * ONE EXACT STORED OBSERVATION, BY ITS DURABLE ID (SOC-ACT1).
   *
   * ── WHY AN EXACT PREDICATE AND NOT A WINDOW SCAN ────────────────────────
   *
   * A governed proposal cites the observation it rests on, and a human later approves a payload
   * that names it. Resolving that citation by reading a bounded window and matching in memory
   * would make the answer depend on how many observations happened to arrive since — an
   * observation older than the window would resolve as ABSENT while still existing, and the
   * refusal would be about the window rather than about the row. A citation must resolve to the
   * row it names or to nothing.
   *
   * ── IT NARROWS; IT CANNOT WIDEN ─────────────────────────────────────────
   *
   * This predicate is ANDed with the unconditional tenant predicate below, exactly as every other
   * optional predicate here is. There is no argument — this one included — that can reach a row
   * belonging to another tenant: a foreign id simply matches nothing, and the seam answers with an
   * empty read rather than with a different row. That is why a cross-tenant lookup is
   * unrepresentable here rather than merely refused.
   *
   * Omitting it leaves every existing caller's behaviour byte-identical.
   */
  readonly observationId?: string;
  readonly limit?: number;
}

export type ProviderObservationReadResult =
  | { readonly status: "read"; readonly observations: readonly StoredProviderObservation[] }
  | { readonly status: "unavailable"; readonly reason: "unauthenticated" | "persistence-unavailable" };

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("Provider observation history is server-only.");
  }
}

function resolveDbOrNull(deps: ProviderObservationReadDeps): ControlPlaneDatabase | null {
  if (deps.getDb) return deps.getDb();
  try {
    return getControlPlaneDb();
  } catch {
    return null;
  }
}

/**
 * Read one tenant's stored observations.
 *
 * THE TENANT PREDICATE IS NOT OPTIONAL AND IS NOT A FILTER A CALLER SUPPLIES. It comes from the
 * authorized context, and there is no argument that could widen it — which is what makes a
 * cross-tenant read unrepresentable at this seam rather than merely unlikely.
 */
export async function readProviderObservations(
  tenant: TenantContext | null,
  query: ProviderObservationQuery = {},
  deps: ProviderObservationReadDeps = {},
): Promise<ProviderObservationReadResult> {
  assertServerOnly();
  if (!tenant?.tenantId) return { status: "unavailable", reason: "unauthenticated" };

  const db = resolveDbOrNull(deps);
  if (!db) return { status: "unavailable", reason: "persistence-unavailable" };

  const limit = Math.min(Math.max(query.limit ?? MAX_OBSERVATIONS_PER_READ, 1), MAX_OBSERVATIONS_PER_READ);
  const predicates = [eq(providerObservations.tenantId, tenant.tenantId)];
  if (query.providerKey) predicates.push(eq(providerObservations.providerKey, query.providerKey));
  if (query.capabilityKey) predicates.push(eq(providerObservations.capabilityKey, query.capabilityKey));
  if (query.subjectRef) predicates.push(eq(providerObservations.subjectRef, query.subjectRef));
  /*
   * SOC-ACT1. Added to the SAME predicate list as every other filter, so it is ANDed with the
   * tenant predicate and can only ever narrow the answer.
   *
   * THE COLUMN IS `uuid`, SO THE CALLER OWES A UUID. A value that is not one is a malformed
   * citation, and malformed citations are rejected by `parseProviderObservationRef` before they
   * ever reach this seam — which is where that check belongs, because only the reference module
   * knows what a canonical reference looks like. Guarding again here would put a second, drifting
   * opinion about reference syntax inside the read authority.
   */
  if (query.observationId) predicates.push(eq(providerObservations.id, query.observationId));

  try {
    const rows = await db
      .select({
        observationId: providerObservations.id,
        providerKey: providerObservations.providerKey,
        capabilityKey: providerObservations.capabilityKey,
        subjectKind: providerObservations.subjectKind,
        subjectRef: providerObservations.subjectRef,
        integrationId: providerObservations.integrationId,
        observedAt: providerObservations.observedAt,
        recordedAt: providerObservations.recordedAt,
        observedByActorType: providerObservations.observedByActorType,
        standingAuthorizationId: providerObservations.standingAuthorizationId,
        invocationId: providerObservations.invocationId,
        facts: providerObservations.facts,
      })
      .from(providerObservations)
      .where(and(...predicates))
      .orderBy(desc(providerObservations.observedAt))
      .limit(limit);

    return {
      status: "read",
      observations: rows.map((row) =>
        Object.freeze({
          observationId: row.observationId,
          providerKey: row.providerKey,
          capabilityKey: row.capabilityKey,
          subjectKind: row.subjectKind,
          subjectRef: row.subjectRef,
          integrationId: row.integrationId,
          observedAt: row.observedAt.toISOString(),
          recordedAt: row.recordedAt.toISOString(),
          /*
           * THE MODE IS DERIVED FROM WHICH SIDE IS PRESENT, never stored a third time. The database
           * guarantees exactly one is, so this cannot report a state the row does not hold.
           */
          provenance: row.standingAuthorizationId === null ? "human" : "standing-authorization",
          observedByActorType: row.observedByActorType,
          standingAuthorizationId: row.standingAuthorizationId,
          invocationId: row.invocationId,
          facts: row.facts as ObservationFacts,
        }),
      ),
    };
  } catch {
    return { status: "unavailable", reason: "persistence-unavailable" };
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * TRH-24 — WHEN THIS SCOPE WAS LAST OBSERVED UNDER A STANDING AUTHORIZATION.
 *
 * ── THE SCOPE OF THE CADENCE CEILING, DECIDED ON EVIDENCE ───────────────────
 *
 * `interval_minutes` says a standing authorization may be EXERCISED no more often than every K
 * minutes. So the question this read answers is "when was this authorization last exercised", and
 * the predicate is `standing_authorization_id is not null` — machine-sourced observations of this
 * scope, whichever revision of the lineage authorized them.
 *
 * A HUMAN OBSERVATION IS DELIBERATELY NOT COUNTED, and that is not a convenience. A human typing the
 * observation command never touches `standing_observation_authorizations` at all: the human read
 * path resolves capability availability and a connection from the session, and reads no
 * authorization row. It is therefore not an exercise of the standing permission, and bounding it by
 * that permission's ceiling would apply a ceiling to something outside its scope — and would make a
 * Governance decision retroactively govern an act performed before it existed.
 *
 * Counting across the whole LINEAGE rather than one revision is the other half: revising an
 * authorization must not reset the clock, or narrowing the cadence would be a way to read sooner.
 *
 * A FAILED READ LEAVES NO ROW, so it cannot manufacture a cadence timestamp, and a retry after a
 * provider failure is permitted. Missed intervals are not backfilled and nothing is scheduled — this
 * value can only ever cause a REFUSAL.
 * ═════════════════════════════════════════════════════════════════════════ */

export type LatestAuthorizedObservationResult =
  | { readonly status: "read"; readonly observedAt: string | null }
  | { readonly status: "unavailable"; readonly reason: "unauthenticated" | "persistence-unavailable" };

/** The instant this scope was last observed under a standing authorization, or `null`. */
export async function readLatestAuthorizedObservationAt(
  tenant: Pick<TenantContext, "tenantId"> | null,
  scope: {
    readonly providerKey: string;
    readonly capabilityKey: string;
    readonly subjectRef: string;
  },
  deps: ProviderObservationReadDeps = {},
): Promise<LatestAuthorizedObservationResult> {
  assertServerOnly();
  if (!tenant?.tenantId) return { status: "unavailable", reason: "unauthenticated" };

  const db = resolveDbOrNull(deps);
  if (!db) return { status: "unavailable", reason: "persistence-unavailable" };

  try {
    const rows = await db
      .select({ observedAt: providerObservations.observedAt })
      .from(providerObservations)
      .where(
        and(
          eq(providerObservations.tenantId, tenant.tenantId),
          eq(providerObservations.providerKey, scope.providerKey),
          eq(providerObservations.capabilityKey, scope.capabilityKey),
          eq(providerObservations.subjectRef, scope.subjectRef),
          isNotNull(providerObservations.standingAuthorizationId),
        ),
      )
      .orderBy(desc(providerObservations.observedAt))
      .limit(1);

    const row = rows[0];
    return { status: "read", observedAt: row ? row.observedAt.toISOString() : null };
  } catch {
    return { status: "unavailable", reason: "persistence-unavailable" };
  }
}
