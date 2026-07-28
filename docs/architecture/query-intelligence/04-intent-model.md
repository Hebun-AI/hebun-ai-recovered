# 04 — Intent Model

## Purpose

The Intent Model classifies what analytical purpose a Query appears to seek without performing analysis, generating an answer, or granting authority.

## Foundational Intent Classes

| Intent | Purpose | Qualification Boundary |
|---|---|---|
| Information Qualification | identify a bounded request for supported information analysis | does not retrieve or answer |
| Architecture Explanation | request explanation of meaning, relationship, boundary, lifecycle, or rationale | does not explain |
| Impact Analysis | request analysis of possible affected architecture | does not calculate impact |
| Dependency Analysis | request analysis of explicit reliance | does not infer Runtime sequence |
| Constraint Validation | request reasoning against named constraints | does not approve or enforce |
| Conflict Analysis | request analysis of incompatible evidence or interpretations | does not resolve normatively |
| Hypothesis Analysis | request structured comparison of possible explanations | does not prefer an option |
| Unsupported Outcome | requested outcome is answer, recommendation, decision, governance, execution, or another forbidden responsibility | cannot enter reasoning as stated |
| Out of Scope | no safe architectural analytical purpose can be established | clarification or refusal |

## Intent Status

`Candidate`, `Resolved`, `Multi-Intent`, `Ambiguous`, `Unsupported`, or `Out of Scope`.

Intent classification records evidence from the Query wording and declared Context, rationale, alternatives considered, ambiguity, constraints, and prohibited interpretations.

## Rules

- **QINTENT-001:** Every Query must receive an explicit Intent status.
- **QINTENT-002:** Intent must not add, remove, or substitute a material user or system purpose.
- **QINTENT-003:** Intent and Objective must remain distinct.
- **QINTENT-004:** Multi-Intent decomposition must preserve each purpose and shared constraints.
- **QINTENT-005:** Material ambiguity must yield clarification, qualification, or refusal—never a silent guess.
- **QINTENT-006:** Intent must not create authority, evidence, recommendation, decision, or execution meaning.
- **QINTENT-007:** Classification rationale must be explainable and traceable.

## Enterprise Example

“Explain this dependency and choose the best replacement” contains an Architecture Explanation Intent and an unsupported recommendation/decision outcome. Only the explanation portion may support Objective formation; the preferred-choice request remains rejected and visible.

## Boundaries

Intent classification is not reasoning, routing implementation, governance, response construction, or decision logic.
