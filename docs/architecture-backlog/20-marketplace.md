# 20 — Marketplace

**Priority:** Medium
**Status:** Planned

## Purpose

A future ecosystem. A distribution surface where agents, tools, and prepackaged solutions can be published, discovered, and installed into a workspace.

## Supports

- Agent Marketplace
- Tool Marketplace
- Industry Packages
- Enterprise Templates

## Architectural notes

The Marketplace is a distribution and installation layer built on top of the registries, not a parallel one. Publishing lists an entry; installing registers it through the Agent or Tool Registry under workspace scope and the platform's permission and policy gates.

It distributes descriptors, not privileges. Every installed item still passes permission, policy, and provider boundaries — the Marketplace grants no bypass. Industry packages and templates are declarative bundles that instantiate through existing capabilities (playbooks, workflows), never around them.

## Dependencies

- [11 — Agent Registry](11-agent-registry.md) and [12 — Tool Registry](12-tool-registry.md) — where installs land
- [13 — Policy Engine](13-policy-engine.md) and [14 — Permission Engine](14-permission-engine.md) — install-time gates
- [08 — AI Transformation Playbook Engine](08-ai-transformation-playbook-engine.md) — industry packages and templates

## Promotion criteria

- Registries and governance engines operational as the install path.
- Publish/install boundary defined — distributes descriptors, grants no privilege bypass.
- Workspace-scoped installation model specified.
- Director approval.
