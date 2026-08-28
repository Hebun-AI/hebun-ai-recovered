/*
 * action-execution/execution-ledger-projection.server.ts — what the Director may READ about acts
 * this organization has already performed (GOVERNED-EXECUTION-1).
 *
 * ── THE GAP THIS CLOSES, AND ONLY THIS ONE ───────────────────────────────────
 *
 * R3B made execution durable and R3B's own readers were never called by anything in `src/`. The
 * consequence was narrow and serious: an attempt that ended `unknown` — the provider MAY hold the
 * message — was visible for exactly as long as the click that produced it. After a reload the
 * strongest claim Hebun could make about an irreversible act was gone from the surface, while the
 * row that carried it sat in the database being read by nobody.
 *
 * This module is a READ. It introduces no authority, owns no table, and adds no capability. It
 * cannot approve, authorize, spend, execute, reconcile, retry or record anything, and it holds no
 * representation in which any of those could be asked for.
 *
 * ── WHY IT DOES NOT READ THE AUDIT LEDGER, THOUGH THAT READER ALSO EXISTS ────
 *
 * `readActionExecutionHistory` is the sibling seam and it stays uncalled here, deliberately, for
 * two reasons that both point the same way:
 *
 *   1. It lives in `governance-audit/action-execution-audit.server.ts`, which is ALSO the module
 *      that APPENDS the execution event. Importing it would pull a writer into the import graph of
 *      a read surface — the exact read/write mixing G6C had to unpick after a handle import put a
 *      Governance writer inside Heby's graph. A firewall can then only assert "the writer is
 *      present but unused", which is inspection, not mechanism.
 *   2. `/audit` (R7.1.1) already surfaces recorded acts from `audit_log`, and its firewall forbids
 *      that graph from reaching this feature at all. A second act-history surface is precisely the
 *      duplication this phase is not allowed to create.
 *
 * The division is therefore: `/audit` answers "which authority-bearing acts were recorded", and
 * this answers "what state did the attempt itself reach". Two questions, two owners, one table
 * each. What `/audit` cannot say — it withholds `entity_id` and `metadata` — is which attempt a
 * recorded act belongs to, and that limitation is not repaired here by widening either one.
 *
 * ── TWO STATEMENTS, BECAUSE THE BOUND IS PART OF THE MEANING ─────────────────
 *
 * This was first built as ONE read of the most recent attempts, partitioned in memory. That is
 * elegant and it is WRONG, for exactly the reason R6B recorded: a bound that is correct for a list
 * is silently wrong for the population it is filtered from.
 *
 * `readExecutionAttempts` returns the 50 most recent attempts ordered by `started_at DESC`. Derive
 * attention from those rows and an `unknown` older than fifty newer attempts disappears from the
 * ONE list that exists so a human never loses an ambiguous irreversible act. It would not error, it
 * would not warn — the surface would simply say nothing needs attention, which is the most
 * dangerous sentence this phase could produce.
 *
 * So attention comes from `readUnreconciledAttempts`, whose predicate filters by status IN THE
 * DATABASE. Its bound then applies to unreconciled rows only, so it can bite only after fifty
 * simultaneously-ambiguous attempts — and at that point the surface says so rather than truncating
 * in silence.
 *
 * THE COST, STATED. Two statements can disagree transiently: an attempt terminalizing between them
 * may appear in the attention lens while the history already shows it settled. That is a stale
 * reading which the next load corrects, and it is strictly preferable to a lost one. A disagreement
 * a human can see beats a row a human never sees.
 *
 * ── WHAT THE PROJECTION DELIBERATELY DROPS ───────────────────────────────────
 *
 * `handoffId` and `recipientId` are on the attempt view and are NOT carried across.
 *
 *   handoffId    is the value handed to the provider as its idempotency key. It authorizes nothing
 *                on its own and no ingress exists that could replay it — but a surface has no use
 *                for it, and an authorization-bearing token whose only home is a database column
 *                should not acquire a second home in a browser because it was convenient.
 *   recipientId  is a bare uuid. APP-2 settled the principle for the proposer id on this very
 *                surface: an identifier a reader cannot resolve is a leak, not a label. Resolving
 *                it to a name would mean joining `external_recipients`, which widens this read
 *                into an authority it has no business holding.
 *
 * The row itself carries no address, no message content, no credential and no provider body, so
 * there is nothing else here to withhold — which is stronger than remembering to redact.
 *
 * Server-only.
 */
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  readExecutionAttempts,
  readUnreconciledAttempts,
  type ExecutionAttemptReadDeps,
} from "./read-execution-attempts.server";
import {
  attemptRequiresAttention,
  type ExecutionAttemptStatus,
  type ExecutionAttemptView,
  type ExecutionFailureClass,
  type ProviderResponseClass,
} from "./contracts";

/**
 * One attempt, as a surface may see it.
 *
 * Every field is copied from a durable column. Nothing here is derived from a clock, inferred from
 * another field, or invented when a column is null — a null stays null and the surface says so.
 */
export interface ExecutionLedgerEntry {
  readonly attemptId: string;
  /** The spent authorization, so a reader can tie the act back to the decision that allowed it. */
  readonly permitId: string;
  /** The frozen proposal a human approved. */
  readonly requestId: string;
  readonly actionKind: string;
  /** Which adapter ran. Names the vendor, because a provider id is meaningless without one. */
  readonly adapterId: string;
  readonly status: ExecutionAttemptStatus;
  readonly providerResponseClass: ProviderResponseClass | null;
  /** Present only where the provider returned one, which is the only proof of acceptance. */
  readonly providerMessageId: string | null;
  readonly failureClass: ExecutionFailureClass | null;
  readonly startedAt: string;
  /** Null exactly while the attempt never reached a terminal state. */
  readonly completedAt: string | null;
  /** Derived from status alone, by the shared predicate. Never from age, count or heuristic. */
  readonly requiresAttention: boolean;
}

/**
 * The ledger, or an honest statement that it could not be read.
 *
 * `unavailable` is a THIRD thing, distinct from an empty ledger: "no attempt exists" and "the
 * store did not answer" are different truths about an organization that has performed irreversible
 * acts, and collapsing them would let a broken read render as a clean history.
 */
export type ExecutionLedgerRead =
  | {
      readonly status: "read";
      /** One bounded page of recorded attempts, newest first. */
      readonly entries: readonly ExecutionLedgerEntry[];
      /**
       * Attempts with no confirmed outcome, read under their OWN status predicate — not filtered
       * from `entries`. See the header: filtering the bounded page is how an old ambiguous act
       * would disappear.
       */
      readonly needsAttention: readonly ExecutionLedgerEntry[];
      /**
       * True when the history page filled its bound, so older attempts exist and are NOT shown.
       * Surfaced rather than silent — R6B's rule that a truncated list must say it was truncated.
       */
      readonly historyTruncated: boolean;
      /** True in the same way for the attention list, which needs fifty live ambiguities to bite. */
      readonly attentionTruncated: boolean;
      /** The bound actually applied, so the surface states a number it did not invent. */
      readonly pageLimit: number;
    }
  | { readonly status: "unavailable"; readonly reason: string };

/**
 * The page bound, passed EXPLICITLY rather than left to the reader's default.
 *
 * Relying on the default would mean the truncation flag compares a length against a number this
 * module does not know — true today, wrong the moment the reader's default moves.
 */
export const EXECUTION_LEDGER_PAGE_LIMIT = 50;

/** Pure. The one place an attempt view becomes a ledger entry, so the two cannot drift. */
export function toExecutionLedgerEntry(view: ExecutionAttemptView): ExecutionLedgerEntry {
  return {
    attemptId: view.attemptId,
    permitId: view.permitId,
    requestId: view.requestId,
    actionKind: view.actionKind,
    adapterId: view.adapterId,
    status: view.status,
    providerResponseClass: view.providerResponseClass,
    providerMessageId: view.providerMessageId,
    failureClass: view.failureClass,
    startedAt: view.startedAt,
    completedAt: view.completedAt,
    requiresAttention: attemptRequiresAttention(view.status),
  };
}

/**
 * Read this tenant's execution ledger.
 *
 * The tenant comes from the authorized server context and there is no parameter through which a
 * caller could name another one — the underlying reader scopes every statement by predicate, and
 * this adds no statement of its own.
 */
export async function readExecutionLedger(
  tenant: TenantContext | null,
  deps: ExecutionAttemptReadDeps = {},
): Promise<ExecutionLedgerRead> {
  if (typeof window !== "undefined") {
    throw new Error("Execution ledger reads are server-only.");
  }

  const limit = deps.limit ?? EXECUTION_LEDGER_PAGE_LIMIT;
  const bounded: ExecutionAttemptReadDeps = { ...deps, limit };

  const [history, attention] = await Promise.all([
    readExecutionAttempts(tenant, bounded),
    readUnreconciledAttempts(tenant, bounded),
  ]);

  /*
   * EITHER read failing makes the whole ledger unavailable. A page rendered from one successful
   * half would be a history with no attention list, or an attention list with no history — both of
   * which read as a complete answer while being half of one.
   */
  if (history.status !== "read") return { status: "unavailable", reason: history.reason };
  if (attention.status !== "read") return { status: "unavailable", reason: attention.reason };

  const entries = history.items.map(toExecutionLedgerEntry);
  const needsAttention = attention.items.map(toExecutionLedgerEntry);

  return {
    status: "read",
    entries,
    needsAttention,
    historyTruncated: entries.length >= limit,
    attentionTruncated: needsAttention.length >= limit,
    pageLimit: limit,
  };
}
