# 12 — Tool Registry

**Priority:** High
**Status:** Planned

## Purpose

A central registry for every external integration. The authoritative record of which tools the platform can reach, what they do, and whether they are available.

## Example tools

- OpenAI
- Claude
- Perplexity
- Slack
- Gmail
- Calendar
- SAP
- Salesforce
- HubSpot

## Responsibilities

- Discovery
- Authentication metadata
- Capabilities
- Availability
- Health

## Architectural notes

A system-of-record for integrations. It holds *metadata* about tools — capabilities, availability, how to authenticate — not the credentials themselves and not the calling logic. Actual invocation flows through the AI Provider Manager and dedicated adapters.

The registry describes; adapters connect. Model providers appear here as tools, but every model call still routes through [02 — AI Provider Manager](02-ai-provider-manager.md); the registry never becomes a second, competing call path.

## Dependencies

- [02 — AI Provider Manager](02-ai-provider-manager.md) — model-provider invocation
- Adapter layer — non-model integrations
- Consumed by [10 — Knowledge Ingestion Engine](10-knowledge-ingestion-engine.md) and runtime

## Promotion criteria

- Authentication metadata boundary defined — metadata only, no secrets in the record.
- Discovery interface specified; registry is descriptive, non-invoking.
- Availability and health model defined.
- Director approval.
