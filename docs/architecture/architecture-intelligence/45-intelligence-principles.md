# 45 — Architecture Intelligence Principles

## Purpose

These principles are the normative foundation for every future Architecture Intelligence sub-phase and implementation. Each principle states its meaning, necessity, violation risk, and conformance rule.

## Principles

| Principle | Definition | Why required | Violation risk | Normative rule |
|---|---|---|---|---|
| **Evidence First** | Evidence is established before a conclusion is formed. | Architectural answers must be independently verifiable. | Plausible but unsupported architecture claims. | Every conclusion must cite applicable evidence or be marked unsupported. |
| **Authority Preserving** | Source authority is retained without transfer, amplification, or reinterpretation. | Derived reasoning cannot govern architecture. | Model output displaces canonical architecture. | No analysis may claim authority beyond its applicable sources. |
| **Provenance Required** | Every material claim retains an unbroken evidence path. | Director review requires auditability. | Conclusions cannot be independently checked. | Answers must attach document, statement, version, lifecycle, and scope provenance where applicable. |
| **Explainable Conclusions** | Conclusions disclose the evidence and bounded reasoning supporting them. | Judgment must be reviewable rather than opaque. | Hidden assumptions appear as truth. | Every conclusion must include a concise rationale and its limits. |
| **Bounded Reasoning** | Reasoning operates only within resolved question, scope, authority, and evidence. | Cross-domain extrapolation can corrupt meaning. | Scope expansion and fabricated implications. | The system must not reason beyond declared bounds without explicit escalation. |
| **Deterministic Where Possible** | Source selection, authority resolution, validation, and direct derivation are repeatable. | Stable inputs should produce reproducible evidence foundations. | Identical questions receive inconsistent source bases. | Deterministic operations must be distinguished from interpretive reasoning. |
| **Explicit Uncertainty** | Missing, ambiguous, stale, or conflicting support is visible. | Confidence must not conceal epistemic limits. | Weak evidence becomes false certainty. | Uncertainty must be stated and reflected in the outcome status. |
| **No Fabricated Authority** | Authority cannot be generated from confidence, popularity, role assumptions, or model output. | Governance originates outside intelligence. | Autonomous architectural control. | Unknown authority must remain unresolved and fail closed. |
| **No Silent Conflict Resolution** | Conflicting applicable claims remain visible until governed resolution. | Automated merging would rewrite architecture. | Loss of normative history and Director control. | Conflict detection must produce a Conflicted or Director Decision Required outcome. |
| **Director Governed** | The Director controls normative decisions, approvals, exceptions, and changes. | Architecture Intelligence is advisory. | Recommendations become unauthorized decisions. | Intelligence must escalate every authority-requiring outcome to the Director. |
| **Reproducible Analysis** | Analysis records enough input, scope, evidence, assumptions, and reasoning basis to be repeated. | Enterprise review requires comparable outcomes. | Results depend on hidden context. | Every answer must disclose its analysis context and provenance. |
| **Observation–Conclusion Separation** | Observed facts and interpretations are represented distinctly. | Runtime condition is not architecture meaning. | Observation silently becomes rule or decision. | Each claim must be labelled as evidence, observation, conclusion, hypothesis, or recommendation. |
| **Validation–Recommendation Separation** | Conformance findings and proposed responses remain distinct. | Validation does not authorize remediation. | Detection triggers unapproved correction. | A recommendation must never alter the validation result or its evidence. |

## Cross-principle Rules

- Higher confidence cannot compensate for lower authority.
- More evidence does not automatically create normative force.
- Explainability does not make an unsupported conclusion valid.
- Reproducibility does not make inference canonical.
- Director review does not permit the system to anticipate approval.

## Enterprise Example

Two Approved documents appear to define incompatible authority boundaries. Intelligence preserves both sources, resolves their versions and scopes, records the conflict, explains the incompatibility, marks uncertainty, and returns `Director Decision Required`. It does not merge the rules or select the more recent document without explicit governance evidence.

## Related Architecture

- [Phase 11 Ingestion Principles](../architecture-ingestion/02-ingestion-principles.md)
- [Phase 11 Ontology Design Rules](../architecture-ingestion/18-ontology-design-rules.md)
- [Phase 11 Graph Design Rules](../architecture-ingestion/36-graph-design-rules.md)
- [46 — Intelligence Authority Model](46-intelligence-authority-model.md)
- [48 — Reasoning and Evidence Boundaries](48-reasoning-and-evidence-boundaries.md)

