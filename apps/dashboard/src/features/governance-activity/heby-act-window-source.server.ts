/*
 * governance-activity/heby-act-window-source.server.ts — the WINDOWED activity projection, shaped
 * for Heby grounding (E2-7).
 *
 * ── WHAT E2-6 COULD NOT ANSWER ───────────────────────────────────────────────
 *
 * E2-6 carries a bounded newest-first page of recorded acts, and E2-4 carries one elapsed instant.
 * Between them Heby can say what happened lately and how long ago the last one was. Neither can
 * count what happened BETWEEN two instants, and once a tenant's ledger exceeds the page bound
 * neither can see an older period at all.
 *
 *     A RECENT PAGE != A PERIOD COUNT
 *
 * ── WHY IT IS ITS OWN CLASS, THOUGH THE OWNER IS THE SAME ────────────────────
 *
 * `recorded-acts` (E2-6) is a BOUNDED page that states its own coverage. These are UNBOUNDED counts
 * that are exact within their interval. E2-6's own closure argued that a truncated page must not sit
 * beside complete items under one provenance line, because "is this all of it?" then has two
 * answers and one sentence — and that argument applies to itself here, in reverse. Same authority,
 * same standing, different completeness shape, so a separate class keeps each provenance true.
 *
 * ── TWO COUNTS ARE TWO FACTS ─────────────────────────────────────────────────
 *
 * This module computes NO delta, NO direction, NO rate and NO projection. Subtracting the counts
 * would be arithmetic; saying what the difference means is a judgement no authority in Hebun owns.
 * The non-claims travel WITH the numbers rather than being left for a surface to remember, exactly
 * as E2-4 carries its own.
 *
 *     TIME WINDOW != TREND        CHANGE != CAUSATION
 *     MORE        != BETTER       LESS   != WORSE
 *     RECENT      != IMPORTANT    FREQUENCY != RISK
 *
 * ── AND HEBUN HOLDS NO DEFINITION OF "RECENT" ────────────────────────────────
 *
 * The window is reported with its exact instants every time. Seven days is a STATED OBSERVATION
 * BOUNDARY chosen so an answer exists, not a policy about what is current — nothing in this
 * repository owns that semantics, and a class that quietly implied one would be inventing it.
 *
 * Server-only.
 */
import type { ResolvedSourceItem, SourceResolution } from "@/features/heby-runtime/contracts";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import type { RecordedActWindow, RecordedActWindowResult } from "./contracts";
import { observeRecordedActWindows } from "./act-window-read.server";

/**
 * Named for what it is, and for what it is not.
 *
 * A reader who sees this line must not conclude that a bigger number is worse, that a smaller one
 * is progress, or that Hebun knows what happened in the organization outside its own records.
 */
export const ACT_WINDOW_GROUNDING_PROVENANCE =
  "Recorded Act Windows — how many acts Hebun recorded for this tenant inside explicit half-open " +
  "intervals, read tenant-scoped from the session and DERIVED (authoritative: false). Each window " +
  "is reported with its exact instants and is counted with NO bound, so a window count is exact " +
  "rather than a page length. TWO WINDOWS ARE TWO INDEPENDENT COUNTS AND NOTHING ELSE: no " +
  "difference, direction, rate, percentage, trend or projection is computed, because comparing two " +
  "periods is arithmetic and interpreting the comparison is a judgement no authority in Hebun " +
  "holds. Hebun holds NO definition of 'recent' or 'current' — a window is a stated observation " +
  "boundary, never a policy — so an answer must name the period it is talking about rather than " +
  "call it recent. These counts cover only the acts Hebun records, which is not everything the " +
  "organization does, and they evidence no importance, risk, cause, incident or threat.";

/** The non-claims, carried with the numbers rather than left to a surface to remember. */
export const ACT_WINDOW_NON_CLAIMS: readonly string[] = Object.freeze([
  "a time window is not a trend — two counts are two measurements, not a direction",
  "more recorded acts is not better and fewer is not worse; Hebun holds no target for either",
  "a change between periods is not a cause of anything",
  "these are the acts Hebun records, not everything this organization did in the period",
]);

/**
 * The refusal carried on the comparison item, held as its own constant.
 *
 * IT NAMES THE JUDGEMENTS IT FORBIDS, which is exactly what makes it useful to a model and exactly
 * what makes a vocabulary ban fail on it. This repository has recorded that collision in E2-4, E2-5
 * and E2-6; the settled remedy is to pin the denial BY EQUALITY and run any word ban over only what
 * the source CLAIMS. Keeping it separately named is what lets a test do both.
 */
export const ACT_WINDOW_COMPARISON_REFUSAL =
  "The periods are adjacent and equal in length, and neither overlaps the other, so the two " +
  "numbers are comparable as counts. Hebun states both and interprets neither: it holds no " +
  "target, no expected level and no authority to say that either number is good, bad, improving " +
  "or worsening.";

/** A window that was read and held nothing. An established fact about that period. */
export const ACT_WINDOW_MEASURED_ZERO =
  "no act Hebun records occurred in this period — a measured zero, not a failed read";

export interface ActWindowGroundingDeps {
  readonly readWindows?: (
    tenant: Pick<TenantContext, "tenantId"> | null,
  ) => Promise<RecordedActWindowResult>;
}

function base(
  state: SourceResolution["state"],
  items: readonly ResolvedSourceItem[],
  unavailableReason?: string,
): SourceResolution {
  return {
    sourceClass: "recorded-act-windows",
    state,
    provenance: ACT_WINDOW_GROUNDING_PROVENANCE,
    authoritative: false,
    items,
    ...(unavailableReason === undefined ? {} : { unavailableReason }),
  };
}

/**
 * One window's detail line.
 *
 * THE INSTANTS ARE ALWAYS PRESENT, and the interval is spelled as half-open in words as well as in
 * SQL — `from X (inclusive) to Y (exclusive)` — so a reader can tell which side a boundary act fell
 * on without knowing the implementation.
 *
 * A zero is stated as a measured zero rather than rendered as an absence, and the kind breakdown is
 * omitted rather than shown as an empty list, because an empty breakdown beside a zero invites
 * reading the period as unread.
 */
function detailFor(window: RecordedActWindow): string {
  const interval = `from ${window.since} (inclusive) to ${window.until} (exclusive)`;
  if (window.acts === 0) return `${interval} · ${ACT_WINDOW_MEASURED_ZERO}`;

  const kinds = window.byEntityKind
    .map((kind) => `${kind.entityType} ${kind.acts}`)
    .join(", ");
  return (
    `${interval} · ${window.acts} recorded act${window.acts === 1 ? "" : "s"}` +
    ` · by kind: ${kinds}` +
    " · counted with no bound, so this is the exact number for the period"
  );
}

/**
 * Read this tenant's windowed recorded-act activity for Heby grounding.
 *
 * Tenant-scoped through the authority's own predicate — this module passes the server-resolved
 * context straight through and constructs no query. There is no parameter by which a caller could
 * name another tenant or another window, so those are not refused here; they are UNREPRESENTABLE.
 *
 * THREE ITEMS, ALWAYS, in a fixed order: the current period, the period immediately before it, and
 * a comparison item that carries BOTH numbers and refuses to interpret them. The third exists
 * because a model handed two counts will otherwise compute the difference itself and narrate it —
 * so the evidence states the arithmetic and states, in the same breath, that the arithmetic means
 * nothing Hebun can vouch for.
 */
export async function readActWindowGroundingSource(
  tenant: TenantContext | null,
  deps: ActWindowGroundingDeps = {},
): Promise<SourceResolution> {
  if (typeof window !== "undefined") {
    throw new Error("Recorded act window grounding reads are server-only.");
  }

  const read = await (deps.readWindows ??
    ((t: Pick<TenantContext, "tenantId"> | null) => observeRecordedActWindows(t)))(tenant);

  if (read.status === "unavailable") return base("unavailable", [], read.reason);

  const { current, previous, windowDays, evaluatedAt } = read.comparison;

  const items: readonly ResolvedSourceItem[] = [
    {
      recordRef: `window:current-${windowDays}d`,
      label: `Recorded acts in the last ${windowDays} days`,
      detail: detailFor(current),
      lifecycle: "settled",
    },
    {
      recordRef: `window:previous-${windowDays}d`,
      label: `Recorded acts in the ${windowDays} days before that`,
      detail: detailFor(previous),
      lifecycle: "settled",
    },
    {
      recordRef: "window:comparison",
      label: "The two periods side by side",
      detail:
        `${current.acts} recorded act${current.acts === 1 ? "" : "s"} in the current ` +
        `${windowDays}-day period and ${previous.acts} in the ${windowDays}-day period ` +
        `immediately before it, both measured against ${evaluatedAt}. ` +
        ACT_WINDOW_COMPARISON_REFUSAL,
      lifecycle: "settled",
    },
  ];

  return base("resolved", items);
}
