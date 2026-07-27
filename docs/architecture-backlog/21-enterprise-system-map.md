# 21 — Enterprise System Map (Digital Twin)

**Priority:** Future
**Status:** Backlog — design deferred until core architecture is complete

## Purpose

The main visualization center of Hebun Enterprise OS. Not a classic dashboard — a live **Digital Twin** of the enterprise: a real-time, interactive map that renders the company as one running system, layer by layer, node by node.

It is where the Director *sees* the enterprise: capabilities, agents, tasks, events, data, and decisions, live and connected.

## Layers rendered (v1)

- Director Layer
- Enterprise Intelligence Layer
- Business Capability Layer
- Agent Runtime Layer
- Execution Layer (LLMs, Tools, Integrations)
- Data Layer

## Information shown

- Capability Health
- Agent Status
- Active Tasks
- Event Flow
- Data Flow
- Cross-Capability Connections
- Alerts
- Director Decisions
- AI Insights

## Features

- Real-time animated nodes and connections
- Zoom / Pan
- Node detail panels
- Live event stream
- Capability and Agent health state
- Filtering (Department, Capability, Agent)
- Real-time system visibility

## Architectural notes

Read-only visualization and presentation layer over signals the platform already produces. It *shows*; it never intervenes — no remediation, no gating, no execution. It is a lens on the running enterprise, not a hand on it.

The map is the visual surface of the **Director Visibility / Enterprise Awareness** architecture ([business-capabilities/35-director-visibility.md](../architecture/business-capabilities/35-director-visibility.md)): it renders the honest, complete picture the Capability Intelligence layer produces, plus live runtime and execution signals. Insight and assessment come from the capability intelligence layer; runtime/agent/tool signals from the execution and observability layers. It surfaces understanding; the Director reasons and decides through Director Intelligence.

The six rendered layers map directly onto the completed architecture:

- Director Layer → Director Intelligence ([Phase 7](../architecture/director-reasoning/README.md))
- Enterprise Intelligence Layer → Capability Intelligence ([business-capabilities/30](../architecture/business-capabilities/30-capability-intelligence.md))
- Business Capability Layer → Capability Network ([business-capabilities/23](../architecture/business-capabilities/23-capability-network.md))
- Agent Runtime + Execution Layers → Execution ([Phase 8](../architecture/execution-agents/README.md))
- Data Layer → execution state and data signals ([Phase 8 execution-state](../architecture/execution-state/README.md))

Cross-capability connections are the ability-level dependency edges of the Capability Network ([business-capabilities/24](../architecture/business-capabilities/24-dependency-model.md)); critical nodes and single points of failure ([business-capabilities/28](../architecture/business-capabilities/28-critical-capabilities.md)) are prime candidates for visual emphasis and alerting.

## Dependencies

- Director Visibility / Enterprise Awareness — the understanding to render ([business-capabilities/35](../architecture/business-capabilities/35-director-visibility.md))
- Capability Intelligence — health, maturity, risk, insight ([business-capabilities/30](../architecture/business-capabilities/30-capability-intelligence.md))
- Capability Network — nodes, edges, criticality ([business-capabilities/23](../architecture/business-capabilities/23-capability-network.md))
- Agent Runtime + Execution signals — agent status, active tasks, event/data flow ([Phase 8](../architecture/execution-agents/README.md))
- [18 — Observability Center](18-observability-center.md) — runtime health/telemetry signals
- [11 — Agent Registry](11-agent-registry.md), [12 — Tool Registry](12-tool-registry.md) — agent and tool identity/status

## Promotion criteria

- Core architecture complete (Enterprise + Business Capability + Capability Intelligence phases).
- Signal sources live: capability intelligence (health/maturity/risk/insight), execution runtime (agent status, tasks, events), data flow.
- Read-only boundary — visualizes, never intervenes.
- Real-time signal contract defined (what streams, at what cadence, in what shape).
- Director approval.

## Notes

Deferred by explicit Director instruction: designed as a **separate phase after the current architecture is complete**. Recorded here as a backlog item only — no design, contract, or implementation in this pass.
