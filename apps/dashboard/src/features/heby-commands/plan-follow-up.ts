/*
 * heby-commands/plan-follow-up.ts — HEBY-PLAN-DELEGATION-1.
 *
 * A validated AI plan recommendation can be handed to the released agent origination seam as a
 * request to PROPOSE A NEW FOLLOW-UP WORK ITEM. The goal the agent is given is one of four fixed
 * Hebun sentences, chosen by the recommendation's closed move. PURE; safe on the client.
 *
 * ── WHAT THE GOAL CARRIES ────────────────────────────────────────────────────
 *
 * Nothing but the move. No work title, description, alias, identifier, department, person, date or
 * count, and no text from the planning model. The origination model therefore learns nothing about
 * this organization's work that the AI planning disclosure boundary did not already allow it — it is
 * shown its usual `conversation` goal and `organization` structure, and the goal holds no tenant data
 * (Director decision D1, 2026-10-14). A human's confirmation does not widen that.
 *
 * ── WHAT IT NEVER DOES ───────────────────────────────────────────────────────
 *
 * It never updates, reassigns or comments on the work items the recommendation is about. The only
 * thing that can come of it is a PENDING record-work proposal for a new item, decided by a human in
 * Governance, exactly like any other origination.
 */
/*
 * The four plan moves, restated so this client-safe module imports nothing from the plan contract
 * (its one importer stays the runtime). A test pins the key set equal to `PLAN_MOVES`, and the
 * runtime's indexed read fails to type-check if a move is ever missing here.
 */
type PlanFollowUpMove = "review-blocked" | "find-accountable" | "review-stale" | "declare-evidence";

export const PLAN_FOLLOW_UP_GOALS: Readonly<Record<PlanFollowUpMove, string>> = Object.freeze({
  "review-blocked":
    "Create a follow-up task: review the work items declared blocked and find out what would unblock them.",
  "find-accountable":
    "Create a follow-up task: find out who should be accountable for the work items that have no accountable person recorded.",
  "review-stale":
    "Create a follow-up task: check whether the work items that have not changed in 30 days or more are still current.",
  "declare-evidence":
    "Create a follow-up task: find out what the work items without a declared Knowledge fact or work artifact concern, so it can be declared.",
});

/** One offer under one recommendation. `recommendation` is the number the rendered plan shows. */
export interface PlanFollowUp {
  readonly recommendation: number;
  readonly goal: string;
  /**
   * PLAN-FOLLOW-UP-REFERENCE-V1 — the server's signed statement of which work items this step named,
   * opaque to the browser and carried back unchanged. `null` when this deployment cannot sign one,
   * and the surface then says the follow-up will not be linked. Never parsed on the client.
   */
  readonly binding: string | null;
  /** How many work items the step named. A count only: no title or id reaches the browser here. */
  readonly sourceCount: number;
}

/** The label the Director fixed for this control. Never "update" — the original work is untouched. */
export const PLAN_FOLLOW_UP_LABEL = "Takip görevi oluştur";
