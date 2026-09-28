"use server";

import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";
import {
  readAuthenticatedYouTubeChannels,
  type YouTubeChannelIdentityResult,
} from "@/features/provider-google/read-youtube-channel-identity.server";

/**
 * YOUTUBE-WRITE-1 — read which YouTube channel(s) this organization's Google grant stands for.
 *
 * It takes NO arguments: no tenant, integration, account or channel can arrive from the browser.
 * The tenant is the session's; the connection is discovered from that tenant's own availability.
 * A READ — it writes nothing, binds no channel and returns only channel ids and titles.
 */
export async function readYouTubeChannelIdentityAction(): Promise<YouTubeChannelIdentityResult> {
  return readAuthenticatedYouTubeChannels(await resolveTenantContext());
}
