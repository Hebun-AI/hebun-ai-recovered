# 47 — Architecture Intelligence Lifecycle

## Definition

The **Intelligence Lifecycle** is the governed progression through which a bounded architecture question becomes a traceable answer or safe escalation. It is an architectural responsibility model, not an implementation workflow, Runtime state machine, or orchestration sequence.

## Canonical Lifecycle

```text
Input Request
↓
Scope Resolution
↓
Authority Resolution
↓
Evidence Collection
↓
Context Assembly
↓
Reasoning
↓
Conflict Detection
↓
Confidence Assessment
↓
Answer Construction
↓
Provenance Attachment
↓
Governance Check
↓
Director Review or Safe Response
```

## Lifecycle Responsibilities and Gates

| Stage | Input | Responsibility | Output | Failure condition | Transition condition |
|---|---|---|---|---|---|
| **Input Request** | Architecture question or review request | Preserve request intent and distinguish analysis from action | Identified request | Unclear request, embedded mutation, or non-architecture demand | Request is interpretable and non-mutating |
| **Scope Resolution** | Identified request | Resolve domain, subjects, time, lifecycle, version, and exclusions | Declared Scope | Ambiguous, conflicting, or unauthorized Scope | Scope is explicit or safe Out of Scope response is possible |
| **Authority Resolution** | Declared Scope | Identify applicable source authority and normative precedence | Authority context | Missing, unresolved, stale, or conflicting authority | Governing claims are classified or escalation status is known |
| **Evidence Collection** | Scope and authority context | Collect eligible canonical and separately classified supporting evidence | Evidence set | Required evidence missing, broken, or unverifiable | Evidence is traceable or insufficiency can be reported |
| **Context Assembly** | Evidence set | Assemble relevant Concepts, Entities, Relationships, versions, findings, exceptions, and boundaries without invention | Bounded context | Context mixes incompatible scope or authority | Context is coherent and provenance-preserving |
| **Reasoning** | Bounded context | Derive supported interpretations and possible impacts within explicit limits | Candidate conclusions | Unsupported assumption, scope expansion, or fabricated relationship | Each conclusion has evidence and rationale |
| **Conflict Detection** | Candidate conclusions and context | Detect incompatible claims, findings, or authority conditions | Conflict assessment | Conflict cannot be classified with available evidence | Conflicts are explicit and unresolved where required |
| **Confidence Assessment** | Conclusions, evidence, and conflicts | Assess degree of support separately from authority | Confidence assessment | Confidence cannot be justified or is confused with truth | Uncertainty and limitations are explicit |
| **Answer Construction** | Conclusions and assessments | Construct bounded answer with status, rationale, limitations, and escalation need | Draft answer | Answer overstates support, hides conflict, or implies approval | Answer matches evidence and authority |
| **Provenance Attachment** | Draft answer | Attach verifiable evidence paths to material claims | Traceable answer | Broken or missing provenance | Every material claim is traceable or marked unsupported |
| **Governance Check** | Traceable answer | Verify authority, boundaries, non-mutation, outcome status, and Director gates | Governed disposition | Unauthorized decision, recommendation-as-rule, or execution implication | Safe response is permitted or Director review is required |
| **Director Review or Safe Response** | Governed disposition | Present advisory result or escalate without acting | Final bounded outcome | Required Director decision unavailable | Outcome is returned without mutation or execution |

No stage may silently correct a prior stage. A failed gate must produce an explicit outcome rather than fabricated completion.

## Outcome States

- **Supported:** applicable canonical evidence sufficiently supports the bounded conclusion and no unresolved material conflict remains.
- **Partially Supported:** some material claims are supported while identified gaps or limitations remain.
- **Conflicted:** applicable evidence contains unresolved incompatible claims.
- **Insufficient Evidence:** available evidence cannot support a responsible conclusion.
- **Out of Scope:** the request falls outside approved architecture knowledge or declared intelligence scope.
- **Director Decision Required:** a normative choice, conflict resolution, exception, approval, scope change, or committing decision is required.

These states describe answer disposition, not truth labels, Runtime states, or authority grants.

## Lifecycle Invariants

- Evidence collection precedes conclusion.
- Authority resolution is independent of confidence.
- Conflict detection does not resolve conflict.
- Confidence assessment does not create truth.
- Provenance is attached before safe response.
- Governance check precedes any Director-facing recommendation.
- Director review does not authorize automatic follow-on execution.

## Enterprise Example

A question asks whether a proposed architecture change violates a Capability boundary. Scope and authority are resolved, applicable Phase 10 rules and Phase 11 evidence are assembled, and reasoning identifies a possible overlap. A conflicting Approved statement prevents a single supported conclusion. The lifecycle returns `Conflicted` and `Director Decision Required`, with both evidence paths and no change proposal applied.

## Related Architecture

- [Phase 11 Document Lifecycle](../architecture-ingestion/03-document-lifecycle.md)
- [Phase 11 Extraction Validation](../architecture-ingestion/23-validation-model.md)
- [Phase 11 Graph Validation](../architecture-ingestion/35-graph-validation.md)
- [46 — Intelligence Authority Model](46-intelligence-authority-model.md)
- [48 — Reasoning and Evidence Boundaries](48-reasoning-and-evidence-boundaries.md)

