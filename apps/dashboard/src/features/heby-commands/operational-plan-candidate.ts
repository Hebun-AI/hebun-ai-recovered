/*
 * heby-commands/operational-plan-candidate.ts — CONTROLLED AGENT REASONING · PHASE 3.
 *
 * The closed output contract a FUTURE model response must meet to become a proposed operational plan,
 * its strict validator, and the server-written rendering. PURE. Nothing calls a model, nothing at
 * runtime imports this module, and no data class is authorized to reach one. Every candidate this file
 * has ever validated was hypothetical.
 *
 * ── WHAT A MODEL MAY SAY ─────────────────────────────────────────────────────
 *
 *   { "planRef": "<the ref this invocation issued>",
 *     "steps": [ { "step": 1, "move": "review-blocked", "items": ["W3"],
 *                  "because": ["state:blocked", "accountable:false"],
 *                  "priority": "high", "afterStep": null } ],
 *     "uncertainty": "medium" }
 *
 * Every string is from a closed set or is an alias of THIS projection. There is no free-text field,
 * so the model cannot name a work item, a title, a person, a deadline, a dependency, a permission, an
 * approval, an outcome, an organization fact or a piece of evidence. Its reasoning is the `because`
 * codes, and each code is CHECKED against the projection for every item it is cited for. The summary
 * a human reads is written by Hebun from the checked codes, never quoted from the model.
 *
 * ── WHAT A VALID PLAN IS ─────────────────────────────────────────────────────
 *
 *     PROPOSED PLAN != DECISION != APPROVAL != PERMIT != EXECUTION != OUTCOME
 *
 * A valid candidate is a set of recommendations. It carries no field that could become an
 * authorization; no move proposes to Governance, approves, assigns or executes anything; and the
 * rendering says so on every plan. `afterStep` is a suggested order, never a dependency: Work records
 * none, so none can be verified.
 *
 * ── REFUSE, NEVER REPAIR ─────────────────────────────────────────────────────
 *
 * The first defect refuses the whole candidate with a fixed reason. Nothing is dropped, trimmed,
 * coerced or partly shown. A refusal names no alias, value or text from the response.
 */
import {
  OPERATIONAL_DECLARED_STATES,
  validateOperationalPlanningProjection,
} from "@/features/external-ai-data-use/operational-record-contract";
import { PLAN_DELAY_UNAVAILABLE, STALE_AFTER_DAYS, type ActionPlan } from "./action-plan";

/** The four things a person can be asked to look at, each tied to the one fact that licenses it. */
export const PLAN_MOVES = ["review-blocked", "find-accountable", "review-stale", "declare-evidence"] as const;
export type PlanMove = (typeof PLAN_MOVES)[number];

/** `field:value` over the five projection fields — the only evidence a model can cite. */
export const PLAN_REASON_CODES = [
  ...OPERATIONAL_DECLARED_STATES.map((s) => `state:${s}` as const),
  "accountable:true",
  "accountable:false",
  "stale:true",
  "stale:false",
  "evidence:true",
  "evidence:false",
] as const;
export type PlanReasonCode = (typeof PLAN_REASON_CODES)[number];

const MOVE_REQUIRES: Readonly<Record<PlanMove, PlanReasonCode>> = Object.freeze({
  "review-blocked": "state:blocked",
  "find-accountable": "accountable:false",
  "review-stale": "stale:true",
  "declare-evidence": "evidence:false",
});

export const PLAN_PRIORITIES = ["high", "medium", "low"] as const;
export const PLAN_UNCERTAINTY = ["low", "medium", "high"] as const;
export const MAX_PLAN_STEPS = 10;
export const MAX_PLAN_REASONS_PER_STEP = 5;
/** Larger than any valid candidate over 40 items and 10 steps; anything beyond is refused unread. */
export const MAX_PLAN_RESPONSE_CHARS = 8_000;

const CANDIDATE_KEYS = ["planRef", "steps", "uncertainty"] as const;
const STEP_KEYS = ["step", "move", "items", "because", "priority", "afterStep"] as const;
const WHOLE_STRING_FENCE = /^```(?:json)?\s*([\s\S]*?)\s*```$/;

export interface OperationalPlanStep {
  readonly step: number;
  readonly move: PlanMove;
  readonly items: readonly string[];
  readonly because: readonly PlanReasonCode[];
  readonly priority: (typeof PLAN_PRIORITIES)[number];
  readonly afterStep: number | null;
}

export interface ValidatedOperationalPlan {
  readonly planRef: string;
  /** Always a recommendation. There is no other value and no field that could carry one. */
  readonly kind: "recommendation";
  readonly steps: readonly OperationalPlanStep[];
  readonly uncertainty: (typeof PLAN_UNCERTAINTY)[number];
}

export type PlanCandidateRefusal =
  | "projection-invalid"
  | "not-a-structured-object"
  | "response-too-large"
  | "unexpected-shape"
  | "plan-ref-mismatch"
  | "too-many-steps"
  | "invalid-step-number"
  | "unknown-move"
  | "unknown-alias"
  | "duplicate-alias"
  | "duplicate-step"
  | "unknown-reason-code"
  | "reason-not-supported"
  | "move-not-supported"
  | "invalid-priority"
  | "invalid-after-step"
  | "invalid-uncertainty";

export type PlanCandidateVerdict =
  | { readonly status: "valid"; readonly plan: ValidatedOperationalPlan }
  | { readonly status: "refused"; readonly reason: PlanCandidateRefusal };

interface ProjectionItem {
  readonly alias: string;
  readonly state: string;
  readonly accountable: boolean;
  readonly stale: boolean;
  readonly evidenceDeclared: boolean;
}

/** An invocation-local reference for one response. Not stored, not an id of anything. */
export function mintPlanRef(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `P-${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

const holds = (code: PlanReasonCode, item: ProjectionItem): boolean => {
  const [field, value] = code.split(":") as [string, string];
  if (field === "state") return item.state === value;
  const flag = field === "accountable" ? item.accountable : field === "stale" ? item.stale : item.evidenceDeclared;
  return flag === (value === "true");
};

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
const keysAreExactly = (v: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(v).length === keys.length && keys.every((k) => Object.prototype.hasOwnProperty.call(v, k));
const oneOf = <T extends string>(set: readonly T[], v: unknown): v is T => typeof v === "string" && (set as readonly string[]).includes(v);

/**
 * One model response → a validated proposed plan, or a refusal. `projection` must be the exact
 * projection this invocation offered, and `planRef` the ref it issued: both are required, so the
 * check cannot be performed without the containment.
 */
export function validateOperationalPlanCandidate(
  responseText: unknown,
  context: { readonly planRef: string; readonly projection: { readonly items: readonly ProjectionItem[] } },
): PlanCandidateVerdict {
  const refuse = (reason: PlanCandidateRefusal): PlanCandidateVerdict => ({ status: "refused", reason });
  if (!validateOperationalPlanningProjection(context.projection).ok) return refuse("projection-invalid");
  if (typeof responseText !== "string") return refuse("not-a-structured-object");
  if (responseText.length > MAX_PLAN_RESPONSE_CHARS) return refuse("response-too-large");

  const trimmed = responseText.trim();
  const body = (WHOLE_STRING_FENCE.exec(trimmed)?.[1] ?? trimmed).trim();
  if (!body.startsWith("{") || !body.endsWith("}")) return refuse("not-a-structured-object");
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return refuse("not-a-structured-object");
  }
  if (!isObject(parsed)) return refuse("not-a-structured-object");
  if (!keysAreExactly(parsed, CANDIDATE_KEYS)) return refuse("unexpected-shape");
  if (parsed.planRef !== context.planRef) return refuse("plan-ref-mismatch");
  if (!oneOf(PLAN_UNCERTAINTY, parsed.uncertainty)) return refuse("invalid-uncertainty");
  if (!Array.isArray(parsed.steps)) return refuse("unexpected-shape");
  if (parsed.steps.length > MAX_PLAN_STEPS) return refuse("too-many-steps");

  const byAlias = new Map(context.projection.items.map((item) => [item.alias, item]));
  const seen = new Set<string>();
  const steps: OperationalPlanStep[] = [];
  for (const [index, raw] of parsed.steps.entries()) {
    if (!isObject(raw) || !keysAreExactly(raw, STEP_KEYS)) return refuse("unexpected-shape");
    if (raw.step !== index + 1) return refuse("invalid-step-number");
    if (!oneOf(PLAN_MOVES, raw.move)) return refuse("unknown-move");
    if (!oneOf(PLAN_PRIORITIES, raw.priority)) return refuse("invalid-priority");
    if (!(raw.afterStep === null || (Number.isInteger(raw.afterStep) && (raw.afterStep as number) >= 1 && (raw.afterStep as number) < index + 1))) {
      return refuse("invalid-after-step");
    }
    if (!Array.isArray(raw.items) || raw.items.length === 0) return refuse("unexpected-shape");
    if (!raw.items.every((a) => typeof a === "string" && byAlias.has(a))) return refuse("unknown-alias");
    if (new Set(raw.items).size !== raw.items.length) return refuse("duplicate-alias");
    if (!Array.isArray(raw.because) || raw.because.length === 0 || raw.because.length > MAX_PLAN_REASONS_PER_STEP) return refuse("unexpected-shape");
    if (!raw.because.every((c) => oneOf(PLAN_REASON_CODES, c))) return refuse("unknown-reason-code");
    if (new Set(raw.because).size !== raw.because.length) return refuse("unexpected-shape");

    const items = raw.items as string[];
    const because = raw.because as PlanReasonCode[];
    /* Every cited fact must be true of every item it is cited for — no fabricated evidence. */
    if (!because.every((code) => items.every((alias) => holds(code, byAlias.get(alias)!)))) return refuse("reason-not-supported");
    /* And the move must be licensed by its own fact, cited and true. */
    if (!because.includes(MOVE_REQUIRES[raw.move])) return refuse("move-not-supported");

    const key = `${raw.move}|${[...items].sort().join(",")}`;
    if (seen.has(key)) return refuse("duplicate-step");
    seen.add(key);
    steps.push({ step: raw.step as number, move: raw.move, items, because, priority: raw.priority, afterStep: raw.afterStep as number | null });
  }

  return { status: "valid", plan: { planRef: context.planRef, kind: "recommendation", steps, uncertainty: parsed.uncertainty } };
}

/* ── RENDERING — every sentence is Hebun's; the model chose only order, grouping and priority. ── */

const MOVE_SENTENCE: Readonly<Record<PlanMove, string>> = Object.freeze({
  "review-blocked": "Review the work declared blocked and decide what would unblock it.",
  "find-accountable": "Ask who should be accountable for work that names no accountable human.",
  "review-stale": `Check whether work not updated in ${STALE_AFTER_DAYS} days or more is still current.`,
  "declare-evidence": "Consider declaring what this work concerns (a Knowledge fact or a work artifact).",
});
const REASON_PHRASE: Readonly<Record<PlanReasonCode, string>> = Object.freeze({
  "state:planned": "declared planned",
  "state:active": "declared active",
  "state:blocked": "declared blocked",
  "state:complete": "declared complete",
  "accountable:true": "an accountable human is recorded",
  "accountable:false": "no accountable human is recorded",
  "stale:true": `not updated in ${STALE_AFTER_DAYS} days or more`,
  "stale:false": `updated within ${STALE_AFTER_DAYS} days`,
  "evidence:true": "a declaration of what it concerns is recorded",
  "evidence:false": "no declaration of what it concerns is recorded",
});

export const PROPOSED_PLAN_NOT_A_DECISION =
  "This is a PROPOSED plan. A model chose the order, grouping and priority; Hebun checked every reason against your organization's records and wrote every sentence. It is not a decision, an approval or work done. Nothing was proposed to Governance, approved or changed.";
export const PROPOSED_PLAN_UNAVAILABLE: readonly string[] = Object.freeze([
  PLAN_DELAY_UNAVAILABLE,
  "Unavailable: dependencies. Work records no dependency between items, so any order above is a suggestion only.",
  "Unavailable: who should own the work. Heby does not assign people.",
  "Unavailable: outcomes. Nothing above has been done.",
]);

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * A validated plan as the same `ActionPlan` shape `/plan` renders. `titleOf` is the server's own
 * alias → title lookup (the projection's alias map over this tenant's register); a model never
 * supplies a title, and an alias it cannot resolve is shown as unavailable rather than guessed.
 */
export function renderOperationalPlanCandidate(input: {
  readonly plan: ValidatedOperationalPlan;
  readonly projection: { readonly items: readonly ProjectionItem[] };
  readonly scopeLabel: string;
  readonly titleOf: (alias: string) => string | undefined;
}): ActionPlan {
  const items = input.projection.items;
  const count = (p: (i: ProjectionItem) => boolean) => items.filter(p).length;
  const lines: string[] = [
    "Current situation",
    `Fact: ${plural(items.length, "work item")} in service in ${input.scopeLabel}; declared states — ${OPERATIONAL_DECLARED_STATES.map((s) => `${s} ${count((i) => i.state === s)}`).join(", ")}. A person declared each state; Hebun observed none of them.`,
    `Fact: ${plural(count((i) => !i.accountable), "item")} name${count((i) => !i.accountable) === 1 ? "s" : ""} no accountable human.`,
    `Fact: ${plural(count((i) => i.evidenceDeclared), "item")} record${count((i) => i.evidenceDeclared) === 1 ? "s" : ""} a declaration of what it concerns.`,
    `Derived: ${plural(count((i) => i.stale), "item")} not updated in ${STALE_AFTER_DAYS} days or more.`,
    "",
    "Proposed steps — recommendations, not approved, not executed",
  ];
  if (input.plan.steps.length === 0) lines.push("Unavailable: the model proposed no step.");
  for (const s of input.plan.steps) {
    lines.push(
      `Recommendation ${s.step} · proposed priority ${s.priority} — ${MOVE_SENTENCE[s.move]}`,
      `  Items: ${s.items.map((a) => { const t = input.titleOf(a); return t === undefined ? "(title unavailable)" : `"${t}"`; }).join(", ")}.`,
      `  Checked against your records: ${s.because.map((c) => REASON_PHRASE[c]).join("; ")}.`,
      ...(s.afterStep === null ? [] : [`  Order: suggested after recommendation ${s.afterStep}. A suggestion only; Hebun records no dependency.`]),
      "  Execution: Recommendation only — Heby cannot change a work item; a person does this on the Work surface.",
    );
  }
  lines.push("", ...PROPOSED_PLAN_UNAVAILABLE, `Model uncertainty, as stated by the model and not verified: ${input.plan.uncertainty}.`, "", PROPOSED_PLAN_NOT_A_DECISION);
  return { title: `Proposed plan · ${input.scopeLabel}`, tone: "info", lines };
}
