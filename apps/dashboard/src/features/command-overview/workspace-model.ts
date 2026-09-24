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
/*
 * CMD-V2 — three more type-only imports, and not one of them is a reader.
 *
 * `ConnectionListing` is the integration authority's READ-ONLY seam shape (INT-5A split the reads
 * out of the module that can create, disconnect and attach credentials, precisely so a consumer
 * like this one holds no reference to a writer). `LiveMapAwareness` and `SecurityAwareness` are the
 * two released summaries the landing already composed. Every one of them arrives here as somebody
 * else's ANSWER; this file still reads nothing, resolves no tenant and holds no handle.
 */
import type {
  ConnectionListing,
  ConnectionState,
  IntegrationView,
} from "@/features/integration-authority/contracts";
import type { LiveMapAwareness } from "@/features/live-map/awareness";
import type { SecurityAwareness } from "@/features/security-center/awareness";
import type { Provenance } from "@/components/ui/provenance-chip";

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

/**
 * The small subset of capability limits that earns a permanent place in Command's operating
 * horizon. These are product architecture declarations, not tenant records: each has a future
 * owner, each is strategically useful to a Director, and none is allowed to carry a count,
 * progress value, current activity, generated artifact, or implied connection.
 */
export interface FutureOperatingSurface {
  readonly id: "goals" | "heby-runtime" | "briefings";
  readonly label: string;
  readonly owner: string;
  readonly state: "not-connected";
  readonly statement: string;
}

export const FUTURE_OPERATING_SURFACES: readonly FutureOperatingSurface[] = Object.freeze([
  Object.freeze({
    id: "goals" as const,
    label: "Goals",
    owner: "Future goal authority",
    state: "not-connected" as const,
    statement: "Authoritative goal records will appear here when a goals source is connected.",
  }),
  Object.freeze({
    id: "heby-runtime" as const,
    label: "Heby Runtime",
    owner: "Future runtime telemetry",
    state: "not-connected" as const,
    statement: "Live Heby execution state will appear here when runtime telemetry is available.",
  }),
  Object.freeze({
    id: "briefings" as const,
    label: "Briefings",
    owner: "Director Briefing Runtime",
    state: "not-connected" as const,
    statement: "Generated organizational briefings will appear here when the briefing runtime is connected.",
  }),
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

/* ─────────────────────────────────────────────────────────────────────────────
 * CMD-V2 · SECTION 5 — THE DECLARED COMPOSITION
 *
 * ── WHAT REPLACED THE EXACT-THREE-SECTION PIN, AND WHY IT IS STRICTER ────────
 *
 * CMD-B1 released a composition contract that said: the Command Overview renders EXACTLY THREE
 * `<section>` elements, in one order, with exactly three provenance chips. Five suites asserted it.
 * It did its job for five phases and it was retired deliberately by Director decision, not broken:
 * the landing grew an awareness band (LMX-1) and a work register (CMD-W) as SIBLINGS on the route
 * precisely because the count could not admit them, so by the time V2 began the page a Director
 * actually met was already five regions rendered by three files under a contract that described
 * one of them.
 *
 * A COUNT IS A WEAK CONTRACT. It cannot tell a region that belongs here from one that does not, and
 * it tolerates any swap that keeps the total — the same weakness AGENT-ID-0.1 recorded when it
 * replaced a count of nine server-action modules with a NAMED SET.
 *
 * So the count becomes a REGISTRY. Every region the Command Center renders is declared here, in
 * reading order, with the KIND OF CLAIM it makes and the lane it occupies. The rendered page is
 * asserted against this list, which admits strictly less than the old pin did:
 *
 *   - an UNDECLARED region fails (the old pin only failed a region that changed the total);
 *   - a declared region that does not render fails;
 *   - a region rendering in the wrong order fails;
 *   - a region whose chip states a different KIND of claim than it declares fails;
 *   - a region declaring a provenance and rendering no chip fails;
 *   - a region declaring NO provenance and rendering a chip fails.
 *
 * ── THE THREE SEMANTIC ROLES SURVIVED, IDS AND ALL ───────────────────────────
 *
 * `waiting`, `intent` and `not-connected` keep their ids, their labels, their questions and their
 * provenance kinds. Contracts elsewhere depend on those ids (CMD-B2 asserts all three still
 * render), deep links use them, and nothing about what they may CLAIM changed. What changed is
 * everything around them.
 *
 * ── WHY THE HERO DECLARES NO PROVENANCE ──────────────────────────────────────
 *
 * Because it makes no claim that needs one. The band prints the organization's name — which comes
 * from the Organization Authority through the released Live Map projection and says so in words
 * beside it — and a decorative, non-representational plate that depicts nothing. A provenance chip
 * on a decorative surface would assert that the surface is evidence of something. It is not, and
 * this repository has no tenant configuration authority that could make it so.
 *
 *     A DECORATIVE SURFACE IS NOT A CLAIM        AN IDENTITY IS NOT A MEASUREMENT
 * ────────────────────────────────────────────────────────────────────────── */

/** Where a region sits in the executive composition. Geometry, never truth. */
export type CommandLane = "context" | "signals" | "priority" | "support" | "limits";

export interface CommandRegionDeclaration {
  readonly id: string;
  readonly label: string;
  /**
   * The kind of claim this region's content is, or `null` when the region asserts nothing that a
   * provenance chip could qualify. `null` is a declaration, not an omission — a region that renders
   * a chip while declaring `null` fails the composition contract.
   */
  readonly provenance: Provenance | null;
  readonly lane: CommandLane;
}

/**
 * THE COMMAND CENTER, DECLARED. Reading order is list order, at every width.
 *
 * Adding a region to the page means adding it here first, which is the point: a new region cannot
 * arrive without stating what kind of claim it makes.
 */
export const COMMAND_REGIONS: readonly CommandRegionDeclaration[] = Object.freeze([
  Object.freeze({ id: "executive-context", label: "Organization context", provenance: null, lane: "context" as const }),
  Object.freeze({ id: "intent", label: "Ask Hebun", provenance: "configuration" as const, lane: "context" as const }),
  Object.freeze({ id: "people-heby", label: "People + Heby", provenance: "configuration" as const, lane: "priority" as const }),
  Object.freeze({ id: "waiting", label: "Needs your decision", provenance: "authoritative" as const, lane: "priority" as const }),
  Object.freeze({ id: "work-in-motion", label: "Work in motion", provenance: "authoritative" as const, lane: "priority" as const }),
  Object.freeze({ id: "live-map", label: "Live Map", provenance: "authoritative" as const, lane: "support" as const }),
  Object.freeze({ id: "connected-systems", label: "Connected systems", provenance: "authoritative" as const, lane: "support" as const }),
  Object.freeze({ id: "recorded-activity", label: "Governed activity", provenance: "derived" as const, lane: "support" as const }),
  Object.freeze({ id: "not-connected", label: "Capability Limits", provenance: "not-connected" as const, lane: "limits" as const }),
]);

/** Every declared id, in reading order. The exact sequence the rendered page must produce. */
export const COMMAND_REGION_IDS: readonly string[] = Object.freeze(
  COMMAND_REGIONS.map((region) => region.id),
);

/** The provenance kinds, in reading order, skipping regions that declare none. */
export const COMMAND_REGION_PROVENANCE: readonly Provenance[] = Object.freeze(
  COMMAND_REGIONS.flatMap((region) => (region.provenance ? [region.provenance] : [])),
);

/* ─────────────────────────────────────────────────────────────────────────────
 * CMD-V2 · SECTION 6 — THE EXECUTIVE HERO
 *
 * The hero prints ONE fact and one absence.
 *
 * THE FACT is the organization's name, taken from the released Live Map projection, which composes
 * it from the Organization Authority. The route already issues that read; the hero adds none.
 *
 * THE ABSENCE is the tenant-managed dashboard message. There is no configuration, profile or
 * branding authority anywhere in this repository — no table, no column, no writer, and the
 * Infrastructure & Settings surface says as much in its own released words ("no durable
 * configuration store"). So the hero does not print a motto, a quote, a tagline or a mission. It
 * says, once and quietly, that no tenant message is configured and that nothing can configure one
 * yet. There is no "Configure" affordance, because there is nothing behind it.
 *
 *     ABSENT != EMPTY        UNCONFIGURABLE != UNCONFIGURED        DECORATION != EVIDENCE
 * ────────────────────────────────────────────────────────────────────────── */

export type CommandStanding =
  | { readonly status: "named"; readonly organizationName: string }
  | { readonly status: "unavailable"; readonly detail: string };

/*
 * THE MESSAGE SLOT HAS NO CONSTANT, DELIBERATELY.
 *
 * V2.0 exported two sentences for the hero to print: one saying no organization message was
 * configured, one saying the visual field was decorative. Both were true and both were architecture
 * notes in the product's most valuable space, which is what the Director rejected.
 *
 * An absent message is now simply NOT RENDERED. That is not a weaker claim — nothing is asserted
 * about a message that does not exist, and nothing invents one. The refusals are unchanged: no
 * quote, no motto, no photograph, no "Configure" affordance with no writer behind it.
 */

/** Pure: reads the summary the route already resolved, and asserts nothing beyond it. */
export function toCommandStanding(organization: LiveMapAwareness): CommandStanding {
  return organization.organization.status === "named"
    ? { status: "named", organizationName: organization.organization.name }
    : { status: "unavailable", detail: organization.organization.detail };
}

/* ─────────────────────────────────────────────────────────────────────────────
 * CMD-V2 · SECTION 7 — THE EXECUTIVE SUMMARY
 *
 * ── WHAT THE DIRECTOR REJECTED, AND WHAT REPLACED IT ─────────────────────────
 *
 * V2.0 composed a five-cell "operating ledger" in which every cell printed the AUTHORITY'S NAME and
 * a sentence of doctrine — "Action authorization authority · The queue answered with no pending
 * consequential action" — under a figure. Technically exact, and an audit table in the first
 * viewport of an executive product.
 *
 * V2.1 keeps every truth rule and cuts the volume:
 *
 *   - FOUR cards, not five. The fifth measurement (durable agents) was not dropped; it moved to the
 *     organization region, where it is the thing that region is about. Five cells existed because
 *     five measurements existed, which is not a reason.
 *   - each card carries a LABEL, a VALUE, and ONE short line of human context — never the authority's
 *     module name, never an explanation of what Hebun does not infer.
 *   - the authority is still named, once, as the region's quiet source note.
 *
 * ── THE THREE READINGS SURVIVE UNTOUCHED ─────────────────────────────────────
 *
 * `measured`  the authority answered with a figure.
 * `none`      the authority answered, and the answer is nothing. A MEASURED zero.
 * `unread`    the authority did not answer. NOT zero, not none, and never rendered as a figure.
 *
 * A compact card is exactly where those three get collapsed into one number, and collapsing them is
 * the defect the Phase 6B Command Center shipped — "0 critical · 0 warning · 0 AGENTS · 0 WORKFLOWS"
 * printed over a projection that was withheld. An `unread` card still prints a WORD.
 *
 *     UNREAD != ZERO        BOUNDED != TOTAL        A COUNT OF RECORDS != A STATE OF AFFAIRS
 * ────────────────────────────────────────────────────────────────────────── */

export type LedgerReading = "measured" | "none" | "unread";

export interface SummaryCard {
  readonly key: string;
  /** What is being counted, in two or three words. */
  readonly label: string;
  readonly reading: LedgerReading;
  /** What the card prints. A word when `unread` or `none`; a figure only when `measured`. */
  readonly value: string;
  /** ONE short human line. Never the authority's module name, never doctrine. */
  readonly context: string;
  /** Where the full record lives, when the product has a surface for it. */
  readonly href?: string;
}

export interface CommandSummaryInput {
  readonly waiting: WaitingOnYouState;
  readonly work: WorkInMotionState;
  readonly capability: ConnectedCapabilityState;
  readonly security: SecurityAwareness;
}

/** Pure composition over four resolved answers. No read, no clock, no tenant, no handle. */
export function toExecutiveSummary(input: CommandSummaryInput): readonly SummaryCard[] {
  const { waiting, work, capability, security } = input;

  /*
   * THE AWAITING FIGURE COMES FROM THE UNBOUNDED AGGREGATE, NEVER FROM THE BOUNDED LIST. The queue
   * reader caps at 50 and is newest-first, so counting its rows would report a lower bound as a
   * total. When the aggregate did not answer, the card shows what it read and says "shown".
   */
  const attention: SummaryCard =
    waiting.status === "unavailable"
      ? {
          key: "attention",
          label: "Needs attention",
          reading: "unread",
          value: "Unavailable",
          context: "Hebun could not read your decision queue.",
          href: "/approvals",
        }
      : waiting.status === "none-waiting"
        ? {
            key: "attention",
            label: "Needs attention",
            reading: "none",
            value: "0",
            context: "You are all caught up.",
            href: "/approvals",
          }
        : {
            key: "attention",
            label: "Needs attention",
            reading: "measured",
            value:
              waiting.awaitingCount !== null
                ? String(waiting.awaitingCount)
                : `${waiting.items.length}${waiting.boundReached ? "+" : ""}`,
            context:
              waiting.awaitingCount !== null
                ? "Decisions are waiting on you."
                : `Shown from the most recent ${PENDING_READ_BOUND}.`,
            href: "/approvals",
          };

  const workCard: SummaryCard =
    work.status === "unavailable"
      ? {
          key: "work",
          label: "Active work",
          reading: "unread",
          value: "Unavailable",
          context: "Hebun could not read your work register.",
          href: "/operations",
        }
      : work.status === "empty"
        ? {
            key: "work",
            label: "Active work",
            reading: "none",
            value: "0",
            context: "No work has been recorded yet.",
            href: "/operations",
          }
        : {
            key: "work",
            label: "Active work",
            reading: "measured",
            value: `${work.inServiceShown}${work.truncated ? "+" : ""}`,
            /* DECLARED, still — the word travels with the number, in three words instead of three lines. */
            context: "In service, as your team declared it.",
            href: "/operations",
          };

  const connected: SummaryCard =
    capability.status === "unavailable"
      ? {
          key: "connected",
          label: "Connections",
          reading: "unread",
          value: "Unavailable",
          context: "Hebun could not read your connections.",
          href: "/integrations",
        }
      : capability.status === "none-recorded"
        ? {
            key: "connected",
            label: "Connections",
            reading: "none",
            value: "0",
            context: "No system is connected yet.",
            href: "/integrations",
          }
        : capability.connected.length === 0
          ? {
              key: "connected",
              label: "Connections",
              reading: "none",
              value: "0",
              context: `${capability.recordedTotal} recorded, none currently connected.`,
              href: "/integrations",
            }
          : {
              key: "connected",
              label: "Connections",
              reading: "measured",
              value: String(capability.connected.length),
              context: capability.connected.length === 1 ? "System connected." : "Systems connected.",
              href: "/integrations",
            };

  const acts: SummaryCard =
    security.state.status === "unavailable"
      ? {
          key: "activity",
          label: "Activity",
          reading: "unread",
          value: "Unavailable",
          context: "Hebun could not read the activity ledger.",
          href: "/director/governance/security",
        }
      : security.state.status === "known-empty"
        ? {
            key: "activity",
            label: "Activity",
            reading: "none",
            value: "0",
            context: "No governed act has been recorded.",
            href: "/director/governance/security",
          }
        : security.state.totalRecordedActs === null
          ? {
              key: "activity",
              label: "Activity",
              reading: "measured",
              value: "Recorded",
              context: "Governed acts exist; no total was available.",
              href: "/director/governance/security",
            }
          : {
              key: "activity",
              label: "Activity",
              reading: "measured",
              value: String(security.state.totalRecordedActs),
              context: "Governed acts recorded.",
              href: "/director/governance/security",
            };

  return Object.freeze([attention, workCard, connected, acts]);
}

/* ─────────────────────────────────────────────────────────────────────────────
 * CMD-V2 · SECTION 8 — CONNECTED CAPABILITY
 *
 * ── THE ONE SOURCE THIS REGION IS ALLOWED TO HAVE ────────────────────────────
 *
 * `listConnections` — the integration authority's own tenant-scoped, writer-free read seam. Nothing
 * else. Not the provider catalog, not a credential row, not a descriptor, not a capability
 * registry: a catalog entry proves a provider EXISTS IN THE PRODUCT, and a credential proves bytes
 * were stored. Neither proves this organization connected anything, and a surface that draws a
 * provider tile from a catalog is stating a connection the database never recorded.
 *
 *     CATALOG != CONNECTION      CREDENTIAL != CONNECTED      CONNECTED != CAPABILITY AVAILABLE
 *     CAPABILITY AVAILABLE != AUTHORIZED     AUTHORIZED != EXECUTED     EXECUTED != SUCCESSFUL
 *
 * ── WHY A ROW THAT IS NOT `connected` IS COUNTED AND NOT HIDDEN ──────────────
 *
 * The lifecycle has six states and two of them are terminal. A `revoked` or `expired` row is a real
 * fact about this organization — it held a grant and no longer does — and dropping it would make a
 * revocation look like something that never happened, the same defect WORK-1 refuses for retired
 * work. So non-connected rows are counted BY STATE, named by their own state word, and never drawn
 * as connected.
 *
 * ── THE BOUND IS PART OF THE MEANING ─────────────────────────────────────────
 *
 * The seam caps at `CONNECTION_LIMITS.listLimit`. This model reports what it READ and says so.
 * ────────────────────────────────────────────────────────────────────────── */

/** One connection this organization actually holds, reduced to what Command may show. */
export interface ConnectedProviderView {
  readonly integrationId: string;
  readonly name: string;
  /** The provider this row names, or `null` when the row names none. Never a catalog lookup. */
  readonly providerKey: string | null;
  /** The provider-side account label the authority stored, or `null`. Never derived. */
  readonly accountLabel: string | null;
  /** The last OBSERVED health of an attempt. `unknown` means no attempt was observed. */
  readonly health: string;
  readonly lastVerifiedAt: string | null;
}

/** Connections this organization holds that are not in the connected state, counted by state. */
export interface RecordedConnectionState {
  readonly state: ConnectionState;
  readonly count: number;
}

export type ConnectedCapabilityState =
  /** The register did not answer. This says nothing about whether connections exist. */
  | { readonly status: "unavailable"; readonly reason: string }
  /** The register answered, and this organization holds no connection row at all. */
  | { readonly status: "none-recorded" }
  | {
      readonly status: "recorded";
      /** Rows in the `connected` state, oldest first, as the seam returned them. */
      readonly connected: readonly ConnectedProviderView[];
      /** Every other row, counted by its own state word. Never hidden, never drawn as connected. */
      readonly notConnected: readonly RecordedConnectionState[];
      /** How many rows were READ. A lower bound when `truncated`. */
      readonly recordedTotal: number;
      /** True when the read came back at the seam's cap, so every figure here is a lower bound. */
      readonly truncated: boolean;
    };

/**
 * The name a Director should read for a connection.
 *
 * THE AUTHORITY'S OWN `name` COLUMN, AND NOTHING COMPUTED. It is what a human wrote when the
 * connection was made. The provider KEY (`google-workspace`) is a technical identifier and stays off
 * the executive surface — it is not a lie, it is just not language. When the row carries no name the
 * account label is used, and when it carries neither the honest word is the generic one: inventing a
 * vendor's brand name from a key would be this surface deciding what the connection is.
 */
export function providerDisplayName(row: ConnectedProviderView): string {
  const named = row.name.trim();
  if (named.length > 0) return named;
  const account = row.accountLabel?.trim();
  if (account && account.length > 0) return account;
  return "Connection";
}

/** How many connected rows Command lists before it stops and routes to Integrations. */
export const CONNECTED_PROVIDERS_SHOWN = 4;

/** The seam's own cap, restated so the model can say when a read came back full. */
export const CONNECTION_READ_BOUND = 200;

/** Pure mapping over the integration authority's answer. No read, no tenant, no handle. */
export function toConnectedCapability(listing: ConnectionListing): ConnectedCapabilityState {
  if (listing.status === "unavailable") {
    return { status: "unavailable", reason: listing.reason };
  }

  const rows: readonly IntegrationView[] = listing.connections;
  if (rows.length === 0) return { status: "none-recorded" };

  const connected = rows
    .filter((row) => row.connectionState === "connected")
    .map((row) => ({
      integrationId: row.integrationId,
      name: row.name,
      providerKey: row.providerKey,
      accountLabel: row.externalAccountLabel,
      health: row.health,
      lastVerifiedAt: row.lastVerifiedAt,
    }));

  /* Counted by state, in the lifecycle's own vocabulary. No state is renamed and none is merged. */
  const byState = new Map<ConnectionState, number>();
  for (const row of rows) {
    if (row.connectionState === "connected") continue;
    byState.set(row.connectionState, (byState.get(row.connectionState) ?? 0) + 1);
  }

  return {
    status: "recorded",
    connected: Object.freeze(connected),
    notConnected: Object.freeze(
      [...byState.entries()]
        .map(([state, count]) => ({ state, count }))
        .sort((a, b) => a.state.localeCompare(b.state)),
    ),
    recordedTotal: rows.length,
    truncated: rows.length >= CONNECTION_READ_BOUND,
  };
}
