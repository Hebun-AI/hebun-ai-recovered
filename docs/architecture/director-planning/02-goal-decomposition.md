# 02 — Goal Decomposition

## Purpose

Goal Decomposition is where planning **breaks an approved goal into the tasks that achieve it**. Reasoning delivered a decision — *do this, for this reason*. Decomposition turns that decision into concrete, actionable pieces: the discrete tasks that, together, accomplish the approved goal. It is the first structuring act of planning.

## Architectural role

Goal Decomposition is the entry point of the planning topics. It takes the approved recommendation and produces the raw material — a set of tasks — that the [Task Graph](03-task-graph.md), [Resource Planning](04-resource-planning.md), and [Dependency Management](05-dependency-management.md) then structure. It reuses the discipline of reasoning's problem decomposition ([Phase 7C](../director-reasoning-mechanisms/02-problem-decomposition.md)) — break down to make actionable, but preserve the whole so no task serves itself against the goal.

It is a **structuring activity**, not execution: decomposing a goal produces a description of work, nothing more.

## Inputs

- The **approved recommendation and its goal** — what the plan must achieve.
- The **constraints and context** carried from reasoning — the bounds tasks must respect.
- The **organizational model and graph** — so tasks map to real entities, roles, and capabilities.

## Outputs

- A **set of tasks** — discrete, actionable pieces of work that together achieve the approved goal.
- For each task, its **relationship to the goal** — why it is needed — keeping the decomposition explainable.
- A note of which tasks involve **committing actions**, flagged for later gating ([planning principles](01-planning-principles.md)).

## Boundaries

- Decomposition **must preserve the whole** — the task set must serve the approved goal, never let a part optimize against it.
- It **stays within the approved decision** — decomposition does not add goals or expand scope beyond what reasoning recommended and the Director approved.
- It **produces no action** and **defines no method** — this document establishes that goal decomposition exists and its role, not any technique for splitting a goal.

## Future direction

Future planning engines may decompose goals more skilfully — finding cleaner task boundaries, mapping more precisely to organizational capabilities. The obligation is fixed: break the approved goal into faithful tasks, preserve the whole, add no unapproved scope. Skill grows; the fidelity to the approved decision holds.
