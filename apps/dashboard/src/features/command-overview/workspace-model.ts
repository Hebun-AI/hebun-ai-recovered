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
import type {
  AwaitingDecisionAggregate,
  AwaitingDecisionRead,
} from "@/features/action-authorization/awaiting-decision-aggregate.server";
import type { WorkRegister } from "@/features/organizational-work/read-work.server";
import { elapsedSince, type ElapsedObservation } from "@/features/attention-observation/contracts";

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
  /**
   * E2-4 — elapsed since this proposal was FILED, measured against one shared instant.
   *
   * `null` when no evaluation instant was supplied, when the timestamp is unusable, or when it
   * lies in the future. It is never a duration of zero: an absent observation and "filed just now"
   * are different statements, and only one of them is a claim.
   */
  readonly waitingFor: ElapsedObservation | null;
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
      /**
       * E2-4 — the UNBOUNDED count, from the aggregate that carries no `.limit(`.
       *
       * `null` when that aggregate was not supplied or could not be read. It is deliberately not
       * defaulted to `items.length`: the list above is capped at fifty and ordered newest-first, so
       * substituting it would report a lower bound as the whole count.
       */
      readonly awaitingCount: number | null;
      /**
       * E2-4 — elapsed since the OLDEST pending proposal was filed.
       *
       * It CANNOT be derived from `items`. That list is `orderBy desc(created_at) limit 50`, so the
       * oldest row is the first one it drops — the answer would be right on small tenants, wrong on
       * large ones, and indistinguishable between them. It comes from the unbounded aggregate or it
       * is `null`.
       */
      readonly oldestWaiting: ElapsedObservation | null;
    }
  | { readonly status: "none-waiting" }
  | { readonly status: "unavailable"; readonly reason: string };

/**
 * E2-4's inputs to this projection: one pinned instant and the unbounded aggregate.
 *
 * Optional as a whole, because a caller that has no aggregate must get the released behaviour with
 * every elapsed field `null` — not a fabricated one.
 */
export interface WaitingElapsedInput {
  /** The single instant every duration in this rendering is measured against. */
  readonly evaluatedAt: string;
  readonly aggregate: AwaitingDecisionRead<AwaitingDecisionAggregate>;
}

/**
 * Map the seam's result. Pure, total, and the only place a read becomes a rendering.
 *
 * `none-waiting` exists as its own member rather than as `items: []` so that no consumer can render
 * an empty list and an unanswered read through the same branch by accident.
 */
export function toWaitingOnYou(
  read: ActionAuthorizationRead<PendingActionRequestView>,
  elapsed?: WaitingElapsedInput,
): WaitingOnYouState {
  if (read.status !== "read") {
    return { status: "unavailable", reason: read.reason };
  }
  if (read.items.length === 0) {
    return { status: "none-waiting" };
  }
  const aggregate = elapsed?.aggregate;
  return {
    status: "waiting",
    items: read.items.map((item) => ({
      requestId: item.requestId,
      actionKind: item.actionKind,
      targetLabel: item.targetLabel,
      expectedEffect: item.expectedEffect,
      proposedAt: item.proposedAt,
      waitingFor: elapsed
        ? elapsedSince(item.proposedAt, elapsed.evaluatedAt, "action-request.created_at")
        : null,
    })),
    boundReached: read.items.length >= PENDING_READ_BOUND,
    awaitingCount: aggregate?.status === "read" ? aggregate.value.awaiting : null,
    oldestWaiting:
      elapsed && aggregate?.status === "read"
        ? elapsedSince(
            aggregate.value.oldestFiledAt,
            elapsed.evaluatedAt,
            "action-request.created_at",
          )
        : null,
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

/* ─────────────────────────────────────────────────────────────────────────────
 * SECTION 4 — WORK IN MOTION
 *
 * The fourth question a Director opens Hebun asking, and the first one Command can answer without
 * a new authority: WHAT WORK IS THIS ORGANIZATION CARRYING?
 *
 * The rule that governs the other three governs this one. `readWorkRegister` is WORK-1's own
 * tenant-scoped reader, taken unchanged; the route resolves the tenant once and hands this file the
 * RESULT. There is no Command copy of the register, no second seam, and no cache. `/operations`,
 * `/approvals` and `/director/work` already consume the same reader the same way.
 *
 * ── WHAT THIS MODEL REFUSES TO SAY ───────────────────────────────────────────
 *
 * 1. IT NEVER CALLS A DECLARED STATE AN OBSERVED ONE. The authority's own sentence is that every
 *    state is DECLARED by a human and that Hebun observed nothing, verified nothing, and holds no
 *    record of any outcome. A count of items whose state says `in-progress` is a count of CLAIMS.
 *    That word travels with the number or the number does not render.
 *
 * 2. IT NEVER PRESENTS A BOUNDED READ AS AN ORGANIZATIONAL TOTAL. The seam caps its rows and says
 *    so through `truncated`. When the cap is hit this model reports a LOWER BOUND and says the
 *    organization holds more — the same discipline `toWaitingOnYou` applies to its own cap.
 *
 * 3. IT NEVER HIDES A RETIREMENT. WORK-1 retires in place and returns retired rows with
 *    `inService: false`. Dropping them silently would make a retirement look like a deletion, so
 *    they are counted separately and named.
 *
 * 4. IT NEVER TURNS AN UNREADABLE REGISTER INTO ZERO WORK. `unavailable` and `empty` are different
 *    facts about the organization and may never share a rendering.
 * ────────────────────────────────────────────────────────────────────────── */

/** One recorded work item, reduced to what Command may show without becoming a second inspector. */
export interface WorkInMotionItem {
  readonly workItemId: string;
  readonly title: string;
  /** DECLARED by a human. Never an observation, and never rendered without that word nearby. */
  readonly declaredState: string;
  /** The department this work names, or `null` when it names none. */
  readonly departmentName: string | null;
  readonly recordedAt: string;
}

export type WorkInMotionState =
  /** The register could not be read. This says nothing about whether work exists. */
  | { readonly status: "unavailable"; readonly detail: string }
  /** The register was read and this organization has recorded no work. */
  | { readonly status: "empty"; readonly detail: string }
  | {
      readonly status: "recorded";
      /** Items still in service, most recently recorded first. Never includes retired work. */
      readonly items: readonly WorkInMotionItem[];
      /** How many of the rows READ are in service. A lower bound when `truncated`. */
      readonly inServiceShown: number;
      /** How many of the rows READ are retired. Counted, never hidden. */
      readonly retiredShown: number;
      /** True when the seam hit its cap, so every count above is a lower bound. */
      readonly truncated: boolean;
      /** The authority's own sentence about what these states are and are not. */
      readonly detail: string;
    };

/** How many in-service items Command lists before it stops and routes to Operations. */
export const WORK_IN_MOTION_SHOWN = 4;

/**
 * Map WORK-1's register into what Command may honestly say about it.
 *
 * A pure function over somebody else's answer: no handle, no clock, no tenant, no second read.
 */
export function toWorkInMotion(register: WorkRegister): WorkInMotionState {
  if (register.status === "unavailable") {
    return { status: "unavailable", detail: register.detail };
  }

  const inService = register.items.filter((item) => item.inService);
  const retiredShown = register.items.length - inService.length;

  /*
   * An empty register is only empty when the read was NOT truncated. A truncated read that happens
   * to carry no in-service rows still proves the organization holds work, so it can never be
   * reported as "no work recorded".
   */
  if (register.items.length === 0) {
    return { status: "empty", detail: register.detail };
  }

  return {
    status: "recorded",
    items: inService.slice(0, WORK_IN_MOTION_SHOWN).map((item) => ({
      workItemId: item.workItemId,
      declaredState: item.declaredState,
      title: item.title,
      departmentName: item.department?.name ?? null,
      recordedAt: item.recordedAt,
    })),
    inServiceShown: inService.length,
    retiredShown,
    truncated: register.truncated,
    detail: register.detail,
  };
}
