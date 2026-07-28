# 20 — Causal Reasoning

## Purpose

Causal Reasoning examines whether eligible evidence supports a bounded causal relationship, mechanism, or consequence without equating correlation, sequence, or dependency with causation.

## Causal Claim Contract

A causal Unit records cause and effect propositions, temporal order, mechanism evidence, necessary and sufficient conditions when known, alternative causes, confounders, counterevidence, intervention evidence if already present in the package, Scope, uncertainty, and validation.

## Causal Statuses

- **Observed Association**
- **Temporally Compatible**
- **Mechanistically Supported**
- **Causally Supported within Scope**
- **Confounded**
- **Insufficient**
- **Conflicted**

No status authorizes an intervention.

## Rules

- **CAUSAL-001:** Correlation, dependency, and temporal precedence must remain distinct from causation.
- **CAUSAL-002:** Every causal finding must state mechanism evidence and plausible alternatives.
- **CAUSAL-003:** Confounders and counterevidence must remain visible.
- **CAUSAL-004:** Causal strength cannot exceed eligible evidence and Scope.
- **CAUSAL-005:** Missing intervention evidence must not be fabricated or requested through tool use.
- **CAUSAL-006:** A causal finding must not produce an intervention recommendation, decision, or execution plan.

## Enterprise Example

Two architecture defects co-occur after a version change. Reasoning may report temporal compatibility and a plausible mechanism but must preserve alternative causes and cannot order rollback.

## Boundaries

No experimentation, intervention, causal discovery algorithm, telemetry ingestion, or Runtime control is defined.
