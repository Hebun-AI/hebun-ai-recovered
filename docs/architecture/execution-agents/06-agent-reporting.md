# 06 — Agent Reporting

## Purpose

Agent Reporting defines **how an execution agent reports progress, failures, and completion** — the honest account each agent gives of its work. Where [Agent Communication](05-agent-communication.md) is the ongoing channel of status, reporting is the substantive content: what the agent is accomplishing, what has gone wrong, and how its task concluded. Reporting is what makes an agent's work accountable and its outcomes usable.

## Architectural role

Agent Reporting feeds [Orchestration Monitoring](../execution-orchestration/06-orchestration-monitoring.md), which aggregates every agent's reports into the unified view of the whole coordinated execution, and it contributes to the complete execution trace ([traceability](../director-execution/05-execution-monitoring.md)). An agent's reports are the raw material from which the Director's visibility and organizational memory ([Phase 6](../memory/README.md)) of the execution are built. It defines *what* an agent reports, not the mechanism.

## What an agent reports

### Progress
What the agent is accomplishing as it works — which part of its assigned task is done, in progress, or pending. Progress reporting keeps the agent's work transparent within the larger execution.

### Failures
What has gone wrong — a task the agent could not complete, a condition its assignment did not hold, an obstacle it hit. Failures are reported honestly and promptly, never hidden or delayed ([agent principles](01-agent-principles.md)). A surfaced failure is what lets orchestration recover and the Director respond.

### Completion
How the agent's assigned task concluded — completed, failed, partially done, or cancelled — reported plainly. The completion report is the agent's final, honest account of its outcome, handed to orchestration.

## Inputs

- The **agent's execution state and events** — starts, progress, failures, conclusion.
- The **assigned task** — the baseline the report is measured against.

## Outputs

- **Progress reports** — the agent's ongoing state against its task.
- **Failure reports** — problems surfaced with enough context to act on.
- A **completion report** — the agent's final outcome (completed / failed / partial / cancelled).
- A **contribution to the execution trace** — the agent's reported record.

## Boundaries

- Reporting is **honest** — the agent's true progress, real failures, and actual outcome; no hidden failure, no overstated progress, no false completion ([agent principles](01-agent-principles.md)).
- The agent **reports; it does not decide what happens next** — it states its outcome; responding to it (recover, retry, re-plan) is orchestration's, the reasoning domains', and the Director's job, not the agent's ([agent boundaries](04-agent-boundaries.md)).
- It **reports to orchestration** — the agent's reports flow to orchestration for aggregation, not to peer agents.
- It **defines no method** — this document establishes that agent reporting exists and its content, not any telemetry mechanism.

## Future direction

Future agents may report more richly — finer progress, earlier and clearer failure detail, more informative completion accounts feeding learning ([Learning Engine](../../architecture-backlog/19-learning-engine.md)). The discipline is fixed: honest, timely reporting of progress, failure, and completion that decides nothing about what comes next. Richness grows; the honest, decide-nothing reporting holds.
