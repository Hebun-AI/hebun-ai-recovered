# 32 — Capability Maturity

## Purpose

Define the **Capability Maturity** dimension — the architecture by which the enterprise understands how *developed* an ability is. Maturity is distinct from health: a capability can work well today (healthy) yet be shallow, ad hoc, or fragile in how established it is (immature). This document defines maturity as a dimension, not a maturity scale or scoring model.

## Core Concepts

### Maturity — how developed is the ability?
**Capability Maturity** assesses how *established and developed* an ability is — how deeply the enterprise possesses it, versus having it in a nascent or ad hoc form. Where health asks "is it working now?", maturity asks "how solidly do we have it?". A young ability that happens to work is healthy but immature; a long-established ability is mature.

### Maturity is a dimension, not a scale
This document defines maturity as an *architectural dimension of understanding*. It does **not** define maturity *levels*, a numeric scale, a rubric, or a scoring model. What the concrete maturity stages are is later work; the architecture fixes *that* maturity is a distinct dimension and *what it means*, never a specific ladder.

### Why maturity matters separately
Assessing only health hides risk: an ability may work today yet be immature — under-developed, undocumented at the ability level, dependent on fragile arrangements. Maturity surfaces that an ability, though currently healthy, is not yet a solid, dependable part of the enterprise. It informs where to *deepen* an ability, not just where to *fix* it ([enterprise thinking](06-enterprise-thinking.md)).

### Maturity and the network
An immature capability that is *critical* ([critical capabilities](28-critical-capabilities.md)) is a particular concern: the enterprise leans heavily on an ability it has not solidly established. Maturity read against network position reveals structural fragility that neither dimension shows alone ([capability risk](33-capability-risk.md)).

### Maturity is realization-independent in definition
Maturity assesses how developed the *ability* is, not how polished a particular process or agent is. It is defined at the ability level ([capability principles](02-capability-principles.md)).

## Architecture

- **Maturity dimension** — how developed/established an ability is.
- **Distinct from health** — "how solid" vs "working now".
- **Network-aware reading** — immature + critical = fragility.
- **No scale** — the dimension is defined; stages/rubrics are later work.

## Enterprise Examples

*Illustrative of the dimension only — no scale or score.*

- The *kind* of statement: "this ability works but is immature — nascent and not yet solidly established"; "this ability is mature and dependable." An immature ability that many others depend on illustrates structural fragility. This phase defines what maturity *means*; it defines no levels and computes no score.

## Design Principles

- **Maturity = how developed, not how working.** Distinct from health.
- **Read against the network.** Immature + critical is a red flag.
- **Define the dimension; don't build a ladder.**

## Boundaries

- Defines the **maturity dimension**, not any scale, level, rubric, or score.
- No KPI, workflow, process, agent, execution, code, UI, or prompt.

## Future Evolution

Later phases define concrete maturity stages and instrument them, keeping maturity an ability-level, network-aware dimension distinct from health. This phase fixes what maturity means; it builds no ladder.
