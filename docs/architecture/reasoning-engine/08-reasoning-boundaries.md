# 08 — Reasoning Boundaries

## Purpose

The Reasoning Boundary keeps structured analysis separate from every architecture responsibility that could supply new evidence, interpret a user request, exercise authority, or cause action.

## Boundary Matrix

| Adjacent Architecture | Reasoning May | Reasoning Must Not |
|---|---|---|
| Knowledge Processing | consume one eligible package and preserve its contracts | ingest, retrieve, normalize, enrich, correlate, correct, repackage, or write back |
| Query Intelligence | later expose a structured output under a separately approved contract | interpret queries, route requests, generate user answers, or design Phase 15 |
| Governance | identify a boundary or authority condition as Review Required | recommend, approve, authorize, waive, decide, or change policy |
| Canonical Architecture | cite and test explicit rules and relationships | create, modify, reinterpret silently, supersede, or canonize |
| Decision | present structured findings, alternatives, and uncertainty | select an alternative or predict, simulate, or make a decision |
| Execution | identify architecture implications without action semantics | initiate, schedule, delegate, coordinate, stop, or authorize action |
| Agent Runtime | remain independent of any agent or model realization | invoke agents, call tools, retain agent memory, or control Runtime |
| Evidence | read immutable references and report sufficiency | edit, add, fabricate, delete, reclassify, or alter provenance |

## Prohibited Outputs

Reasoning must not produce:

- recommendations or preferred choices;
- approvals, authorizations, exceptions, permissions, or decisions;
- execution instructions, tasks, plans, workflows, or tool calls;
- new canonical facts, policies, rules, capabilities, or architecture changes;
- rewritten Processing Artifacts or evidence;
- hidden conclusions that omit assumptions, contradictions, or missing evidence.

## Refusal and Review

Reasoning produces an `Insufficient`, `Conflicted`, `Rejected`, or `Review Required` status when the Objective cannot be addressed safely. `Review Required` identifies the exact unresolved authority question and supporting evidence. It is not a recommendation that any outcome be selected.

## Rules

- **RBOUND-001:** Reasoning must remain separate from processing, Query, governance, decision, execution, and Agent Runtime.
- **RBOUND-002:** Reasoning must never modify evidence, Processing Artifacts, canonical architecture, Context, or Runtime state.
- **RBOUND-003:** Reasoning must not recommend, approve, authorize, decide, or execute.
- **RBOUND-004:** Reasoning must not invoke agents, models, tools, services, or external systems.
- **RBOUND-005:** Scope or authority insufficiency must yield qualification, refusal, conflict, or Review Required.
- **RBOUND-006:** A high-confidence finding must not bypass any boundary.
- **RBOUND-007:** Runtime observations cannot redefine canonical architecture or enter outside the Phase 13 package.
- **RBOUND-008:** Future phases must not be designed through implied output fields or responsibilities.

## Enterprise Example

Reasoning may show that available evidence supports two incompatible interpretations and identify the authority question requiring review. It cannot rank the interpretations as a recommendation, approve either one, change the source, or initiate remediation.

## Boundaries

These prohibitions are foundational invariants. A future implementation limitation cannot waive them.
