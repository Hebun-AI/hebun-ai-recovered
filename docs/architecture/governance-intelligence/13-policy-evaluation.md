# 13 — Policy Evaluation

## Purpose

Policy Evaluation determines whether an approved policy reference applies to the declared use and what eligibility constraints follow from its explicit text.

## Evaluation Contract

Each evaluation records policy identity, version, authority, lifecycle, effective interval, Scope, jurisdiction, audience, obligations, prohibitions, conditions, exceptions, precedence, conflicts, citation anchors, applicability, finding, and limitations.

## Outcomes

`Applicable and Satisfied`, `Applicable with Conditions`, `Applicable and Violated`, `Not Applicable`, `Conflicted`, `Insufficient Policy`, `Legal Review`, or `Review Required`.

Policy Evaluation preserves exact wording. It cannot infer unstated permission, extend an exception, or interpret ambiguous legal meaning.

## Rules

- **PEVAL-001:** Policy applicability must be established before eligibility effect.
- **PEVAL-002:** Every finding must cite exact approved policy identity, version, Scope, and text anchor.
- **PEVAL-003:** Missing or ambiguous policy yields `INSUFFICIENT_POLICY`, `LEGAL_REVIEW`, or `REVIEW_REQUIRED`.
- **PEVAL-004:** Policy conflict must remain visible and cannot be averaged or silently resolved.
- **PEVAL-005:** Policy does not imply authority, permission, approval, or business value.
- **PEVAL-006:** Governance must not create, amend, waive, enforce, or execute policy.

## Enterprise Example

An internal-use policy applies to a restricted audience but says nothing about external disclosure. Governance may support internal eligibility and mark external use `INSUFFICIENT_POLICY`; it cannot infer permission.

## Boundaries

No executable policy engine, legal interpretation service, policy authoring, enforcement, or Runtime control is defined.
