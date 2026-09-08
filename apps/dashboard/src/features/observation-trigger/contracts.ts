/*
 * observation-trigger/contracts.ts — the vocabulary of an automatic due-scan (TRH-25).
 *
 * ── EVERY OUTCOME IS A DIFFERENT FACT, AND NONE OF THEM IS A DECISION ───────
 *
 * This module names what HAPPENED. It names nothing about what is ALLOWED: there is no permission,
 * no scope, no tenant and no credential expressible in any type here. A scan reports; the
 * revalidator decides.
 *
 * THE OUTCOMES ARE NOT COLLAPSED. "Governance took this away", "an operator pulled the emergency
 * stop", "the connection is unwell", "YouTube is out of quota" and "we stored nothing" call for
 * five different human responses, and a single `failed` would make all five unanswerable. This is
 * the same rule the released refusal vocabularies already follow — the trigger adds no new
 * philosophy, only a per-authorization envelope around the ones that exist.
 *
 * Server-safe: pure types and one pure classifier. No I/O, no database, no provider.
 */
import type { ObserveOnceOutcome } from "@/features/provider-observation-history/observe-once-under-authorization.server";

/**
 * What became of ONE authorization during ONE scan.
 *
 * `authorizationId` is the only identifier carried, deliberately: a report that echoed the tenant,
 * subject or connection would invite a reader to treat the report as the scope's source of truth,
 * and the authorization row is that source.
 */
export interface ScannedAuthorizationOutcome {
  readonly authorizationId: string;
  readonly outcome: ScanOutcome;
}

export type ScanOutcome =
  /* ── decided by the SCAN, before the composition is called ─────────────── */
  /**
   * The cadence ceiling has not elapsed, so no attempt was made.
   *
   * A COURTESY, NOT AN AUTHORITY. The revalidator applies the same rule authoritatively; this one
   * exists only so a scan does not spend a database round trip and a principal mint per
   * authorization per tick. If the two ever disagreed the revalidator would win, and the scan
   * being wrong could only ever cause a REFUSAL, never a read.
   */
  | { readonly status: "not-due"; readonly minutesElapsed: number | null; readonly intervalMinutes: number }
  /** The observation history could not be read, so due-ness is unknown. Fails closed: no attempt. */
  | { readonly status: "due-unknown" }

  /* ── decided by the released TRH-24 authorities ────────────────────────── */
  /** The authorization is no longer mintable — withdrawn, superseded, or no longer observable. */
  | { readonly status: "not-authorized"; readonly reason: string }
  /**
   * The authoritative pre-transport check refused. NO PROVIDER WAS CONTACTED.
   *
   * `reason` carries the revalidator's own word — `observation-read-disabled` when the operator's
   * stop is off, `connection-unhealthy`, `credential-unavailable`, `observed-too-recently` and the
   * rest. The trigger does not re-spell them and does not rank them.
   */
  | { readonly status: "refused"; readonly reason: string }
  /** The provider was contacted and did not answer usefully. Nothing was recorded. */
  | { readonly status: "provider-failed"; readonly failure: string }
  /** The subject on the authorization is not one this provider path can read. */
  | { readonly status: "unsupported-subject" }

  /* ── the provider answered ─────────────────────────────────────────────── */
  /** Observed AND recorded. The only outcome that means a new row exists. */
  | { readonly status: "recorded"; readonly observationId: string }
  /**
   * Observed, and deliberately NOT stored, because a concurrent invocation already claimed this
   * cadence window or this exact instant.
   *
   * DISTINCT FROM `recorded` ON PURPOSE. Reporting this as success would let a double-fired trigger
   * look like two observations in a log while the database correctly holds one.
   */
  | { readonly status: "duplicate-suppressed"; readonly reason: string }
  /**
   * The provider answered and Hebun FAILED TO REMEMBER IT.
   *
   * OBSERVED AND RECORDED ARE DIFFERENT STATES, and this is the one that must never be reported as
   * success. The observation happened and is true; the row does not exist.
   */
  | { readonly status: "observed-not-recorded"; readonly reason: string };

/** What became of a whole scan. */
export type ScanResult =
  | {
      readonly status: "scanned";
      readonly considered: number;
      readonly attempted: number;
      readonly recorded: number;
      readonly outcomes: readonly ScannedAuthorizationOutcome[];
    }
  /** The authorization register could not be read. Nothing was attempted. */
  | { readonly status: "unavailable"; readonly reason: "persistence-unavailable" };

/**
 * Translate one released composition outcome into this phase's vocabulary.
 *
 * PURE, AND DELIBERATELY TOTAL: every branch of `ObserveOnceOutcome` is named, so a future variant
 * added to the composition fails to compile here rather than being silently reported as something
 * it is not.
 */
export function classifyObserveOutcome(outcome: ObserveOnceOutcome): ScanOutcome {
  switch (outcome.status) {
    case "not-authorized":
      return { status: "not-authorized", reason: outcome.reason };
    case "refused":
      return { status: "refused", reason: outcome.reason };
    case "unsupported-subject":
      return { status: "unsupported-subject" };
    case "provider-failed":
      return { status: "provider-failed", failure: outcome.failure.failure };
    case "observed": {
      const record = outcome.record;
      if (record.status === "recorded") {
        return { status: "recorded", observationId: record.observationId };
      }
      if (record.status === "already-recorded") {
        return { status: "duplicate-suppressed", reason: "already-recorded" };
      }
      /*
       * A REFUSED WRITE IS SPLIT, because two of its reasons mean "another invocation won" and the
       * rest mean "Hebun lost an observation it performed". Folding them together would hide a real
       * persistence failure inside a word that means the system worked.
       */
      return record.reason === "cadence-window-already-observed" ||
        record.reason === "invocation-already-recorded"
        ? { status: "duplicate-suppressed", reason: record.reason }
        : { status: "observed-not-recorded", reason: record.reason };
    }
  }
}
