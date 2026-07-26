# 05 — Execution Monitoring

## Purpose

Execution Monitoring is where execution **makes itself visible** — reporting progress, surfacing failures, and maintaining a complete, auditable trace of everything it does. Execution acts in the world; monitoring is what keeps that action observable, so the Director always knows what is happening, what has happened, and what has gone wrong. It is the eyes on the acting layer.

## Architectural role

Execution Monitoring runs across the [Execution Lifecycle](02-execution-lifecycle.md), feeding the Director (via the [Director Interface](../capabilities/director-interface/README.md)) and enabling [Execution Control](04-execution-control.md) — the Director steers on what monitoring shows. It realizes the traceability principle ([execution principles](01-execution-principles.md)) and, longer term, its records become organizational memory ([Phase 6](../memory/README.md)) — the durable account of what was executed and how it went.

## What monitoring reports

### Progress
Monitoring reports **what has been done and what remains** — which tasks completed, which are running, where execution stands against the plan. Progress reporting keeps execution transparent, never a black box.

### Failures
Monitoring surfaces **what went wrong** — a task that failed, a step that could not complete, a condition the plan did not hold. Failures are reported honestly and promptly, not hidden or deferred ([execution principles](01-execution-principles.md)). A surfaced failure is what lets the Director (or the reasoning domains) respond.

### Traceability
Monitoring maintains a **complete record** of execution — every action, its time, its result — so the whole run can be reconstructed and audited. Traceability is the standing account; progress and failure reporting are its live surface.

## Inputs

- The **execution state and events** — task starts, completions, failures, control actions.
- The **plan** execution is running against — the baseline progress is measured relative to.

## Outputs

- **Progress reports** — the current state of execution against the plan.
- **Failure reports** — problems surfaced with enough context to act on.
- A **complete execution trace** — the auditable record of the run.

## Boundaries

- Monitoring **observes and reports; it does not act or decide**. It surfaces a failure; responding to it is the Director's or the reasoning domains' job, not monitoring's ([execution boundaries](03-execution-boundaries.md)).
- It **reports honestly** — no hidden failures, no overstated progress, no fabricated completion.
- It **defines no method** — this document establishes that execution monitoring exists and its role, not any telemetry or runtime mechanism.

## Future direction

Future execution engines may monitor more richly — finer progress, earlier failure detection, deeper traces feeding learning ([Phase 6](../memory/README.md), [Learning Engine](../../architecture-backlog/19-learning-engine.md)). The discipline is fixed: honest, complete, observe-and-report visibility that never crosses into acting or deciding. Richness grows; the honesty and the observe-only stance hold.
