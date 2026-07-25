# 18 — Observability Center

**Priority:** Medium
**Status:** Planned

## Purpose

Operational visibility. A single place to see the platform's live health — agents, runtime, tools, and their cost and latency.

## Monitors

- Agent health
- Runtime
- Errors
- Latency
- Tool availability
- Token usage
- Cost

## Architectural notes

A read-only aggregation and presentation layer over telemetry the platform already emits. It observes; it never intervenes. Remediation and gating are other systems' jobs.

Signals come from runtime observability, the registries, and the provider layer. The Center surfaces token usage and cost as observed telemetry and hands the same signals to [17 — Cost Intelligence](17-cost-intelligence.md) for attribution. It depends on emitters; no emitter depends on it.

## Dependencies

- Runtime observability — health, errors, latency signals
- [11 — Agent Registry](11-agent-registry.md) and [12 — Tool Registry](12-tool-registry.md) — agent and tool status
- [02 — AI Provider Manager](02-ai-provider-manager.md) — token usage signals

## Promotion criteria

- Telemetry emitters producing structured signals.
- Read-only boundary — observes, never intervenes.
- Signal taxonomy defined and shared with Cost Intelligence.
- Director approval.
