# 08 — Document Structure and Sections

## Definition

**Document Structure** is the semantic organization of architectural content. A **Semantic Section** classifies content by architectural purpose independently of heading text, visual order, formatting level, or physical location.

The canonical section vocabulary is **Purpose, Scope, Definition, Mental Model, Architecture, Principles, Rules, Invariants, Boundaries, Authority, Evidence, Examples, Design Notes, References, and Closure**.

A heading is not a Semantic Section. A heading is a presentation element that may signal one; meaning requires supported classification. Visual order is not authority.

## Why

Architecture documents use varied headings and layouts. If ingestion treats strings or order as meaning, equivalent concepts fragment and prominent prose gains authority it does not possess. Semantic sections provide a stable reading model while preserving human-readable structure.

## Mental Model

```text
Presentation Layer              Semantic Layer
"What this establishes"   →     Purpose
"Out of scope"            →     Boundaries
"Non-negotiable truths"   →     Invariants

heading and order                architectural role
do not confer authority          evaluated with evidence
```

## Core Components

- **Purpose** states why the document exists.
- **Scope** declares applicability.
- **Definition** establishes canonical meaning.
- **Mental Model** offers a bounded conceptual aid, non-normative by default.
- **Architecture** describes structural responsibilities and relationships.
- **Principles** guide architectural judgment.
- **Rules** state mandatory or prohibited conditions.
- **Invariants** remain true across permitted change.
- **Boundaries** declare inclusions, exclusions, and separations.
- **Authority** identifies decision rights and normative basis.
- **Evidence** supplies verifiable support and provenance.
- **Examples** illustrate without extending a rule.
- **Design Notes** explain rationale or implications.
- **References** connect governed objects.
- **Closure** records disposition without inventing approval.

## Principles

1. Classification must be evidence-based and reproducible.
2. Heading names may vary without changing a supported role.
3. Identical headings need not have identical roles across documents.
4. Order, depth, typography, and emphasis must not establish authority.
5. Explanatory sections must not silently gain normative force.
6. Rules and invariants must remain identifiable within explanation.
7. Ambiguous or mixed roles must remain visible until canonically resolved.
8. Missing sections must not be synthesized.
9. Semantic structure must preserve evidence location.

## Enterprise Example

One Approved document uses “Guardrails” for mandatory boundaries; another uses “Boundaries.” Both may map to the Boundaries role when content and governance evidence support it. A bold Example placed first remains illustrative and does not outrank an Approved Rule appearing later.

## Design Notes

- The vocabulary establishes roles, not a required template.
- Section classification does not decide every contained statement's authority.
- Closure must be evaluated with approval metadata; a “complete” heading is insufficient.
- Mental models, examples, and notes may explain but cannot modify norms.
- No heading parser, classifier, markup convention, or renderer is defined.

## Common Mistakes

- Mapping sections only by exact heading text.
- Treating the first or largest section as most authoritative.
- Assuming every bullet under “Principles” is a Principle statement.
- Converting examples or mental models into rules.
- Filling absent sections with generated content.
- Losing source location while normalizing names.

## Related Architecture

- [07 — Architecture Document Model](07-architecture-document-model.md)
- [09 — Normative Statement Model](09-normative-statement-model.md)
- [02 — Ingestion Principles](02-ingestion-principles.md)
- [04 — Source of Truth](04-source-of-truth.md)

