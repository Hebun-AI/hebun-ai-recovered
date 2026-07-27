# 34 — Observation and Insight

## Purpose

Define two core mechanisms of the intelligence layer: the **Observation Surface** (how capabilities are observed) and **Insight Generation** (how observation becomes understanding). Together they are how the assessment dimensions — health, maturity, risk — are actually formed from the capability model. This document defines the mechanisms architecturally, not any observation instrument or insight algorithm.

## Core Concepts

### Observation Surface — how capabilities are seen
The **Observation Surface** is the enterprise-wide interface through which the intelligence layer observes capabilities. It is built from each capability's own declared Observability Surface ([observability](20-capability-observability.md)) plus the network structure ([capability network](23-capability-network.md)). The observation surface is *what the intelligence layer looks at* — the observable face of the whole ability model.

### Insight Generation — observation becomes understanding
**Insight Generation** is the mechanism that turns raw observation into understanding along the assessment dimensions: reading the observation surface to conclude "this ability is weak", "this one is immature", "this one is high-risk because it is critical and fragile". Insight is *interpreted observation* — the step from *seeing* to *understanding*.

### Insight is architectural, not algorithmic
This document defines *that* the layer observes and *that* it generates insight, and the relationship between them. It does **not** write an insight algorithm, a scoring method, or an analytics pipeline. How insight is computed is instrumentation, below this layer ([intelligence design rules](36-intelligence-design-rules.md)). The architecture fixes the *mechanism shape*: observe the surface, interpret into the dimensions.

### Insight feeds the Director, not decisions
Insight is understanding *for the Director* ([director visibility](35-director-visibility.md)) — it surfaces what is true about the enterprise's abilities so the Director can steer. Insight does **not** decide, recommend action as authority, or act. It stops at understanding; reasoning and decisions are Director Intelligence's ([Phase 7](../director-reasoning/README.md)).

### Insight is network-aware
Because risk and health have structural components ([risk](33-capability-risk.md), [health model](31-capability-health-model.md)), insight reads the network, not isolated nodes. The strongest insights are structural: "this weak ability is a single point of failure for three critical abilities." Observation without the network would miss them.

## Architecture

- **Observation Surface** — aggregated observability of all capabilities + network structure.
- **Insight Generation** — interpretation of observation into the health/maturity/risk dimensions.
- **Network-aware reading** — insight uses structure, not just node condition.
- **Feeds visibility** — insight is surfaced to the Director; it does not decide.

## Enterprise Examples

*Illustrative of the mechanisms only — no algorithm.*

- **Observation:** the intelligence layer looks at the observable face of every capability and the network around it.
- **Insight:** from that, it forms understanding — "this ability is immature and critical." This phase defines the observe→interpret mechanism; it writes no algorithm and computes nothing.

## Design Principles

- **Observe the surface; interpret into dimensions.** Seeing → understanding.
- **Insight is network-aware.** Structure produces the sharpest insight.
- **Stop at understanding.** Insight feeds the Director; it never decides.

## Boundaries

- Defines **observation and insight mechanisms**, not any algorithm, pipeline, or score.
- No KPI, workflow, process, agent, execution, code, UI, or prompt.

## Future Evolution

Later phases instrument observation and insight — building the analytics that read the surface and produce understanding — while keeping insight understanding-only and network-aware. This phase fixes the mechanism; it computes nothing.
