# 14 — Rule Evaluation

## Purpose

Rule Evaluation tests declared use against explicit canonical governance rules without implementing an executable rules engine.

## Rule Reference

Each reference records identity, source, version, lifecycle, authority, Scope, subject, predicate, conditions, exceptions, severity, precedence, conflict, provenance, and validation.

## Evaluation Outcomes

`Satisfied`, `Conditionally Satisfied`, `Violated`, `Not Applicable`, `Indeterminate`, `Conflicted`, or `Review Required`.

The Outcome reports eligibility impact only. Rule satisfaction is not approval, and violation is not enforcement.

## Rules

- **REVAL-001:** Only approved, applicable, current, traceable governance rules may be evaluated.
- **REVAL-002:** Rule identity, applicability, conditions, exceptions, and precedence must remain explicit.
- **REVAL-003:** Indeterminate evidence must not become satisfaction or violation.
- **REVAL-004:** Conflicting rules require explicit conflict status or review.
- **REVAL-005:** A rule finding must map to one Evaluation Unit and Outcome impact.
- **REVAL-006:** Governance must not create, modify, waive, execute, or enforce a rule.

## Enterprise Example

A disclosure rule requires redaction of personal identifiers. Governance may produce `ALLOW_WITH_REDACTION` with the exact requirement; it does not perform the redaction or authorize disclosure.

## Boundaries

No rule language, solver, engine, decision table, enforcement point, or code is created.
