# 27 — Explainability Model

## Purpose

Explainability enables an authorized reviewer to understand what a Result means, why it follows, which evidence and assumptions support it, what opposes it, and where its limits lie.

## Explanation Contract

Every material Result explanation includes:

- Objective, Scope, and intended analytical use;
- plain definition of the Result;
- evidence and citation map;
- inference classes and material transformations;
- assumptions and sensitivity;
- alternatives, counterevidence, and contradictions;
- uncertainty and confidence rationale;
- validation outcome and limitations;
- precise Review Required question when applicable.

## Explanation Levels

- **Result Summary:** bounded statement and status.
- **Evidence Explanation:** source and premise support.
- **Inference Explanation:** how premises lead to the Result.
- **Alternative Explanation:** why alternatives remain, differ, or were rejected.
- **Boundary Explanation:** what reasoning did not and may not do.
- **Reconstruction Explanation:** complete Trace navigation for independent review.

## Rules

- **EXPLAIN-001:** Every material inference and Result must be explainable.
- **EXPLAIN-002:** Explanation must cite immutable evidence and explicit Assumptions.
- **EXPLAIN-003:** Material failed branches, alternatives, contradictions, and uncertainty must remain visible.
- **EXPLAIN-004:** Explanation must be faithful to the Trace and must not invent a simplified rationale.
- **EXPLAIN-005:** Explanation depth may vary by audience, but semantic content and limitations must not change.
- **EXPLAIN-006:** Explainability must not expose protected evidence beyond authorization.
- **EXPLAIN-007:** A prompt, model transcript, hidden chain-of-thought, or implementation log is not the canonical explanation.

## Enterprise Example

A Result states that one dependency may violate a boundary. Its explanation identifies the two source rules, one Scope Assumption, a conflicting version record, the constraint test, and why status is Conflicted rather than Supported.

## Boundaries

No natural-language generation system, UI, visualization, prompt, transcript, or audience-personalization implementation is defined.
