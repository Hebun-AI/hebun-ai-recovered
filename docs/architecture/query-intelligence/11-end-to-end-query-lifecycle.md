# 11 — End-to-End Query Lifecycle

## Purpose

This document defines the complete semantic lifecycle from receipt of a user or system Query to a ready Reasoning Request Package or a safe non-package outcome.

## Lifecycle

| Stage | Entry | Exit | Invariant |
|---|---|---|---|
| Receipt | attributable Query | registered Query identity | receipt grants no trust |
| Admission | registered Query | admitted, rejected, or quarantined | untrusted content remains data |
| Preservation | admitted Query | immutable original representation | normalization never replaces original |
| Classification | preserved Query | candidate Intent and domain classes | classification is not reasoning |
| Disambiguation | candidates and Context | resolved, multi-intent, ambiguous, or out-of-scope Intent | ambiguity remains visible |
| Decomposition | qualified multi-intent Query | traceable Query Parts | no new question is invented |
| Objective Refinement | resolved Intent | non-leading Objective | Objective is not decision |
| Scope and Domain Resolution | Objective and references | bounded Scope and domain | no silent expansion |
| Context Qualification | bounded Scope | minimum qualified Context references | Context is not evidence |
| Constraint Extraction | Query and canonical references | explicit qualification constraints | no policy interpretation |
| Missing Information Analysis | qualification record | gaps and materiality classified | gaps are not fabricated |
| Qualification Planning | complete obligations | logical qualification plan | plan is not workflow |
| Package Assurance | qualified components and Phase 13 package reference | ready, limited, clarification, rejected, or out-of-scope outcome | package contains no reasoning |
| Closure | terminal outcome | retained Query Trace | closure answers nothing |

## Forbidden Transitions

- Rejected or quarantined Query → Objective refinement.
- Ambiguous material Intent → Ready Package.
- Unsupported decision or recommendation request → reasoning Objective.
- Missing Context → silently inferred Context.
- Query statement → evidence.
- Request Package → answer, recommendation, decision, governance, or execution.

## Rules

- **QLIFE-001:** Every Query Case must follow the lifecycle or record a justified non-applicable stage.
- **QLIFE-002:** Every stage must validate entry and exit conditions.
- **QLIFE-003:** Original meaning, ambiguity, missing information, and rejected semantics must propagate.
- **QLIFE-004:** Material change requires affected-stage requalification and a new package version.
- **QLIFE-005:** Completion means a package or safe non-package outcome was produced, not that the Query was answered.
- **QLIFE-006:** Lifecycle semantics must remain independent of Runtime execution.

## Boundaries

No queue, service, task, agent, tool, workflow, retry engine, or dispatch sequence is defined.
