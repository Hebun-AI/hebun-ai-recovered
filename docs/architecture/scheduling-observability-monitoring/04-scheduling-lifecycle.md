# 04 — Scheduling Lifecycle

## Purpose

Define constitutional Scheduling lifecycle meanings without a scheduler, timer, queue, or implementation process.

## Lifecycle Meanings

- **Declared:** temporal and operational eligibility constraints are identified.
- **Qualified:** required evidence and constraints are sufficient for evaluation.
- **Eligible:** current context satisfies declared conditions.
- **Ineligible:** one or more declared conditions are not satisfied.
- **Constrained:** eligibility is bounded by an explicit limitation.
- **Deferred:** consideration is intentionally postponed under existing authority.
- **Expired:** the eligibility basis is no longer current.
- **Withdrawn:** an authorized boundary removes the Scheduling basis.
- **Closed:** determination history and accountability obligations are complete.

These are constitutional meanings, not timer states, queue positions, jobs, triggers, or execution transitions.

## Rules

- **P23-SCHEDULING-LIFECYCLE-001:** Every lifecycle meaning must preserve evaluation time and evidence context.
- **P23-SCHEDULING-LIFECYCLE-002:** Eligible must not initiate execution.
- **P23-SCHEDULING-LIFECYCLE-003:** Deferred must not create a future authorization.
- **P23-SCHEDULING-LIFECYCLE-004:** Expiry must fail closed.
- **P23-SCHEDULING-LIFECYCLE-005:** Determination history must remain auditable.
- **P23-SCHEDULING-LIFECYCLE-006:** Lifecycle meaning must not prescribe implementation behavior.

## Enterprise Example

An eligibility determination expires when its authority or evidence window ends. Reconsideration requires a new attributable evaluation.
