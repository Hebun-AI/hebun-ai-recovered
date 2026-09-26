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
}

export type MediaAsyncGenerationTransportResolution =
  | { readonly status: "available"; readonly transport: MediaAsyncGenerationTransport }
  | { readonly status: "unavailable"; readonly reason: "no-video-generation-provider" };
