# 17 — Ontology Boundaries

## Definition

The **Canonical Architecture Ontology** is the governed semantic specification of architecture Concepts, their identities, definitions, classifications, and permitted relationship meanings. It describes meaning; it does not store, extract, execute, or operationalize that meaning.

The Ontology is not a Knowledge Graph, Database, RDF model, OWL model, JSON Schema, API, Parser, Vector Database, embedding representation, Runtime, or Execution Engine.

## Why

Ontology work is easily confused with a technical graph or semantic-search implementation. That confusion would allow a derived representation to become the Source of Truth, mix Runtime state into Architecture, and select technology before the semantic contract is governed. Explicit boundaries preserve conceptual authority and future implementation freedom.

## Mental Model

```text
Canonical Architecture Sources
        ↓ establish meaning
Canonical Architecture Ontology
        ↓ may constrain future representations
Future implementation — separately designed and approved

Ontology defines semantics.
It neither stores nor runs them.
```

## Core Concepts

- **Included:** canonical Concept definitions, stable Concept identities, aliases, scope, authority, lifecycle, version, semantic classification, relationship meanings, invariants, and evidence requirements.
- **Excluded representation:** Knowledge Graphs, nodes, edges, RDF, OWL, JSON Schema, graph databases, and database schemas.
- **Excluded interpretation machinery:** parsers, entity extraction, relationship extraction, chunking, prompts, embeddings, RAG, semantic search, and LLM pipelines.
- **Excluded interfaces:** APIs, query languages, persistence contracts, and UI.
- **Excluded operational domains:** Runtime ingestion, Execution ingestion, execution engines, workflow, state, telemetry, and operational control.
- **Excluded authority:** automatic approval, conflict resolution, definition rewriting, and canonical source mutation.

## Principles

1. Ontology must remain subordinate and traceable to canonical sources.
2. It must be implementation-independent.
3. It must not become the canonical store merely because it is structured.
4. It must not observe or ingest Runtime or Execution state.
5. It must not prescribe a node, edge, class, table, field, or serialization schema.
6. It must not perform extraction, matching, ranking, retrieval, or inference.
7. It must not authorize action or replace Director governance.
8. A future implementation must pass a separate architecture gate.
9. Representation defects must not silently rewrite semantic definitions.
10. Ontology scope expansion requires explicit governance.

## Enterprise Example

The Ontology states that an Agent may **Realize** a Capability and that the two retain separate identities. A future Knowledge Graph might represent that assertion, but the Ontology neither defines a node or edge nor selects a graph technology. A Runtime binding event remains operational evidence and cannot modify the canonical relationship meaning.

## Design Notes

- “Ontology” here means a canonical semantic contract, not a commitment to any industry serialization standard.
- Human-readable normative documents remain the canonical carrier in this phase.
- Machine interpretability is a future representation concern constrained by, but not included in, this architecture.
- The boundary allows future technologies to change without changing Concept Identity.
- Logs and telemetry may become evidence in a separately governed future model but are excluded here.

## Common Mistakes

- Designing graph nodes and calling them Concepts.
- Selecting RDF, OWL, or a graph database during semantic definition.
- Treating ontology as a parser specification.
- Adding Runtime entities to make the ontology “complete.”
- Using embeddings or usage frequency to establish authority.
- Allowing generated relationships to become canonical.
- Assuming structured semantics are already an implementation.

## Related Architecture

- [05 — Ingestion Boundaries](05-ingestion-boundaries.md)
- [06 — Architecture Ingestion Design Rules](06-design-rules.md)
- [12 — Architecture Document Model Design Rules](12-document-model-design-rules.md)
- [13 — Canonical Architecture Concepts](13-canonical-concepts.md)
- [16 — Semantic Relationships](16-semantic-relationships.md)

