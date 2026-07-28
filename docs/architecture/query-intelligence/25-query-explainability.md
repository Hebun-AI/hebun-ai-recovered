# 25 — Query Explainability

## Purpose

Query Explainability enables an authorized reviewer to understand why a Query received its Intent, Objective, Scope, Context, constraints, plan, and final qualification outcome.

## Explanation Contract

Every ready package or safe non-package outcome explains:

- what Query was preserved;
- how Intent candidates were classified;
- which ambiguities were resolved or retained;
- why decomposition was or was not valid;
- how the Objective was refined without leading;
- how Scope, domain, organization, and Context were qualified;
- which constraints and missing information applied;
- why the selected Processing Output Package reference was compatible;
- why the terminal outcome followed;
- what Query Intelligence explicitly did not do.

## Rules

- **QEXPLAIN-001:** Every material qualification step must be explainable.
- **QEXPLAIN-002:** Explanation must map to Query Trace and original content.
- **QEXPLAIN-003:** Ambiguity, rejected semantics, missing information, and alternatives must remain visible.
- **QEXPLAIN-004:** Simplification must not change meaning, Scope, or limitations.
- **QEXPLAIN-005:** Explanation must not contain an answer, reasoning Result, recommendation, decision, governance finding, or execution instruction.
- **QEXPLAIN-006:** Protected Query and Context content must not be disclosed beyond authorization.
- **QEXPLAIN-007:** Prompt or model transcript is not the canonical explanation.

## Enterprise Example

A Request Package explanation shows that an approval phrase was rejected, a dependency-analysis Intent remained, the version Scope required clarification, and package readiness was therefore withheld. It gives no answer.

## Boundaries

No natural-language generator, UI, prompt, transcript, personalization, or response system is defined.
