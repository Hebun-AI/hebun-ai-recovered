# 02 — Organizational Interaction Model

## Purpose

The Organizational Interaction Model defines **how units interact structurally** — the shapes cross-unit collaboration can take, and the paths those interactions follow through the hierarchy. It is the map of who may collaborate with whom, and how, without naming a concrete unit.

## Architectural role

This document gives collaboration its structure. Ownership transfer ([03](03-ownership-transfer.md)), cross-department coordination ([04](04-cross-department-coordination.md)), and escalation ([05](05-escalation-model.md)) are specific interactions that ride on this model; governance ([06](06-collaboration-governance.md)) holds them accountable. The interaction model is the topology the other topics operate on.

## The model

### Interaction follows the hierarchy
Units interact along the authority structure ([enterprise authority model](../enterprise-organization/04-authority-model.md)). Collaboration paths run through the levels that hold authority over the collaborating units — never through a side-channel that bypasses them ([collaboration principles](01-collaboration-principles.md)).

### The shapes of interaction

- **Peer interaction (same level, same parent)** — specialists within one department ([specialist collaboration](../specialist-architecture/05-collaboration-model.md)), or departments under the enterprise level. Peers align directly under their common authority.
- **Cross-parent interaction (same level, different parent)** — a specialist in one department working with a specialist in another. This flows *through the managers* of both departments ([cross-department coordination](04-cross-department-coordination.md)); peers do not reach directly across department lines.
- **Vertical interaction (across levels)** — a specialist and its manager, a manager and the enterprise level. This is the reporting-and-delegation relationship the hierarchy already defines ([manager oversight](../manager-architecture/05-oversight-and-reporting.md), [specialist reporting](../specialist-architecture/06-reporting-and-governance.md)); collaboration uses it for escalation ([05](05-escalation-model.md)), never to invert authority.

### Interaction preserves ownership and accountability
In every shape, each unit keeps its ownership and its accountability ([collaboration principles](01-collaboration-principles.md)). Interaction is alignment between owners, not a merger of them. One outcome always has one owner.

### Interaction is under authority, always
Every interaction happens within the delegated authority of the units involved. What exceeds that authority escalates ([escalation model](05-escalation-model.md)); it is never resolved by an interaction that reaches beyond the participants' grants.

### Interaction is structural, not communication
This model defines the *organizational shape* of interaction — the relationship and its authority path. It does not define runtime communication, messaging, or protocols; that is not organizational architecture. How units actually exchange information at runtime is out of scope ([README](README.md)).

## Inputs

- The **collaboration principles** ([01](01-collaboration-principles.md)) — the constitution the model must satisfy.
- The **hierarchy and authority model** ([9A](../enterprise-organization/04-authority-model.md)) — the levels and authority interaction follows.

## Outputs

- A **defined interaction topology** — the shapes of collaboration and the authority paths they follow — that ownership transfer, coordination, and escalation build on.

## Boundaries

- Defines **no concrete unit** — only the shapes of interaction between seats.
- Defines **no runtime communication, protocol, or message** — only the organizational shape.
- Performs **no reasoning, work, or orchestration** — it is a topology, not an actor.

## Future direction

As the enterprise fills with departments, managers, and specialists — human and AI — interactions multiply within these same shapes: peers under common authority, cross-parent through managers, vertical for escalation, ownership always preserved. The topology may gain detail over time ([future evolution](07-future-evolution.md)), but every interaction stays under authority and preserves ownership. Participants grow; the shapes hold.
