# 28 — Governance Explainability

## Purpose

Governance Explainability enables an authorized reviewer to understand why a canonical Outcome State follows from declared use, constraints, applicability, findings, and limitations.

## Explanation Contract

Every Outcome explains input and declared use, Scope, applicable and excluded constraints, authority resolution, permission and approval separation, compliance and privacy findings, classification, risks, redaction, exceptions, review requirements, conflicts, insufficiency, and Trace mapping.

## Rules

- **GEXPLAIN-001:** Every material Evaluation Unit and Outcome must be explainable.
- **GEXPLAIN-002:** Explanation must map to canonical references and Audit Trace.
- **GEXPLAIN-003:** Conflicts, missing basis, failed controls, conditions, and review states must remain visible.
- **GEXPLAIN-004:** Explanation must not simplify eligibility into correctness or approval.
- **GEXPLAIN-005:** Explanation must not contain recommendation, decision, enforcement, or execution instruction.
- **GEXPLAIN-006:** Protected content must not be disclosed beyond authorization.
- **GEXPLAIN-007:** Prompt, model transcript, or Runtime log is not canonical explanation.

## Enterprise Example

An `ALLOW_WITH_REDACTION` explanation names the privacy rule, protected fields, declared audience, validation requirement, residual risk, and why no broader use is eligible.

## Boundaries

No response generator, UI, prompt, transcript, visualization, or personalization is defined.
