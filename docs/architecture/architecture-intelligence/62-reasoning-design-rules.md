# 62 — Architecture Reasoning Design Rules

## Definition

These rules are the normative conformance contract for Phase 12C. Rule identities are unique. Any later reasoning design or implementation must demonstrate compliance while preserving Phase 11 and Phase 12A–12B contracts.

## Reasoning Rules

- **REASONING-001 — Evidence Dependency:** Every material Reasoning Result must depend on qualified, traceable evidence.
- **REASONING-002 — Objective Binding:** Reasoning must be bound to one explicit objective and resolved scope.
- **REASONING-003 — Authority Preservation:** Reasoning must preserve source authority and must not infer authority from confidence, recency, repetition, or Runtime behavior.
- **REASONING-004 — Canonical Protection:** Reasoning must not modify, supersede, approve, or silently reinterpret canonical architecture.
- **REASONING-005 — Explicit Strategy:** Every material Reasoning Unit must identify its applicable strategy.
- **REASONING-006 — Strategy Integrity:** Deduction, induction, abduction, hypothesis, constraint, impact, and dependency findings must remain semantically distinct.
- **REASONING-007 — Assumption Visibility:** Every material assumption must be explicit, scoped, and distinguishable from evidence.
- **REASONING-008 — Deterministic Basis:** Equivalent objective, scope, evidence, authority, rules, and declared assumptions should produce materially equivalent analytical results.
- **REASONING-009 — Alternative Preservation:** Material alternative explanations or conclusions must remain visible when evidence cannot discriminate.
- **REASONING-010 — No Fabricated Premise:** Missing premises, relationships, constraints, evidence, or authority must not be invented.
- **REASONING-011 — Processing Separation:** Reasoning must consume a governed processing basis and must not silently redo scope, authority, or evidence resolution.
- **REASONING-012 — Non-autonomous Reasoning:** A Result remains advisory and must not become an autonomous decision, plan, mutation, or action.

## Trace Rules

- **TRACE-001 — Complete Lineage:** The Reasoning Trace must connect objective, scope, context, evidence, Units, assumptions, alternatives, Result, validation, and confidence.
- **TRACE-002 — Material Step Capture:** Every material inference or transformation must be represented in the Trace.
- **TRACE-003 — Evidence Reference:** Each premise must retain source identity, provenance, authority, lifecycle, version, and scope.
- **TRACE-004 — Explainability:** A reviewer must be able to understand why the Result follows and where uncertainty remains.
- **TRACE-005 — Failure Visibility:** Rejected, failed, conflicted, or insufficient material reasoning paths must not be hidden.
- **TRACE-006 — No Prompt Identity:** A Reasoning Trace must not be defined as or reduced to a prompt, hidden instruction, or model transcript.
- **TRACE-007 — Session Boundary:** Trace content must remain bound to its Reasoning Session and must not silently absorb unrelated conversation.
- **TRACE-008 — Result Mapping:** Every material Result statement must map to supporting Trace elements.
- **TRACE-009 — Reproducible Basis:** The Trace must contain enough governed architectural information to reproduce the analytical basis independently of implementation.

## Validation Rules

- **VALIDATION-001 — Validation Before Response:** Every material Result must be validated before inclusion in a Structured Response.
- **VALIDATION-002 — Complete Controls:** Validation must assess evidence sufficiency, authority compliance, logical consistency, boundary compliance, provenance completeness, and confidence alignment.
- **VALIDATION-003 — Explicit Outcome:** Validation must assign Valid, Partially Valid, Insufficient Evidence, Conflicted, or Director Review Required.
- **VALIDATION-004 — No Approval:** A Valid outcome must not be represented as approval, truth, canonical status, or execution authorization.
- **VALIDATION-005 — Confidence Alignment:** Confidence must reflect validation findings and must not conceal material weakness or conflict.
- **VALIDATION-006 — Partiality Preservation:** Supported and unsupported portions of a Partially Valid Result must remain distinguishable.
- **VALIDATION-007 — Conflict Escalation:** Material canonical or authority conflicts must yield Conflicted or Director Review Required.
- **VALIDATION-008 — No Silent Correction:** Validation must report defects and limits without correcting canonical or derived sources.
- **VALIDATION-009 — Director Escalation:** Approval, exception, authority assignment, normative conflict, or canonical change must be escalated to the Director.

## Boundary Rules

- **BOUNDARY-001 — No Mutation:** Reasoning must not mutate canonical documents, derived representations, Knowledge Graphs, contexts, Runtime state, or execution state.
- **BOUNDARY-002 — No Execution:** Reasoning and recommendations must not initiate, schedule, authorize, or control execution.
- **BOUNDARY-003 — No Rule Creation:** Reasoning must not create or publish a normative architecture rule.
- **BOUNDARY-004 — No Policy Authority:** Reasoning must not create, change, waive, or bypass policy.
- **BOUNDARY-005 — No Director Substitution:** Reasoning must not make, simulate, pre-empt, or impersonate a Director decision.
- **BOUNDARY-006 — Runtime Separation:** Runtime evidence must remain observational and must not redefine canonical architecture.
- **BOUNDARY-007 — Scope Enforcement:** Reasoning must stop, qualify, or escalate when a material conclusion exceeds resolved scope.
- **BOUNDARY-008 — Recommendation Separation:** A recommendation must remain distinct from approval, instruction, plan, and execution.
- **BOUNDARY-009 — Governance Supremacy:** Director-approved governance boundaries control reasoning behavior and outcomes.
- **BOUNDARY-010 — No Self-modification:** Reasoning must not alter its governing architecture, rules, authority, or constraints.

## Conformance

Conformance requires all applicable rules to pass validation. A violation produces a visible governance finding, refusal, qualification, or Director escalation. No component may waive a rule based on confidence, convenience, or implementation limitation.

## Enterprise Example

When an impact analysis has complete evidence for one domain but incomplete dependency coverage in another, the rules require explicit scope, preserved assumptions, traceable impact steps, a partial or insufficient validation outcome, aligned confidence, and Director escalation if approval is requested. The analysis cannot fill the gap, approve the change, or initiate execution.

## Boundaries

These rules define reasoning architecture only. They do not select technology, prescribe prompts, define models, create agents, implement services, construct workflows, or authorize autonomous behavior.

