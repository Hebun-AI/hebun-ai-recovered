/*
 * standing-issuance-trigger/contracts.ts — the vocabulary of one standing issuance scan
 * (RUNG 2 act path).
 *
 * ── THIS MODULE NAMES WHAT HAPPENED. IT NAMES NOTHING THAT IS ALLOWED. ──────
 *
 * There is no permission, no scope, no tenant, no agent, no envelope, no quota, no cadence and no
 * payload expressible in any type here. A scan reports; the issuer decides. The same rule the
 * released delivery trigger vocabulary follows.
 *
 * ── THE OUTCOMES ARE THE ISSUER'S OWN, NOT A SECOND SEMANTIC SYSTEM ────────
 *
 * `StandingIssuanceRefusal` is carried THROUGH, verbatim, in `reason`. This phase invents no
 * refusal words and ranks none of them: "no envelope stands", "you withdrew it", "the window
 * closed", "the quota is spent", "not enough time has passed", "this organization is not enrolled"
 * and "that evidence already funded an act" call for seven different human responses, and
 * re-spelling them into a local enum would make all seven unanswerable — exactly the collapse
 * AMA-4 had to repair at its gate.
 *
 * `issued` is the ONLY outcome that means a permit row exists. It is deliberately not called
 * `success`, and it emphatically does not mean anything was executed, delivered or recorded: an
 * issued permit is a bounded, single-use, expiring authorization that the released RUNG 1.5
 * delivery scan and RUNG 1 executor may later spend, each re-deciding everything for themselves.
 *
 *     PROPOSED != ISSUED != DELIVERED != EXECUTED
 *
 * ── NOTHING HERE IS PERSISTED ───────────────────────────────────────────────
 *
 * No job id, no attempt id, no claim, no next-run time, no status column. These types describe one
 * tick's report and then cease to exist. A trigger that remembered anything would be a second
 * authorization ledger, and the released authorities already record the envelope, the permit, the
 * decision and the audit event.
 *
 * Server-safe: pure types. No I/O, no database, no issuer call.
 */
import type { StandingIssuanceResult } from "@/features/standing-mutation-authority/issue-permit-under-standing-authorization.server";

/**
 * What became of ONE candidate request during ONE scan.
 *
 * `requestId` is the only identifier carried, and it never leaves the server: the HTTP ingress
 * reports counts and refusal words only. A report that echoed the tenant, the agent, the envelope
 * or the permit would invite a reader to treat the report as the scope's source of truth, and the
 * authoritative rows are that source.
 */
export interface ScannedRequestOutcome {
  readonly requestId: string;
  readonly outcome: IssuanceOutcome;
}

export type IssuanceOutcome =
  /**
   * The issuer wrote ONE ordinary single-use permit under a standing envelope.
   *
   * THE ONLY OUTCOME THAT MEANS A PERMIT ROW EXISTS. Nothing was spent, executed, recorded or sent;
   * the permit is now an ordinary candidate for the released delivery path, which re-decides arming,
   * enrolment, liveness, expiry and the frozen action set for itself before anything happens.
   */
  | { readonly status: "issued"; readonly permitId: string }
  /**
   * The issuer refused. NOTHING WAS WRITTEN and no permit exists.
   *
   * `reason` is the issuer's own refusal word, carried verbatim. This is the normal outcome for
   * every request in a deployment where no envelope stands.
   */
  | { readonly status: "refused"; readonly reason: string }
  /**
   * The issuer THREW rather than refusing.
   *
   * A throw is not a refusal and this scan will not report it as one. The issuer writes inside a
   * transaction, so an escaping error leaves no permit behind and the next tick finds the request
   * again. Nothing is retried here.
   */
  | { readonly status: "failed" };

export type IssuanceScanResult =
  | {
      readonly status: "scanned";
      /** Candidates the discovery returned. */
      readonly considered: number;
      /** Candidates offered to the issuer. Equal to `considered`: the scan filters nothing after discovery. */
      readonly attempted: number;
      /** How many permits now exist that did not before this tick. */
      readonly issued: number;
      readonly outcomes: readonly ScannedRequestOutcome[];
    }
  /**
   * The candidate register could not be read, so NOTHING was attempted.
   *
   * Distinct from a scan that considered nothing: "there was nothing issuable" and "we could not
   * find out" are different facts, and a scheduler dashboard must be able to tell them apart.
   */
  | { readonly status: "unavailable"; readonly reason: "persistence-unavailable" };

/**
 * Project the issuer's own result into this scan's report. A pure rename of shape, never of
 * meaning: the refusal word is the issuer's and is copied, not mapped.
 */
export function classifyIssuanceOutcome(result: StandingIssuanceResult): IssuanceOutcome {
  return result.status === "issued"
    ? { status: "issued", permitId: result.permitId }
    : { status: "refused", reason: result.reason };
}
