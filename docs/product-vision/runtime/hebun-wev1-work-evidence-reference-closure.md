# WEV-1 — Work Evidence Reference — CLOSED / PRODUCTION-ACCEPTED

**Release** `eab2e0b` · **Migrations 44 + 45 applied** · **Production ledger 43 → 45**, digest `b41faf35181a4298f9b90cffb3e59314`
**Production cluster** `7675444875863894887` / `neondb`

---

## What Hebun can now do that it could not

A work item could say what it was called, which part of the organization it belonged to, who was
accountable for it, and what state a human declared. It had no way to say **what it is about**.

    "What is this work about?"        →  unanswerable
    "What work concerns this?"        →  unanswerable

Both are answerable now, from one Work-owned declared relationship over two released referents.

---

## The design decision that changed the schema

The architecture gate proposed `reference_kind` + `reference_key`. It was **rejected**, because
**no foreign key can enforce a polymorphic string pair**: it cannot say the referent exists, cannot
say it belongs to this tenant, and lets the kind disagree with the key. All three would then have
been re-implemented in application code and re-proved in every test.

Two **nullable typed columns**, each with a composite tenant foreign key, give all three to
PostgreSQL:

| Guarantee | Mechanism |
|---|---|
| the referent exists | `work_evidence_references_tenant_fact_fk` / `_tenant_artifact_fk`, `ON DELETE RESTRICT` |
| it is THIS tenant's | the same FKs, composite on `tenant_id` — cross-organization is unrepresentable |
| the kind matches | there is no stored kind; it is DERIVED from which column is populated |

Both anchors already existed — `knowledge_facts_id_tenant_uidx` and `work_artifacts_tenant_id_uq` —
so neither referent authority's schema was touched.

## A fact, not a node. An artifact, not a revision.

`knowledge_facts` is the version-stable identity and `knowledge_nodes` is the version, so a
reference to a node would go stale the moment Knowledge is superseded. `knowledge_external_references`
settled that first, in the same words: the subject is the fact, never a node. An artifact reference
names the document, not one draft of it — R3A.1 freezes a revision because a send transmits exact
bytes, and work is not about bytes.

**`external-record` was rejected.** KR-EXT1 already owns external identity per knowledge fact, so a
GitHub repository or a Drive file reaches work THROUGH the fact that declares it. A second provider
identity in Work would have been a second provenance authority and a generic external-object
ontology built for flexibility rather than for a job.

---

## Production acceptance — measured

A human opened `Concerns` on the work item **Hebun's own system act created under GIA-1** and
declared what it concerns.

| Claim | Measured in production |
|---|---|
| Exactly one current reference | `3da1d0bb` — one row, one current per work item |
| Tenant | `f625b683…` — the declaring organization |
| Subject | `983d1cb2` "Hebun governed internal execution development" |
| Referent | `dc8d3795` — `hebun-repository`, "Hebun AI source repository" |
| `work_artifact_id` | `null` — exactly one referent, as the CHECK requires |
| `declared_by_type` | **`human`** |
| Current | `withdrawn_at`, `withdrawn_by`, `withdrawn_by_type` all `null` |
| Inverse lookup | referent → work resolves the same work item |
| Referent standing | from **Knowledge**: `provisional` · `draft` · not ratified. Work stores none of it — zero standing columns exist |
| Audit | ONE event, `work.reference-declared`, `actor_type = human`, carrying the reference id |
| Governance decisions | **7 — unchanged.** A declaration is not a decision |
| Permits / execution attempts | **2 / 1 — unchanged.** No executable action exists for this |
| Provider credentials | 18 — unchanged. No provider write |
| Agent mandates | rev 1 `[]`, rev 2 `['send']` — **unmutated** |

`RATIFIED != AUTHORITATIVE` held under the strongest available test: the referenced fact is
`provisional` and unratified, and being referenced promoted it to neither.

**A note on the lifecycle word.** The surface rendered `draft` while the generic
`knowledge_nodes.lifecycle_status` column reads `active`. That is not a discrepancy — Knowledge's
read seam projects its OWN `knowledge_lifecycle_status`, which is the word its authority means. It
is direct evidence for the boundary: the standing came from Knowledge, not from Work reading a
column.

---

## What stays deliberately unavailable

- **Migration 44 — APPLIED**, and only as migration 45's canonical prerequisite. It makes
  `record-work` **storable in a mandate scope** and nothing else.
- **Agent-originated `record-work` — UNAVAILABLE.** No mandate names it; none was widened.
- **Agent model selection of `record-work` — UNAVAILABLE.** `parseAgentActionSelection` still admits
  `send` and the abstain value only.
- **Declaration is human-only**, by database CHECK, with an enumerated caller list of one server
  action. Heby, agents, ingestion and provider reads cannot reach it.
- **No automatic withdrawal.** A superseded fact or a retired artifact is its own authority's news.

**GIA-1 remains CLOSED / PRODUCTION-ACCEPTED** — its work item is still `created_by_type = system`
and its permit is still `consumed`.

---

**WEV-1 CLOSED / PRODUCTION-ACCEPTED.**
