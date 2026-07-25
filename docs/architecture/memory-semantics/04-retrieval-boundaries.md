# 04 — Retrieval Boundaries

Retrieval is how meaningful memory is surfaced when needed. This document draws its **architectural boundaries** — what retrieval may assume, what it must not define, and how responsibility divides between memory, retrieval, reasoning, learning, and storage. It defines no retrieval mechanism: no vector search, no ranking, no algorithm.

Boundaries matter because retrieval sits at the crossing point of several layers. A retrieval that overreached — redefining what memory is, or making reasoning judgments — would collapse the separation the architecture depends on.

## What retrieval MAY assume

Retrieval is entitled to rely on the guarantees the layers beneath it provide:

- **That memory is canonical and valid.** Retrieval consumes Phase 6B memory objects as defined; it does not re-validate or reinterpret what a memory *is*.
- **That memories carry context and provenance.** Retrieval may use the context dimensions ([02](02-memory-context.md)) and timeline position ([03](03-memory-timeline.md)) as given, to find relevant memory.
- **That memory is workspace-scoped.** Retrieval operates within one workspace and may assume the tenant boundary holds — it never reaches across workspaces.
- **That meaning already exists in the semantic layer.** Retrieval surfaces meaningful memory; it does not manufacture meaning. The semantics are upstream of retrieval.

## What retrieval MUST NOT define

Retrieval stays within its lane. It must not:

- **Redefine what memory is.** The canonical objects (6B) are fixed; retrieval consumes them, never alters their meaning.
- **Make reasoning judgments.** Deciding what a set of memories *implies* is reasoning's job. Retrieval surfaces candidates; it does not conclude.
- **Rewrite or mutate memory.** Retrieval is read-only. It never edits, reorders, or supersedes a memory — append-first and never-rewrite hold absolutely.
- **Define storage or its own persistence model.** How memory is stored is a separate concern; retrieval assumes access, it does not design the store.
- **Cross the tenant boundary.** No retrieval spans workspaces, regardless of convenience.

## Separation of responsibilities

Five distinct layers, each with a bounded responsibility:

| Layer | Responsibility | Does not |
|---|---|---|
| **Memory** | Be the canonical, durable record of the past (6B objects, 6A principles). | Retrieve, reason, or persist itself. |
| **Retrieval** | Surface relevant memory when asked, read-only, within a workspace. | Define memory, reason, or design storage. |
| **Reasoning** | Interpret surfaced memory to form judgments ([06](06-reasoning-interface.md)). | Store, retrieve, or rewrite memory. |
| **Learning** | Distill patterns across memory over time. | Own the record; it reads, never rewrites. |
| **Storage** | Persist and make memory accessible. | Define meaning, relevance, or reasoning. |

Each layer depends downward and never usurps another's responsibility. Retrieval reads what Memory holds and Storage keeps; Reasoning and Learning read what Retrieval surfaces; none rewrites Memory.

## Why the boundaries are architectural

- **Memory stays trustworthy** because retrieval and reasoning cannot mutate it.
- **Reasoning stays sound** because it receives surfaced memory, not raw storage, and is not entangled with retrieval mechanics.
- **Retrieval stays replaceable** because it defines nothing above or below it — its mechanism can evolve (a future concern) without disturbing memory's meaning or reasoning's logic.
- **Storage stays independent** because no layer above binds to a particular persistence model — memory is technology-independent (6B principle).

Keeping these boundaries sharp is what lets each layer evolve on its own. This document fixes the boundaries; it specifies no retrieval implementation, which is a downstream phase behind the Director gate.
