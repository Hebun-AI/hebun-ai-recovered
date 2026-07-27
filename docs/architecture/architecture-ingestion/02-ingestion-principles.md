# 02 — Ingestion Principles

## Definition

The Architecture Ingestion Principles are the normative commitments every future ingestion mechanism must preserve. They govern trust, authority, repeatability, evidence, and traceability independently of any implementation technology.

## Mental Model

```text
Canonical Source
   ↓ read-only
Deterministic Extraction
   ↓ provenance retained
Derived Knowledge
   ↓ evidence-labelled interpretation
Director Intelligence
```

At every boundary, the source remains identifiable and more authoritative than its derivative.

## Principles

### P1 — Canonical Source of Truth

Every architectural claim must originate from a recognized canonical source or be explicitly labelled non-canonical. No derivative may silently become the source of truth.

### P2 — Read-only Ingestion

Ingestion must not edit, approve, deprecate, archive, rename, or otherwise mutate source documents. Lifecycle changes belong to the source governance process.

### P3 — Deterministic Extraction

The same source content, version, lifecycle status, and extraction rules must yield the same extracted architectural statements. Non-deterministic interpretation must be labelled inference rather than extraction.

### P4 — No Hallucinated Architecture

If a concept, relationship, boundary, or decision is not supported by source evidence, it must not be asserted as architecture. Plausibility is not evidence.

### P5 — End-to-end Traceability

Every extracted or derived statement must identify its source document, applicable version, lifecycle status, and evidence location at the level required for independent verification.

### P6 — Evidence First

Evidence is gathered before architectural conclusions are formed. Conflicting, missing, or ambiguous evidence must be surfaced rather than normalized away.

### P7 — Authority Preservation

Ingestion carries architectural meaning but does not carry authority to change architecture. Approval and normative change remain Director-governed.

### P8 — Lifecycle Awareness

Draft, Approved, Deprecated, and Archived sources must remain distinguishable. Their content may be visible, but their normative force is not equal.

### P9 — Version Awareness

Claims must be associated with the source version from which they were derived. Version changes do not silently rewrite historical derived knowledge.

### P10 — Separation of Source, Derivation, and Inference

Direct source statements, deterministic derivations, and interpretive inferences must be represented as different epistemic classes. None may be relabelled as another for convenience.

### P11 — Failure Closed

When source authority, status, version, or evidence cannot be established, the content must not be promoted as canonical architecture.

### P12 — No Execution Side Effects

Ingestion must not start workflows, authorize tools, change Runtime state, or create execution obligations.

## Enterprise Example

A document states that verification is read-only. Extraction records the statement with its source and version. A possible implication—such as how a future component might enforce the rule—is inference and remains separately labelled. The system may present both, but the Director sees which is canonical and which is interpretive.

## Design Notes

- Determinism applies to extraction, not to all future reasoning.
- Evidence may support a derived relationship without making the derivative canonical.
- Traceability is an architectural requirement even if no storage or graph design exists yet.
- Read-only ingestion aligns with Phase 7 verification and Phase 8's prohibition on unapproved action.

## Common Mistakes

- Treating a generated synopsis as equivalent to source text.
- Omitting lifecycle or version because the content appears unambiguous.
- Resolving conflicting documents automatically.
- Calling probabilistic interpretation deterministic extraction.
- Dropping evidence locations after ingestion.
- Allowing successful ingestion to imply Director approval.
