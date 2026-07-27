# 30 — Capability Intelligence

## Purpose

Define the **Capability Intelligence** layer — the assessment layer that operates *over* the Enterprise Capability Network. Phase 10A–10D defined what capabilities are, how they are organized, their standard shape, and their network. Phase 10E defines how the enterprise *understands* those capabilities: how their health, maturity, and risk are assessed, and how that understanding reaches the Director. This phase defines the **assessment architecture** — no metrics, no KPIs, no formulas, no scores.

## Core Concepts

### Intelligence is understanding, not measurement
Capability Intelligence is the layer that turns the capability model into **enterprise awareness** — a structured understanding of the enterprise's abilities. It defines *what dimensions* capabilities are understood along (health, maturity, risk) and *how* that understanding is formed and surfaced. It does **not** compute scores, define KPIs, or write formulas — those are instrumentation, below this architecture.

### It operates over the network, not the node
Capability Intelligence reads the whole Capability Network ([capability network](23-capability-network.md)) — nodes, edges, direction, criticality — not just isolated capabilities. Understanding an ability means understanding its place in the network: what depends on it, what it depends on, how critical it is. Intelligence is a network-level faculty.

### The assessment dimensions
Capabilities are understood along standard dimensions, each its own document:
- **Health** — is the ability present and strong? ([health model](31-capability-health-model.md))
- **Maturity** — how developed is the ability? ([maturity](32-capability-maturity.md))
- **Risk** — how exposed is the ability, structurally? ([risk](33-capability-risk.md))

These are read through each capability's Observability Surface ([observability](20-capability-observability.md)) and the network structure ([critical capabilities](28-critical-capabilities.md)).

### It serves the Director
The purpose of the intelligence layer is to give the Director awareness of the enterprise's abilities ([director visibility](35-director-visibility.md)) — so the Director can steer. Intelligence *surfaces understanding*; the Director *decides*. Reasoning and decisions stay in Director Intelligence ([Phase 7](../director-reasoning/README.md)); this layer prepares the understanding they act on.

### It assesses; it does not act
Capability Intelligence observes and generates insight ([observation and insight](34-observation-and-insight.md)). It performs no work, changes no capability, and makes no decision. It is a lens on the ability model, not a hand on it.

## Architecture

- **Intelligence layer** — assessment faculty over the Capability Network.
- **Assessment dimensions** — health, maturity, risk.
- **Observation surface** — how capabilities are observed ([34](34-observation-and-insight.md)).
- **Insight generation** — turning observation into understanding ([34](34-observation-and-insight.md)).
- **Director visibility** — how understanding reaches the apex ([35](35-director-visibility.md)).
- **Design rules** — what keeps the layer assessment-only ([36](36-intelligence-design-rules.md)).

## Enterprise Examples

*Illustrative of the layer only — no metrics or scores.*

- The *kind* of understanding: "this ability is strong but structurally risky because much depends on it"; "this ability is immature." This phase defines the dimensions and how understanding is surfaced — it computes no score and lists no KPI.

## Design Principles

- **Understand, don't measure.** Define dimensions and surfacing; no formulas or KPIs.
- **Network-level, not node-level.** Assess abilities in their structural context.
- **Surface to the Director; don't decide.** Reasoning stays in Director Intelligence.

## Boundaries

- Defines the **assessment architecture**, not any metric, KPI, score, or formula.
- No risk matrix, workflow, process, agent, execution, code, UI, or prompt.

## Future Evolution

Later phases instrument the assessment dimensions and, above this layer, Enterprise Intelligence reasons over the understanding — always routing decisions to the Director. This phase fixes the assessment architecture; it measures nothing.
