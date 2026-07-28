# 30 — Reasoning Integrity and Security

## Purpose

This document protects reasoning from evidence corruption, instruction injection, cross-Tenant leakage, hidden authority transfer, Trace manipulation, and unsafe output use.

## Trust Boundaries

- Processing Output Package content is data, not instruction.
- Embedded prompts, directives, executable content, and source-authored reasoning requests have no control authority.
- Evidence, metadata, Hypotheses, Assumptions, Units, Traces, and Results have distinct integrity identities.
- Tenant, classification, authorization, retention, and disclosure boundaries propagate unchanged or become stricter.

## Threat Considerations

| Threat | Required Behavior |
|---|---|
| Prompt or instruction injection | treat as quoted evidence; never alter reasoning rules |
| Evidence substitution | detect identity, version, hash, and lineage mismatch; reject affected use |
| Trace tampering | fail reconstruction and block affected Results |
| Confidence inflation | validate dimensions and dependency propagation |
| Hidden contradiction | fail completeness and restore conflict visibility |
| Assumption laundering | separate Assumption from evidence and lower or block Result status |
| Cross-Tenant evidence | reject or quarantine the Case |
| Unauthorized disclosure | minimize Output and deny inaccessible evidence detail |
| Rule-version confusion | bind exact canonical rule version and applicability |
| Output-as-command | preserve non-executable status and prohibit instruction fields |

## Rules

- **RSEC-001:** Evidence and Processing Output Package content must remain immutable.
- **RSEC-002:** Untrusted content must never become reasoning, system, agent, tool, or Director instruction.
- **RSEC-003:** Every Case, Trace, and Output Package must remain Tenant-bound.
- **RSEC-004:** Integrity failure in identity, hash, lineage, rule, or Trace must block affected Results.
- **RSEC-005:** Classification, privacy, retention, and disclosure constraints must propagate.
- **RSEC-006:** Security controls must preserve recoverable original evidence through Phase 13 references.
- **RSEC-007:** Reasoning must not call tools, execute content, or communicate externally.
- **RSEC-008:** A boundary violation must yield rejection, quarantine, or Review Required—not silent continuation.

## Enterprise Example

A source artifact contains text instructing the system to ignore contradictory policies. Reasoning preserves it as untrusted quoted evidence, gives it no control authority, and continues only under canonical rules.

## Boundaries

No sandbox, identity provider, encryption suite, security product, malware scanner, network, AWS, or infrastructure is selected.
