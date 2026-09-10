/*
 * provider-instagram/read-media-observation.server.ts — ONE authorized Instagram media read.
 *
 * The body the media observation path runs. It performs exactly one provider request, timestamps the
 * read with Hebun's clock — Instagram does not timestamp it — and returns what Instagram said about
 * a bounded window of the account's recent media.
 *
 * IT TOUCHES NO TABLE, exactly as the released account read does not. A firewall asserts that every
 * file under this provider module writes nothing, and this module keeps that: no database import,
 * no writer. Persistence belongs to Provider Observation History, which owns the sentence "the
 * provider reported this".
 *
 * ── ONE REQUEST, AND NO SECOND ONE HIDING BEHIND IT ─────────────────────────
 *
 * No pagination loop, no per-media follow-up read, no comments edge, no insights edge, and no fetch
 * of any URL Instagram handed back. A capability that spends an unbounded number of provider calls
 * per authorization tick is not a bounded capability, whatever its declaration says.
 *
 * Server-only.
 */
import { MAX_RECENT_MEDIA, type InstagramMediaObservation, type InstagramResult } from "./contracts";
import { readAccountMedia, type InstagramTransportDeps } from "./instagram-transport.server";

export interface ReadMediaObservationDeps extends InstagramTransportDeps {
  /** Injectable so an observation's instant is provable. Never reaches a provider request. */
  readonly now?: () => Date;
}

/**
 * Observe one Instagram professional account's recent media by the account's provider-issued id.
 *
 * AN EMPTY WINDOW IS A SUCCESS. An account that has posted nothing answers with zero media, and that
 * is a fact about the account — not a provider failure, not an unavailable read, and not something
 * to retry. The released YouTube path learned this the expensive way with an empty channel.
 */
export async function observeAccountMediaById(
  accessToken: string,
  accountId: string,
  deps: ReadMediaObservationDeps = {},
): Promise<InstagramResult<InstagramMediaObservation>> {
  const read = await readAccountMedia(accessToken, accountId, deps);
  if (!read.ok) return read;

  return {
    ok: true,
    value: {
      accountId,
      recentMedia: read.value.media.slice(0, MAX_RECENT_MEDIA),
      moreMediaExist: read.value.moreMediaExist,
      observedAt: (deps.now ?? (() => new Date()))().toISOString(),
    },
  };
}
