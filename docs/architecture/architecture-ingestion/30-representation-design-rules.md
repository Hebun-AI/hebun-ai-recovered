# 30 — Architecture Knowledge Representation Design Rules

## Definition

The **Representation Design Rules** are the normative conformance criteria for technology-independent Architecture Knowledge Representations. A design violating a **must** or **must not** rule below is not Phase 11E-conformant.

## Why

Represented knowledge must preserve meaning and governance as sources, versions, carriers, and technologies change. These rules prevent authority creation, inference, lifecycle confusion, identity duplication, silent transformation, and implementation coupling.

## Mental Model

```text
Canonical sources
        ↓ extraction and validation
Conformant semantic Representation
        ↓ may inform future implementation

Source authority remains upstream.
Representation remains traceable and technology-independent.
```

## Core Components

### Canonical Rules

1. **RPR-01 — Read-only Source:** A Representation must not modify canonical sources or their governance metadata.
2. **RPR-02 — No Authority Creation:** A Representation must not create, amplify, transfer, or replace source authority.
3. **RPR-03 — No Inference:** A Representation must not produce or silently include inference as canonical knowledge.
4. **RPR-04 — Implementation Independence:** Representation semantics must not depend on graph, database, format, API, parser, platform, or framework.
5. **RPR-05 — Source Traceability:** Every represented assertion must remain traceable to precise applicable canonical evidence.
6. **RPR-06 — Determinism:** The same validated source state and governing rules must yield the same semantic Representation.
7. **RPR-07 — Unique Representation Identity:** Distinct Representations must not share one identity within an authoritative scope.
8. **RPR-08 — No Duplicate Representation:** One semantic Representation must not receive duplicate identities because carriers or locations differ.
9. **RPR-09 — Validation Not Transformation:** Validation must not add, remove, merge, repair, normalize, or reinterpret Representation components.
10. **RPR-10 — Lifecycle Separation:** Representation Lifecycle must not be equated with Document, Entity, Relationship, or Runtime lifecycle.
11. **RPR-11 — Not a Knowledge Graph:** Representation must not be equated with a Knowledge Graph or graph topology.
12. **RPR-12 — Not Runtime:** Representation must not contain or become Runtime state, memory, telemetry, or cache authority.
13. **RPR-13 — Entity Separation:** An Entity must not be equated with the Representation containing it.
14. **RPR-14 — Relationship Separation:** A Relationship must not be equated with the Representation containing it.
15. **RPR-15 — Metadata Integrity:** Canonical Metadata must retain Phase 11B meaning and evidence.
16. **RPR-16 — Ontology Integrity:** Concepts and Relationship Types must retain Phase 11C meaning.
17. **RPR-17 — Extraction Integrity:** Entities, Relationships, and findings must retain Phase 11D semantics and provenance.
18. **RPR-18 — Scope Preservation:** Representation Scope must be explicit and must not broaden canonical source Scope.
19. **RPR-19 — Authority Integrity:** Authority must be evaluated per applicable source and assertion.
20. **RPR-20 — Evidence Integrity:** Missing or broken Evidence must remain visible and must not be synthesized.
21. **RPR-21 — Version Integrity:** Representation and component Version contexts must remain explicit and compatible.
22. **RPR-22 — Finding Preservation:** Validation Findings must not be hidden or deleted to obtain approval.
23. **RPR-23 — Approval Boundary:** Representation approval must mean conformance approval only and must not approve new architecture.
24. **RPR-24 — Historical Preservation:** Deprecated, Archived, Superseded, and Rejected Representations must retain provenance and history.
25. **RPR-25 — Failure Closed:** Unresolved identity, authority, evidence, scope, version, lifecycle, or integrity must prevent approved promotion.
26. **RPR-26 — Director Governance:** Approval, lifecycle disposition, conflict resolution, and canonical change remain Director-governed.
27. **RPR-27 — No Execution Side Effect:** Representation or validation must not authorize or trigger execution.
28. **RPR-28 — No Technology Authority:** Adoption, storage location, queryability, or operational popularity must not establish authority.

## Principles

- Canonical sources remain primary.
- Representation carries meaning and provenance, not new authority.
- Lifecycle and Version remain explicit and separate.
- Integrity includes evidence, identity, relationships, scope, and traceability.
- Validation observes conformance without transformation.
- Technology remains replaceable.
- Missing and conflicting knowledge remains visible.

## Enterprise Example

A Representation is moved between future storage technologies. Its Representation Identity, components, evidence, authority, lifecycle, version, scope, findings, and provenance remain unchanged. Storage migration cannot approve, transform, or suppress any semantic component.

## Design Notes

- Rule identifiers are unique statement identities in this document.
- Conformance is semantic and governance-based, not format validation.
- “Approved Representation” remains derived knowledge subordinate to approved source architecture.
- No graph, schema, database, API, parser, or UI is authorized.
- Any implementation requires a separate architecture phase and Director gate.

## Common Mistakes

- Calling the most queried copy canonical.
- Using storage identity as Representation Identity.
- Removing findings before approval.
- Treating validation as normalization.
- Copying Document Lifecycle into Representation Lifecycle.
- Letting a graph model redefine semantic Relationships.
- Treating approved Representation as new architecture.

## Related Architecture

- [12 — Architecture Document Model Design Rules](12-document-model-design-rules.md)
- [18 — Architecture Ontology Design Rules](18-ontology-design-rules.md)
- [24 — Architecture Extraction Design Rules](24-extraction-design-rules.md)
- [25 — Architecture Knowledge Representation Model](25-knowledge-representation-model.md)
- [26 — Representation Components](26-representation-components.md)
- [27 — Representation Lifecycle](27-representation-lifecycle.md)
- [28 — Representation Validation](28-representation-validation.md)
- [29 — Representation Boundaries](29-representation-boundaries.md)

