# 58 — Architecture Reasoning Model

## Definition

The Architecture Reasoning Model defines the canonical logical components required to perform one bounded, evidence-grounded architectural analysis. Components separate identity, scope, objective, evidence, analytical work, trace, and result so that no conclusion appears without an auditable basis.

## Component Model

| Component | Definition | Responsibilities | Lifecycle | Constraints |
|---|---|---|---|---|
| **Reasoning Unit** | One indivisible analytical claim, comparison, implication, constraint test, hypothesis, or finding | Bind premises to one operation; preserve assumptions; state intermediate outcome and limitations | Declared → Evaluated → Validated or Rejected → Retained in trace | Must have one bounded purpose; cannot create evidence or authority |
| **Reasoning Session** | A governed analytical boundary for one resolved architecture objective | Coordinate scope, context, evidence, Units, trace, validation, confidence, and escalation | Initiated → Bounded → Reasoned → Validated → Responded or Escalated → Closed | Temporary and question-bound; cannot become a conversation, memory, workflow, or authority |
| **Reasoning Scope** | The explicit enterprise, domain, concept, relationship, document, version, lifecycle, time, and question boundary | Constrain eligible evidence and conclusions; expose exclusions and unresolved scope | Proposed → Resolved or Unresolved → Preserved with result | Must not expand silently; unresolved material scope prevents conclusive reasoning |
| **Reasoning Context** | The governed assembly of information relevant to the objective | Preserve context classes, relevance, authority, provenance, version, lifecycle, and uncertainty | Assembled → Qualified → Used → Released with trace references | Context does not become canonical, memory, prompt, graph, or Runtime state |
| **Reasoning Objective** | The precise analytical question or outcome sought | Define success, allowed strategies, required evidence, and response boundary | Declared → Clarified → Accepted or Rejected → Addressed | Must not embed an assumed conclusion, approval, execution instruction, or unauthorized decision |
| **Reasoning Evidence** | Qualified source material used as a premise or constraint | Support Units; retain source identity, authority, provenance, scope, version, lifecycle, and relevance | Selected → Qualified → Applied or Excluded with reason → Cited | Derived or Runtime evidence cannot inherit canonical authority |
| **Reasoning Trace** | The inspectable record connecting objective, premises, Units, assumptions, alternatives, findings, validation, and confidence | Enable explanation, reproduction, challenge, and governance review | Begun with first Unit → Extended append-only for session meaning → Finalized with outcome | Must not expose or depend on a prompt; must not hide failed branches or material uncertainty |
| **Reasoning Result** | A bounded analytical conclusion, finding, hypothesis, impact statement, dependency statement, or insufficiency outcome | Answer the objective; cite evidence and trace; state validation, confidence, conflict, limits, and escalation | Proposed → Validated, Partially Valid, Insufficient, Conflicted, or Escalated → Released | Advisory only; cannot be a decision, approval, canonical statement, mutation, or execution authorization |

## Composition

A Reasoning Session has one resolved Reasoning Scope and at least one Reasoning Objective. It references a governed Reasoning Context containing qualified Reasoning Evidence. Reasoning Units operate only within those boundaries and collectively form a Reasoning Trace. One or more Reasoning Results are then validated and confidence-qualified.

The model permits multiple Results when the objective contains separable findings. Each material Result must retain its own evidence, validation outcome, confidence rationale, and limitations.

## Lifecycle Principles

1. A Session cannot begin substantive reasoning until Scope and Objective are resolved.
2. Evidence qualification precedes its use as a premise.
3. Every material analytical step is represented by a Reasoning Unit.
4. The Trace grows with analysis and preserves rejected or limited material paths.
5. Results remain provisional until validation completes.
6. A material validation failure produces insufficiency, conflict, or escalation; it does not invite invention.
7. Closing a Session does not persist its Context as canonical knowledge.

## Required Distinctions

- **Reasoning Session ≠ Conversation** — a conversation may contain many requests and informal statements; a Session is one governed analytical boundary.
- **Reasoning Trace ≠ Prompt** — a Trace is an architecture-level evidence and inference record; no model instruction artifact is defined.
- **Reasoning Result ≠ Decision** — a Result informs governance; only the proper authority decides.
- **Reasoning Context ≠ Memory** — Context is temporary and objective-bound.
- **Reasoning Evidence ≠ Conclusion** — evidence supports a Result but is not itself the Result.

## Enterprise Example

For a question about whether a proposed dependency violates an approved boundary, the Session resolves the applicable capability and version scope. Its Objective asks for constraint compatibility, Evidence cites the approved boundary and relationship definitions, Units test direction and permitted dependency semantics, the Trace preserves each test, and the Result states compatibility or conflict. No component approves the proposal.

## Boundaries

This model defines logical identities and lifecycles only. It does not define storage, serialization, API objects, prompts, agents, model calls, workflows, execution state, or implementation schemas.

