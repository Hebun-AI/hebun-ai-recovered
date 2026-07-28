# 21 — Missing Information Analysis

## Purpose

Missing Information Analysis identifies absent qualification inputs, evaluates materiality, and determines whether safe package construction is possible without fabricating information.

## Missing Information Classes

- origin or Tenant;
- subject identity or referent;
- Intent discriminator;
- Objective boundary;
- enterprise or domain;
- version, lifecycle, or time;
- authorization or authority reference;
- classification or privacy status;
- Context reference;
- constraint;
- eligible Processing Output Package;
- package compatibility metadata.

## Materiality

- **Blocking:** no safe Request Package can be produced.
- **Limiting:** a package may be ready only for a separable bounded Objective.
- **Non-Material:** absence is recorded but does not affect qualification.
- **Unknown Materiality:** requires clarification because impact cannot be assessed.

## Rules

- **MISSING-001:** Missing information must never be fabricated, guessed, retrieved, or inferred from unrestricted memory.
- **MISSING-002:** Every gap must identify class, affected component, materiality, and permitted outcome.
- **MISSING-003:** Blocking gaps require Clarification Required, Rejected, Insufficient Context, or Out of Scope.
- **MISSING-004:** Limiting gaps must propagate to Objective and Request Package.
- **MISSING-005:** Absence of evidence and absence of Context must remain distinct.
- **MISSING-006:** A clarification need must not include a proposed answer or recommendation.

## Enterprise Example

A Query asks about “the approved model” but provides no domain or identity. The missing referent is Blocking; Query Intelligence cannot choose the most recent model.

## Boundaries

No data retrieval, autonomous clarification conversation, search, inference, or completion model is defined.
