/*
 * media-assets/async-generation-transport.ts — the provider-neutral ASYNCHRONOUS generation boundary
 * (MV-4).
 *
 * A long-running provider job is two calls, not one: `dispatch` asks for the work and `poll` asks how
 * it is going. Neither returns bytes. Completion yields an OPAQUE output reference — provider-derived
 * truth that output exists — and nothing else. Retrieval, verification and Media admission are later
 * and separate; no answer from this boundary ever creates a `media_assets` row.
 *
 * ── THREE DISPATCH ANSWERS, AND WHY "UNKNOWN" IS ONE OF THEM ─────────────────
 *
 *   accepted  the provider acknowledged the job and named it          → provider-pending
 *   rejected  the provider answered and refused, with a closed code   → provider-failed
 *   unknown   the request left Hebun and no trustworthy answer came   → dispatch-unknown
 *
 * A timeout after sending is `unknown`, never `rejected`: the provider may have accepted and may bill.
 * The lifecycle writer treats a THROW from `dispatch` the same way. There is no retry on any of them —
 * an ambiguous POST is not safe to repeat until a provider contract supplies a proven idempotency key.
 *
 * `poll` answers only for a job the provider already named. A throw or an unreadable answer is not a
 * transition: the job stays pending and the observation is simply not counted as terminal.
 *
 * Provider identity lives on the transport and is recorded on the invocation row, exactly as the
 * synchronous transport's does. Credentials never cross this boundary.
 *
 * Pure types. No I/O.
 */
import type { MediaGenerationTransportKind, MediaProviderFailure } from "./contracts";

/** Provider failure codes an asynchronous provider may report. `dispatch-error` is the sync path's. */
export type MediaAsyncProviderFailure = Exclude<MediaProviderFailure, "dispatch-error">;

export type MediaAsyncDispatchOutcome =
  | { readonly status: "accepted"; readonly providerJobId: string }
  | { readonly status: "rejected"; readonly failure: MediaAsyncProviderFailure; readonly providerJobId?: string | null }
  | { readonly status: "unknown" };

export type MediaAsyncPollOutcome =
  | { readonly status: "pending" }
  | { readonly status: "succeeded"; readonly outputRef: string }
  | { readonly status: "failed"; readonly failure: MediaAsyncProviderFailure };

export interface MediaAsyncGenerationTransport {
  readonly transport: MediaGenerationTransportKind;
  readonly provider: string;
  readonly model: string;
  /** What this transport produces. MV-4 knows one asynchronous kind. */
  readonly outputMediaKind: "video";
  dispatch(input: {
    readonly promptText: string;
    readonly inputDigest: string;
    /** The registered invocation's id — a correlation id only, never an idempotency key. */
    readonly invocationId: string;
  }): Promise<MediaAsyncDispatchOutcome>;
  poll(input: { readonly providerJobId: string }): Promise<MediaAsyncPollOutcome>;
  /**
   * MV-7 — OPTIONAL. Re-observe ONE already-completed job and say where its output can be read.
   * A status READ only: it never dispatches, never spends a generation budget, and writes nothing. A
   * transport without it cannot have its output admitted.
   */
  locateOutput?(input: { readonly providerJobId: string }): Promise<MediaAsyncOutputLocation>;
}

/*
 * ── MV-7: WHERE A COMPLETED JOB'S OUTPUT CAN BE READ ─────────────────────────
 *
 * A provider output URL is ephemeral and may be signed, so it is treated like a credential: it is
 * never a property of this object. `reveal()` hands it to exactly one caller — the provider-output
 * download seam — and `JSON.stringify` / `util.inspect` of the location show only its SHAPE (a
 * function is not serialized). The shape is what a human may see: scheme, hostname, the NAMES of the
 * query parameters (never their values), and structure of the path (never its text).
 *
 * `allowedHosts` is the transport's own EXACT host allowlist for its outputs. It may be empty — then
 * nothing is downloadable, which is the truthful state until a host is approved.
 */
export interface MediaProviderOutputShape {
  readonly scheme: string;
  readonly hostname: string;
  readonly hasPort: boolean;
  readonly hasCredentials: boolean;
  readonly queryParameterNames: readonly string[];
  readonly pathSegmentCount: number;
  /** The last path segment's extension, when it is a plain short one (".mp4"); otherwise null. */
  readonly pathExtension: string | null;
}

export interface MediaProviderOutputLocation {
  readonly shape: MediaProviderOutputShape;
  readonly allowedHosts: readonly string[];
  /** The URL itself. For the download seam only; never log, persist, return or print it. */
  readonly reveal: () => string;
}

export type MediaAsyncOutputLocation =
  /** The provider says the job completed and names an output. */
  | { readonly status: "located"; readonly location: MediaProviderOutputLocation }
  /** The provider answered, but not with a usable completed output. `state` is provider-neutral. */
  | { readonly status: "not-located"; readonly reason: "pending" | "failed" | "no-output" }
  /** The provider no longer answers for this job id. */
  | { readonly status: "not-found" }
  /** No authoritative answer was read. */
  | { readonly status: "unreadable" };

export type MediaAsyncGenerationTransportResolution =
  | { readonly status: "available"; readonly transport: MediaAsyncGenerationTransport }
  | {
      readonly status: "unavailable";
      /**
       * no-video-generation-provider   nothing is selected
       * video-generation-misconfigured something is selected, but not a live provider with a
       *                                credential-shaped key (MV-6)
       * video-generation-disabled      configured, and the Director control is not ON (MV-6)
       */
      readonly reason: "no-video-generation-provider" | "video-generation-misconfigured" | "video-generation-disabled";
    };
