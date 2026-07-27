# 38 — Phase 11 Terminology Index

## Purpose

This index consolidates canonical Phase 11 terminology for review and discovery. It summarizes existing definitions and creates no new Concept, identity, or authority.

## Canonical Terminology

| Canonical Name | Short Definition | Related Documents | Related Concepts |
|---|---|---|---|
| Architecture | Governed structural commitments, principles, boundaries, and decisions | [04](04-source-of-truth.md), [13](13-canonical-concepts.md) | Authority, Boundary, Decision |
| Architecture Ingestion | Read-only admission of canonical architecture with provenance preserved | [01](01-why-architecture-ingestion.md), [02](02-ingestion-principles.md) | Canonical Source, Evidence |
| Canonical Source | Authoritative document or governed document set for declared scope and version | [04](04-source-of-truth.md) | Authority, Scope, Version |
| Document | Governed semantic carrier of architectural truth, independent of physical file | [07](07-architecture-document-model.md) | Statement, Metadata, Evidence |
| Semantic Section | Content role independent of heading text and visual order | [08](08-document-structure-and-sections.md) | Document, Statement |
| Normative Statement | Governed architectural assertion with identity, type, scope, authority, and evidence | [09](09-normative-statement-model.md) | Rule, Constraint, Decision |
| Reference | Typed semantic connection that transfers no authority | [10](10-architecture-reference-model.md) | Evidence, Supersession |
| Metadata | Governed descriptive and administrative document context | [11](11-document-metadata-model.md) | Identity, Lifecycle, Version |
| Concept | Stable unit of canonical architectural meaning | [13](13-canonical-concepts.md), [14](14-concept-identity.md) | Definition, Scope, Authority |
| Concept Identity | Stable semantic identity independent of display name | [14](14-concept-identity.md) | Canonical Name, Alias |
| Concept Taxonomy | Non-inheritance semantic classification of Concepts | [15](15-concept-taxonomy.md) | Concept, Scope |
| Semantic Relationship | Typed assertion describing how Concepts relate in meaning | [16](16-semantic-relationships.md) | Relationship Type, Evidence |
| Architecture Ontology | Governed specification of Concept meanings, identities, classifications, and relationships | [17](17-ontology-boundaries.md), [18](18-ontology-design-rules.md) | Concept, Semantic Relationship |
| Entity | Particular canonically evidenced architectural subject classified by a Concept | [19](19-entity-model.md) | Concept, Identity, Scope |
| Canonical Relationship | Source-evidenced assertion between two Entities using an ontology Relationship Type | [20](20-relationship-model.md) | Source Entity, Target Entity |
| Architecture Extraction | Deterministic identification of evidenced Entities and Relationships | [21](21-extraction-principles.md), [22](22-extraction-boundaries.md) | Evidence, Validation |
| Extraction Validation | Read-only conformance evaluation of extracted candidates | [23](23-validation-model.md) | Finding, Authority, Evidence |
| Validation Finding | Traceable report of absence, ambiguity, incompatibility, duplication, or conflict | [23](23-validation-model.md), [28](28-representation-validation.md), [35](35-graph-validation.md) | Validation, Evidence |
| Knowledge Representation | Technology-independent semantic whole containing validated Entities, Relationships, and governance context | [25](25-knowledge-representation-model.md) | Provenance, Integrity |
| Representation Identity | Stable identity of one represented semantic whole | [25](25-knowledge-representation-model.md) | Scope, Version |
| Representation Lifecycle | Lifecycle of the Representation, distinct from source lifecycle | [27](27-representation-lifecycle.md) | Created, Approved, Superseded |
| Representation Integrity | Conformance of represented identities, relationships, evidence, versions, scopes, and findings | [25](25-knowledge-representation-model.md), [28](28-representation-validation.md) | Traceability, Authority |
| Architecture Knowledge Graph | Technology-independent semantic connectivity projection of a validated Representation | [31](31-knowledge-graph-model.md) | Graph Identity, Provenance |
| Graph Identity | Stable identity of one Graph projection | [31](31-knowledge-graph-model.md) | Representation Identity, Version |
| Graph Integrity | Faithful preservation of Representation identity, semantics, authority, evidence, scope, and traceability | [33](33-graph-integrity.md) | Integrity, Provenance |
| Graph Validation | Read-only conformance evaluation of a Graph projection | [35](35-graph-validation.md) | Finding, Integrity |
| Identity | Stable distinction of a governed semantic object | [07](07-architecture-document-model.md), [13](13-canonical-concepts.md) | Document, Concept, Entity |
| Authority | Recognized scoped basis for normative force or legitimate decision | [04](04-source-of-truth.md), [13](13-canonical-concepts.md) | Director, Approval |
| Evidence | Traceable support sufficient for independent verification | [02](02-ingestion-principles.md), [13](13-canonical-concepts.md) | Provenance, Validation |
| Provenance | Unbroken traceability from derived content to source evidence and governance context | [25](25-knowledge-representation-model.md), [31](31-knowledge-graph-model.md) | Evidence, Source |
| Lifecycle | Governed applicability or disposition status of an object | [03](03-document-lifecycle.md), [27](27-representation-lifecycle.md) | Version, Authority |
| Version | Governed revision context to which meaning and evidence apply | [03](03-document-lifecycle.md), [25](25-knowledge-representation-model.md) | Lifecycle, Provenance |
| Scope | Explicit domain and conditions within which an assertion applies | [14](14-concept-identity.md), [25](25-knowledge-representation-model.md) | Authority, Boundary |
| Validation | Read-only evaluation that reports findings without correction | [23](23-validation-model.md), [28](28-representation-validation.md), [35](35-graph-validation.md) | Finding, Integrity |
| Inference | Interpretation beyond direct or deterministic canonical evidence | [04](04-source-of-truth.md) | Derived Knowledge, Evidence |
| Runtime | Operational environment and changing realization state, distinct from Architecture | [05](05-ingestion-boundaries.md), [13](13-canonical-concepts.md) | Execution, Observation |
| Director | Final governance and approval authority for architectural decisions | [01](01-why-architecture-ingestion.md), [13](13-canonical-concepts.md) | Authority, Decision |

## Terminology Validation

- Canonical Name and Identity remain distinct.
- “Canonical” never means popular, frequently used, or technically convenient.
- “Approved” on a derived layer means conformance approval, not creation of source authority.
- Validation, Correction, Transformation, and Repair remain distinct.
- Representation and Graph are separate derived layers.

No duplicate canonical terminology with conflicting meaning was found.

