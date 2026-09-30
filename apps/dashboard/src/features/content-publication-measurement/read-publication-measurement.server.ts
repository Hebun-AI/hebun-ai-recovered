/*
 * content-publication-measurement/read-publication-measurement.server.ts — the composition
 * (CONTENT-PUBLICATION-MEASUREMENT-LINK-1).
 *
 * It composes two RELEASED readers and writes no SQL of its own:
 *
 *   readContentPublicationStates   Action Authorization's ledger — which attempts were accepted and
 *                                  which provider id each returned.
 *   readProviderObservations       Provider Observation History — what Instagram reported, scoped
 *                                  to the media capability and the exact account subject, bounded
 *                                  by IG-AN3's own `MEDIA_EVOLUTION_OBSERVATION_LIMIT`.
 *
 * The tenant comes only from the caller's authenticated context and is handed to both readers,
 * which are tenant-scoped themselves. The revisions only choose which of that tenant's records are
 * asked about. Nothing is written, no provider is contacted and no credential is opened.
 *
 * Server-only.
 */
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { readContentPublicationStates } from "@/features/action-authorization/content-publication-state.server";
import type { ContentPublicationState } from "@/features/action-authorization/content-publication-state";
import { MEDIA_EVOLUTION_OBSERVATION_LIMIT } from "@/features/instagram-connection-surface/media-measurement-evolution";
import {
  INSTAGRAM_MEDIA_PUBLIC_READ_CAPABILITY,
  INSTAGRAM_PROVIDER_KEY,
} from "@/features/provider-instagram/contracts";
import {
  readProviderObservations,
  type ProviderObservationReadResult,
} from "@/features/provider-observation-history/read-provider-observations.server";
import type { RevisionPublicationMeasurements } from "./contracts";
import {
  derivePublicationMeasurements,
  instagramSubjectRefFor,
  measurablePublications,
} from "./derive-publication-measurement";

export interface PublicationMeasurementDeps {
  /** Injectable for tests; production always uses the released readers. */
  readonly readPublicationStates?: typeof readContentPublicationStates;
  readonly readObservations?: typeof readProviderObservations;
}

/**
 * The measurement projection for each given revision of THIS tenant, keyed by the same canonical
 * reference the publication state uses (`work-artifact/<id>@<n>`).
 */
export async function readPublicationMeasurements(
  tenant: TenantContext | null,
  revisions: readonly { readonly artifactId: string; readonly revisionNo: number }[],
  deps: PublicationMeasurementDeps = {},
): Promise<ReadonlyMap<string, RevisionPublicationMeasurements>> {
  if (typeof window !== "undefined") throw new Error("Publication measurement reads are server-only.");
  const readStates = deps.readPublicationStates ?? readContentPublicationStates;
  const readObservations = deps.readObservations ?? readProviderObservations;

  const states: ReadonlyMap<string, ContentPublicationState> = await readStates(tenant, revisions);

  /* One observation read per distinct destination account, whatever number of revisions name it. */
  const accounts = new Set<string>();
  for (const state of states.values()) {
    for (const p of measurablePublications(state)) accounts.add(p.destinationAccountId);
  }
  const reads = new Map<string, ProviderObservationReadResult>();
  await Promise.all(
    [...accounts].map(async (account) => {
      reads.set(
        account,
        await readObservations(tenant, {
          providerKey: INSTAGRAM_PROVIDER_KEY,
          capabilityKey: INSTAGRAM_MEDIA_PUBLIC_READ_CAPABILITY,
          subjectRef: instagramSubjectRefFor(account),
          limit: MEDIA_EVOLUTION_OBSERVATION_LIMIT,
        }),
      );
    }),
  );

  const out = new Map<string, RevisionPublicationMeasurements>();
  for (const [ref, state] of states) out.set(ref, derivePublicationMeasurements(state, reads));
  return out;
}
