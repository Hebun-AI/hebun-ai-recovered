/*
 * provider-observation-history/observe-once-under-authorization.server.ts — ONE machine-sourced
 * observation, end to end (TRH-24).
 *
 * The whole chain, in one place, with each step owned by the authority that owns it:
 *
 *   effective standing authorization   Governance's downstream evidence   (TRH-23)
 *          ↓
 *   ephemeral ObservationPrincipal     minted from that row, and only that row
 *          ↓
 *   last-moment revalidation           the authoritative check, immediately before transport
 *          ↓
 *   connection-scoped credential       kind + connection, never a caller-named credential
 *          ↓
 *   released provider read             the same body the human path runs
 *          ↓
 *   provider reports facts
 *          ↓
 *   one recorded observation           machine provenance: authorization + invocation, no actor
 *
 * ── WHY THIS COMPOSITION LIVES HERE ─────────────────────────────────────────
 *
 * The same placement TRH-21 argued for and CGO-7 and TRH-20 used before it. A released firewall
 * asserts that every file under `provider-youtube` and under the Heby observation command root
 * "touches no table"; putting the persistence in either would breach a guarantee three shipped
 * releases installed. This module is the third place — the one that may compose a read with a write
 * because it owns neither.
 *
 * ── ONE ATTEMPT. NO RETRY. NO SCHEDULE. ─────────────────────────────────────
 *
 * This function performs at most ONE provider transport and returns. It contains no loop, no timer,
 * no backoff and no next-run computation, and it never calls itself. A caller that wants a second
 * observation runs the ceremony again — which mints a new invocation, revalidates again, and is
 * refused if the cadence ceiling has not elapsed.
 *
 * ── OBSERVED, RECORDED AND SUCCESSFUL ARE THREE DIFFERENT STATES ────────────
 *
 * The provider can answer while persistence fails. The result below keeps them apart rather than
 * collapsing them into a boolean, because a caller told "it worked" about a read Hebun did not
 * remember has been told something false.
 *
 * Server-only.
 */
import type { ControlPlaneDatabase } from "@/db/client.server";
import {
  observeChannelById,
  type ReadChannelObservationDeps,
} from "@/features/provider-youtube/read-channel-observation.server";
import { withAuthorizedYouTubeApiKey } from "@/features/provider-youtube/youtube-api-key-call.server";
import {
  YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY,
  YOUTUBE_PROVIDER_KEY,
  type YouTubeChannelObservation,
  type YouTubeFailure,
} from "@/features/provider-youtube/contracts";
import {
  mintObservationPrincipal,
  type ObservationPrincipal,
  type ObservationPrincipalRefusal,
} from "@/features/standing-observation-authority/observation-principal.server";
import {
  revalidateStandingObservation,
  type StandingObservationRevalidationRefusal,
} from "@/features/standing-observation-authority/revalidate-standing-observation.server";
import {
  channelIdFromSubjectRef,
  youtubeChannelObservationFacts,
} from "./record-youtube-channel-observation.server";
import { recordAuthorizedProviderObservation } from "./write-provider-observation.server";
import type { ProviderObservationWriteResult } from "./contracts";

export interface ObserveOnceDeps extends ReadChannelObservationDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly env?: Readonly<Record<string, string | undefined>>;
  /** Injectable so the cadence ceiling is provable without waiting a day. Never reaches a column. */
  readonly clock?: () => Date;
}

/**
 * Why no observation happened. Each layer keeps its own vocabulary rather than being flattened,
 * because "Governance withdrew this" and "YouTube timed out" call for entirely different responses.
 */
export type ObserveOnceOutcome =
  /** The principal could not be minted — the authorization is unknown, superseded or withdrawn. */
  | { readonly status: "not-authorized"; readonly reason: ObservationPrincipalRefusal }
  /** The authoritative pre-transport check refused. No provider was contacted. */
  | { readonly status: "refused"; readonly reason: StandingObservationRevalidationRefusal }
  /** The subject reference stored on the authorization is not one this provider path can read. */
  | { readonly status: "unsupported-subject" }
  /** The provider was contacted and did not answer usefully. NOTHING was recorded. */
  | {
      readonly status: "provider-failed";
      readonly failure: YouTubeFailure;
      readonly invocationId: string;
    }
  /**
   * The provider answered. `record` says what became of Hebun's memory of it — which may itself be
   * a refusal, and saying so is the point.
   */
  | {
      readonly status: "observed";
      readonly invocationId: string;
      readonly authorizationId: string;
      readonly observation: YouTubeChannelObservation;
      readonly record: ProviderObservationWriteResult;
    };

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("Authorized provider observation is server-only.");
  }
}

/**
 * Perform exactly one observation under the standing authorization named by `authorizationId`.
 *
 * THE CALLER NAMES AN AUTHORIZATION AND NOTHING ELSE. No tenant, no provider, no capability, no
 * subject, no connection and no credential can arrive through this signature — every one of them is
 * read off the row, which is the whole tenant trust chain expressed as an absence of parameters.
 */
export async function observeOnceUnderAuthorization(
  authorizationId: string,
  deps: ObserveOnceDeps = {},
): Promise<ObserveOnceOutcome> {
  assertServerOnly();

  /* 1 · THE PRINCIPAL. Minted from the effective revision, or not at all. */
  const minted = await mintObservationPrincipal(authorizationId, { getDb: deps.getDb });
  if (minted.status !== "minted") return { status: "not-authorized", reason: minted.reason };
  const principal: ObservationPrincipal = minted.principal;

  /*
   * 2 · THE AUTHORITATIVE CHECK, IMMEDIATELY BEFORE TRANSPORT.
   *
   * Everything the mint saw is re-read here, plus the connection's health, the capability's
   * availability, the credential's presence and the cadence ceiling. A withdrawal committed between
   * step 1 and step 2 stops the read; a withdrawal committed after this returns cannot, and that
   * remaining window is exactly one provider call wide. It is not eliminated and this file does not
   * claim it is.
   */
  const authorized = await revalidateStandingObservation(principal, {
    getDb: deps.getDb,
    env: deps.env,
    now: deps.clock,
  });
  if (authorized.status !== "authorized") return { status: "refused", reason: authorized.reason };

  /*
   * 3 · THE SUBJECT, AS THE PROVIDER IDENTIFIES IT.
   *
   * The authorization stores the canonical reference the provider itself returned. This path reads
   * by that id and never by a handle, so a channel that was renamed since the authorization was
   * granted is still the same channel — which is the whole reason the authorization binds an id.
   */
  const channelId = channelIdFromSubjectRef(authorized.principal.subjectRef);
  if (
    channelId === null ||
    authorized.principal.providerKey !== YOUTUBE_PROVIDER_KEY ||
    authorized.principal.capabilityKey !== YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY
  ) {
    return { status: "unsupported-subject" };
  }

  /*
   * 4 · ONE PROVIDER READ, THROUGH THE AUTHORIZED CONNECTION'S KEY.
   *
   * The key is opened by connection and kind inside a callback frame and never returned. The read
   * body is literally the one the human path runs — a machine-sourced observation and a
   * human-sourced one of the same channel are therefore comparable, which is the only reason to
   * store either.
   */
  const read = await withAuthorizedYouTubeApiKey<YouTubeChannelObservation>(
    { tenantId: authorized.principal.tenantId, integrationId: authorized.integrationId },
    (apiKey) => observeChannelById(apiKey, channelId, deps),
    { getDb: deps.getDb, env: deps.env, timeoutMs: deps.timeoutMs, fetchImpl: deps.fetchImpl },
  );
  if (!read.ok) {
    /*
     * NOTHING IS RECORDED FROM A FAILED READ. There is no row, so there is no cadence timestamp
     * either, and the next attempt is permitted immediately — a failure must not spend the ceiling.
     */
    return {
      status: "provider-failed",
      failure: read,
      invocationId: authorized.principal.invocationId,
    };
  }

  /*
   * 5 · ONE RECORDED OBSERVATION, WITH TRUTHFUL MACHINE PROVENANCE.
   *
   * The writer takes the principal and reads the scope off it; this call supplies only what the
   * PROVIDER said. The stored row carries the authorization and the invocation and a NULL human
   * actor pair — because no human performed this read, and the schema now lets Hebun say so.
   */
  const record = await recordAuthorizedProviderObservation(
    authorized.principal,
    { observedAt: read.value.observedAt, facts: youtubeChannelObservationFacts(read.value) },
    { getDb: deps.getDb },
  );

  return {
    status: "observed",
    invocationId: authorized.principal.invocationId,
    authorizationId: authorized.principal.authorizationId,
    observation: read.value,
    record,
  };
}
