# 11 — Agent Registry

**Priority:** High
**Status:** Planned

## Purpose

A central registry for every AI Agent in the platform. The authoritative record of which agents exist, what they can do, who owns them, and whether they are healthy.

## Responsibilities

- Registration
- Discovery
- Versioning
- Health
- Ownership
- Permissions
- Capabilities
- Dependencies

## Architectural notes

A system-of-record, not an execution layer. The registry describes agents; it does not run them. Runtime consults the registry to discover and resolve agents; the registry never invokes runtime.

Agent descriptors are declarative and versioned, keyed to the AI Agent canonical contract and the organizational graph. Permission and capability data here is metadata — enforcement lives in the Permission Engine and runtime.

## Dependencies

- Organizational Intelligence canonical contracts — AI Agent and Capability shapes
- [14 — Permission Engine](14-permission-engine.md) — authorization enforcement
- Director Runtime — the consumer that discovers agents

## Promotion criteria

- AI Agent canonical contract stable as the registry's record shape.
- Discovery interface defined; registry is read-authoritative, non-executing.
- Ownership, versioning, and health fields specified.
- Director approval.
