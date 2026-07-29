# 08 — Runtime Failure Boundaries

## Purpose

Define failure meaning, responsibility, evidence preservation, and escalation without designing recovery algorithms or mechanisms.

## Failure Classes

- **Admission failure:** constitutional prerequisites are incomplete or incompatible.
- **Authority failure:** approval is missing, expired, exceeded, or contradictory.
- **Governance failure:** required eligibility or constraint cannot be preserved.
- **Input failure:** required input is absent, invalid, or incompatible.
- **Memory-boundary failure:** provenance, version, Tenant, classification, lifecycle, or consumption boundary is invalid.
- **Responsibility failure:** Runtime cannot faithfully meet accepted responsibility.
- **Divergence:** observed realization differs materially from admitted Scope or expected meaning.
- **Interruption:** authorized continuation is withdrawn or paused.
- **Boundary violation:** a participant crosses or claims a prohibited responsibility or authority.

## Failure Response Boundary

Runtime may refuse admission, constrain realization, suspend, terminate, preserve evidence, report, and identify escalation eligibility according to existing authority. It may not improvise, re-plan, broaden Scope, waive Governance, create permission, alter Memory, retry by hidden policy, or authorize recovery.

## Failure Ownership

Runtime owns honest recognition and reporting of operational failures inside accepted responsibility. The relevant upstream owner retains decisions about re-planning, approval, Governance exceptions, Memory correction, or renewed execution.

## Rules

- **P21-FAILURE-001:** Failure must remain explicit, attributable, and classification-specific.
- **P21-FAILURE-002:** Runtime must fail closed when authority or constitutional compatibility is uncertain.
- **P21-FAILURE-003:** Failure must not grant permission to expand responsibility or improvise.
- **P21-FAILURE-004:** Evidence must be preserved before any separately authorized recovery.
- **P21-FAILURE-005:** Escalation eligibility must not be treated as escalation execution or decision.
- **P21-FAILURE-006:** Phase 21 must not define retry, rollback, failover, or recovery mechanisms.

## Enterprise Example

If an admitted Memory version becomes restricted, Runtime suspends the affected responsibility, preserves evidence, and exposes the boundary. It does not substitute another source or continue under assumed permission.
