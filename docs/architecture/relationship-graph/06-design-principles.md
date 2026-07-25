# 06 — Design Principles

The rules that keep the Organizational Relationship Graph coherent, reasoned over safely, and stable as it grows. These are binding architecture constraints, not preferences. Any implementation behind the Director gate must uphold them.

## 1. The graph is canonical

There is one graph. It is the authoritative model of how organizational entities relate. No component maintains a private, parallel set of relationships. If two parts of the platform disagree about a relationship, the graph is right.

## 2. Relationships are explicit

Every relationship is a named, typed, directed edge — never implied by naming conventions, co-location, or shared attributes. If a relationship matters, it is an edge. Inference happens *over* explicit edges, never in place of them.

## 3. No duplicated ownership

Each owned node has exactly one `owns` edge into it. Ownership is single-sourced. Support, responsibility, and use may be many-to-many, but authoritative ownership is singular — this is what makes impact analysis complete and non-contradictory.

## 4. Relationships are stated once

An edge is recorded in one direction, not mirrored on both endpoints. `belongs_to` and its inverse `contains` describe the same fact; only one is stored. Symmetric relationships (`collaborates_with`) are stored with a canonical endpoint ordering so they too are single-stated.

## 5. Cycles only where intentional

The structural and accountability hierarchies — `contains`, `parent_of`, `reports_to`, `depends_on` — are acyclic. A cycle in any of them is an error and must be detectable. Cycles are permitted only where explicitly intended and documented (e.g. symmetric `collaborates_with`), never by accident.

## 6. Traversal is deterministic

A traversal defined by a start node, direction, and edge filter yields the same result every time. Ordering is stable. No traversal result depends on insertion order, timing, or hidden state. Determinism is what makes impact analysis trustworthy and reproducible.

## 7. Relationship names are stable

The relationship vocabulary is a canonical contract. Names do not change meaning once ratified. A relationship type is added deliberately and deprecated deliberately; it is never silently repurposed. Renames are explicit migrations, recorded — consistent with the lifecycle rule that architecture decisions are permanent records.

## 8. All graph changes are auditable

Every edge carries provenance and lifecycle, exactly as the Phase 5A contracts model — who created it, when, from what source. The history of a relationship is recoverable. No edge appears, changes, or disappears without a trace.

## 9. Nodes are inert

Nodes hold declarative data and act as endpoints. They carry no traversal logic, no behavior, no execution. All graph behavior lives in the traversal and reasoning layers above the nodes — the nodes themselves remain pure Phase 5A contracts.

## 10. The graph reasons, it does not act

The graph and its analyses are read-and-report. Impact and dependency analysis surface consequences; they never enact them. Acting on graph reasoning is the job of higher capabilities, each behind its own gate. The graph informs decisions; it does not make or execute them.

## 11. Workspace is the hard boundary

No edge crosses a workspace. Reachability is total within a workspace and zero across workspaces. Tenant isolation is absolute and enforced at the graph level, not merely at query time.
