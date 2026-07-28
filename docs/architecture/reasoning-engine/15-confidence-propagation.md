# 15 — Confidence Propagation

## Purpose

Confidence Propagation defines how evidence support, assumptions, conflicts, uncertainty, inference validity, and coverage constrain confidence across a reasoning chain.

## Confidence Dimensions

- evidence sufficiency;
- authority applicability;
- provenance completeness;
- premise validity;
- assumption dependency;
- inference validity;
- alternative discrimination;
- conflict status;
- Scope and coverage completeness;
- freshness and change sensitivity.

## Propagation Principles

Confidence is calculated or classified per material finding, never inherited blindly. A child finding cannot have stronger justified confidence than its weakest critical dependency unless independent evidence explicitly supports the increase. Multiple dependent copies do not increase confidence.

Contradiction, missing evidence, material assumptions, invalid lineage, or limited Scope propagates to every dependent Result. Independent branches retain separate confidence and may be reported together without forced aggregation.

## Rules

- **CONFPROP-001:** Every confidence value must have a dimensional evidence-backed rationale.
- **CONFPROP-002:** Confidence must propagate dependency limitations and conflicts.
- **CONFPROP-003:** Independent support and duplicated support must remain distinguishable.
- **CONFPROP-004:** Confidence must not exceed the justified support of critical premises.
- **CONFPROP-005:** An indeterminate critical dimension must remain indeterminate rather than defaulting upward.
- **CONFPROP-006:** Aggregate confidence must not hide a failed authority, provenance, Tenant, or boundary condition.
- **CONFPROP-007:** Confidence is not truth, probability by default, authority, recommendation, approval, or decision.

## Enterprise Example

A two-step impact chain has strong direct evidence for the first relation and a material continuity Assumption for the second. The final impact confidence must expose the assumption dependency rather than inherit the first step's stronger support.

## Boundaries

No numeric formula, calibration dataset, threshold, model score, or Runtime propagation algorithm is defined.
