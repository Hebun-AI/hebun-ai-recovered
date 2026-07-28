# 14 — Evidence Weighting Model

## Purpose

Evidence Weighting qualifies how strongly an eligible evidence item can support a specific premise within one Objective and Scope. Weight is not truth, authority, popularity, or a universal score.

## Weight Dimensions

| Dimension | Question |
|---|---|
| Authority Applicability | Is the source authority applicable to this claim and Scope? |
| Provenance Integrity | Is the source and transformation lineage complete? |
| Directness | Does evidence directly support the premise or depend on derivation? |
| Scope Fit | Does enterprise, domain, version, lifecycle, Tenant, and time match? |
| Independence | Is support genuinely independent rather than duplicated lineage? |
| Freshness | Is evidence current enough for the declared purpose? |
| Structural Quality | Did applicable Phase 13 quality controls pass? |
| Conflict Exposure | Is material counterevidence present or unresolved? |
| Coverage | How much of the premise is actually supported? |

## Representation

Each dimension records a bounded category or measure, evidence, rationale, uncertainty, limitation, and applicable policy reference. Aggregation must preserve dimension values; a composite cannot override authority, lineage, Tenant, classification, or critical quality failures.

## Rules

- **WEIGHT-001:** Weight must be premise-, Objective-, and Scope-specific.
- **WEIGHT-002:** Authority must remain a distinct dimension and cannot be inferred from repetition or recency.
- **WEIGHT-003:** Duplicate evidence with shared lineage must not multiply independent support.
- **WEIGHT-004:** Counterevidence and conflict must reduce or qualify support visibly.
- **WEIGHT-005:** A critical provenance or eligibility failure must block use rather than receive a low numeric weight.
- **WEIGHT-006:** Weighting rationale must be explainable and traceable.
- **WEIGHT-007:** Evidence weight must not be represented as truth probability or approval.

## Enterprise Example

Five derived artifacts repeat one canonical statement. Their common source gives strong applicable authority but only one independent lineage. Weighting records authority and directness without treating repetition as five confirmations.

## Boundaries

No scoring scale, statistical estimator, ranking algorithm, machine-learning model, or threshold is selected.
