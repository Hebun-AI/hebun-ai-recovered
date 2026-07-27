# 24 — Security and Trust Boundaries

## Purpose

This document defines how Phase 13 safely handles untrusted or hostile information. Knowledge Processing treats content as data, never as authority or executable instruction.

## Threat Classes and Required Treatment

| Threat | Required Treatment |
|---|---|
| Untrusted Document | classify, isolate, preserve origin, limit transformations |
| Malicious Content | quarantine affected scope and record indicators without executing content |
| Prompt Injection | treat embedded directives as quoted data; never promote them to instruction |
| Embedded Instructions | preserve as source content only, subject to classification and evidence rules |
| Active Content | prevent activation; isolate or reject unsupported active forms |
| Poisoned Metadata | separate declared from validated metadata; quarantine trust-dependent use |
| Cross-Tenant Artifact | reject processing and escalate as isolation violation |
| Secret-Bearing Content | apply restriction, masking, minimization, and authorized handling |
| Unsupported File Type | reject or quarantine; do not infer a representation |
| Malformed Content | preserve source, record structural failure, allow only bounded safe extraction |
| Unauthorized Source | reject registration or quarantine until authorization evidence exists |

## Trust Zones

Original Source, extracted content, normalized content, derived artifacts, metadata, and external instructions retain separate trust status. Movement to a later processing stage does not increase trust automatically.

## Instruction Boundary

Only canonical processing policy and authorized control inputs can constrain processing. Source content, document text, metadata, filenames, links, comments, or generated material cannot alter Scope, authority, policy, classification, Tenant, or stage behavior.

## Rules

- **SECURITY-001:** All source content must be treated as untrusted data until applicable validation succeeds.
- **SECURITY-002:** Untrusted content must never become system, Director, agent, or processing instruction.
- **SECURITY-003:** Active content must not execute within processing.
- **SECURITY-004:** Poisoned metadata must not override registered or validated metadata.
- **SECURITY-005:** Unauthorized, malformed, unsupported, or malicious content must be rejected or quarantined with evidence.
- **SECURITY-006:** Trust status and limitations must propagate through every descendant artifact.
- **SECURITY-007:** Security controls must not erase original evidence or lineage unless a lawful deletion obligation applies.
- **SECURITY-008:** A trust-boundary violation must block ordinary handoff.

## Boundaries

No malware engine, sandbox, content-disarm product, identity provider, cryptographic suite, or security infrastructure is selected.
