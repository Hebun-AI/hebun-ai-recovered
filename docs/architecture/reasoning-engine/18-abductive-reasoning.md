# 18 — Abductive Reasoning

## Purpose

Abductive Reasoning forms plausible explanatory hypotheses for observed evidence without presenting plausibility as proof, preference, recommendation, or decision.

## Contract

An abductive Unit records the observation to explain, candidate hypotheses, prior eligible constraints, supporting and opposing evidence, explanatory coverage, unsupported assumptions, discriminating evidence, alternative explanations, and uncertainty.

## Comparison

Hypotheses may be compared by evidence coverage, contradiction, assumption burden, canonical compatibility, provenance, and testability. Phase 14B may state comparative support; it must not recommend adopting an explanation or acting on it.

## Rules

- **ABDUCT-001:** Abduction must preserve more than one material plausible explanation when evidence cannot discriminate.
- **ABDUCT-002:** Explanatory fit must not be represented as causal proof.
- **ABDUCT-003:** Assumption burden and missing discriminating evidence must be explicit.
- **ABDUCT-004:** A preferred action must not be derived from comparative plausibility.
- **ABDUCT-005:** Hypotheses must remain non-canonical and traceable to observations.
- **ABDUCT-006:** Evidence gathered outside the Processing Output Package cannot enter the analysis.

## Enterprise Example

An architecture mismatch may be explained by version drift, incomplete ingestion, or an undocumented exception. Abduction preserves all supported candidates and states what evidence would discriminate them; it chooses no remediation.

## Boundaries

No autonomous hypothesis search, experiment planning, tool use, evidence acquisition, or recommendation engine is defined.
