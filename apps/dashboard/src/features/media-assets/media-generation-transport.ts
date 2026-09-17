/*
 * media-assets/media-generation-transport.ts — the generation transport PORT (MEDIA-1).
 *
 * A transport turns a bounded prompt into image output. It is NOT trusted for anything it says about
 * that output: its declared content type is only ever used to refuse a mismatch, and any URL it
 * returns is followed once, inside `allowedDownloadHosts`, then discarded.
 *
 * ── `transport` IS A CLOSED TYPE, NOT A CONVENTION ──────────────────────────
 *
 * MEDIA-1 admitted only `fake`. MEDIA-2A widened the type and
 * `media_generation_invocations_transport_chk` together to `fake | live`, deliberately. A transport
 * is still only a transport: it returns bytes (or reports a closed failure code); it never writes a
 * row, never stores bytes, and never decides admission.
 *
 * Pure types. No I/O.
 */
import type { MediaGenerationTransportKind, MediaProviderFailure, MediaProviderUsage } from "./contracts";

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
      readonly usage: MediaProviderUsage | null;
    }
  | {
      readonly status: "failed";
      readonly providerJobId: string | null;
      readonly failure: Exclude<MediaProviderFailure, "dispatch-error">;
      readonly usage: MediaProviderUsage | null;
    };

export interface MediaGenerationTransport {
  readonly transport: MediaGenerationTransportKind;
  readonly provider: string;
  readonly model: string;
  /** Exact lowercase hostnames a returned URL may point at. Empty means URLs are refused. */
  readonly allowedDownloadHosts: readonly string[];
  generate(input: {
    readonly promptText: string;
    readonly inputDigest: string;
    /** The registered invocation's id — a correlation id only, never an idempotency key. */
    readonly invocationId: string;
  }): Promise<MediaGenerationOutcome>;
}

export type MediaGenerationTransportResolution =
  | { readonly status: "available"; readonly transport: MediaGenerationTransport }
  | {
      readonly status: "unavailable";
      readonly reason: "no-generation-provider" | "generation-misconfigured" | "generation-disabled";
    };
