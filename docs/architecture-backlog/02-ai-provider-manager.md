# 02 — AI Provider Manager

**Priority:** High
**Status:** Planned

## Purpose

A provider abstraction layer between the Director and any model vendor.

Support:

- OpenAI
- Claude
- AWS Bedrock
- Azure OpenAI
- Google Vertex AI
- Future providers

## Core rule

The Director must never depend directly on a model provider.

Every model call passes through this layer. Swapping, adding, or retiring a provider is a configuration change, not a code change in the Director.

## Architectural notes

The manager owns provider selection, credential handling, request shaping, and response normalization. Above it, callers see one neutral interface; below it, vendor SDKs stay isolated.

This is the inversion point that keeps every other backlog item vendor-neutral. Research, Consultant, Brief Generator, Guide — all reach models through here, never around it.

Dependency direction is one-way: capabilities depend on the manager; the manager depends on no capability and never on the Director core.

## Dependencies

- None upstream. This is foundational — most other items depend on it.

## Promotion criteria

- Neutral provider interface defined and frozen.
- No caller retains a direct vendor import.
- Credential and configuration boundary isolated from application code.
- Director approval.
