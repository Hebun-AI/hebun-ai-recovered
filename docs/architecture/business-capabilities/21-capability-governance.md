# 21 — Capability Governance

## Purpose

Define two required meta-model fields: **Governance Attachment** (how a capability falls under the enterprise governance regime) and **Director Visibility** (how the Director sees the capability). These fields keep every capability governed and visible to the Director, consistent with the whole architecture.

## Core Concepts

### Governance Attachment — the capability falls under one regime
A capability's **Governance Attachment** is the standardized link by which the capability falls under the enterprise-wide, Director-anchored governance regime ([enterprise governance](../enterprise-organization/06-enterprise-governance.md)). Every capability is governed — no capability sits outside the regime, and the meta model requires each to declare its attachment to it. The capability layer defines no new governance; it attaches to the existing one.

### Director Visibility — the Director sees the ability
A capability's **Director Visibility** is the standardized declaration that the capability is visible to the Director — that the enterprise's abilities, their health, value, and dependencies, are surfaced to the apex ([authority model](../enterprise-organization/04-authority-model.md)). The Director sits above the capability model as above everything else; visibility is how the Director's oversight reaches the enterprise's abilities.

### Why capabilities must be governed and visible
- **Governed** — abilities are strategic facts about the company; leaving any ungoverned would create a blind spot in the enterprise's accountability. One regime, no exemptions ([capability principles](02-capability-principles.md)).
- **Visible** — the Director's authority over the enterprise ([authority model](../enterprise-organization/04-authority-model.md)) requires the Director to see what the company can do. Capabilities the Director cannot see cannot be steered.

### Governance attaches; the capability layer holds no authority
Governance Attachment and Director Visibility are *attachments to* the existing governance and authority structures. The capability layer originates no authority and defines no governance ([enterprise thinking](06-enterprise-thinking.md)); it is a model of ability that is *subject to* governance and *visible to* the Director, never a source of either.

### Realization-independent
Both fields describe the *capability's* relationship to governance and the Director, independent of who performs it, how, or which agent. Governance and visibility attach to the ability, not to its realization ([03](03-capability-vs-department.md), [05](05-capability-vs-agent.md)).

## Architecture

- **Governance Attachment field** — the link to the enterprise governance regime.
- **Director Visibility field** — the declaration the capability is surfaced to the Director.
- **Attachment, not origination** — the capability layer subjects itself to governance/authority; it creates neither.
- **Uniformity** — every capability carries both fields; none is exempt or invisible.

## Enterprise Examples

*Illustrative of the fields only — not a capability.*

- Governance Attachment places an ability *under* the one regime; Director Visibility surfaces it *to* the apex. This phase defines the fields; it attaches no actual capability.

## Design Principles

- **Every capability governed and visible.** No exemptions, no blind spots.
- **Attach to existing governance/authority.** Originate neither.
- **Governance and visibility are realization-independent.**

## Boundaries

- Defines **Governance Attachment and Director Visibility fields**, not any capability.
- Redefines **no governance**; originates no authority. No workflow, process, agent, code, UI, prompt, or execution.

## Future Evolution

Later phases attach real capabilities to the governance regime and surface them to the Director through this standardized shape. The fields fixed here keep every future capability governed and Director-visible.
