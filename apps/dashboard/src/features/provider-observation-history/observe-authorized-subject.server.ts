/*
 * provider-observation-history/observe-authorized-subject.server.ts — the provider dispatch.
 *
 * ── THIS IS A ROUTER, NOT AN AUTHORITY ──────────────────────────────────────
 *
 * It decides WHICH released provider module performs a read that has ALREADY been authorized. It
 * decides nothing about whether the read may happen: the authorization was minted, re-read and
 * re-decided by the revalidator before this is ever called, and every scope field it matches on was
 * taken off the authorization row rather than from a caller.
 *
 *     REVALIDATOR DECIDES WHETHER · THIS DECIDES WHICH · THE PROVIDER PERFORMS
 *
 * It grants nothing, stores nothing, and holds no lifecycle. If it matched the wrong provider the
 * result would be a refusal, never a wider read — because the connection it spends and the scope it
 * needs both belong to the authorization it was handed.
 *
 * ── WHY IT EXISTS AT ALL ────────────────────────────────────────────────────
 *
 * Until Instagram there was one provider and the composition simply named it. A second provider
 * makes that a fork, and a fork has two honest shapes: a second composition, or a dispatch inside
 * the one that exists. A second composition would duplicate the principal, the revalidation and the
 * write — four authorities copied so that one `if` could be avoided. So the fork lives here, in the
 * narrowest form that can express it.
 *
 * ── THE TRIPLE IS MATCHED WHOLE ─────────────────────────────────────────────
 *
 * Provider key, capability key AND subject kind must all agree before a provider is selected. Two of
 * three is a refusal. `OBSERVABLE_CAPABILITIES` is the released list of triples Governance may
 * authorize; this switch must never admit a combination that list does not contain, and a test
 * asserts the two stay in step.
 *
 * Server-only.
 */
import {
  INSTAGRAM_ACCOUNT_PUBLIC_READ_CAPABILITY,
  INSTAGRAM_ACCOUNT_SUBJECT_KIND,
  INSTAGRAM_MEDIA_PUBLIC_READ_CAPABILITY,
  INSTAGRAM_PROVIDER_KEY,
  accountIdFromSubjectRef,
  type InstagramFailureClass,
} from "@/features/provider-instagram/contracts";
import { observeAccountById } from "@/features/provider-instagram/read-account-observation.server";
import { observeAccountMediaById } from "@/features/provider-instagram/read-media-observation.server";
import { withAuthorizedInstagramToken } from "@/features/provider-instagram/instagram-access-token-call.server";
import {
  YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY,
  YOUTUBE_PROVIDER_KEY,
  type YouTubeFailureClass,
} from "@/features/provider-youtube/contracts";
import { observeChannelById } from "@/features/provider-youtube/read-channel-observation.server";
import type { FetchLike } from "@/features/provider-youtube/youtube-transport.server";
import { withAuthorizedYouTubeApiKey } from "@/features/provider-youtube/youtube-api-key-call.server";
import type { ObservationPrincipal } from "@/features/standing-observation-authority/observation-principal.server";
import {
  YOUTUBE_CHANNEL_SUBJECT_KIND,
  channelIdFromSubjectRef,
  youtubeChannelObservationFacts,
} from "./record-youtube-channel-observation.server";
import { instagramAccountObservationFacts } from "./record-instagram-account-observation.server";
import { instagramMediaObservationFacts } from "./record-instagram-media-observation.server";
import type { ObservationFacts } from "./contracts";

/**
 * Why a provider read failed, in this authority's vocabulary.
 *
 * The CLASS is each provider's own closed union — YouTube's `quota` and Instagram's
 * `not-professional` are different facts and neither is flattened into the other. What is shared is
 * the SHAPE, so a caller can report a failure without knowing which provider produced it.
 */
export interface ProviderReadFailure {
  readonly failure: YouTubeFailureClass | InstagramFailureClass;
  readonly reason: string;
}

/** What a provider read produced, in this authority's vocabulary rather than a provider's. */
export interface DispatchedObservation {
  readonly observedAt: string;
  readonly facts: ObservationFacts;
}

export type DispatchOutcome =
  /** The provider answered and its report was mapped. */
  | { readonly status: "observed"; readonly observation: DispatchedObservation }
  /**
   * The authorization's triple names no released provider, or its subject reference is not one the
   * named provider can parse. NOTHING WAS CONTACTED.
   */
  | { readonly status: "unsupported-subject" }
  /** The provider was contacted and did not answer usefully. Nothing was recorded. */
  | {
      readonly status: "provider-failed";
      readonly failure: YouTubeFailureClass | InstagramFailureClass;
      readonly reason: string;
    };

export interface DispatchDeps {
  readonly getDb?: () => import("@/db/client.server").ControlPlaneDatabase | null;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly fetchImpl?: FetchLike;
  readonly timeoutMs?: number;
  readonly now?: () => Date;
}

/**
 * Perform the ONE provider read this authorization names.
 *
 * `integrationId` is the revalidator's, not the caller's: it is the connection the authorization
 * bound and the revalidator confirmed is still owned, healthy and credentialed.
 */
export async function observeAuthorizedSubject(
  principal: ObservationPrincipal,
  integrationId: string,
  deps: DispatchDeps = {},
): Promise<DispatchOutcome> {
  if (typeof window !== "undefined") {
    throw new Error("Provider observation dispatch is server-only.");
  }
  const scope = { tenantId: principal.tenantId, integrationId };

  /* ── YOUTUBE · public channel read ───────────────────────────────────────── */
  if (
    principal.providerKey === YOUTUBE_PROVIDER_KEY &&
    principal.capabilityKey === YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY &&
    principal.subjectKind === YOUTUBE_CHANNEL_SUBJECT_KIND
  ) {
    const channelId = channelIdFromSubjectRef(principal.subjectRef);
    if (channelId === null) return { status: "unsupported-subject" };

    const read = await withAuthorizedYouTubeApiKey(
      scope,
      (apiKey) => observeChannelById(apiKey, channelId, deps),
      { getDb: deps.getDb, env: deps.env },
    );
    if (!read.ok) return { status: "provider-failed", failure: read.failure, reason: read.reason };
    return {
      status: "observed",
      observation: {
        observedAt: read.value.observedAt,
        facts: youtubeChannelObservationFacts(read.value),
      },
    };
  }

  /* ── INSTAGRAM · professional account read ───────────────────────────────── */
  if (
    principal.providerKey === INSTAGRAM_PROVIDER_KEY &&
    principal.capabilityKey === INSTAGRAM_ACCOUNT_PUBLIC_READ_CAPABILITY &&
    principal.subjectKind === INSTAGRAM_ACCOUNT_SUBJECT_KIND
  ) {
    const accountId = accountIdFromSubjectRef(principal.subjectRef);
    if (accountId === null) return { status: "unsupported-subject" };

    const read = await withAuthorizedInstagramToken(
      scope,
      (accessToken) => observeAccountById(accessToken, accountId, deps),
      { getDb: deps.getDb, env: deps.env },
    );
    if (!read.ok) return { status: "provider-failed", failure: read.failure, reason: read.reason };
    return {
      status: "observed",
      observation: {
        observedAt: read.value.observedAt,
        facts: instagramAccountObservationFacts(read.value),
      },
    };
  }

  /* ── INSTAGRAM · recent media window ─────────────────────────────────────
   *
   * A SEPARATE BRANCH FOR A SEPARATE CAPABILITY. It differs from the account branch by exactly one
   * field of the triple, which is what keeps the two authorizations from standing in for each other:
   * a principal minted for the account capability cannot reach this code at all.
   */
  if (
    principal.providerKey === INSTAGRAM_PROVIDER_KEY &&
    principal.capabilityKey === INSTAGRAM_MEDIA_PUBLIC_READ_CAPABILITY &&
    principal.subjectKind === INSTAGRAM_ACCOUNT_SUBJECT_KIND
  ) {
    const accountId = accountIdFromSubjectRef(principal.subjectRef);
    if (accountId === null) return { status: "unsupported-subject" };

    const read = await withAuthorizedInstagramToken(
      scope,
      (accessToken) => observeAccountMediaById(accessToken, accountId, deps),
      { getDb: deps.getDb, env: deps.env },
    );
    if (!read.ok) return { status: "provider-failed", failure: read.failure, reason: read.reason };
    return {
      status: "observed",
      observation: {
        observedAt: read.value.observedAt,
        facts: instagramMediaObservationFacts(read.value),
      },
    };
  }

  /*
   * NO PROVIDER CLAIMS THIS TRIPLE. Reported rather than guessed: a fallback that picked "the only
   * provider we have" would read the wrong subject through the wrong connection the first time a
   * third capability was authorized.
   */
  return { status: "unsupported-subject" };
}
