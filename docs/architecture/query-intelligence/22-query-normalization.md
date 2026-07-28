# 22 — Query Normalization

## Purpose

Query Normalization creates a comparable derived representation while preserving original meaning, wording, ambiguity, language, and rejected semantics.

## Permitted Normalization

- whitespace and structural normalization;
- canonical terminology mapping when identity is verified;
- language and script annotation;
- explicit segmentation references;
- date, version, and identifier formatting without changing value;
- expansion of verified abbreviations;
- preservation of quoted and embedded content as data.

## Prohibited Normalization

Normalization must not resolve ambiguity, invent referents, remove command or unsupported semantics, strengthen authority, add an Objective, translate uncertain meaning as certain, or replace the original Query.

## Rules

- **QNORM-001:** Original Query representation and meaning must remain recoverable.
- **QNORM-002:** Every transformation must record input, output, rule version, rationale, and semantic validation.
- **QNORM-003:** Ambiguity and unsupported semantics must survive normalization.
- **QNORM-004:** Canonical terminology mapping requires verified identity.
- **QNORM-005:** Normalization must not become interpretation, reasoning, translation authority, or evidence creation.
- **QNORM-006:** Material meaning uncertainty must block normalized use or remain explicitly qualified.

## Enterprise Example

An abbreviation maps to two architecture terms. Normalization preserves the abbreviation and both candidates rather than selecting one.

## Boundaries

No parser, translation engine, language model, prompt, tokenizer, or transformation implementation is selected.
