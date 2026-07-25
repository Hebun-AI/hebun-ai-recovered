# 01 — Strategic Research Intelligence

**Priority:** High
**Status:** Planned

## Purpose

An enterprise research agent that gathers and synthesizes external and internal intelligence about a target organization and its environment.

Intelligence domains:

- Company Intelligence
- Market Intelligence
- Competitor Intelligence
- Technology Intelligence
- Regulatory Intelligence
- Risk Intelligence
- Opportunity Intelligence

## Possible tools

- Perplexity API
- Web Search
- Official Registries
- Company Websites
- Internal Knowledge

## Produces

- Executive Brief
- AI Maturity assessment
- Organizational Analysis
- Transformation Recommendations

## Architectural notes

Research is a capability the Director consumes, not one it embeds. External sources sit behind the AI Provider Manager and dedicated tool adapters — the research agent never calls a vendor SDK directly.

Output is declarative intelligence, fed into the organizational graph and downstream consultants. It produces analysis; it does not act.

## Dependencies

- [02 — AI Provider Manager](02-ai-provider-manager.md) — model and search access
- Organizational Intelligence canonical contracts — where findings land
- Internal knowledge layer — provenance of internal sources

## Promotion criteria

- Provider Manager in place so no source is called directly.
- Canonical contracts able to hold research output as inert, provenance-tagged data.
- Explicit boundary: research writes intelligence, never executes.
- Director approval.
