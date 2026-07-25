# 03 — Transformation Consultant

**Priority:** High
**Status:** Planned

## Purpose

A pre-sales organizational consulting AI. It turns research and organizational data into a consulting deliverable a prospect can act on.

## Produces

- Organizational Assessment
- AI Roadmap
- ROI Estimate
- Department Recommendations

## Architectural notes

The Consultant is a reasoning layer over intelligence already gathered. It consumes Strategic Research Intelligence output and the organizational graph; it does not gather raw data itself.

It reasons and recommends. It does not implement, deploy, or commit the organization to anything. Its output is advisory.

Sits pre-sales: the audience is a prospect, not an operating tenant. Escalation and hand-off to sales is part of its flow, not an afterthought.

## Dependencies

- [01 — Strategic Research Intelligence](01-strategic-research-intelligence.md) — input intelligence
- [02 — AI Provider Manager](02-ai-provider-manager.md) — model access
- [05 — Department Recommendation Engine](05-department-recommendation-engine.md) — department prioritization it can call
- Organizational Intelligence canonical contracts — organizational input

## Promotion criteria

- Research Intelligence producing usable input.
- Clear boundary: recommends only, never executes.
- ROI and assessment outputs defined as declarative artifacts.
- Director approval.
