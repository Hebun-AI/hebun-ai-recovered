# 29 — Query Integrity and Security

## Purpose

This document protects Query Intelligence from hostile content, instruction injection, identity substitution, Context poisoning, Scope manipulation, Trace tampering, Tenant leakage, and unsafe package semantics.

## Threat Considerations

| Threat | Required Behavior |
|---|---|
| Prompt or instruction injection | treat as Query data; never change canonical qualification rules |
| Query identity substitution | detect identity and origin mismatch; reject affected Case |
| Context poisoning | separate declared from qualified Context; reject unsafe use |
| Scope manipulation | preserve original Scope claims and block silent expansion |
| Constraint removal | retain source constraints and Trace every transformation |
| Ambiguity suppression | fail readiness when material ambiguity is hidden |
| Cross-Tenant content | reject or quarantine without disclosure |
| Malformed or unsupported input | preserve safely, reject or require clarification |
| Package-binding substitution | verify Processing Output Package identity, version, hash, Tenant, and status |
| Trace tampering | fail reconstruction and block readiness |
| Output-as-command | prohibit execution, prompt, SQL, and tool semantics |

## Rules

- **QSEC-001:** Query and Context content must be treated as untrusted data.
- **QSEC-002:** Untrusted content must never become system, Director, agent, tool, or Runtime instruction.
- **QSEC-003:** Original Query, transformations, Trace, and package binding require integrity validation.
- **QSEC-004:** Tenant, classification, privacy, retention, and disclosure constraints must propagate.
- **QSEC-005:** Integrity failure must yield rejection, quarantine, clarification, or blocked readiness.
- **QSEC-006:** Request Packages must contain no executable or externally actionable semantics.
- **QSEC-007:** Security controls must preserve original Query recoverability and authorized review.
- **QSEC-008:** Query Intelligence must not call tools, retrieve data, or communicate externally.

## Enterprise Example

A system Query includes metadata claiming a different Tenant and an instruction to ignore Scope limits. Admission rejects the Tenant mismatch and treats the instruction as untrusted content.

## Boundaries

No sandbox, malware engine, identity provider, cryptographic suite, network, AWS, or security infrastructure is selected.
