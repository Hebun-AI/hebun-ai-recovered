/*
 * media-assets/async-generation-transport.server.ts — the runtime asynchronous (video) generation
 * transport resolver.
 *
 * MV-4 answers `unavailable` unconditionally, exactly as MEDIA-1 did for images before a live
 * transport existed. No real video provider is connected, and none is inferred from configuration or
 * credentials. The simulated transport lives under `tests/helpers` and enters only through deps; it is
 * never resolvable here, so a simulated answer can never be mistaken for a provider's.
 *
 * Server-only.
 */
import type { MediaAsyncGenerationTransportResolution } from "./async-generation-transport";

export async function resolveMediaAsyncGenerationTransport(): Promise<MediaAsyncGenerationTransportResolution> {
  if (typeof window !== "undefined") {
    throw new Error("Media generation transport resolution is server-only.");
  }
  return { status: "unavailable", reason: "no-video-generation-provider" };
}
