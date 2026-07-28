# 32 — Governance Architecture Decisions

## Purpose

These Architecture Decision Records preserve Phase 16's major canonical decisions.

## ADR-16-001 — Governance Evaluates Eligibility, Not Correctness

**Decision:** Reasoning validity remains Phase 14 responsibility.  
**Consequence:** Governance never repairs or re-performs reasoning.

## ADR-16-002 — Reasoning Output Is Immutable

**Decision:** One exact package version is the review subject.  
**Consequence:** Re-evaluation creates new governance artifacts.

## ADR-16-003 — Policy Does Not Imply Authority

**Decision:** Policy applicability and authority applicability remain separate.  
**Consequence:** Policy cannot create a decision right.

## ADR-16-004 — Authority Does Not Imply Permission

**Decision:** Permission requires its own canonical evidence.  
**Consequence:** Authority resolution never grants access or use.

## ADR-16-005 — Permission Does Not Imply Approval

**Decision:** Approval requirements remain separate and reserved.  
**Consequence:** Permission cannot produce `ALLOW` where approval is required.

## ADR-16-006 — Approval Does Not Imply Execution

**Decision:** Execution remains outside Governance Intelligence.  
**Consequence:** No Outcome triggers action.

## ADR-16-007 — Compliance Does Not Imply Business Value

**Decision:** Governance does not assess desirability or benefit.  
**Consequence:** Compliant uses are not recommendations.

## ADR-16-008 — Canonical Outcome Vocabulary Is Closed

**Decision:** Phase 16 uses the ten named Outcome States.  
**Consequence:** Implementations cannot invent permissive aliases.

## ADR-16-009 — Redaction Is an External Condition

**Decision:** Governance describes but never performs redaction.  
**Consequence:** `ALLOW_WITH_REDACTION` is not release authorization.

## ADR-16-010 — Tenant Isolation Is Mandatory

**Decision:** All governance artifacts remain Tenant-bound.  
**Consequence:** Tenant mismatch fails closed.

## ADR-16-011 — Review Is Semantic, Not Workflow

**Decision:** Review states identify reserved boundaries only.  
**Consequence:** Governance does not notify, assign, or manage reviewers.

## Rules

- **GADR-001:** Every Phase 16 design must conform to ADR-16-001 through ADR-16-011.
- **GADR-002:** ADR conflict creates an Architecture Gate.
- **GADR-003:** ADR supersession requires explicit Director-approved change and impact analysis.
