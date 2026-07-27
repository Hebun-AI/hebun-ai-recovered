# 13 — Canonical Architecture Concepts

## Definition

A **Canonical Architecture Concept** is a stable, governed unit of architectural meaning established by applicable canonical sources. It enables the enterprise to refer to the same architectural idea consistently across documents, phases, and domains without replacing those sources.

Canonicality belongs to the governed Definition within its Scope, Lifecycle, Version, and Authority context. Repetition, popularity, implementation usage, or appearance in a derived representation does not make a Concept canonical.

## Why

Hebun's architecture uses shared terms across Director Intelligence, Execution, Enterprise, Business Capability, and Architecture Ingestion. Without canonical concepts, identical words may hide different meanings and different words may fragment one meaning. A governed concept vocabulary preserves cross-architecture coherence while keeping source authority traceable.

## Mental Model

```text
Canonical Sources
        ↓ establish
Governed Concept Meaning
        ↓ used consistently by
Documents, Statements, and References

The Concept preserves meaning.
The canonical sources preserve authority.
```

## Core Concepts

- **Architecture:** governed structural commitments, principles, boundaries, and decisions that define how Hebun is organized and constrained; not Runtime condition.
- **Document:** a governed semantic carrier of architectural truth; not a physical file and not a Concept.
- **Normative Statement:** an identifiable governed assertion with evaluated type, scope, authority, source, lifecycle, version, and evidence.
- **Concept:** a stable unit of governed architectural meaning; not a word, section, document, or graph node.
- **Capability:** a durable statement of what the enterprise can do; not an Agent, Process, organizational unit, or Runtime.
- **Agent:** a replaceable execution participant that may realize one or more Capabilities under governed binding and authorization.
- **Execution:** faithful performance of Director-approved work within bounded authority; not reasoning or approval.
- **Runtime:** the operational environment and changing realization state in which authorized execution occurs; not Architecture.
- **Director:** the final governance and approval authority for architectural decisions and committing action; not a Runtime scheduler.
- **Enterprise:** the governed whole within which organization, capabilities, authority, and operation are coordinated.
- **Organization:** the accountability and ownership structure that defines who owns and governs; it does not itself reason or execute.
- **Department:** a permanent domain-owning organizational unit within the enterprise hierarchy.
- **Process:** how work is performed; not the durable ability represented by a Capability.
- **Policy:** a governed constraint or directive whose authority class remains distinct from Architecture unless explicitly approved as architecture.
- **Rule:** a normative statement that mandates or prohibits a condition.
- **Constraint:** a normative statement that limits a valid decision or solution space.
- **Evidence:** traceable support sufficient for independent verification; not authority by itself.
- **Reference:** an explicit typed semantic connection that transfers no identity or authority.
- **Authority:** a recognized, scoped, lifecycle-aware basis for legitimate decision or normative force.
- **Lifecycle:** governed applicability status such as Draft, Approved, Deprecated, or Archived.
- **Version:** the governed revision context to which meaning and evidence apply.
- **Observation:** an evidence-bound account of an observed condition; not canonical architecture or Decision.
- **Insight:** an evidence-grounded interpretation presented to the Director; not authority or approval.
- **Decision:** an authorized architectural or governance choice within declared scope.
- **Boundary:** an explicit inclusion, exclusion, responsibility, or separation constraint.
- **Identity:** the stable means by which a governed semantic object remains distinguishable across presentation change.
- **Relationship:** a typed semantic assertion connecting governed concepts without becoming an implementation edge.

## Principles

1. A canonical Concept must have one stable identity within an authoritative scope.
2. Its Definition must be traceable to canonical source evidence.
3. A Concept must preserve the meaning established by its source architecture.
4. Shared spelling must not be treated as shared identity without semantic evidence.
5. Different aliases must not create duplicate concepts.
6. Concept authority must remain distinct from term usage frequency.
7. Observation and Insight must not silently redefine Architecture.
8. Ontology must not transfer authority away from canonical documents.

## Enterprise Example

“Capability” appears in Business Capability Architecture, Enterprise Architecture, and Execution discussions. The canonical concept retains the Phase 10 meaning—what the enterprise can do. An Agent may realize it and a Department may own accountability for it, but neither becomes the Capability. The ontology records the shared meaning and relationships without merging these distinct concepts.

## Design Notes

- This catalog is a governed semantic baseline, not a complete enterprise inventory.
- Definitions summarize existing canonical meanings and remain subordinate to their source documents.
- New aliases or relationships do not amend a Definition.
- This phase defines no node, edge, serialization, extraction, or persistence design.
- Where source scope differs, the scope must be preserved rather than normalized away.

## Common Mistakes

- Treating the concept list as a Knowledge Graph.
- Equating a term with the concept it may denote.
- Redefining Capability as Agent or Process.
- Treating Observation as architectural truth.
- Using popular usage as authority.
- Assuming the ontology replaces canonical documents.
- Creating a duplicate concept because a display label differs.

## Related Architecture

- [04 — Source of Truth](04-source-of-truth.md)
- [07 — Architecture Document Model](07-architecture-document-model.md)
- [09 — Normative Statement Model](09-normative-statement-model.md)
- [Phase 7 — Director Intelligence Closure](../director-review/10-phase-7-final-closure.md)
- [Phase 8 — Execution Architecture Closure](../execution-review/10-phase-8-final-closure.md)
- [Phase 9 — Enterprise Architecture Closure](../enterprise-review/11-phase-9-final-closure.md)
- [Phase 10 — Business Capability Architecture Closure](../business-capabilities/50-phase-10-closure.md)

