# 18 — Architecture Ontology Design Rules

## Definition

The **Architecture Ontology Design Rules** are the normative conformance criteria for canonical Concept meaning, identity, classification, and semantic relationships. Violation of a **must** or **must not** statement makes a design non-conformant with Phase 11C.

## Why

Semantic consistency must survive renaming, version change, source conflict, and future implementation choices. These rules protect canonical meaning from duplication, silent merging, inferred authority, Runtime contamination, and technology coupling.

## Mental Model

```text
Canonical evidence and authority
        ↓ govern
Concept identity, definition, and relationships
        ↓ constrain
Future representations

No representation becomes authority by implementation.
```

## Core Concepts

### Canonical Rules

1. **OCR-01 — Stable Identity:** Concept Identity must remain stable across Display Name, Alias, document location, and representation changes.
2. **OCR-02 — Mutable Display Name:** A Display Name may change only with traceable governance and must not automatically create a new identity.
3. **OCR-03 — Definition Authority:** A canonical Definition must carry traceable authority from an applicable canonical source.
4. **OCR-04 — Alias Non-authority:** An Alias must not create, transfer, or increase authority.
5. **OCR-05 — Semantic Relationships:** A Relationship must express declared architectural meaning rather than implementation connectivity.
6. **OCR-06 — Implementation Independence:** Ontology must remain independent of format, database, graph, schema, API, parser, model, and framework.
7. **OCR-07 — Not a Graph:** Ontology must not be equated with a Knowledge Graph or graph topology.
8. **OCR-08 — Not Runtime:** Ontology must not contain or become Runtime state.
9. **OCR-09 — Not a Parser:** Ontology must not define extraction, parsing, matching, or ingestion mechanics.
10. **OCR-10 — Unique Concept Identity:** Two distinct Concepts must not share one identity within an authoritative scope.
11. **OCR-11 — No Duplicate Meaning:** One canonical meaning must not receive duplicate identities because labels or sources differ.
12. **OCR-12 — No Silent Definition Merge:** Conflicting Definitions must remain visible and must not be silently combined.
13. **OCR-13 — Canonical Authority Only:** Authority must originate only from applicable canonical source evidence.
14. **OCR-14 — Lifecycle-aware Authority:** Concept applicability and normative force must be evaluated with Lifecycle.
15. **OCR-15 — Deprecation Preservation:** A Deprecated Concept must not be automatically deleted or erased from history.
16. **OCR-16 — Version Traceability:** Definition and relationship assertions must retain their applicable Version.
17. **OCR-17 — Definition Not Inference:** Inference must not be represented as a canonical Definition.
18. **OCR-18 — Authority Not Popularity:** Frequency, adoption, implementation, or popularity must not establish authority.
19. **OCR-19 — Concept Separation:** Concept must remain distinct from Document, Word, Section, and Knowledge Graph Node.
20. **OCR-20 — Relationship Separation:** Relationship must remain distinct from Runtime Edge, graph edge, Execution Flow, and foreign key.
21. **OCR-21 — Source Primacy:** Ontology must remain subordinate to canonical architecture documents.
22. **OCR-22 — Evidence Traceability:** Every canonical Definition and Relationship must retain independently verifiable evidence.
23. **OCR-23 — No Authority Transfer:** Classification, aliasing, referencing, or relating must not transfer authority.
24. **OCR-24 — No Inheritance Assumption:** Taxonomy classification must not imply inheritance or inherited properties.
25. **OCR-25 — Director Governance:** Conflict resolution, canonical change, approval, exception, and scope expansion must remain Director-governed.
26. **OCR-26 — Runtime Separation:** Observation, telemetry, logs, and operational behavior must not silently redefine Concepts.
27. **OCR-27 — Read-only Semantics:** Ontology interpretation must not mutate canonical sources.
28. **OCR-28 — Failure Closed:** Unresolved identity, Definition, Scope, Authority, Lifecycle, Version, or Evidence must not be promoted to canonical truth.

## Principles

- Meaning precedes classification and representation.
- Identity survives presentation change.
- Definition authority comes from canonical evidence.
- Ambiguity and conflict remain explicit.
- Semantic relationships do not become operational connections.
- Lifecycle preserves applicability and history.
- Director governance remains the final architectural gate.

## Enterprise Example

Two documents use “Agent” with different apparent scopes. A conformant ontology compares canonical Definition, Scope, Authority, Lifecycle, Version, and Evidence. It neither merges the meanings because the word matches nor creates duplicate identities immediately. Ambiguity remains explicit until canonical evidence or Director governance resolves it.

## Design Notes

- Rule identifiers are statement identities local to this normative document.
- These rules define conformance, not validation software.
- Deprecation changes applicability, not historical existence.
- A future representation may be graph-shaped without making Ontology and Knowledge Graph equivalent.
- No technical selection or implementation authorization is implied.

## Common Mistakes

- Treating aliases as canonical Definitions.
- Generating identities from display labels.
- Merging source conflicts into a convenient composite meaning.
- Letting taxonomy categories imply inherited behavior.
- Treating Runtime adoption as proof of canonicality.
- Deleting Deprecated concepts.
- Selecting a graph technology as part of ontology design.

## Related Architecture

- [02 — Ingestion Principles](02-ingestion-principles.md)
- [04 — Source of Truth](04-source-of-truth.md)
- [12 — Architecture Document Model Design Rules](12-document-model-design-rules.md)
- [13 — Canonical Architecture Concepts](13-canonical-concepts.md)
- [14 — Concept Identity](14-concept-identity.md)
- [15 — Concept Taxonomy](15-concept-taxonomy.md)
- [16 — Semantic Relationships](16-semantic-relationships.md)
- [17 — Ontology Boundaries](17-ontology-boundaries.md)

