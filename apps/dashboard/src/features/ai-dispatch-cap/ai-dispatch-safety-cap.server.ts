/*
 * ai-dispatch-cap/ai-dispatch-safety-cap.server.ts — the PERSISTENT TENANT AI DISPATCH SAFETY CAP (AP-3).
 *
 * ── WHAT THIS IS ─────────────────────────────────────────────────────────────
 *
 * A platform-owned ceiling on how many external AI dispatches one tenant may be ADMITTED in one UTC
 * day, per class: `model` (Claude) and `media` (image / video generation). It is a SAFETY bound: it
 * stops a loop, a stuck agent or a double-submitting client from turning one tenant into an
 * unbounded external spend. The per-process budget (`live-spend-budget.server.ts`) bounds a burst
 * inside one instance; this bounds a tenant across every instance, because it counts durable rows.
 *
 * ── WHAT THIS IS NOT ─────────────────────────────────────────────────────────
 *
 * Not billing, not a quota a tenant buys, not a monetary spend cap, and not an authority over WHAT
 * may be disclosed (that is External AI Data-Use). No price exists anywhere in Hebun, so nothing
 * here is money. It is not per agent. It has no "unlimited": an invalid or out-of-range setting is
 * 0, which refuses every dispatch of that class.
 *
 * ── HOW IT COUNTS — NO NEW TABLE ─────────────────────────────────────────────
 *
 * The cap counts the rows Hebun already writes BEFORE a dispatch, so a dispatch and its charge are
 * the same row:
 *
 *   model → `audit_log` `external-ai.disclosure.authorized` (one per authorized Claude call, written
 *           inside this admission, after the process budget granted the call);
 *   media → `media_generation_invocations` with `transport = 'live'` (registered inside this
 *           admission), EXCEPT rows the process budget refused (`provider_failure = 'budget-exhausted'`)
 *           — nothing left Hebun for those.
 *
 * Charge at admission, never refunded, no reserve/reconcile: a call that times out may still have
 * cost something, so the conservative direction is to count it the moment it is allowed out.
 *
 * ── WHY ONE TRANSACTION UNDER AN ADVISORY LOCK ───────────────────────────────
 *
 * Count-then-insert is a race: two requests both read 49 and both write the 50th. The count, the
 * process-budget grant and the charging row are therefore one transaction holding
 * `pg_advisory_xact_lock(<cap namespace>, <tenant:class>)`. A second admission for the same tenant
 * and class waits for the first to commit, then counts its row. Different tenants and classes never
 * share a lock, so one tenant cannot stall another. The lock is held for the count and one insert —
 * never across the provider call.
 *
 * A refusal writes its OWN audit row, `ai-dispatch-cap.refused`, after the transaction. It is a
 * different action, so it is never counted, and a refusal stays a refusal when it cannot be written.
 */
import { and, count, eq, gte, isNull, lt, ne, or, sql } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { mediaGenerationInvocations } from "@/db/schema/media-asset";
import {
  countAuthorizedDisclosuresInWindow,
  recordAiDispatchCapRefusal,
} from "@/features/governance-audit/ai-dispatch-cap-audit.server";

export {
  AI_DISPATCH_CAP_AUDIT_SOURCE,
  AI_DISPATCH_CAP_ENTITY_TYPE,
  AI_DISPATCH_CAP_REFUSED,
} from "@/features/governance-audit/ai-dispatch-cap-audit.server";

export type AiDispatchClass = "model" | "media";

/** Deployment-owned. Absent is normal; the default is the safety bound. */
export const AI_DISPATCH_CAP_ENV_KEYS: Readonly<Record<AiDispatchClass, string>> = Object.freeze({
  model: "HEBUN_AI_DISPATCH_CAP_MODEL_PER_TENANT_DAY",
  media: "HEBUN_AI_DISPATCH_CAP_MEDIA_PER_TENANT_DAY",
});
export const DEFAULT_AI_DISPATCH_CAPS: Readonly<Record<AiDispatchClass, number>> = Object.freeze({ model: 50, media: 5 });
/** A typo fails closed rather than expensive; there is deliberately no "unlimited". */
export const MAX_CONFIGURABLE_AI_DISPATCH_CAPS: Readonly<Record<AiDispatchClass, number>> = Object.freeze({
  model: 1000,
  media: 100,
});

/**
 * Resolve one class's cap, FAIL-CLOSED. Absent → the default. A positive integer at or below the
 * class maximum → that value. Anything else — garbage, 0, negative, above the maximum → 0.
 */
export function resolveAiDispatchCap(
  dispatchClass: AiDispatchClass,
  env: Readonly<Record<string, string | undefined>> = process.env,
): number {
  const raw = env[AI_DISPATCH_CAP_ENV_KEYS[dispatchClass]];
  if (raw === undefined || raw.trim() === "") return DEFAULT_AI_DISPATCH_CAPS[dispatchClass];
  const text = raw.trim();
  if (!/^\d+$/.test(text)) return 0;
  const parsed = Number(text);
  if (!Number.isSafeInteger(parsed) || parsed <= 0 || parsed > MAX_CONFIGURABLE_AI_DISPATCH_CAPS[dispatchClass]) return 0;
  return parsed;
}

/** The UTC day containing `at`, as a half-open window. */
export function utcDayWindow(at: Date): { readonly start: Date; readonly end: Date } {
  const start = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
  return { start, end: new Date(start.getTime() + 86_400_000) };
}

export interface AiDispatchAdmissionInput<T> {
  readonly tenantId: string;
  readonly dispatchClass: AiDispatchClass;
  /** The human the dispatch is attributed to; carried onto the refusal audit only. */
  readonly actorUserId: string;
  readonly correlationId?: string | null;
  /**
   * The process budget, consumed ONLY after the persistent cap admits. False ⇒ refused
   * `process-budget-exhausted`, the transaction rolls back and nothing is charged. Absent for media,
   * whose process budget is consumed by its transport, after registration, exactly as released.
   */
  readonly prepay?: () => boolean;
  /**
   * Write the charging row on the transaction handle it is given. Throwing rolls everything back
   * (`persistence-unavailable`); a value is returned on admission.
   */
  readonly commit: (db: ControlPlaneDatabase) => Promise<T>;
}

export type AiDispatchAdmission<T> =
  | { readonly status: "admitted"; readonly value: T }
  | {
      readonly status: "refused";
      readonly reason: "dispatch-safety-cap-reached" | "process-budget-exhausted" | "persistence-unavailable";
    };

export interface AiDispatchAdmissionDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly now?: () => Date;
}

export type AdmitAiDispatch = <T>(
  input: AiDispatchAdmissionInput<T>,
  deps?: AiDispatchAdmissionDeps,
) => Promise<AiDispatchAdmission<T>>;

function resolveDbOrNull(): ControlPlaneDatabase | null {
  try {
    return getControlPlaneDb();
  } catch {
    return null;
  }
}

/** Dispatches of this class already admitted for this tenant in this window. Tenant is in the WHERE. */
async function admittedInWindow(
  db: ControlPlaneDatabase,
  tenantId: string,
  dispatchClass: AiDispatchClass,
  window: { readonly start: Date; readonly end: Date },
): Promise<number> {
  if (dispatchClass === "model") return countAuthorizedDisclosuresInWindow(db, tenantId, window);
  const [row] = await db
    .select({ n: count() })
    .from(mediaGenerationInvocations)
    .where(
      and(
        eq(mediaGenerationInvocations.tenantId, tenantId),
        eq(mediaGenerationInvocations.transport, "live"),
        gte(mediaGenerationInvocations.requestedAt, window.start),
        lt(mediaGenerationInvocations.requestedAt, window.end),
        /* The process budget refused these: no request left Hebun, so they are not a dispatch. */
        or(isNull(mediaGenerationInvocations.providerFailure), ne(mediaGenerationInvocations.providerFailure, "budget-exhausted")),
      ),
    );
  return Number(row?.n ?? 0);
}

class ProcessBudgetRefusal extends Error {}

/**
 * Admit one external AI dispatch, or refuse it. Never throws.
 *
 *   cap reached      → refused; process budget NOT touched; nothing committed; refusal audited.
 *   process budget   → refused; transaction rolled back, so the cap is not charged.
 *   commit throws    → refused `persistence-unavailable`; rolled back.
 *   otherwise        → the charging row is committed and the caller may dispatch.
 */
export const admitAiDispatch: AdmitAiDispatch = async <T>(
  input: AiDispatchAdmissionInput<T>,
  deps: AiDispatchAdmissionDeps = {},
): Promise<AiDispatchAdmission<T>> => {
  if (typeof window !== "undefined") throw new Error("The AI dispatch safety cap is server-only.");
  const db = (deps.getDb ?? resolveDbOrNull)();
  if (!db) return { status: "refused", reason: "persistence-unavailable" };
  const at = (deps.now ?? (() => new Date()))();
  const day = utcDayWindow(at);
  const cap = resolveAiDispatchCap(input.dispatchClass, deps.env ?? process.env);

  let outcome: { readonly status: "admitted"; readonly value: T } | { readonly status: "cap-reached"; readonly admitted: number };
  try {
    outcome = await db.transaction(async (tx) => {
      const handle = tx as unknown as ControlPlaneDatabase;
      await handle.execute(
        sql`select pg_advisory_xact_lock(hashtext('hebun.ai-dispatch-safety-cap'), hashtext(${`${input.tenantId}:${input.dispatchClass}`}))`,
      );
      const admitted = await admittedInWindow(handle, input.tenantId, input.dispatchClass, day);
      if (admitted >= cap) return { status: "cap-reached" as const, admitted };
      if (input.prepay && !input.prepay()) throw new ProcessBudgetRefusal();
      return { status: "admitted" as const, value: await input.commit(handle) };
    });
  } catch (error) {
    return { status: "refused", reason: error instanceof ProcessBudgetRefusal ? "process-budget-exhausted" : "persistence-unavailable" };
  }
  if (outcome.status === "admitted") return outcome;

  /* Best effort, after the transaction: no dispatch follows a refusal, so its record is a precondition of nothing. */
  await recordAiDispatchCapRefusal(db, {
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    correlationId: input.correlationId ?? null,
    occurredAt: at,
    dispatchClass: input.dispatchClass,
    capPerTenantUtcDay: cap,
    admittedInWindow: outcome.admitted,
    windowStart: day.start,
  });
  return { status: "refused", reason: "dispatch-safety-cap-reached" };
};
