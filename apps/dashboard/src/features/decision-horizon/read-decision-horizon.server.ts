/*
 * decision-horizon/read-decision-horizon.server.ts — WHAT ACTUALLY NEEDS A HUMAN DECISION ACROSS
 * HEBUN, gathered from every authority that owns one (DH-1).
 *
 * ── IT COMPOSES RELEASED READERS AND CONSTRUCTS NO QUERY ─────────────────────
 *
 * The precedent is `attention-observation`, which states it exactly: "deliberately NOT a central
 * module that acquires those subsystems' semantics". This module holds no database handle, opens no
 * connection, runs no query, names no table and imports no writer of any kind. It calls three
 * released READ SEAMS and arranges what they return.
 *
 *   readPendingActionRequests        Action Authorization           its own pending queue
 *   readImprovementHypotheses        Agent Improvement Hypothesis   filtered to `undecided`
 *   readCurrentKnowledgeVersions     Knowledge                      current versions
 *     MINUS readDecidedKnowledgeVersions   Governance Decision      subjects already decided
 *
 * ── THE SUBTRACTION NEEDS BOTH SIDES, AND FAILS CLOSED ───────────────────────
 *
 * E2-4 established this and the reason is unchanged: Knowledge cannot see that a version was
 * REJECTED — K4 writes nothing to Knowledge for a rejection — and Governance does not know which
 * versions currently exist. So if EITHER side is unavailable the whole block is unavailable and
 * names which one, because a readable version list with an unreadable decision set would make every
 * current version look undecided. That is not caution; the alternative is a specific falsehood.
 *
 * ── FOUR AVAILABILITIES, NEVER MERGED, AND ONE COMPLETENESS VERDICT ──────────
 *
 * Each block carries its own status. Above them sits ONE derived verdict, and it is the only thing
 * this module asserts about the union:
 *
 *     complete   every source answered            -> "nothing is waiting" may be said, if all empty
 *     partial    at least one could not answer    -> "nothing is waiting" may NEVER be said
 *
 * ── NO CLOCK, NO ORDER OF IMPORTANCE ─────────────────────────────────────────
 *
 * No elapsed time is computed here: `attention-observation` owns duration truth, and a second
 * module measuring the same interval against its own clock is how two surfaces come to disagree.
 * Items keep their source's own order; nothing is ranked, scored or interleaved, because ordering
 * three different kinds of decision against each other would be a judgement no authority owns.
 *
 * Server-only.
 */
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  readImprovementHypotheses,
  type ImprovementHypothesisRead,
} from "@/features/agent-improvement-hypothesis/read-improvement-hypotheses.server";
import {
  readCurrentKnowledgeVersions,
  type CurrentVersionsRead,
} from "@/features/knowledge/current-versions-read.server";
/*
 * ORDER MATTERS HERE, AND THE REASON IS RECORDED RATHER THAN LEFT AS A COINCIDENCE.
 *
 * `read-action-authorizations.server` participates in a pre-existing circular import through the
 * schema barrel: loaded as the FIRST module of a process it throws "Cannot access 'tenantColumns'
 * before initialization", which is why every released test that uses it imports `db/client.server`
 * first. This module reaches it AFTER the Knowledge read above, which loads the barrel cleanly, so
 * the horizon can be imported on its own by a pure test with no database handle anywhere.
 *
 * It is a load-order accommodation of somebody else's cycle, not a fix for it — DH-1 does not own
 * that module and does not touch it.
 */
import {
  readPendingActionRequests,
  type ActionAuthorizationRead,
  type PendingActionRequestView,
} from "@/features/action-authorization/read-action-authorizations.server";
import {
  readDecidedKnowledgeVersions,
  type DecidedKnowledgeVersionsRead,
} from "@/features/governance-decision/knowledge-decision-read.server";
import {
  DECISION_SOURCE_KEYS,
  DECISION_SOURCE_OWNERS,
  MAX_HORIZON_ITEMS_PER_SOURCE,
  type DecisionSourceKey,
} from "./contracts";

/**
 * ONE thing awaiting a decision, as the horizon carries it.
 *
 * IDENTIFIERS AND STORED PROPERTIES ONLY. No human name, no payload, no digest, no parameter — a
 * horizon is read aloud and rendered in a list, and none of those help anybody decide anything.
 */
export interface HorizonItem {
  readonly source: DecisionSourceKey;
  /** The owning authority's own identifier for the thing. Never minted here. */
  readonly recordId: string;
  /** A short, factual label drawn from stored properties. Never a judgement, never a summary. */
  readonly label: string;
  /** When the owning authority recorded it, verbatim. NOT an elapsed time, NOT a deadline. */
  readonly recordedAt: string | null;
}

export type HorizonBlock =
  | {
      readonly source: DecisionSourceKey;
      readonly status: "answered";
      readonly items: readonly HorizonItem[];
      /** How many the source holds. May exceed `items.length` — see `truncated`. */
      readonly total: number;
      readonly truncated: boolean;
    }
  | {
      readonly source: DecisionSourceKey;
      readonly status: "unavailable";
      /** Which authority could not answer, and why, in its own words. Never re-interpreted. */
      readonly reason: string;
    };

export type DecisionHorizon =
  | { readonly status: "unavailable"; readonly reason: "no-authorized-tenant-context" }
  | {
      readonly status: "read";
      readonly blocks: readonly HorizonBlock[];
      /** DERIVED. `complete` only when every source answered. */
      readonly completeness: "complete" | "partial";
      /** The sources that could not answer, named. Empty when complete. */
      readonly unavailableSources: readonly DecisionSourceKey[];
      /** The total across ANSWERED sources only. Never presented as a total across all. */
      readonly answeredTotal: number;
    };

export interface DecisionHorizonOptions {
  /**
   * Which sources to ask. Defaults to ALL of them, which is what a surface wants.
   *
   * IT EXISTS FOR EXACTLY ONE CALLER. The Heby projection already obtains the action-request half
   * from the released queue projection — which carries far richer per-item detail than a horizon
   * row does — so asking for it twice would read the same table twice and then discard the better
   * answer. Narrowing is therefore explicit, and the COMPLETENESS VERDICT IS COMPUTED OVER THE
   * SOURCES ASKED: a reading that skipped a source can never call itself complete about it, and the
   * caller that narrowed is the one that must account for the rest.
   */
  readonly sources?: readonly DecisionSourceKey[];
}

export interface DecisionHorizonDeps {
  readonly readActionRequests?: typeof readPendingActionRequests;
  readonly readHypotheses?: typeof readImprovementHypotheses;
  readonly readKnowledgeVersions?: typeof readCurrentKnowledgeVersions;
  readonly readDecidedKnowledge?: typeof readDecidedKnowledgeVersions;
}

function bounded<T>(items: readonly T[]): { readonly kept: readonly T[]; readonly truncated: boolean } {
  return items.length > MAX_HORIZON_ITEMS_PER_SOURCE
    ? { kept: items.slice(0, MAX_HORIZON_ITEMS_PER_SOURCE), truncated: true }
    : { kept: items, truncated: false };
}

/** The action-request block. The one source that already had a surface and a grounding class. */
function actionBlock(read: ActionAuthorizationRead<PendingActionRequestView>): HorizonBlock {
  if (read.status !== "read") {
    return { source: "action-requests", status: "unavailable", reason: read.reason };
  }
  const pending = read.items;
  const { kept, truncated } = bounded(pending);
  return {
    source: "action-requests",
    status: "answered",
    total: pending.length,
    truncated,
    items: kept.map((request) => ({
      source: "action-requests" as const,
      recordId: request.requestId,
      /*
       * THE STORED ACTION KIND, and nothing derived from it. `reversibility` and `sideEffect` are
       * stored properties of the frozen proposal — facts about the act, never judgements about
       * whether to take it, which is the distinction the released queue projection already draws.
       */
      label: `${request.actionKind} — ${request.reversibility}, ${request.sideEffect}`,
      recordedAt: request.proposedAt,
    })),
  };
}

/** The hypothesis block. UNDECIDED IS A THIRD STATE — never "declined", never "no decision needed". */
function hypothesisBlock(read: ImprovementHypothesisRead): HorizonBlock {
  if (read.status !== "read") {
    return { source: "improvement-hypotheses", status: "unavailable", reason: read.reason };
  }
  const undecided = read.hypotheses.filter((h) => h.decision.status === "undecided");
  const { kept, truncated } = bounded(undecided);
  return {
    source: "improvement-hypotheses",
    status: "answered",
    total: undecided.length,
    /*
     * TRUNCATION IS EITHER BOUND. The released reader caps at fifty and drops the OLDEST rows, so a
     * truncated read means undecided hypotheses may exist that this block never saw — and that must
     * travel, not be silently absorbed into this module's own smaller ceiling.
     */
    truncated: truncated || read.truncated,
    items: kept.map((hypothesis) => ({
      source: "improvement-hypotheses" as const,
      recordId: hypothesis.hypothesisId,
      label: `${hypothesis.agentName} — ${hypothesis.improvementTarget}`,
      recordedAt: hypothesis.filedAt,
    })),
  };
}

/** The Knowledge block. A SUBTRACTION, and unavailable unless BOTH sides answered. */
function knowledgeBlock(
  versions: CurrentVersionsRead,
  decided: DecidedKnowledgeVersionsRead,
): HorizonBlock {
  if (versions.status !== "read") {
    return { source: "knowledge-review", status: "unavailable", reason: `knowledge:${versions.reason}` };
  }
  if (decided.status !== "read") {
    return {
      source: "knowledge-review",
      status: "unavailable",
      reason: `governance-decision:${decided.reason}`,
    };
  }
  const awaiting = versions.versions.filter((version) => !decided.decidedNodeIds.has(version.nodeId));
  const { kept, truncated } = bounded(awaiting);
  return {
    source: "knowledge-review",
    status: "answered",
    total: awaiting.length,
    truncated,
    items: kept.map((version) => ({
      source: "knowledge-review" as const,
      recordId: version.nodeId,
      /*
       * NO TITLE, NO STATEMENT TEXT. The version id is what a Governance decision names, and the
       * content belongs to the Knowledge workspace where the decision is actually taken. A horizon
       * that quoted the statement would put ratifiable organizational text into a list nobody can
       * ratify from.
       */
      label: "Current Knowledge version with no recorded Governance decision",
      recordedAt: version.authoredAt,
    })),
  };
}

/**
 * Read this organization's decision horizon.
 *
 * Tenant-scoped by each released reader's own predicate. This module passes the server-resolved
 * context straight through and has no tenant parameter of its own to point elsewhere, so a
 * cross-organization read is not refused here — it is UNREPRESENTABLE.
 *
 * EVERY SOURCE IS ASKED, ALWAYS. One failing does not short-circuit the others: a Director whose
 * Knowledge read is down must still see the actions waiting for them, and must be told that the
 * Knowledge half is missing rather than shown a shorter list with no explanation.
 */
export async function readDecisionHorizon(
  tenant: TenantContext | null,
  deps: DecisionHorizonDeps = {},
  options: DecisionHorizonOptions = {},
): Promise<DecisionHorizon> {
  if (typeof window !== "undefined") {
    throw new Error("Decision horizon reads are server-only.");
  }
  if (!tenant?.tenantId) return { status: "unavailable", reason: "no-authorized-tenant-context" };

  const readActions = deps.readActionRequests ?? readPendingActionRequests;
  const readHypotheses = deps.readHypotheses ?? readImprovementHypotheses;
  const readVersions = deps.readKnowledgeVersions ?? readCurrentKnowledgeVersions;
  const readDecided = deps.readDecidedKnowledge ?? readDecidedKnowledgeVersions;

  /*
   * EACH READER'S THROW IS ITS OWN BLOCK'S UNAVAILABILITY, never the horizon's. The released action
   * reader returns a list rather than a status, so a throw is the only way it can fail — and it must
   * fail as ONE unavailable block, not as a horizon that could not be read at all.
   */
  const wanted = new Set(options.sources ?? DECISION_SOURCE_KEYS);
  const skipped = <T,>(value: T) => Promise.resolve(value);

  const [actions, hypotheses, versions, decided] = await Promise.all([
    !wanted.has("action-requests")
      ? skipped<ActionAuthorizationRead<PendingActionRequestView>>({ status: "read", items: [] })
      : readActions(tenant).catch(
          (): ActionAuthorizationRead<PendingActionRequestView> => ({
            status: "unavailable",
            reason: "read-failed",
          }),
        ),
    !wanted.has("improvement-hypotheses")
      ? skipped<ImprovementHypothesisRead>({ status: "read", hypotheses: [], truncated: false, limit: 0 })
      : readHypotheses(tenant).catch(
          (): ImprovementHypothesisRead => ({ status: "unavailable", reason: "read-failed" }),
        ),
    !wanted.has("knowledge-review")
      ? skipped<CurrentVersionsRead>({ status: "read", versions: [] })
      : readVersions(tenant).catch(
          (): CurrentVersionsRead => ({ status: "unavailable", reason: "read-failed" }),
        ),
    !wanted.has("knowledge-review")
      ? skipped<DecidedKnowledgeVersionsRead>({ status: "read", decidedNodeIds: new Set<string>() })
      : readDecided(tenant).catch(
          (): DecidedKnowledgeVersionsRead => ({ status: "unavailable", reason: "read-failed" }),
        ),
  ]);

  const asked = new Set(options.sources ?? DECISION_SOURCE_KEYS);
  const blocks: readonly HorizonBlock[] = [
    actionBlock(actions),
    hypothesisBlock(hypotheses),
    knowledgeBlock(versions, decided),
  ].filter((block) => asked.has(block.source));

  const unavailableSources = blocks
    .filter((block): block is Extract<HorizonBlock, { status: "unavailable" }> => block.status === "unavailable")
    .map((block) => block.source);

  return {
    status: "read",
    blocks,
    /*
     * THE ONE DERIVED ASSERTION. `complete` is not "we got some answers" — it is every source in
     * the closed vocabulary having answered. A source added to that vocabulary without a reader
     * makes every horizon partial, which is the correct and loud failure.
     */
    completeness: unavailableSources.length === 0 ? "complete" : "partial",
    unavailableSources,
    answeredTotal: blocks.reduce(
      (sum, block) => (block.status === "answered" ? sum + block.total : sum),
      0,
    ),
  };
}

/** Every source is accounted for in every reading — silence about one would read as "nothing there". */
export function horizonCoversEverySource(horizon: DecisionHorizon): boolean {
  if (horizon.status !== "read") return false;
  const seen = new Set(horizon.blocks.map((block) => block.source));
  return DECISION_SOURCE_KEYS.every((key) => seen.has(key)) && seen.size === DECISION_SOURCE_KEYS.length;
}

/** Where the decision named by an item is actually taken. Composed from the released owner map. */
export function decisionRouteFor(source: DecisionSourceKey): string {
  return DECISION_SOURCE_OWNERS[source].route;
}
