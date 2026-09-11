/*
 * social-intelligence/dashboard-read.server.ts — the only place SOC-UI1 touches a released
 * authority.
 *
 * ── STORED HISTORY, NOT A LOOK ──────────────────────────────────────────────
 *
 * Every read below goes through the released observation read authority, which contacts no provider,
 * decrypts no credential and writes nothing. **Rendering a page has never been, and must not become,
 * a reason to ask Instagram or YouTube anything.** There is no provider client imported here, no
 * transport, no API key, and no code path that could acquire one.
 *
 * ── ONE READ PER CAPABILITY, EACH NAMED ─────────────────────────────────────
 *
 * The capability key is passed on every query, and the omission of one has already been a real
 * defect in this repository: when Instagram gained a second capability, an unscoped query started
 * returning MEDIA rows to a section that understood the ACCOUNT vocabulary, and it reported five
 * facts as unreported that the provider had actually reported. A consumer that understands one
 * vocabulary must ask for it by name.
 *
 * ── THE LIMITS ARE THE DERIVATIONS' OWN ─────────────────────────────────────
 *
 * `ACCOUNT_SERIES_OBSERVATION_LIMIT` and `YOUTUBE_CHANNEL_SERIES_OBSERVATION_LIMIT` are the bounds
 * the released derivations recommend for their own cadence. They are imported rather than restated,
 * so a phase that changes a cadence changes this page with it — and they are deliberately separate
 * constants that happen to be equal, not one constant shared by two platforms.
 *
 * ── THE MEDIA READ ASKS FOR ONE ROW ─────────────────────────────────────────
 *
 * The recent-content section shows ONE stored observation. `limit: 1` means no page render can pull
 * a history this surface has no way to display.
 */
import { listConnections } from "@/features/integration-authority/integration-read.server";
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";
import { readProviderObservations } from "@/features/provider-observation-history/read-provider-observations.server";
import {
  INSTAGRAM_ACCOUNT_PUBLIC_READ_CAPABILITY,
  INSTAGRAM_MEDIA_PUBLIC_READ_CAPABILITY,
  INSTAGRAM_PROVIDER_KEY,
} from "@/features/provider-instagram/contracts";
import {
  YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY,
  YOUTUBE_PROVIDER_KEY,
} from "@/features/provider-youtube/contracts";
import { ACCOUNT_SERIES_OBSERVATION_LIMIT } from "@/features/instagram-connection-surface/account-measurement-series";
import { YOUTUBE_CHANNEL_SERIES_OBSERVATION_LIMIT } from "@/features/youtube-channel-surface/channel-measurement-series";
import { composeSocialDashboard, type SocialDashboardModel } from "./dashboard-model";

/**
 * Read everything the Social Intelligence surface needs, then compose it.
 *
 * THE TENANT IS THE SESSION'S. It is handed to each seam as the seam requires and is not derivable
 * from a connection, an account or the URL; a null session is answered as `unavailable` by the seams
 * themselves, which is why it is passed rather than branched on here — and why an unresolved session
 * produces an honest "unknown" on the surface rather than an empty one.
 *
 * The four reads are independent and are issued together. None of them can influence another: they
 * take no shared lock, no shared transaction and no shared cursor, and the composition that follows
 * is pure.
 */
export async function readSocialDashboard(): Promise<SocialDashboardModel> {
  /*
   * The repository's server-only convention is a runtime guard, not a bundler package. The seams
   * below each carry their own; this one exists so a client import of THIS module fails loudly at
   * the composition boundary rather than three frames deeper inside an authority.
   */
  if (typeof window !== "undefined") {
    throw new Error("The Social Intelligence dashboard read is server-only.");
  }

  const tenant = await resolveTenantContext();

  const [connections, instagramAccount, instagramMedia, youtubeChannel] = await Promise.all([
    listConnections(tenant),
    readProviderObservations(tenant, {
      providerKey: INSTAGRAM_PROVIDER_KEY,
      capabilityKey: INSTAGRAM_ACCOUNT_PUBLIC_READ_CAPABILITY,
      limit: ACCOUNT_SERIES_OBSERVATION_LIMIT,
    }),
    readProviderObservations(tenant, {
      providerKey: INSTAGRAM_PROVIDER_KEY,
      capabilityKey: INSTAGRAM_MEDIA_PUBLIC_READ_CAPABILITY,
      limit: 1,
    }),
    readProviderObservations(tenant, {
      providerKey: YOUTUBE_PROVIDER_KEY,
      capabilityKey: YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY,
      limit: YOUTUBE_CHANNEL_SERIES_OBSERVATION_LIMIT,
    }),
  ]);

  return composeSocialDashboard({ connections, instagramAccount, instagramMedia, youtubeChannel });
}
