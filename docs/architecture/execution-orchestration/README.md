# Multi-Agent Execution Orchestration — Architecture (Phase 8B)

## Purpose

**Execution Orchestration** is the layer that **coordinates multiple execution agents** performing approved work. Phase 8A defined *how approved work is executed* — the principles, lifecycle, control, and monitoring of execution. Phase 8B defines *how several agents collaborate* to perform that work: distributing the approved plan's tasks across agents, preserving execution ordering, synchronizing parallel work, recovering from failures, and keeping the whole traceable — all while preserving Director Authority and the execution principles.

It is **architecture only**. No algorithms, no prompts, no runtime, no specific agent definitions (agents are a later phase). It describes *how execution is coordinated across agents*, not the machinery that coordinates or the agents that execute.

## Relationship with Phase 8A

Phase 8A ([director-execution](../director-execution/README.md)) defined execution itself — faithful performance of a Director-approved, verified plan, bounded, traceable, controllable, honest. Phase 8B is the **coordination layer over multiple executors** of that plan. It inherits every 8A principle and applies it across agents: the approved plan is still the only subject, execution is still faithful, committing actions still respect Director approval — now with the added concern of *many agents doing the work at once*.

8A is single-executor execution; 8B is the coordination that lets many execution agents perform one approved plan together.

## Role of Execution Orchestration

```
Director Intelligence (Phase 7)  → approved, verified plan  → Director approval
                                          │
                                          ▼
   Execution Orchestration (8B)   ← this phase
   (distributes the plan across agents, orders and synchronizes them,
    recovers from failures, traces — coordinates; executes nothing itself)
        │            │            │
        ▼            ▼            ▼
   Execution     Execution     Execution     ← agents (defined in a later phase)
    Agent A       Agent B       Agent C       perform the actual work, per 8A
```

Execution Orchestration is the conductor of the execution agents. It holds the approved plan, hands each agent the right work in the right order, keeps parallel work coherent, and handles what happens when an agent fails — but it never performs the work itself. The agents execute; orchestration coordinates.

## Why Execution Orchestration is separate from execution itself

- **A coordinator, not an executor.** Execution Orchestration holds no work of its own. It distributes and sequences work performed by the agents; it never performs a task. Folding coordination into an executing agent would give that agent authority over the others and blur the separation.
- **Different concern.** 8A concerns *performing* work faithfully; 8B concerns *coordinating multiple performers* of it. Distribution, synchronization, and multi-agent failure recovery are distinct problems from execution itself, and separating them keeps each clean.
- **The boundaries carry over and up.** Because orchestration coordinates rather than executes, it inherits execution's boundaries and adds none of its own reasoning: it never reasons, plans, decides, verifies, redesigns the plan, or executes work directly. It coordinates approved execution and nothing more.
- **Authority stays upstream.** Orchestration distributes only Director-approved work, and every committing action an agent performs still respects the Director's approval. Orchestration never bypasses Director Authority — coordinating many executors does not create new authority.

## Documents

| Document | Topic |
|---|---|
| [01 — Orchestration Principles](01-orchestration-principles.md) | The principles execution orchestration obeys |
| [02 — Work Distribution](02-work-distribution.md) | Assigning approved work to agents |
| [03 — Agent Coordination](03-agent-coordination.md) | Coordinating agents' collaboration |
| [04 — Execution Synchronization](04-execution-synchronization.md) | Ordering and synchronizing parallel work |
| [05 — Failure Recovery](05-failure-recovery.md) | Detecting failures and recovering |
| [06 — Orchestration Monitoring](06-orchestration-monitoring.md) | Visibility across all agents |
| [07 — Future Evolution](07-future-evolution.md) | How execution orchestration deepens |

Each document defines: **purpose, architectural role, inputs, outputs, boundaries, and future direction.**

## What Execution Orchestration must always do

- **Coordinate execution agents** — direct multiple agents performing one approved plan.
- **Distribute approved work** — hand each agent the right tasks from the approved plan.
- **Preserve execution ordering** — honor the plan's dependencies across agents.
- **Synchronize parallel execution** — keep concurrent work coherent.
- **Detect execution failures** — notice when an agent fails.
- **Support recovery and retry strategies** — handle failures per the approved plan.
- **Maintain complete traceability** — the whole multi-agent execution is auditable.
- **Preserve Director Authority** — committing actions stay gated; the Director retains control.
- **Never redesign plans** — it distributes the plan; it does not change it.
- **Never perform reasoning** — it coordinates; it does not think.
- **Never execute work directly** — the agents execute; orchestration coordinates.

## Status

Architecture only — the coordination architecture, not its implementation, and not agent design. Orchestration engines, contracts, agents, and runtime — should they be built — follow the [Capability Lifecycle](../../architecture-backlog/00-capability-lifecycle.md) behind the Director gate. Nothing here is implemented.
