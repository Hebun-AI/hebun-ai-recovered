# 20 — Quality Model and Quality Gates

## Purpose

This document defines measurable processing quality and canonical gate outcomes. Quality describes evidence-package fitness for declared use; it does not establish truth or approval.

## Quality Dimensions

| Dimension | Measure |
|---|---|
| Completeness | required evidence, artifacts, metadata, and criteria present |
| Consistency | internal statements and metadata agree within declared context |
| Provenance Coverage | material representations trace to eligible originals |
| Structural Validity | artifacts conform to canonical contracts |
| Semantic Preservation | transformations retain meaning and variance |
| Source Traceability | source identities, locations, versions, and anchors resolve |
| Duplication Level | duplicate classes and retained distinct evidence quantified |
| Contradiction Status | open, handled, and affected evidence explicitly recorded |
| Freshness | source and artifact ages evaluated against purpose requirements |
| Classification Accuracy | handling classes validated against applicable policy |
| Transformation Integrity | hashes, rules, actors, and lineage form a valid chain |

Each measure records method, numerator and denominator or bounded qualitative basis, result, threshold, exclusions, and uncertainty. A composite score must not hide a failed critical dimension.

## Gate Outcomes

- **Pass** — every mandatory threshold and critical invariant passes.
- **Conditional Pass** — explicitly permitted limitations remain and downstream use is bounded.
- **Reject** — fitness criteria cannot be met for the declared purpose.
- **Quarantine** — trust, security, tenant, classification, or integrity risk prevents ordinary handling.
- **Escalation** — a reserved authority or unresolved policy judgment is required.

## Gate Placement

Gates apply at intake, source registration, extraction, normalization, correlation, contradiction handling, enrichment, packaging, and handoff. A later gate cannot erase an earlier failed result.

## Rules

- **QUALITY-001:** Quality requirements and critical dimensions must be bound before substantive processing.
- **QUALITY-002:** Every gate outcome must cite measures, evidence, thresholds, and limitations.
- **QUALITY-003:** A critical invariant failure must not be averaged into a passing aggregate.
- **QUALITY-004:** Conditional Pass must state permitted use and prohibited use.
- **QUALITY-005:** Quarantined artifacts must remain isolated until authorized release and revalidation.
- **QUALITY-006:** Quality Validation must not become approval, recommendation, or truth determination.
- **QUALITY-007:** Gate bypass is prohibited and must produce an audit and escalation finding.

## Boundaries

This model defines dimensions and outcomes, not scoring algorithms, monitoring products, statistical models, or service-level objectives.
