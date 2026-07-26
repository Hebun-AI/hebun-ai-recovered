# 02 — Phase Coordination

## Purpose

Phase Coordination is where orchestration **runs the components in their proper order** — sequencing Reasoning, Planning, Decision, and Verification so the workflow progresses correctly from a trigger to a verified, decision-ready outcome. It is the ordering discipline of the whole Director Intelligence workflow: each component runs when its inputs are ready, and never before.

## Architectural role

Phase Coordination is the backbone of orchestration — the ordered progression the other topics ([information flow](03-information-flow.md), [feedback loops](04-feedback-loops.md)) operate within. It is the cross-component analogue of the cognitive lifecycle ([Phase 7B](../director-reasoning-cognition/README.md)): where 7B ordered the stages *within* reasoning, phase coordination orders the components *across* Director Intelligence. It enforces the canonical progression and the Director Gates that punctuate it.

## The coordinated progression

```
Reasoning (7A–7C)  → approved recommendation
        │  Director approval (gate)
Planning (7D)       → validated plan
        │
Decision (7E)       → decision-ready outcome
        │
Verification (7F)   → readiness verdict
        │  Director approval (gate)
        ▼
Execution (future — outside this workflow)
```

## Inputs

- The **trigger** that starts the workflow, and each component's **completion signal** and **output**.
- The **transition conditions** — what must be true (including a Director gate, where one applies) before the next component may run.

## Outputs

- A **coordinated workflow** — components run in order, each after its predecessor's output is ready and any required gate is passed.
- **Progression state** — where in the workflow the reasoning currently is, recorded for traceability.
- **Gate enforcement points** — the moments where the workflow pauses for the Director's approval before continuing.

## Boundaries

- Coordination **preserves order; it never skips or reorders** to shortcut the workflow ([orchestration principles](01-orchestration-principles.md)).
- It **sequences the components; it does not perform them** — it decides *when* each runs, never *what* each produces.
- It **respects the gates** — it never advances past a Director gate without the Director's approval.
- It **produces no action** and **defines no method** — this document establishes that phase coordination exists and its role, not any scheduling algorithm.

## Future direction

Future orchestration engines may coordinate progression more flexibly — handling parallel sub-workflows, conditional paths, or re-entry after feedback more gracefully. The discipline is fixed: the canonical order and the Director gates hold; coordination sequences, never performs or skips. Flexibility grows; the ordered, gated progression holds.
