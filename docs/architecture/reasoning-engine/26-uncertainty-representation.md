# 26 — Uncertainty Representation

## Purpose

Uncertainty Representation makes incomplete knowledge, ambiguity, variability, conflict, and model-independent analytical limits explicit at premise, Unit, chain, Result, and package levels.

## Uncertainty Classes

| Class | Meaning |
|---|---|
| Evidence Gap | required evidence is absent |
| Scope Ambiguity | applicability boundary is unresolved |
| Authority Ambiguity | precedence or decision right is unclear |
| Semantic Ambiguity | term or statement supports multiple readings |
| Temporal Uncertainty | time, sequence, version, or validity is unclear |
| Correlation Uncertainty | identity or relation is possible but unconfirmed |
| Conflict Uncertainty | competing evidence cannot be reconciled |
| Inference Uncertainty | transformation supports more than one finding |
| Coverage Uncertainty | affected population or dependency reach is incomplete |

## Representation Contract

Each uncertainty record identifies class, affected element, source, extent, materiality, possible alternatives, confidence impact, validation effect, propagation path, and review requirement.

## Rules

- **UNCERTAIN-001:** Material uncertainty must be represented at its point of origin and every dependent Result.
- **UNCERTAIN-002:** Unknown, indeterminate, ambiguous, conflicted, and unsupported must remain distinct.
- **UNCERTAIN-003:** Numeric precision must not exceed evidence precision.
- **UNCERTAIN-004:** Confidence must not hide or average away critical uncertainty.
- **UNCERTAIN-005:** Uncertainty reduction may use only evidence already present in the package.
- **UNCERTAIN-006:** A lack of observed conflict must not be represented as certainty.
- **UNCERTAIN-007:** Review Required must identify the unresolved question without recommending an answer.

## Enterprise Example

A relationship exists but its effective version and authority are unclear. The Result carries temporal and authority uncertainty separately, showing how each limits the inference.

## Boundaries

No probability model, Bayesian network, fuzzy logic engine, calibration method, or uncertainty visualization is selected.
