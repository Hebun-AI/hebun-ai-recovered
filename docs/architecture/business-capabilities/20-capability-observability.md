# 20 — Capability Observability

## Purpose

Define two required meta-model fields: **Health** (whether the ability is present and strong) and **Observability Surface** (how the ability is made assessable). These fields make a capability measurable — the property Phase 10A required and Enterprise Intelligence depends on. This document defines the fields, not any metric or KPI.

## Core Concepts

### Capability Health — is the ability present and strong?
A capability's **Health** is a standardized statement of the ability's condition: is the enterprise's ability present, and how strong is it? Health is about the *ability*, not any single execution — a durable assessment of whether the company can genuinely do this, and how well. It is the field enterprise reasoning reads to find weak or missing abilities ([enterprise thinking](06-enterprise-thinking.md)).

### Observability Surface — how the ability is made assessable
A capability's **Observability Surface** is the standardized declaration of *how* its health can be observed — what makes the ability assessable. It is the interface through which health is determined. It defines that a capability *is* observable and by what surface; it does **not** prescribe specific metrics, KPIs, dashboards, or instruments — those are later, realization-level work. **No KPI list is created here.**

### Health vs measurement
The meta model requires every capability to *declare* health and an observability surface. It does not define the measurements themselves. This keeps the meta model at the architecture level: it standardizes *that* capabilities are observable and *that* they carry a health assessment, leaving *how* to instrument to a later phase ([meta-model design rules](22-meta-model-design-rules.md)).

### Observability enables enterprise reasoning
Uniform Health and Observability fields are what let Enterprise Intelligence reason over the whole ability model — comparing capability strength, spotting weak links in the dependency network ([dependencies](19-capability-dependencies.md)), and prioritizing by health-vs-value ([value model](17-capability-value-model.md)). Without a standardized observability surface, capabilities would be individually assessed and mutually incomparable.

### Observability is realization-independent
Health and the observability surface describe the *ability*, not who performs it, how, or which agent. The ability's condition is assessed as a property of the capability, independent of its realization ([05](05-capability-vs-agent.md)).

## Architecture

- **Health field** — standardized condition of the ability (present, strong?).
- **Observability Surface field** — how the ability is made assessable.
- **Assessment interface, not instruments** — the surface declares observability; it prescribes no metric.
- **Reasoning input** — health feeds enterprise reasoning and structural-risk analysis.

## Enterprise Examples

*Illustrative of the fields only — not a capability, no KPI.*

- Health is the *condition statement* of an ability; the Observability Surface is *how* that condition can be seen. A weak, widely-depended-on ability surfaced through health illustrates structural risk. This phase defines the fields; it defines no metric, KPI, or dashboard.

## Design Principles

- **Declare observability, not KPIs.** The surface makes the ability assessable; it lists no metrics.
- **Health at ability level.** Condition of the ability, not of one execution.
- **Observability is realization-independent.**

## Boundaries

- Defines **Health and Observability Surface fields**, not any capability.
- **No KPI, metric, or dashboard**, no workflow, process, agent, code, UI, prompt, or execution.

## Future Evolution

Later phases instrument the observability surface — real measures of real capabilities' health — while keeping the fields standardized and realization-independent. This phase fixes that every capability declares health and observability; measurement comes later, behind the Director gate.
