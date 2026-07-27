# 33 — Capability Risk

## Purpose

Define the **Capability Risk** dimension — the architecture by which the enterprise understands how *exposed* an ability is. Risk combines a capability's own condition with its structural position in the network. This document defines risk as a dimension, not a risk matrix, score, or formula.

## Core Concepts

### Risk — how exposed is the ability?
**Capability Risk** assesses the enterprise's exposure around an ability: how likely it is to fail or fall short, and how much damage that would do. Risk is not health or maturity alone — it is the *exposure* that arises from combining an ability's condition with what depends on it.

### Risk is structural and conditional together
Risk reads two things at once:
- **Condition** — the ability's health ([health model](31-capability-health-model.md)) and maturity ([maturity](32-capability-maturity.md)): a weak or immature ability is more likely to fail.
- **Structure** — the ability's network position ([critical capabilities](28-critical-capabilities.md)): a critical or single-point-of-failure node causes more damage if it fails.

High risk is where the two meet: a **weak or immature ability that many others depend on**. That combination — not either factor alone — is what the risk dimension surfaces.

### Risk is a dimension, not a matrix
This document defines risk as an *architectural dimension of understanding*. It does **not** build a risk matrix, assign risk scores, define likelihood/impact scales, or write a formula. Those are instrumentation, below this layer ([intelligence design rules](36-intelligence-design-rules.md)). The architecture fixes *what risk means* and *what it reads*, never *how it is scored*.

### Risk propagates along the network
Because risk has a structural component, it propagates: a risky upstream capability raises the risk of everything downstream of it ([upstream and downstream](25-upstream-and-downstream.md)). Assessing risk means tracing exposure through the dependency graph, not reading a node alone.

### Risk is realization-independent in definition
Risk assesses exposure around the *ability*, not around a specific process or agent's failure modes. It is defined at the ability level ([capability principles](02-capability-principles.md)); realization signals may inform it later.

## Architecture

- **Risk dimension** — exposure = condition × structural importance.
- **Condition input** — health + maturity.
- **Structural input** — criticality / SPOF from the network.
- **Propagation** — upstream risk raises downstream risk.
- **No matrix/score** — the dimension is defined; quantification is instrumentation.

## Enterprise Examples

*Illustrative of the dimension only — no matrix or score.*

- The *kind* of statement: "this ability is high-risk — it is weak *and* many capabilities depend on it (a single point of failure)"; "this ability is low-risk — strong and little depends on it." This phase defines what risk *means*; it builds no matrix and computes no score.

## Design Principles

- **Risk = condition × structural importance.** Neither factor alone is risk.
- **Risk propagates downstream.** Trace exposure through the network.
- **Define the dimension; don't build a matrix.**

## Boundaries

- Defines the **risk dimension**, not any risk matrix, score, scale, or formula.
- No KPI, workflow, process, agent, execution, code, UI, or prompt.

## Future Evolution

Later phases instrument risk — combining condition and structure into concrete exposure assessments — keeping risk an ability-level, network-aware dimension. This phase fixes what risk means; it scores nothing and builds no matrix.
