# 64 — Architecture Query Model

## Definition

The **Architecture Query Model** defines the canonical logical components needed to preserve a Director question and transform it into one governed Reasoning Request. Each component has an explicit responsibility, lifecycle, and constraint so that interpretation remains auditable.

## Component Model

| Component | Definition | Responsibilities | Lifecycle | Constraints |
|---|---|---|---|---|
| **Query** | One preserved request for architectural information, analysis, validation, review, or decision support | Retain original meaning; bind component identities; expose ambiguity and requested outcome | Received → Qualified → Routed, Clarification Required, Out of Scope, or Escalated → Closed | Must not be rewritten into a command, conclusion, approval, or execution request |
| **Query Session** | The temporary governance boundary for qualifying one Query and its resulting response | Coordinate intent, scope, authority, evidence selection, routing, response construction, and query trace | Opened → Bounded → Qualified → Routed → Responded or Escalated → Closed | Must not become a conversation, memory store, Reasoning Session, workflow, or authority |
| **Query Context** | The question-relevant framing supplied to qualification | Preserve Director-provided context and classified Canonical, Derived, Runtime, Historical, Conversation, and Authority Context | Declared → Classified → Qualified → Referenced → Released | Must not merge context classes or treat conversational framing as canonical truth |
| **Query Scope** | The explicit architecture boundary to which the Query and response apply | Establish enterprise, domain, identities, relationships, documents, versions, lifecycle, time, and exclusions | Proposed → Resolved, Partially Resolved, or Unresolved → Preserved | Must not expand silently; material ambiguity requires clarification, qualification, or refusal |
| **Query Intent** | The governed classification of what architectural outcome the Director seeks | Preserve purpose; select allowed operations; identify routing target and escalation needs | Candidate → Resolved, Multi-intent, Ambiguous, or Out of Scope → Preserved | Must not infer authority, approval, or command semantics from wording alone |
| **Query Constraints** | Explicit limits and obligations governing interpretation and response | Carry scope limits, authority limits, evidence requirements, exclusions, lifecycle, version, time, and output conditions | Collected → Validated → Applied → Reported | Must not contradict canonical governance or be silently waived |
| **Query Priority** | The declared governance importance and review urgency of the Query | Preserve Director-declared importance; expose conflicts with governance requirements | Declared or Unspecified → Qualified → Preserved | Does not grant authority, change evidence quality, bypass validation, or define Runtime scheduling |
| **Query Metadata** | Descriptive information required for identity, traceability, lifecycle, and governance | Record stable query identity, origin, time, applicable version, status, provenance references, and classification | Created → Enriched without changing meaning → Finalized | Must not contain hidden reasoning, prompt instructions, inferred approval, or untraceable claims |

## Query Composition

A Query Session contains one Query, one or more candidate Intents, a Query Context, a Query Scope, Query Constraints, Query Priority, and Query Metadata. Qualification resolves these into one Reasoning Request or an explicit non-routing outcome.

Multi-intent queries may be decomposed into separable objectives only when the original intent, shared constraints, and relationships remain visible. Decomposition must not create new questions.

## Lifecycle Principles

1. Preserve the Query before interpretation.
2. Classify Context before using it.
3. Resolve Intent and Scope before selecting evidence.
4. Resolve Authority before constructing a Reasoning Request.
5. Treat unresolved material ambiguity as a visible outcome.
6. Keep Query and Reasoning lifecycles independently traceable.
7. Close the Query Session only after response, refusal, clarification request, or escalation is recorded.

## Required Distinctions

- **Query ≠ Conversation** — a Query is one governed architecture request; a conversation may contain informal and unrelated exchanges.
- **Query ≠ Prompt** — a Query is an architecture-level information contract, not an instruction artifact for a model.
- **Query Session ≠ Reasoning Session** — Query Session qualifies and routes; Reasoning Session analyzes a resolved objective.
- **Query Context ≠ Memory** — context is bounded and temporary.
- **Query Priority ≠ Authority** — urgency cannot change governance rights.
- **Question ≠ Command** — inquiry does not authorize action.

## Enterprise Example

A Director question asks for both an explanation of an approved relationship and an assessment of its downstream impact. The Query retains the combined request, resolves two related Intents, binds them to one explicit architecture scope, selects authoritative evidence, and constructs separable reasoning objectives. Neither objective is treated as approval or execution.

## Boundaries

This model defines logical identities and lifecycles only. It does not define conversation handling, prompts, persistence, interfaces, storage, Runtime sessions, model inputs, execution, or deployment.

