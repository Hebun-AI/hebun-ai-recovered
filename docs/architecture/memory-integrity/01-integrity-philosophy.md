# 01 — Integrity Philosophy

## Why memory needs integrity

Memory is only valuable if it can be trusted. A memory that might have been silently altered, that lacks a traceable origin, or that points at things which no longer exist is worse than no memory — it is a confident but unreliable account of the past. Integrity is what makes memory *trustworthy*: the guarantee that the recorded past is complete, attributed, immutable, and coherent.

The Phase 6B contracts fix what a memory *is*. The Phase 6A principles state how memory *should behave*. Integrity is the layer that judges whether a **body of memory** — many memories together — actually upholds those guarantees. Individually valid records can still form an untrustworthy history: a fact quietly rewritten, a memory with no owner, a reference into a deleted entity.

Integrity exists to make that impossible.

## Valid memory vs invalid memory

A **valid** body of memory satisfies every integrity invariant: nothing has been rewritten, every memory carries complete provenance, every memory is owned, every reference resolves, the timeline is consistent, and no memory crosses a workspace boundary. Valid memory is memory that reasoning can rely on.

An **invalid** body of memory violates at least one invariant. Invalidity is structural and serious — a single rewritten fact or one missing provenance breaks the guarantees every downstream consumer depends on. Reasoning over invalid memory produces conclusions that look grounded but are not.

The distinction is binary. Memory is not "mostly trustworthy." Either the guarantees hold or they do not.

## What integrity protects

- **Trust in the past.** Integrity is what lets the organization treat memory as an authoritative account rather than a suggestive one. Without it, every remembered fact carries an implicit "probably."
- **Reliable reasoning.** The semantic and retrieval layers (6C) and future reasoning all assume the memory they read is sound. Integrity is what makes that assumption safe — reasoning consumes valid memory, never defends against corrupt memory.
- **Accountability.** Complete provenance and ownership mean every memory can be traced and attributed. Integrity is the precondition for governance: you cannot govern what you cannot trust or trace.
- **Permanence.** The never-rewrite guarantee means the past stays fixed. Integrity enforces that history accumulates rather than mutates — the core promise of memory made checkable.

## Integrity as the counterpart to governance

Integrity and governance are two halves of memory's trustworthiness:

- **Integrity** asks *"is this memory sound?"* — structural correctness: no rewrites, complete provenance, valid references, consistent timeline, workspace isolation.
- **Governance** asks *"is this memory accountable?"* — ownership, retention, compliance, auditability.

Sound but ungoverned memory is unaccountable; governed but unsound memory is untrustworthy. Both are required. This phase defines each and keeps them distinct ([03 — Governance](03-governance.md)).

Integrity is enforced as a guarantee *before* memory is trusted, not repaired after. A future runtime upholds these invariants; it never silently corrects a violation. What integrity states here is the target every implementation must meet — defined now, enforced behind the Director gate.
