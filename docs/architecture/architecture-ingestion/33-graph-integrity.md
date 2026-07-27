# 33 — Architecture Knowledge Graph Integrity

## Definition

**Graph Integrity** is the condition in which an Architecture Knowledge Graph faithfully preserves the identities, semantic relationships, authority, versions, scopes, evidence, and traceability of its governing Representation without addition, loss, reinterpretation, or contradiction.

## Why

A Graph can appear connected while carrying duplicate identities, reversed relationships, broadened scope, incompatible versions, or lost evidence. Integrity makes faithfulness to the Representation and canonical sources independently assessable.

## Mental Model

```text
Faithful projection
  identity · relationships · authority · version
  scope · evidence · traceability
                  ↓
            Graph Integrity

Connectivity without these guarantees is not trustworthy architecture knowledge.
```

## Core Components

- **Identity Integrity:** Graph and component identities are stable, unique, and correctly mapped to Representation identities.
- **Relationship Integrity:** type, participants, direction, evidence, lifecycle, and semantic meaning are preserved.
- **Authority Integrity:** source authority remains scoped, traceable, and uninterpreted by the Graph.
- **Version Integrity:** Graph, Representation, Entity, Relationship, and source versions are explicit and compatible.
- **Scope Integrity:** Graph and component claims do not exceed governing scopes.
- **Evidence Integrity:** every projected assertion retains precise, applicable, independently verifiable evidence.
- **Traceability Integrity:** every Graph component has an unbroken path to Representation and canonical source.

## Principles

1. All integrity dimensions must be evaluated independently.
2. Connectivity must not substitute for identity or evidence integrity.
3. Relationship Integrity must not be inferred from valid participant identities.
4. Authority must be preserved verbatim in meaning and bounded in scope.
5. Version incompatibility must remain visible.
6. Scope must not expand to connect otherwise disconnected components.
7. Broken evidence or traceability must produce findings.
8. Integrity evaluation must preserve upstream findings.
9. Integrity failure must not trigger automatic transformation or repair.

## Enterprise Example

A Graph projects an Owns Relationship correctly but loses the source statement locator. Identity and Relationship Integrity may pass, while Evidence and Traceability Integrity fail. The Graph cannot restore the locator from a similar document or treat connectivity as sufficient proof.

## Design Notes

- Graph Integrity is semantic and governance integrity, not database consistency.
- A Graph may be partially conformant; findings identify failed dimensions without hiding passed dimensions.
- Disconnected components are evaluated against Representation Scope and expected relationships, not rejected automatically.
- Integrity does not assess Runtime availability or query performance.
- No constraints language, rules engine, or repair process is defined.

## Common Mistakes

- Treating a connected graph as an integral graph.
- Assuming valid Entities guarantee valid Relationships.
- Ignoring version compatibility.
- Broadening scope to eliminate disconnected components.
- Reconstructing missing evidence.
- Equating integrity with database constraints.
- Repairing the Graph during integrity evaluation.

## Related Architecture

- [23 — Extraction Validation Model](23-validation-model.md)
- [28 — Representation Validation](28-representation-validation.md)
- [30 — Architecture Knowledge Representation Design Rules](30-representation-design-rules.md)
- [31 — Architecture Knowledge Graph Model](31-knowledge-graph-model.md)
- [32 — Architecture Knowledge Graph Components](32-graph-components.md)

