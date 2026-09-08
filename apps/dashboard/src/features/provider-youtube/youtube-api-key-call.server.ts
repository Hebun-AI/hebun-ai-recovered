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
  withConnectionScopedSecret,
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

/*
 * TRH-21 — THE SUCCESS BRANCH NAMES THE CONNECTION IT SPENT.
 *
 * `integrationId` is the connection the CAPABILITY AUTHORITY chose for this read. It is surfaced,
 * never chosen by a caller: no entry point here accepts one, and a caller that wanted a different
 * connection would have to change what the authority answers.
 *
 * It exists because an observation record must be able to say "read through connection C" without
 * re-resolving the connection somewhere else — a second resolution would be a second answer to a
 * question this seam already answered, and the two could disagree after a rotation.
 *
 * It is on the SUCCESS branch only. A refusal spent no connection, and naming one would imply a
 * read that never happened.
 */
export type YouTubeAuthorizedOutcome<T> =
  | { readonly ok: true; readonly value: T; readonly integrationId: string }
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

  const outcome = await withYouTubeApiKey<T>(tenant, connection.integrationId, call, deps);
  return outcome.ok ? { ok: true, value: outcome.value, integrationId: connection.integrationId } : outcome;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * TRH-24 — SPENDING THE KEY FOR AN ALREADY-REVALIDATED MACHINE OBSERVATION.
 *
 * ── IT TAKES NO TENANT AND NO CONNECTION ────────────────────────────────────
 *
 * Both come off the value the pre-transport revalidator returned, which came off the authorization
 * row. There is no parameter through which a caller could name either, so "spend a different
 * tenant's key" and "spend a different connection's key" are not refused — they are unsayable.
 *
 * ── AND IT ASKS THE CAPABILITY AUTHORITY NOTHING ────────────────────────────
 *
 * `withConnectedYouTubeApiKey` consults availability and the connection listing because a human
 * command arrives with nothing decided. This path arrives with EVERYTHING decided, and decided more
 * recently: the revalidator has just re-read the authorization, the capability, the connection's
 * health and the credential's presence, in that order, immediately before this call. Asking again
 * would be a second answer to a question already answered, and the two could disagree.
 *
 * ── THE CREDENTIAL IS OPENED THROUGH THE NARROW SEAM ────────────────────────
 *
 * `withConnectionScopedSecret` — connection and kind, never a caller-named credential id. The
 * released `withDecryptedSecret` still requires a branded HUMAN context and is untouched by this
 * phase, which is why a machine principal cannot open an arbitrary secret of its tenant.
 * ═════════════════════════════════════════════════════════════════════════ */

/**
 * What the pre-transport revalidator hands this seam. Deliberately structural and tiny: it is a
 * PROJECTION of an already-verified principal, not an authority of its own, and it grants nothing by
 * being held — the revalidation that produced it is what made the read legitimate.
 */
export interface RevalidatedYouTubeRead {
  readonly tenantId: string;
  readonly integrationId: string;
}

/** Spend the live `api_key` of the authorized connection, inside one callback frame. */
export async function withAuthorizedYouTubeApiKey<T>(
  authorized: RevalidatedYouTubeRead,
  call: (apiKey: string) => Promise<YouTubeResult<T>>,
  deps: YouTubeApiKeyCallDeps = {},
): Promise<YouTubeResult<T>> {
  assertServerOnly();
  const used = await withConnectionScopedSecret(
    { tenantId: authorized.tenantId },
    authorized.integrationId,
    "api_key",
    call,
    { getDb: deps.getDb, env: deps.env },
  );
  if (used.status !== "used") {
    return { ok: false, failure: "auth", reason: `credential-${used.reason}` };
  }
  return used.value;
}
