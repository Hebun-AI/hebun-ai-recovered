/*
 * provider-youtube/youtube-api-key-call.server.ts — spend the tenant's YouTube API key inside one
 * callback frame (CGO-5).
 *
 * The shape is `withGoogleAccessToken` (INT-3) minus the refresh: an API key does not expire on a
 * schedule and has nothing to refresh from. The secret is decrypted by the released credential
 * authority, handed to the callback, and never returned, stored or logged by this module.
 *
 * TWO ENTRY POINTS, FOR TWO DIFFERENT QUESTIONS:
 *
 *   withYouTubeApiKey            "spend the key attached to THIS connection" — verification uses
 *                                it, because a connection being verified is not yet available.
 *   withConnectedYouTubeApiKey   "spend the key of the connection that is AVAILABLE for public
 *                                reads" — every observation uses it, so a read after the capability
 *                                authority said `connected + healthy` and never before.
 *
 * Server-only.
 */
import type { ControlPlaneDatabase } from "@/db/client.server";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  listCredentialMetadata,
  withDecryptedSecret,
} from "@/features/integration-credentials/credential-repository.server";
import { getCapabilityAvailability } from "@/features/integration-authority/capability-availability.server";
import { listConnections } from "@/features/integration-authority/integration-read.server";
import {
  YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY,
  YOUTUBE_PROVIDER_KEY,
  type YouTubeFailure,
  type YouTubeResult,
} from "./contracts";
import type { YouTubeTransportDeps } from "./youtube-transport.server";

export interface YouTubeApiKeyCallDeps extends YouTubeTransportDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly env?: Readonly<Record<string, string | undefined>>;
}

export type YouTubeAuthorizationRefusal =
  | "no-authorized-tenant-context"
  | "connection-authority-unavailable"
  | "capability-not-available"
  | "no-youtube-connection";

export type YouTubeAuthorizedOutcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly refusal: YouTubeAuthorizationRefusal }
  | YouTubeFailure;

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("YouTube API-key calls are server-only.");
  }
}

/** Spend the live `api_key` credential of one connection. The key exists only inside `call`. */
export async function withYouTubeApiKey<T>(
  tenant: TenantContext,
  integrationId: string,
  call: (apiKey: string) => Promise<YouTubeResult<T>>,
  deps: YouTubeApiKeyCallDeps = {},
): Promise<YouTubeResult<T>> {
  assertServerOnly();
  const listing = await listCredentialMetadata(tenant, integrationId, { getDb: deps.getDb, env: deps.env });
  if (listing.status !== "read") {
    return { ok: false, failure: "auth", reason: "credential-unavailable" };
  }
  const key = listing.credentials.find((c) => c.kind === "api_key" && c.live);
  if (!key) return { ok: false, failure: "auth", reason: "no-live-api-key-credential" };
  const used = await withDecryptedSecret(tenant, key.credentialId, call, { getDb: deps.getDb, env: deps.env });
  if (used.status !== "used") {
    return { ok: false, failure: "auth", reason: `credential-${used.reason}` };
  }
  return used.value;
}

/**
 * Spend the key of the connection the capability authority reports AVAILABLE for public reads.
 * The authority is consulted first, on every call; a connection that is unverified, impaired or
 * revoked never has its key decrypted.
 */
export async function withConnectedYouTubeApiKey<T>(
  tenant: TenantContext | null,
  call: (apiKey: string) => Promise<YouTubeResult<T>>,
  deps: YouTubeApiKeyCallDeps = {},
): Promise<YouTubeAuthorizedOutcome<T>> {
  assertServerOnly();
  if (!tenant?.tenantId) return { ok: false, refusal: "no-authorized-tenant-context" };

  const availability = await getCapabilityAvailability(tenant, { getDb: deps.getDb });
  const entry = availability.capabilities.find((c) => c.capability === YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY);
  const source = entry?.sources.find((s) => s.readAvailable && s.providerKey === YOUTUBE_PROVIDER_KEY);
  if (!entry || entry.state !== "available" || !source) {
    return { ok: false, refusal: "capability-not-available" };
  }

  const listing = await listConnections(tenant, deps.getDb ? { getDb: deps.getDb } : {});
  if (listing.status !== "read") return { ok: false, refusal: "connection-authority-unavailable" };
  const connection = listing.connections.find(
    (c) => c.integrationId === source.integrationId && c.providerKey === YOUTUBE_PROVIDER_KEY,
  );
  if (!connection) return { ok: false, refusal: "no-youtube-connection" };

  return withYouTubeApiKey(tenant, connection.integrationId, call, deps);
}
