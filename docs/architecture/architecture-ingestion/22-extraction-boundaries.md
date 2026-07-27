# 22 — Architecture Extraction Boundaries

## Definition

The **Architecture Extraction Boundary** determines which source classes may establish Entity and Relationship assertions and which information must remain outside extraction. Eligibility does not create authority; every source must also satisfy canonicality, lifecycle, version, scope, and evidence requirements.

## Why

Operational and generated information often contains architecture-like names and relationships. Admitting it would convert behavior, conversation, or inference into canonical structure. A strict boundary prevents Runtime and generated outputs from rewriting Architecture.

## Mental Model

```text
Eligible governed evidence
Canonical Documents · Normative Statements · Canonical Definitions
Approved References · Approved Metadata
                         ↓
              Architecture Extraction

Runtime · Logs · Telemetry · Observations · Metrics · Execution State
Chat History · Generated Reasoning · LLM Output
                         ✕
```

## Core Components

### Eligible Sources

- **Canonical Documents:** applicable, governed architecture documents with known identity and authority.
- **Normative Statements:** source statements whose type, scope, lifecycle, version, and evidence are established.
- **Canonical Definitions:** approved Concept or Entity meanings within declared scope.
- **Approved References:** governed references whose semantic type and target are resolved.
- **Approved Metadata:** canonically evidenced metadata relevant to identity, authority, lifecycle, version, or scope.

### Excluded Sources

- Runtime and Runtime objects
- Logs and telemetry
- Observations and metrics
- Execution State and execution results
- Chat history
- Generated reasoning and summaries
- LLM output
- Inferred, unresolved, or unapproved derivatives

## Principles

1. Only eligible canonical evidence may establish an extracted Entity or Relationship.
2. Approved status alone is insufficient without recognized Authority and Scope.
3. References and metadata must retain their Phase 11B semantics.
4. Runtime and Execution evidence must not become architecture through extraction.
5. Observation and metric frequency must not establish identity or authority.
6. Generated outputs may not serve as canonical extraction sources.
7. Mixed sources must be classified at the evidence level; excluded content must remain excluded.
8. Missing canonical evidence must cause a validation finding, not fallback to excluded sources.
9. Extraction must stop before storage, retrieval, graph representation, or operational ingestion.
10. Boundary changes require a new architecture gate and Director approval.

## Enterprise Example

An Approved architecture document defines a Department, while Runtime logs use a shorter nickname and show interactions with a Capability. Extraction may establish the Department only from the canonical document. The nickname and observed interaction cannot create an Alias or Relationship. They remain outside this phase regardless of frequency.

## Design Notes

- “Approved Reference” means a governed reference assertion, not any working hyperlink.
- Observation is excluded as an extraction source even when it may be valid evidence in another architecture.
- Generated content can aid human review only outside the canonical extraction evidence boundary.
- This phase defines no Runtime ingestion or reconciliation mechanism.
- Extraction eligibility does not imply automatic acceptance; validation still applies.

## Common Mistakes

- Extracting Entities from chat history.
- Treating logs as evidence of architectural Relationships.
- Using metrics to define Capability identity.
- Promoting an LLM summary into a canonical source.
- Assuming every Approved document fragment has equal scope.
- Filling missing metadata from Runtime observations.
- Expanding the boundary for convenience without governance.

## Related Architecture

- [05 — Ingestion Boundaries](05-ingestion-boundaries.md)
- [11 — Document Metadata Model](11-document-metadata-model.md)
- [17 — Ontology Boundaries](17-ontology-boundaries.md)
- [21 — Architecture Extraction Principles](21-extraction-principles.md)
- [Phase 8 — Execution Architecture Closure](../execution-review/10-phase-8-final-closure.md)

