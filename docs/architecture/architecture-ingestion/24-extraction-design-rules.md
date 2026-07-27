# 24 — Architecture Extraction Design Rules

## Definition

The **Architecture Extraction Design Rules** are the normative conformance criteria for identifying and validating Canonical Entities and Relationships from architecture sources. A design violating a **must** or **must not** rule below is not Phase 11D-conformant.

## Why

Extraction must remain faithful when technologies, document formats, and implementations change. These rules prevent identity drift, hallucination, authority transfer, silent correction, source mutation, and graph or Runtime coupling.

## Mental Model

```text
Canonical source evidence
        ↓ constrained extraction
Traceable derived candidates
        ↓ read-only validation
Explicit findings or validated representation

No stage gains authority over the source.
```

## Core Components

### Canonical Rules

1. **EXR-01 — Stable Entity Identity:** Entity Identity must remain stable across label, path, document layout, and representation changes.
2. **EXR-02 — Source Authority:** Entity authority must originate from applicable canonical source evidence.
3. **EXR-03 — Concept Separation:** A Concept must not be represented as an Entity.
4. **EXR-04 — Document Separation:** A Document or Statement must not be represented as the Entity it describes.
5. **EXR-05 — Entity Not Node:** An Entity must not be equated with a Knowledge Graph node.
6. **EXR-06 — Semantic Relationship:** Every Relationship must use a Phase 11C semantic meaning.
7. **EXR-07 — Relationship Not Edge:** A Relationship must not be equated with a graph edge, database relation, Runtime dependency, or Execution Flow.
8. **EXR-08 — Read-only Source:** Extraction must not modify canonical source content or governance metadata.
9. **EXR-09 — Deterministic Extraction:** The same eligible source state and governed rules must yield the same extraction result.
10. **EXR-10 — No Unknown Entity:** An Entity with unresolved canonical Concept, Identity, or source evidence must not be created as canonical.
11. **EXR-11 — No Unknown Relationship:** A Relationship outside the approved ontology or without resolved participants must not be created.
12. **EXR-12 — No Inferred Entity:** Inference must not produce a canonical Entity.
13. **EXR-13 — No Inferred Relationship:** Inference, co-occurrence, or plausibility must not produce a canonical Relationship.
14. **EXR-14 — Preserve Missing Data:** Missing Identity, Authority, Evidence, Lifecycle, Version, Scope, or direction must remain missing.
15. **EXR-15 — No Silent Entity Merge:** Duplicate or similar Entity candidates must not be silently merged.
16. **EXR-16 — No Silent Relationship Merge:** Duplicate or similar Relationship candidates must not be silently merged.
17. **EXR-17 — Independent Relationship Authority:** Relationship authority must be evaluated independently of participating Entity authority.
18. **EXR-18 — Evidence Traceability:** Every Entity and Relationship candidate must retain precise, independently verifiable evidence.
19. **EXR-19 — Lifecycle Awareness:** Extraction and validation must preserve Lifecycle and evaluate applicability.
20. **EXR-20 — Version Awareness:** Extraction and validation must preserve source and assertion Version context.
21. **EXR-21 — Scope Preservation:** Extraction must not broaden canonical Scope.
22. **EXR-22 — Implementation Independence:** Extraction architecture must not depend on a parser, pattern system, LLM, prompt, graph, database, API, or framework.
23. **EXR-23 — Validation Not Correction:** Validation must not modify, merge, delete, repair, or approve candidates.
24. **EXR-24 — Validation Not Inference:** Validation must not fill gaps or create semantic assertions.
25. **EXR-25 — Eligible Sources Only:** Runtime, logs, telemetry, observations, metrics, Execution State, chat history, generated reasoning, and LLM output must not establish extracted architecture.
26. **EXR-26 — Source Primacy:** Canonical sources must remain authoritative over every extraction result.
27. **EXR-27 — Authority Not Popularity:** Frequency, adoption, co-occurrence, or implementation usage must not establish authority.
28. **EXR-28 — Director Governance:** Normative conflict, correction approval, scope change, and canonical modification must remain Director-governed.
29. **EXR-29 — No Execution Side Effect:** Extraction or validation must not authorize or trigger execution.
30. **EXR-30 — Failure Closed:** Unresolved identity, type, authority, evidence, lifecycle, version, scope, or relationship direction must prevent canonical promotion.

## Principles

- Canonical evidence precedes extraction.
- Concept meaning governs Entity Type.
- Entity and Relationship assertions require separate evidence and authority.
- Extraction remains derived and read-only.
- Validation exposes defects without repairing them.
- Missing and conflicting information remains visible.
- Implementation choices remain outside the architecture contract.

## Enterprise Example

A source names a Capability and separately states that a Department owns it. A conformant extraction produces candidates only when the source canonically establishes each Entity and the Owns assertion. Validation checks identity, ontology type, direction, authority, evidence, lifecycle, version, and scope. Missing ownership authority yields a finding; it is not inferred from hierarchy or repaired.

## Design Notes

- Rule identifiers are unique statement identities within this document.
- These rules define architecture conformance, not executable rules or parser behavior.
- Candidate status does not weaken the prohibition on hallucinated content.
- Future implementation requires a separate Director-approved architecture gate.
- Knowledge Graph design remains entirely deferred.

## Common Mistakes

- Turning terminology matching into Entity creation.
- Treating extraction output as canonical source.
- Deriving Relationships from proximity.
- Merging duplicates to simplify output.
- Using Runtime facts to complete Architecture.
- Embedding correction inside validation.
- Choosing implementation technology in an architecture rule.

## Related Architecture

- [06 — Architecture Ingestion Design Rules](06-design-rules.md)
- [12 — Architecture Document Model Design Rules](12-document-model-design-rules.md)
- [18 — Architecture Ontology Design Rules](18-ontology-design-rules.md)
- [19 — Canonical Entity Model](19-entity-model.md)
- [20 — Canonical Relationship Model](20-relationship-model.md)
- [21 — Architecture Extraction Principles](21-extraction-principles.md)
- [22 — Architecture Extraction Boundaries](22-extraction-boundaries.md)
- [23 — Extraction Validation Model](23-validation-model.md)

