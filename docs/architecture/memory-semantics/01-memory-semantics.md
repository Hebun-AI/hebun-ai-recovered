# 01 — Memory Semantics

## Why memory requires semantics

A memory that cannot be *understood* is a record, not a memory. The canonical objects of Phase 6B fix what a memory **is** — its event, source, owner, context, references, place on a timeline. Semantics is the layer that makes a memory **mean something** to whatever reads it later.

Without semantics, memory degrades into a pile of accurate but inert records. "Decision X, by role Y, on date Z" is retrievable, but retrieving it is not the same as understanding what it meant, why it mattered, or when it is relevant now. Semantics is the difference between *having* the record and *understanding* it.

Reasoning needs the latter. An organization reasons over meaning, not over raw rows.

## Data → Information → Memory → Meaning → Knowledge → Context

These are distinct layers. Phase 6A traced data → knowledge → memory → experience → wisdom as the *value progression*; here the concern is the **semantic progression** — how a record becomes understanding.

### Data

Raw, uninterpreted facts. A value with no frame. Data answers nothing on its own.

### Information

Data with structure — organized, labeled, placed in relation. Information is data made legible: it can be read, but it does not yet carry the weight of having happened.

### Memory

Information with **time and provenance** — a durable record of something that occurred, owned and attributed. Memory is the Phase 6B `Memory` object: the retained trace. It is legible and durable, but not yet interpreted.

### Meaning

Memory understood **in its context**. Meaning is what a memory signifies once its surrounding circumstances are applied — the decision read together with the situation that produced it. A memory without meaning is a fact; with meaning it becomes a lesson, a precedent, a signal. Meaning is where semantics begins.

### Knowledge

Meaning generalized across memories. When many meaningful memories are read together, stable understanding emerges — what is true, what tends to hold. Knowledge is the settled understanding that meaningful memories accumulate into.

### Context

The frame that determines *which* meaning applies and *when* it is relevant. Context is not a layer above knowledge so much as the lens across all of them — the same memory means different things in different contexts. Context is what makes semantics situational rather than fixed ([02 — Memory Context](02-memory-context.md)).

**The pivot is meaning.** Below it (data, information, memory) records are legible but inert. At and above it (meaning, knowledge, under context) records become understanding that reasoning can use. The semantic layer designed in this phase is what carries memory across that pivot.

## Why reasoning depends on semantic understanding, not raw records

Reasoning that operated on raw records would be brittle and shallow:

- **Raw records answer "what was stored"; semantics answers "what it means."** Reasoning needs the second — the significance of a memory, not merely its presence.
- **Relevance is semantic, not literal.** Whether a past decision bears on a current one is a question of meaning and context, not of matching fields. Only a semantic layer can surface *relevant* memory rather than merely *matching* memory.
- **Meaning depends on context, which raw records do not carry alone.** The same memory means different things depending on when and where it is read. Semantics applies context; raw retrieval cannot.
- **Understanding compounds; records accumulate.** Semantics lets memories combine into knowledge and experience. Raw records just pile up. The organization's ability to *learn* lives in the semantic layer, not the record store.

The semantic layer is therefore an **architectural necessity**, not a convenience. It is what makes the organization's memory reasonable-over rather than merely searchable. This phase defines that layer; it does not implement how meaning is computed or retrieved — those are downstream, behind the Director gate.
