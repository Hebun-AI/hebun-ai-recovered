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
 * YOUTUBE-MEASUREMENT-OPERATIONS-PROJECTION-1 adds one more read through the SAME released reader,
 * per distinct channel an accepted YouTube publication bound: the measurements a person recorded
 * (`google-youtube` / `google.youtube.video.metrics.read`). It names no limit, so the page is the
 * observation history's own, and that history's page size is handed to the derivation so a full
 * page is never read as the whole history. The channel's subject reference is asked of the module
 * that owns the format — it is not spelled here or in the derivation.
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
  GOOGLE_YOUTUBE_PROVIDER_KEY,
  GOOGLE_YOUTUBE_VIDEO_METRICS_CAPABILITY,
} from "@/features/provider-google/contracts";
import {
  MAX_OBSERVATIONS_PER_READ,
  readProviderObservations,
  type ProviderObservationReadResult,
} from "@/features/provider-observation-history/read-provider-observations.server";
import { youtubeChannelSubjectRef } from "@/features/provider-observation-history/record-youtube-channel-observation.server";
import type { RevisionPublicationMeasurements } from "./contracts";
import {
  derivePublicationMeasurements,
  instagramSubjectRefFor,
  measurablePublications,
  measurableYouTubePublications,
  type YouTubeChannelMeasurementRead,
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

  /* One measurement read per distinct YouTube channel. No limit is named: the page is the history's own. */
  const channels = new Set<string>();
  for (const state of states.values()) {
    for (const p of measurableYouTubePublications(state)) channels.add(p.destinationAccountId);
  }
  const youtubeReads = new Map<string, YouTubeChannelMeasurementRead>();
  await Promise.all(
    [...channels].map(async (channel) => {
      const subjectRef = youtubeChannelSubjectRef(channel);
      youtubeReads.set(channel, {
        subjectRef,
        read: await readObservations(tenant, {
          providerKey: GOOGLE_YOUTUBE_PROVIDER_KEY,
          capabilityKey: GOOGLE_YOUTUBE_VIDEO_METRICS_CAPABILITY,
          subjectRef,
        }),
        windowSize: MAX_OBSERVATIONS_PER_READ,
      });
    }),
  );

  const out = new Map<string, RevisionPublicationMeasurements>();
  for (const [ref, state] of states) out.set(ref, derivePublicationMeasurements(state, reads, youtubeReads));
  return out;
}
