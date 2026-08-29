/*
 * security-center/awareness.ts — SECURITY LIVE, the compact awareness summary.
 *
 * ── IT SUMMARISES ONE RELEASED OBSERVATION AND NOTHING ELSE ──────────────────
 *
 * A PURE function over E2-2's `SecurityRecordedActObservation`, which the caller already resolved.
 * It performs no read, imports no reader, holds no handle and reaches no ledger — which is also why
 * it can live in this directory at all: the released Security Center firewall scans every file here
 * for a governance-subsystem import, and this one has none for it to find.
 *
 * That guard reads RAW source, so naming the forbidden specifier in this paragraph would trip it.
 * The first draft of this header did exactly that. A repository that is honest in prose keeps
 * finding its own prose-shaped guards, and the fix is always the sentence, never the guard.
 *
 *     SECURITY LIVE != A SECURITY AUTHORITY
 *
 * ── WHAT THE EVIDENCE IS, SAID EXACTLY ───────────────────────────────────────
 *
 * `audit_log` is authoritative for RECORDED GOVERNED ACTS. This is a derived view of it. An act is
 * something an authorized actor did and Hebun wrote down; it is not an intrusion, an alert, or a
 * thing that went wrong. So the summary counts acts and says the word "acts".
 *
 *     AUDIT ACT != SECURITY INCIDENT        AUDIT ACT != RISK
 *     DERIVED OBSERVATION != AUTHORITATIVE SECURITY TRUTH
 *
 * ── THE THREE STATES SURVIVE, BECAUSE THE PANEL IS WHERE THEY WOULD DIE ──────
 *
 * `recorded`, `known-empty` and `unavailable` are three different sentences with three different
 * remedies, and a one-line panel is exactly the surface that would render all three as a number.
 * They are carried through unflattened.
 *
 *     KNOWN EMPTY != UNAVAILABLE        ZERO RECORDED ACTS != SECURE
 *
 * ── AND THE SENTENCES IT MAY NEVER PRODUCE ───────────────────────────────────
 *
 * "All systems secure", "no threats", "risk low", any score and any percentage. None of them is
 * derivable from a count of acts, and the count says nothing about what was not recorded.
 */
import type { SecurityRecordedActObservation } from "./contracts";

export type SecurityAwarenessState =
  | {
      readonly status: "recorded";
      /**
       * The INDEPENDENT total the bounded page was measured against — never `acts.length`, and
       * never `0` for a read that failed. `null` when the reader could not supply one.
       */
      readonly totalRecordedActs: number | null;
      /** True when the bounded page filled its limit, so more exist than the page showed. */
      readonly truncated: boolean;
    }
  | { readonly status: "known-empty" }
  | { readonly status: "unavailable"; readonly reason: string | null };

export interface SecurityAwareness {
  readonly state: SecurityAwarenessState;
  /** THE LITERAL `false`. Marking this observation authoritative is a compile error, not a review note. */
  readonly authoritative: false;
  /** The ledger boundary's own sentence, carried verbatim. This panel owns no provenance. */
  readonly provenance: string;
  /** What may NOT be concluded, carried beside the number rather than left to be assumed. */
  readonly limits: string;
}

/** The sentence shown when no observation reached the panel at all. */
export const SECURITY_AWARENESS_UNREAD =
  "Hebun could not read this organization's recorded governed acts. That is an unread ledger, not " +
  "an organization with nothing recorded.";

/** Summarise a resolved observation. Pure: no read, no clock, no handle, no tenant. */
export function summariseSecurityObservation(
  observation: SecurityRecordedActObservation | null,
): SecurityAwareness {
  if (!observation) {
    return {
      state: { status: "unavailable", reason: null },
      authoritative: false,
      provenance: SECURITY_AWARENESS_UNREAD,
      limits: SECURITY_AWARENESS_UNREAD,
    };
  }

  const state: SecurityAwarenessState =
    observation.state === "recorded"
      ? {
          status: "recorded",
          totalRecordedActs: observation.totalRecordedActs,
          truncated: observation.truncated,
        }
      : observation.state === "known-empty"
        ? { status: "known-empty" }
        : { status: "unavailable", reason: observation.unavailableReason };

  return {
    state,
    /* Carried, never recomputed: the observation already types this as the literal `false`. */
    authoritative: observation.authoritative,
    provenance: observation.provenance,
    limits: observation.limits,
  };
}
