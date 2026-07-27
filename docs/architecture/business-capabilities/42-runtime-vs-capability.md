# Runtime vs Capability

## Purpose

This document establishes the architectural separation between the durable Enterprise Capability Network and the replaceable runtime systems that realize it. The separation enables technology evolution, Agent replacement, resilience, and governance without destabilizing the enterprise business model.

## Core Concepts

| Dimension | Capability | Runtime |
|---|---|---|
| Primary question | What must the enterprise be able to do? | Where and by what operational means is it realized now? |
| Identity | Business-stable | Implementation-specific |
| Ownership | Business and enterprise governance | Operational and technical governance |
| Lifecycle | Strategic and long-lived | Deployment- and operation-oriented |
| Change driver | Business purpose and operating model | Technology, scale, cost, risk, and availability |
| Success evidence | Business outcome and fitness | Operational performance and conformance |
| Replacement | Rare semantic redesign | Expected substitution or evolution |

Capability independence means the capability can be understood, governed, and related to other capabilities without knowing its current Agent or runtime.

## Architecture

The capability model and runtime model are linked only through governed realization artifacts:

- Agent–Capability binding connects eligibility.
- Realization contract connects business expectations and authority.
- Execution attachment connects an authorized realization to a runtime context.
- Evidence mapping connects runtime observations back to orchestration and Capability Intelligence.

This bridge is referential, not structural. Runtime topology must not be embedded in the Capability Network, and capability hierarchy must not be inferred from runtime deployment.

### Lifecycle separation

The **capability lifecycle** reflects emergence, strategic change, maturity, business ownership, and retirement. The **runtime lifecycle** reflects provisioning, release, operation, replacement, degradation, and decommissioning. A runtime lifecycle event can affect realization fitness or availability, but it does not automatically create, change, or retire a capability.

## Enterprise Examples

- Replacing an Agent changes the realization portfolio and bindings, not the capability identity.
- Moving realization to a new runtime changes execution attachment and operational evidence, not capability relationships.
- A capability may persist during a runtime outage or after an Agent is retired; the enterprise then has a realization deficiency rather than no capability definition.

## Design Principles

1. Capability is independent of Runtime.
2. Runtime may change while capability meaning remains stable.
3. Agent may change while capability continues to exist.
4. Capability and runtime lifecycles are separately governed.
5. Runtime metrics require capability-context interpretation.
6. Capability models contain no deployment assumptions.
7. Runtime models do not claim business ownership.

## Boundaries

The distinction does not imply isolation. Governed bindings, attachments, and evidence create necessary traceability. It does prohibit shared identity, lifecycle coupling, automatic semantic propagation, and runtime-driven redefinition of business architecture.

## Future Evolution

Enterprises may gain stronger runtime portability, multi-provider realization, autonomous substitution, and predictive fitness assessment. The architecture must continue treating runtime change as realization evolution rather than capability mutation.
