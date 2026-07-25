# Memory Semantics & Retrieval Architecture

## Purpose

This directory defines the **semantic layer of Organizational Memory** — how memories acquire meaning, and where the architectural boundaries of retrieval lie. Phase 6A designed how an organization remembers; Phase 6B fixed the canonical memory objects. This phase (6C) defines how those objects become *meaningful* — how context, time, and grouping turn records into understanding — and draws the line between memory, retrieval, and reasoning.

It is **design only**. It defines semantics, context, timeline architecture, retrieval boundaries, conceptual clustering, the reasoning interface, and future evolution. It defines no retrieval implementation, no vector search, no embeddings, no ranking, no storage, no databases, no APIs, and no algorithms. It modifies no Phase 5, 6A, or 6B artifact.

## Documents

| Document | Covers |
|---|---|
| [01 — Memory Semantics](01-memory-semantics.md) | Why memory needs semantics; data → information → memory → meaning → knowledge → context |
| [02 — Memory Context](02-memory-context.md) | The architectural role of context in interpretation |
| [03 — Memory Timeline](03-memory-timeline.md) | The temporal architecture of memory |
| [04 — Retrieval Boundaries](04-retrieval-boundaries.md) | What retrieval may assume and must not define |
| [05 — Memory Clustering](05-memory-clustering.md) | Conceptual grouping of memories |
| [06 — Reasoning Interface](06-reasoning-interface.md) | How Director Reasoning consumes memory, architecturally |
| [07 — Future Evolution](07-future-evolution.md) | How the semantic layer supports future capabilities |

## Relationship to other phases

- **Phase 5** — the frozen entities and relationship graph. The semantic layer interprets memories that *reference* Phase 5; it never modifies it.
- **Phase 6A** — the memory architecture. This phase deepens the "meaning" and "context" that 6A named, into a full semantic layer.
- **Phase 6B** — the canonical memory objects (Memory, Event, Source, Owner, Context, Reference, Timeline). This phase defines how those objects *acquire meaning*; it adds no new object and modifies none.
- **Future Director Reasoning** — the primary consumer. This phase defines the architectural interface reasoning uses to draw on memory, without defining prompts, APIs, or retrieval logic.
- **Future Memory Runtime** — will implement retrieval within the boundaries this phase draws. Runtime consumes these semantics; it does not redefine them.

## The semantic layer

```
Phase 6B — Canonical Memory Objects   (what memory is)
        │
        ▼
Phase 6C — Semantic Layer             (what memory means)  ← this phase
        │
        ▼
Future Retrieval / Reasoning          (drawing on meaningful memory)
```

The semantic layer sits between the canonical objects and their eventual use. It is where a `Memory` stops being a bare record and becomes an interpretable piece of the organization's understanding.

## Director Gate

This phase defines only the semantic architecture and retrieval boundaries. No retrieval, reasoning, prompts, or APIs. **Phase 6D begins only after explicit Director approval.**
