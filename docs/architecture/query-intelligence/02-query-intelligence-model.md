# 02 — Query Intelligence Model

## Purpose

The Query Intelligence Model defines the logical identities required to qualify one Query without performing its requested analysis.

## Component Model

| Component | Definition | Required Content | Constraint |
|---|---|---|---|
| **Query Case** | one temporary qualification boundary | identity, origin, Query, status, Trace | not conversation, memory, workflow, or Reasoning Case |
| **Query** | preserved request from a user or system | original representation, meaning record, origin, time, classification | not a prompt, command, evidence, or authority |
| **Query Intent** | governed classification of sought analytical purpose | candidate types, status, rationale, ambiguity | not Objective, route execution, or authority |
| **Reasoning Objective** | precise non-leading analytical question | subject, analytical form, success condition, exclusions | not decision, recommendation, or presumed conclusion |
| **Query Scope** | explicit applicability boundary | enterprise, domain, identity, relationship, version, lifecycle, time, Tenant, exclusions | cannot expand silently |
| **Query Context** | minimum qualified framing references | Context classes, origin, relevance, uncertainty, limits | not evidence or unrestricted memory |
| **Query Constraints** | interpretation and handoff obligations | authority, classification, disclosure, exclusions, required output limits | cannot override canonical rules |
| **Query Trace** | inspectable qualification record | admissions, classifications, transformations, ambiguity, rationale, package mapping | not hidden reasoning or model transcript |
| **Reasoning Request Package** | immutable qualification envelope | all resolved components plus one Processing Output Package reference | not evidence, answer, or reasoning result |

## Composition

One Query Case contains one preserved Query, one or more candidate Intents, one resolved or unresolved Scope, bounded Context references, Constraints, and a Query Trace. It produces one Request Package or a non-package outcome.

## Semantic Lifecycle

```text
Received
→ Admitted
→ Preserved
→ Intent Classified
→ Objective Formulated
→ Scope and Context Qualified
→ Package Ready, Clarification Required, Insufficient, Rejected, or Out of Scope
→ Closed
```

## Rules

- **QMODEL-001:** Every Query Case must preserve the original Query before transformation.
- **QMODEL-002:** Query Case and Reasoning Case identities and lifecycles must remain separate.
- **QMODEL-003:** Every component must retain its origin, status, rationale, and limitations.
- **QMODEL-004:** Multi-intent decomposition must preserve the original combined meaning.
- **QMODEL-005:** A non-package outcome must remain valid and traceable.
- **QMODEL-006:** Query Context expires with the Case and cannot become canonical knowledge or memory.

## Enterprise Example

A query combines explanation and impact analysis. The Case preserves it, records two Intents, formulates two separable Objectives sharing one bounded Scope, and retains the relationship between them without answering either.

## Boundaries

No persistence schema, session runtime, interface, model call, router, or workflow is defined.
