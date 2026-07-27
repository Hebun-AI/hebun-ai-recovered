# 26 — Representation Components

## Definition

**Representation Components** are the governed semantic elements that together form an Architecture Knowledge Representation. Each component preserves its own identity, meaning, provenance, authority context, lifecycle, version, and scope where applicable.

A Representation is not a Knowledge Graph, Database, Runtime, or Inference.

## Why

A Representation that carries only Entities and Relationships loses the evidence and governance context required to trust them. The component model keeps identity, metadata, evidence, references, findings, authority, scope, and version available for independent verification.

## Mental Model

```text
Architecture Knowledge Representation
├── Canonical Entities and Relationships
├── Canonical Identity and Metadata
├── Evidence and References
├── Validation Findings
└── Authority, Scope, and Version context

Components form a semantic whole.
They do not become database records or graph elements.
```

## Core Components

- **Canonical Entity:** validated, source-evidenced architectural subject conforming to Phase 11D.
- **Canonical Relationship:** validated assertion using a Phase 11C Relationship Type with resolved participants and direction.
- **Canonical Identity:** stable identities for Representation and represented semantic objects.
- **Canonical Metadata:** source-evidenced descriptive and governance context.
- **Canonical Evidence:** precise support enabling independent verification.
- **Canonical References:** typed, resolved architecture references that transfer no authority.
- **Canonical Validation Findings:** retained validation outcomes, including unresolved defects; “canonical” means faithfully recorded finding, not approved architecture.
- **Canonical Authority:** applicable source authority recorded without transfer or amplification.
- **Canonical Scope:** explicit boundary within which represented assertions apply.
- **Canonical Version:** governed version context of Representation and represented assertions.

## Principles

1. Every component must remain traceable to applicable sources or validation evidence.
2. Component identities must remain distinct and non-duplicative.
3. Entity and Relationship components must retain Phase 11D semantics.
4. Metadata and References must retain Phase 11B semantics.
5. Concept and Relationship meanings must retain Phase 11C ontology semantics.
6. Validation Findings must not be omitted merely to present a clean Representation.
7. Authority, Scope, and Version must be evaluated per assertion where required.
8. Component inclusion must not make a non-canonical assertion canonical.
9. A Representation must preserve unresolved status rather than synthesize completeness.

## Enterprise Example

A Department Entity and Capability Entity are represented with an Owns Relationship. The same Representation includes exact source statements, approved metadata, applicable versions, source authority, and a finding that one secondary reference is broken. The finding remains visible; inclusion does not repair it or invalidate unrelated supported components automatically.

## Design Notes

- Components are semantic roles, not fields, tables, nodes, triples, or documents.
- A component may cite multiple evidence locations only when their compatibility is explicit.
- Canonical Validation Findings preserve validated facts about conformance, not architectural truth beyond sources.
- Representation-level context does not erase component-level context.
- No component serialization or cardinality mechanism is defined.

## Common Mistakes

- Representing Entities without evidence.
- Dropping findings after validation.
- Treating References as Relationships automatically.
- Applying one authority or version indiscriminately to every component.
- Converting components into a database schema.
- Calling any included item canonical solely because it is represented.
- Equating the component collection with Runtime memory.

## Related Architecture

- [10 — Architecture Reference Model](10-architecture-reference-model.md)
- [11 — Document Metadata Model](11-document-metadata-model.md)
- [16 — Semantic Relationships](16-semantic-relationships.md)
- [19 — Canonical Entity Model](19-entity-model.md)
- [20 — Canonical Relationship Model](20-relationship-model.md)
- [23 — Extraction Validation Model](23-validation-model.md)
- [25 — Architecture Knowledge Representation Model](25-knowledge-representation-model.md)

