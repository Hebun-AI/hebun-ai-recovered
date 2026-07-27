# 56 — Knowledge Processing Design Rules

## Definition

These rules are the normative conformance contract for Phase 12B. Every rule identity is unique. A future design must demonstrate compliance without weakening Phase 11 provenance or Phase 12A authority boundaries.

## Pipeline Rules

- **PIPELINE-001 — Ordered Meaning:** Scope Resolution must precede Authority Resolution, and both must precede evidence combination.
- **PIPELINE-002 — Evidence Preservation:** Every processed claim must retain its source evidence and provenance through Structured Output.
- **PIPELINE-003 — No Fabrication:** Missing architecture, evidence, identity, relationship, scope, or authority must be reported, never invented.
- **PIPELINE-004 — Canonical Protection:** Processing must not modify, supersede, approve, or silently reinterpret canonical architecture.
- **PIPELINE-005 — Logical Architecture Only:** Processing stages define responsibilities and dependencies, not a Runtime workflow, state machine, agent sequence, or deployment.
- **PIPELINE-006 — Deterministic Basis:** The same resolved scope, applicable versions, evidence, rules, and declared assumptions should produce the same processing basis and materially equivalent findings.
- **PIPELINE-007 — Explainable Transformation:** Every normalization, inclusion, exclusion, and qualification must have a traceable rationale.
- **PIPELINE-008 — Failure Visibility:** A stage failure must remain explicit and must not be concealed by a later stage.
- **PIPELINE-009 — No Silent Expansion:** Processing must not expand question, evidence, time, domain, or authority scope without explicit disclosure and governance.
- **PIPELINE-010 — Governance Before Release:** Structured Output must pass Governance Validation before Director-facing release.
- **PIPELINE-011 — No Execution:** Processing output must not authorize, initiate, schedule, or imply Runtime execution.
- **PIPELINE-012 — Director Governance:** Matters requiring normative judgment, authority assignment, exception, or canonical change must be escalated to the Director.

## Context Rules

- **CONTEXT-001 — Explicit Classification:** Every context item must be classified as Canonical, Derived, Runtime, Historical, Conversation, or Authority Context.
- **CONTEXT-002 — Isolation:** Context classes must remain distinguishable and must not be merged into an authority-neutral collection.
- **CONTEXT-003 — Authority Non-transfer:** Inclusion, proximity, repetition, or agreement must not transfer canonical authority to non-canonical context.
- **CONTEXT-004 — Scope Binding:** Every assembled context must be bound to the resolved question, scope, lifecycle, and applicable version.
- **CONTEXT-005 — Minimal Sufficiency:** Context must include material evidence while excluding irrelevant information.
- **CONTEXT-006 — Current/Historical Separation:** Historical validity must not be represented as current validity.
- **CONTEXT-007 — Runtime Separation:** Runtime Context may inform observations and drift findings but must not redefine canonical architecture.
- **CONTEXT-008 — Conversation Separation:** Conversation Context may express intent and constraints but must not become canonical truth without governed approval.
- **CONTEXT-009 — Durable Source:** Context is disposable analytical framing; durable truth remains in its governed source.

## Conflict Rules

- **CONFLICT-001 — Detect, Do Not Resolve:** The pipeline may detect and classify conflict but must not make a normative resolution.
- **CONFLICT-002 — Evidence Completeness:** Every conflict must preserve all material claims, sources, provenance, authority, lifecycle, version, and scope.
- **CONFLICT-003 — Typed Finding:** Every detected conflict must use an explicit conflict type or remain Unknown.
- **CONFLICT-004 — Severity Rationale:** Conflict severity must be explained by authority, normative effect, conclusion safety, and architectural impact.
- **CONFLICT-005 — Version Awareness:** Difference across lifecycle or version must not be called conflict until applicability is established.
- **CONFLICT-006 — Runtime Non-authority:** Runtime disagreement with architecture must be treated as possible drift or non-conformity, not automatic canonical invalidity.
- **CONFLICT-007 — Mandatory Escalation:** Canonical, authority, materially unknown, or other normatively material conflicts must be escalated to the Director.
- **CONFLICT-008 — No Suppression:** Normalization, confidence assessment, summarization, or governance validation must not hide a material conflict.
- **CONFLICT-009 — Resolution Ownership:** A conflict record must identify the governing resolution authority without impersonating it.

## Confidence Rules

- **CONFIDENCE-001 — Multidimensional Basis:** Confidence must consider Evidence Completeness, Authority Level, Consistency, Agreement, Coverage, and Freshness.
- **CONFIDENCE-002 — Finding-level Assessment:** Confidence must be assessed for each material finding and not only for the output as a whole.
- **CONFIDENCE-003 — Explainability:** Every confidence qualification must cite its evidence, dimension judgments, limiting conditions, and uncertainty.
- **CONFIDENCE-004 — No Authority Creation:** Confidence must never create, raise, transfer, or override architectural authority.
- **CONFIDENCE-005 — No Truth Claim:** Confidence must not be represented as truth, correctness, approval, or Director decision.
- **CONFIDENCE-006 — No Compensating Average:** Strong dimensions must not average away a materially weak or unknown dimension.
- **CONFIDENCE-007 — Conflict Limit:** Material unresolved canonical or authority conflict must limit the confidence qualification and remain visible.
- **CONFIDENCE-008 — Independence Awareness:** Repeated or dependent evidence must not be misrepresented as independent agreement.
- **CONFIDENCE-009 — Recency Boundary:** Freshness must be interpreted within scope and lifecycle; recency must not outrank authority.
- **CONFIDENCE-010 — No Execution Trigger:** No confidence qualification may automatically authorize execution, mutation, approval, or publication as canonical.

## Conformance

Conformance requires evidence that every applicable rule is satisfied. A detected violation produces a governance finding. Validation may reject an output or require Director escalation, but it must not rewrite the rule, correct canonical material, or grant an exception.

## Enterprise Example

If Runtime Context strongly and repeatedly disagrees with one approved rule, the applicable context, conflict, confidence, and pipeline rules operate together: the observations remain operational evidence, the mismatch is visible, confidence in operational conformity is limited, and the Director receives the architecture question. The canonical rule is not changed by processing.

## Boundaries

These rules do not select technology, define source code, prescribe implementation tests, create workflow behavior, or authorize Runtime control. They govern the architecture of knowledge preparation only.
