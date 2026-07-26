# 06 — Plan Validation

## Purpose

Plan Validation is where planning **checks that a plan is sound before it is offered to the Director**. A plan that is malformed — with a dependency cycle, an unmet resource need, a constraint violation, or a task that does not serve the goal — must never be presented as execution-ready. Validation is the gate between a draft plan and a plan the Director can be asked to approve.

## Architectural role

Plan Validation is the final planning topic before a plan leaves the layer. It examines the whole plan — the [Task Graph](03-task-graph.md), its [dependencies](05-dependency-management.md), and its [resources](04-resource-planning.md) — against the [Planning Principles](01-planning-principles.md), and certifies the plan as sound or rejects it. It is the planning analogue of graph validation ([Phase 5B](../graph-validation/README.md)): whole-plan invariants that must hold before the plan is trusted. Reasoning consumes only validated graphs; the Director is offered only validated plans.

## Inputs

- The **complete draft plan** — tasks, task graph, dependencies, and resource annotations.
- The **planning principles** and the **constraints** the plan must satisfy.
- The **approved recommendation**, to confirm the plan still serves the approved goal.

## Outputs

- A **validity verdict** — sound or not, as a whole.
- Where invalid, the **specific violations** — a dependency cycle, a resource shortfall, a constraint breach, a task off-goal — surfaced so the plan can be corrected.
- A **validated, execution-ready plan** when sound — the form offered to the Director for execution approval.

## Validation invariants (illustrative)

A sound plan, at minimum:

- **Serves the approved goal** — every task traces to the recommendation; no unapproved scope.
- **Has an acyclic dependency structure** — the plan can actually start and finish.
- **Is resource-feasible** — required resources are available within constraints, or shortfalls are flagged, not hidden.
- **Respects all constraints** — governance, workspace scope, obligations.
- **Marks all committing actions** — every gated action is flagged for Director approval at execution.

## Boundaries

- Validation **judges soundness; it does not fix or execute**. It reports what is wrong; correction is a planning act, execution is a later phase.
- It **never certifies an unsound plan** — offering a broken plan for approval would ask the Director to authorize broken work.
- It **defines no method** — this document establishes that plan validation exists, its role, and the kind of invariants it checks, not any validation algorithm.

## Future direction

Future planning engines may validate plans more thoroughly — checking richer invariants, detecting subtler infeasibilities. The obligation is fixed: only sound, goal-faithful, constraint-respecting plans reach the Director, with committing actions marked. Thoroughness grows; the "only validated plans are offered" rule holds.
