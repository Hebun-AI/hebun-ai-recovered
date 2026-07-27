# 17 — Capability Value Model

## Purpose

Define the **Business Value** field of the meta model — the standard way a capability states the value it provides to the enterprise. Value is what justifies a capability's existence and what enterprise reasoning weighs when comparing, prioritizing, or investing. This document defines the field, not any capability's value and no KPI.

## Core Concepts

### Business Value — why the ability is worth having
A capability's **Business Value** states the value the ability provides — the contribution it makes to the enterprise. Where Purpose ([16](16-capability-identity.md)) says *why the ability exists*, Business Value says *what it is worth*. Together they justify the capability.

### Value is stated at the ability level
Business Value describes the value of *having the ability*, not the output of any single run of work. It is durable, like the capability itself — it does not fluctuate with each execution. This keeps value comparable across capabilities and stable over time ([capability stability](13-capability-stability.md)).

### Value is a field, not a metric list
The meta model requires that a capability *state* its value; it does **not** prescribe KPIs, targets, or measurements. How value is measured is later work (observability, [20](20-capability-observability.md), and instrumentation beyond this phase). This phase defines that value is a required, standardized field — nothing more. **No KPI list is created.**

### Value enables enterprise reasoning
Because every capability states value in the same standardized field, Enterprise Intelligence ([enterprise thinking](06-enterprise-thinking.md)) can reason about the enterprise's abilities by value — which are high-value, which are underperforming relative to value, where to invest. A uniform value field is what makes that reasoning possible; without it, capabilities are incomparable.

### Value is realization-independent
Business Value is defined without reference to who delivers it, how, or which agent. The value is a property of the *ability*, not of its current realization ([03](03-capability-vs-department.md), [04](04-capability-vs-process.md), [05](05-capability-vs-agent.md)).

## Architecture

- **Business Value field** — a standardized statement of the ability's worth to the enterprise.
- **Ability-level scope** — value of having the ability, not of one execution.
- **Reasoning input** — the field Enterprise Intelligence weighs when comparing capabilities.
- **No embedded metrics** — measurement is observability/instrumentation, not this field.

## Enterprise Examples

*Illustrative of the field only — not a capability, no KPI.*

- Business Value is the *worth statement* a capability carries so the enterprise can weigh it against others. This phase defines the field; it states no actual value and lists no KPI.

## Design Principles

- **State value, not KPIs.** The field is a standardized worth statement, not a metric list.
- **Value at ability level.** Durable, comparable, not per-execution.
- **Value is realization-independent.**

## Boundaries

- Defines the **Business Value field**, not any capability's value.
- **No KPI list**, no workflow, process, agent, code, UI, prompt, or execution.

## Future Evolution

Later phases populate real value statements for real capabilities and, separately, build the observability and instrumentation that measure value against it. This phase fixes value as a required, standardized, realization-independent field.
