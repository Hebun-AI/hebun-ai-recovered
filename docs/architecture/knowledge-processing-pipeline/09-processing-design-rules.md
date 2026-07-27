# 09 — Knowledge Processing Pipeline Design Rules

## Definition

These rules are the normative conformance contract for Phase 13. They extend Phase 12B without weakening or duplicating its foundational rule identities.

## Pipeline Rules

- **KPP-001 — Canonical Dependency:** Phase 13 must consume Phase 11 and Phase 12 contracts without redefining them.
- **KPP-002 — Request Before Processing:** No processing artifact may be formed without a traceable, qualified Processing Request.
- **KPP-003 — Scope Before Evidence:** Processing Scope must be resolved before evidence eligibility is determined.
- **KPP-004 — Authority Before Combination:** Authority Context must be resolved before evidence from different sources is combined.
- **KPP-005 — Ordered Semantic Dependency:** Stage meaning must follow the canonical Phase 12B order.
- **KPP-006 — No Silent Expansion:** Objective, Scope, constraints, authority, evidence, or acceptance criteria must not expand silently.
- **KPP-007 — Deterministic Basis:** Equivalent governed inputs should produce materially equivalent artifacts and findings.
- **KPP-008 — Explainable Preparation:** Every material inclusion, exclusion, normalization, classification, and handoff must have a rationale.
- **KPP-009 — No Conclusion:** Phase 13 must not produce reasoning conclusions, Query answers, decisions, or recommendations.
- **KPP-010 — No Execution:** Processing must not authorize, initiate, schedule, coordinate, or imply execution.
- **KPP-011 — Director Governance:** Reserved normative judgments must be surfaced for Director review.

## Artifact Rules

- **ARTIFACT-001 — Stable Identity:** Every artifact must have a stable identity within one Processing Case.
- **ARTIFACT-002 — Type Integrity:** Every artifact must declare one canonical artifact type.
- **ARTIFACT-003 — Common Contract:** Every artifact must preserve source, Scope, authority, provenance, lineage, validation, limitation, and ownership metadata.
- **ARTIFACT-004 — Canonical Non-equivalence:** No artifact may be represented as its canonical source.
- **ARTIFACT-005 — Original Preservation:** A normalized or derived artifact must retain a direct reference to original evidence.
- **ARTIFACT-006 — Lineage Completeness:** Every material output assertion must trace to eligible evidence through recorded transformations.
- **ARTIFACT-007 — Limitation Propagation:** Limitations and conflicts must remain attached through every downstream artifact.
- **ARTIFACT-008 — Explicit Supersession:** Artifact replacement must preserve the prior artifact and supersession rationale.
- **ARTIFACT-009 — Output Package Completeness:** Processing Output must contain every artifact required by Acceptance Criteria or explicitly report its absence.
- **ARTIFACT-010 — Non-authoritative Output:** Processing Output must not create authority, approval, permission, or canonical truth.

## Handoff Rules

- **HANDOFF-001 — Explicit Contract:** Every stage transition must use an explicit Stage Handoff Contract.
- **HANDOFF-002 — Entry Validation:** A receiving stage must validate applicable entry conditions before accepting an artifact.
- **HANDOFF-003 — Exit Validation:** A producing stage must record exit-condition status and unresolved findings.
- **HANDOFF-004 — Responsibility Transfer:** Handoff must identify the receiving responsibility without transferring authority.
- **HANDOFF-005 — No Silent Repair:** A receiving stage must not repair, replace, or reinterpret an upstream failure silently.
- **HANDOFF-006 — Limited Handoff:** Limited artifacts may proceed only when separable, explicit, permitted by Acceptance Criteria, and safe.
- **HANDOFF-007 — Blocking Failure:** Authority, provenance, canonical, tenant, or boundary failure must block affected handoff.
- **HANDOFF-008 — Rejection Trace:** Rejected handoffs must preserve failed conditions, evidence, affected artifact, and accountable stage.
- **HANDOFF-009 — No Runtime Meaning:** Handoff must not be represented as a workflow transition, message, task, or execution event.

## Integrity Rules

- **INTEGRITY-001 — Complete Validation:** Request, Scope, Authority, Evidence, Artifact, Lineage, Normalization, Context, Handoff, Conflict, Confidence, and Output Integrity must be assessed.
- **INTEGRITY-002 — No Fabrication:** Missing source, evidence, identity, provenance, authority, or relationship must remain missing.
- **INTEGRITY-003 — Meaning Preservation:** Normalization must preserve original meaning and material variance.
- **INTEGRITY-004 — Context Isolation:** Canonical Context classes must remain explicit and separate.
- **INTEGRITY-005 — Conflict Visibility:** Material conflict must remain visible and unresolved by processing.
- **INTEGRITY-006 — Confidence Limit:** Confidence must not establish truth, correctness, authority, or approval.
- **INTEGRITY-007 — Failure Honesty:** Failure, invalidity, insufficiency, and partiality must not be converted into success.
- **INTEGRITY-008 — Validation/Correction Separation:** Validation findings must not mutate or repair artifacts.
- **INTEGRITY-009 — Revalidation on Change:** Material Request, Scope, authority, evidence, lifecycle, version, constraint, or artifact change requires revalidation.
- **INTEGRITY-010 — Canonical Protection:** Processing must not write back, modify, approve, supersede, or archive canonical architecture.

## Conformance

Conformance requires all applicable rules to pass. A violation yields an explicit finding, refusal, limited output, invalid output, or Director review requirement.

## Boundaries

These rules select no technology and define no parser, retrieval engine, reasoning engine, Query interface, policy engine, workflow, Runtime, storage, API, agent, or deployment.

