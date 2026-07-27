# Agent–Capability Binding

## Purpose

Agent–Capability Binding defines the governed association declaring that an Agent is eligible to realize a capability within a specific business and policy context. Binding makes the relationship explicit without equating the Agent with the capability or prematurely initiating execution.

## Core Concepts

- **Binding:** A governed, revocable association between a stable capability identity and a replaceable Agent identity.
- **Eligibility:** Evidence that an Agent can be considered for realization.
- **Authority envelope:** The business permissions and limits applying to the relationship.
- **Fitness:** Contextual suitability measured against capability expectations.
- **Binding provenance:** The authority, rationale, policy basis, and evidence behind the association.
- **Agent replacement:** Substitution of one eligible realizer for another without changing capability identity.

## Architecture

Binding is modeled as an architectural relationship, not as an attribute owned exclusively by the Agent or capability. It references both identities and carries context such as realization scope, policy constraints, assurance expectations, accountability, validity, and evidence requirements.

The relationship is many-to-many:

- One capability may bind to multiple Agents to support specialization, resilience, jurisdictional variation, or assurance differences.
- One Agent may bind to multiple capabilities when each relationship is independently governed.

Binding belongs to the orchestration plane. Execution attachment belongs at the boundary to the runtime plane. Therefore, a valid binding establishes eligibility but does not mean the Agent is active, allocated, invoked, or successful.

## Enterprise Examples

- Several independently governed Agents may be eligible for the same high-level capability, with the Director choosing among them according to policy context.
- A broadly applicable Agent may be bound to several capabilities, while its authority and evidence obligations differ for each binding.
- When an Agent is retired, its bindings can be revoked and replacement bindings established while the affected capabilities remain intact.

## Design Principles

1. Capability is never Agent identity.
2. Bindings must be explicit rather than inferred from runtime behavior.
3. Every binding has provenance, authority, constraints, and accountability.
4. Many-to-many relationships are first-class.
5. Binding validity is evaluated in context.
6. Binding revocation does not retire the capability.
7. Agent replacement is a binding concern, not a capability lifecycle event.
8. No binding grants unlimited runtime authority.

## Boundaries

Binding does not describe workflow, execution sequence, scheduling, task allocation, internal Agent composition, prompt construction, or runtime state. It does not certify execution success. It only establishes the governed possibility of realization and the conditions under which attachment may be considered.

## Future Evolution

Binding may evolve to include portable assurance claims, federated trust, dynamic policy evaluation, and machine-verifiable provenance. Dynamic binding must remain Director-governed and auditable; adaptability cannot become implicit runtime self-authorization.
