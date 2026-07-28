# 19 — Context Boundaries

## Purpose

This document defines qualification, isolation, minimization, lifecycle, and prohibited use of Context in Query Intelligence.

## Qualification Controls

Every Context reference is assessed for class, origin, Tenant, Scope, relevance, provenance, version, lifecycle, time, classification, authorization, privacy, uncertainty, and expiry.

Context classes remain isolated: Query, Canonical Reference, Processing Reference, Historical Reference, Organizational Reference, Authority Reference, and Conversation Context. A reference may link to evidence held upstream but does not become evidence in Query Intelligence.

## Prohibited Context Use

Context must not:

- supply missing evidence or authority;
- silently broaden Intent, Objective, or Scope;
- become canonical truth or unrestricted memory;
- include unrelated conversation;
- override ambiguity or constraints;
- cross Tenant or disclosure boundaries;
- carry prompts, tool instructions, or execution semantics.

## Rules

- **CBOUND-001:** Context qualification must precede use.
- **CBOUND-002:** Context and Evidence must remain distinct in identity, lifecycle, and authority.
- **CBOUND-003:** Context must be minimized to the declared Query purpose.
- **CBOUND-004:** Missing or invalid Context must remain explicit.
- **CBOUND-005:** Context expiry or change requires affected qualification revalidation.
- **CBOUND-006:** Cross-Tenant and unauthorized Context must be rejected or quarantined.
- **CBOUND-007:** Context must not mutate upstream packages or downstream reasoning.

## Enterprise Example

Conversation Context names a prior capability but provides no version. It can preserve the referent candidate, but cannot supply canonical version evidence; the version remains missing.

## Boundaries

No context store, memory layer, retrieval, session implementation, vector database, or prompt window is defined.
