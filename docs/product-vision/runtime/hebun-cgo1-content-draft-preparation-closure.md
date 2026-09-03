# CGO-1 — Content Draft Preparation — CLOSED / PRODUCTION-ACCEPTED

**Release** `cf8d684` · **Migration 47 applied** · **Production ledger 46 → 47**, digest `8394a8f461cdc9a9bf7dac9e13af8192`
**Production cluster** `7675444875863894887` / `neondb` · **Deployment** `dpl_9Y2CEhxT1dwxggNAtDpjfSCESVaw`, aliased `www.hebuntech.com`

---

## What Hebun can now do that it could not

An organization could prepare an operational plan or a message draft. It had no way to prepare
**content** — prose written for somewhere it is meant to go.

    "Prepare a caption for Instagram"   →  unrepresentable
    "What content have we prepared?"    →  unanswerable

Both are answerable now, through the existing Work Artifact Authority. **No new authority was
created**, and the association with organizational Work needed no schema at all: WEV-1's
`work_evidence_references.work_artifact_id` already existed and carried it.

---

## The concept, stated exactly

A **content draft** is prose prepared for a **declared destination**. The declaration is made at
preparation time and means one thing:

> A human or an agent said this draft was written for Instagram.

It does **not** mean an Instagram provider exists, an account is linked, publishing is available,
anything is scheduled, or anything was published. `PROVIDER_CATALOG` holds `google-workspace` and
`github`; the only registered external adapter posts email to Resend; production holds **no**
scheduling or publishing table of any kind.

## Three design decisions worth keeping

**The destination is a closed enum, not text.** Free text would admit `instagram`, `Instagram`,
`IG`, `insta` and a profile URL as five durable truths for one destination, and would let a caller
record a destination Hebun has never reasoned about. The closed shape follows the doctrine
`provider-catalog/catalog.ts` already states for providers: a definition must not be addable by
INSERT, or INSERT privilege becomes equivalent to declaring a capability.

**It lives on the stable artifact, not on a revision.** A revision is "the exact bytes, at each
point they were written". Retargeting a finished caption would otherwise force a revision
byte-identical to its predecessor — two revisions sharing a `content_digest`, and a history
claiming an edit that never happened.

**It is written once and never updated.** The artifact row is mutable; the guarantee is the absence
of a writer, asserted by a test that scans every `.set()` payload in the module. An approval binds
to `<ref>@<revision>`; an editable destination would let an approved draft silently become one
prepared for somewhere else.

Two paired CHECKs make the rule structural in both directions — a content draft MUST carry a
destination, nothing else MAY — so `NULL` means "not a content draft", never "destination unknown".

## The migration defect caught before the ceremony

The generated migration would have **failed in production**. PostgreSQL refuses to use a newly
added enum value inside the transaction that added it, and migration 47 adds `content-draft` and
both CHECKs together:

    ERROR:  unsafe use of new value "content-draft" of enum type work_artifact_type
    HINT:   New enum values must be committed before they can be used.

Proved against real PostgreSQL 14, then fixed by casting `artifact_type` to text in the predicate —
verified applying in one transaction with both CHECKs biting. The alternative was splitting one
coherent change across two migrations to buy a commit boundary, which would have shipped the column
and the rule that makes it honest in different releases.

---

## Production acceptance

Performed by the Director against `www.hebuntech.com` on the released commit, through the released
authorities only. Corroborated read-only afterwards; production was not mutated by corroboration.

| Proof | Result |
|---|---|
| Artifact exists | `0e19e56c-d8da-4cc2-a767-4b2e4ee35440`, one content-draft row |
| Type | `content-draft` |
| Intended destination | `instagram` |
| Revision | 1, lifecycle `draft`, `version` 1, `updated_by` NULL — never updated |
| Provenance | authored by `human`, `source_message_id` NULL (direct human authorship) |
| Digest | `6406f083…` — recomputed SHA-256 over the stored bytes **matches** |
| Work association | WEV-1 reference `03217533…` resolves the artifact to **Hebun Era III development** |
| Declaration standing | `withdrawn_at` NULL — current, unwithdrawn |
| Work lifecycle | remains `active`, `version` 1 — unchanged |

The Operations surface rendered `prepared for Instagram`, the four distinctions, and the statement
that a declared destination is not a provider connection.

### Non-effects, measured by window rather than asserted

Before-window captured before the human act; after-window read afterwards.

| Table | Before → After |
|---|---|
| `work_artifacts` | 3 → 4 (**+1**, the draft) |
| `work_artifact_revisions` | 3 → 4 (**+1**, revision 1) |
| `work_evidence_references` | 1 → 2 (**+1**, the declaration) |
| `decision_records` | 7 → 7 (**0**) |
| `heby_action_requests` | 5 → 5 (**0**) |
| `action_execution_attempts` | 1 → 1 (**0**) |
| `integration_credentials` | 18 → 18 (**0**, and 0 touched in the window) |
| `agent_mandates` | 2 → 2 (**0**) |
| `agents` | 1 → 1 (**0**) |
| `provider_connectivity_controls` | 2 (**0**) |

Rows changed in the acceptance window: `work_items` 0, `agents` 0, `agent_mandates` 0,
`knowledge_nodes` 0. Tables matching `schedul|publish|campaign|social|post` in production: **NONE**.

No Governance decision, permit, execution, execution attempt, provider call, scheduling, publishing,
provider connection, Work lifecycle transition or agent-mandate widening occurred from preparing a
draft and declaring what work it concerns.

---

## Heby grounding — what was proved, and the honest limit

Both released seams were resolved against production read-only, with **zero model calls**.

`work-artifacts` hands the model the draft:

    type: content-draft · revision: 1 · authored by: human · digest: 6406f083… · excerpt: complete

`work` hands the model the association:

    A person declared that this work concerns: document "Loom weaving reel — three knots per
    centimetre" (content-draft · draft · current revision 1).

Word audit of the combined grounding payload: `scheduled` **false**, `published` **false**,
`delivered` **false**, `seen` **false**, `connected` **false**. (`authorized` appears only inside the
released denial "not authorized to execute anything".)

**THE LIMIT, STATED PLAINLY: `instagram` is FALSE in the grounding payload.** Neither released seam
carries `intended_destination`. So Heby can ground on *content was prepared* — that it is a
content-draft, at revision 1, in draft, concerning active work — but it **cannot say which
destination it was prepared for**. CGO-1 recorded the destination and rendered it to humans; it did
not extend the grounding detail line, and no claim is made here that it did.

That gap is also why the forbidden conversions are structurally impossible rather than merely
discouraged: the destination never reaches the model at all.

---

## Known baseline exceptions

The suite is **647 passed / 17 failed / 664 total**. The 17 failures are **pre-existing**, measured
at `4cbb4ef` with this work stashed (645 / 17 / 662 — the +2 are CGO-1's own tests) and identical
file-for-file. They are not a Node-version artifact: they fail on v20 and v24 alike. CGO-1's
regression delta is **zero**. They remain unfixed and are not this phase's to fix.

## Recorded debt — migration test authority fan-out

One small additive migration required editing **45 pinned assertions across more than 30 released
test files**, plus three full-suite runs to prove no regression: ~27 absolute ledger counts in five
different spellings, 12 migration-filename allowlists, 3 ledger digests and 6 release-digest sites,
3 bite-proof journal-tail find-strings, and a pending-migration probe that must be hand-moved every
release. Roughly 60% of CGO-1's wall-clock went there rather than to the capability. Recorded as
debt, deliberately not refactored inside CGO-1.

## Release-order defect — what actually happened

The intended order was **push → migration → deploy**, derived from measurement: migration 47 is
backward-compatible with the 46-era application (old code writes and reads normally against schema
47), but the new application is **not** compatible with schema 46 (`listWorkArtifacts` returns
`persistence-unavailable`).

**That order did not occur.** Vercel deploys on push, so the real order was
**push → deploy (automatic) → migration**. The new application therefore ran against schema 46 for
approximately twenty minutes — exactly the incompatible window. It failed **closed**: `/operations`
and `/director/work` would have shown their unavailable state, nothing was written wrongly, and no
data was harmed. It resolved when the ledger reached 47.

Do not record this release as having followed the intended sequence. The lesson is structural: the
deployment is not a step the operator controls once the push happens, so a schema-bearing release
must either push **after** the migration, or gate auto-deploy. Unowned by CGO-1.

---

## Status

**CGO-1 — CLOSED / PRODUCTION-ACCEPTED.**

Zero new authority · zero provider · zero adapter · zero scheduler · zero agent-mandate change ·
one migration, additive, zero DROP.

**CGO-2 is not started and no successor has been selected.**
