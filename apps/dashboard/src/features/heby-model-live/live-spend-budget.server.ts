/*
 * heby-model-live/live-spend-budget.server.ts — the per-PROCESS live-call budget (R2G — K-2).
 *
 * ── WHAT WAS ACTUALLY BROKEN ─────────────────────────────────────────────────
 *
 * `MAX_LIVE_CALLS = 1` was described as a per-process budget and never was one. The counter it
 * guards lives in the closure `createLiveClaudeTransport` returns, and `selectModelTransport`
 * builds a FRESH transport on every request — nothing memoises it. So the count reset on every
 * request, and Hebun had exactly one real control over external spend: the durable Director
 * switch, which is all-or-nothing. Between "off" and "unbounded" there was nothing.
 *
 * This module is that missing middle, and nothing more.
 *
 * ── WHAT THIS IS NOT ─────────────────────────────────────────────────────────
 *
 * It is a RUNTIME SAFETY MECHANISM. It is not Governance, not billing, not a quota system, and
 * not an authority. It cannot tell tenants apart and deliberately does not try: the credential
 * is deployment-owned and shared across authenticated tenants for this phase, which is a
 * recorded limitation, not something a counter can fix. A limiter that pretended to know whose
 * spend it was refusing would be making a tenant-authorization claim it has no basis for.
 *
 * It holds NO credential, NO prompt, NO response, and NO tenant identity — only integers. It
 * persists nothing, writes no row, needs no schema and no migration, and runs no timer: the
 * count moves only when a caller attempts a spend.
 *
 * ── THE HONEST LIMIT OF "PER PROCESS" ────────────────────────────────────────
 *
 * A serverless deployment has many processes and recycles them. So this bounds a BURST inside
 * one instance; it does not bound total deployment spend, and two instances have two budgets.
 * That is the Director's decision for this phase — the alternative is a durable counter, which
 * is a table, a migration, and a question about who owns it. Recorded rather than implied.
 *
 * A consequence worth stating plainly: once an instance exhausts its budget it refuses every
 * further live call until that instance is recycled. Answers stay honest — the deterministic
 * path still produces one, with a truthful note — but they stop being model answers.
 */

import { ModelConnectivityError } from "@/features/heby-model/model-error";

/** The env key that tunes the per-process budget. Absent is normal; the default is safe. */
export const LIVE_CALL_BUDGET_ENV_KEY = "HEBUN_MODEL_LIVE_CALL_BUDGET";

/**
 * The default budget: small, finite, and chosen for the first real-provider acceptance.
 *
 * Large enough that a human can retry an acceptance a few times without a redeploy; small
 * enough that a loop, a double-submit, or a misbehaving client cannot turn one accepted call
 * into a burst before anybody notices.
 */
export const DEFAULT_LIVE_CALL_BUDGET = 8;

/**
 * The largest budget a deployment may configure. Its job is to make a typo fail closed rather
 * than expensive: `100000` is not a budget anybody meant to set, so it is refused instead of
 * honoured. There is deliberately no "unlimited".
 */
export const MAX_CONFIGURABLE_LIVE_CALL_BUDGET = 100;

export interface LiveSpendBudget {
  /** The budget this instance was constructed with. Immutable. */
  readonly limit: number;
  /** How many spends have been granted. A snapshot for reporting — never a mutable handle. */
  spent(): number;
  /**
   * Consume one unit. Returns true when the spend is granted, false when the budget is
   * exhausted. Never throws, so a caller decides how a refusal is surfaced.
   */
  attempt(): boolean;
}

function assertServerRuntime(): void {
  if (typeof window !== "undefined") {
    throw new Error("The live spend budget is server-only.");
  }
}

/**
 * Resolve the configured budget, FAIL-CLOSED.
 *
 * ABSENT → the default. PRESENT and a positive integer at or below the configurable maximum →
 * that value. PRESENT and anything else — garbage, `0`, a negative, or above the maximum → `0`,
 * which refuses every live call.
 *
 * Zero rather than a fallback to the default, on purpose: an operator who set this variable was
 * trying to say something about spend, and quietly substituting a number they did not choose is
 * the wrong answer to a typo in a budget.
 */
export function resolveLiveCallBudget(
  env: Readonly<Record<string, string | undefined>> = process.env,
): number {
  const raw = env[LIVE_CALL_BUDGET_ENV_KEY];
  if (raw === undefined || raw.trim() === "") return DEFAULT_LIVE_CALL_BUDGET;
  const text = raw.trim();
  if (!/^\d+$/.test(text)) return 0;
  const parsed = Number(text);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) return 0;
  if (parsed > MAX_CONFIGURABLE_LIVE_CALL_BUDGET) return 0;
  return parsed;
}

/**
 * Build a budget. Injectable so the limiter is provable without touching the process singleton
 * — which is also why there is no reset: a test builds its own, and production cannot be handed
 * a backdoor that clears the count.
 */
export function createLiveSpendBudget(limit: number): LiveSpendBudget {
  const bounded = Number.isSafeInteger(limit) && limit > 0 ? limit : 0;
  let granted = 0;
  return Object.freeze({
    limit: bounded,
    spent: () => granted,
    attempt(): boolean {
      if (granted >= bounded) return false;
      granted += 1;
      return true;
    },
  });
}

let processBudget: LiveSpendBudget | undefined;

/**
 * The ONE budget every live transport in this process shares.
 *
 * Memoised on first use, which is the whole point: `selectModelTransport` builds a fresh
 * transport per request, and every one of them resolves to this same object, so a new transport
 * can no longer buy a new allowance.
 */
export function getProcessLiveSpendBudget(): LiveSpendBudget {
  assertServerRuntime();
  if (!processBudget) processBudget = createLiveSpendBudget(resolveLiveCallBudget());
  return processBudget;
}

/** The refusal, in one place, so every caller reports an exhausted budget identically. */
export function liveBudgetExhaustedError(): ModelConnectivityError {
  return new ModelConnectivityError(
    "rate-limited",
    "The live model call budget for this process is exhausted.",
  );
}
