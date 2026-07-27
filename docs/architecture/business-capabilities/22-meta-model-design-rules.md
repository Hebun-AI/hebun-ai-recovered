# 22 — Meta Model Design Rules

## Purpose

Consolidate the rules that govern the Capability Meta Model — the conformance standard every capability must meet — and define **Evolution Rules**, the required field governing how a capability's definition may change over time. This document is the capstone of Phase 10C.

## Core Concepts

The meta model is only useful if every capability *conforms* to it identically. These rules define conformance and cover the last required concept, Evolution Rules, closing the standard shape.

## Architecture

### The conformance rules

#### M1 — Every required field is present
A well-formed capability carries all twelve fields: Identity, Purpose, Business Value, Inputs, Outputs, Dependencies, Consumers, Health, Observability Surface, Governance Attachment, Director Visibility, Evolution Rules ([meta model](15-capability-meta-model.md)). None is optional.

#### M2 — Every field is at ability level
No field names a department, process, agent, workflow, or KPI. Inputs/outputs are interfaces not steps ([18](18-capability-inputs-and-outputs.md)); dependencies are ability links not calls ([19](19-capability-dependencies.md)); observability declares assessability not metrics ([20](20-capability-observability.md)).

#### M3 — Independence on all three axes
Every capability is organization-, process-, and agent-independent ([capability principles](02-capability-principles.md)). A capability whose fields break under a reorg, rewrite, or agent swap is non-conforming.

#### M4 — Identity is unique and stable
One identity per ability, unique across the taxonomy, changed only by evolution rules ([identity](16-capability-identity.md)).

#### M5 — Dependencies acyclic
No circular ability dependencies ([dependencies](19-capability-dependencies.md)). A cycle signals a boundary error to be resolved, not encoded.

#### M6 — Governed and visible
Every capability declares Governance Attachment and Director Visibility; none is exempt or invisible ([governance](21-capability-governance.md)).

#### M7 — No instances in this phase
These rules define conformance for capabilities defined *later*. This phase defines **no** capability, KPI, or catalog.

### Evolution Rules (the twelfth required field)

**Evolution Rules** is the standardized field governing *how a capability's definition may change*:

- **Capabilities change slowly and deliberately.** A capability's identity, purpose, and value change only through governed, intentional evolution — never with routine churn ([capability stability](13-capability-stability.md)).
- **Additive refinement is normal.** Adding sub-capabilities or clarifying fields is routine; redefining identity is rare and deliberate.
- **Change is governed and visible.** Every evolution of a capability falls under governance ([governance](21-capability-governance.md)) and is visible to the Director. A capability's definition is not changed silently.
- **Realization change is not capability change.** Rewriting a process or swapping an agent is *not* an evolution of the capability ([04](04-capability-vs-process.md), [05](05-capability-vs-agent.md)); the Evolution Rules govern the *ability definition*, not its realization.

Evolution Rules make the capability's own change discipline part of its standard shape — every capability carries the rules for how it may itself evolve.

## Enterprise Examples

*Illustrative of conformance and evolution only — not a capability.*

- **Conformance check:** a candidate missing a field fails M1; one naming a process in its inputs fails M2; one with a circular dependency fails M5.
- **Evolution:** adding a sub-capability is routine; redefining identity is a deliberate, governed, Director-visible act; swapping an agent is not a capability change at all.

## Design Principles

- **All twelve fields, all ability-level, all independent.** That is conformance.
- **Evolve slowly, deliberately, governed, visibly.**
- **Realization change ≠ capability change.**

## Boundaries

- Defines **conformance rules and the Evolution Rules field**, not any capability.
- No KPI, workflow, process, agent, code, UI, prompt, or execution.

## Future Evolution

Phase 10D and later instantiate capabilities that conform to this meta model — all twelve fields, ability-level, independent, governed, visible, with declared evolution rules. The standard fixed here is what every future capability is measured against.
