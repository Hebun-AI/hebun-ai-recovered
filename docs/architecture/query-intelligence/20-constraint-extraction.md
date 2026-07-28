# 20 — Constraint Extraction

## Purpose

Constraint Extraction identifies explicit qualification constraints already present in the Query, declared Context, or referenced canonical contracts without interpreting policy or performing reasoning.

## Constraint Classes

- Scope and exclusion;
- version, lifecycle, and time;
- Tenant, organization, and domain;
- authorization and authority reference;
- classification, privacy, retention, and disclosure;
- allowed analytical form;
- prohibited outcome;
- completeness and traceability expectation;
- Processing Output Package compatibility.

## Extraction Contract

Each constraint records identity, exact source reference, normalized expression, class, applicability, conflict, ambiguity, affected component, and validation status. Normalization preserves meaning and original representation.

## Rules

- **CEXTRACT-001:** Every extracted constraint must map to explicit source content or canonical reference.
- **CEXTRACT-002:** Query Intelligence must not invent, interpret normatively, waive, or enforce constraints.
- **CEXTRACT-003:** Conflicting and ambiguous constraints must remain visible.
- **CEXTRACT-004:** Constraints must propagate to Objective, Scope, Context, plan, package, and Trace.
- **CEXTRACT-005:** Unsupported decision, recommendation, governance, and execution requests must become prohibited-outcome constraints.
- **CEXTRACT-006:** Constraint normalization must preserve original meaning and source.

## Enterprise Example

“Use only approved version 3 documents and exclude Runtime observations” yields explicit version and exclusion constraints. Query Intelligence records them but performs no evidence selection.

## Boundaries

No policy engine, rules engine, parser implementation, enforcement, or reasoning validation is defined.
