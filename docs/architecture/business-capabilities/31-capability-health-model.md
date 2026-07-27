# 31 — Capability Health Model

## Purpose

Define the **Capability Health** dimension of the intelligence layer — the architecture by which the enterprise understands whether an ability is present and strong. This document defines *what health means* and *how it is assessed as a dimension*, not any health score or formula.

## Core Concepts

### Health — is the ability present and strong?
**Capability Health** is the assessment of an ability's current condition: does the enterprise genuinely have this ability, and how strong is it? It answers presence ("can we do this at all?") and strength ("how well?"). Health is a standing property of the ability, read through the capability's declared Observability Surface ([observability](20-capability-observability.md)).

### Health is a dimension, not a score
This document defines health as an *architectural dimension of understanding* — a way the enterprise sees a capability. It does **not** define a health score, a scale, a threshold, or a formula. How health is quantified is instrumentation, below this layer ([intelligence design rules](36-intelligence-design-rules.md)). The architecture fixes *that* health is assessed and *what it means*, never *how it is computed*.

### Health has a structural component
An ability's health is not read in isolation. Its position in the network matters: a healthy-looking capability that depends on an unhealthy upstream capability is at risk ([upstream and downstream](25-upstream-and-downstream.md)). Health assessment reads both the node's own condition and its dependencies' condition — health propagates downstream ([capability risk](33-capability-risk.md)).

### Health vs maturity vs risk
- **Health** — is it working well *now*?
- **Maturity** — how *developed* is it? ([maturity](32-capability-maturity.md))
- **Risk** — how *exposed* is it? ([risk](33-capability-risk.md))

A capability can be healthy but immature, or mature but at risk. The three dimensions are distinct and assessed separately.

### Health is realization-independent in definition
Health assesses the *ability's* condition, not a specific process's performance or an agent's uptime. It is defined at the ability level ([capability principles](02-capability-principles.md)); realization-level signals may inform it later, but the dimension is about the ability.

## Architecture

- **Health dimension** — presence + strength of an ability.
- **Observation input** — read through the capability's Observability Surface ([20](20-capability-observability.md)).
- **Structural component** — downstream health depends on upstream health.
- **No score** — the dimension is defined; its quantification is instrumentation.

## Enterprise Examples

*Illustrative of the dimension only — no score or formula.*

- The *kind* of statement: "this ability is present and strong"; "this ability is present but weak"; "this ability is degraded because an upstream ability it depends on is weak." This phase defines what those statements *mean*; it computes no health value.

## Design Principles

- **Health = presence + strength.** A standing condition, not a per-run metric.
- **Read structurally.** Upstream health affects downstream health.
- **Define the dimension; don't score it.**

## Boundaries

- Defines the **health dimension**, not any score, scale, threshold, or formula.
- No KPI, workflow, process, agent, execution, code, UI, or prompt.

## Future Evolution

Later phases instrument health — quantifying presence and strength through the observability surface — while keeping health an ability-level, structurally-aware dimension. This phase fixes what health means; it scores nothing.
