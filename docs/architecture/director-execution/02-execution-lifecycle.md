# 02 — Execution Lifecycle

## Purpose

The Execution Lifecycle is the **ordered progression of performing approved work** — from receiving an approved plan to reporting its completion. Where the reasoning lifecycle ([Phase 7B](../director-reasoning-cognition/README.md)) ordered *thinking*, the execution lifecycle orders *doing*: admitting the plan, carrying out its tasks in their planned order, and concluding. It is the backbone the other execution topics operate within.

## Architectural role

The Execution Lifecycle defines *how execution proceeds* while [Execution Control](04-execution-control.md), [Monitoring](05-execution-monitoring.md), and [Completion](06-execution-completion.md) operate across it. It respects the structure the plan already carries — the task graph and dependencies from planning ([Phase 7D](../director-planning/03-task-graph.md)) — executing tasks in the order the plan specifies. It performs the lifecycle; it does not design it (the plan did).

## The lifecycle

```
Admission        — receive the approved, verified plan; confirm approval and readiness
   ↓
Preparation      — arrange to run the plan as approved (no re-planning)
   ↓
Execution        — perform the plan's tasks in their planned order,
                   honoring dependencies and committing-action gates
   ↓
Completion       — conclude and report the outcome
```

At every step, execution can be interrupted or cancelled ([execution control](04-execution-control.md)), and progress and failures are reported ([monitoring](05-execution-monitoring.md)).

## Stage meanings

- **Admission.** Execution accepts the plan only if it arrives Director-approved and verification-passed. An unapproved or unverified plan is refused, not run ([execution principles](01-execution-principles.md)).
- **Preparation.** Execution readies itself to carry out the plan *as approved* — never re-planning, never altering scope.
- **Execution.** The plan's tasks are performed in their planned order, dependencies honored, and each committing action performed only within the Director's approval.
- **Completion.** Execution concludes — successfully, partially, or halted — and reports the outcome ([completion](06-execution-completion.md)).

## Inputs

- The **Director-approved, verified plan** — including its task graph, dependencies, and committing-action markers.
- The **Director's approval** authorizing execution.

## Outputs

- **Executed work** — the plan's tasks performed, in order, within approval.
- **Progression state** — where in the lifecycle execution currently is, recorded for traceability.
- The **inputs to monitoring and completion** — progress, failures, and the final outcome.

## Boundaries

- The lifecycle **performs the plan; it does not redesign it** — task order and scope come from the plan, not from execution ([execution principles](01-execution-principles.md)).
- It **honors the gates** — no committing action runs outside the Director's approval.
- It **is interruptible throughout** — no stage is beyond the Director's control.
- It **produces no method** — this document establishes that the execution lifecycle exists and its ordered stages, not any scheduling or runtime mechanism.

## Future direction

Future execution engines may run the lifecycle more capably — handling parallelism, retries, and partial progress more gracefully. The order is fixed: admit only approved-and-verified plans, prepare without re-planning, execute faithfully in planned order, complete and report. Capability grows; the faithful, gated, interruptible progression holds.
