# 05 — State Transitions

## Purpose

State Transitions define **how an execution moves between state conditions** — the permitted movements from one condition to another, and the rules that keep those movements valid. An execution does not jump arbitrarily between conditions; it transitions along defined paths (active → paused, paused → active, active → concluded). This document fixes those transitions so state changes are coherent and never leave an execution in an invalid condition.

## Architectural role

State Transitions govern movement across the [State Lifecycle](02-state-lifecycle.md), triggered by execution and orchestration events (an interruption, a resume, a failure, a completion). They are the rules that keep the state machine sound — every transition valid, every resulting condition coherent, every move recorded. They represent and validate the movement; they do not cause it (execution and orchestration do).

## The transitions

```
Initialized → Active        — execution begins
Active      → Paused         — interruption
Paused      → Active         — resume (from preserved state / checkpoint)
Active      → Concluded      — completion, failure, or cancellation
Paused      → Concluded      — cancellation while paused
Active      → Active         — advance as work is done (checkpoints taken)
```

Recovery re-enters **Active** from a checkpoint after a failure. No transition skips the preservation a resumable pause requires, and no transition leaves an execution in an undefined condition.

## Transition rules (illustrative)

A valid transition, at minimum:

- **Moves along a permitted path** — only the defined transitions occur; an execution never jumps to an incoherent condition.
- **Preserves state and context** — a transition to Paused preserves a resumable state; a transition to Active restores it faithfully ([checkpoint & recovery](04-checkpoint-recovery.md)).
- **Preserves approval** — no transition resumes or continues an execution beyond its approval ([context model](03-context-model.md)).
- **Is recorded** — every transition is logged, forming part of the execution history ([traceability & context](06-traceability-context.md)).
- **Is terminal at Concluded** — once concluded, an execution does not silently re-activate; continuing is a new execution or a governed recovery.

## Inputs

- The **triggering event** — interruption, resume, failure, completion, cancellation.
- The **current state and context** — what is being transitioned from.

## Outputs

- A **valid new condition** — the execution's state after the transition.
- A **transition record** — the movement logged for traceability.
- **Preserved continuity** — state and context intact across the transition.

## Boundaries

- Transitions **represent and validate movement; they do not drive execution** — the events that cause transitions come from execution and orchestration; state reflects and validates them ([state principles](01-state-principles.md)).
- They **never lose or corrupt state** — an invalid or unsafe transition is refused, not forced into an incoherent condition.
- They **preserve approval and isolation** — no transition escapes approval or crosses into another execution.
- They **define no method** — this document establishes that state transitions exist and their permitted paths, not any state-machine implementation.

## Future direction

Future state handling may support richer transitions — more intermediate conditions, finer resume points, smarter recovery re-entry. The rules are fixed: permitted paths only, state and context preserved, approval never escaped, every transition recorded, coherent at all times. Richness grows; the sound, approval-preserving transitions hold.
