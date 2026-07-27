# 68 — Architecture Query Design Rules

## Definition

These rules form the normative conformance contract for Phase 12D. Rule identities are unique. Any later query design or implementation must preserve the Architecture Ingestion, Intelligence Foundation, Processing, and Reasoning contracts.

## Query Rules

- **QUERY-001 — Original Meaning Preservation:** Every Query must retain the Director's original question and declared constraints.
- **QUERY-002 — Question/Command Separation:** A question must not be interpreted as authorization, instruction, mutation, or execution.
- **QUERY-003 — Query/Conversation Separation:** A Query must be bounded independently from surrounding conversation.
- **QUERY-004 — Query/Prompt Separation:** A Query must not be defined as or reduced to a prompt or hidden instruction.
- **QUERY-005 — Session Separation:** Query Session and Reasoning Session must retain separate identities, responsibilities, and lifecycles.
- **QUERY-006 — Scope Isolation:** Every Query must have an explicit scope; unrelated or broader context must not enter silently.
- **QUERY-007 — Constraint Integrity:** Query Constraints must be visible, validated, and preserved through routing and response.
- **QUERY-008 — Priority Non-authority:** Query Priority must not create authority or bypass evidence, validation, governance, or boundaries.
- **QUERY-009 — Metadata Traceability:** Query Metadata must support identity and provenance without containing hidden reasoning or inferred approval.
- **QUERY-010 — Canonical Protection:** Query handling must not modify, supersede, approve, or silently reinterpret canonical architecture.

## Intent Rules

- **INTENT-001 — Explicit Resolution:** Every Query must have a resolved, multi-intent, ambiguous, or Out of Scope intent outcome.
- **INTENT-002 — Intent Preservation:** Resolution must not add, remove, or substitute a material Director objective.
- **INTENT-003 — Intent/Authority Separation:** Intent must not create or imply decision authority.
- **INTENT-004 — Multi-intent Integrity:** Each material intent must retain its own allowed operations, prohibitions, evidence needs, and routing target.
- **INTENT-005 — Ambiguity Visibility:** Material intent ambiguity must yield clarification or a qualified outcome, never a silent guess.
- **INTENT-006 — Approval Separation:** A request for recommendation or analysis must not be interpreted as approval.
- **INTENT-007 — Command Refusal:** Command-like content outside architecture-intelligence authority must be separated, refused, or escalated.
- **INTENT-008 — Out-of-scope Integrity:** Out-of-scope requests must not be answered through invented scope or evidence.
- **INTENT-009 — Classification Explainability:** Every Intent classification must retain its rationale.

## Routing Rules

- **ROUTING-001 — Resolved Basis:** Routing requires resolved Intent, Scope, Authority, Constraints, and minimum evidence conditions.
- **ROUTING-002 — Evidence Integrity:** Routing must preserve evidence identity, provenance, authority, lifecycle, version, scope, and missing-evidence findings.
- **ROUTING-003 — Authority Preservation:** Routing must not elevate derived, Runtime, historical, conversational, frequent, recent, or high-confidence material into canonical authority.
- **ROUTING-004 — Direct/Reasoned Separation:** Direct evidence responses and Reasoning Engine requests must remain distinguishable.
- **ROUTING-005 — Governance Routing:** Approval, exception, policy, authority assignment, normative conflict, and canonical change must route to Director review.
- **ROUTING-006 — Context Isolation:** Routing must preserve Canonical, Derived, Runtime, Historical, Conversation, and Authority Context distinctions.
- **ROUTING-007 — Correct Target Rationale:** Every route must state why the target is compatible with Intent, Scope, Evidence, Authority, Priority, Governance, Confidence, and Context.
- **ROUTING-008 — Safe Failure:** Unresolved material conditions must produce clarification, insufficiency, refusal, conflict review, or escalation rather than speculative routing.
- **ROUTING-009 — Rerouting Trace:** Every reroute must preserve the original route, changed basis, rationale, and governance effect.
- **ROUTING-010 — No Execution Semantics:** A Reasoning Request must not contain or imply execution authorization, Runtime control, or mutation.

## Response Rules

- **RESPONSE-001 — Structured Contract:** Every response must preserve Question, Scope, Evidence, Reasoning Summary, Confidence, Conflicts, Recommendations, Director Notes, and Provenance when applicable.
- **RESPONSE-002 — Evidence/Conclusion Separation:** Evidence must remain distinguishable from reasoning and conclusions.
- **RESPONSE-003 — Traceable Summary:** Every material Reasoning Summary statement must map to qualified evidence and the Reasoning Trace.
- **RESPONSE-004 — Confidence Limits:** Confidence must not be represented as truth, correctness, authority, approval, or Director decision.
- **RESPONSE-005 — Conflict Visibility:** Material conflict must remain explicit and must not be suppressed by summarization.
- **RESPONSE-006 — Recommendation Separation:** A recommendation must not be represented as approval, command, plan, or execution.
- **RESPONSE-007 — Director Governance:** Director Notes must identify reserved judgment without predicting, simulating, or making the decision.
- **RESPONSE-008 — Provenance Completeness:** Every material claim must retain end-to-end provenance.
- **RESPONSE-009 — Scope-qualified Language:** Response language must not imply applicability beyond resolved Scope.
- **RESPONSE-010 — Non-autonomous Response:** A response must not mutate architecture, trigger execution, or publish itself as canonical.

## Conformance

Conformance requires every applicable rule to pass governance validation. Violations produce an explicit finding, qualification, refusal, or Director escalation. No Query, route, or response may waive these rules based on urgency, confidence, convenience, or implementation limitations.

## Enterprise Example

If a high-priority Director Query combines explanation, approval, and an operational command, conformance preserves all three intents, routes explanation to bounded reasoning, reserves approval for Director governance, rejects execution semantics, and constructs a response with evidence and provenance. Priority changes none of these authority boundaries.

## Boundaries

These rules define query architecture only. They do not select technology or define prompts, models, agents, interfaces, storage, Runtime behavior, conversations, workflows, deployment, or execution.

