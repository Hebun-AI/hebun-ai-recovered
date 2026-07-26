# Execution Agents — Architecture (Phase 8C)

## Purpose

**Execution Agents** are the performers of approved work — the components that actually carry out the tasks of a Director-approved plan. Phase 8A defined *how execution works*; Phase 8B defined *how execution is orchestrated across agents*. Phase 8C defines the **architectural contract shared by every execution agent** — what an execution agent *is*, the rules every agent obeys regardless of what specific work it performs.

This phase defines the **agent contract**, not any concrete agent. No specific agent (its domain, its tools, its tasks) is defined here — that is a later, gated concern. What is defined is the shared frame every execution agent must fit.

It is **architecture only**. No implementation, no runtime, no prompts, no algorithms, no concrete agent definitions.

## Relationship with Phase 8A

Phase 8A ([director-execution](../director-execution/README.md)) defined execution itself — faithful, bounded, traceable, controllable, honest performance of approved work. Execution Agents are the **components that embody those execution principles**. Every agent obeys the 8A execution principles as its own contract: it executes only approved work, faithfully, without deciding, honoring gates, staying traceable and controllable. 8A defined the rules of execution; 8C defines the performer that follows them.

## Relationship with Phase 8B

Phase 8B ([execution-orchestration](../execution-orchestration/README.md)) defined how multiple agents are coordinated — distribution, coordination, synchronization, recovery. Execution Agents are the **coordinated performers** that orchestration directs. An agent receives its assigned work from orchestration, performs it, reports back, and respects orchestration's coordination. 8B defined the conductor; 8C defines the players.

## Role of Execution Agents

```
Execution Orchestration (8B)   — distributes approved work, coordinates agents
        │  assigned tasks
        ▼
   Execution Agent (8C)   ← this phase (the shared contract)
   (receives approved work, executes assigned tasks faithfully,
    reports status, respects orchestration — reasons nothing, coordinates no one)
        │  status, progress, failures, completion
        ▲
Execution Orchestration (8B)   — aggregates, recovers, surfaces to the Director
```

An Execution Agent is a bounded performer: it takes assigned, approved tasks, carries them out faithfully, and reports back. It holds no plan of its own, forms no judgment, and directs no other agent. It is a single, obedient pair of hands within a coordinated execution.

## Why agent architecture is separate from orchestration

- **Performer vs coordinator.** Orchestration coordinates; agents perform. An agent that also coordinated other agents would hold authority over them and blur the separation 8B depends on. Each agent is a performer only.
- **Shared contract vs specific coordination.** 8B defined *how agents are directed*; 8C defines *what every agent must be* to be directable. Separating the contract from the coordination lets many different agents (defined later) all fit one frame, and lets orchestration treat them uniformly.
- **Boundaries at the performer.** The agent is where work meets the world. Defining its boundaries explicitly — no reasoning, no re-planning, no coordinating others, no bypassing authority — is what keeps the acting component from exceeding its role, however capable it becomes.
- **Uniformity enables scale.** Because every agent obeys the same contract, orchestration can distribute work across many agents without special-casing each. The shared contract is what makes multi-agent execution coherent.

## Documents

| Document | Topic |
|---|---|
| [01 — Agent Principles](01-agent-principles.md) | The principles every agent obeys |
| [02 — Agent Lifecycle](02-agent-lifecycle.md) | The stages of an agent performing work |
| [03 — Agent Responsibilities](03-agent-responsibilities.md) | What an agent is responsible for |
| [04 — Agent Boundaries](04-agent-boundaries.md) | What an agent must never do |
| [05 — Agent Communication](05-agent-communication.md) | How an agent communicates with orchestration |
| [06 — Agent Reporting](06-agent-reporting.md) | How an agent reports progress, failure, completion |
| [07 — Future Evolution](07-future-evolution.md) | How the agent contract deepens |

Each document defines: **purpose, architectural role, inputs, outputs, boundaries, and future direction.**

## What Execution Agents must always do

- **Receive approved work** — assigned by orchestration from the Director-approved plan.
- **Execute assigned tasks faithfully** — exactly the assigned work, nothing more.
- **Communicate status** and **report progress, failures, and completion**.
- **Preserve traceability** — every action the agent takes is recorded.
- **Respect orchestration** — accept coordination; do not override it.
- **Never redesign plans** — perform the task; do not change it.
- **Never reason** — perform; do not form judgment.
- **Never coordinate other agents** — an agent directs no one.
- **Never bypass Director Authority** — committing actions stay within the Director's approval.

## Status

Architecture only — the agent contract, not any concrete agent and not an implementation. Concrete agents, contracts, and runtime — should they be built — follow the [Capability Lifecycle](../../architecture-backlog/00-capability-lifecycle.md) behind the Director gate. Nothing here is implemented.
