# 34 — Architecture Knowledge Graph Boundaries

## Definition

The **Graph Boundary** separates the technology-independent Architecture Knowledge Graph semantic projection from storage technologies, query languages, Runtime memory, transport, inference, and implementation.

The Graph is not Neo4j, RDF, OWL, a Property Graph, Triple Store, Graph Database, Runtime Memory, Cache, API, canonical source, Representation, Runtime, Inference, or implementation.

## Why

Knowledge Graph architecture is frequently collapsed into a chosen database or standard. That would let implementation topology redefine semantic relationships, make query results appear authoritative, and bind canonical architecture to a replaceable technology. Explicit boundaries preserve meaning and future choice.

## Mental Model

```text
Architecture Knowledge Graph
        = governed semantic connectivity projection

Future graph stores, formats, queries, and services
        = separate implementation architecture

Technology may realize the Graph.
Technology does not define it.
```

## Core Components

- **Source Boundary:** Graph derives only from a validated Canonical Representation.
- **Semantic Boundary:** Graph preserves ontology and Representation meaning without inference.
- **Authority Boundary:** Graph records but does not originate or reinterpret authority.
- **Storage Boundary:** no graph database, triple store, property model, or database is selected.
- **Query Boundary:** no Cypher, Gremlin, SPARQL, or other query contract is defined.
- **Runtime Boundary:** Runtime memory, cache, telemetry, session state, and operational dependencies are excluded.
- **Interface Boundary:** no API, serialization, transport, parser, or UI is defined.
- **Inference Boundary:** Graph contains projected assertions and findings, not generated conclusions.

## Principles

1. Graph semantics must remain independent of storage and query technology.
2. A technical graph must remain subordinate to the canonical Graph architecture.
3. Database connectivity must not establish semantic validity.
4. Query results must not create authority or new canonical assertions.
5. Runtime memory and caches must not become Graph lifecycle or Source of Truth.
6. Graph topology must not redefine ontology Relationship Types.
7. Inference must remain outside canonical Graph content.
8. Implementation metadata must not become architecture metadata.
9. Technology selection requires a separate Director-approved architecture gate.
10. Boundary ambiguity must fail closed.

## Enterprise Example

Two future platforms could implement the same Graph architecture if both preserve Graph Identity, Scope, Authority, Lifecycle, Version, Provenance, Integrity, projected components, and findings. This phase approves neither platform and grants neither authority over canonical meaning.

## Design Notes

- Technology names appear only as explicit exclusions.
- A future graph database may store a Graph but is not the Graph architecture.
- Runtime caches may improve access but cannot define freshness or lifecycle canonically.
- An API may expose Graph content but cannot govern it.
- No graph schema, node schema, edge schema, query model, or storage model is implied.

## Common Mistakes

- Selecting a database while defining the Graph.
- Calling stored data the canonical source.
- Treating query reachability as semantic truth.
- Using cache freshness as Graph Lifecycle.
- Adding inferred connections to improve navigation.
- Allowing implementation identifiers to replace canonical identities.
- Treating an API response as the Graph.

## Related Architecture

- [17 — Ontology Boundaries](17-ontology-boundaries.md)
- [22 — Architecture Extraction Boundaries](22-extraction-boundaries.md)
- [29 — Representation Boundaries](29-representation-boundaries.md)
- [31 — Architecture Knowledge Graph Model](31-knowledge-graph-model.md)

