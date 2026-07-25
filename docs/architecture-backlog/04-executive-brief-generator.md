# 04 — Executive Brief Generator

**Priority:** Medium
**Status:** Planned

## Purpose

Daily executive summaries for the Director view. A recurring, condensed read of what changed and what needs attention.

## Sections

- Yesterday
- Risks
- Opportunities
- Finance
- Sales
- AI Alerts

## Architectural notes

The Brief Generator reads state; it does not create it. It aggregates signals already present in the platform — executions, alerts, KPIs, research — into a scheduled summary.

A presentation-and-synthesis layer, not a data source. If a fact is not already in the system, the brief does not invent it.

Scheduling and delivery sit outside the Director core. The Director produces the underlying state; the generator narrates it.

## Dependencies

- [02 — AI Provider Manager](02-ai-provider-manager.md) — summarization
- Organizational Intelligence + runtime observability — source signals
- [01 — Strategic Research Intelligence](01-strategic-research-intelligence.md) — external context for risks/opportunities

## Promotion criteria

- Source signals (finance, sales, alerts) available as structured reads.
- Boundary: read-only aggregation, no state mutation.
- Delivery channel decided (ties to Voice Layer channels where relevant).
- Director approval.
