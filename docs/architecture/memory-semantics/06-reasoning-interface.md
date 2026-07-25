# 06 — Reasoning Interface

How Director Reasoning will consume Organizational Memory — **architecturally only**. No prompts, no APIs, no retrieval logic, no runtime. This document fixes the *interaction shape* between reasoning and memory, and the boundary between them.

Reasoning is the primary consumer of the semantic layer. Defining this interface at the architecture level ensures reasoning and memory stay cleanly separated as both evolve.

## The interaction, in one line

**Reasoning reads meaningful memory; memory supplies the past; judgment stays with reasoning.**

```
Memory (canonical, semantic)  ──surfaced by──►  Retrieval
                                                   │ relevant, meaningful memory
                                                   ▼
                                              Reasoning  ──forms──►  judgment
```

Reasoning does not reach into storage. It consumes memory that the semantic and retrieval layers have already made meaningful and relevant. The arrow is one-directional: reasoning depends on memory; memory does not depend on reasoning.

## What reasoning consumes

At the architectural level, reasoning draws on memory in these forms — each already defined in prior phases, not invented here:

- **Individual memories** — a specific past decision, event, or observation, read with its context ([02](02-memory-context.md)).
- **Timelines and sequences** — how something unfolded over time ([03](03-memory-timeline.md)), so reasoning can infer cause and lesson.
- **Clusters** — the coherent group around a customer, project, or decision history ([05](05-memory-clustering.md)), so reasoning sees the whole story, not isolated points.
- **Context** — the frames that determine which memory is relevant to the current question.

Reasoning consumes these as *meaningful* memory — the semantic layer's output — never as raw records.

## What reasoning does not do to memory

The boundary is strict:

- **Reasoning does not rewrite memory.** It reads the past; it never edits it. Never-rewrite-facts holds.
- **Reasoning does not retrieve directly from storage.** It consumes what retrieval surfaces, within retrieval's boundaries ([04](04-retrieval-boundaries.md)).
- **Reasoning does not define what memory is.** The canonical objects (6B) are fixed; reasoning interprets them, it does not redefine them.

Reasoning *may* produce new memories — its conclusions can be recorded as AI-generated memory, through their own `MemorySource` and provenance. But that is *creating new memory*, additively, never rewriting existing memory. The read-and-append asymmetry holds: reasoning reads the past freely and may add to it, but never alters it.

## Why the interface is architectural, not implemented here

- **Reasoning must be able to evolve.** How the Director reasons — the prompts, the models, the logic — will change. Fixing that here would freeze it prematurely.
- **Memory must stay independent of any one reasoner.** Memory is a shared substrate for many consumers ([07](07-future-evolution.md)); it cannot be shaped around a single reasoning implementation.
- **The boundary is the stable part.** What is fixed now is the *relationship*: reasoning consumes meaningful memory, read-only, and may append but never rewrite. The mechanism on either side stays free to change.

## What this document does not define

- No prompts, prompt structure, or reasoning strategy.
- No API, endpoint, or protocol between reasoning and memory.
- No retrieval logic, ranking, or selection mechanism.
- No runtime behavior.

Those are downstream, behind the Director gate. This document fixes only the architectural interaction: **reasoning consumes meaningful memory as a read substrate, forms judgment itself, and may append new memory but never rewrites the past.**
