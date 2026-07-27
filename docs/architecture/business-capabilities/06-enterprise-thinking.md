# 06 — Enterprise Thinking

## Purpose

Explain why business capabilities are the **foundation of Enterprise Intelligence** — why an enterprise that wants to reason about itself must reason in terms of capabilities, and why capabilities are the right unit for that reasoning precisely because they are measurable and independent.

## Core Concepts

### The enterprise reasons about what it can do
To think about itself — its strengths, gaps, risks, and where to invest — an enterprise needs a stable vocabulary of *what it is able to do*. Capabilities are that vocabulary. Organization (who), process (how), and agent (which) are too volatile and too low-level to reason about the company as a whole; capabilities are the durable, company-level unit.

### Capabilities are measurable
Because a capability is a clearly defined ability ([capability principles](02-capability-principles.md)), its presence, strength, coverage, and health can be assessed. Measurability is what makes capabilities usable for reasoning: you can ask "do we have this ability, and how strong is it?" in a way you cannot meaningfully ask of a reorganizing department or a churning agent.

### Why capabilities are the base, not organization or process
- **Stability.** Reasoning needs a stable substrate. Capabilities change slowly; organization and process change fast. Building enterprise reasoning on capabilities gives it a base that does not shift underfoot.
- **Independence.** Because capabilities are independent of who/how/which ([03](03-capability-vs-department.md), [04](04-capability-vs-process.md), [05](05-capability-vs-agent.md)), reasoning about them is not distorted by reorgs, rewrites, or agent swaps.
- **Company-level.** Capabilities describe the *company*, not a unit or a procedure. That is the altitude enterprise reasoning operates at.

### Capability is the foundation, not the reasoning itself
This document explains *why* capabilities are the base of Enterprise Intelligence — it does **not** build Enterprise Intelligence, and it performs no reasoning. Reasoning stays in Director Intelligence ([Phase 7](../director-reasoning/README.md)); Enterprise Intelligence, if built, is a future layer. This phase only establishes that capabilities are the unit such reasoning would stand on.

## Architecture

- **Capability model** — the enterprise's abilities, defined and measurable.
- **Reasoning substrate (future)** — Enterprise Intelligence would reason *over* the capability model: assessing strength, finding gaps, informing investment. The capability layer is the substrate; the reasoning is a separate, later, Director-gated layer.
- **Separation** — the capability layer holds the *facts of ability*; it does not hold the reasoning. Reasoning attaches above; it is not embedded here.

## Enterprise Examples

*Illustrative only — not a catalog, and no reasoning is performed.*

- The *kind* of question capabilities enable: "which of our abilities are strong, which are weak, which are missing?" — answerable over a capability model, not over a shifting org chart.
- The *kind* of stability they provide: an enterprise can track an ability's health across years even as the department, process, and agents behind it all change.

## Design Principles

- **Reason over capabilities, not over org/process/agent.** They are the stable, measurable unit.
- **Keep facts and reasoning separate.** The capability layer holds abilities; reasoning is a layer above.
- **Measurability is a requirement, not a bonus.** An unmeasurable capability cannot support enterprise reasoning.

## Boundaries

- Explains why capabilities ground Enterprise Intelligence; **builds no Enterprise Intelligence.**
- Performs **no reasoning** and defines **no metric or algorithm.**

## Future Evolution

Enterprise Intelligence is a future, Director-gated layer that would reason over the capability model — assessing, comparing, and informing decisions, always routing actual decisions to Director Intelligence. This phase lays only the foundation: capabilities as the stable, measurable, independent unit that such reasoning requires.
