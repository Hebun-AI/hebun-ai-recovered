# Execution State & Context — Architecture (Phase 8E)

## Purpose

**Execution State & Context** is the continuity layer of execution — how the state of a running execution and the context around it are **represented, preserved, and transferred** throughout the execution lifecycle. Phase 8A defined execution, 8B its orchestration, 8C the agents, 8D the tools. Phase 8E defines what makes all of that **continuous**: the ability to pause and resume, to checkpoint and recover, to keep independent executions isolated and correlated, and to carry the approval and history that give an execution meaning.

This phase defines **architectural continuity**. It defines **no storage technology**, no databases, no memory implementation, no serialization. It describes *what execution state and context are* and *what they must support*, not how they are stored or moved.

It is **architecture only**. No runtime, no implementation, no prompts, no algorithms.

## Relationship with Execution (8A)

Phase 8A defined execution as faithful, controllable, traceable performance of an approved plan — including interruption and cancellation. Execution State is *what makes those possible*: to interrupt and resume, execution must have a preserved state to hold and return to; to complete honestly, it must have a state that records what was done. State is the substrate execution's control and traceability operate on.

## Relationship with Agents (8C)

Each agent performs assigned work through its own lifecycle; Execution State is *what an agent's progress is captured in*, so an agent's work can be paused, resumed, reassigned, or recovered. Context (task context, approval) is *what an agent carries* to perform its work faithfully and within approval. State and context give the agent continuity across interruption and its place within the larger execution.

## Relationship with Tools (8D)

A tool performs one bounded operation and returns; Execution State is *where the operation's outcome is recorded* as part of the execution's continuity, and context is *what an invocation carries* (including approval) so a tool operation happens within the right frame. Tools are stateless in themselves; the execution's state is what threads their outcomes into a coherent, recoverable whole.

## Why State & Context are separate architectural concerns

- **State is *where an execution stands*; context is *what surrounds it*.** State is the dynamic position — running, paused, at a checkpoint, recovered. Context is the frame that gives that position meaning — which task, which scope, whose approval, what history. They change independently and serve different needs, so they are modeled separately.
- **State enables continuity; context enables correctness.** State is what lets an execution survive interruption and resume faithfully. Context is what keeps a resumed execution *correct* — still within its approval, its scope, its correlation. One without the other is either meaningless (state with no context) or static (context with no state).
- **Both are passive representations.** Neither state nor context acts, reasons, or decides. They are what execution *is and carries*, held and moved by the layers above — not agents of their own.
- **Separation keeps each clean.** Continuity (state) and framing (context) are distinct problems; modeling them separately lets checkpoint/recovery reason about state and isolation/correlation reason about context, without entangling the two.

## Documents

| Document | Topic |
|---|---|
| [01 — State Principles](01-state-principles.md) | The principles execution state obeys |
| [02 — State Lifecycle](02-state-lifecycle.md) | How execution state progresses |
| [03 — Context Model](03-context-model.md) | The frame an execution carries |
| [04 — Checkpoint & Recovery](04-checkpoint-recovery.md) | Preserving and restoring state |
| [05 — State Transitions](05-state-transitions.md) | How state moves between conditions |
| [06 — Traceability & Context](06-traceability-context.md) | Continuity of the auditable record |
| [07 — Future Evolution](07-future-evolution.md) | How state & context deepen |

Each document defines: **purpose, architectural role, inputs, outputs, boundaries, and future direction.**

## What Execution State must always do

- **Preserve execution continuity** — an execution survives across time and interruption.
- **Support interruption and resume** — pause and continue without loss.
- **Support checkpointing** — capture a resumable point.
- **Support recovery** — restore from a preserved point after failure.
- **Preserve context integrity** — the frame stays correct across the execution.
- **Preserve execution history** — what happened is retained.
- **Maintain correlation across execution** — the parts of one execution stay connected.
- **Isolate independent executions** — separate executions do not bleed into each other.
- **Preserve traceability** — the whole execution is auditable end to end.
- **Never redesign plans** — state records execution; it does not change the plan.
- **Never reason** — state and context are passive; they form no judgment.
- **Never bypass Director Authority** — approval context is carried, never overridden.

## Status

Architecture only — the state and context architecture, not its implementation and not any storage. State/context representations, contracts, and runtime — should they be built — follow the [Capability Lifecycle](../../architecture-backlog/00-capability-lifecycle.md) behind the Director gate. Nothing here is implemented.
