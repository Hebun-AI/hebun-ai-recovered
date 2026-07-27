# 20 — Canonical Relationship Model

## Definition

A **Canonical Relationship** is a uniquely identifiable, source-evidenced assertion that two Canonical Entities participate in one relationship type defined by the Phase 11C ontology.

Every Relationship has:

1. Identity
2. Relationship Type
3. Source Entity
4. Target Entity
5. Authority
6. Evidence
7. Lifecycle
8. Version

A Semantic Relationship is not a Graph Edge. A Relationship is not an Execution Flow, Runtime Dependency, database relation, workflow transition, or authority transfer.

## Why

Entity extraction without governed relationship meaning produces ambiguous connectivity. The Relationship Model ensures that direction, evidence, authority, lifecycle, and version are validated independently and that only ontology-approved meanings are used.

## Mental Model

```text
Source Entity ── ontology-approved Relationship Type ──▶ Target Entity
      │                         │                              │
      └──────── canonical evidence and authority ─────────────┘

This is a semantic assertion, not an operational connection.
```

## Core Components

- **Identity:** stable distinction of the relationship assertion.
- **Relationship Type:** one of Defines, References, Depends On, Constrains, Authorizes, Observes, Measures, Realizes, Owns, Governed By, Supersedes, or Related To.
- **Source Entity:** the canonically evidenced origin participant.
- **Target Entity:** the canonically evidenced destination participant.
- **Authority:** the source basis that authorizes the assertion, evaluated separately from Entity authority.
- **Evidence:** precise source support for the relationship and its direction.
- **Lifecycle:** applicability status of the relationship assertion.
- **Version:** source revision context for the assertion.

## Principles

1. Relationship Type must come only from the Phase 11C semantic vocabulary.
2. Both participating Entities must have resolved identities.
3. Direction must be supported by source evidence and preserved.
4. Relationship authority must be evaluated independently from Source and Target Entity authority.
5. A Reference or shared mention must not imply a stronger Relationship.
6. Depends On must not become execution order.
7. Authorizes must require explicit authority and scope evidence.
8. Realizes must preserve Capability, Agent, and Runtime identity separation.
9. Relationship Lifecycle and Version must remain traceable.
10. Unknown, ambiguous, inverse, or duplicate Relationships must not be invented or silently normalized.

## Enterprise Example

If an Approved source states that a Department owns a named Capability, extraction may represent an **Owns** Relationship from the Department Entity to the Capability Entity. Both Entities and the direction must be evidenced. The Department's existence alone does not authorize the Relationship, and the relationship neither triggers execution nor becomes a graph edge.

## Design Notes

- Relationship identity is semantic and no identifier format is prescribed.
- Entity evidence and relationship evidence may overlap but are not interchangeable.
- Ontology defines Relationship meaning; canonical statements establish particular Relationship assertions.
- Cardinality, traversal, persistence, query, and graph topology are outside scope.
- This phase creates no real enterprise relationship inventory.

## Common Mistakes

- Converting every sentence connection into a Relationship.
- Treating co-occurrence as semantic evidence.
- Reversing direction without explicit support.
- Assuming Entity authority automatically validates the Relationship.
- Using Relationship types outside the ontology.
- Reading Depends On as Runtime Dependency or execution order.
- Equating Relationship with a database or graph edge.

## Related Architecture

- [10 — Architecture Reference Model](10-architecture-reference-model.md)
- [16 — Semantic Relationships](16-semantic-relationships.md)
- [18 — Architecture Ontology Design Rules](18-ontology-design-rules.md)
- [19 — Canonical Entity Model](19-entity-model.md)
- [Phase 10 — Business Capability Architecture Closure](../business-capabilities/50-phase-10-closure.md)

