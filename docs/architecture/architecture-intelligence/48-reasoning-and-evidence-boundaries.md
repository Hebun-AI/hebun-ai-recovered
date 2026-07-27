# 48 — Reasoning and Evidence Boundaries

## Definition

The **Reasoning and Evidence Boundary** determines what Architecture Intelligence may conclude, what it may only present as evidence, when it must decline a conclusion, and when it must escalate to the Director.

## Permitted Reasoning

Within resolved Scope, authority, lifecycle, version, and provenance, the system may:

- explain canonical definitions, rules, invariants, boundaries, and decisions;
- compare compatible architectural claims;
- derive direct, evidence-supported implications;
- identify possible contradiction, duplication, drift, or impact;
- relate Concepts, Entities, Relationships, Representations, and Graph assertions using canonical semantics;
- assess evidence sufficiency and explicit uncertainty;
- formulate bounded recommendations labelled non-authoritative.

Permitted reasoning does not make conclusions canonical.

## Evidence-only Conditions

The system must present evidence without a normative conclusion when:

- the Director requests source inspection rather than analysis;
- applicable authority is unresolved;
- sources are individually valid but not comparable in Scope or Version;
- evidence is observational and no canonical rule supports interpretation;
- a normative decision or exception would be required;
- causal or impact claims exceed canonical support.

## No-answer Conditions

The system must not provide a substantive architectural answer when:

- the request cannot be scoped safely;
- required provenance is broken;
- no eligible evidence exists;
- the request requires fabricated entities, relationships, authority, or metadata;
- answering would disclose an unsupported canonical claim;
- the request seeks autonomous mutation, approval, execution, or architecture write-back.

It must return `Insufficient Evidence`, `Out of Scope`, or `Director Decision Required` with the reason.

## Director Escalation Conditions

Escalation is mandatory for:

- conflicting applicable canonical sources;
- new or changed canonical meaning;
- architecture approval, exception, deprecation, or supersession;
- authority ambiguity affecting a material conclusion;
- Scope expansion;
- recommendation requiring committing action;
- proposed reconciliation of Runtime and architecture;
- unresolved high-impact uncertainty.

## Conflicting Sources

The system must preserve each source, authority, Scope, Lifecycle, Version, statement, evidence path, and conflict basis. It may classify the conflict and explain consequences. It must not select, merge, rewrite, or deprecate a source automatically.

Detected Conflict is not Resolved Conflict.

## Missing Evidence

Missing evidence must remain missing. Architecture Intelligence may identify what type of canonical evidence is absent, but it must not generate substitute evidence, infer authority, or complete the answer from popularity, analogy, or Runtime observation.

## Runtime–Architecture Divergence

When Runtime evidence conflicts with canonical architecture:

1. canonical architecture remains authoritative for architectural meaning;
2. Runtime evidence is classified as observation;
3. the divergence is reported as possible drift, violation, stale architecture, or unresolved mismatch without choosing among them unsupported;
4. evidence and uncertainty are preserved;
5. any architecture change or operational correction is escalated;
6. no automatic write-back or Runtime mutation occurs.

## Canonical Distinctions

- Evidence ≠ Conclusion
- Conclusion ≠ Decision
- Interpretation ≠ Canonical Meaning
- Detected Conflict ≠ Resolved Conflict
- Impact Analysis ≠ Change Approval
- Recommendation ≠ Execution
- Reasoning ≠ Authority
- Confidence ≠ Truth

## Answer Contract

A safe answer must include:

- request and resolved Scope;
- outcome state;
- applicable authority;
- evidence and provenance;
- conclusion or evidence-only presentation;
- reasoning basis;
- conflicts and uncertainty;
- boundary limitations;
- required Director action, if any.

## Enterprise Example

Runtime telemetry indicates that an Agent performs work outside its documented Capability binding. Intelligence may show the telemetry, the canonical binding evidence, and the divergence. It may recommend review and classify possible impact. It cannot revise the Capability, update the binding, declare the Runtime behavior canonical, or trigger enforcement.

## Related Architecture

- [Phase 11 Ingestion Boundaries](../architecture-ingestion/05-ingestion-boundaries.md)
- [Phase 11 Boundary Validation](../architecture-ingestion/39-boundary-validation.md)
- [Phase 8 Execution Closure](../execution-review/10-phase-8-final-closure.md)
- [46 — Intelligence Authority Model](46-intelligence-authority-model.md)
- [47 — Intelligence Lifecycle](47-intelligence-lifecycle.md)

