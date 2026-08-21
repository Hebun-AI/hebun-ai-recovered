/*
 * command-overview/workspace-model.ts — the read model for the canonical Command Overview (CMD-B1).
 *
 * ── WHAT COMMAND IS, AND WHAT THIS MODEL MAY THEREFORE DO ────────────────────
 *
 * Command coordinates authority; it never becomes one. This model reads nothing durable, resolves
 * no tenant, holds no repository and writes nothing. The route resolves the tenant once and hands
 * this file the RESULT of somebody else's tenant-scoped read; everything here is a pure mapping
 * from that result into what a reader may honestly be told.
 *
 * The dependency direction is fixed and one-way:
 *
 *     action-authorization authority
 *       -> its own tenant-scoped read seam            (readPendingActionRequests)
 *         -> Command presentation                     (this file)
 *
 * There is no second seam, no Command copy of the queue, and no cache. `/heby` already consumes the
 * same seam the same way, and its own header records the doctrine: one read, and it is somebody
 * else's.
 *
 * ── THE THREE THINGS THIS MODEL REFUSES TO SAY ───────────────────────────────
 *
 * 1. IT NEVER TURNS AN UNANSWERED READ INTO A NUMBER. The seam is a discriminated union, and so is
 *    what this returns. "Nothing is waiting" and "Hebun could not read your queue" are different
 *    facts and may never share a rendering — the defect the released Command Overview shipped, where
 *    a withheld projection printed "0 AGENTS · 0 WORKFLOWS · 0 critical".
 *
 * 2. IT NEVER PRESENTS A BOUNDED LIST AS AN ORGANIZATIONAL TOTAL. `readPendingActionRequests` caps
 *    at 50. R6B's lesson is that a seam's BOUND is part of its meaning: a count over a capped list
 *    is a lower bound, not a total, so `shown` is the only word this model will use for it, and the
 *    cap is stated when the read comes back full.
 *
 * 3. IT NEVER IMPLIES THE READER MAY ACT. Reading the queue needs a tenant. Approving needs
 *    Governance, resolved server-side at `/approvals` from `decision_records.bootstrap` — and the
 *    repository has already proved a signed-in member can read a queue they are not the authority
 *    for. Command routes to the act; it does not claim it, and it does not check it either.
 */

import { listActionTools, invokableActionTools } from "@/features/heby-actions";
import type {
  ActionAuthorizationRead,
  PendingActionRequestView,
} from "@/features/action-authorization/read-action-authorizations.server";

/**
 * The bound the seam applies when the route does not override it. Stated, not guessed: the caller
 * passes no limit, so this is the number of rows that can come back at most.
 */
export const PENDING_READ_BOUND = 50;

/* ─────────────────────────────────────────────────────────────────────────────
 * SECTION 1 — WAITING ON YOU
 * ────────────────────────────────────────────────────────────────────────── */

/** One pending request, reduced to what Command may show without becoming a second inspector. */
export interface WaitingItemView {
  readonly requestId: string;
  readonly actionKind: string;
  readonly targetLabel: string | null;
  readonly expectedEffect: string;
  readonly proposedAt: string;
}

/**
 * A discriminated state, mirroring the seam. There is deliberately no shape in which `items` and a
 * failure reason coexist, and no shape in which a count exists without a successful read.
 */
export type WaitingOnYouState =
  | {
      readonly status: "waiting";
      readonly items: readonly WaitingItemView[];
      /** True when the read came back full: what is shown may not be everything there is. */
      readonly boundReached: boolean;
    }
  | { readonly status: "none-waiting" }
  | { readonly status: "unavailable"; readonly reason: string };

/**
 * Map the seam's result. Pure, total, and the only place a read becomes a rendering.
 *
 * `none-waiting` exists as its own member rather than as `items: []` so that no consumer can render
 * an empty list and an unanswered read through the same branch by accident.
 */
export function toWaitingOnYou(
  read: ActionAuthorizationRead<PendingActionRequestView>,
): WaitingOnYouState {
  if (read.status !== "read") {
    return { status: "unavailable", reason: read.reason };
  }
  if (read.items.length === 0) {
    return { status: "none-waiting" };
  }
  return {
    status: "waiting",
    items: read.items.map((item) => ({
      requestId: item.requestId,
      actionKind: item.actionKind,
      targetLabel: item.targetLabel,
      expectedEffect: item.expectedEffect,
      proposedAt: item.proposedAt,
    })),
    boundReached: read.items.length >= PENDING_READ_BOUND,
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
 * SECTION 2 — EXPRESS INTENT
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * What the declared action registry says, counted here and asserted nowhere.
 *
 * Every number is DERIVED from `listActionTools()` at read time. R3B had to repair a hard-coded
 * `false` on this same registry when an execution substrate shipped; nothing here is a literal, so
 * the same drift cannot happen twice.
 */
export interface ExpressIntentSummary {
  /** Tools the registry declares. Declaration is not availability. */
  readonly declared: number;
  /** Tools that can actually run now: read-only, with a connected substrate. */
  readonly invokableNow: number;
  /** Mutations whose substrate exists. A substrate is not an arming, and not an authorization. */
  readonly connectedMutations: number;
  /** Whether free text can reach execution. Derived: no tool accepts an untyped argument. */
  readonly freeTextReachesExecution: false;
}

export function getExpressIntentSummary(): ExpressIntentSummary {
  const tools = listActionTools();
  const connectedMutations = tools.filter(
    (tool) =>
      tool.sideEffect !== "READ_ONLY" &&
      tool.sideEffect !== "PREPARATION_ONLY" &&
      tool.substrateConnected,
  );
  return {
    declared: tools.length,
    invokableNow: invokableActionTools().length,
    connectedMutations: connectedMutations.length,
    freeTextReachesExecution: false,
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
 * SECTION 3 — NOT YET CONNECTED
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * One executive capability Command promises and cannot yet answer, with the ACTUAL reason.
 *
 * The reasons are deliberately not interchangeable. "No source exists", "a contract exists but no
 * runtime does" and "the only source is a seed, so it is withheld" are three different situations,
 * and collapsing them into one grey sentence would be the same class of defect as collapsing empty
 * into unavailable.
 */
export interface UnconnectedCapability {
  readonly capability: string;
  readonly reason: string;
}

export const UNCONNECTED_CAPABILITIES: readonly UnconnectedCapability[] = Object.freeze([
  {
    capability: "Attention across all sources",
    reason:
      "No unified attention source exists. Each origin — Operations, Platform, Governance, Intelligence — would need its own tenant-scoped read before anything could aggregate them, and none is built.",
  },
  {
    capability: "Executive briefings",
    reason:
      "The Director Briefing contract exists; the runtime that would produce an instance does not. No briefing has ever been assembled, so there is nothing to summarize.",
  },
  {
    capability: "Operating state",
    reason:
      "No tenant-scoped operating-state seam exists anywhere in the system. The one executive read that does exist is platform-scoped and tenant-blind, so it cannot answer for this organization.",
  },
  {
    capability: "Organization health",
    reason:
      "No domain reports an operating state, and technical runtime health is not organizational health. A composed score over sources that do not exist would be invention, not measurement.",
  },
  {
    capability: "Reports",
    reason:
      "There is no reporting engine, no report definition store, and no export runtime. Nothing could be generated, and no past instance exists to list.",
  },
  {
    capability: "Strategic goals",
    reason:
      "The only goal source in this system is a compiled-in seed, so it is withheld from a real tenant rather than shown as this organization's goals. Hebun does not know what goals this organization holds.",
  },
]);
