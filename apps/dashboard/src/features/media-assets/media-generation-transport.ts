/*
 * media-assets/media-generation-transport.ts — the generation transport PORT (MEDIA-1).
 *
 * A transport turns a bounded prompt into image output. It is NOT trusted for anything it says about
 * that output: its declared content type is only ever used to refuse a mismatch, and any URL it
 * returns is followed once, inside `allowedDownloadHosts`, then discarded.
 *
 * ── `transport: "fake"` IS A TYPE, NOT A CONVENTION ─────────────────────────
 *
 * MEDIA-1 admits no live provider. The literal type makes a live transport unrepresentable at compile
 * time, and `media_generation_invocations_transport_chk` makes it unwritable at runtime. Adding a real
 * provider is a gate that must widen both, deliberately.
 *
 * Pure types. No I/O.
 */
import type { MEDIA_GENERATION_TRANSPORT } from "./contracts";

export type MediaGenerationOutput =
  | {
      readonly kind: "bytes";
      readonly bytes: Uint8Array;
      readonly declaredContentType: string | null;
    }
  | {
      /** Ephemeral. Followed once through the download seam and never persisted or logged. */
      readonly kind: "url";
      readonly url: string;
      readonly declaredContentType: string | null;
    };

export type MediaGenerationOutcome =
  | {
      readonly status: "succeeded";
      readonly providerJobId: string | null;
      readonly output: MediaGenerationOutput;
    }
  | {
      readonly status: "failed";
      readonly providerJobId: string | null;
    };

export interface MediaGenerationTransport {
  readonly transport: typeof MEDIA_GENERATION_TRANSPORT;
  readonly provider: string;
  readonly model: string;
  /** Exact lowercase hostnames a returned URL may point at. Empty means URLs are refused. */
  readonly allowedDownloadHosts: readonly string[];
  generate(input: {
    readonly promptText: string;
    readonly inputDigest: string;
  }): Promise<MediaGenerationOutcome>;
}

export type MediaGenerationTransportResolution =
  | { readonly status: "available"; readonly transport: MediaGenerationTransport }
  | { readonly status: "unavailable"; readonly reason: "no-generation-provider" };
