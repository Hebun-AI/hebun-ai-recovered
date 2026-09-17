/*
 * media-generation-live/openai-image-control.ts — the connectivity control key for OpenAI image
 * generation (MEDIA-2A).
 *
 * One row in the released `provider_connectivity_controls` authority, read fail-closed by the
 * generation transport resolver. No row, no database, or any read error means OFF. Nothing under
 * `src/` can write it; only the deployment-possession ceremony (`npm run provider:connectivity`) can,
 * and that ceremony refuses this key in a production posture until a dedicated gate (MEDIA-2B) exists.
 *
 * Pure constant. No I/O.
 */
export const OPENAI_IMAGE_GENERATION_CONTROL_KEY = "openai-image-generation";
