# 05 — Department Recommendation Engine

**Priority:** Medium
**Status:** Planned

## Purpose

Determine which AI departments an organization should implement first. Sequencing, not just a list.

## Inputs

- Company profile
- Research
- Organizational graph
- KPIs

## Outputs

A prioritized AI implementation roadmap.

## Architectural notes

A scoring and sequencing layer. It reads the organizational graph and research signals, weighs them against KPIs, and returns an ordered plan.

Deterministic where it can be, model-assisted where judgment is needed. Output is a recommendation artifact — inert, explainable, and consumable by the Transformation Consultant.

It recommends order. It does not stand up departments or trigger implementation.

## Dependencies

- [01 — Strategic Research Intelligence](01-strategic-research-intelligence.md) — research input
- [02 — AI Provider Manager](02-ai-provider-manager.md) — model-assisted scoring
- Organizational Intelligence canonical contracts — graph and profile input
- Consumed by [03 — Transformation Consultant](03-transformation-consultant.md)

## Promotion criteria

- Organizational graph stable enough to score against.
- KPI inputs available in structured form.
- Output defined as a declarative prioritized roadmap.
- Director approval.
