# 22 — Constraint Reasoning

## Purpose

Constraint Reasoning tests evidence-grounded propositions against explicit canonical invariants, boundaries, cardinalities, applicability conditions, and compatibility rules.

## Constraint Contract

Each constraint records identity, canonical source, authority, version, Scope, subject, predicate, conditions, exceptions, severity, and conflict status. A test records target proposition, evidence, assumptions, evaluation, counterexamples, and outcome.

## Outcomes

- Satisfied
- Violated
- Partially Satisfied
- Not Applicable
- Indeterminate
- Conflicted
- Review Required

An outcome reports analytical conformance only; it is not enforcement, approval, waiver, or remediation.

## Rules

- **CONSTRAINT-001:** Only explicit eligible constraints may be tested as normative.
- **CONSTRAINT-002:** Applicability, exceptions, lifecycle, version, and Scope must be evaluated first.
- **CONSTRAINT-003:** Constraint conflicts must remain visible and unresolved without authority.
- **CONSTRAINT-004:** Indeterminate evidence must not be converted into compliance or violation.
- **CONSTRAINT-005:** Constraint outcomes must preserve evidence and exact test rationale.
- **CONSTRAINT-006:** Reasoning must not create, waive, enforce, or modify a constraint.

## Enterprise Example

A proposed relationship is tested against an approved cardinality boundary. Reasoning may report a violation within the named version; it cannot waive the rule, approve the proposal, or change the relationship.

## Boundaries

No policy engine, rules engine, validator implementation, enforcement mechanism, or corrective workflow is selected.
