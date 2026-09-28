/*
 * youtube-publishing/resolve-youtube-publish.server.ts — YOUTUBE-WRITE-2's READ-ONLY bindings.
 *
 * Three questions, each answered by the authority that owns it and by nothing here:
 *
 *   1. WHICH CONNECTION may upload?   capability availability (`google.youtube.video.upload`),
 *                                     requiring `writeCapable`, on `google-youtube`, exactly one.
 *   2. WHICH CHANNEL does it stand for?  YouTube itself, `channels.list?mine=true`, through the
 *                                     existing token authority, for THAT connection's own token.
 *   3. IS THE PACKAGE STILL WHAT WAS AUTHORIZED?  the Content Package read, the revision digest and
 *                                     the Media row — compared with the frozen payload, never
 *                                     recomputed into a readiness rule of its own.
 *
 * It writes nothing. The spend, the attempt and every ledger write stay in
 * `executeAuthorizedAction`, the table's only writer.
 *
 * Server-only.
 */
import type { ControlPlaneDatabase } from "@/db/client.server";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { readContentPackage, type ContentPackageDeps } from "@/features/content-composition/read-content-package.server";
import type { ContentPackageView } from "@/features/content-composition/contracts";
import { getCapabilityAvailability } from "@/features/integration-authority/capability-availability.server";
import { listConnections } from "@/features/integration-authority/integration-repository.server";
import {
  GOOGLE_YOUTUBE_PROVIDER_KEY,
  GOOGLE_YOUTUBE_VIDEO_UPLOAD_CAPABILITY,
  type YouTubeChannelIdentity,
} from "@/features/provider-google/contracts";
import { withGoogleAccessToken, type GoogleAuthorizedCallDeps } from "@/features/provider-google/google-authorized-call.server";
import { listAuthenticatedYouTubeChannels } from "@/features/provider-google/google-transport.server";
import { parseWorkArtifactRef } from "@/features/work-artifacts/artifact-ref";
import type { PublishYouTubeVideoPayload } from "./contracts";

export interface YouTubePublishConnection {
  readonly integrationId: string;
  /** The Google account (`sub`) the connection was verified as. */
  readonly externalAccountId: string;
  readonly accountLabel: string | null;
}

export type YouTubePublishConnectionResult =
  | { readonly status: "available"; readonly connection: YouTubePublishConnection }
  | { readonly status: "unavailable"; readonly reason: "upload-not-granted" | "multiple-upload-connections" | "persistence-unavailable" };

export interface YouTubePublishResolveDeps extends GoogleAuthorizedCallDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
}

/**
 * The ONE connection that may upload for this tenant, or why none can. Availability AND
 * `writeCapable` — a grant covering `youtube.upload` — are both required. Two eligible connections is
 * a refusal, not a choice: which channel to publish to is never decided by row order.
 */
export async function resolveYouTubePublishConnection(
  tenant: Pick<TenantContext, "tenantId"> | null,
  deps: YouTubePublishResolveDeps = {},
): Promise<YouTubePublishConnectionResult> {
  if (!tenant?.tenantId) return { status: "unavailable", reason: "persistence-unavailable" };
  const view = await getCapabilityAvailability(tenant, { getDb: deps.getDb });
  const entry = view.capabilities.find((c) => c.capability === GOOGLE_YOUTUBE_VIDEO_UPLOAD_CAPABILITY);
  if (!entry || entry.state !== "available") return { status: "unavailable", reason: "upload-not-granted" };
  const sources = entry.sources.filter(
    (s) => s.providerKey === GOOGLE_YOUTUBE_PROVIDER_KEY && s.readAvailable && s.writeCapable,
  );
  if (sources.length === 0) return { status: "unavailable", reason: "upload-not-granted" };
  if (sources.length > 1) return { status: "unavailable", reason: "multiple-upload-connections" };
  const source = sources[0]!;

  const listing = await listConnections(tenant, { getDb: deps.getDb });
  if (listing.status !== "read") return { status: "unavailable", reason: "persistence-unavailable" };
  const row = listing.connections.find((c) => c.integrationId === source.integrationId);
  if (!row?.externalAccountId) return { status: "unavailable", reason: "upload-not-granted" };
  return {
    status: "available",
    connection: { integrationId: row.integrationId, externalAccountId: row.externalAccountId, accountLabel: row.externalAccountLabel },
  };
}

export type ConnectionChannelResult =
  | { readonly status: "one-channel"; readonly channel: YouTubeChannelIdentity }
  | { readonly status: "not-one-channel"; readonly count: number; readonly truncated: boolean }
  | { readonly status: "unreadable"; readonly reason: string };

/**
 * Which channel THIS connection's token stands for, as YouTube answers `channels.list?mine=true`.
 * The token is spent inside `withGoogleAccessToken` for exactly `integrationId`; nothing is stored.
 */
export async function readChannelForConnection(
  tenant: TenantContext,
  integrationId: string,
  deps: YouTubePublishResolveDeps = {},
): Promise<ConnectionChannelResult> {
  const outcome = await withGoogleAccessToken(
    tenant,
    integrationId,
    async (token) => {
      const listed = await listAuthenticatedYouTubeChannels(token, deps);
      if (!listed.ok) return listed;
      return { ok: true as const, value: { channels: listed.channels, truncated: listed.truncated } };
    },
    deps,
  );
  if (!outcome.ok) return { status: "unreadable", reason: outcome.reason };
  const { channels, truncated } = outcome.value;
  if (channels.length === 1 && !truncated) return { status: "one-channel", channel: channels[0]! };
  return { status: "not-one-channel", count: channels.length, truncated };
}

export type PackageBindingFailure =
  | "artifact-unresolvable"
  | "artifact-retired"
  | "digest-mismatch"
  | "package-not-ready"
  | "persistence-unavailable";

/**
 * Is the Content Package still EXACTLY what the human authorized? Readiness is the package's own
 * `ready`; this only compares the frozen payload with the package, the revision and the Media row.
 */
export async function verifyYouTubePackageBinding(
  tenant: TenantContext,
  payload: PublishYouTubeVideoPayload,
  deps: { readonly getDb?: () => ControlPlaneDatabase | null; readonly readPackage?: typeof readContentPackage } & ContentPackageDeps = {},
): Promise<{ readonly ok: true; readonly pkg: ContentPackageView } | { readonly ok: false; readonly failure: PackageBindingFailure }> {
  const ref = parseWorkArtifactRef(payload.draftRef);
  if (!ref) return { ok: false, failure: "artifact-unresolvable" };
  const read = await (deps.readPackage ?? readContentPackage)(tenant, { artifactId: ref.artifactId, revisionNo: ref.revisionNo }, deps);
  if (read.status === "unavailable") return { ok: false, failure: "persistence-unavailable" };
  if (read.status !== "read") return { ok: false, failure: "artifact-unresolvable" };
  const pkg = read.package;
  if (pkg.destination !== "youtube") return { ok: false, failure: "digest-mismatch" };
  if (pkg.title !== payload.title || pkg.copy !== payload.description) return { ok: false, failure: "digest-mismatch" };
  const selected = pkg.selected.find((m) => m.mediaAssetId === payload.videoAssetRef);
  if (!selected || selected.mediaKind !== "video") return { ok: false, failure: "digest-mismatch" };
  if (pkg.mediaReviewStates[payload.videoAssetRef] !== "approved") return { ok: false, failure: "package-not-ready" };
  if (!pkg.ready) return { ok: false, failure: "package-not-ready" };
  return { ok: true, pkg };
}
