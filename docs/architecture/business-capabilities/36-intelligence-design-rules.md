# 36 — Intelligence Design Rules

## Purpose

Consolidate the rules governing the Capability Intelligence layer — the standard that keeps it assessment-only, honest, network-aware, and subordinate to the Director. This document is the capstone of Phase 10E.

## Core Concepts

The intelligence layer touches the most sensitive part of the capability model — the enterprise's understanding of itself. These rules keep it from overstepping into measurement it should not fix here, or decisions that belong to the Director.

## Architecture

### The rules

#### I1 — Assessment only, no measurement here
The layer defines assessment *dimensions* (health, maturity, risk) and *mechanisms* (observation, insight), never scores, KPIs, scales, matrices, or formulas ([health](31-capability-health-model.md), [maturity](32-capability-maturity.md), [risk](33-capability-risk.md)). Quantification is instrumentation, below this architecture.

#### I2 — Three distinct dimensions
Health, maturity, and risk are separate and assessed separately. A capability may be healthy but immature, or mature but at risk. Never collapse them into one number or one dimension.

#### I3 — Network-aware, not node-isolated
Assessment reads the network — health, maturity, and risk all have structural components ([critical capabilities](28-critical-capabilities.md), [upstream and downstream](25-upstream-and-downstream.md)). Insight is strongest when structural.

#### I4 — Insight stops at understanding
The layer observes and generates insight ([observation and insight](34-observation-and-insight.md)); it does not decide, recommend as authority, or act. Reasoning and decisions belong to Director Intelligence ([Phase 7](../director-reasoning/README.md)).

#### I5 — Serve the Director; surface completely and honestly
Understanding is surfaced to the Director ([director visibility](35-director-visibility.md)) — the whole ability model, nothing hidden, problems not concealed. Visibility is the precondition for Director steering.

#### I6 — Ability-level and realization-independent
Every dimension assesses the *ability*, not a specific process or agent ([capability principles](02-capability-principles.md)). Realization signals may inform assessment later, but the dimensions are about abilities.

#### I7 — Governed and Director-visible
The intelligence layer falls under enterprise governance ([capability governance](21-capability-governance.md)) and surfaces to the Director; it originates no authority and redefines no governance.

#### I8 — No instruments in this phase
These rules govern assessment defined *later*. This phase computes nothing, scores nothing, and defines no metric, KPI, matrix, or formula.

### The Director assessment model (summary)

How the Director understands capabilities, per this layer:
1. Every capability is **observed** through its observability surface, in network context ([34](34-observation-and-insight.md)).
2. Observation is interpreted into **insight** along three dimensions: **health** (present + strong?), **maturity** (how developed?), **risk** (how exposed, structurally?).
3. Insight aggregates into **Enterprise Awareness** ([35](35-director-visibility.md)) — the Director's honest, complete picture of the ability model.
4. The Director **reasons and decides** on that awareness through Director Intelligence — the intelligence layer never decides.

## Enterprise Examples

*Illustrative of the rules only — no scores.*

- **Rule check:** defining a health *scale* violates I1; collapsing health and risk into one number violates I2; the layer recommending an action *as authority* violates I4; hiding a weak capability from the Director violates I5.

## Design Principles

- **Dimensions and mechanisms, not scores.**
- **Three distinct, network-aware dimensions.**
- **Surface honestly to the Director; never decide.**

## Boundaries

- Defines **intelligence rules and the Director assessment model**, not any metric, KPI, matrix, formula, or score.
- No workflow, process, agent, execution, code, UI, or prompt.

## Future Evolution

Phase 10F and later instrument the assessment dimensions and, above this layer, Enterprise Intelligence reasons over the awareness — always routing decisions to the Director. The rules fixed here keep capability assessment honest, dimensional, and Director-serving for the enterprise's life.
