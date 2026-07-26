# 05 — Agent Communication

## Purpose

Agent Communication defines **how an execution agent exchanges status and signals with orchestration** — the channel through which an agent stays visible and directable within the coordinated execution. An agent that performed work in silence would be uncoordinatable; communication is what makes an agent a participant in a coherent multi-agent execution rather than an isolated actor.

## Architectural role

Agent Communication is the agent's interface to [Execution Orchestration](../execution-orchestration/README.md). It carries the agent's status *up* to orchestration and orchestration's coordination and control signals *down* to the agent. It underpins [Agent Reporting](06-agent-reporting.md) (reporting is communication of outcomes) and enables orchestration's coordination, synchronization, and control. It defines the *shape* of the exchange, not its transport.

## What an agent communicates

### Status (upward)
The agent's current state — accepted, running, blocked, done — so orchestration knows where the agent stands and can coordinate accordingly.

### Hand-off information (upward)
Where an agent's completed task feeds another's, the agent communicates its result to orchestration, which routes it onward ([agent coordination](../execution-orchestration/03-agent-coordination.md)) — the agent hands *to orchestration*, not directly to another agent (an agent coordinates no one).

## What an agent receives

### Coordination signals (downward)
Assignments, synchronization waits, and reassignments from orchestration. The agent accepts and acts on these within its role.

### Control signals (downward)
Interruption and cancellation, originating from the Director through orchestration ([Phase 8A control](../director-execution/04-execution-control.md)). The agent respects these immediately and does not override them.

## Inputs

- **Orchestration signals** — coordination and control directed to the agent.
- The **agent's own state** — what it needs to communicate upward.

## Outputs

- **Status and hand-off communication** — the agent's state and results, sent to orchestration.
- **Acknowledged signals** — the agent's compliance with coordination and control.
- A **communication record** — the exchange, for traceability.

## Boundaries

- Communication is **with orchestration, not peer-to-peer** — an agent communicates its status and results *to orchestration*, which coordinates; an agent does not direct or coordinate another agent by communicating with it ([agent boundaries](04-agent-boundaries.md)).
- It **communicates faithfully** — the agent's true state and results, never misrepresented ([honest reporting](06-agent-reporting.md)).
- It **carries information; it does not carry commands to peers** — an agent issues no coordinating instruction to another agent.
- It **defines no method** and **no protocol** — this document establishes that agent communication exists and its shape, not any transport or messaging mechanism.

## Future direction

Future agents may communicate more richly — finer status, richer hand-off information, more responsive control handling. The discipline is fixed: communicate faithfully with orchestration, accept coordination and control, never coordinate peers. Richness grows; the orchestration-mediated, honest communication holds.
