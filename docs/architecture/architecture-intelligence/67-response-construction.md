# 67 — Architecture Query Response Construction

## Definition

**Response Construction** creates the governed, traceable presentation of a completed Query outcome. It preserves the Director's question, resolved boundaries, evidence, reasoning result, validation, confidence, conflicts, recommendations, and provenance without converting analysis into authority.

A Structured Response is an architecture-intelligence artifact for review. It is not a decision, approval, command, policy, canonical document, or execution instruction.

## Structured Response Model

| Component | Purpose | Required Content | Boundary |
|---|---|---|---|
| **Question** | Preserve what was asked | Original meaning, resolved intent, ambiguity or decomposition | Must not be rewritten to fit the answer |
| **Scope** | State where the response applies | Enterprise/domain boundaries, identities, versions, lifecycle, time, exclusions | Must not imply broader applicability |
| **Evidence** | Show the support basis | Source identities, relevant statements, authority, lifecycle, version, scope, and selection rationale | Evidence must remain distinct from conclusion |
| **Reasoning Summary** | Explain how the result follows | Objective, strategies, material premises, implications, assumptions, alternatives, validation outcome | Summary must remain traceable to the full Reasoning Trace |
| **Confidence** | Qualify support for each material finding | Dimension rationale, limiting conditions, uncertainty, and indeterminate elements | Must not claim truth, correctness, authority, or approval |
| **Conflicts** | Preserve incompatible or unresolved material | Type, severity, evidence, affected scope, escalation, and resolution authority | Must not silently resolve or suppress |
| **Recommendations** | Present bounded options for authorized review | Proposed consideration, supporting evidence, impacts, trade-offs, constraints, and required authority | Must not become approval, command, plan, or execution |
| **Director Notes** | Make reserved judgment explicit | Decision question, alternatives, unresolved matters, required authority, and review conditions | Must not predict or impersonate the Director |
| **Provenance** | Provide end-to-end auditability | Query identity, source paths, context classification, routing rationale, Reasoning Trace references, validation record | Must not omit inconvenient or conflicting evidence |

## Construction Principles

1. Lead with the bounded answer or non-answer outcome.
2. Preserve the Question and state any interpreted Intent.
3. State Scope before presenting conclusions.
4. Place canonical evidence and authority ahead of derived or Runtime observations.
5. Separate evidence, reasoning, confidence, and recommendation.
6. Report material conflict and insufficiency visibly.
7. Map each material conclusion to supporting evidence and Reasoning Trace.
8. State validation outcome and confidence per material finding.
9. Make Director-reserved decisions explicit.
10. Avoid language that implies execution, approval, or canonical change.

## Response Outcomes

A Structured Response may provide:

- a directly supported information answer;
- an architecture explanation;
- an impact or dependency finding;
- a validation outcome;
- a conflict review;
- a governance finding;
- bounded recommendations for Director review;
- Clarification Required;
- Insufficient Evidence;
- Out of Scope;
- Director Review Required.

The response must not force a positive conclusion when the governed outcome is uncertainty, conflict, insufficiency, or escalation.

## Required Distinctions

- **Response ≠ Decision**
- **Recommendation ≠ Approval**
- **Confidence ≠ Truth**
- **Reasoning Summary ≠ Reasoning Trace**
- **Director Notes ≠ Director Decision**
- **Evidence ≠ Conclusion**
- **Response ≠ Canonical Architecture**

## Enterprise Example

A response to a dependency-impact Query states the affected capability scope and versions, cites the authoritative dependency definitions, summarizes direct and transitive reasoning, reports incomplete evidence for one domain, assigns aligned confidence to each finding, records a relationship conflict, and asks the Director whether a governed change review should begin. It does not approve or initiate that change.

## Boundaries

This model defines response semantics only. It defines no interface, display, message format, endpoint, serialization, prompt, conversation behavior, persistence, notification, or execution action.

