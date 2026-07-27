# 63 — Architecture Query Intelligence Overview

## Definition

**Architecture Query Intelligence** is the governed entry architecture that receives a Director-originated architecture question, resolves what is being asked, establishes its scope and authority requirements, selects eligible evidence, and constructs a bounded request for the Architecture Reasoning Engine.

It protects both the Director and the Reasoning Engine from ambiguous, over-broad, unsupported, or authority-confused requests. It is a logical interpretation and routing layer, not a conversational system, prompt mechanism, execution interface, or decision authority.

## Why Query Intelligence Is Required

Natural architecture questions often combine several concerns: explanation, validation, impact, governance, operational observation, or a request for a decision. The same words may refer to different enterprise scopes, document versions, lifecycle states, or authority levels.

Without a formal Query layer:

- a question may be misread as a command;
- conversational phrasing may be mistaken for canonical intent;
- evidence may be selected before scope and authority are known;
- a governance question may be routed as ordinary analysis;
- a Reasoning Result may be presented as a Director decision;
- search results may be mistaken for understanding.

Query Intelligence makes interpretation explicit, traceable, and reviewable before reasoning begins.

## Why the Director Does Not Address the Reasoning Engine Directly

The Reasoning Engine expects a resolved objective, qualified evidence, explicit constraints, and a bounded scope. A Director query may legitimately be incomplete, exploratory, multi-intent, historically framed, or authority-sensitive.

Query Intelligence performs the admission work:

1. preserves the original question;
2. distinguishes inquiry from command;
3. resolves or exposes ambiguity in intent;
4. constrains applicable scope, lifecycle, version, and time;
5. identifies authority and governance needs;
6. selects traceable evidence without inventing missing facts;
7. creates a formal Reasoning Request or refuses/escalates safely.

This layer does not shield the Director from evidence or alter the Director's intent. It prevents interpretation assumptions from entering reasoning silently.

## Logical Architecture

```text
Director Query
      ↓
Intent Resolution
      ↓
Scope Resolution
      ↓
Authority Resolution
      ↓
Evidence Selection
      ↓
Reasoning Request
      ↓
Reasoning Engine
      ↓
Structured Response
```

The flow expresses logical dependencies only. It is not a Runtime sequence, workflow, agent chain, user interface, or execution path.

## Architectural Responsibilities

### Director Query

The original question and declared constraints are preserved verbatim in meaning. The query may request information, explanation, analysis, validation, conflict review, governance review, or decision support.

### Intent Resolution

Intent Resolution identifies the analytical purpose without converting the question into authority or adding an unstated objective.

### Scope Resolution

Scope Resolution establishes enterprise, domain, concept, relationship, document, lifecycle, version, time, and question boundaries.

### Authority Resolution

Authority Resolution determines which sources govern and whether the requested outcome requires Director-reserved judgment.

### Evidence Selection

Evidence Selection identifies relevant, traceable, authority-qualified material. Selection does not create evidence or a conclusion.

### Reasoning Request

The Reasoning Request carries the resolved objective, intent, scope, constraints, evidence, authority context, governance requirements, and expected response contract.

### Reasoning Engine

The Reasoning Engine performs bounded analysis under Phase 12C. Query Intelligence does not reason on its behalf.

### Structured Response

The response preserves the original question, resolved scope, evidence, reasoning summary, confidence, conflicts, recommendations, Director notes, and provenance.

## Core Invariants

- Query ≠ Reasoning
- Query ≠ Conversation
- Question ≠ Command
- Intent ≠ Authority
- Search ≠ Understanding
- Evidence Selection ≠ Conclusion
- Reasoning Request ≠ Execution Request
- Structured Response ≠ Decision
- Recommendation ≠ Approval
- Confidence ≠ Truth

## Enterprise Example

The Director asks, “Should this Runtime observation change the approved capability boundary?” Query Intelligence classifies the request as Governance Review and Director Decision Support, separates the observation from canonical evidence, resolves the relevant capability and version scope, and asks the Reasoning Engine to analyze consistency and impact. The response supports the Director; it neither changes the boundary nor treats the question as an execution command.

## Boundaries

Query Intelligence may interpret, qualify, constrain, classify, select, route logically, request clarification, refuse out-of-scope analysis, and construct a response contract. It must not perform autonomous reasoning, approve architecture, mutate sources, issue commands, control Runtime, or execute recommendations.

