# 16 — Query Decomposition

## Purpose

Query Decomposition creates traceable Query Parts only when doing so preserves original meaning and enables bounded Objective formation.

## Query Part Contract

Each Part records parent Query, exact source segment, derived normalized representation, candidate Intent, shared and local constraints, dependency on other Parts, ambiguity, rejected semantics, and reconstruction order.

Decomposition may separate subjects, analytical purposes, Scopes, time intervals, or explicitly conjunctive questions. It cannot invent missing subquestions, add a desired outcome, or convert a command into analysis silently.

## Rules

- **QDECOMP-001:** Every Part must map to exact original Query content.
- **QDECOMP-002:** Parent meaning and relationships among Parts must remain reconstructable.
- **QDECOMP-003:** Decomposition must not create new Intent, Objective, evidence need, or authority.
- **QDECOMP-004:** Shared constraints and Context must remain explicit.
- **QDECOMP-005:** Unsupported or ambiguous content must remain attached to the affected Part.
- **QDECOMP-006:** Inseparable meaning must remain one Part and yield qualification or clarification.

## Enterprise Example

“Which capabilities depend on X, and does Y violate its boundary?” may become two linked Parts if X, Y, and “its” are resolved. Otherwise referential ambiguity blocks decomposition readiness.

## Boundaries

No task breakdown, planning, workflow, parallel execution, prompt splitting, or tool dispatch is defined.
