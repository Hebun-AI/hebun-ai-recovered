# 14 — Taxonomy Design Principles

## Purpose

Consolidate the design principles that govern the enterprise capability taxonomy — the standard that keeps it coherent, independent, stable, and extensible as it is populated and grown over the enterprise's life. It also states the taxonomy's long-term expansion strategy and its relationship to Enterprise Intelligence.

## Core Concepts

This document is the capstone of Phase 10B. It gathers the principles distributed across the taxonomy, hierarchy, classification, boundary, and stability documents into one governing set, and defines how the taxonomy is meant to grow.

## Architecture

### The design principles

#### P1 — Four levels, always
Enterprise → Domain → Capability → Sub-Capability. No more, no fewer. Deeper detail is realization, not taxonomy ([hierarchy](10-capability-hierarchy.md), [boundaries](12-capability-boundaries.md)).

#### P2 — Independence at every level
Every node is organization-, process-, and agent-independent ([capability principles](02-capability-principles.md)). Classification never binds a node to who/how/which.

#### P3 — Single home, no overlap
Every node has exactly one parent; siblings do not overlap ([classification rules](11-capability-classification-rules.md), [boundaries](12-capability-boundaries.md)).

#### P4 — Classify by ability and altitude
Level is decided by breadth of ability, not convenience or realization ([classification rules](11-capability-classification-rules.md)).

#### P5 — Stable, not rigid
The taxonomy changes slowly and deliberately; routine churn stays below it ([stability](13-capability-stability.md)).

#### P6 — Grow additively
Expansion is primarily additive — new nodes attach into stable parents. Restructuring is rare and deliberate.

#### P7 — Structure, never catalog (this phase)
This phase defines the scheme; it enumerates no domains, capabilities, or sub-capabilities.

### Expansion strategy (long-term extensibility)

The taxonomy is built to grow without breaking:
- **Additive attachment** — a new capability attaches under an existing domain; a new sub-capability under an existing capability. The rest of the tree is untouched.
- **New domains at the root** — a genuinely new broad area attaches directly under the Enterprise, alongside existing domains, non-overlapping.
- **Deliberate restructuring** — when the enterprise's understanding of its abilities genuinely shifts, nodes may be re-parented — a rare, governed act, not routine.
- **Bounded depth preserved** — growth adds breadth and population, never a fifth level. Finer detail always goes to realization, below the taxonomy floor.

This strategy lets the taxonomy scale from a small model to a large one while staying coherent, stable, and reasoning-friendly.

### Relationship with Enterprise Intelligence
The taxonomy is the **structured substrate** Enterprise Intelligence will reason over ([enterprise thinking](06-enterprise-thinking.md)). Because it is hierarchical, independent, and stable, it lets future enterprise reasoning operate at any altitude — assess a whole domain, a single capability, or a facet — and compare over time. The taxonomy holds the *structured facts of ability*; Enterprise Intelligence, a future Director-gated layer, reasons over them. This phase builds the substrate, not the reasoning.

## Enterprise Examples

*Illustrative of growth only — not a catalog.*

- **Additive growth:** a new distinct ability attaches under an existing broad area without disturbing sibling capabilities.
- **New area:** a genuinely new broad area attaches at the root beside existing ones, non-overlapping.

## Design Principles

- **Coherence, independence, stability, extensibility** — the four properties the taxonomy must always keep.
- **Grow additively; restructure deliberately.**
- **Substrate now, reasoning later.**

## Boundaries

- Consolidates **principles and expansion strategy**; defines no capability or catalog.
- No process, agent, workflow, code, prompt, UI, or execution.

## Future Evolution

Phase 10C and later populate and grow the taxonomy under these principles, and eventually attach realization (process, agents) below its floor and Enterprise Intelligence above it — each behind the Director gate. The design principles fixed here govern the taxonomy for the enterprise's life.
