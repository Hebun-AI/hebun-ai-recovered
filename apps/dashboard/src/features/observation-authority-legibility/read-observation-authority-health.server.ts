/*
 * observation-authority-legibility/read-observation-authority-health.server.ts — the composition
 * (OBSERVATION-AUTHORITY-LEGIBILITY-1).
 *
 * Four RELEASED, tenant-scoped reads and nothing else:
 *
 *   listEffectiveStandingObservations   Standing Observation Authority — every lineage at its
 *                                       effective revision, withdrawn ones included.
 *   listConnections                     Integration Authority — the tenant's connections.
 *   getCapabilityAvailability           Integration Authority — whether each connection is a usable
 *                                       read source for each capability (the one place those rules live).
 *   readProviderObservations            Provider Observation History — the newest observation per
 *                                       lineage, `limit: 1`.
 *
 * Every read receives the session tenant and nothing else. It writes nothing, contacts no provider,
 * opens no credential and persists no health. Server-only.
 */
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { getCapabilityAvailability } from "@/features/integration-authority/capability-availability.server";
import { listConnections } from "@/features/integration-authority/integration-read.server";
import {
  readProviderObservations,
  type ProviderObservationReadResult,
} from "@/features/provider-observation-history/read-provider-observations.server";
import { listEffectiveStandingObservations } from "@/features/standing-observation-authority/read-standing-observations.server";
import type { ObservationAuthorityHealth } from "./contracts";
import { deriveObservationAuthorityHealth, lineageKey } from "./derive-observation-authority-health";

export interface ObservationAuthorityHealthDeps {
  /** Injectable for tests; production always uses the released readers and the real clock. */
  readonly listAuthorizations?: typeof listEffectiveStandingObservations;
  readonly listConnections?: typeof listConnections;
  readonly getAvailability?: typeof getCapabilityAvailability;
  readonly readObservations?: typeof readProviderObservations;
  readonly now?: () => Date;
}

export async function readObservationAuthorityHealth(
  tenant: TenantContext | null,
  providerKey: string,
  deps: ObservationAuthorityHealthDeps = {},
): Promise<ObservationAuthorityHealth> {
  if (typeof window !== "undefined") throw new Error("Observation authority health is server-only.");
  const listAuthorizations = deps.listAuthorizations ?? listEffectiveStandingObservations;
  const readConnections = deps.listConnections ?? listConnections;
  const getAvailability = deps.getAvailability ?? getCapabilityAvailability;
  const readObservations = deps.readObservations ?? readProviderObservations;

  const [authorizations, connections, availability] = await Promise.all([
    listAuthorizations(tenant),
    readConnections(tenant),
    getAvailability(tenant),
  ]);

  const latestObservations = new Map<string, ProviderObservationReadResult>();
  if (authorizations.status === "read") {
    await Promise.all(
      authorizations.revisions
        .filter((r) => r.providerKey === providerKey)
        .map(async (r) => {
          latestObservations.set(
            lineageKey(r.capabilityKey, r.subjectRef),
            await readObservations(tenant, {
              providerKey: r.providerKey,
              capabilityKey: r.capabilityKey,
              subjectRef: r.subjectRef,
              limit: 1,
            }),
          );
        }),
    );
  }

  return deriveObservationAuthorityHealth({
    providerKey,
    authorizations,
    connections,
    availability,
    latestObservations,
    now: (deps.now ?? (() => new Date()))().toISOString(),
  });
}
