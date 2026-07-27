# 19 — Canonical Entity Model

## Definition

A **Canonical Entity** is a uniquely identifiable architectural subject explicitly evidenced in applicable canonical sources and classified by one Canonical Concept. It represents a particular governed subject described by architecture; it does not create that subject or its meaning.

Every Entity has:

1. Identity
2. Type
3. Definition
4. Canonical Concept
5. Source Document
6. Source Statement
7. Authority
8. Lifecycle
9. Version
10. Scope

A Concept is not an Entity. A Document is not an Entity. A Statement is not an Entity. A Runtime Object is not an Entity. A Knowledge Graph Node is not an Entity.

## Why

The ontology defines reusable meanings such as Capability or Department. Architecture documents also refer to particular governed subjects that instantiate those meanings. Extraction requires a stable distinction between the semantic category and the particular subject so that names are not promoted into entities and entities are not confused with graph representations.

## Mental Model

```text
Capability                         → Canonical Concept
Customer Management Capability    → Canonical Entity,
                                    only when canonical evidence establishes it

The Concept supplies meaning.
The Entity identifies a particular governed subject.
```

## Core Components

- **Identity:** stable semantic identity of the particular subject across permitted presentation changes.
- **Type:** the applicable Entity classification grounded in a Canonical Concept.
- **Definition:** the source-supported meaning that distinguishes the Entity.
- **Canonical Concept:** the Phase 11C Concept governing the Entity's semantic type.
- **Source Document:** the canonical document supplying evidence.
- **Source Statement:** the normative statement that establishes or governs the Entity.
- **Authority:** the recognized source authority applicable to the Entity claim.
- **Lifecycle:** the applicability status inherited only from explicit source evidence.
- **Version:** the source revision context in which the Entity is established.
- **Scope:** the domain and conditions within which the Entity claim applies.

## Principles

1. An Entity must be explicitly supported by canonical evidence.
2. Entity Identity must remain stable across names, paths, and derived representations.
3. Every Entity must map to one recognized Canonical Concept for the asserted type.
4. A Concept supplies meaning but does not become an Entity.
5. A mention, noun phrase, heading, example, or alias must not automatically create an Entity.
6. Entity authority must come from the applicable source, not extraction.
7. Entity identity and source statement identity must remain distinct.
8. Lifecycle, Version, and Scope must remain attached to the Entity assertion.
9. Unknown or ambiguous identity must remain unresolved.
10. Duplicate candidates must not be silently merged.

## Enterprise Example

“Capability” is the canonical Concept defined by Phase 10 and Phase 11C. “Customer Management Capability” is an Entity only if an applicable canonical document and normative statement explicitly establish that particular enterprise ability. A mention in an example or generated summary is insufficient. The extracted Entity remains traceable to its document, statement, version, lifecycle, scope, and authority.

## Design Notes

- This model defines semantic requirements, not a node schema, entity-recognition method, identifier syntax, or storage structure.
- “Canonical Entity” means canonically evidenced Entity, not a new Source of Truth.
- Multiple sources may evidence one Entity only when identity compatibility is explicitly supportable.
- Entity extraction produces a derived representation; canonical documents retain authority.
- This phase creates no real enterprise Entity catalog.

## Common Mistakes

- Treating every capitalized phrase as an Entity.
- Equating a Concept with one of its particular Entities.
- Using a Document or Statement as the Entity it describes.
- Creating Entity Identity from a path or label.
- Treating Runtime objects as canonical Entities.
- Merging similarly named Entities without evidence.
- Equating an Entity with a graph node.

## Related Architecture

- [07 — Architecture Document Model](07-architecture-document-model.md)
- [09 — Normative Statement Model](09-normative-statement-model.md)
- [13 — Canonical Architecture Concepts](13-canonical-concepts.md)
- [14 — Concept Identity](14-concept-identity.md)
- [18 — Architecture Ontology Design Rules](18-ontology-design-rules.md)

