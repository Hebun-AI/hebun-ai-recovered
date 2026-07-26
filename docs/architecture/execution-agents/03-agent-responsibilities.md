# 03 — Agent Responsibilities

## Purpose

Agent Responsibilities define **what an execution agent is accountable for** — the positive duties every agent owes, whatever work it performs. Where [Agent Boundaries](04-agent-boundaries.md) states what an agent must not do, this states what an agent must do. Together they fully bound the agent's role.

## Architectural role

Agent Responsibilities make the [agent principles](01-agent-principles.md) concrete as duties, defining the agent's charter within the coordinated execution ([Phase 8B](../execution-orchestration/README.md)). They are what orchestration relies on every agent to deliver — the reason orchestration can distribute work and trust it will be performed and reported faithfully.

## The responsibilities

### Receive and accept approved work
An agent accepts assigned tasks from orchestration, confirming each is approved and within its capability. It takes ownership of performing exactly that work.

### Execute assigned tasks faithfully
The agent's central duty: perform the assigned task as specified, in full, without deviation. Faithful execution is what the agent exists to deliver.

### Honor committing-action gates
Where an assigned task includes a committing action, the agent performs it only within the Director's approval, never beyond it. The agent is responsible for respecting the gate at the point of action.

### Communicate status
The agent keeps orchestration informed of its state — accepted, running, blocked, done — so the coordinated execution stays coherent ([agent communication](05-agent-communication.md)). Silence is not an option; an agent is responsible for being visible.

### Report progress, failures, and completion
The agent reports what it is doing, what has gone wrong, and how its task concluded — honestly and promptly ([agent reporting](06-agent-reporting.md)). Reporting is a first-class responsibility, not a courtesy.

### Preserve traceability
Every action the agent takes is recorded, contributing to the complete execution trace. The agent is responsible for its own accountability.

### Respect orchestration and Director control
The agent accepts orchestration's coordination — assignment, synchronization, reassignment — and the Director's control — interruption, cancellation. It does not override them. Obedience within the coordinated execution is a standing responsibility.

## Inputs

- The **assigned, approved task(s)**.
- **Orchestration coordination** and **Director control** signals.

## Outputs

- **Faithfully executed work** — the discharge of the agent's central duty.
- **Status, progress, failure, and completion reports** — the discharge of its reporting duties.
- A **traceable record** of its actions.

## Boundaries

- These are **duties, not powers** — an agent is responsible for performing and reporting, not for deciding, planning, or coordinating ([agent boundaries](04-agent-boundaries.md)).
- They **define no method** and **no concrete agent** — this document establishes what an agent is responsible for, not how it fulfills it or what specific agent it is.

## Future direction

Future agents may discharge these responsibilities across more domains and more capably — but the responsibilities are fixed: accept approved work, execute faithfully, honor gates, communicate, report honestly, stay traceable, respect orchestration and control. Capability grows; the charter holds.
