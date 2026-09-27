/*
 * media-assets/async-generation-transport.server.ts — the runtime asynchronous (video) generation
 * transport resolver.
 *
 * MV-4 answered `unavailable` unconditionally. MV-6 delegates the question to the ONE live video
 * resolver in `media-generation-live`, which returns a real provider transport only when selection, a
 * credential-shaped key pair AND the Director connectivity control all hold, and `unavailable`
 * otherwise. This module stays provider-neutral: it names no provider and reads no configuration.
 *
 * The simulated transport lives under `tests/helpers` and enters only through deps; it is never
 * resolvable here, so a simulated answer can never be mistaken for a provider's.
 *
 * Server-only.
 */
import type { MediaAsyncGenerationTransportResolution, MediaAsyncTransportRequest } from "./async-generation-transport";
import {
  resolveLiveVideoGenerationTransport,
  type LiveVideoGenerationResolverDeps,
} from "@/features/media-generation-live/live-video-generation-resolver.server";

export async function resolveMediaAsyncGenerationTransport(
  deps: LiveVideoGenerationResolverDeps = {},
  request?: MediaAsyncTransportRequest,
): Promise<MediaAsyncGenerationTransportResolution> {
  if (typeof window !== "undefined") {
    throw new Error("Media generation transport resolution is server-only.");
  }
  return resolveLiveVideoGenerationTransport(deps, request);
}
