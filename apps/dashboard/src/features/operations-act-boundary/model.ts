/*
 * operations-act-boundary/model.ts — the five words, kept apart (Operations Band 2).
 *
 * ── THE QUESTION THIS SURFACE EXISTS TO ANSWER ───────────────────────────────
 *
 * Band 1 shows work a human finished. It cannot say whether Hebun may act on it. Band 3 says what
 * Hebun can observe. Neither answers "this draft is ready — can it leave the building, and if not,
 * what exactly is missing?" That is this band, and nothing else in the repository asks it.
 *
 * ── PREPARED ≠ AUTHORIZED ≠ EXECUTABLE ≠ EXECUTED ≠ SUCCESSFUL ───────────────
 *
 * Five distinct states that a single word — "ready" — has collapsed in every surface that ever
 * tried to summarize them. They are modelled as five SEPARATE stages, each carrying its own
 * provenance string naming the released reader that answered it, because a stage whose source
 * cannot be named is a stage somebody invented.
 *
 * TWO OF THE FIVE ARE DELIBERATELY UNANSWERED HERE, and say so:
 *
 *   prepared    Band 1 already renders it from the Work Artifact authority. Counting it again here
 *               would make a SECOND count of the same thing, free to disagree with the first.
 *   authorized  Authorization is a human act performed through Governance / Heby `/send`. Deriving
 *               an authorization count from execution attempts would report the permits that were
 *               SPENT as though they were the permits that EXIST.
 *
 * Saying "not surfaced here" is the honest answer to both. An empty cell would read as zero.
 *
 * ── ACCEPTANCE IS NOT DELIVERY ───────────────────────────────────────────────
 *
 * `accepted` means the provider took the request. It does not mean a human received anything. The
 * adapter registry states this in its own words and this model repeats it rather than quietly
 * upgrading an accepted row into a success.
 *
 * ── NO NEW AUTHORITY, NO NEW STATE ───────────────────────────────────────────
 *
 * Pure and total. No I/O, no clock, no database, no tenant resolution, no schema, no persistence.
 * It receives two already-released reads and arranges them. Every number it renders is a count of
 * rows some other authority produced; it originates none of them.
 */
import type {
  ExternalSendOpsView,
  TenantExternalSendArming,
} from "@/features/action-execution/execution-arming-projection.server";
import type { ExecutionAttemptRead } from "@/features/action-execution/read-execution-attempts.server";
import { attemptRequiresAttention } from "@/features/action-execution/contracts";

/** The five words, in the order a piece of work passes through them. Closed and ordered. */
export const ACT_STAGES = ["prepared", "authorized", "executable", "executed", "successful"] as const;

export type ActStage = (typeof ACT_STAGES)[number];

/**
 * Where a stage's answer came from.
 *
 * `not-surfaced-here` is NOT `unavailable`. The first means another surface owns the question and
 * this one declines to answer it twice; the second means the authority could not be read at all.
 * Collapsing them would turn a deliberate boundary into an outage.
 */
export type ActStageEvidence = "observed" | "not-surfaced-here" | "unavailable";

export interface ActStageView {
  readonly stage: ActStage;
  readonly label: string;
  /** What this stage actually means, in a sentence a human can check. */
  readonly question: string;
  /** The rendered answer. Never a number this module invented. */
  readonly value: string;
  /*
   * OPS-VIS-3. The SAME answer in one or two words, for the pipeline strip, plus the word for WHO
   * answered it. Neither is a new fact: `short` is `value` said briefly and `owner` is `provenance`
   * said in organizational rather than repository terms. The long forms stay exactly as they were
   * and are still rendered, one disclosure away — a dashboard states the organization's truth, and
   * a file path is not one of the organization's facts.
   */
  readonly short: string;
  readonly owner: string;
  readonly evidence: ActStageEvidence;
  /** The released reader that answered. Empty only when nothing answered. */
  readonly provenance: string;
  /** What the answer must not be mistaken for. */
  readonly caveat?: string;
}

/** Counts of attempt rows, by the ledger's own status vocabulary. */
export interface AttemptTally {
  readonly total: number;
  readonly accepted: number;
  readonly refused: number;
  readonly failed: number;
  /** `pending` + `unknown` — the rows a human must reconcile by hand. */
  readonly unreconciled: number;
}

export interface ActBoundaryModel {
  readonly stages: readonly ActStageView[];
  /** Why this organization cannot send, when it cannot. Empty when `effectiveSend` is reachable. */
  readonly blockers: readonly string[];
  readonly attempts: AttemptTally | null;
  /** Set only when the attempt ledger could not be read. Verbatim from the reader. */
  readonly attemptsUnavailableReason: string | null;
  readonly notes: readonly string[];
}

export interface ActBoundaryInput {
  readonly arming: ExternalSendOpsView;
  readonly attempts: ExecutionAttemptRead;
}

/** Count the ledger rows. Pure over an already-read list; it fetches nothing. */
function tally(read: ExecutionAttemptRead): AttemptTally | null {
  if (read.status !== "read") return null;
  let accepted = 0;
  let refused = 0;
  let failed = 0;
  let unreconciled = 0;
  for (const item of read.items) {
    if (item.status === "accepted") accepted += 1;
    else if (item.status === "refused") refused += 1;
    else if (item.status === "failed") failed += 1;
    if (attemptRequiresAttention(item.status)) unreconciled += 1;
  }
  return { total: read.items.length, accepted, refused, failed, unreconciled };
}

/** How this organization's own half reads, in words a Director can act on. */
const TENANT_ARMING_WORDING: Readonly<Record<TenantExternalSendArming, string>> = Object.freeze({
  armed: "this organization is armed",
  "never-armed": "this organization has never been armed",
  withdrawn: "this organization's arming was withdrawn",
  /* An absence of context is not a decision. See the projection's own header. */
  "not-established": "this organization's arming could not be established",
});

/**
 * Why a send is blocked, naming EVERY missing half rather than the first one found.
 *
 * A Director told only the first blocker fixes it, reloads, and is told the next — which is how a
 * two-step configuration becomes four round trips. The projection already resolves every half, so
 * there is no reason to reveal them one at a time.
 */
function blockersFor(arming: ExternalSendOpsView): readonly string[] {
  if (arming.effectiveSend === "reachable") return Object.freeze([]);
  const blockers: string[] = [];
  if (arming.tenantArming !== "armed") {
    blockers.push(`Organization half — ${TENANT_ARMING_WORDING[arming.tenantArming]}.`);
  }
  if (!arming.directorEnabled) {
    blockers.push("Deployment half — the durable external-send switch is off.");
  }
  if (arming.configuration !== "configured") {
    const missing: string[] = [];
    if (arming.credential !== "present") missing.push("credential");
    if (arming.sender !== "configured") missing.push("sender");
    if (arming.subject !== "configured") missing.push("subject");
    blockers.push(`Deployment configuration — missing ${missing.join(", ")}.`);
  }
  return Object.freeze(blockers);
}

function buildStages(arming: ExternalSendOpsView, attempts: AttemptTally | null, reason: string | null): readonly ActStageView[] {
  const executable = arming.effectiveSend === "reachable";
  return Object.freeze([
    Object.freeze({
      stage: "prepared" as const,
      label: "Prepared",
      question: "Has a human finished the work?",
      value: "Shown in Work in flight, above",
      short: "Above",
      owner: "Work in flight",
      evidence: "not-surfaced-here" as const,
      provenance: "Work Artifact authority — rendered by Band 1",
      caveat: "Not counted twice here. One count, one owner.",
    }),
    Object.freeze({
      stage: "authorized" as const,
      label: "Authorized",
      question: "Has a human decided it may leave?",
      value: "Decided in Governance, not reported here",
      short: "Governance",
      owner: "Heby /send",
      evidence: "not-surfaced-here" as const,
      provenance: "Governance — a permit is created through Heby /send",
      caveat: "Execution attempts record permits that were SPENT, never the permits that exist.",
    }),
    Object.freeze({
      stage: "executable" as const,
      label: "Executable",
      question: "May Hebun act for this organization right now?",
      value: executable ? "Reachable" : "Blocked",
      short: executable ? "Reachable" : "Blocked",
      owner: "Arming",
      evidence: "observed" as const,
      provenance: "action-execution/execution-arming-projection.server.ts — effectiveSend",
      caveat: executable
        ? "Reachable means permitted, never that anything has been sent."
        : undefined,
    }),
    Object.freeze({
      stage: "executed" as const,
      label: "Executed",
      question: "How many attempts were actually made?",
      value: attempts ? `${attempts.total}` : (reason ?? "unavailable"),
      /* An unreadable ledger reads "unknown" here. It is never shortened into a zero. */
      short: attempts ? `${attempts.total}` : "unknown",
      owner: "attempts",
      evidence: attempts ? ("observed" as const) : ("unavailable" as const),
      provenance: "action-execution/read-execution-attempts.server.ts — this tenant's rows",
      caveat: "An attempt is a request that left. It is not an outcome.",
    }),
    Object.freeze({
      stage: "successful" as const,
      label: "Successful",
      question: "How many did the provider accept?",
      value: attempts ? `${attempts.accepted}` : (reason ?? "unavailable"),
      short: attempts ? `${attempts.accepted}` : "unknown",
      owner: "accepted",
      evidence: attempts ? ("observed" as const) : ("unavailable" as const),
      provenance: "action-execution/read-execution-attempts.server.ts — status = accepted",
      caveat: "Acceptance is not delivery. The provider took the request; nobody has confirmed receipt.",
    }),
  ]);
}

/** Arrange two released reads into the act boundary. Pure, total, and originates nothing. */
export function buildActBoundaryModel(input: ActBoundaryInput): ActBoundaryModel {
  const attempts = tally(input.attempts);
  const reason = input.attempts.status === "unavailable" ? input.attempts.reason : null;
  return Object.freeze({
    stages: buildStages(input.arming, attempts, reason),
    blockers: blockersFor(input.arming),
    attempts,
    attemptsUnavailableReason: reason,
    notes: Object.freeze([
      "Every value on this band is a count of rows a released authority produced, or a state it resolved. This surface originates none of them.",
      "The email channel is the only executable channel that exists. There is no publishing path, no scheduler and no queue.",
      "Read-only. Nothing here arms, authorizes, retries or sends.",
    ]),
  });
}
