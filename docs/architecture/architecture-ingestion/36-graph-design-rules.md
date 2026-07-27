# 36 — Architecture Knowledge Graph Design Rules

## Definition

The **Graph Design Rules** are the normative conformance criteria for technology-independent Architecture Knowledge Graphs. A design violating a **must** or **must not** rule below is not Phase 11F-conformant.

## Why

The Graph must preserve canonical meaning as Representations, versions, scopes, and future technologies change. These rules prevent source displacement, authority reinterpretation, inference, identity duplication, lifecycle confusion, silent repair, and implementation coupling.

## Mental Model

```text
Canonical sources
        ↓
Validated Canonical Representation
        ↓ constrained deterministic projection
Conformant Architecture Knowledge Graph

The Graph preserves upstream semantics.
It creates no truth or authority.
```

## Core Components

### Canonical Rules

1. **KGR-01 — Not Canonical Source:** A Graph must not be treated as a canonical architecture source.
2. **KGR-02 — Representation Derivation:** A Graph must derive only from an explicitly identified, applicable, validated Canonical Representation.
3. **KGR-03 — No Authority Creation:** A Graph must not create, amplify, transfer, or replace authority.
4. **KGR-04 — No Authority Reinterpretation:** Authority meaning and Scope must not be reinterpreted within the Graph.
5. **KGR-05 — No Inference:** A Graph must not generate or silently include inferred Entities, Relationships, or authority.
6. **KGR-06 — Implementation Independence:** Graph semantics must not depend on database, format, query language, API, parser, platform, or framework.
7. **KGR-07 — Deterministic Projection:** The same validated Representation version and governing rules must yield the same semantic Graph.
8. **KGR-08 — Traceability:** Every Graph component must remain traceable through Representation provenance to canonical evidence.
9. **KGR-09 — Unique Graph Identity:** Distinct Graphs must not share one identity within an authoritative scope.
10. **KGR-10 — No Duplicate Graph Identity:** One Graph must not receive duplicate identities because carriers, databases, or locations differ.
11. **KGR-11 — Graph and Representation Separation:** A Graph must not be equated with its source Representation.
12. **KGR-12 — Graph and Runtime Separation:** A Graph must not contain or become Runtime state, memory, telemetry, cache, or operational dependency.
13. **KGR-13 — Graph and Implementation Separation:** A Graph must not be equated with a graph database, technical graph model, or API.
14. **KGR-14 — Semantic Integrity:** Ontology, Entity, Relationship, and Representation meanings must be preserved without alteration.
15. **KGR-15 — Identity Integrity:** Graph and component identities must remain stable, unique, and correctly mapped.
16. **KGR-16 — Relationship Integrity:** Relationship Type, participants, direction, authority, evidence, lifecycle, version, and scope must be preserved.
17. **KGR-17 — Evidence Integrity:** Missing or broken evidence must remain visible and must not be synthesized.
18. **KGR-18 — Scope Integrity:** Graph Scope must not exceed Representation or source Scope.
19. **KGR-19 — Version Integrity:** Graph Version must identify and remain compatible with input Representation Version.
20. **KGR-20 — Provenance Preservation:** Graph and component provenance must remain unbroken and historical.
21. **KGR-21 — Lifecycle Separation:** Graph Lifecycle must not be equated with source, Representation, Entity, Relationship, or Runtime lifecycle.
22. **KGR-22 — Finding Preservation:** Upstream and Graph-specific Validation Findings must remain visible.
23. **KGR-23 — Validation Not Repair:** Validation must not add, remove, connect, disconnect, merge, reverse, normalize, or reinterpret Graph components.
24. **KGR-24 — Disconnection Neutrality:** Disconnected components must be evaluated against Scope and evidence, not automatically repaired or rejected.
25. **KGR-25 — Approval Boundary:** Graph approval must confirm projection conformance only and must not approve new architecture.
26. **KGR-26 — Failure Closed:** Unresolved identity, authority, evidence, provenance, scope, lifecycle, version, or integrity must prevent approved promotion.
27. **KGR-27 — Director Governance:** Approval, lifecycle disposition, conflict resolution, and canonical change remain Director-governed.
28. **KGR-28 — No Execution Side Effect:** Graph creation or validation must not authorize or trigger execution.

## Principles

- Canonical sources remain authoritative.
- Representation is the only permitted Graph input.
- Graph connectivity preserves semantic meaning without inference.
- Authority is carried as provenance and never reinterpreted.
- Validation observes without repair.
- Graph Lifecycle remains independent.
- Implementation technology remains replaceable and deferred.

## Enterprise Example

A Graph projection is recreated on a future platform from the same Approved Representation version. The semantic Graph identity, components, direction, evidence, authority, scope, provenance, lifecycle context, and findings remain identical. Platform topology or query behavior cannot add or alter architectural Relationships.

## Design Notes

- Rule identifiers are unique statement identities within this document.
- Conformance is semantic and governance-based, not database validation.
- The Graph remains derived knowledge even when Approved.
- No graph database, property model, RDF/OWL model, query language, API, parser, or UI is authorized.
- Technical realization requires a separate Director-approved architecture phase.

## Common Mistakes

- Calling the most accessible Graph canonical.
- Adding plausible relationships for connectivity.
- Letting a database assign canonical identities.
- Hiding disconnected components or findings.
- Reinterpreting authority through topology.
- Copying Representation Lifecycle into Graph Lifecycle.
- Repairing Graph content during validation.

## Related Architecture

- [18 — Architecture Ontology Design Rules](18-ontology-design-rules.md)
- [24 — Architecture Extraction Design Rules](24-extraction-design-rules.md)
- [30 — Architecture Knowledge Representation Design Rules](30-representation-design-rules.md)
- [31 — Architecture Knowledge Graph Model](31-knowledge-graph-model.md)
- [32 — Architecture Knowledge Graph Components](32-graph-components.md)
- [33 — Architecture Knowledge Graph Integrity](33-graph-integrity.md)
- [34 — Architecture Knowledge Graph Boundaries](34-graph-boundaries.md)
- [35 — Architecture Knowledge Graph Validation](35-graph-validation.md)

