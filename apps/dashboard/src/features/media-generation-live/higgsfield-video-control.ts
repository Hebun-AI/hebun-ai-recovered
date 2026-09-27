/*
 * media-generation-live/higgsfield-video-control.ts — the connectivity control key for Higgsfield
 * video generation (MV-6).
 *
 * One row in the released `provider_connectivity_controls` authority, read fail-closed by the
 * asynchronous generation transport resolver. No row, no database, or any read error means OFF.
 * Nothing under `src/` can write it; only the deployment-possession ceremony (`npm run
 * provider:connectivity`) can, and that ceremony refuses this key in a production posture: it is
 * NOT enumerated in `GENERIC_PRODUCTION_REACHABLE_KEYS`, and no dedicated gate exists yet. Production
 * arming is a separate Director decision, exactly as MEDIA-2A → MEDIA-2B was for images.
 *
 * Pure constant. No I/O.
 */
export const HIGGSFIELD_VIDEO_GENERATION_CONTROL_KEY = "higgsfield-video-generation";
