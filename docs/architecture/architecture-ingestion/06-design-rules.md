# 06 — Architecture Ingestion Design Rules

## Definition

The Architecture Ingestion Design Rules are the normative conformance standard for any future mechanism that admits architectural information into Hebun. A design that violates any **must** or **must not** rule is not Phase 11A-conformant.

## Mental Model

```text
Identify Source
  → Verify Authority and Lifecycle
  → Read Without Mutation
  → Preserve Evidence and Version
  → Classify Source / Derivation / Inference
  → Expose Safely to Director Intelligence
```

This is a conceptual validation order, not a workflow, implementation pipeline, or execution sequence.

## Principles

### Source and Authority Rules

1. Every ingested document **must** have a stable source identity.
2. Source scope, lifecycle status, version, and authority **must** be known or explicitly marked unresolved.
3. Unresolved authority **must not** be promoted as canonical.
4. Ingestion **must not** approve, deprecate, archive, or otherwise govern a source.
5. Canonical architecture **must** remain authoritative over every derivative.

### Read-only Rules

6. Ingestion **must** be read-only with respect to source documents.
7. Ingestion **must not** write derived content back into canonical sources automatically.
8. Ingestion **must not** trigger execution, tools, workflows, or Runtime changes.
9. Ingestion **must not** mutate Director, Execution, Enterprise, Capability, or Runtime state.

### Evidence and Traceability Rules

10. Every extracted statement **must** retain source and version provenance.
11. Evidence location **must** be precise enough for independent verification.
12. Missing evidence **must** remain visible.
13. Conflicting evidence **must** remain visible and **must not** be silently merged.
14. Deprecated and Archived evidence **must** retain historical traceability.

### Determinism and Epistemic Rules

15. Deterministic extraction **must** be reproducible from the same source state and rules.
16. Source statements, derived knowledge, and inference **must** remain distinguishable.
17. Inference **must not** be represented as canonical truth.
18. Unsupported architectural claims **must not** be generated.
19. A generated artifact **must** remain non-canonical unless separately approved.
20. Stale derived knowledge **must** be identified as stale.

### Boundary Rules

21. Architecture Documents **must not** be equated with a Knowledge Graph.
22. A Knowledge Graph **must not** be equated with Runtime State.
23. Runtime and Execution data **must not** be ingested as canonical architecture.
24. Architecture **must not** be inferred from logs or telemetry without canonical evidence.
25. Architecture Ingestion **must not** define a Knowledge Graph, ontology, extraction mechanism, retrieval system, storage model, API, or UI in Phase 11A.

### Director Rules

26. Director-facing architectural claims **must** disclose whether they are canonical, derived, or inferred.
27. Architectural decisions **must** be grounded in applicable canonical architecture and traceable evidence.
28. Ingestion **must not** decide, recommend as authority, or change normative architecture.
29. Any proposed canonical change **must** return to the governed architecture process and Director gate.

## Enterprise Example

A future mechanism encounters an Approved document and an unapproved generated summary. A conformant design admits the document as canonical evidence, labels the summary derived, preserves both provenances, and prevents the summary from overriding the document. Any detected discrepancy is surfaced for review rather than resolved automatically.

## Design Notes

- These rules constrain future implementation without choosing technology.
- “Deterministic” describes extraction fidelity, not future Director reasoning.
- “Synchronization” is one-way authority preservation, not automatic source write-back.
- A future representation may be useful while remaining subordinate and non-canonical.
- Conformance requires both content fidelity and governance fidelity.

## Common Mistakes

- Preserving text but losing lifecycle or version.
- Preserving a link but not the exact evidence location.
- Treating deterministic formatting as proof of semantic correctness.
- Auto-resolving contradictory Approved sources.
- Allowing a derivative to become authoritative by operational convenience.
- Building Runtime ingestion under the Architecture Ingestion name.
- Selecting technologies before the trust model is approved.
