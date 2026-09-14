/*
 * machine-delivery-trigger/contracts.ts — the vocabulary of one automatic delivery scan (RUNG 2).
 *
 * ── THIS MODULE NAMES WHAT HAPPENED. IT NAMES NOTHING THAT IS ALLOWED. ──────
 *
 * There is no permission, no scope, no tenant, no payload and no credential expressible in any type
 * here. A scan reports; the executor decides. The same rule TRH-25's trigger vocabulary follows.
 *
 * ── THE OUTCOMES ARE THE EXECUTOR'S OWN, NOT A SECOND SEMANTIC SYSTEM ───────
 *
 * `MachineRecordWorkRefusal` is carried THROUGH, verbatim, in `reason`. This phase invents no
 * refusal words and ranks none of them: "the deployment is disarmed", "this organization withdrew",
 * "the agent retired" and "the permit was already spent" call for four different human responses,
 * and re-spelling them into a local enum would make all four unanswerable — exactly the collapse
 * AMA-4 had to repair at its gate.
 *
 * `delivered` is the ONLY outcome that means a permit was spent and work exists. It is deliberately
 * not called `success`: the executor reports execution, and the work authority's own result rides
 * inside that. Accepted for delivery, executed, and successful are three different facts.
 *
 * ── NOTHING HERE IS PERSISTED ───────────────────────────────────────────────
 *
 * No job id, no attempt id, no claim, no next-run time, no status column. These types describe one
 * tick's report and then cease to exist. A trigger that remembered anything would be a second
 * execution ledger, and the released authorities already record the spend, the invocation, the work
 * row and the audit event.
 *
 * Server-safe: pure types and one pure classifier. No I/O, no database, no executor call.
 */
import type { MachineRecordWorkResult } from "@/features/governed-machine-execution/execute-record-work-as-machine.server";

/**
 * What became of ONE candidate permit during ONE scan.
 *
 * `permitId` is the only identifier carried, and it never leaves the server: the HTTP ingress
 * reports counts and outcome categories only. A report that echoed the tenant, the payload or the
 * work title would invite a reader to treat the report as the scope's source of truth, and the
 * authoritative rows are that source.
 */
export interface ScannedPermitOutcome {
  readonly permitId: string;
  readonly outcome: DeliveryOutcome;
}

export type DeliveryOutcome =
  /**
   * The executor spent the permit and the work authority recorded the act.
   *
   * THE ONLY OUTCOME THAT MEANS A ROW EXISTS. `invocationId` is the released correlation for that
   * run; no new identifier is minted by this phase.
   */
  | { readonly status: "delivered"; readonly invocationId: string }
  /**
   * The executor refused. NOTHING WAS SPENT and no work exists.
   *
   * `reason` is the executor's own refusal word and `authorityReason` the owning authority's, both
   * carried verbatim. This is the normal outcome while the root control is disarmed.
   */
  | { readonly status: "refused"; readonly reason: string; readonly authorityReason?: string }
  /**
   * The executor call itself threw.
   *
   * DISTINCT FROM `refused` ON PURPOSE. A refusal is the system deciding; a throw is the system
   * failing to decide. Reporting the second as the first would hide an outage inside a word that
   * means the design worked. Nothing was spent — the executor's spend is transactional and an
   * escaping error leaves the permit active.
   */
  | { readonly status: "failed" };

/** What became of a whole scan. */
export type DeliveryScanResult =
  | {
      readonly status: "scanned";
      /** Candidates the runtime reader offered, before the executor saw any of them. */
      readonly considered: number;
      /** Candidates handed to the executor. Equal to `considered`: the scan filters nothing. */
      readonly attempted: number;
      /** Permits actually spent. The only count that implies a production mutation. */
      readonly delivered: number;
      readonly outcomes: readonly ScannedPermitOutcome[];
    }
  /** The candidate register could not be read. Nothing was attempted. */
  | { readonly status: "unavailable"; readonly reason: "persistence-unavailable" };

/**
 * Translate one released executor result into this phase's envelope.
 *
 * PURE, AND DELIBERATELY TOTAL: both branches of `MachineRecordWorkResult` are named, so a future
 * variant added to the executor fails to compile here rather than being silently reported as
 * something it is not.
 *
 * IT DOES NOT INTERPRET. A refusal's words are copied, not judged, not ranked and not collapsed.
 */
export function classifyDeliveryOutcome(result: MachineRecordWorkResult): DeliveryOutcome {
  switch (result.status) {
    case "executed":
      return { status: "delivered", invocationId: result.invocationId };
    case "refused":
      return result.authorityReason === undefined
        ? { status: "refused", reason: result.reason }
        : { status: "refused", reason: result.reason, authorityReason: result.authorityReason };
  }
}
