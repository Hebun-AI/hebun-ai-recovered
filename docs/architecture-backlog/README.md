# Architecture Backlog

Strategic capabilities that have been architecturally identified but intentionally postponed.

## Capability lifecycle

Every capability in this backlog is governed by the [Capability Lifecycle](00-capability-lifecycle.md). That document defines the mandatory path from idea to production — its stages, entry and exit criteria, and the Director gates along the way. The backlog names *what* a capability is; the lifecycle defines *how* it is built and released. Read it before promoting any item.

## Index

Process document, read first:

- [00 Capability Lifecycle](00-capability-lifecycle.md)

Capabilities are grouped by architectural layer. A capability may depend on items in the same or a lower layer; it must never be depended upon in reverse by the Director core.

### Foundation

Platform plumbing, governance, and systems-of-record. Everything else builds on this layer.

- [02 AI Provider Manager](02-ai-provider-manager.md)
- [09 Director Memory](09-director-memory.md)
- [10 Knowledge Ingestion Engine](10-knowledge-ingestion-engine.md)
- [11 Agent Registry](11-agent-registry.md)
- [12 Tool Registry](12-tool-registry.md)
- [13 Policy Engine](13-policy-engine.md)
- [14 Permission Engine](14-permission-engine.md)
- [18 Observability Center](18-observability-center.md)

### Intelligence

Reasoning, analysis, and learning over organizational data.

- [01 Strategic Research Intelligence](01-strategic-research-intelligence.md)
- [03 Transformation Consultant](03-transformation-consultant.md)
- [05 Department Recommendation Engine](05-department-recommendation-engine.md)
- [08 AI Transformation Playbook Engine](08-ai-transformation-playbook-engine.md)
- [16 Organizational Simulation](16-organizational-simulation.md)
- [17 Cost Intelligence](17-cost-intelligence.md)
- [19 Learning Engine](19-learning-engine.md)

### Experience

User-facing surfaces and authoring tools. Presentation depends on the layers below; never the reverse.

- [04 Executive Brief Generator](04-executive-brief-generator.md)
- [06 Hebun Guide](06-hebun-guide.md)
- [07 Voice Layer](07-voice-layer.md)
- [15 Workflow Designer](15-workflow-designer.md)
- [20 Marketplace](20-marketplace.md)
- [21 Enterprise System Map (Digital Twin)](21-enterprise-system-map.md)

## What this is

Future platform capabilities for Hebun AI. Each has a place in the architecture. None is being built yet.

These are **not** bugs. **Not** TODO items. **Not** technical debt.

They are deliberate deferrals — capabilities the platform will need, sequenced behind the current foundation work.

## Roadmap vs backlog

| | Roadmap | Backlog |
|---|---|---|
| Horizon | Committed, dated | Identified, undated |
| Commitment | Being built now or next | Deferred until promoted |
| Detail | Implementation-level | Capability-level |
| Changes | Rarely | Freely, until promoted |

The roadmap says *what we are building*. The backlog says *what we know we will need*.

An item lives here until the roadmap pulls it forward.

## Implemented vs planned

- **Implemented** — code exists, tested, on `main`. Lives in the codebase, not here.
- **Planned** — described here only. No code. No contracts. No runtime footprint.

Every item in this folder is `Status: Planned` by definition. When an item ships, its document moves out of the backlog into the relevant architecture docs, and the entry here is retired.

## Promotion rules

An item moves from backlog to implementation only when all hold:

1. **Foundation ready** — its dependencies (canonical contracts, provider layer, organizational graph) exist and are stable.
2. **Roadmap slot** — it is placed on the roadmap with a target phase.
3. **Scope written** — a concrete implementation scope replaces the capability-level description.
4. **Boundaries defined** — its dependency edges are explicit and one-directional (no reverse dependency into the Director core).
5. **Director approval** — see below.

## Director approval is mandatory

No backlog item begins implementation without explicit Director approval.

Presence in this folder is **not** authorization. It is documentation of intent. The gate to build is a separate, explicit decision by the Director, taken per item, at the moment implementation would begin.

Past approvals do not carry forward. Each promotion is its own gate.

## Items

| # | Capability | Priority | Status |
|---|---|---|---|
| 01 | [Strategic Research Intelligence](01-strategic-research-intelligence.md) | High | Planned |
| 02 | [AI Provider Manager](02-ai-provider-manager.md) | High | Planned |
| 03 | [Transformation Consultant](03-transformation-consultant.md) | High | Planned |
| 04 | [Executive Brief Generator](04-executive-brief-generator.md) | Medium | Planned |
| 05 | [Department Recommendation Engine](05-department-recommendation-engine.md) | Medium | Planned |
| 06 | [Hebun Guide](06-hebun-guide.md) | Medium | Planned |
| 07 | [Voice Layer](07-voice-layer.md) | Medium | Planned |
| 08 | [AI Transformation Playbook Engine](08-ai-transformation-playbook-engine.md) | Medium | Planned |
| 21 | [Enterprise System Map (Digital Twin)](21-enterprise-system-map.md) | Future | Planned |
