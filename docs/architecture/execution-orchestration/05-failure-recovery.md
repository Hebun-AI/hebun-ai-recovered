# 05 — Failure Recovery

## Purpose

Failure Recovery is where orchestration **detects when an execution agent fails and responds per the approved plan** — noticing a failed task, applying the recovery strategy the plan already specifies, and, where recovery is not possible or not authorized, surfacing the failure to the Director. Multi-agent execution will encounter failures; recovery is the disciplined, non-improvising response to them.

## Architectural role

Failure Recovery consumes the failure signals that [Orchestration Monitoring](06-orchestration-monitoring.md) surfaces and acts within the recovery and retry strategies the approved plan carries ([Phase 7D](../director-planning/README.md)) — reflecting the runtime recovery/compensation concerns already established in the platform's runtime architecture. Crucially, it applies *pre-approved* recovery; it does not invent recovery through its own reasoning. When the plan's recovery does not cover a failure, orchestration reports rather than improvises.

## Inputs

- **Failure signals** — a task that failed, an agent that could not complete, a condition the plan did not hold.
- The **plan's recovery and retry strategies** — the pre-approved responses to failure.
- The **execution state** — what had completed before the failure, and what is safe to retry.

## Outputs

- **Applied recovery** — the plan's approved retry or recovery strategy carried out (e.g. re-attempting a task, reassigning it to another agent) within its bounds.
- **Escalation** — where the plan's recovery does not cover the failure, or recovery would require unapproved action, the failure surfaced to the Director and the reasoning domains.
- A **recovery record** — every failure, recovery attempt, and escalation, for traceability.

## Boundaries

- Recovery applies **only pre-approved strategies** — it never invents a new recovery through its own reasoning or decision ([orchestration principles](01-orchestration-principles.md)). Recovery beyond the plan is a re-planning matter, upstream.
- It **never manufactures a committing action** — a retry of a committing action stays within the Director's original approval; recovery never creates new authority.
- It **recovers execution; it does not re-plan** — where recovery fails, orchestration reports and defers; it does not redesign the plan to work around the failure.
- It **defines no method** — this document establishes that failure recovery exists and its role, not any retry algorithm.

## Future direction

Future orchestration engines may recover more capably — detecting failures earlier, applying approved strategies more precisely, escalating more clearly. The discipline is fixed: apply only pre-approved recovery, never invent it, never manufacture committing actions, and escalate what the plan does not cover. Capability grows; the approved-recovery-only boundary holds.
