# Director Planning — Architecture (Phase 7D)

## Purpose

**Director Planning** is the layer that transforms an **approved recommendation** into a **structured, execution-ready plan** — without performing any execution. Phase 7A defined *why* the Director reasons; 7B defined *how* the Director thinks; 7C defined the mechanisms that realize reasoning. Phase 7D defines how validated reasoning becomes an executable plan: decomposing the goal into tasks, arranging them into a task graph, planning resources, managing dependencies, and validating the plan — all as preparation, never as action.

It is **architecture only**. No algorithms, no prompts, no runtime, no execution. It describes *how planning is structured*, not the machinery that plans or executes.

## Relationship with Phases 7A–7C

- **Phase 7A — Reasoning Philosophy.** Planning inherits reasoning's principles and its authority boundary: planning is advisory preparation, and every committing action in a plan still requires the Director's explicit approval to execute ([Director Authority](../director-reasoning/05-director-authority.md)).
- **Phase 7B — Cognitive Lifecycle.** The reasoning lifecycle ends at the Director Gate with an approved recommendation. Planning begins *after* that gate — it takes the approved judgment as its input. The seam is clean: reasoning decides *what* and *why*; planning arranges *how*.
- **Phase 7C — Reasoning Mechanisms.** Planning reuses the disciplines the mechanisms established — decomposition that preserves the whole, evidence-grounded validation, honest handling of uncertainty — applied now to constructing a plan rather than forming a judgment.

## Role of Planning inside Director Intelligence

```
Director Reasoning (7A–7C)   → approved recommendation   (what to do, why)
        │  Director approval
        ▼
Director Planning (7D)        → execution-ready plan      (how to do it)  ← this phase
        │  Director approval to execute
        ▼
Execution (future phase)      → work carried out          (outside this phase)
```

Planning is the bridge between judgment and action. Reasoning produces an approved *decision*; planning turns it into a concrete *plan of work*; execution — a later phase — runs the plan under the Director's authority. Planning occupies the middle, and it only ever *prepares*.

## Why Planning is separate from Reasoning and Execution

- **Separate from Reasoning.** Reasoning forms judgment; planning structures approved judgment into work. Mixing them would blur *deciding what to do* with *arranging how* — two distinct concerns that must be able to evolve and be reviewed independently.
- **Separate from Execution.** Planning produces a plan; execution runs it. Keeping planning execution-free is what makes a plan safe to build freely — a plan commits nothing until the Director approves its execution. If planning could execute, it would hold authority it was never granted.
- **The seam is where authority sits.** Two gates bracket planning: the Director approves the *recommendation* before planning begins, and approves *execution* before the plan runs. Planning itself is preparation between two Director decisions.

## Documents

| Document | Topic |
|---|---|
| [01 — Planning Principles](01-planning-principles.md) | The principles every plan must obey |
| [02 — Goal Decomposition](02-goal-decomposition.md) | Breaking an approved goal into tasks |
| [03 — Task Graph](03-task-graph.md) | Structuring tasks and their relationships |
| [04 — Resource Planning](04-resource-planning.md) | Matching tasks to the resources they need |
| [05 — Dependency Management](05-dependency-management.md) | Ordering and constraints between tasks |
| [06 — Plan Validation](06-plan-validation.md) | Checking a plan is sound before it is offered |
| [07 — Future Evolution](07-future-evolution.md) | How planning deepens |

Each document defines: **purpose, architectural role, inputs, outputs, boundaries, and future direction.**

## What Planning must always do

- **Consume reasoning output** — a plan is built from an approved recommendation, never invented independently.
- **Produce execution-ready plans** — structured, validated, complete enough to be executed if approved.
- **Never execute work** — planning prepares; it does not act.
- **Never bypass Director Authority** — every committing action in a plan awaits the Director's explicit approval to execute.

## Status

Architecture only — the planning architecture, not its implementation. Planning engines, contracts, and runtime — should they be built — follow the [Capability Lifecycle](../../architecture-backlog/00-capability-lifecycle.md) behind the Director gate. Nothing here is implemented.
