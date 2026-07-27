# 32 — Architecture Knowledge Graph Components

## Definition

**Graph Components** are the governed semantic projection elements required to preserve a Canonical Representation as connected architecture knowledge. They remain traceable representations; they are not database records, Runtime objects, or newly canonical architecture.

A Graph is not a Representation, Runtime, Inference, or Database.

## Why

Connectivity alone is insufficient. A trustworthy Graph must retain the represented objects, metadata, validation context, provenance, scope, version, and authority needed to interpret every connection correctly.

## Mental Model

```text
Architecture Knowledge Graph
├── Entity Representations
├── Relationship Representations
├── Graph Identity and Metadata
├── Graph Validation and Provenance
└── Graph Scope, Version, and Authority

Connectivity is meaningful only with governance context.
```

## Core Components

- **Entity Representation:** faithful graph projection of a Canonical Entity component; not the Entity itself.
- **Relationship Representation:** faithful graph projection of a Canonical Relationship component; not a Runtime flow or database relation.
- **Graph Identity:** stable distinction of the whole graph projection.
- **Graph Metadata:** source-evidenced descriptive and governance context for the Graph.
- **Graph Validation:** retained conformance results and findings for Graph integrity.
- **Graph Provenance:** traceability from each projected component through the Representation to canonical evidence.
- **Graph Scope:** declared boundary of represented architectural knowledge.
- **Graph Version:** governed revision tied to input Representation version.
- **Graph Authority:** preserved authority context from Representation and canonical sources.

## Principles

1. Every Entity Representation must correspond to one resolved Representation component identity.
2. Every Relationship Representation must preserve type, participants, direction, evidence, lifecycle, version, and authority.
3. Graph Metadata must not overwrite canonical metadata.
4. Validation findings must remain visible.
5. Provenance must exist at component and whole-Graph levels.
6. Scope, Version, and Authority must not be generalized across incompatible components.
7. A component must not become canonical because it is present in the Graph.
8. Graph components must not include inferred or Runtime-only objects.
9. Duplicate projections of one component must be reported rather than silently merged.

## Enterprise Example

A Capability Entity Representation and Agent Entity Representation are connected by a Realizes Relationship Representation. The Graph preserves their distinct identities, the exact semantic direction, applicable evidence, versions, scope, and authority. It does not convert the relationship into a Runtime binding or execution connection.

## Design Notes

- “Entity Representation” and “Relationship Representation” intentionally preserve `Entity ≠ Graph projection` and `Relationship ≠ Graph connection implementation`.
- Components define semantic responsibilities, not nodes, edges, properties, or records.
- Graph Validation is evidence about projection conformance, not a repair mechanism.
- Graph Metadata is subordinate to Representation Metadata and source evidence.
- No component cardinality or technical encoding is defined.

## Common Mistakes

- Equating Entity Representation with the canonical Entity.
- Dropping evidence to simplify connectivity.
- Turning Relationship Representation into execution order.
- Assigning one authority to the entire Graph without scope checks.
- Hiding findings from Graph components.
- Treating metadata as graph properties by architectural mandate.
- Adding Runtime objects for completeness.

## Related Architecture

- [19 — Canonical Entity Model](19-entity-model.md)
- [20 — Canonical Relationship Model](20-relationship-model.md)
- [26 — Representation Components](26-representation-components.md)
- [28 — Representation Validation](28-representation-validation.md)
- [31 — Architecture Knowledge Graph Model](31-knowledge-graph-model.md)

