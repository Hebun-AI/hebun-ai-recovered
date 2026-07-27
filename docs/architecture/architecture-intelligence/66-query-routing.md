# 66 — Architecture Query Routing

## Definition

**Query Routing** is the governed selection of the appropriate logical analytical destination for a qualified Query. Routing occurs only after intent, scope, authority, constraints, and minimum evidence requirements are resolved.

Routing is a semantic governance decision within the Query architecture. It is not Runtime dispatch, workload scheduling, orchestration, network routing, or execution.

## Routing Inputs

| Criterion | Routing Question | Required Protection |
|---|---|---|
| **Authority** | Which sources govern, and does the requested outcome require reserved Director judgment? | Low-authority evidence cannot be routed as canonical interpretation; authority conflict requires escalation |
| **Evidence** | Is direct evidence sufficient, or is bounded reasoning needed? | Missing or untraceable evidence yields clarification, insufficiency, or refusal rather than invention |
| **Scope** | Is the enterprise, domain, identity, version, lifecycle, time, and question boundary resolved? | Material ambiguity prevents conclusive routing |
| **Priority** | What governance importance or review urgency has the Director declared? | Priority cannot bypass evidence, validation, boundaries, or authority |
| **Governance** | Is validation, conflict review, approval support, exception, or escalation required? | Reserved decisions route to Director review, never autonomous resolution |
| **Confidence** | What level of support is required, and do known limitations constrain the expected response? | Confidence cannot determine authority or convert uncertainty into routing permission |
| **Context** | Which Canonical, Derived, Runtime, Historical, Conversation, and Authority Context is relevant? | Context classes remain isolated and provenance-preserving |

## Logical Routing Targets

- **Direct Evidence Response** — for bounded Information intent supported without material inference.
- **Architecture Reasoning Engine** — for explanation, implication, dependency, impact, hypothesis, or evidence synthesis.
- **Reasoning Validation** — when a claim or proposal requires explicit conformance assessment.
- **Conflict Review** — when incompatible evidence, authority, terminology, relationships, or observations are material.
- **Governance Review** — when policy, authority, boundary, exception, or approval conditions must be explained.
- **Director Escalation** — when normative judgment, approval, authority assignment, conflict resolution, or architecture change is required.
- **Clarification Required** — when intent, scope, constraints, or required outcome is materially ambiguous.
- **Insufficient Evidence** — when the required analytical basis cannot be established.
- **Out of Scope** — when the request is not an architecture-intelligence responsibility.

These targets are logical responsibilities and outcomes, not services, queues, agents, endpoints, or deployments.

## Routing Decision Contract

Every routing decision must preserve:

- Query identity and original meaning;
- resolved Intent or unresolved condition;
- Query Scope and Constraints;
- applicable authority;
- selected and missing evidence;
- relevant Context classes;
- chosen target and rationale;
- known confidence limitations;
- governance requirements;
- prohibited interpretations;
- escalation conditions.

## Preventing Misrouting

Misrouting is prevented through mandatory controls:

1. preserve the original Query before classification;
2. require explicit Intent resolution;
3. resolve Scope and Authority before evidence-based routing;
4. distinguish direct information from reasoning;
5. separate governance questions from analytical questions;
6. reject priority as a substitute for authority;
7. prevent Runtime Context from routing as canonical truth;
8. retain multi-intent obligations independently;
9. validate target compatibility with Query Constraints;
10. require rationale and provenance for every route;
11. prefer clarification or escalation over an unsupported target;
12. prevent a Reasoning Request from containing execution semantics.

## Rerouting

Rerouting is allowed only when new qualified evidence, clarified intent, corrected scope, changed applicable lifecycle/version, or an explicit governance finding materially changes the routing basis. The original and revised rationale must remain traceable.

Failure at a target does not authorize silent rerouting to a less governed path.

## Enterprise Example

A high-priority Query asks whether an observed Runtime practice is permitted. Authority and Context criteria identify the observation as non-canonical and the approved rule as governing. The Query routes to Validation Request and Governance Review, with Director escalation if an exception is sought. High priority does not allow direct approval.

## Boundaries

This architecture defines no dispatch logic, routing algorithm, technical endpoint, queue, workflow, interface, model router, Runtime service, or execution behavior.

