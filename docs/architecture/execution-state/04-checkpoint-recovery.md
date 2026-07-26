# 04 — Checkpoint & Recovery

## Purpose

Checkpoint & Recovery defines **how an execution's state is captured at resumable points and restored after interruption or failure**. Long-running execution cannot assume it runs to completion in one unbroken stretch — it may be paused, may fail, may need to continue later. Checkpointing captures a point to return to; recovery returns to it. Together they make execution durable across interruption and failure.

## Architectural role

Checkpoint & Recovery operates over the [State Lifecycle](02-state-lifecycle.md) and [Context Model](03-context-model.md): a checkpoint captures both the execution's state and its context, and recovery restores both, so a resumed execution continues correctly and within approval. It is what makes the interruption, resume, retry, and recovery that execution and orchestration rely on ([Phase 8A control](../director-execution/04-execution-control.md), [8B failure recovery](../execution-orchestration/05-failure-recovery.md)) actually possible — those layers *invoke* continuity; this layer *provides* it.

## Checkpointing

A **checkpoint** captures a coherent, resumable point of an execution — its state (where it stands) and its context (its frame, including approval and history) — so the execution can later continue from exactly there. A checkpoint is a faithful snapshot: what it captures is what the execution actually was at that point, nothing invented.

## Recovery

**Recovery** restores an execution from a checkpoint — bringing back its state and context so it can resume. Recovery is used after interruption (resume from a pause) or failure (retry from the last good point). A recovered execution continues the **same approved plan**, in the **same context**, within the **same approval** — recovery never resumes an execution beyond what was approved, and never redesigns the plan to work around the failure.

## Inputs

- The **execution's state and context** at the point to capture.
- A **recovery request** — resume after pause, or retry after failure — and the checkpoint to restore from.

## Outputs

- **Checkpoints** — captured resumable points of state and context.
- **Recovered executions** — state and context restored, ready to continue faithfully.
- A **checkpoint/recovery record** — every capture and restore, for traceability.

## Boundaries

- Checkpoint & Recovery **preserves and restores; it does not change** — a recovered execution runs the same plan, same context, same approval ([state principles](01-state-principles.md)). It never re-plans or re-approves.
- It **captures faithfully** — a checkpoint reflects the true state, never a fabricated or optimistic one.
- It **respects approval and isolation** — recovery restores the original approval context and never crosses into another execution or tenant.
- It **defines no method or storage** — this document establishes that checkpoint and recovery exist and their role, not how state is snapshotted, stored, or serialized.

## Future direction

Future state handling may checkpoint and recover more capably — finer-grained checkpoints, faster recovery, smarter retry from the nearest good point. The discipline is fixed: faithful capture, restore the same plan/context/approval, never re-plan, respect isolation. Capability grows; the faithful, approval-preserving recovery holds.
