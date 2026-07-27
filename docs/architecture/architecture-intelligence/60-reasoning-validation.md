# 60 — Reasoning Validation

## Definition

**Reasoning Validation** is the read-only examination of whether a Reasoning Result is adequately supported, authority-compliant, logically coherent, boundary-safe, provenance-complete, and aligned with its confidence assessment.

Validation qualifies the result for a Structured Response. It does not approve the result, canonize it, correct source material, or authorize execution.

## Validation Controls

| Control | Validation Question | Pass Condition | Failure Effect |
|---|---|---|---|
| **Evidence Sufficiency** | Does every material premise and conclusion have adequate qualified evidence? | Evidence directly supports the claim within resolved scope; gaps are non-material or explicit | Partially Valid, Insufficient Evidence, Conflicted, or Director Review Required |
| **Authority Compliance** | Does reasoning preserve source authority and avoid unauthorized normative claims? | Canonical precedence and decision rights are explicit; non-canonical evidence remains subordinate | Result is invalid for release or requires Director review |
| **Logical Consistency** | Do premises, Units, transformations, and Result form a coherent and non-contradictory chain? | The Trace supports the Result and material counterevidence is addressed | Partially Valid, Conflicted, or Insufficient Evidence |
| **Boundary Compliance** | Does reasoning remain within scope and avoid mutation, approval, policy, execution, and Director authority? | Scope and prohibited actions are respected throughout | Result is rejected or escalated; boundary breach is never normalized |
| **Provenance Completeness** | Can every material claim be traced to its source and transformation? | Source identity, version, lifecycle, scope, authority, evidence, and relevant Unit are retained | Insufficient Evidence or Director Review Required |
| **Confidence Alignment** | Does the confidence qualification accurately reflect support, conflict, coverage, authority, and uncertainty? | No material weakness is hidden or averaged away | Confidence must be lowered or marked indeterminate through a visible validation finding |

## Validation Outcomes

### Valid

All applicable controls pass. The Result may be included in a Structured Response with its evidence, trace, confidence, and limitations. Valid does not mean approved or canonical.

### Partially Valid

One or more separable parts are supported while other parts are limited. Supported and unsupported portions must be distinguished. The outcome must not be summarized as fully valid.

### Insufficient Evidence

Required support, provenance, scope, relationship semantics, or coverage is missing. The system states what is missing and refrains from a conclusive claim.

### Conflicted

Material evidence, authority, terminology, relationships, or canonical statements are incompatible. The conflict and alternatives remain visible and are escalated when normative resolution is required.

### Director Review Required

The Result requires authority assignment, exception, approval, normative interpretation, conflict resolution, canonical change, or another reserved Director judgment.

## Validation Procedure

1. bind validation to one Result and its resolved Scope;
2. inspect every material Reasoning Unit and premise;
3. apply all six controls;
4. record control-specific findings and evidence;
5. assign one applicable outcome;
6. verify confidence alignment;
7. identify mandatory escalation and the precise decision question;
8. preserve the validation record with the Structured Response.

This is a logical validation dependency, not a Runtime execution procedure or workflow.

## Critical Distinctions

- **Validation ≠ Approval** — validation assesses conformance; approval is a governance act.
- **Reasoning Quality ≠ Truth** — a coherent, well-supported analysis can remain incomplete or mistaken.
- **Valid ≠ Canonical** — a valid Result remains derived intelligence.
- **Validation Finding ≠ Correction** — findings expose defects and limits without mutating sources.
- **Director Review Required ≠ Director Decision** — escalation requests judgment but does not anticipate it.

## Enterprise Example

An impact analysis is logically consistent and uses authoritative dependency definitions, but one affected domain lacks current evidence. Validation marks the supported domain findings Valid and the cross-domain conclusion Partially Valid or Insufficient Evidence. It cannot infer coverage from confidence or approve the proposed change.

## Boundaries

This model defines no automated test implementation, scoring threshold, approval workflow, corrective mutation, model evaluation framework, or Runtime gate. It governs architecture-reasoning validation only.

