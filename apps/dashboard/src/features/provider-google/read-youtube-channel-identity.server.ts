/*
 * provider-google/read-youtube-channel-identity.server.ts — YOUTUBE-WRITE-1: WHICH YouTube channel(s)
 * this organization's Google grant stands for, as YouTube answers it.
 *
 * ── THE DISTINCTIONS THIS FILE KEEPS ─────────────────────────────────────────
 *
 *     A CREDENTIAL      != A CONNECTION          (INT-3)
 *     A CONNECTION      != A CAPABILITY          (INT-4)
 *     A GOOGLE ACCOUNT  != A YOUTUBE CHANNEL     (this phase)
 *     A CHANNEL SEEN    != A CHANNEL BOUND       (not this phase)
 *
 * It refuses BEFORE any credential is touched unless the availability seam says
 * `google.youtube.channel.identity.read` is `available` — lifecycle, health AND the scope Google
 * actually granted, decided there and not here. The tenant comes from an already-resolved server
 * context; no tenant, integration, account or channel is accepted as input.
 *
 * ── IT REPORTS; IT DOES NOT CHOOSE ───────────────────────────────────────────
 *
 * Zero, one and many channels are three different answers and are returned as three different
 * results. When YouTube returns several, all of them come back in YouTube's order and none is
 * marked primary: nothing in YouTube's contract names one, and a channel title or an email address
 * is a label, never an authority. Nothing is persisted — no channel is bound to the tenant here.
 *
 * ── WHAT IT CANNOT DO ────────────────────────────────────────────────────────
 *
 * It writes no connection lifecycle and no row of any kind; a YouTube outage comes back as a
 * classified failure and the grant is untouched. It never sees a plaintext token: the credential
 * is spent inside `withGoogleAccessToken`'s callback. It uploads nothing and holds no upload scope.
 *
 * Server-only.
 */
import type { ControlPlaneDatabase } from "@/db/client.server";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { getCapabilityAvailability } from "@/features/integration-authority/capability-availability.server";
import {
  GOOGLE_YOUTUBE_CHANNEL_IDENTITY_CAPABILITY,
  GOOGLE_YOUTUBE_PROVIDER_KEY,
  type GoogleFailureClass,
  type YouTubeChannelIdentity,
} from "./contracts";
import { listAuthenticatedYouTubeChannels } from "./google-transport.server";
import { withGoogleAccessToken, type GoogleAuthorizedCallDeps } from "./google-authorized-call.server";

export type YouTubeChannelIdentityRefusal =
  | "no-authorized-tenant-context"
  | "capability-not-available"
  | "integration-not-found"
  | "wrong-provider";

export type YouTubeChannelIdentityResult =
  | { readonly status: "refused"; readonly reason: YouTubeChannelIdentityRefusal; readonly detail: string }
  | { readonly status: "provider-failed"; readonly failure: GoogleFailureClass; readonly reason: string }
  /** The grant stands for no YouTube channel YouTube would name. */
  | { readonly status: "no-channel" }
  | { readonly status: "one-channel"; readonly channel: YouTubeChannelIdentity }
  /** Several — all of them, in YouTube's order. None is chosen. */
  | { readonly status: "multiple-channels"; readonly channels: readonly YouTubeChannelIdentity[]; readonly truncated: boolean };

export interface YouTubeChannelIdentityDeps extends GoogleAuthorizedCallDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  /** Test seam for the credential spend; production always uses `withGoogleAccessToken`. */
  readonly withToken?: typeof withGoogleAccessToken;
}

export async function readAuthenticatedYouTubeChannels(
  tenant: TenantContext | null,
  deps: YouTubeChannelIdentityDeps = {},
): Promise<YouTubeChannelIdentityResult> {
  if (typeof window !== "undefined") throw new Error("YouTube channel identity reads are server-only.");

  if (!tenant?.tenantId || !tenant.userId) {
    return {
      status: "refused",
      reason: "no-authorized-tenant-context",
      detail: "No organization is resolved for this request, so no connection could be consulted.",
    };
  }

  /* ── THE GATE. BEFORE ANY CREDENTIAL IS TOUCHED. ── */
  const availability = await getCapabilityAvailability(tenant, { getDb: deps.getDb });
  const entry = availability.capabilities.find((c) => c.capability === GOOGLE_YOUTUBE_CHANNEL_IDENTITY_CAPABILITY);
  if (!entry || entry.state !== "available") {
    return {
      status: "refused",
      reason: "capability-not-available",
      detail: entry?.reason ?? "YouTube channel identity is not available for this organization right now.",
    };
  }

  const source = entry.sources.find((s) => s.readAvailable);
  if (!source) {
    return {
      status: "refused",
      reason: "integration-not-found",
      detail: "No connection in this organization can currently answer this capability.",
    };
  }
  /* GOOGLE-CAPABILITY-SCOPE-REPAIR-1: only the YouTube Google connection answers this capability. */
  if (source.providerKey !== GOOGLE_YOUTUBE_PROVIDER_KEY) {
    return {
      status: "refused",
      reason: "wrong-provider",
      detail: "The YouTube channel identity seam refuses any connection that is not the YouTube Google connection.",
    };
  }

  const spend = deps.withToken ?? withGoogleAccessToken;
  const outcome = await spend(
    tenant,
    source.integrationId,
    async (accessToken) => {
      const listed = await listAuthenticatedYouTubeChannels(accessToken, deps);
      if (!listed.ok) return listed;
      return { ok: true as const, value: { channels: listed.channels, truncated: listed.truncated } };
    },
    deps,
  );

  if (!outcome.ok) return { status: "provider-failed", failure: outcome.failure, reason: outcome.reason };

  const { channels, truncated } = outcome.value;
  if (channels.length === 0 && !truncated) return { status: "no-channel" };
  if (channels.length === 1 && !truncated) return { status: "one-channel", channel: channels[0]! };
  return { status: "multiple-channels", channels, truncated };
}
