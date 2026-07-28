# 25 — Exception Handling

## Purpose

Exception Handling represents existing canonical exceptions and identifies when a new exception would require external reserved approval.

## Exception Reference

An existing Exception Reference contains identity, governing rule, approved authority, subject, Scope, Tenant, conditions, effective interval, expiry, revocation, evidence, provenance, and status.

A requested exception is not an Exception Reference. Governance may classify the need as `REVIEW_REQUIRED`, `LEGAL_REVIEW`, or `EXECUTIVE_REVIEW`.

## Rules

- **EXCEPT-001:** Existing exception evidence must be explicit, approved, applicable, current, and traceable.
- **EXCEPT-002:** An exception cannot be inferred from precedent, ownership, urgency, or confidence.
- **EXCEPT-003:** Exception Scope must not be generalized.
- **EXCEPT-004:** Expired, revoked, ambiguous, or conflicting exceptions cannot support `ALLOW`.
- **EXCEPT-005:** Governance must not create, extend, approve, waive, or enforce an exception.
- **EXCEPT-006:** A request for exception must remain a review requirement, not a recommendation.

## Enterprise Example

A prior exception covered one Tenant and expired version. Governance cannot apply it to another Tenant or current version and may produce `EXECUTIVE_REVIEW`.

## Boundaries

No exception workflow, approval process, policy waiver engine, precedent reasoning, or execution is defined.
