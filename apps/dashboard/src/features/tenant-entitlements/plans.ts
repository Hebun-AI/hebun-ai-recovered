/*
 * tenant-entitlements/plans.ts — COMMERCIAL-ACTIVATION-1. What each recorded plan entitles a tenant to.
 *
 * `companies.plan` holds exactly one of three codes (`companies_plan_chk`):
 *
 *   free      — self-service signups. 15 model / 1 media per UTC day, no video, 1 member.
 *   pro       — a live Stripe subscription. 100 model / 10 media per UTC day, video, 5 members.
 *   founding  — every tenant that existed before billing, and every operator-ceremony tenant. Its
 *               rights are EXACTLY the pre-billing behavior: the deployment's AP-3 safety cap
 *               (50 / 5 by default, env-overridable), video allowed, no member limit.
 *
 * The limits are public: the pricing page and Plan & Usage render these constants, and the AP-3 cap
 * (`tenant-dispatch-ceiling.server.ts`) enforces the same constants. There is no hidden or later-changing quota.
 *
 * An unknown plan string can only come from a row that bypassed the CHECK; it resolves to `free`,
 * the narrowest plan — fail closed, never open.
 */

export const PLAN_CODES = ["free", "pro", "founding"] as const;
export type PlanCode = (typeof PLAN_CODES)[number];

/** The plan a subscription returns a tenant to when it ends. Never `pro`. */
export type BasePlanCode = Exclude<PlanCode, "pro">;

export const COMMERCIAL_PLAN_LIMITS = Object.freeze({
  free: Object.freeze({ model: 15, media: 1, videoGeneration: false, memberLimit: 1 }),
  pro: Object.freeze({ model: 100, media: 10, videoGeneration: true, memberLimit: 5 }),
});

/** The Pro list price; checkout verifies the configured Stripe price matches it exactly. */
export const PRO_PRICE = Object.freeze({ unitAmount: 4900, currency: "usd", interval: "month", display: "$49" });

export const PLAN_LABEL: Readonly<Record<PlanCode, string>> = Object.freeze({
  free: "Free",
  pro: "Pro",
  founding: "Founding",
});

export function asPlanCode(value: unknown): PlanCode {
  return typeof value === "string" && (PLAN_CODES as readonly string[]).includes(value) ? (value as PlanCode) : "free";
}

export interface PlanFeatures {
  readonly videoGeneration: boolean;
  /** Active members plus pending invitations. `null` = no plan limit (founding only). */
  readonly memberLimit: number | null;
}

export function planFeatures(plan: PlanCode): PlanFeatures {
  if (plan === "founding") return { videoGeneration: true, memberLimit: null };
  return { videoGeneration: COMMERCIAL_PLAN_LIMITS[plan].videoGeneration, memberLimit: COMMERCIAL_PLAN_LIMITS[plan].memberLimit };
}
