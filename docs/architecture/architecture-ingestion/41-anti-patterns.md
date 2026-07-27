# 41 — Architecture Ingestion Anti-Patterns

## Purpose

This catalog records modeling mistakes prohibited by the Phase 11 architecture. It introduces no new architecture.

## Anti-Patterns

1. **Runtime as Canonical Source** — treating operational state, logs, or telemetry as architecture.
2. **Graph as Source of Truth** — granting a derived Graph canonical authority.
3. **Representation as Source of Truth** — allowing a derived semantic whole to replace documents.
4. **Ontology as Document Replacement** — treating Concept definitions as a substitute for governed source content.
5. **Concept–Entity Collapse** — treating a reusable meaning and a particular subject as the same object.
6. **Entity–Graph Node Collapse** — making a technical node identifier the Entity identity.
7. **Relationship–Graph Edge Collapse** — allowing implementation connectivity to define semantic meaning.
8. **Document–File Collapse** — equating document identity with filename, path, or carrier.
9. **Metadata as Authority** — assuming a label, owner, timestamp, or “final” marker grants approval.
10. **Reference as Inheritance** — treating a reference as dependency, equivalence, authority transfer, or inherited meaning.
11. **Visual Order as Authority** — granting normative force from heading depth, position, or emphasis.
12. **Example as Rule** — promoting illustration into a normative statement.
13. **Inference as Canonical Truth** — using plausible interpretation to fill architecture gaps.
14. **Popularity as Authority** — using repetition, adoption, query frequency, or implementation usage as governance evidence.
15. **Extraction by Co-occurrence** — creating Entities or Relationships because terms appear together.
16. **Hallucinated Metadata Completion** — inventing missing Scope, Authority, Lifecycle, Version, owner, or approval.
17. **Silent Identity Merge** — merging similarly named Documents, Concepts, Entities, Relationships, Representations, or Graphs.
18. **Silent Conflict Normalization** — combining conflicting Definitions or Statements into convenient composite meaning.
19. **Validation as Correction** — changing extraction candidates while evaluating them.
20. **Validation as Transformation** — normalizing Representation components during validation.
21. **Validation as Repair** — connecting, reversing, or deleting Graph components during review.
22. **Validated Means Approved** — treating successful validation as Director approval.
23. **Lifecycle Collapse** — equating Document, Concept, Entity, Relationship, Representation, Graph, and Runtime lifecycles.
24. **Latest Means Canonical** — selecting applicability from timestamp or version number without governance evidence.
25. **Broken Reference Means Conflict** — interpreting referential integrity failure as normative contradiction automatically.
26. **Disconnected Means Invalid** — assuming every disconnected Graph component requires repair.
27. **Authority by Connectivity** — inferring authorization from Owns, References, Related To, or Graph reachability.
28. **Dependency as Execution Order** — converting semantic or Capability dependency into workflow sequence.
29. **Graph Technology Lock-in** — allowing a database, format, or query language to define the architecture.
30. **Runtime Completion of Architecture** — using observed behavior to fill missing canonical Relationships.
31. **Finding Suppression** — hiding unresolved findings to obtain a clean or Approved result.
32. **Provenance Reconstruction by Guessing** — assigning a plausible source when traceability is broken.
33. **Scope Expansion for Connectivity** — broadening canonical Scope to connect or complete a Graph.
34. **Derived Approval Creates Architecture** — treating Representation or Graph approval as approval of new canonical architecture.
35. **Ingestion Triggers Execution** — allowing architecture admission or validation to authorize action.

## Review Rule

Detection of an anti-pattern must produce a visible review finding. Detection does not authorize automatic correction or normative modification.

## Related Architecture

- [37 — Architecture Consistency Review](37-architecture-consistency-review.md)
- [39 — Phase 11 Boundary Validation](39-boundary-validation.md)
- [06 — Architecture Ingestion Design Rules](06-design-rules.md)
- [36 — Architecture Knowledge Graph Design Rules](36-graph-design-rules.md)

