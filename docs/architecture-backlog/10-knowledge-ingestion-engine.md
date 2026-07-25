# 10 — Knowledge Ingestion Engine

**Priority:** High
**Status:** Planned

## Purpose

Import enterprise knowledge into Organizational Intelligence. Turn scattered documents and systems into structured, searchable, linked knowledge inside the organizational graph.

## Supported sources

- PDF
- DOCX
- XLSX
- Notion
- Confluence
- SharePoint
- GitHub
- Internal Wiki
- Email (future)

## Produces

- Structured Knowledge
- Organizational Relationships
- Searchable Knowledge
- Entity Links

## Architectural notes

An extract-and-map pipeline. Source connectors sit behind the Tool Registry; no source SDK is called directly by the engine. Extracted content is normalized into canonical contracts and linked to existing entities.

It writes knowledge, not behavior. Output is inert, provenance-tagged data with traceable source lineage. Ingestion never mutates runtime state or acts on what it reads.

## Dependencies

- Organizational Intelligence canonical contracts — the target shape
- [12 — Tool Registry](12-tool-registry.md) — source connectors and auth metadata
- Search / knowledge index — where searchable knowledge lands

## Promotion criteria

- Tool Registry providing authenticated source connectors.
- Canonical contracts able to hold ingested knowledge and entity links.
- Provenance and source lineage defined per record.
- Director approval.
