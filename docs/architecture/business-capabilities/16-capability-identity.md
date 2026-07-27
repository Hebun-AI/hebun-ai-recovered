# 16 — Capability Identity

## Purpose

Define two required fields of the meta model: **Identity** (the stable name and definition of an ability) and **Purpose** (why the ability exists). Together they answer "what is this capability, and why does it exist?" — the anchor every other field hangs from.

## Core Concepts

### Identity — the stable anchor
A capability's **Identity** is its durable name plus a definition of the ability, at the ability level ([what is a capability](01-what-is-a-business-capability.md)). Identity is what stays constant while realization churns: the same identity persists across reorgs, process rewrites, and agent swaps. It is the node's permanent handle in the taxonomy.

### Purpose — the intent behind the ability
A capability's **Purpose** states *why* the enterprise has this ability — the intent it serves. Purpose is not a task or a goal-of-the-quarter; it is the standing reason the ability exists. It gives the capability meaning beyond its name and grounds later reasoning about whether the ability is worth its cost.

### Identity is singular and stable
- **Singular** — one identity names one ability; no two capabilities share an identity, and one capability does not carry two identities ([capability principles](02-capability-principles.md)).
- **Stable** — identity changes only under deliberate evolution ([meta-model design rules](22-meta-model-design-rules.md)), never with routine churn. A capability that keeps changing its identity is not yet a capability.

### Identity is realization-independent
Identity and Purpose are stated without reference to who performs, how, or which agent runs it. If the identity would change when the department, process, or agent changes, it is mis-defined ([03](03-capability-vs-department.md), [04](04-capability-vs-process.md), [05](05-capability-vs-agent.md)).

## Architecture

- **Identity field** — stable name + ability-level definition.
- **Purpose field** — the standing intent of the ability.
- **Uniqueness constraint** — identity is unique across the taxonomy.
- **Stability binding** — identity changes only via evolution rules.

Identity is the primary key of a capability record; every other meta-model field describes the ability this identity names.

## Enterprise Examples

*Illustrative of the fields only — not a capability.*

- Identity is the *durable handle* an ability keeps across years of change; Purpose is the *standing reason* it exists. This phase defines the fields; it fills in no actual identity or purpose (no Marketing/Sales/Finance/HR capability).

## Design Principles

- **One identity, one ability.** Singular and unique.
- **State intent, not tasks.** Purpose is a standing reason, not a goal-of-the-moment.
- **Identity is realization-independent.** It survives who/how/which.

## Boundaries

- Defines **Identity and Purpose fields**, not any capability.
- No KPI, workflow, process, agent, code, UI, prompt, or execution.

## Future Evolution

Later phases assign real identities and purposes to real capabilities, under the uniqueness and stability constraints fixed here. Identity remains the permanent anchor; Purpose remains the standing intent.
