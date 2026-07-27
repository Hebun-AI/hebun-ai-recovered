# 14 — Concept Identity

## Definition

**Concept Identity** is the stable semantic identity that distinguishes one Canonical Architecture Concept from every other concept across documents, aliases, display-name changes, and versions.

Concept Identity is not a Display Name. A Concept is not a Document, Word, Section, or Knowledge Graph Node.

## Why

Names change, synonyms emerge, and the same word can carry different meanings. If identity follows labels or locations, the ontology duplicates concepts, merges unrelated meanings, and loses historical continuity. Stable identity allows names and presentations to evolve while preserving canonical meaning and governance.

## Mental Model

```text
Stable Concept Identity
├── Canonical Name
├── Aliases
├── Definition and Scope
├── Authority, Lifecycle, and Version
└── Semantic Relationships

Names may change.
The governed semantic identity remains stable.
```

## Core Concepts

- **Concept Identity:** stable distinction of the semantic object.
- **Canonical Name:** the approved primary human-readable label for the applicable scope and version.
- **Aliases:** recognized alternative labels that aid interpretation but carry no authority.
- **Definition:** the canonically supported meaning of the Concept.
- **Scope:** the domain and conditions within which the Definition applies.
- **Authority:** the canonical source basis governing the Definition.
- **Lifecycle:** the Concept's governed applicability status.
- **Version:** the governed revision context of its Definition.
- **Relationships:** typed semantic connections to other concepts.

Identity is preserved through name changes. A Definition change that materially changes meaning requires governance review to determine whether it is a new version, supersession, or a distinct Concept; ingestion must not decide silently.

## Principles

1. One authoritative scope must contain one identity for one canonical meaning.
2. Identity must not derive solely from a name, alias, path, heading, section, or document.
3. Canonical Name may change without automatically changing identity.
4. Alias must not carry or create authority.
5. Definition and Scope jointly distinguish meaning.
6. Identity claims require canonical evidence.
7. Ambiguous equivalence must remain unresolved.
8. Materially conflicting Definitions must not share one identity through automatic merging.
9. Lifecycle and Version changes must preserve historical traceability.
10. A representation-specific identifier must not become canonical Concept Identity by convenience.

## Enterprise Example

An enterprise renames “Execution Agent” to “Execution Participant” for broader human-and-AI applicability. If canonical governance confirms unchanged meaning and scope, the Concept Identity persists, the new label becomes Canonical Name, and the former name may become an Alias. If the new term introduces materially different responsibilities, equivalence remains unresolved pending Director-governed review.

## Design Notes

- No identifier syntax, namespace format, URI, key, or numbering scheme is prescribed.
- Canonical Name is version-aware but does not substitute for identity.
- A Concept may be defined across multiple canonical sources only when authority and scope are explicitly compatible.
- Alias resolution is semantic interpretation, not evidence of identity by itself.
- Concepts remain independent of any future graph representation.

## Common Mistakes

- Using display text as permanent identity.
- Treating two identical words as one Concept automatically.
- Creating a new identity for a spelling change.
- Giving aliases normative authority.
- Using file paths or section anchors as Concept Identity.
- Merging conflicting Definitions to remove ambiguity.
- Equating Concept Identity with a graph node identifier.

## Related Architecture

- [07 — Architecture Document Model](07-architecture-document-model.md)
- [11 — Document Metadata Model](11-document-metadata-model.md)
- [13 — Canonical Architecture Concepts](13-canonical-concepts.md)
- [04 — Source of Truth](04-source-of-truth.md)

