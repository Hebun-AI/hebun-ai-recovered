# 05 — Workspace Boundaries

## Why Workspace is the highest security boundary

A Workspace is a tenant. Everything a customer's organization contains — its structure, people, agents, capabilities, relationships — lives inside one workspace. The boundary around it is the strongest guarantee the platform makes: what is in one workspace is invisible and unreachable from another.

This is the **highest** boundary because it sits above every other rule. Ownership, hierarchy, and governance all operate *within* a workspace; the workspace boundary contains them all. A breach of workspace isolation is categorically worse than any intra-workspace inconsistency — it is a tenant leak, not a modeling error.

Phase 5A already encoded this: `WorkspaceScope` is a hard, terminal boundary with no parent and no reference to another workspace. Validation enforces at the graph level what that contract asserts at the node level.

## Cross-workspace references

The default is absolute: **no edge crosses a workspace boundary.** Both endpoints of every relationship share one workspace ([integrity rule 7](02-integrity-rules.md)). A cross-workspace edge is invalid on its face — it is the graph-level signature of a tenant leak.

This holds regardless of how convenient a cross-tenant link might seem. Convenience never overrides isolation.

## Shared services

Some platform services are common to all tenants — the provider layer, registries, governance engines. These are **platform-level**, not tenant nodes. A workspace does not hold an edge into another workspace to reach a shared service; it reaches the service through the platform, which is outside any single workspace's graph.

Architecturally: shared services are consumed *beside* the graph, not represented *as cross-tenant edges within* it. Isolation is preserved because no tenant graph references another tenant.

## Shared tooling

Tools (the [Tool Registry](../../architecture-backlog/12-tool-registry.md)) may be available to many tenants, but each tenant's *use* of a tool is scoped to its own workspace. A tenant's `uses` edge targets a tool reference within its own scope, not a shared node another tenant also points at. The tool catalog is platform-level; each tenant's relationship to it is workspace-local. Shared availability never becomes a shared edge.

## Future federation

Federation — deliberate, governed sharing across workspaces — is the **only** conceivable exception, and it is explicit by construction. It is not an exception to isolation; it is a separately-defined, narrowly-scoped, governed relationship that the platform would have to sanction node by node.

Until federation is designed and approved as its own capability, it does not exist. No graph relies on it. The default remains total prohibition, and any federation edge would be individually declared, individually governed, and auditable — never an implicit softening of the boundary.

## Tenant isolation

Tenant isolation is the sum of the above: every node scoped to one workspace, every edge within one workspace, shared services and tooling consumed at the platform level rather than through cross-tenant edges, and federation permitted only as an explicit, governed exception. Isolation is enforced at the graph level, not merely assumed at query time — an invalid cross-tenant edge is rejected as a validity failure, before any runtime ever reads it.
