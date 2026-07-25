# 17 — Cost Intelligence

**Priority:** Medium
**Status:** Planned

## Purpose

AI cost analysis. Attribute and understand the platform's spend so cost is a first-class, queryable dimension rather than an end-of-month surprise.

## Tracks

- Model usage
- Tool costs
- Department costs
- Customer costs
- ROI

## Architectural notes

A read-and-aggregate layer over usage signals. It attributes model and tool spend to departments and customers, then rolls it into ROI. It measures; it does not enforce — spending limits belong to the Policy Engine.

Cost records are derived, declarative facts sourced from provider and tool usage. Cost Intelligence reads observability and provider signals; it feeds simulation and the executive brief. It never gates an action itself.

## Dependencies

- [02 — AI Provider Manager](02-ai-provider-manager.md) — model usage and pricing signals
- [12 — Tool Registry](12-tool-registry.md) — tool usage signals
- [18 — Observability Center](18-observability-center.md) — token/usage telemetry
- Feeds [16 — Organizational Simulation](16-organizational-simulation.md) and [04 — Executive Brief Generator](04-executive-brief-generator.md)

## Promotion criteria

- Usage signals available from providers and tools in structured form.
- Attribution model defined (department, customer, ROI).
- Boundary clear — measures cost, does not enforce limits.
- Director approval.
