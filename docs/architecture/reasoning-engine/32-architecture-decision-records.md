# 32 — Architecture Decision Records

## Purpose

These Architecture Decision Records preserve the major Phase 14 decisions and consequences.

## ADR-14-001 — Processing Output Package Is the Sole Input

**Decision:** No raw source, query, conversation, observation, or tool result enters reasoning directly.  
**Consequence:** Admission always binds an immutable Phase 13 package version.

## ADR-14-002 — Evidence Is Immutable

**Decision:** Reasoning reads references and never edits evidence or Processing Artifacts.  
**Consequence:** Corrections require upstream processing and new versions.

## ADR-14-003 — Every Result Is Traceable

**Decision:** Every material Result maps through reconstructable Units to evidence and explicit Assumptions.  
**Consequence:** Broken paths block release.

## ADR-14-004 — Confidence Is Not Truth

**Decision:** Confidence is dimensional support qualification.  
**Consequence:** It cannot override conflicts, boundaries, authority, or missing evidence.

## ADR-14-005 — Contradictions Remain Visible

**Decision:** Analytical resolution never deletes original conflict evidence.  
**Consequence:** Unresolved conflicts propagate to affected Results.

## ADR-14-006 — Reasoning Modes Remain Distinct

**Decision:** Deductive, inductive, abductive, analogical, causal, temporal, and constraint semantics are explicitly typed.  
**Consequence:** One mode cannot inherit certainty from another silently.

## ADR-14-007 — Hybrid Reasoning Preserves Uncertainty

**Decision:** Deterministic Units cannot erase upstream uncertainty-bearing dependencies.  
**Consequence:** Final status remains bounded by critical inputs.

## ADR-14-008 — Explainability Is a Release Condition

**Decision:** Material inference must be independently understandable from canonical explanation records.  
**Consequence:** Hidden prompts or transcripts cannot substitute for explanation.

## ADR-14-009 — Tenant Isolation Is Mandatory

**Decision:** Case, Evidence Graph, Trace, and Output remain bound to one Tenant.  
**Consequence:** Cross-Tenant evidence causes rejection or quarantine.

## ADR-14-010 — Reasoning Produces No Recommendation or Decision

**Decision:** Output contains structured findings, alternatives, conflicts, uncertainty, and review questions only.  
**Consequence:** No preferred action, approval, authorization, or execution instruction is permitted.

## ADR-14-011 — Reasoning Is Runtime-Independent

**Decision:** States, lifecycle, graphs, traces, and chains are semantic contracts.  
**Consequence:** No agent, model, tool, workflow, or infrastructure is implied.

## Rules

- **RADR-001:** Every Phase 14 design must conform to ADR-14-001 through ADR-14-011.
- **RADR-002:** An ADR conflict requires an Architecture Gate.
- **RADR-003:** ADR supersession requires explicit Director-approved architecture change and impact analysis.
