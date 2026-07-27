# 07 — Architecture Document Model

## Definition

The **Architecture Document Model** defines an architecture document as a governed semantic object that communicates architectural truth within a declared scope. It is independent of its physical carrier.

An Architecture Document consists of **Identity, Metadata, Structured Content, Normative Statements, References, Evidence, Lifecycle, Version, and Authority**.

An Architecture Document is not a physical file. Markdown, PDF, or another carrier may present a document, but the carrier does not establish its semantic identity. Document Identity is not a path, filename, URL, repository location, title, or content hash.

## Why

Safe ingestion requires a stable object of interpretation. Treating files as documents makes architectural identity change when content moves or format changes, hides lifecycle and authority, and encourages prose to be interpreted without governance context. This model preserves meaning, provenance, and authority before any future extraction or representation.

## Mental Model

```text
Governed Architecture Document
├── stable identity and metadata
├── structured content and normative statements
├── references and evidence
└── lifecycle, version, and authority

Physical Carrier
└── presents the document; does not define its identity or authority
```

## Core Components

- **Identity** distinguishes the governed document across locations, carriers, and versions.
- **Metadata** describes classification, stewardship, approval, review, and relationships.
- **Structured Content** organizes meaning into semantic sections.
- **Normative Statements** express governed architectural commitments.
- **References** create explicit, typed relationships to other architectural objects.
- **Evidence** enables independent verification of source and meaning.
- **Lifecycle** states whether the document is Draft, Approved, Deprecated, or Archived.
- **Version** identifies the governed revision to which content belongs.
- **Authority** records the recognized basis and scope of normative force.

These components retain distinct responsibilities. None may be inferred from file placement alone.

## Principles

1. Document identity must remain stable when a path or format changes.
2. A physical file must not be assumed to contain exactly one canonical document.
3. Lifecycle, version, authority, and evidence must be known before statements are canonical.
4. Content and metadata must remain distinguishable.
5. Normative statements must remain distinguishable from explanation, examples, and inference.
6. A document may be human-readable and machine-interpretable without becoming a storage schema.
7. Unknown or ambiguous properties must be declared unresolved, never invented.
8. Every derivative must preserve identity and provenance while remaining subordinate.

## Enterprise Example

An Approved boundary document is moved to a new folder and published in a second readable format. Its governed identity remains unchanged; only carrier locators change. A revised approved edition receives a distinct version while retaining document identity. The prior version remains historical evidence rather than becoming different architecture because its filename changed.

## Design Notes

- This is a conceptual, normative model; it defines no parser, schema, API, storage, or extraction algorithm.
- Similar files are not automatically manifestations of one document; equivalence requires governance evidence.
- Version identifies a governed revision; lifecycle describes applicability.
- Authority comes from governance evidence and scope, not typography, position, or repetition.
- The document remains canonical; any future graph or index is derived knowledge.

## Common Mistakes

- Equating a Markdown file with an Architecture Document.
- Using a path as canonical identity.
- Treating a title or filename as authority.
- Collapsing versions into one mutable record.
- Promoting metadata, summaries, or indexes into normative content.
- Inventing missing owner, approval, version, or lifecycle values.

## Related Architecture

- [01 — Why Architecture Ingestion](01-why-architecture-ingestion.md)
- [03 — Architecture Document Lifecycle](03-document-lifecycle.md)
- [04 — Source of Truth](04-source-of-truth.md)
- [Phase 7 — Director Intelligence Closure](../director-review/10-phase-7-final-closure.md)
- [Phase 9 — Enterprise Architecture Closure](../enterprise-review/11-phase-9-final-closure.md)

