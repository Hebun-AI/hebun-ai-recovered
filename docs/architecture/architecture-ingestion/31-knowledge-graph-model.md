# 31 — Architecture Knowledge Graph Model

## Definition

An **Architecture Knowledge Graph** is a uniquely identifiable, technology-independent semantic projection of one applicable, validated Architecture Knowledge Representation. It preserves represented Entity and Relationship meaning, identity, evidence, scope, version, authority context, provenance, and integrity without becoming their canonical source.

Every Graph has:

1. Graph Identity
2. Graph Scope
3. Graph Authority
4. Graph Lifecycle
5. Graph Version
6. Graph Provenance
7. Graph Integrity

The Graph is derived only from a Canonical Representation. The Graph is not a canonical source.

## Why

A validated Representation defines a trustworthy semantic whole. A graph architecture makes its explicit relationships navigable as connected architectural knowledge while preserving all upstream governance. Without a separate graph model, connectivity may be mistaken for authority, inference, Runtime dependency, or implementation topology.

## Mental Model

```text
Canonical Architecture Sources
        ↓
Validated Canonical Representation
        ↓ deterministic semantic projection
Architecture Knowledge Graph

Authority and meaning flow from upstream.
The Graph adds no architectural truth.
```

## Core Components

- **Graph Identity:** stable identity of one graph projection across carriers and implementations.
- **Graph Scope:** explicit Representation scope projected by the Graph.
- **Graph Authority:** provenance of applicable source authority; never authority originated by the Graph.
- **Graph Lifecycle:** Created, Validated, Approved, Deprecated, Archived, Superseded, or Rejected status of the Graph projection.
- **Graph Version:** governed revision of the Graph associated with a specific Representation version.
- **Graph Provenance:** unbroken traceability through Representation components to canonical source evidence.
- **Graph Integrity:** conformance of identity, relationships, authority, evidence, version, scope, and traceability.

## Principles

1. A Graph must derive from exactly identified, applicable Representation input.
2. Graph Identity must remain distinct from Representation, Entity, Relationship, and storage identities.
3. Graph Scope must not exceed Representation Scope.
4. Graph Authority must not exceed or reinterpret Representation and source authority.
5. Graph Lifecycle must remain distinct from Representation and source lifecycles.
6. Graph Version must identify its input Representation version.
7. Projection must be deterministic for the same approved input and governing rules.
8. The Graph must preserve upstream validation findings.
9. The Graph must not add inferred Entities, Relationships, or authority.

## Enterprise Example

An Approved Representation contains Department and Capability Entity representations plus an Owns Relationship representation. The Graph projects those components and their evidence so the semantic connection can be navigated. It cannot add an Authorizes relationship because organizational ownership makes it plausible, nor can it make the Owns assertion more authoritative.

## Design Notes

- “Graph” names a semantic connectivity projection, not a graph database or data model.
- Graph approval confirms projection conformance within declared scope, not new architecture.
- A Graph may expose disconnected components when the Representation contains them; validation determines whether this is expected.
- No node, edge, query, storage, traversal, or serialization model is defined.
- Historical Graph versions remain traceable to historical Representation versions.

## Common Mistakes

- Calling the Graph the Source of Truth.
- Using database identity as Graph Identity.
- Expanding Graph Scope for connectivity.
- Inferring missing relationships.
- Treating Graph approval as architectural approval.
- Copying source lifecycle into Graph Lifecycle.
- Equating semantic graph with graph storage.

## Related Architecture

- [04 — Source of Truth](04-source-of-truth.md)
- [16 — Semantic Relationships](16-semantic-relationships.md)
- [25 — Architecture Knowledge Representation Model](25-knowledge-representation-model.md)
- [30 — Architecture Knowledge Representation Design Rules](30-representation-design-rules.md)

