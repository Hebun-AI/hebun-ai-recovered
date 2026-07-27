# 07 — Failure and Escalation Semantics

## Definition

A **Processing Failure** is a condition that prevents a stage, artifact, handoff, or Processing Output Package from satisfying an applicable contract. Failure semantics define what must be surfaced and when processing must stop, qualify, refuse, or escalate.

## Failure Classes

| Class | Meaning | Permitted Outcome |
|---|---|---|
| **Request Failure** | Objective, scope, constraints, source, or acceptance criteria are materially unresolved | Clarification, refusal, or Director review |
| **Authority Failure** | Applicable authority is missing, stale, incompatible, or unresolvable | Stop normative preparation and escalate |
| **Evidence Failure** | Required evidence is missing, inaccessible, untraceable, or invalid | Insufficient Evidence or partial output when safe |
| **Normalization Failure** | Meaning or material variance cannot be preserved confidently | Preserve originals, mark Ambiguous or Conflicted |
| **Context Failure** | Context classification or isolation cannot be maintained | Withhold affected package |
| **Integrity Failure** | Artifact, lineage, handoff, conflict, confidence, or output invariant fails | Reject affected artifact or output |
| **Boundary Failure** | Processing crosses into mutation, reasoning, governance, Runtime, or authority | Stop and escalate |
| **Unknown Failure** | Material failure exists but cannot be safely classified | Stop affected preparation and request review |

## Continuation Boundary

Processing may continue after a non-material failure only when:

- the affected scope is separable;
- the failure remains attached to every downstream artifact;
- acceptance criteria allow partial preparation;
- no authority, provenance, canonical, tenant, or boundary invariant is compromised;
- downstream use cannot imply completeness.

## Failure Record

Every failure records:

- class and affected stage;
- Request, artifact, and handoff identities;
- observed condition and expected contract;
- evidence and provenance;
- affected scope;
- severity and uncertainty;
- continuation status;
- accountable owner;
- permitted next outcome;
- escalation need.

## Escalation Conditions

Escalation is required for:

- unresolved normative authority;
- canonical or material policy conflict;
- requested scope expansion;
- acceptance of a critical limitation;
- canonical change or correction request;
- cross-boundary violation;
- decision about whether incomplete evidence is acceptable;
- any reserved Director judgment.

## Safe Failure Outcomes

- Clarification Required;
- Valid with Limitations;
- Partially Valid;
- Insufficient Evidence;
- Conflicted;
- Invalid;
- Out of Phase Scope;
- Director Review Required.

Failure never defaults to success.

## Retry and Repair Boundary

Phase 13 defines no retry, correction, repair, compensation, or operational recovery behavior. A revised Processing Request or corrected upstream source begins a newly traceable evaluation basis; it does not silently overwrite the failed record.

## Required Distinctions

- Failure ≠ Permission to Infer
- Escalation ≠ Decision
- Partial Output ≠ Complete Output
- Revised Input ≠ Silent Retry
- Finding ≠ Repair
- Processing Recovery ≠ Runtime Recovery

## Boundaries

No workflow, retry logic, incident response, queue, scheduler, notification, or automatic remediation is defined.

