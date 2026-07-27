# 12 — Architecture Document Model Design Rules

## Definition

The **Architecture Document Model Design Rules** are the normative conformance criteria for any future representation or interpretation of canonical architecture documents. A design violating a **must** or **must not** statement below is not Phase 11B-conformant.

## Why

A vocabulary is insufficient unless its boundaries survive implementation choices, document variation, and governance change. These rules protect stable identity, human understanding, machine interpretation, normative meaning, evidence, authority, lifecycle, and Runtime separation without selecting technology.

## Mental Model

```text
Canonical document meaning
        ↓ constrained by these rules
Faithful future representation

Representation may change.
Identity, meaning, provenance, and authority must not drift.
```

## Core Components

The rules govern document identity and carriers; semantic sections; statement identity and classification; metadata, lifecycle, version, evidence, and authority; reference integrity; ambiguity, conflict, supersession, and exceptions; and separation from derived knowledge, inference, Runtime, and implementation.

### Canonical Rules

1. **DMR-01 — Canonical Identity:** Every document must have one stable identity within an authoritative model scope.
2. **DMR-02 — Identity Independence:** Identity must not equal or depend solely on path, filename, title, URL, format, or content hash.
3. **DMR-03 — Human Readability:** Canonical meaning must remain independently understandable by authorized human reviewers.
4. **DMR-04 — Machine Interpretability:** Semantic roles and governance context must be expressible without making a machine representation canonical.
5. **DMR-05 — Normative Separation:** Normative statements must remain distinct from explanation, examples, inference, and Runtime observations.
6. **DMR-06 — Semantic Sections:** Section meaning must not derive solely from heading, position, depth, or emphasis.
7. **DMR-07 — Authority Evaluation:** Authority must be evaluated from governance evidence, scope, lifecycle, and version.
8. **DMR-08 — No Authority Transfer:** Representation, reference, copying, indexing, ingestion, or derivation must not transfer authority.
9. **DMR-09 — Evidence Traceability:** Every canonical assertion must retain independently verifiable evidence.
10. **DMR-10 — Reference Semantics:** References must preserve type and imply no dependency, inheritance, or approval.
11. **DMR-11 — Broken Reference Handling:** Broken references must remain visible, not be silently repaired or called conflicts by default.
12. **DMR-12 — Lifecycle Awareness:** Draft, Approved, Deprecated, and Archived content must remain distinguishable.
13. **DMR-13 — Version Awareness:** Every statement and metadata assertion must remain associated with its document version.
14. **DMR-14 — No Hallucinated Metadata:** Missing identity, authority, owner, approval, lifecycle, version, or relationship metadata must not be invented.
15. **DMR-15 — No Silent Ambiguity Resolution:** Ambiguous content, scope, identity, reference, or authority remains explicit until governed resolution.
16. **DMR-16 — Unique Statement Identity:** Distinct normative statements must not share an identity in one authoritative model scope.
17. **DMR-17 — Supersession Integrity:** Supersession and deprecation must be explicit, authority-supported, version-aware, and traceable.
18. **DMR-18 — Exception Integrity:** An Exception must identify its norm, authority, scope, applicability, and evidence.
19. **DMR-19 — Metadata Separation:** Metadata must remain distinct from content, derived knowledge, inference, and Runtime state.
20. **DMR-20 — Source Primacy:** Canonical documents remain authoritative over derivatives.
21. **DMR-21 — Derived Knowledge Boundary:** An index, summary, Knowledge Graph, or derivative must not become canonical by convenience or repetition.
22. **DMR-22 — Inference Boundary:** Inference remains labelled and must not fill canonical gaps or alter normative meaning.
23. **DMR-23 — Runtime Separation:** Runtime state, logs, telemetry, execution evidence, and observed behavior must not become architecture automatically.
24. **DMR-24 — Director Authority:** Approval, change, exception, and conflict resolution remain Director-governed.
25. **DMR-25 — Read-only Ingestion:** Interpretation must not mutate canonical sources.
26. **DMR-26 — No Execution Side Effects:** Document interpretation must not authorize or trigger execution.
27. **DMR-27 — No Implementation Dependency:** The model must not depend on a file format, parser, ontology, graph, database, API, LLM, or framework.
28. **DMR-28 — Source Classification:** Architecture, Policy, Runbook, Specification, and generated artifacts retain distinct classifications and authority.
29. **DMR-29 — Failure Closed:** Unresolved evidence, identity, lifecycle, version, or authority prevents promotion to canonical truth.
30. **DMR-30 — Historical Preservation:** Version, deprecation, supersession, review, and archive history remains traceable.

## Principles

- Meaning precedes representation.
- Evidence precedes interpretation.
- Authority remains at the governed source.
- Human reviewability and machine interpretability are complementary.
- Ambiguity and conflict are review outcomes, not invitations to invention.
- Historical truth remains traceable when applicability changes.
- Architecture remains independent of Runtime and implementation.

## Enterprise Example

A future mechanism reads two carriers apparently describing one Approved document. It may associate them only when identity and governance evidence support that conclusion. It preserves one document identity, distinct locators, version and lifecycle, typed statements, and evidence. If they disagree, ambiguity or conflict is exposed for Director governance; content is neither merged nor selected by recency.

## Design Notes

- Rule identifiers are unique in this document and identify design statements, not implementation checks.
- Conformance requires semantic and governance fidelity, not structural completeness alone.
- Machine-interpretable does not approve an ontology, graph, parser, schema, or extraction pipeline.
- Runtime evidence may support future review but cannot rewrite canonical architecture.
- These rules constrain future phases without starting them.

## Common Mistakes

- Designing identifiers around paths.
- Treating a normalized representation as more authoritative than sources.
- Using heading order to calculate authority.
- Generating missing metadata from conventions.
- Auto-merging ambiguity or conflict.
- Letting references transfer approval.
- Building an ontology, pipeline, or schema under the document-model label.
- Mixing Runtime state with lifecycle.

## Related Architecture

- [02 — Ingestion Principles](02-ingestion-principles.md)
- [04 — Source of Truth](04-source-of-truth.md)
- [06 — Architecture Ingestion Design Rules](06-design-rules.md)
- [07 — Architecture Document Model](07-architecture-document-model.md)
- [08 — Document Structure and Sections](08-document-structure-and-sections.md)
- [09 — Normative Statement Model](09-normative-statement-model.md)
- [10 — Architecture Reference Model](10-architecture-reference-model.md)
- [11 — Document Metadata Model](11-document-metadata-model.md)
- [Phase 8 — Execution Architecture Closure](../execution-review/10-phase-8-final-closure.md)

