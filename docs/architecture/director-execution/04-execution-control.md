# 04 — Execution Control

## Purpose

Execution Control is where the **Director retains command over running execution** — the ability to interrupt, cancel, and steer work while it is being performed. Execution is not a fire-and-forget process: once started, it remains under the Director's control, able to be paused or stopped at any point. Control is what keeps the acting layer answerable to the Director throughout, not just at the moment of approval.

## Architectural role

Execution Control operates across the [Execution Lifecycle](02-execution-lifecycle.md), giving every stage a Director-facing off-switch and pause. It is the runtime-time expression of Director Authority ([Phase 7A](../director-reasoning/05-director-authority.md)): approval authorizes execution to *begin*, and control keeps the Director able to *halt* it. It works with [Monitoring](05-execution-monitoring.md) — the Director sees progress and can act on what they see.

## Control capabilities

### Interruption
Execution can be **paused** — halted mid-run and held in a safe, recorded state, resumable later. Interruption lets the Director stop the world without discarding the work, to reconsider, wait, or intervene.

### Cancellation
Execution can be **stopped** — ended before completion, deliberately and cleanly. Cancellation lets the Director call off approved work that should no longer proceed, with the partial state reported ([completion](06-execution-completion.md)).

### Safe control points
Interruption and cancellation take effect at **safe points** — execution is not left in an incoherent state. Where a committing action is mid-flight, control respects its integrity, halting cleanly rather than tearing an action in half. Control is decisive but not reckless.

## Inputs

- **Control signals** from the Director — pause, resume, cancel.
- The **current execution state** — where execution is, and what is safe to halt.

## Outputs

- **Applied control** — execution paused, resumed, or cancelled as directed.
- A **recorded control action** — every interruption and cancellation logged for traceability.
- A **reported state** at the point of control — what had completed, what had not.

## Boundaries

- Control is **the Director's** — execution never overrides a Director control signal, and never continues past a cancellation ([execution principles](01-execution-principles.md)).
- Control **halts or resumes execution; it does not re-plan or re-decide** — pausing execution does not change the plan, and resuming runs the same approved plan. Any change to *what* is done goes back through the reasoning domains.
- It **defines no method** — this document establishes that execution control exists and its capabilities, not any runtime mechanism.

## Future direction

Future execution engines may offer finer control — pausing at more granular points, steering within the approved plan's flexibility, resuming more gracefully. The capability is fixed: the Director can always interrupt and cancel, at safe points, and control never crosses into re-planning or re-deciding. Granularity grows; the Director's command holds.
