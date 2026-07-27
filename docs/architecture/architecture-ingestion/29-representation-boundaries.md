# 29 — Representation Boundaries

## Definition

The **Representation Boundary** separates the semantic Architecture Knowledge Representation from technical storage, transport, retrieval, execution, and operational memory.

A Representation is not a Graph Database, Neo4j model, RDF model, OWL model, Property Graph, Triple Store, Runtime Memory, Cache, API Response, Knowledge Graph, Database, Runtime, Inference, or implementation.

## Why

Representation is often mistaken for the technology that may carry it. Binding the semantic contract to a graph, schema, cache, or API would make implementation choices appear canonical and blur Architecture with Runtime. Explicit boundaries preserve technology independence and source authority.

## Mental Model

```text
Architecture Knowledge Representation
        = governed semantic meaning and provenance

Possible future carriers or services
        = separate implementation decisions

Carrier change must not change represented meaning.
```

## Core Components

- **Semantic Boundary:** Representation defines meaning, identity, context, and integrity only.
- **Authority Boundary:** Representation preserves but does not originate source authority.
- **Storage Boundary:** no database, graph, triple store, cache, or persistence structure is prescribed.
- **Transport Boundary:** no API response, message, serialization, or interchange format is prescribed.
- **Runtime Boundary:** Runtime memory, session state, telemetry, and operational state are excluded.
- **Inference Boundary:** Representation contains supported assertions and findings, not generated conclusions.
- **Implementation Boundary:** parser, API, database, UI, retrieval, and platform choices require separate architecture.

## Principles

1. Semantic conformance must not depend on a specific carrier.
2. A technical representation must remain subordinate to the semantic Representation.
3. Storage or transport success must not imply architectural validity.
4. Runtime memory and caches must not become canonical Representation.
5. API output must not establish authority or lifecycle.
6. Graph topology must not redefine Entity or Relationship semantics.
7. Inference must remain outside canonical represented assertions.
8. Implementation metadata must not pollute canonical metadata.
9. Future technology selection requires a separate Director gate.
10. Boundary ambiguity must fail closed.

## Enterprise Example

The same conformant Representation could later be carried by different technologies, provided each preserves identities, evidence, authority, lifecycle, version, scope, findings, and relationship semantics. None of those carriers becomes canonical by adoption, and this phase chooses none.

## Design Notes

- Technology names appear only to define exclusions.
- A future Knowledge Graph may consume a Representation, but it will remain a distinct derived system.
- Runtime caches may accelerate future access but cannot govern meaning.
- An API may expose a Representation but cannot be the Representation's authority.
- No interchange format or implementation contract is implied.

## Common Mistakes

- Treating graph storage as the knowledge model.
- Calling an API payload the canonical Representation.
- Using cache freshness as lifecycle status.
- Letting database constraints define semantic integrity.
- Adding inferred content for retrieval convenience.
- Selecting technology during architecture definition.
- Treating Runtime memory as architectural knowledge.

## Related Architecture

- [04 — Source of Truth](04-source-of-truth.md)
- [05 — Ingestion Boundaries](05-ingestion-boundaries.md)
- [17 — Ontology Boundaries](17-ontology-boundaries.md)
- [22 — Architecture Extraction Boundaries](22-extraction-boundaries.md)
- [25 — Architecture Knowledge Representation Model](25-knowledge-representation-model.md)

