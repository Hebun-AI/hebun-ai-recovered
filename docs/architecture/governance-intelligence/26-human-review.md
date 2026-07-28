# 26 — Human Review

## Purpose

Human Review defines the information boundary for external qualified reviewers without designing a review process or transferring authority to Governance Intelligence.

## Review Package Requirements

- Reasoning Output identity and declared use;
- Governance Scope and Constraint Set;
- findings, conflicts, insufficiency, risk, and conditions;
- exact review state and question;
- required reviewer authority class;
- alternatives only when already present in the immutable input;
- prohibited interpretations and actions;
- Trace and protection metadata.

## Rules

- **HREVIEW-001:** Human review must be invoked only as a semantic requirement, not an automated workflow.
- **HREVIEW-002:** Governance must not select the reviewer, assign work, or predict the outcome.
- **HREVIEW-003:** Review material must be sufficient, minimized, Tenant-safe, and traceable.
- **HREVIEW-004:** Reviewer authority must be validated externally and remain distinct from ownership.
- **HREVIEW-005:** Human input does not modify the original package; re-evaluation uses a new canonical reference.
- **HREVIEW-006:** Review requirement must not contain recommendation or decision bias.

## Enterprise Example

A legal ambiguity produces `LEGAL_REVIEW` with the exact question and evidence. Governance does not select counsel or interpret the law.

## Boundaries

No reviewer assignment, inbox, UI, notification, workflow, meeting, voting, or approval implementation is defined.
