/*
 * plan-follow-up-provenance/binding.server.ts — PROOF THAT A PLAN STEP NAMED THESE WORK ITEMS
 * (PLAN-FOLLOW-UP-REFERENCE-V1).
 *
 * ── THE GAP ──────────────────────────────────────────────────────────────────
 *
 * An AI operational plan is not persisted, and a follow-up request reaches the server long after the
 * plan was produced. A work item id the browser sends back is a claim anyone in the tenant could
 * make about any of its work. So the server SIGNS what the step named at the moment it produced the
 * plan, and accepts provenance only through that signature.
 *
 * ── WHAT IS BOUND ────────────────────────────────────────────────────────────
 *
 * Version, tenant, user, session context, plan reference, step number, step move, the ordered work
 * item ids, and an expiry. Signed with HMAC-SHA256 under `HEBUN_PLAN_FOLLOW_UP_BINDING_SECRET`, a
 * secret used for nothing else, over a domain label so no other signature in Hebun can verify here.
 * The browser carries the token unchanged; it cannot alter or mint one, and the token contains no
 * secret and no title — only ids the server re-checks against its own records.
 *
 * ── WHAT A VALID BINDING PROVES, AND WHAT IT DOES NOT ────────────────────────
 *
 * It proves THIS server produced a plan whose step N listed exactly these items, for this human in
 * this session, recently. It does NOT prove the items still exist or are still in service — the
 * request writer and the executor check that against the Work tables, every time. It authorizes
 * nothing: a valid binding only lets an otherwise-normal proposal carry provenance.
 *
 * NOT SINGLE-USE: the same step may be followed up more than once inside the expiry, which yields
 * separate proposals that each carry the same, true provenance. Duplicate payloads are still refused
 * by the request writer's own pending-digest rule.
 *
 * Server-only. Writes nothing. Reads only the environment.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";

export const PLAN_FOLLOW_UP_BINDING_SECRET_ENV = "HEBUN_PLAN_FOLLOW_UP_BINDING_SECRET";
export const PLAN_FOLLOW_UP_BINDING_VERSION = 1;
/** Long enough to read a plan and confirm a follow-up; short enough that a leaked token goes stale. */
export const PLAN_FOLLOW_UP_BINDING_TTL_MS = 30 * 60_000;
/** Mirrors the source table's ordinal bound; checked before any write. */
export const PLAN_FOLLOW_UP_MAX_SOURCES = 40;
const MIN_SECRET_LENGTH = 32;
const LABEL = "plan-follow-up-binding:v1:";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface PlanFollowUpStepBinding {
  readonly planRef: string;
  readonly step: number;
  readonly move: string;
  /** In the order the step listed them. */
  readonly workItemIds: readonly string[];
}

export type PlanFollowUpBindingRefusal =
  | "binding-secret-unavailable"
  | "binding-malformed"
  | "binding-signature-invalid"
  | "binding-version-unsupported"
  | "binding-expired"
  | "binding-context-mismatch";

export type VerifiedPlanFollowUpBinding =
  | ({ readonly status: "valid" } & PlanFollowUpStepBinding)
  | { readonly status: "invalid"; readonly reason: PlanFollowUpBindingRefusal };

interface Payload {
  readonly v: number;
  readonly t: string;
  readonly u: string;
  readonly s: string;
  readonly p: string;
  readonly n: number;
  readonly m: string;
  readonly w: readonly string[];
  readonly e: number;
}

export interface PlanFollowUpBindingDeps {
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly now?: () => number;
}

function secretFrom(env: Readonly<Record<string, string | undefined>>): string | null {
  const value = env[PLAN_FOLLOW_UP_BINDING_SECRET_ENV]?.trim();
  return value && value.length >= MIN_SECRET_LENGTH ? value : null;
}

function sign(secret: string, body: string): string {
  return createHmac("sha256", secret).update(`${LABEL}${body}`).digest("base64url");
}

/** Whether linked follow-ups can be offered at all in this deployment. */
export function planFollowUpBindingAvailable(deps: PlanFollowUpBindingDeps = {}): boolean {
  return secretFrom(deps.env ?? process.env) !== null;
}

/**
 * Sign one plan step for the CURRENT human. `null` when the secret is unavailable or the step is not
 * bindable — the caller then offers no linked follow-up for it, and says so.
 */
export function mintPlanFollowUpBinding(
  tenant: TenantContext,
  step: PlanFollowUpStepBinding,
  deps: PlanFollowUpBindingDeps = {},
): string | null {
  const secret = secretFrom(deps.env ?? process.env);
  if (!secret) return null;
  if (!tenant.tenantId || !tenant.userId || !tenant.sessionContextId) return null;
  if (step.workItemIds.length === 0 || step.workItemIds.length > PLAN_FOLLOW_UP_MAX_SOURCES) return null;
  if (!step.workItemIds.every((id) => UUID.test(id))) return null;
  if (new Set(step.workItemIds).size !== step.workItemIds.length) return null;

  const payload: Payload = {
    v: PLAN_FOLLOW_UP_BINDING_VERSION,
    t: tenant.tenantId,
    u: tenant.userId,
    s: tenant.sessionContextId,
    p: step.planRef,
    n: step.step,
    m: step.move,
    w: [...step.workItemIds],
    e: (deps.now ?? Date.now)() + PLAN_FOLLOW_UP_BINDING_TTL_MS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(secret, body)}`;
}

function isPayload(value: unknown): value is Payload {
  if (typeof value !== "object" || value === null) return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p.v === "number" &&
    typeof p.t === "string" &&
    typeof p.u === "string" &&
    typeof p.s === "string" &&
    typeof p.p === "string" &&
    typeof p.n === "number" &&
    typeof p.m === "string" &&
    typeof p.e === "number" &&
    Array.isArray(p.w) &&
    p.w.length > 0 &&
    p.w.length <= PLAN_FOLLOW_UP_MAX_SOURCES &&
    p.w.every((id) => typeof id === "string" && UUID.test(id)) &&
    new Set(p.w).size === p.w.length
  );
}

/**
 * Verify a token for the CURRENT human. The signature is checked, in constant time, before the
 * payload is parsed; then version, expiry, and tenant + user + session against the trusted context.
 * Every failure is a refusal with its own reason — never an unlinked fallback.
 */
export function verifyPlanFollowUpBinding(
  tenant: TenantContext,
  token: unknown,
  deps: PlanFollowUpBindingDeps = {},
): VerifiedPlanFollowUpBinding {
  const invalid = (reason: PlanFollowUpBindingRefusal): VerifiedPlanFollowUpBinding => ({ status: "invalid", reason });
  const secret = secretFrom(deps.env ?? process.env);
  if (!secret) return invalid("binding-secret-unavailable");
  if (typeof token !== "string" || token.length > 8_192) return invalid("binding-malformed");

  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return invalid("binding-malformed");
  const [body, signature] = parts as [string, string];

  const given = Buffer.from(signature);
  const want = Buffer.from(sign(secret, body));
  if (given.length !== want.length || !timingSafeEqual(given, want)) return invalid("binding-signature-invalid");

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return invalid("binding-malformed");
  }
  if (!isPayload(parsed)) return invalid("binding-malformed");
  if (parsed.v !== PLAN_FOLLOW_UP_BINDING_VERSION) return invalid("binding-version-unsupported");
  if ((deps.now ?? Date.now)() > parsed.e) return invalid("binding-expired");
  if (parsed.t !== tenant.tenantId || parsed.u !== tenant.userId || parsed.s !== tenant.sessionContextId) {
    return invalid("binding-context-mismatch");
  }
  return { status: "valid", planRef: parsed.p, step: parsed.n, move: parsed.m, workItemIds: parsed.w };
}
