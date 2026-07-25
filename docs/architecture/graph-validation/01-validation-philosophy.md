# 01 — Validation Philosophy

## Why graph validation exists

The relationship contracts guarantee that each edge is individually well-formed. They do not guarantee that a *collection* of edges forms a coherent organization. A graph can be built entirely from valid relationships and still be nonsense: a department with no organization, a capability with two owners, an edge pointing at a node that does not exist.

Graph validation exists to close that gap. It is the layer that judges the **whole**, not the parts — the conditions under which an assembled graph is a faithful, reasoned-over model of an organization rather than a bag of technically-valid edges.

Without it, every downstream consumer would have to defend itself against malformed graphs. With it, validity is established once, upstream, and everything after can assume it.

## Valid graph vs invalid graph

A **valid graph** satisfies every architectural integrity rule: every node is scoped to one workspace, every edge resolves to real nodes of permitted types, every relationship type is canonical, ownership is unique where required, hierarchies are acyclic and well-typed, and no edge crosses a tenant boundary. A valid graph is a graph that can be reasoned over safely.

An **invalid graph** violates at least one such rule. Invalidity is binary and structural — a graph is not "mostly valid." A single duplicate-ownership edge or one dangling reference makes the graph invalid, because the guarantees downstream consumers rely on no longer hold.

The distinction is architectural, not cosmetic. Validity is the precondition for trust.

## What validation protects

### Architectural integrity

The graph is the canonical model of the organization ([design principle](../relationship-graph/06-design-principles.md)). Integrity means the model's structure obeys its own rules — the shape is sound before anything reads it. Validation is how that integrity is asserted rather than assumed.

### Organizational consistency

An organization has real constraints: one owner per owned thing, acyclic reporting lines, a department that lives inside an organization. Validation encodes these as invariants so the graph cannot represent an organization that could not exist. Consistency means the model never contradicts the reality it describes.

### Reasoning reliability

Impact analysis, dependency analysis, and future reasoning are only as trustworthy as the graph beneath them. A reasoning result computed over an invalid graph is worse than no result — it is a confident wrong answer. Validation is what lets reasoning be relied upon: the analyses run on a graph already proven coherent.

### Future runtime independence

Because validation establishes integrity upstream, runtime does not re-derive it. Runtime consumes a graph it can trust and stays free of defensive integrity logic. This independence is deliberate: validation is a distinct architectural layer, not a responsibility smeared across every runtime path. Runtime depends on validation's guarantees; validation depends on nothing downstream.
