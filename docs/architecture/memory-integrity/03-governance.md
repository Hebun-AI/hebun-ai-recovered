# 03 — Governance

Where integrity keeps memory *sound*, governance keeps it *accountable*. This document defines the governance architecture of Organizational Memory — how memory is owned, retained, audited, and held to obligation over its life. Architecture only; no implementation.

Governance nodes and engines (Policy, Permission) are future capabilities; the principles here define how memory must be shaped so those capabilities attach cleanly.

## Ownership governance

Every memory is owned by a Phase 5 entity ([integrity rule 4](02-integrity-rules.md)). Governance builds on that: ownership carries **stewardship** — accountability for a memory's scope, retention, and appropriate use. Ownership can be organizational (a unit, a role) but never personal in a way that lets memory leave with an individual; memory belongs to the organization and survives personnel change ([Phase 6A principle](../memory/04-memory-principles.md)). Governance ensures every memory has a clear, durable line of accountability.

## Access governance

Not every memory is visible to every actor. Governance defines that access to memory is **scoped and permissioned** — bounded by workspace absolutely, and within a workspace by the permission model. Sensitive memory (financial, compliance, personnel) is governed more tightly. Access governance composes with the future [Permission Engine](../../architecture-backlog/14-permission-engine.md): permission decides *who may read* a memory; governance ensures memory carries what permission needs to decide.

## Retention governance

Memory is append-first and preserves history, but governance defines **retention policy** — how long categories of memory are held, and the deliberate, governed process for any archival. Retention is never silent deletion (which would violate integrity); it is an explicit, owned, auditable decision about the lifecycle of a memory category. Where legal obligation requires retention or expiry, governance is where that obligation binds.

## Compliance governance

Memory is often the **evidence** of compliance — the record that an obligation was met. Governance ensures memory can demonstrate conformance: compliance-relevant memory is owned, retained per obligation, and auditable. Data-residency and regulatory constraints bind memory through governance and the workspace boundary. Compliance governance composes with the future [Policy Engine](../../architecture-backlog/13-policy-engine.md).

## Auditability governance

Every memory carries provenance ([integrity rule 3](02-integrity-rules.md)); governance makes the whole body **auditable** — the history of what was remembered, by whom, when, and how it evolved through supersession is recoverable. Auditability is what lets the organization answer, credibly, *"what did we know and when did we know it."* An unauditable memory body cannot be governed, because its accountability cannot be traced.

## AI-memory governance

AI-generated memory ([Phase 6A category](../memory/03-memory-categories.md)) is first-class but governed distinctly. Governance ensures AI memory is **clearly attributed** — its `MemorySource` marks it as agent-produced, its classification recorded — so the organization can weigh it appropriately and never mistake an agent's conclusion for an established fact. Autonomous agents may produce memory within their gates; governance keeps that production attributed, owned, and bounded.

## Governance across evolution

Governance applies **across change**, not just at a point in time. As memory grows and supersedes, governance invariants must continue to hold: no evolution should orphan accountability, break auditability, or violate retention obligation. Governance is checked on the memory body after change, not only on the change in isolation — the organization's memory stays accountable as it accumulates.

---

Governance is architectural: it defines the accountable shape memory must keep. The engines that will enforce these guarantees — [Policy](../../architecture-backlog/13-policy-engine.md), [Permission](../../architecture-backlog/14-permission-engine.md) — are separate, gated capabilities. This phase specifies the conditions; it builds none of them.
