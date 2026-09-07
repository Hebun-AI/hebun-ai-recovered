/*
 * provider-observation-history/write-provider-observation.server.ts — THE ONE WRITER (TRH-21).
 *
 * ── WHAT IT DOES, AND WHERE IT MAY BE REACHED FROM ───────────────────────────
 *
 * It records that a provider reported something, at an instant, through a connection. It may be
 * called ONLY after an already-authorized server-side provider read has succeeded, because the
 * three facts it needs — the connection the capability authority chose, the subject the PROVIDER
 * confirmed, and the read instant — exist only on the far side of such a read.
 *
 * ── WHAT IT MUST NOT DO, AND CANNOT ──────────────────────────────────────────
 *
 * It does not initiate a provider read. It imports no provider transport, no credential accessor
 * and no capability authority: it could not contact a provider if it wanted to, and a firewall
 * walks the real import graph rather than trusting this paragraph.
 *
 * It does not mint a tenant context, and it accepts no tenant, actor, membership or role from a
 * caller — the authorized context is a parameter and the actor is read OFF it. A browser has no
 * path here at all; there is no server action, and the only callers are server compositions.
 *
 * It does not ask Governance for anything. **RECORDING WHAT WAS OBSERVED IS NOT DECIDING WHETHER
 * IT SHOULD HAVE BEEN.** That decision was already made, upstream, by the capability authority that
 * let the read happen. Consulting Governance here would create a second answer to a settled
 * question, and a second answer is the beginning of a second authority.
 *
 * It does not schedule, retry, poll or loop. It writes one row and returns.
 *
 * It is not Knowledge ingestion. No knowledge module is reachable from here, and a stored
 * observation acquires no organizational standing by being stored.
 *
 * ── APPEND-ONLY MEANS NO UPDATE PATH EXISTS ──────────────────────────────────
 *
 * This file contains one INSERT and nothing else. There is no update seam, no delete seam, no
 * upsert-with-merge and no correction path, because a later different number is a NEW observation
 * and never a repair of an old one. A retention authority, if one is ever needed, is a separate
 * decision by a separate owner and is deliberately not made here.
 *
 * ── THE IDEMPOTENCY CONTRACT ─────────────────────────────────────────────────
 *
 * `onConflictDoNothing` against the (tenant, provider, subject, instant) unique index. A replay of
 * the SAME observation writes nothing and says so. A genuinely later read is a different instant
 * and therefore a new row — even when every value is identical, because "the number did not change"
 * is itself an observation, and deduplicating it away would erase the only evidence anyone looked.
 *
 * Server-only.
 */
import { createHash } from "node:crypto";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { providerObservations } from "@/db/schema/provider-observation";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  canonicalizeFacts,
  type ProviderObservationRecord,
  type ProviderObservationRefusal,
  type ProviderObservationWriteResult,
} from "./contracts";

export interface ProviderObservationWriteDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
}

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("Provider observation history is server-only.");
  }
}

function resolveDbOrNull(deps: ProviderObservationWriteDeps): ControlPlaneDatabase | null {
  if (deps.getDb) return deps.getDb();
  try {
    return getControlPlaneDb();
  } catch {
    return null;
  }
}

function refused(reason: ProviderObservationRefusal): ProviderObservationWriteResult {
  return { status: "refused", reason };
}

/** A usable instant: an ISO string a `Date` accepts, stored as UTC. Never "now" invented here. */
function parseInstant(value: string): Date | null {
  const at = new Date(value);
  return Number.isNaN(at.getTime()) ? null : at;
}

/**
 * Record one provider observation.
 *
 * THE TENANT IS THE AUTHORIZED CONTEXT'S, ALWAYS. `tenant.tenantId` is the only tenant this can
 * write under and no argument can override it — which is what makes cross-tenant filing
 * unrepresentable at the seam, before the composite foreign key makes it unrepresentable at rest.
 */
export async function recordProviderObservation(
  tenant: TenantContext | null,
  record: ProviderObservationRecord,
  deps: ProviderObservationWriteDeps = {},
): Promise<ProviderObservationWriteResult> {
  assertServerOnly();
  if (!tenant?.tenantId || !tenant.userId) return refused("unauthenticated");

  const observedAt = parseInstant(record.observedAt);
  if (
    observedAt === null ||
    record.providerKey.trim().length === 0 ||
    record.capabilityKey.trim().length === 0 ||
    record.subjectRef.trim().length === 0 ||
    record.integrationId.trim().length === 0
  ) {
    return refused("invalid-observation");
  }

  const db = resolveDbOrNull(deps);
  if (!db) return refused("persistence-unavailable");

  const facts = canonicalizeFacts(record.facts);
  const factsDigest = createHash("sha256").update(facts).digest("hex");

  try {
    const inserted = await db
      .insert(providerObservations)
      .values({
        tenantId: tenant.tenantId,
        integrationId: record.integrationId,
        providerKey: record.providerKey,
        capabilityKey: record.capabilityKey,
        subjectKind: record.subjectKind,
        subjectRef: record.subjectRef,
        observedAt,
        /*
         * The ACTOR IS READ OFF THE AUTHORIZED CONTEXT, never supplied. `TenantContext` is nominally
         * branded as a human member and can be minted at exactly one site, so this literal is true
         * by construction today — and the columns exist so that a future non-human principal cannot
         * be introduced without this record saying which one observed.
         */
        observedByActorType: "human",
        observedByActorId: tenant.userId,
        facts: record.facts,
        factsDigest,
      })
      /* THE IDEMPOTENCY CONTRACT. One subject, one instant, one row — see the header. */
      .onConflictDoNothing({
        target: [
          providerObservations.tenantId,
          providerObservations.providerKey,
          providerObservations.subjectRef,
          providerObservations.observedAt,
        ],
      })
      .returning({ id: providerObservations.id });

    const row = inserted[0];
    return row ? { status: "recorded", observationId: row.id } : { status: "already-recorded" };
  } catch {
    /*
     * NOTHING IS CLAIMED FROM A FAILED WRITE. The caller's observation still happened and is still
     * true; what failed is Hebun's memory of it, and saying so is different from saying the read
     * failed.
     */
    return refused("persistence-unavailable");
  }
}
