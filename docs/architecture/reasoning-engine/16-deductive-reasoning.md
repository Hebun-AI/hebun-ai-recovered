# 16 — Deductive Reasoning

## Purpose

Deductive Reasoning derives a finding that follows from explicit eligible premises and applicable canonical rules within a bounded Scope.

## Contract

A deductive Unit records premises, rule or constraint, applicability evidence, transformation, finding, validity conditions, counterexample search, limitations, and Trace mapping.

A deductive finding is supported only when:

- every premise is eligible and applicable;
- the rule is canonical and correctly scoped;
- the transformation is valid and inspectable;
- no material contradiction defeats applicability;
- the finding does not exceed premise authority or Scope.

## Failure Outcomes

Invalid premise, ambiguous rule, missing applicability, contradiction, or invalid transformation yields Rejected, Insufficient, Conflicted, or Review Required—not a repaired proof.

## Rules

- **DEDUCT-001:** Deduction must name every premise and applicable canonical rule.
- **DEDUCT-002:** Valid form cannot compensate for false, invalid, or inapplicable premises.
- **DEDUCT-003:** The conclusion must not exceed Scope or source authority.
- **DEDUCT-004:** Counterexamples and exceptions must be tested when the rule permits them.
- **DEDUCT-005:** Deductive support must remain distinguishable from truth and approval.
- **DEDUCT-006:** Missing premises must not be fabricated to complete a deduction.

## Enterprise Example

If a canonical rule prohibits a dependency class and qualified evidence confirms that exact dependency in the applicable version, deduction may report a bounded incompatibility finding. It cannot approve remediation or modify the dependency.

## Boundaries

No theorem prover, rule engine, formal language, solver, or execution behavior is selected.
