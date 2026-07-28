# 09 — Reasoning Output Package

## Purpose

The Reasoning Output Package is the immutable, structured, non-canonical product of one Reasoning Case. It communicates analytical support and limitations without becoming a decision, recommendation, approval, answer, or executable instruction.

## Package Contract

| Component | Required Content |
|---|---|
| Identity | package identity, version, Reasoning Case, creation reference |
| Input Binding | Processing Output Package identity, version, hashes, eligibility outcome |
| Objective and Scope | exact analytical objective, inclusions, exclusions, unresolved boundaries |
| Structured Results | separately identifiable findings with status and materiality |
| Evidence Map | immutable evidence references and citation anchors for each Result |
| Reasoning Trace | Units, premises, transformations, branches, failures, and Result mapping |
| Hypotheses | propositions, support, counterevidence, alternatives, and status |
| Assumptions | type, materiality, sensitivity, expiry, and dependent Results |
| Conflicts | inherited and reasoning-discovered incompatibilities without resolution |
| Validation | structural support, consistency, boundary, provenance, and package-integrity findings |
| Confidence | evidence-grounded dimensions and rationale per material Result |
| Limitations | insufficiency, partiality, uncertainty, exclusions, and prohibited uses |
| Review Requirements | exact reserved question, evidence, and affected Results |
| Protection Metadata | Tenant, classification, retention, disclosure, provenance, and supersession |

## Result Statuses

- **Supported** — bounded evidence and inference support the Result.
- **Partially Supported** — separable portions are supported and unsupported portions explicit.
- **Insufficient** — required evidence or premises are missing.
- **Conflicted** — material evidence or interpretations remain incompatible.
- **Rejected** — the proposed Result violates evidence, logic, Scope, or boundary constraints.
- **Review Required** — an external authoritative judgment is necessary.

No status means true, approved, recommended, canonical, authorized, or executable.

## Immutability and Lineage

Every package version is immutable. Correction or re-analysis creates a new version linked to its predecessor and exact Phase 13 input. Original evidence remains recoverable through Phase 13 lineage and is never copied into a replacement source.

## Rules

- **ROUTPUT-001:** Every material Result must map to evidence, Inference Units, Assumptions, validation, confidence, conflicts, and limitations.
- **ROUTPUT-002:** The package must preserve the exact Processing Output Package identity and version.
- **ROUTPUT-003:** Package content must remain Tenant-, classification-, retention-, and disclosure-bound.
- **ROUTPUT-004:** Reasoning Output must never be represented as a decision, recommendation, approval, authorization, canonical statement, or action.
- **ROUTPUT-005:** Missing, unsupported, conflicted, and rejected findings must remain visible.
- **ROUTPUT-006:** A new analysis or correction must create a new immutable package version.
- **ROUTPUT-007:** Review Required must state a question and evidence without proposing an outcome.
- **ROUTPUT-008:** The package must contain no prompts, model transcripts, tool instructions, workflows, or execution payloads.

## Enterprise Example

An output package reports one supported dependency, one partially supported impact, two competing hypotheses, a material continuity Assumption, and an unresolved authority conflict. It states the exact review question but does not recommend a preferred resolution.

## Boundaries

The package is structured derived intelligence. It is not a Phase 15 query answer, Phase 16 governance result, Director decision, Runtime command, or canonical-source update.
