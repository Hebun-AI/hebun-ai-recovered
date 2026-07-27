# 49 — Architecture Intelligence Design Rules

## Definition

These rules are the normative conformance standard for Phase 12A and every future Architecture Intelligence design. A design violating a **must** or **must not** rule is not Phase 12A-conformant.

Rule identities are unique within Phase 12A and do not replace the canonical statements they govern.

## Foundation Rules

1. **AI-FOUNDATION-001 — Phase 11 Dependency:** Architecture Intelligence must consume only Phase 11-governed architecture knowledge or other evidence explicitly classified under the Authority Model.
2. **AI-FOUNDATION-002 — Ingestion Separation:** Architecture Intelligence must not be equated with Architecture Ingestion, storage, search, or retrieval.
3. **AI-FOUNDATION-003 — Advisory Character:** Architecture Intelligence must remain advisory and must not become autonomous decision authority.
4. **AI-FOUNDATION-004 — Read-only Foundation:** Architecture Intelligence must not mutate canonical sources, derived representations, Knowledge Graphs, Runtime, or Execution State.
5. **AI-FOUNDATION-005 — Implementation Independence:** Foundation semantics must not depend on source code, API, database, vector store, model, provider, prompt, agent framework, workflow engine, graph technology, Runtime service, UI, or deployment platform.

## Authority Rules

6. **AI-AUTHORITY-001 — Canonical Primacy:** Applicable Director-approved canonical architecture must remain authoritative over every derived, observed, interpreted, hypothesized, or recommended claim.
7. **AI-AUTHORITY-002 — No Authority Creation:** Intelligence output must not create, transfer, amplify, inherit, or simulate canonical authority.
8. **AI-AUTHORITY-003 — Authority Resolution:** Every normative conclusion must resolve source identity, approval, Scope, Lifecycle, Version, and applicable authority.
9. **AI-AUTHORITY-004 — Authority–Confidence Separation:** Confidence must not override, substitute for, or increase authority.
10. **AI-AUTHORITY-005 — Evidence–Authority Separation:** Evidence quantity or quality must not independently create normative authority.
11. **AI-AUTHORITY-006 — Model Non-authority:** Model-generated interpretation, hypothesis, or recommendation must never become canonical automatically.
12. **AI-AUTHORITY-007 — Director Governance:** Architecture approval, change, exception, conflict resolution, supersession, deprecation, Scope expansion, and committing decisions must remain Director-governed.

## Evidence and Provenance Rules

13. **AI-EVIDENCE-001 — Evidence First:** Material conclusions must not be formed before applicable evidence is identified and classified.
14. **AI-EVIDENCE-002 — Provenance Required:** Every material claim must retain an independently verifiable path to source identity, statement, Lifecycle, Version, Scope, and evidence where applicable.
15. **AI-EVIDENCE-003 — No Fabricated Evidence:** Missing or broken evidence must remain explicit and must not be reconstructed, inferred, or substituted.
16. **AI-EVIDENCE-004 — Observation Classification:** Runtime observations must remain separately labelled and must not become architectural rules or decisions.
17. **AI-EVIDENCE-005 — Source Preservation:** Analysis must preserve source wording, authority, Scope, Lifecycle, Version, exceptions, supersession, conflicts, and validation findings.
18. **AI-EVIDENCE-006 — Reproducible Context:** An answer must disclose sufficient request, Scope, evidence, authority, assumptions, and reasoning context for independent review.

## Lifecycle and Reasoning Rules

19. **AI-LIFECYCLE-001 — Ordered Gates:** Scope, authority, evidence, provenance, and governance gates must pass before a Supported answer may be returned.
20. **AI-LIFECYCLE-002 — Failure Closed:** Unresolved material Scope, Authority, Evidence, Provenance, Lifecycle, or Version must prevent an unqualified Supported outcome.
21. **AI-LIFECYCLE-003 — Outcome Integrity:** Every answer must use one applicable outcome state: Supported, Partially Supported, Conflicted, Insufficient Evidence, Out of Scope, or Director Decision Required.
22. **AI-LIFECYCLE-004 — No Silent Stage Correction:** A later lifecycle stage must not silently repair or overwrite a failure or finding from an earlier stage.
23. **AI-REASONING-001 — Bounded Reasoning:** Reasoning must remain within resolved Scope, authority, evidence, and canonical semantic relationships.
24. **AI-REASONING-002 — Explainable Conclusion:** Every conclusion must state its evidence basis, reasoning basis, uncertainty, and limitations.
25. **AI-REASONING-003 — Deterministic Where Possible:** Source selection, authority classification, validation, and direct derivation must be reproducible for the same governed inputs.
26. **AI-REASONING-004 — Interpretation Labelling:** Interpretations, hypotheses, recommendations, and conclusions must remain distinguishable from canonical meaning.
27. **AI-REASONING-005 — No Unsupported Impact:** Impact analysis must not assert affected subjects or consequences without canonical relationship and evidence support.

## Conflict, Uncertainty, and Boundary Rules

28. **AI-BOUNDARY-001 — No Silent Conflict Resolution:** Conflicting applicable claims must remain visible and must not be merged, ranked by confidence, or resolved automatically.
29. **AI-BOUNDARY-002 — Conflict Escalation:** A material normative conflict must produce Conflicted or Director Decision Required.
30. **AI-BOUNDARY-003 — Explicit Uncertainty:** Missing, ambiguous, stale, conflicting, or partial support must be disclosed in conclusion and outcome state.
31. **AI-BOUNDARY-004 — Runtime Separation:** Runtime state, logs, telemetry, metrics, and observed behavior must not redefine canonical architecture.
32. **AI-BOUNDARY-005 — Validation Separation:** Validation findings must not be treated as corrections, transformations, repairs, recommendations, or approvals.
33. **AI-BOUNDARY-006 — Recommendation Separation:** A recommendation must not be represented as a Decision, Approved Rule, authorization, or Execution instruction.
34. **AI-BOUNDARY-007 — No Execution Side Effect:** Analysis, validation, conflict detection, impact analysis, answer construction, or recommendation must not trigger tools, workflows, Runtime changes, or committing action.
35. **AI-BOUNDARY-008 — No Architecture Write-back:** Intelligence must not automatically write to, revise, approve, deprecate, supersede, or archive architecture artifacts.
36. **AI-BOUNDARY-009 — Safe Refusal:** Requests requiring fabricated support, unauthorized Scope, mutation, approval, or execution must return a safe non-actionable outcome.

## Conformance Invariants

- Canonical Source ≠ Derived Knowledge
- Evidence ≠ Authority
- Authority ≠ Confidence
- Confidence ≠ Truth
- Observation ≠ Conclusion
- Conclusion ≠ Decision
- Reasoning ≠ Authority
- Recommendation ≠ Execution
- Architecture Intelligence ≠ Autonomous Decision Authority

## Enterprise Example

An analysis finds that current Runtime behavior differs from an Approved boundary. A conformant system cites both sources, labels Runtime evidence as observation, preserves canonical authority, explains uncertainty, identifies possible drift, and returns a recommendation for Director review. It does not update the boundary, repair Runtime, or declare one source false.

## Conformance Decision

Phase 12A conformance requires every rule above. Future Phase 12 sub-phases may add narrower rules but must not weaken, override, or silently reinterpret these foundations.

## Related Architecture

- [45 — Intelligence Principles](45-intelligence-principles.md)
- [46 — Intelligence Authority Model](46-intelligence-authority-model.md)
- [47 — Intelligence Lifecycle](47-intelligence-lifecycle.md)
- [48 — Reasoning and Evidence Boundaries](48-reasoning-and-evidence-boundaries.md)
- [Phase 11 Design Rules](../architecture-ingestion/36-graph-design-rules.md)

