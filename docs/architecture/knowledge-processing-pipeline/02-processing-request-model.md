# 02 — Processing Request Model

## Definition

The Processing Request Model defines the governed input boundary for one architecture-knowledge preparation concern.

## Components

| Component | Definition | Responsibilities | Lifecycle | Constraints |
|---|---|---|---|---|
| **Processing Case** | One temporary governance boundary around a Processing Request and its artifacts | Bind identity, Request, artifacts, findings, lineage, validation, and output | Opened → Qualified → Processed → Validated → Closed, Refused, or Escalated | Not a Runtime process, workflow instance, Query Session, or Reasoning Session |
| **Processing Request** | Formal statement of what architecture knowledge must be prepared and why | Preserve objective, scope, constraints, authority context, acceptance criteria, and provenance | Proposed → Qualified, Clarification Required, Refused, or Accepted → Closed | Not a command, execution request, Query answer, or reasoning objective |
| **Processing Objective** | Exact preparation outcome sought | Define the required knowledge basis and output completeness | Declared → Resolved or Unresolved → Preserved | Must not embed a desired conclusion or approval |
| **Processing Scope** | Enterprise, domain, concept, relationship, document, version, lifecycle, time, and evidence boundary | Determine eligibility and applicable meaning | Proposed → Resolved, Partial, or Unresolved → Preserved | Cannot expand silently |
| **Processing Constraints** | Explicit obligations and prohibitions applied to preparation | Preserve evidence, authority, sensitivity, inclusion, exclusion, lifecycle, and output conditions | Collected → Validated → Applied → Reported | Cannot override canonical rules |
| **Authority Context** | Applicable source authority and decision-right evidence | Qualify normative force and identify unresolved authority | Assembled → Resolved, Conflicted, or Insufficient → Preserved | Describes authority; does not create it |
| **Acceptance Criteria** | Conditions a Processing Output Package must satisfy for its declared use | Define required artifacts, lineage, validation, coverage, and permitted incompleteness | Declared → Validated → Met, Partially Met, or Not Met | Cannot declare reasoning correctness or approval |

## Request Qualification

A Request is accepted only when:

- its identity and source are traceable;
- objective and intended use are explicit;
- scope is sufficiently resolved;
- applicable authority can be evaluated;
- constraints do not violate canonical architecture;
- acceptance criteria are testable at architecture level;
- the request does not require Phase 14–16 behavior.

## Multi-scope Requests

A Request spanning multiple scopes must preserve each scope's authority, lifecycle, version, and evidence independently. Shared vocabulary does not merge scopes.

## Safe Outcomes

Qualification produces one of:

- Accepted;
- Accepted with explicit scope limitations;
- Clarification Required;
- Insufficient Authority Context;
- Out of Phase Scope;
- Refused;
- Director Review Required.

## Required Distinctions

- Processing Case ≠ Runtime Instance
- Processing Request ≠ Query
- Processing Request ≠ Execution Request
- Processing Objective ≠ Desired Conclusion
- Authority Context ≠ Authority
- Acceptance Criteria ≠ Approval Criteria

## Boundaries

This model defines no request transport, endpoint, queue, persistence, session implementation, or processing algorithm.

