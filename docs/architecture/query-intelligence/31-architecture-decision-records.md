# 31 — Architecture Decision Records

## Purpose

These Architecture Decision Records preserve the major Phase 15 qualification decisions and consequences.

## ADR-15-001 — Query Intelligence Does Not Answer

**Decision:** Query Intelligence produces a Request Package or safe qualification outcome only.  
**Consequence:** Answers remain outside Phase 15 qualification.

## ADR-15-002 — Query Intelligence Does Not Reason

**Decision:** Classification, refinement, and qualification cannot produce analytical findings.  
**Consequence:** All substantive reasoning remains in Phase 14.

## ADR-15-003 — Original Query Is Recoverable

**Decision:** Normalization and decomposition never replace the original Query.  
**Consequence:** Every transformation remains reconstructable.

## ADR-15-004 — Intent and Objective Are Distinct

**Decision:** Intent classifies purpose; Objective expresses a neutral analytical question.  
**Consequence:** An Intent cannot silently become a conclusion.

## ADR-15-005 — Context Is Not Evidence

**Decision:** Context frames qualification but supplies no substantive premise.  
**Consequence:** Reasoning evidence comes only from the Phase 13 package.

## ADR-15-006 — Ambiguity and Missing Information Stay Visible

**Decision:** Material gaps cannot be guessed away.  
**Consequence:** Clarification and limited outcomes are first-class.

## ADR-15-007 — Request Package Is Non-Evidentiary

**Decision:** The package binds qualification semantics to one eligible Processing Output Package.  
**Consequence:** It cannot add evidence, reasoning, confidence, or conclusions.

## ADR-15-008 — Query Planning Is Non-Executable

**Decision:** Planning expresses qualification dependencies only.  
**Consequence:** It contains no workflow, tool, agent, retrieval, or Runtime work.

## ADR-15-009 — Tenant Isolation Is Mandatory

**Decision:** Query, Context, Trace, and package remain Tenant-bound.  
**Consequence:** Tenant mismatch fails closed.

## ADR-15-010 — Unsupported Outcomes Are Preserved and Rejected

**Decision:** Recommendation, decision, governance, and execution semantics remain visible but cannot enter an Objective.  
**Consequence:** Qualification never transfers authority.

## ADR-15-011 — Explainability and Traceability Are Readiness Conditions

**Decision:** Every material qualification step must be explainable and reconstructable.  
**Consequence:** Broken Trace blocks package readiness.

## Rules

- **QADR-001:** Every Phase 15 design must conform to ADR-15-001 through ADR-15-011.
- **QADR-002:** ADR conflict creates an Architecture Gate.
- **QADR-003:** ADR supersession requires explicit Director-approved change and impact analysis.
