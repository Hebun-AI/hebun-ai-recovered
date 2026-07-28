# 20 — Privacy Evaluation

## Purpose

Privacy Evaluation determines whether declared use aligns with applicable purpose, minimization, audience, disclosure, retention, deletion, jurisdiction, and sensitive-data constraints.

## Privacy Controls

- purpose compatibility;
- data minimization;
- audience and need-to-know;
- classification and sensitive-category handling;
- masking or redaction requirement;
- retention and deletion compatibility;
- jurisdiction and transfer restrictions;
- provenance and consent or authority reference when applicable;
- downstream disclosure limitations.

## Rules

- **PRIVEVAL-001:** Privacy constraints must be canonical, applicable, current, and traceable.
- **PRIVEVAL-002:** Unknown classification or purpose must not default to permissive use.
- **PRIVEVAL-003:** Redaction requirements must identify exact protected elements and rationale without performing redaction.
- **PRIVEVAL-004:** Privacy conflict or legal ambiguity yields specialized review or denial.
- **PRIVEVAL-005:** Privacy eligibility does not grant permission, approval, or business authorization.
- **PRIVEVAL-006:** Governance must not retrieve, expose, mask, delete, or transform source content.

## Enterprise Example

Internal analysis is eligible only if personal identifiers are removed. Governance emits `ALLOW_WITH_REDACTION` and exact constraints; an external mechanism must perform and validate redaction.

## Boundaries

No privacy engine, DLP, consent service, masking implementation, deletion workflow, or legal interpretation is defined.
