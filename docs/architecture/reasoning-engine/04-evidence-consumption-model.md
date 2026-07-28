# 04 — Evidence Consumption Model

## Purpose

The Evidence Consumption Model defines how reasoning reads and cites evidence without changing its content, metadata, authority, or Phase 13 status.

## Evidence View

Reasoning consumes an immutable Evidence View containing:

- Processing Artifact identity and version;
- Original Source identity, version, location reference, and citation anchors;
- authority, lifecycle, Scope, Tenant, classification, and jurisdiction;
- provenance and transformation lineage;
- validation and quality status;
- duplicate, correlation, conflict, confidence, and limitation records;
- permitted purpose, retention, and disclosure boundaries.

## Consumption Semantics

Evidence may be cited as a premise, constraint, counterexample, conflicting position, or insufficiency indicator. The reasoning trace records the exact role. Relevance to an Objective does not elevate authority or remove limitations.

Evidence exclusion must record identity, reason, responsible rule, and impact. Duplicate evidence cannot multiply support merely by repetition. Conflicting evidence remains independently addressable.

## Sufficiency

Evidence sufficiency is assessed per material Result against the Objective and Scope. It considers coverage, authority, provenance, applicability, freshness, conflict, and counterevidence. Insufficiency is a valid structured outcome and must not trigger fabrication.

## Rules

- **EVIDENCE-001:** Reasoning must consume evidence by immutable package reference.
- **EVIDENCE-002:** Every premise must retain source, provenance, authority, version, Scope, Tenant, classification, and citation anchors.
- **EVIDENCE-003:** Evidence content and Processing Artifact metadata must never be modified by reasoning.
- **EVIDENCE-004:** Duplicate evidence must not be counted as independent support without independent provenance.
- **EVIDENCE-005:** Contradictions and material counterevidence must remain visible in every affected Result.
- **EVIDENCE-006:** Missing evidence must produce limitation, insufficiency, conflict, or review requirement; it must never be fabricated.
- **EVIDENCE-007:** Evidence exclusion must be explicit, justified, traceable, and reversible for review.
- **EVIDENCE-008:** Confidence cannot compensate for missing provenance or insufficient evidence.

## Enterprise Example

Three artifacts repeat the same architectural constraint but derive from one source. Reasoning records one underlying evidence lineage rather than treating repetition as three independent confirmations. A conflicting approved statement remains visible and prevents an unqualified Result.

## Boundaries

Reasoning does not retrieve, ingest, normalize, enrich, correct, supersede, revoke, retain, delete, or reclassify evidence.
