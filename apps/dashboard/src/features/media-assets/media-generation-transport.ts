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
 * ── MEDIA-5: TWO MODES, ONE TRANSPORT, DISCRIMINATED ────────────────────────
 *
 * MEDIA-5 adds a second thing a transport can be asked to do: edit ONE admitted image according to
 * an instruction. It is expressed as a DISCRIMINATED UNION on `request`, not as optional fields,
 * because the two modes do not share a request shape at the provider — text-to-image is a JSON body
 * and a reference edit is multipart with a file part. An optional `referenceImage?` would make
 * "reference edit with no image" and "text-to-image" the same value, and the adapter would have to
 * re-derive the mode from whether a field happened to be set.
 *
 * `modes` is what a transport DECLARES it can do. It exists so the authority can refuse a mode
 * before it registers an invocation — no row, no paid call — rather than discovering it from a
 * provider error after the money is spent.
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

/** The two things a transport may be asked for. A closed set; MEDIA-5 adds the second. */
export type MediaGenerationMode = "text-to-image" | "reference-edit";

/**
 * The ONE admitted image a reference edit is performed on.
 *
 * The bytes are already in this process, already read from the authoritative store and already
 * checked against the `media_assets` row before this value is constructed. A transport receives
 * BYTES and never a key, a URL or an asset id: it has no way to fetch anything itself, and nothing
 * it is given can be turned back into a storage location.
 *
 * `fileName` exists only because multipart requires a filename part. It is DERIVED from the asset id
 * and its admitted MIME type — never supplied by a caller, never a path.
 */
export interface MediaGenerationReferenceImage {
  readonly bytes: Uint8Array;
  /** The MIME type the asset row records. Not the provider's opinion and not a sniffed guess. */
  readonly contentType: string;
  readonly fileName: string;
}

export type MediaGenerationRequest =
  | { readonly mode: "text-to-image" }
  | { readonly mode: "reference-edit"; readonly referenceImage: MediaGenerationReferenceImage };

export interface MediaGenerationTransport {
  readonly transport: MediaGenerationTransportKind;
  readonly provider: string;
  readonly model: string;
  /** Exact lowercase hostnames a returned URL may point at. Empty means URLs are refused. */
  readonly allowedDownloadHosts: readonly string[];
  /** What this transport can actually be asked for. Checked in preflight, before any row or call. */
  readonly modes: readonly MediaGenerationMode[];
  generate(input: {
    readonly promptText: string;
    readonly inputDigest: string;
    /** The registered invocation's id — a correlation id only, never an idempotency key. */
    readonly invocationId: string;
    /** MEDIA-5. Which of the two operations, and its input. Required: there is no implied default. */
    readonly request: MediaGenerationRequest;
  }): Promise<MediaGenerationOutcome>;
}

export type MediaGenerationTransportResolution =
  | { readonly status: "available"; readonly transport: MediaGenerationTransport }
  | {
      readonly status: "unavailable";
      readonly reason: "no-generation-provider" | "generation-misconfigured" | "generation-disabled";
    };
