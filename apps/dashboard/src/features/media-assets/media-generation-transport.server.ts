/*
 * media-assets/media-generation-transport.server.ts — the runtime transport resolver (MEDIA-1).
 *
 * IT ANSWERS `unavailable`, UNCONDITIONALLY. No generation provider is integrated — not Higgsfield,
 * not any other. The only transport MEDIA-1 can express is a fake one, and that fake lives under
 * `tests/helpers`, injected through deps, outside the application bundle. A production request is
 * therefore refused before anything is written.
 *
 * Server-only.
 */
import type { MediaGenerationTransportResolution } from "./media-generation-transport";

export function resolveMediaGenerationTransport(): MediaGenerationTransportResolution {
  if (typeof window !== "undefined") {
    throw new Error("Media generation transport resolution is server-only.");
  }
  return { status: "unavailable", reason: "no-generation-provider" };
}
