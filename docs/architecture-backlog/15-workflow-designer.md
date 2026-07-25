# 15 — Workflow Designer

**Priority:** Medium
**Status:** Planned

## Purpose

A visual orchestration builder. Lets operators compose enterprise workflows across the platform's building blocks without writing code.

## Produces

Enterprise workflows connecting:

- Agents
- Departments
- Tools
- Approvals
- Runtime

## Architectural notes

The Designer is an authoring surface that emits a declarative workflow definition. It draws and validates; it does not execute. Execution is the runtime's job — the Designer hands runtime a definition to run.

A designed workflow is inert data: nodes, edges, and approval gates referencing agents, tools, and departments by canonical id. The Designer sits at the presentation edge and depends on runtime and the registries, never the reverse.

## Dependencies

- [11 — Agent Registry](11-agent-registry.md) and [12 — Tool Registry](12-tool-registry.md) — the blocks to connect
- Organizational Intelligence — department and approval references
- Director Runtime — executor of the emitted definition

## Promotion criteria

- Workflow definition specified as a declarative, executable-by-runtime artifact.
- Registries available to populate selectable blocks.
- Authoring/execution boundary clear — Designer emits, runtime runs.
- Director approval.
