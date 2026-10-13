/*
 * heby-commands/action-plan.ts — HEBY ORGANIZATIONAL ACTION PLANNING (`/plan`).
 *
 * PURE. No I/O, no clock of its own. It arranges what two released authorities already said:
 *
 *   Work               `readWorkRegister`               the work this organization recorded
 *   Agent origination  `readOriginationAvailability`    whether Heby may be asked to propose work
 *
 * ── WHY NO MODEL ─────────────────────────────────────────────────────────────
 *
 * Work records are not disclosed to the external model (EAI-B2: assistance may carry conversation,
 * Knowledge and work artifacts only). A model asked to plan over withheld work would plan over
 * nothing, or invent. So the plan is Hebun's own RULE-BASED reading, labelled as such, and every line
 * says which kind of statement it is:
 *
 *   Fact            stated by an authority's record (declared by a human where the record says so)
 *   Derived         computed by Hebun from those records (an elapsed time) — not a judgement
 *   Recommendation  what Hebun suggests a person consider; never done, never approved
 *   Unavailable     what no record can answer, said instead of guessed
 *
 * A plan is not a decision, an approval or work done. Nothing here proposes, approves or executes;
 * the one action Hebun can carry is the released proposal path, which still needs a human
 * Governance decision, and its availability is the origination projection's answer, not this file's.
 */
import type { WorkItemView, WorkRegister } from "@/features/organizational-work/read-work.server";
import type { AgentOriginationAvailability } from "@/features/origination-availability/contracts";
import { describeOriginationForGrounding } from "@/features/origination-availability/capability-truth";

/** Work untouched this long is shown as not recently updated. A display threshold, not a deadline. */
export const STALE_AFTER_DAYS = 30;
/** How many titles one finding lists before it says how many more there are. */
export const PLAN_EVIDENCE_TITLES = 5;

export const PLAN_NOT_A_DECISION =
  "This plan is Hebun's rule-based reading of recorded work. It is a recommendation, not a decision, an approval or work done. Nothing was proposed, approved or changed.";
export const PLAN_NO_MODEL =
  "No model wrote this plan: work records are not disclosed to the external model under the data-use policy, so every line comes from Hebun's own reading of the records.";
export const PLAN_DELAY_UNAVAILABLE =
  "Unavailable: delay status. Hebun records no due date or deadline for work items, so no item can be called late or overdue.";
export const PLAN_PROVENANCE =
  "Organizational Work register (declared by people) and the agent origination availability check, read now for your organization only. Rule-based; no model.";

export interface ActionPlan {
  readonly title: string;
  readonly lines: readonly string[];
  readonly tone: "info" | "unavailable";
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function evidence(items: readonly WorkItemView[]): string {
  const shown = items.slice(0, PLAN_EVIDENCE_TITLES).map((item) => `"${item.title}"`);
  const more = items.length - shown.length;
  return `Evidence: ${shown.join(", ")}${more > 0 ? ` and ${more} more` : ""}.`;
}

/** The `/plan` department filter: `wanted` is the scope trimmed and lower-cased. Shared with the operational planning projection. */
export const matchesDepartment = (item: WorkItemView, wanted: string) =>
  item.department !== null && item.department.name.trim().toLowerCase() === wanted;

/** Derived: no change for `STALE_AFTER_DAYS` or more, from the record's last change time. Shared with the operational planning projection. */
export const isStale = (item: WorkItemView, now: Date) =>
  now.getTime() - new Date(item.updatedAt).getTime() >= STALE_AFTER_DAYS * 24 * 60 * 60 * 1000;

export function composeActionPlan(input: {
  readonly scope: string;
  readonly register: WorkRegister;
  readonly availability: AgentOriginationAvailability;
  readonly now: Date;
}): ActionPlan {
  const wanted = input.scope.trim().toLowerCase();
  const scopeLabel = wanted ? input.scope.trim() : "the whole organization";
  const title = `Action plan · ${wanted ? input.scope.trim() : "Organization"}`;

  if (input.register.status === "unavailable") {
    return {
      title,
      tone: "unavailable",
      lines: [
        `Unavailable: this organization's work could not be read right now (${input.register.detail}).`,
        "No plan is shown, because a plan without the records would be invented. Nothing was changed.",
      ],
    };
  }

  const all = input.register.items;
  const scoped = wanted ? all.filter((item) => matchesDepartment(item, wanted)) : all;
  const truncation = input.register.truncated
    ? ` The register shows only the most recent ${all.length} work items; older work is not in this plan.`
    : "";
  const inService = scoped.filter((item) => item.inService);
  const open = inService.filter((item) => item.declaredState !== "complete");

  const lines: string[] = [`Objective: review ${wanted ? `${scopeLabel} work` : "this organization's work"} in service and decide what needs attention.`, ""];

  lines.push("Current situation");
  if (scoped.length === 0) {
    lines.push(
      wanted
        ? `Fact: no work item in this organization's register names a department called "${scopeLabel}".${truncation}`
        : `Fact: this organization has recorded no work.${truncation}`,
      PLAN_DELAY_UNAVAILABLE,
      "",
      "Recommended priorities",
      "None. There is no recorded work here to plan from, and Hebun does not invent work to fill the gap.",
      "",
      PLAN_NOT_A_DECISION,
    );
    return { title, tone: "info", lines };
  }

  const count = (state: string) => inService.filter((item) => item.declaredState === state).length;
  const unowned = open.filter((item) => item.accountableActorId === null);
  const ownerInactive = open.filter((item) => item.accountableActorId !== null && item.accountableCurrentlyActiveMember === false);
  const blocked = open.filter((item) => item.declaredState === "blocked");
  const stale = open.filter((item) => isStale(item, input.now));

  lines.push(
    `Fact: ${plural(inService.length, "work item")} in service${wanted ? ` name the ${scopeLabel} department` : ""}; ${scoped.length - inService.length} retired.${truncation}`,
    `Fact: declared states — planned ${count("planned")}, active ${count("active")}, blocked ${count("blocked")}, complete ${count("complete")}. A person declared each state; Hebun observed none of them.`,
    `Fact: ${plural(unowned.length, "open item")} name${unowned.length === 1 ? "s" : ""} no accountable human; ${plural(ownerInactive.length, "open item")} name${ownerInactive.length === 1 ? "s" : ""} one who is not an active member.`,
    `Derived: ${plural(stale.length, "open item")} not updated in ${STALE_AFTER_DAYS} days or more (from each record's last change time).`,
    PLAN_DELAY_UNAVAILABLE,
    "",
    "Recommended priorities",
  );

  const MANUAL = "Execution: Recommendation only — Heby cannot change a work item; a person does this on the Work surface.";
  let priority = 0;
  const step = (heading: string, items: readonly WorkItemView[], dependency: string, authority: string, execution: string) =>
    lines.push(
      `Priority ${++priority} — ${heading}`,
      `  ${evidence(items)}`,
      `  Dependency: ${dependency}`,
      `  Required authority: ${authority}`,
      `  ${execution}`,
    );

  if (blocked.length > 0) {
    step(
      `Review the ${plural(blocked.length, "item")} declared blocked and record what blocks ${blocked.length === 1 ? "it" : "them"}.`,
      blocked,
      "none — this comes first, because blocked work holds the rest back.",
      "the accountable human for each item, or a person who may update work.",
      MANUAL,
    );
  }
  const needsOwner = [...unowned, ...ownerInactive];
  if (needsOwner.length > 0) {
    step(
      `Name an active accountable human for ${plural(needsOwner.length, "open item")}.`,
      needsOwner,
      blocked.length > 0 ? "after the blocked review, since a blocker often needs an owner to clear it." : "none.",
      "a person who may update work. Accountability is attribution; it grants no authority.",
      MANUAL,
    );
  }
  if (stale.length > 0) {
    step(
      `Confirm the declared state of ${plural(stale.length, "item")} not updated in ${STALE_AFTER_DAYS}+ days.`,
      stale,
      "none.",
      "the accountable human for each item.",
      MANUAL,
    );
  }
  if (priority === 0) {
    lines.push("No open item is declared blocked, missing an active owner, or untouched for a month. Hebun has nothing to prioritize from these records.");
  }

  lines.push(
    "",
    "Proposing new work",
    "  If this review shows work that is not yet recorded, it can be proposed as organizational work.",
    "  Required authority: a human with Governance authority decides each proposal in Approvals.",
    `  Execution availability: ${describeOriginationForGrounding(input.availability)} Use "Propose as organizational work…" under your own Heby message; nothing is proposed from this plan automatically.`,
    "",
    PLAN_NOT_A_DECISION,
    PLAN_NO_MODEL,
  );
  return { title, tone: "info", lines };
}
