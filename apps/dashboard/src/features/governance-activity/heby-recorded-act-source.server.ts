/*
 * governance-activity/heby-recorded-act-source.server.ts — THE RECORDED ACT AUTHORITY'S read
 * projection of itself, shaped for Heby grounding (E2-6).
 *
 * ── WHAT HEBY COULD ALREADY SAY, AND WHAT IT COULD NOT ───────────────────────
 *
 * E2-4 gave Heby one number and one instant about this ledger: "18 recorded acts, most recent 21h
 * ago". That is elapsed time over a count, and it is all Heby had. It could not say what a single
 * one of those acts WAS — not that a knowledge fact was created, not that an integration credential
 * was replaced, not that governance provisioned a role. The evidence had been durable and readable
 * since R7.1.1 and no module under `heby-answer/` had ever read it.
 *
 *     A COUNT OF ACTS != A HISTORY OF ACTS
 *
 * ── WHY IT IS ITS OWN CLASS AND NOT PART OF `governance` ─────────────────────
 *
 * `governance` is connected (G6C) and carries the CONSTITUTION: the governance authority record,
 * the genesis session, delegated authority and the member role baseline. Four items about WHO HOLDS
 * AUTHORITY, and every one of them complete.
 *
 * This is the opposite kind of fact — WHAT HAPPENED — and it is BOUNDED. Folding a truncated page
 * into a class whose other items are complete would make "is this all of it?" unanswerable under
 * one provenance line, which is exactly R6B's defect. So it is its own class, for the reason
 * `work-artifacts`, `external-recipients`, `integrations`, `organization` and `agents` are:
 * a different authority owner with its own bound and its own outcomes.
 *
 *     CONSTITUTION != HISTORY        WHO MAY ACT != WHAT WAS DONE
 *
 * ── THE VALIDATOR COLLISION, AND WHY THE WORDING MOVED RATHER THAN THE GUARD ──
 *
 * `audit_result` is a closed enum: `committed`, `rejected`, `rolled-back`. And `action` is the
 * writer's own free verb — `knowledge.create` today, and nothing stops a future writer recording
 * `governance.decision.approved` or `knowledge.node.deleted`.
 *
 * `detail` flows into Heby's OWN deterministic prose, where `validateResponse` refuses a
 * consequential act that is neither negated nor attributed. A raw `result rejected` or a raw verb
 * ending in `deleted` would therefore withhold the whole answer — the E2-5 production defect,
 * re-armed by different data.
 *
 * The guard is right and the wording moves, for the third time in this repository. But the fix here
 * is NOT a rephrasing: it is the field that was built for it. `ResolvedSourceItem.content` is
 * documented as VERBATIM SOURCE TEXT that travels only into the model's grounding context and never
 * into Heby's own sentences, added for precisely this hazard. So:
 *
 *   `content` carries the writer's verb and the recorded outcome VERBATIM — never reinterpreted,
 *            never sanitised, exactly as `RecordedAct` received them.
 *   `detail`  carries only closed-vocabulary fields Heby composes itself: entity kind, actor kind,
 *            recording subsystem, instant, simulation, and an outcome phrased from the enum.
 *
 * The writer's verb therefore CANNOT reach Heby's own prose — not because it is filtered, but
 * because it is never placed there. No validator change was needed and none was made.
 *
 * ── WHAT IT STRUCTURALLY CANNOT SAY ──────────────────────────────────────────
 *
 * `readRecordedActPage` selects eight columns and WITHHELDS ten, `WITHHELD_AUDIT_COLUMNS` among
 * them `entityId`, `actorId`, `metadata`, `previousState` and `nextState`. So no payload, no entity
 * identifier and no actor identity can travel: there is no field to read. The released
 * `RECORDED_ACT_HISTORY_BOUNDARY` already declares what this evidence may never claim, and this
 * module carries those denials into the provenance rather than restating them.
 *
 * Server-only.
 */
import type { ResolvedSourceItem, SourceResolution } from "@/features/heby-runtime/contracts";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  RECORDED_ACT_PAGE_LIMIT,
  type RecordedAct,
  type RecordedActHistoryResult,
} from "./contracts";
import { observeRecordedActHistory } from "./observe.server";

/**
 * Named for what it is, and for what it is not.
 *
 * A reader who sees this line must not conclude that Hebun holds a complete history of everything
 * this organization has done. It holds the acts Hebun's own writers recorded, and stops.
 */
export const RECORDED_ACT_GROUNDING_PROVENANCE =
  "Recorded Act History — the acts Hebun durably recorded for this tenant, read tenant-scoped from " +
  "the session. EVERY ITEM IN THIS SOURCE IS DERIVED (authoritative: false), including the " +
  "individual act items: none of them is authoritative evidence, and an act's `authority source` " +
  "names a field recorded on that act, never the standing of this evidence. " +
  "TWO SEPARATE COVERAGE QUESTIONS, WHICH MUST NOT BE MERGED. (1) RETRIEVAL COVERAGE: at most " +
  `${RECORDED_ACT_PAGE_LIMIT} acts are carried, newest first, and the stated total is a count over ` +
  "this tenant's ENTIRE recorded ledger — unbounded, taken independently of the carried page, not a " +
  "count of some window. So when the carried count equals the total, every act Hebun has recorded " +
  "for this organization is present here and no further Hebun-recorded act exists beyond this " +
  "result at the instant it was read; when it is smaller, the difference is stated as acts that " +
  "exist outside this result. (2) REAL-WORLD COVERAGE: Hebun does not record every act this " +
  "organization performs, so complete retrieval coverage is still not a complete history of " +
  "organizational activity. This source evidences no intrusion, incident, threat, provider history " +
  "or execution history. No payload, entity identifier or actor identity is carried, because the " +
  "reader withholds those columns.";

/** A successful read that found nothing. An established fact, never a failed read. */
export const RECORDED_ACT_GROUNDING_EMPTY =
  "Hebun has recorded no act for this organization. That is a measured zero, not a failed read.";

export interface RecordedActGroundingDeps {
  readonly readHistory?: (
    tenant: Pick<TenantContext, "tenantId"> | null,
  ) => Promise<RecordedActHistoryResult>;
}

function base(
  state: SourceResolution["state"],
  items: readonly ResolvedSourceItem[],
  unavailableReason?: string,
): SourceResolution {
  return {
    sourceClass: "recorded-acts",
    state,
    provenance: RECORDED_ACT_GROUNDING_PROVENANCE,
    /* The released boundary declares `isAuthoritative: false`. This may not disagree with it. */
    authoritative: false,
    items,
    ...(unavailableReason === undefined ? {} : { unavailableReason }),
  };
}

/**
 * The recorded outcome, phrased from the closed `audit_result` enum.
 *
 * THREE VALUES, THREE PHRASES, AND THEY DO NOT MERGE. A `rejected` transaction and a `rolled-back`
 * one are different histories; collapsing them would be a claim nobody measured. The verbatim enum
 * value still travels in `content`, so nothing here is the only record of it.
 *
 * `rejected` becomes "not committed" rather than the enum word because the enum word is a
 * consequential-act token in Heby's own prose. The phrase is not a softening — a rejected
 * transaction is precisely one that did not commit.
 */
function outcomePhrase(result: string): string {
  if (result === "committed") return "committed";
  if (result === "rejected") return "not committed";
  if (result === "rolled-back") return "rolled back";
  /* An enum value this module has not seen is reported as unrecognised, never guessed at. */
  return "outcome not recognised";
}

/**
 * One act's machine-derived detail line.
 *
 * EVERY CLAUSE IS A CLOSED-VOCABULARY FIELD Heby composes itself. The writer's own verb is
 * deliberately absent — it lives in `content`, where the model reads it and Heby's prose does not.
 *
 *     A RECORDED ACT != AN ACT HEBY PERFORMED
 */
function detailFor(act: RecordedAct): string {
  return [
    `${act.entityType} · ${act.actorType} actor`,
    `outcome ${outcomePhrase(act.result)}`,
    `recorded by ${act.source ?? "an unrecorded subsystem"}`,
    /* A FIELD ON THE RECORD, never this evidence's standing — the provenance says so in words. */
    `recorded authority-source field ${act.authoritySource ?? "none recorded"}`,
    act.simulation ? "SIMULATION — no real effect occurred" : "not a simulation",
    act.occurredAt,
  ].join(" · ");
}

/**
 * Read this tenant's recorded act history for Heby grounding.
 *
 * Tenant-scoped through the authority's own predicate — this module passes the server-resolved
 * context straight through and constructs no query. There is no parameter by which a caller could
 * name another tenant, widen the bound or reach a withheld column, so those are not refused here;
 * they are UNREPRESENTABLE.
 *
 * ONE ITEM PER RECORDED ACT ON THE PAGE, plus ONE LEADING ITEM that states the page's own bound.
 * That leading item is not decoration: the page is newest-first and capped, so without it a reader
 * cannot tell twenty-of-twenty from twenty-of-two-hundred — R6B's finding, and the reason
 * `RecordedActPage` counts its total independently in the first place.
 */
export async function readRecordedActGroundingSource(
  tenant: TenantContext | null,
  deps: RecordedActGroundingDeps = {},
): Promise<SourceResolution> {
  if (typeof window !== "undefined") {
    throw new Error("Recorded act grounding reads are server-only.");
  }

  const read = await (deps.readHistory ??
    ((t: Pick<TenantContext, "tenantId"> | null) => observeRecordedActHistory(t)))(tenant);

  if (read.status === "unavailable") return base("unavailable", [], read.reason);

  if (read.status === "empty") {
    return base("resolved", [
      {
        recordRef: "recorded-acts:none",
        label: "No recorded act",
        detail: RECORDED_ACT_GROUNDING_EMPTY,
        lifecycle: "settled",
      },
    ]);
  }

  const { acts, totalRecordedActs, truncated } = read.page;

  /*
   * BOTH COVERAGE DIMENSIONS, STATED SEPARATELY AND IN EVERY BRANCH.
   *
   * The first release of this line said "18 of 18 recorded acts carried, newest first · this is
   * every act Hebun recorded for this organization" and production Heby still answered that it
   * could not tell "whether older acts exist beyond it". That was a fair reading of what it was
   * given: the provenance called this a bounded PAGE and named "the total they were drawn from"
   * without ever saying that total is an unbounded count over the whole tenant ledger. The released
   * `RecordedActPage` contract says exactly that — and said it only in a doc comment no model reads.
   *
   *     RETRIEVAL COVERAGE  carried vs total Hebun-recorded acts
   *     REAL-WORLD COVERAGE Hebun does not record everything the organization does
   *
   * Merging them is the failure. Complete retrieval coverage is not a complete history, and an
   * incomplete page is not evidence that the organization did more than Hebun recorded.
   */
  const remaining = Math.max(0, totalRecordedActs - acts.length);
  const coverage: ResolvedSourceItem = {
    recordRef: "recorded-acts:coverage",
    label: "Recorded act coverage",
    detail:
      `${acts.length} of ${totalRecordedActs} recorded acts carried, newest first. ` +
      (truncated
        ? `Retrieval coverage is PARTIAL: ${remaining} further act${remaining === 1 ? "" : "s"} ` +
          `Hebun recorded for this organization exist outside this result (page bound ` +
          `${RECORDED_ACT_PAGE_LIMIT}). `
        : "Retrieval coverage is COMPLETE: every act Hebun has recorded for this organization is " +
          "carried here, and no further Hebun-recorded act exists beyond this result at the " +
          "instant it was read — the total is counted over the whole ledger, not over this page. ") +
      "Separately, Hebun does not record every act this organization performs, so this is not a " +
      "complete history of its activity.",
    lifecycle: "settled",
  };

  const items: readonly ResolvedSourceItem[] = [
    coverage,
    ...acts.map((act, index) => ({
      /*
       * ORDINAL, NOT AN IDENTIFIER. `audit_log.id` is a withheld column and no act carries a
       * durable public name, so the reference states this act's position on THIS page and claims
       * nothing more. It is stable within one reading and is not a record id.
       */
      recordRef: `act-${index + 1}`,
      label: `${act.entityType} · ${act.actorType}`,
      detail: detailFor(act),
      /*
       * VERBATIM, AND ONLY HERE. The writer's own verb and the recorded outcome enum, neither
       * reinterpreted nor sanitised. `content` reaches the model's grounding context and never
       * Heby's own sentences, which is why the raw vocabulary is safe to carry unchanged.
       */
      content: `action "${act.action}" · recorded result "${act.result}"`,
      lifecycle: "settled" as const,
    })),
  ];

  return base("resolved", items);
}
