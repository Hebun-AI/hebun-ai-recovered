# 10 — Event Semantics

## Purpose

Define operational fact, ordering, causality, correlation, and interpretation semantics.

## Semantic Components

An Event declares:

- occurrence type and bounded meaning;
- subject and Runtime admission correlation;
- effective occurrence context and recording context;
- producer and source provenance;
- Tenant, classification, Scope, and purpose;
- ordering relationship where constitutionally known;
- causality claim only when supported;
- related State, Workflow, and Event references;
- uncertainty, correction, and conflict relationships.

## Ordering Semantics

Ordering may be total, partial, concurrent, unknown, or disputed within a declared boundary. Recording order, identifier order, or technical arrival order must not be treated as occurrence order without evidence.

## Causality and Correlation

Precedence does not prove causality. Correlation relates artifacts for traceability but does not merge identity, authority, ownership, or truth.

## Rules

- **P22-EVENT-SEMANTICS-001:** Ordering claims must declare their evidence and boundary.
- **P22-EVENT-SEMANTICS-002:** Unknown or concurrent ordering must remain explicit.
- **P22-EVENT-SEMANTICS-003:** Arrival order must not silently become occurrence order.
- **P22-EVENT-SEMANTICS-004:** Precedence and correlation must not be interpreted as causality.
- **P22-EVENT-SEMANTICS-005:** Event relationships must preserve independent identities.
- **P22-EVENT-SEMANTICS-006:** Event semantics must not define transport, protocol, or processing.

## Enterprise Example

Two domain observations may be concurrent even if one record arrived first. The Event model preserves unknown ordering rather than inventing a sequence.
