# 07 — Failure Classification

## Purpose

Define a constitutional taxonomy for Runtime failure without authorizing recovery.

## Failure Classes

- **Authority failure:** required approval or authority is missing, expired, or exceeded.
- **Policy failure:** applicable policy cannot be preserved.
- **Compliance failure:** evidence shows non-conformance.
- **Evidence failure:** required evidence is absent, invalid, or contradictory.
- **Boundary failure:** Runtime crosses constitutional responsibility.
- **Workflow or State failure:** progression or condition evidence is invalid or divergent.
- **Event integrity failure:** occurrence, provenance, ordering, or immutability is compromised.
- **Scheduling failure:** eligibility determination is invalid or exceeded.
- **Monitoring failure:** condition evaluation is unavailable, invalid, or misleading.
- **Control failure:** authorized constraint is not preserved.
- **Recovery failure:** authorized restoration cannot meet its boundaries.
- **Continuity failure:** safe operational continuity cannot be maintained.

## Classification Context

Every classification preserves evidence, subject, Scope, time, severity context, affected obligations, uncertainty, authority impact, policy impact, containment eligibility, recovery eligibility, and escalation boundary.

Severity describes impact; it does not create authority.

## Rules

- **P24-FAILURE-001:** Failure classification must be evidence-based and attributable.
- **P24-FAILURE-002:** Failure detection does not authorize recovery.
- **P24-FAILURE-003:** Severity must not create control, recovery, or exception authority.
- **P24-FAILURE-004:** Conflicting classifications must remain visible.
- **P24-FAILURE-005:** Classification must not modify evidence or Runtime history.
- **P24-FAILURE-006:** Failure taxonomy must remain implementation-independent.

## Enterprise Example

A control failure may be classified as severe, but severity alone cannot authorize recovery or Human Override.
