# 19 — Capability Dependencies

## Purpose

Define two required meta-model fields: **Dependencies** (capabilities this one relies on) and **Consumers** (capabilities or parties that rely on this one). Together they place a capability in the enterprise's ability network — the relationships that let the enterprise reason about how abilities support each other.

## Core Concepts

### Dependencies — what the ability relies on
A capability's **Dependencies** are the other capabilities it requires in order to be exercised — stated at the ability level. A dependency means "this ability rests on that ability being present." Dependencies are ability-to-ability relationships, not process calls or runtime invocations.

### Consumers — what relies on the ability
A capability's **Consumers** are the capabilities (or parties) that depend on it — the inverse of the dependency relationship. Consumers answer "who relies on this ability?" and reveal how important a capability is to the rest of the enterprise.

### Dependencies form an ability network
Dependencies and Consumers connect capabilities into a directed network of reliance, built on the output→input links from the interface fields ([inputs and outputs](18-capability-inputs-and-outputs.md)). This network is what lets the enterprise reason about **structural risk**: a weak capability that many others depend on is a systemic risk ([enterprise thinking](06-enterprise-thinking.md)).

### The dependency network is ability-level, not runtime
Dependencies are relationships between *abilities*, not between running components. "Capability A depends on Capability B" says the ability A requires the ability B — it says nothing about calls, messages, or execution order, which are realization concerns below the taxonomy ([capability boundaries](12-capability-boundaries.md)). The network is a map of ability reliance, not an execution graph.

### Dependencies respect taxonomy independence
Dependency and Consumer links reference other capabilities only — never departments, processes, or agents ([03](03-capability-vs-department.md), [04](04-capability-vs-process.md), [05](05-capability-vs-agent.md)). A capability depends on another *ability*, not on a unit that performs it or an agent that runs it.

### Dependencies should be acyclic at the ability level
The reliance network should not contain circular ability dependencies (A needs B, B needs A). Cycles indicate two capabilities that are really one, or a mis-scoped boundary ([meta-model design rules](22-meta-model-design-rules.md)).

## Architecture

- **Dependencies field** — capabilities this one relies on.
- **Consumers field** — capabilities/parties that rely on this one (inverse links).
- **Ability network** — the directed reliance graph across capabilities.
- **Acyclicity guidance** — no circular ability dependencies.
- **Ability-only references** — links point to capabilities, never to org/process/agent.

## Enterprise Examples

*Illustrative of the fields only — not a capability.*

- Dependencies/Consumers place a capability in the *reliance network*: what it needs, what needs it. A widely-depended-on ability that is weak illustrates structural risk. This phase defines the fields; it maps no actual dependencies.

## Design Principles

- **Depend on abilities, not realizations.** Links point to capabilities only.
- **Ability-level, not runtime.** Reliance, not calls.
- **Avoid cycles.** Circular dependencies signal a boundary error.

## Boundaries

- Defines **Dependencies and Consumers fields**, not any capability.
- No execution graph, workflow, process, agent, code, UI, prompt, or execution.

## Future Evolution

Later phases declare real dependencies/consumers, forming the enterprise's ability network for structural-risk reasoning. When realization is built, runtime relationships attach below — the ability-level reliance fixed here stays a map of abilities.
