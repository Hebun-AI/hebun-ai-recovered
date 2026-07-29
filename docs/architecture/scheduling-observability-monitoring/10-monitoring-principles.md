# 10 — Monitoring Principles

## Purpose

Define durable principles for condition evaluation.

## Principles

1. **Condition-defined:** Monitoring evaluates only explicit, versioned conditions.
2. **Subject-bound:** every condition names a bounded Runtime subject.
3. **Evidence-based:** outcomes cite attributable evidence.
4. **Repeatable:** equivalent evidence and condition versions support reproducible evaluation.
5. **Uncertainty-visible:** insufficient or conflicting evidence remains explicit.
6. **Non-authoritative:** outcomes and Alerts grant no permission.
7. **Non-executing:** Monitoring never changes operational behavior.
8. **Governance-distinct:** condition evaluation is not policy evaluation.
9. **Scope-preserving:** Tenant, classification, purpose, and Scope remain intact.
10. **Implementation-independent:** frequency and technology do not define meaning.

## Condition Outcomes

A condition evaluation may be satisfied, not satisfied, indeterminate, invalid, expired, or conflicted. These are evidence qualifications, not States, Events, commands, or actions.

## Rules

- **P23-MONITORING-PRINCIPLE-001:** Monitoring evaluates conditions but never creates authority.
- **P23-MONITORING-PRINCIPLE-002:** Monitoring does not equal Governance.
- **P23-MONITORING-PRINCIPLE-003:** Indeterminate evidence must not be forced into a binary outcome.
- **P23-MONITORING-PRINCIPLE-004:** Condition changes must create traceable versions.
- **P23-MONITORING-PRINCIPLE-005:** A breached condition must not trigger implicit execution.
- **P23-MONITORING-PRINCIPLE-006:** Evaluation history must remain attributable and auditable.

## Enterprise Example

A privacy-related operational condition may be monitored, but Monitoring does not determine compliance or grant an exception.
