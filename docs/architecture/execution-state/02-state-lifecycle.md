# 02 — State Lifecycle

## Purpose

The State Lifecycle describes **the conditions an execution's state passes through** — the arc from an execution beginning to its conclusion, including the pauses, resumes, and recoveries that make long-running execution possible. Where the execution lifecycle ([Phase 8A](../director-execution/02-execution-lifecycle.md)) ordered the *doing*, the state lifecycle describes the *conditions the execution is in* as it is done.

## Architectural role

The State Lifecycle is the frame the other state topics operate within — [Checkpoint & Recovery](04-checkpoint-recovery.md) captures and restores states, [State Transitions](05-state-transitions.md) governs movement between them. It reflects execution's control capabilities ([Phase 8A control](../director-execution/04-execution-control.md)) as states: interruption produces a paused state, cancellation a cancelled state, failure a recoverable state. It represents the conditions; it does not drive them (execution and orchestration do).

## The state conditions

```
Initialized   — state created for an approved execution; context established
   ↓
Active        — execution running; state advances as work is done
   ↓  (interruption)                    ↕  (checkpoint / recover)
Paused        — execution halted, state preserved, resumable
   ↓  (resume)
Active        — execution continues from the preserved state
   ↓
Concluded     — execution ended: completed, failed, or cancelled;
                final state recorded
```

An execution's state moves through these conditions — active while running, paused when interrupted, resumed back to active, and concluded at the end — with checkpoints taken along the way to make recovery possible.

## Condition meanings

- **Initialized.** State is created for a Director-approved execution, with its context (task, scope, approval, correlation) established.
- **Active.** Execution is running; state advances faithfully as agents and tools do work.
- **Paused.** Execution is interrupted; state is preserved intact and resumable — the execution is held, not lost ([checkpoint & recovery](04-checkpoint-recovery.md)).
- **Concluded.** Execution has ended — completed, failed, or cancelled — and the final state, with its full history, is recorded.

## Inputs

- The **execution's condition and events** — starts, progress, interruptions, resumes, failures, conclusion.
- The **context** the execution carries.

## Outputs

- A **faithful current state** — the execution's condition at any point.
- **Preserved resumable states** — paused and checkpointed states that support continuity.
- The **final recorded state** — the execution's conclusion, with history.

## Boundaries

- The state lifecycle **represents conditions; it does not drive execution** — execution and orchestration cause the transitions; state reflects them ([state principles](01-state-principles.md)).
- It **preserves the plan and approval** — a resumed execution continues the same approved plan in the same context.
- It **defines no method or storage** — this document establishes that the state lifecycle exists and its conditions, not how state is stored or serialized.

## Future direction

Future state handling may represent conditions more finely — richer intermediate states, more granular pause/resume points. The arc is fixed: initialized, active, paused/resumed, concluded, with faithful preservation throughout. Fineness grows; the faithful, resumable, plan-preserving lifecycle holds.
