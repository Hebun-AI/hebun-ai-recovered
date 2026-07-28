# 05 — Hypothesis Model

## Purpose

The Hypothesis Model permits bounded analytical possibilities when evidence does not yet support a conclusive finding. A hypothesis is a testable derived proposition, never evidence, fact, recommendation, or canonical truth.

## Hypothesis Contract

Every Hypothesis contains:

- stable identity and Reasoning Case reference;
- exact proposition;
- Objective and Scope;
- generation basis and applicable inference class;
- supporting evidence references;
- counterevidence and competing hypotheses;
- explicit assumptions;
- falsification or discrimination conditions;
- uncertainty and confidence rationale;
- validation and lifecycle status;
- downstream-use limitations.

## Status Model

```text
Proposed
→ Bounded
→ Testable or Untestable
→ Supported, Partially Supported, Unsupported, Conflicted, or Indeterminate
→ Retained, Superseded, Rejected, or Closed
```

No status converts a Hypothesis into canonical fact. “Supported” means the declared evidence supports it within Scope; it does not mean true, approved, or preferred.

## Competing Hypotheses

Material alternatives must remain separate and receive equivalent evidence, counterevidence, assumption, and limitation treatment. Reasoning may state which hypotheses have stronger bounded support, but Phase 14A must not recommend adoption or select an action.

## Rules

- **HYPOTHESIS-001:** Every Hypothesis must be explicitly labeled non-canonical and testable or declared untestable.
- **HYPOTHESIS-002:** A Hypothesis must not be used as evidence for itself or silently promoted to a premise.
- **HYPOTHESIS-003:** Supporting evidence, counterevidence, assumptions, and alternatives must remain visible.
- **HYPOTHESIS-004:** Missing evidence must not be replaced by a higher confidence assertion.
- **HYPOTHESIS-005:** Competing hypotheses must not be silently merged or discarded.
- **HYPOTHESIS-006:** Hypothesis status must remain distinct from truth, recommendation, approval, and decision.
- **HYPOTHESIS-007:** Material package changes require hypothesis re-evaluation.

## Enterprise Example

An observed architecture inconsistency may have two bounded explanations: a version mismatch or an undocumented dependency. Reasoning represents both as hypotheses, records evidence and falsification conditions, and reports insufficiency where neither can be distinguished. It cannot recommend changing the architecture.

## Boundaries

This model does not define hypothesis search algorithms, autonomous exploration, experiment execution, data collection, or future reasoning strategies.
