# Business Capability Foundation — Architecture (Phase 10A)

## Purpose

**Business Capabilities** is a new architectural layer above the Enterprise Architecture. Phase 9 defined how an AI-native enterprise is *organized* — its hierarchy, seats, collaboration, and operation. Phase 10A defines something orthogonal: **what the enterprise can do**. A business capability is a stable statement of an ability the company possesses — independent of who performs it, how it is performed, or which agent runs it.

This phase is **purely conceptual architecture**. It defines the *concept* of a business capability and the boundaries that separate it from organization, process, and agent. It builds **no capability list, map, or catalog** (no Marketing, Finance, Sales, HR, or any concrete capability), no workflow, no agent, no code, no prompt, no UI, and describes no execution.

## The core distinction this phase protects

Four different questions, four different architectural layers. This separation must hold across the entire architecture:

| Question | Layer | Phase |
|---|---|---|
| **Who** does the work? | Organization | Phase 9 |
| **What** can the company do? | **Capability** | **Phase 10A (this phase)** |
| **How** is the work done? | Process | later phase |
| **Which** work does the AI run? | Agent | later phase |

- **Organization = who.** Departments, managers, specialists — the seats that hold responsibility ([enterprise-organization](../enterprise-organization/README.md)).
- **Capability = what.** The abilities the enterprise has, as stable facts about the company.
- **Process = how.** The changeable procedures by which a capability is exercised.
- **Agent = which.** The AI participant that runs a piece of work.

A capability is not a department, not a process, and not an agent. Confusing any two collapses the architecture.

## Why this layer exists

The Enterprise Architecture answers *who is accountable*. But an enterprise is also defined by *what it is able to do* — abilities that persist while the organization reorganizes, the process is rewritten, and the agents change. Those abilities are business capabilities. Naming them as their own layer gives the enterprise a stable spine that outlasts every reorganization and every implementation, and it is the foundation on which Enterprise Intelligence will later reason about the company.

## Relationship with Enterprise Architecture (Phase 9)

Capabilities sit *above* organization and are *consumed by* it: an organizational unit is accountable *for* capabilities, but the capability is defined independently of the unit ([capability vs department](03-capability-vs-department.md)). Reorganizing the company changes who owns a capability; it does not change what the capability is.

## Relationship with future Process and Agent layers

Process (how) and Agent (which AI) are **later phases**. This phase defines the capability concept they will attach to, and the boundaries that keep them distinct ([capability vs process](04-capability-vs-process.md), [capability vs agent](05-capability-vs-agent.md)). It defines neither.

## Documents

| Document | Topic |
|---|---|
| [01 — What Is a Business Capability](01-what-is-a-business-capability.md) | The concept, defined |
| [02 — Capability Principles](02-capability-principles.md) | The constitution of a capability |
| [03 — Capability vs Department](03-capability-vs-department.md) | Why *what* ≠ *who* |
| [04 — Capability vs Process](04-capability-vs-process.md) | Why *what* ≠ *how* |
| [05 — Capability vs Agent](05-capability-vs-agent.md) | Why *what* ≠ *which AI* |
| [06 — Enterprise Thinking](06-enterprise-thinking.md) | Why capabilities are the base of Enterprise Intelligence |
| [07 — Design Rules](07-design-rules.md) | Rules for defining capabilities correctly |

Each document follows: **Purpose, Core Concepts, Architecture, Enterprise Examples, Design Principles, Boundaries, Future Evolution.** (Enterprise Examples are illustrative of the *concept* only — never a capability catalog.)

### Phase 10B — Enterprise Capability Taxonomy

| Document | Topic |
|---|---|
| [08 — Enterprise Capability Taxonomy](08-enterprise-capability-taxonomy.md) | Four-level classification structure |
| [09 — Capability Domains](09-capability-domains.md) | Broad ability groupings |
| [10 — Capability Hierarchy](10-capability-hierarchy.md) | Enterprise, Domain, Capability, and Sub-Capability nesting |
| [11 — Capability Classification Rules](11-capability-classification-rules.md) | Placement and non-overlap rules |
| [12 — Capability Boundaries](12-capability-boundaries.md) | Internal boundaries and realization floor |
| [13 — Capability Stability](13-capability-stability.md) | Long-lived taxonomy and controlled evolution |
| [14 — Taxonomy Design Principles](14-taxonomy-design-principles.md) | Normative taxonomy rules |

### Phase 10C — Capability Meta Model

| Document | Topic |
|---|---|
| [15 — Capability Meta Model](15-capability-meta-model.md) | Uniform Capability shape |
| [16 — Capability Identity](16-capability-identity.md) | Stable identity and purpose |
| [17 — Capability Value Model](17-capability-value-model.md) | Ability-level business value |
| [18 — Capability Inputs and Outputs](18-capability-inputs-and-outputs.md) | Ability-level interface fields |
| [19 — Capability Dependencies](19-capability-dependencies.md) | Dependencies and consumers |
| [20 — Capability Observability](20-capability-observability.md) | Health and observability surface |
| [21 — Capability Governance](21-capability-governance.md) | Governance attachment and Director visibility |
| [22 — Meta Model Design Rules](22-meta-model-design-rules.md) | Conformance and evolution rules |

### Phase 10D — Enterprise Capability Network

| Document | Topic |
|---|---|
| [23 — Capability Network](23-capability-network.md) | Ability-level dependency graph |
| [24 — Dependency Model](24-dependency-model.md) | Structural dependency semantics |
| [25 — Upstream and Downstream](25-upstream-and-downstream.md) | Direction and propagation vocabulary |
| [26 — Capability Interfaces](26-capability-interfaces.md) | Ability-level connection points |
| [27 — Network Boundaries](27-network-boundaries.md) | Cross-domain dependency boundaries |
| [28 — Critical Capabilities](28-critical-capabilities.md) | Criticality, SPOF, and Realization Redundancy |
| [29 — Network Design Rules](29-network-design-rules.md) | Network conformance and evolution |

### Phase 10E — Capability Intelligence

| Document | Topic |
|---|---|
| [30 — Capability Intelligence](30-capability-intelligence.md) | Network-level assessment architecture |
| [31 — Capability Health Model](31-capability-health-model.md) | Presence and strength dimension |
| [32 — Capability Maturity](32-capability-maturity.md) | Ability development dimension |
| [33 — Capability Risk](33-capability-risk.md) | Condition and structural exposure |
| [34 — Observation and Insight](34-observation-and-insight.md) | Observation surface and insight generation |
| [35 — Director Visibility](35-director-visibility.md) | Enterprise Awareness surfacing |
| [36 — Intelligence Design Rules](36-intelligence-design-rules.md) | Normative intelligence boundaries |

### Phase 10F — AI Capability Orchestration

| Document | Topic |
|---|---|
| [37 — AI Capability Orchestration](37-ai-capability-orchestration.md) | Capability-to-Runtime bridge |
| [38 — Capability Realization](38-capability-realization.md) | How durable capabilities are realized by replaceable runtime actors |
| [39 — Agent–Capability Binding](39-agent-capability-binding.md) | Governed eligibility between agents and capabilities |
| [40 — Capability Execution Model](40-capability-execution-model.md) | Execution attachment and runtime evidence boundary |
| [41 — Orchestration Boundaries](41-orchestration-boundaries.md) | Intelligence, governance, execution, and evidence separation |
| [42 — Runtime vs Capability](42-runtime-vs-capability.md) | Identity and lifecycle independence |
| [43 — Orchestration Design Rules](43-orchestration-design-rules.md) | Normative orchestration guardrails |

### Phase 10G — Review and Closure

| Document | Topic |
|---|---|
| [44 — Architecture Consistency Review](44-architecture-consistency-review.md) | Cross-phase consistency audit |
| [45 — Terminology and Concept Index](45-terminology-and-concept-index.md) | Controlled canonical vocabulary |
| [46 — Boundary Validation](46-boundary-validation.md) | Ten architectural boundary checks |
| [47 — Cross-Architecture Alignment](47-cross-architecture-alignment.md) | Phase 7–9 and related architecture alignment |
| [48 — Anti-Patterns and Modeling Mistakes](48-anti-patterns-and-modeling-mistakes.md) | Prohibited modeling patterns |
| [49 — Future Extension Points](49-future-extension-points.md) | Deferred, gated extensions |
| [50 — Phase 10 Closure](50-phase-10-closure.md) | Formal closure and final status |

## Boundaries

- **No capability list, map, or catalog** — the concept only.
- **No workflow, process, agent, code, prompt, or UI.**
- **No execution** — this layer describes what the enterprise can do, never how work runs.
- Purely conceptual architecture.

## Future direction

Phase 10A is the concept. Later phases (10B onward) will build on it — the structure by which capabilities are defined and owned, and eventually their attachment to process and agents — each behind the Director gate ([Capability Lifecycle](../../architecture-backlog/00-capability-lifecycle.md)). This phase names what a capability *is*; it lists none.
