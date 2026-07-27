# 26 — Capability Interfaces

## Purpose

Define the **Capability Interface** — the point at which one capability connects to another in the network. An interface is what makes a dependency edge well-formed: capability A depends on capability B *through B's interface*, not through B's internals. Interfaces are what let capabilities connect without depending on each other's realization.

## Core Concepts

### A Capability Interface is the connection point
A **Capability Interface** is the declared boundary through which a capability is depended upon — expressed in terms of its Inputs and Outputs ([inputs and outputs](18-capability-inputs-and-outputs.md)). A downstream capability connects to an upstream one by relying on the upstream capability's *outputs* as its *inputs*. The interface is that output→input contract, at the ability level.

### Interfaces hide realization
The point of an interface is encapsulation: a capability connects to another through *what it provides* (its ability-level interface), never through *how it provides it* (its process or agent). This is what keeps dependencies stable while realization churns — a downstream capability depends on the upstream interface, so rewriting the upstream process or swapping its agent does not break the dependency ([capability vs process](04-capability-vs-process.md), [capability vs agent](05-capability-vs-agent.md)).

### Interfaces make edges well-formed
An edge in the dependency graph ([dependency model](24-dependency-model.md)) is well-formed only if it connects through a declared interface — the downstream capability's needed inputs match the upstream capability's declared outputs. A dependency that reaches "inside" a capability rather than through its interface is malformed ([network design rules](29-network-design-rules.md)).

### Interfaces are ability-level, not technical
A Capability Interface is *not* an API, protocol, schema, or endpoint. Those are realization/technical constructs below the taxonomy floor ([capability boundaries](12-capability-boundaries.md)). The Capability Interface is the *ability-level* statement of what a capability offers to depend on — no code, no contract-as-implementation, no technical surface.

## Architecture

- **Interface** — a capability's ability-level connection point, expressed via its declared Outputs (and the Inputs it exposes for others).
- **Output→Input contract** — a downstream capability's inputs satisfied by an upstream capability's outputs.
- **Encapsulation** — connection is through the interface, never through internals/realization.
- **Well-formedness** — an edge is valid only through a matching interface.

## Enterprise Examples

*Illustrative of interfaces only — not a real graph, no API.*

- Two capabilities connect where one's declared output meets the other's declared input — through the interface, not through either's internal realization. This keeps them connected across process rewrites. This phase defines the interface concept; it declares no actual interface and no API.

## Design Principles

- **Connect through interfaces, not internals.** Encapsulation keeps dependencies stable.
- **Interface = ability-level, not API.** No technical surface here.
- **Edges are valid only through matching interfaces.**

## Boundaries

- Defines the **Capability Interface concept**, not any interface, API, or capability.
- No schema, protocol, endpoint, code, workflow, process, agent, UI, or prompt.

## Future Evolution

Later phases declare real capability interfaces and validate edges through them; when realization is built, technical APIs attach *below* the ability-level interface. This phase fixes that capabilities connect through ability-level interfaces that hide realization.
