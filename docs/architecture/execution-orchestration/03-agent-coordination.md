# 03 — Agent Coordination

## Purpose

Agent Coordination is where orchestration **keeps the execution agents working together coherently** — ensuring that agents performing parts of one plan act as a coordinated whole rather than in isolation. Work Distribution assigned each agent its tasks; coordination is what makes the collection of agents behave as one execution of one plan.

## Architectural role

Agent Coordination sits between [Work Distribution](02-work-distribution.md) and [Execution Synchronization](04-execution-synchronization.md) — distribution decides *who does what*, coordination manages *how they work together*, synchronization manages *when*. It directs the agents' collaboration: handing off between agents where one task's result feeds another, keeping agents aware of shared context, and maintaining a coherent overall execution. It coordinates the agents; it never performs their work.

## Inputs

- The **task assignments** from Work Distribution.
- The **plan's inter-task relationships** — where one agent's task connects to another's.
- **Agent status** — which agents are active, ready, or blocked (agents defined in a later phase).

## Outputs

- **Coordinated collaboration** — agents working as one coherent execution, with hand-offs managed where tasks connect.
- **Managed hand-offs** — one agent's completed output routed as another's input, intact ([faithful information flow](../director-orchestration/03-information-flow.md), applied to execution).
- A **coordination record** — the collaboration and hand-offs, for traceability.

## Boundaries

- Coordination **directs collaboration; it does not perform tasks**. It manages how agents work together; the agents do the work ([orchestration principles](01-orchestration-principles.md)).
- It **routes hand-offs faithfully** — an agent's output passes to the next intact; coordination never alters or reinterprets it.
- It **performs no reasoning or decision** — where agents' collaboration hits something unplanned, coordination reports or applies the approved recovery, never decides ([failure recovery](05-failure-recovery.md)).
- It **defines no method** and **no specific agents** — this document establishes that agent coordination exists and its role, not any coordination protocol or agent definition.

## Future direction

Future orchestration engines may coordinate agents more richly — managing more complex collaborations, richer hand-offs, larger agent sets. The discipline is fixed: coordinate collaboration faithfully, route hand-offs intact, perform no work and no reasoning. Richness grows; the coordinate-not-perform boundary holds.
