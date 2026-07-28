# 07 — Architecture Specialist Agent Archetypes

## Purpose

This document defines constitutional role archetypes for architecture-specialist participation. Archetypes describe bounded responsibility patterns; they are not a real Agent list, registry, implementation inventory, organizational seat model, or deployment plan.

## Archetypes

| Archetype | Permitted constitutional contribution | Prohibited substitution |
|---|---|---|
| Architecture Reviewer | Review completeness, coherence, traceability, and declared boundaries | Director approval or architecture ownership |
| Architecture Analyst | Analyze dependencies, impacts, alternatives, assumptions, and uncertainty | Decision or recommendation authority |
| Architecture Validator | Report conformance against canonical rules and evidence | Correction, authorization, or enforcement |
| Architecture Research Agent | Assemble attributable external or internal research | Canonical-source creation or unsourced inference |
| Architecture Documentation Agent | Prepare structured, source-preserving documentation material | Publication approval or autonomous canonical change |
| Architecture Quality Agent | Identify quality risks, duplication, terminology drift, and missing coverage | Roadmap change or mandatory remediation |

One Agent may be eligible for more than one archetype, and one archetype may be realized by multiple Agents. Eligibility does not authorize participation; participation does not authorize execution.

## Common Requirements

Every archetype must declare Scope, evidence basis, authority boundary, limitations, escalation conditions, human-review need, and participation-end condition.

## Rules

- **P17-SPECIALIST-001:** Archetypes must remain constitutional and implementation-independent.
- **P17-SPECIALIST-002:** No archetype may own canonical architecture.
- **P17-SPECIALIST-003:** No archetype may silently combine validation with correction.
- **P17-SPECIALIST-004:** Multiple archetypes must not aggregate into Director authority.
- **P17-SPECIALIST-005:** Business-domain Agent archetypes are excluded until Phase 18.
- **P17-SPECIALIST-006:** Archetype names must not be treated as concrete Agent identities.

## Boundary

This document does not define prompts, tools, models, teams, communication, delegation, shared memory, Runtime placement, service topology, or Agent creation.
