# 28 — Critical Capabilities

## Purpose

Define **Critical Capability** and **Single Point of Failure** as structural properties derived from the Capability Network. These are the reasoning payoffs of the network view: the network structure reveals which abilities are load-bearing and where the enterprise is structurally fragile. This document defines the concepts, not any real critical capability.

## Core Concepts

### A Critical Capability is structurally load-bearing
A **Critical Capability** is a node on which many other capabilities depend — directly or transitively — so that its weakness or absence would degrade a large part of the enterprise's ability model. Criticality is a *structural* property, read from the dependency graph ([dependency model](24-dependency-model.md)): a capability is critical because of its position (how much depends on it), not because of runtime volume ([upstream and downstream](25-upstream-and-downstream.md)).

### A Single Point of Failure is a critical node without realization redundancy
A **Single Point of Failure (SPOF)** is a critical capability with no viable independent realization alternative. If its only realization becomes unavailable, every downstream capability that depends on the ability is exposed. A SPOF therefore combines high downstream reach with insufficient **Realization Redundancy**.

### Why the network reveals these
Criticality is emergent from the graph; SPOF assessment combines that structural position with realization evidence:
- **Criticality** = size and reach of a node's downstream set.
- **SPOF** = criticality + absence of a viable independent realization alternative.

Computing them is exactly why the network exists ([capability network](23-capability-network.md)): to let the enterprise see structural risk it could not see capability-by-capability ([enterprise thinking](06-enterprise-thinking.md)).

### Realization Redundancy preserves one capability identity
**Realization Redundancy** means that one Capability has multiple independent realization options under the same Capability identity and definition. Those options may use multiple Agents, multiple Runtimes, a human fallback, an alternative system or service, an alternative provider, or a controlled manual realization. Failover changes the active realization; it does not create a new Capability.

The Capability identity remains singular, its definition remains singular, and its owner remains singular and authoritative. Health, maturity, and risk are assessed at the Capability level. Realizer health and availability are assessed at the realization level and may inform the Capability assessment through evidence.

The term **Capability Redundancy** must not be used to mean that duplicate Capabilities provide the same ability. A backup Agent, alternative Runtime, or failover option is another realization of the same Capability, never another Capability.

### Identity uniqueness applies within the authoritative model scope
Within one authoritative enterprise Capability model scope, two Capabilities cannot represent the same ability. The same name or a similar ability may exist under separate Capability identities in different enterprises, tenants, or otherwise explicitly separated model scopes; that scope distinction does not permit duplication inside one authoritative model.

### These are analysis concepts, not fixes
This document defines *how to recognize* critical capabilities and SPOFs structurally. It does **not** resolve them, build redundancy, or recommend concrete action — resolution is future work, routed through Director Intelligence and the Capability Lifecycle. The network layer *surfaces* structural risk; it does not act on it.

### Structural, not operational
Criticality and SPOF are properties of the *ability graph* — not of running systems, uptime, or execution. A capability is a SPOF because of the *structure of reliance*, independent of any runtime ([capability boundaries](12-capability-boundaries.md)).

## Architecture

- **Criticality** — derived from a node's downstream reach in the dependency graph.
- **Realization Redundancy** — multiple independent realization options for one Capability identity.
- **SPOF** — a critical node without viable Realization Redundancy.
- **Boundary-crossing weight** — cross-domain critical nodes are enterprise-wide risks ([network boundaries](27-network-boundaries.md)).
- **Surfacing, not resolving** — the layer identifies; it does not fix.

## Enterprise Examples

*Illustrative of the concepts only — not a real graph.*

- A foundational ability that most others transitively depend on is *critical*; if its Capability has only one viable realization, it is a *single point of failure*. Adding a backup Agent or alternative Runtime would add Realization Redundancy while leaving the Capability identity, definition, and owner unchanged. This phase defines the distinction; it names no actual critical capability.

## Design Principles

- **Criticality is structural reach, not runtime volume.**
- **SPOF = critical + insufficient Realization Redundancy.**
- **One ability, one Capability identity per authoritative model scope.** Resilience comes from realizations, not duplicate Capabilities.
- **Surface risk; don't resolve it here.**

## Boundaries

- Defines **Critical Capability and SPOF concepts**, not any real capability or fix.
- No uptime, runtime, workflow, process, agent, execution, code, UI, or prompt.

## Future Evolution

Later phases compute criticality and SPOFs over the real network and route resolution through the Director gate. This phase fixes how these structural risks are defined and recognized.
