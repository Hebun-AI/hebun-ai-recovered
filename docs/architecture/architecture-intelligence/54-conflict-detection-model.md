# 54 — Conflict Detection Model

## Definition

**Conflict Detection** is the read-only identification and classification of claims, rules, relationships, authorities, or observations that cannot safely be treated as simultaneously compatible within a resolved scope.

Conflict Detection preserves alternatives and evidence. It does not decide which normative position should prevail.

## Conflict Record

A conflict record must identify:

- conflict type and affected scope;
- each conflicting claim or condition;
- source identity, evidence, provenance, authority, lifecycle, and version;
- detection rationale;
- potential architectural impact;
- severity;
- known uncertainty;
- required escalation;
- resolution authority.

## Conflict Types

| Type | Detection | Severity | Escalation | Resolution Authority |
|---|---|---|---|---|
| **Canonical Conflict** | Two applicable canonical statements impose incompatible meanings, rules, boundaries, or outcomes | Critical when normative action cannot proceed; otherwise High | Mandatory Director escalation with source owners identified | Director through governed architecture decision and canonical lifecycle |
| **Authority Conflict** | Sources or actors assert incompatible decision rights, approvals, or precedence | Critical when authority cannot be established; otherwise High | Mandatory Director escalation; no conclusion may claim authority | Director or explicitly governing enterprise authority |
| **Evidence Conflict** | Traceable evidence supports materially incompatible findings or a source contradicts its derived representation | High when conclusion changes; Moderate when localized | Escalate when material; otherwise retain as an explicit finding | Canonical source owner for source defects; Director for architectural interpretation |
| **Terminology Conflict** | The same term has incompatible meanings, or different terms ambiguously claim one identity in the same scope | High when normative meaning changes; otherwise Moderate | Escalate if identity or rule interpretation is affected | Director with relevant architecture ownership |
| **Relationship Conflict** | Relationship type, direction, endpoint, scope, lifecycle, or cardinal meaning is incompatible | High for governing dependencies or prohibitions; otherwise Moderate | Escalate material semantic conflicts | Director for normative relationship meaning; source owner for representational correction |
| **Runtime Conflict** | Runtime observation appears inconsistent with approved architecture or multiple operational observations disagree materially | High for possible governed breach; otherwise Moderate or informational | Escalate architecture implications to Director; operational handling remains outside this phase | Director for architecture judgment; authorized Runtime governance for operational resolution |
| **Unknown Conflict** | Incompatibility is evident but type, scope, evidence, or authority cannot yet be resolved | Indeterminate and treated as potentially material | Mandatory clarification or Director escalation before a conclusive result | Director assigns or identifies the proper resolution authority |

Severity is a governance qualification, not a numerical score. It reflects potential effect on authority, normative meaning, safety of a conclusion, and breadth of architectural impact.

## Detection Principles

1. Compare only within an explicitly resolved scope while retaining cross-scope differences.
2. Check lifecycle and version before declaring conflict.
3. Do not treat a derived representation mismatch as an automatic canonical conflict.
4. Do not treat Runtime variance as proof that architecture is wrong.
5. Do not treat newer, more frequent, or more confident claims as more authoritative.
6. Preserve all material evidence and explain the incompatibility.
7. Distinguish missing information from demonstrated contradiction.
8. Allow multiple conflict types when each is independently supported.
9. Never reduce confidence to hide a conflict; report both.
10. Escalate whenever normative resolution or authority assignment is required.

## Conflict Detection Is Not Resolution

Detection may identify a likely controlling canonical statement, but it cannot silently discard a conflicting approved statement. Normalization cannot rewrite either position. Confidence assessment cannot select a winner. Governance validation cannot waive the conflict.

Resolution requires the authority declared by the applicable architecture governance model. Any resulting canonical change must follow its own lifecycle; it is not an output of this pipeline.

## Enterprise Example

An approved capability rule states that Runtime replacement does not change Capability identity, while another currently approved document implies a new Capability is created for each Runtime. The pipeline records a Canonical and Terminology Conflict, preserves both sources and versions, marks the finding as material, and escalates it. It does not amend either document or choose the preferred statement.

## Boundaries

This model does not define automated remediation, document editing, voting, conflict-resolution workflows, Runtime incident response, or execution blocking mechanisms. It defines architectural detection, classification, evidence preservation, and escalation only.

