/*
 * heby-provider-ops/usage-contracts.ts — the vocabulary of RECORDED provider usage (R2F.1).
 *
 * ── WHAT THIS IS, STATED NARROWLY ────────────────────────────────────────────
 *
 *   RECORDED PROVIDER USAGE = durably persisted, provider-REPORTED token counts,
 *   belonging to the requesting tenant, written from a REAL provider transport.
 *
 * It is NOT spend, not cost, not money, not a bill, not "what the provider charged",
 * and not "everything that ever happened". R2F.1 adds no pricing, no currency and no
 * budget, so no field here carries any of those and none may be derived from these.
 *
 * ── WHY EVERY TOTAL IS A LOWER BOUND ─────────────────────────────────────────
 *
 * A provider call and its local record are two separate things. `persistExchange`
 * runs AFTER the HTTP call returns, in its own transaction, and swallows failure into
 * an honest `durable: false`. So a provider request can succeed — money leaves the
 * account — while no row is ever written: a timeout after the provider already
 * charged, a crash between the response and the commit, a persistence error.
 *
 * Nothing downstream can recover those. An aggregation over what WAS recorded can
 * therefore only ever be a floor, never the true total, and every surface built on
 * this contract has to say so out loud rather than presenting a floor as a fact.
 *
 * ── WHY "UNKNOWN" IS A COUNT AND NOT A ZERO ──────────────────────────────────
 *
 * A row whose token columns are NULL means "the provider did not report this", which
 * is a different statement from "this consumed nothing". Folding the first into the
 * second would manufacture a measurement out of an absence — so the absence is
 * carried as its own number (`unknownTokenRows`) and is never summed.
 */

/**
 * The `messages.transport` value that marks a row as REAL provider usage.
 *
 * The stored vocabulary is the closed union `"fake" | "live"` (see
 * `ModelTransportSelection.transportProvenance` and `HebyRuntimeResponse`), written by
 * `persistExchange` only for a model-origin answer. `"fake"` is the local dev-proof
 * transport, which emits a synthetic `{inputTokens: 0, outputTokens: 0}` and never
 * contacts a provider — counting it as usage would report proof runs as consumption.
 *
 * This is the established stored value, not a guess: it is asserted against real rows
 * in the durability suite.
 */
export const REAL_PROVIDER_TRANSPORT = "live" as const;

/** Group key used when a recorded row carries no provider/model label. */
export const UNLABELLED_USAGE_KEY = "unknown" as const;

/**
 * Counts over one set of recorded provider rows.
 *
 * INVARIANT: `recordedCalls === fullyMeasuredCalls + unknownTokenRows`.
 *
 * The token sums cover `fullyMeasuredCalls` rows ONLY — rows where BOTH counts are
 * present. This mirrors the per-row rule the response validator already applies:
 * `totalTokens` there is `undefined` unless both `inputTokens` and `outputTokens`
 * came back. Summing a half-measured row would produce a figure that is neither the
 * input total nor the output total, and would silently attach a real number to a row
 * the provider never fully reported.
 */
export interface RecordedUsageTotals {
  /** Rows from the real provider transport belonging to this tenant. */
  readonly recordedCalls: number;
  /** Of those, rows carrying BOTH an input and an output count. */
  readonly fullyMeasuredCalls: number;
  /** Of those, rows missing at least one count. Never folded into a zero. */
  readonly unknownTokenRows: number;
  /** Sum of input tokens over fully measured rows. */
  readonly inputTokens: number;
  /** Sum of output tokens over fully measured rows. */
  readonly outputTokens: number;
  /** `inputTokens + outputTokens`. A LOWER BOUND — see the header. */
  readonly totalTokens: number;
}

/** One dimension bucket: a provider key, a model id, or a UTC calendar day. */
export interface RecordedUsageGroup extends RecordedUsageTotals {
  readonly key: string;
}

/**
 * The tenant's recorded provider usage.
 *
 * Dimensions are limited to the ones the approved surfaces actually consume
 * (`/director/provider-matrix` and Heby `/usage`). Per-user, per-conversation and
 * per-hour are deliberately absent: the columns would support them, but a dimension
 * with no reader is analytics infrastructure, not a capability.
 */
export interface RecordedProviderUsage {
  readonly totals: RecordedUsageTotals;
  readonly byProvider: readonly RecordedUsageGroup[];
  readonly byModel: readonly RecordedUsageGroup[];
  /** UTC calendar days (`YYYY-MM-DD`), newest first. See the aggregation module. */
  readonly byDay: readonly RecordedUsageGroup[];
}

export type RecordedProviderUsageUnavailableReason =
  | "no-authorized-tenant-context"
  | "persistence-not-configured"
  | "read-failed";

/** Mirrors `ExecutionAttemptRead`: an honest unavailable rather than a fabricated zero. */
export type RecordedProviderUsageRead =
  | { readonly status: "read"; readonly usage: RecordedProviderUsage }
  | { readonly status: "unavailable"; readonly reason: RecordedProviderUsageUnavailableReason };

/** The zero-valued totals, for a tenant that has no recorded provider usage at all. */
export function emptyRecordedUsageTotals(): RecordedUsageTotals {
  return {
    recordedCalls: 0,
    fullyMeasuredCalls: 0,
    unknownTokenRows: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  };
}

/**
 * True when the tenant has no recorded provider usage.
 *
 * Surfaces use this to render an honest empty state ("nothing recorded") instead of a
 * row of zeroes, which reads as "measured, and it was zero" — a different claim.
 */
export function hasNoRecordedUsage(usage: RecordedProviderUsage): boolean {
  return usage.totals.recordedCalls === 0;
}
