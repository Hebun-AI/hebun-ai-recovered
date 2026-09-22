# CONTENT-COMPOSE-1 — The Content Package

**Final status: CONTENT-COMPOSE-1 CLOSED — RELEASED + PRODUCTION-ACCEPTED** (declared by the
Director on the measured production evidence below).

**Release** `23dca8a887d390a2ebff87e662a433aa4c754e4d` · **Parent** `8a11fdf1` · on `origin/main`.
**Deployment** `dpl_A8D2c6UFkFQFgkwCvSrHRH4C6KLc`, READY, production, `meta.githubCommitSha`
exactly `23dca8a8…`, serving `hebuntech.com` and `www.hebuntech.com`.
**Migration 59** `20260922181241_contentcompose1_selected_media` — applied through the released
production migration ceremony. The ledger stands at **59**, digest
`f09a8f80884f1b636e3151334fc94d6a`, verdict **converged**.

**Hebun could make an image, judge it, and keep it reachable. It could not say what the finished
thing was.** This closes that: one draft revision, its destination, its copy, the images it is
actually made of, and whether all of it has been judged — in one answer, derived live from the
authorities that already owned every part of it.

Design and implementation record: the release commit message on `23dca8a8`.

---

## Truth semantics

| Truth | State |
|-------|-------|
| DESIGNED | **yes** |
| IMPLEMENTED | **yes** — `23dca8a8` |
| VERIFIED | **yes** — the CONTENT-COMPOSE-1 suite against real Postgres, plus MEDIA-1 (3), MEDIA-2B, MEDIA-3, MEDIA-4A, MEDIA-5 (2), OPS-P1 (2), TRH-10 (2); `tsc` 0 errors; lint 0 errors; production build |
| PRODUCTION-SCHEMA-ACCEPTED | **yes** — ledger 58 → 59, converged, and the before/after delta is exactly one table |
| DEPLOYED | **yes** — exact SHA on the production deployment, both apex aliases, read from the Vercel REST API |
| AVAILABLE | **yes** — the human door was exercised in production and the selection persisted |
| AUTHORIZED | **yes** — an authenticated human, through the released surface |
| EXECUTED | **yes** — one selection written |
| SUCCESSFUL | **yes** — the persisted row and every pinned count are exactly as predicted |
| PRODUCTION-ACCEPTED | **yes** — Director-performed manual acceptance |
| Selection persisted with exact linkage | **production proven** |
| Readiness derived, never stored | **production proven** — see below |
| Cross-revision selection | **production proven** |
| publishing, scheduling, permit, execution authority | **no** |
| MEDIA-4B Selected Media Authority | **CLOSED BY THIS PHASE** — no longer deferred |
| BACKUP-ACCEPTED | **no** — Director-deferred, unchanged |

## What shipped

One new fact, and one table for it. **Provenance is not usage.** Every invocation already recorded
the revision an image was generated FROM, but a revision may hold several admitted, approved images
while the finished post carries one — so which images a draft is MADE OF could not be computed from
any existing row. `content_selected_media` records that and nothing else.

Everything else in a package is read from whoever already owned it:

| Part | Authority | New state |
|---|---|---|
| destination | `work_artifacts.intended_destination` (CGO-1) | none |
| copy | `work_artifact_revisions.content` | none |
| copy review | `decision_records` / `work_artifact_revision` (TRH-10) | none |
| image identity, custody | `media_assets` (MEDIA-1) | none |
| image review | `decision_records` / `media_asset` (MEDIA-3) | none |
| **which images** | **`content_selected_media`** | **the only new row** |
| **readiness** | **derived at read time** | **none — stored nowhere** |

## Production acceptance

Performed manually by the Director on `www.hebuntech.com/operations`, against the draft
**"CGO-7 observed reel caption"** — the same draft MEDIA-2B generated for, MEDIA-3 reviewed,
MEDIA-4A kept reachable and MEDIA-5 edited. **One click. No image generated, nothing published.**

### The persisted selection

```json
{"id":"212af0fa-c6e4-4139-9d74-c47b8c275a0b",
 "tenant_id":"f625b683-3be5-40eb-93a4-53fc56ab38c9",
 "artifact_id":"18a0ac6e-eaea-4218-bd22-5aa6f2139784",
 "revision_no":2,
 "media_asset_id":"63a33cbb-82bc-4e56-8d2a-5c9f875dc502",
 "selected_by_actor_id":"d5b496df-588c-49c5-9cc2-17672b82dd10",
 "selected_at":"2026-09-22T18:54:29.391Z"}
```

Exactly one row. The actor is the authenticated human, and is the same identity that authored the
draft. Zero cross-tenant rows.

### The linkage, proven by joining through the real foreign keys

| | |
|---|---|
| Draft | "CGO-7 observed reel caption", `content-draft`, destination **instagram**, current revision **2** |
| Copy | *"Production acceptance test for MEDIA-4A revision history."* — 57 characters, non-empty |
| Image | `63a33cbb…` — **admitted**, 1024×1024 PNG, 1,158,995 B |
| **Generated in revision** | **1** |
| **Selected for revision** | **2** |

**The acceptance case was the cross-revision one, deliberately.** An image generated in revision 1
was chosen for revision 2. Provenance alone can never express that, which is precisely why this
table had to exist. MEDIA-4A's distinction survives intact: the card still says where the image came
from, and the package says where it is used.

### Readiness was predicted BEFORE the click, and matched

The prediction was recorded in advance so the verification could not be fitted to the result:

| Predicted | Observed |
|---|---|
| destination `instagram` | ✅ |
| copy = revision 2's text, non-empty | ✅ |
| 1 selected image | ✅ |
| media review **unreviewed** (0 decisions) | ✅ **0 decisions on the asset** |
| copy review **unreviewed** (0 decisions) | ✅ **0 decisions on revision 2** |
| blockers `["selected-media-unreviewed","copy-unreviewed"]` | ✅ inputs yield exactly these |
| ready **false** | ✅ **NOT READY** |

**A NOT READY first acceptance proves more than a green one.** A package that reported ready would
be consistent with a stored flag. A package that reports two blockers, each traceable to a specific
absent row in Governance's own ledger, can only have been computed.

### Readiness is stored nowhere — proven at the database level

A scan of **every column in the public schema** for `ready|blocker|publish|composed` returns `[]`.
A scan for tables matching `package|compose|publish` returns `[]`. There is nowhere in production
for a stored readiness to live. Retire a selected image or supersede a decision and the package
stops being ready with no writer involved.

### Non-regression — every pinned count, unchanged

| Table | Before | After |
|---|---|---|
| `action_permits` | 6 | **6** |
| `action_execution_attempts` | 1 | **1** |
| `heby_action_requests` | 11 | **11** |
| `decision_records` | 26 | **26** |
| `media_generation_invocations` | 2 | **2** |
| `media_assets` | 2 (2,293,585 B) | **2 (2,293,585 B)** |
| `work_artifacts` / `work_artifact_revisions` | 9 / 12 | **9 / 12** |
| `content_selected_media` | 0 | **1** |

Rows created since the migration ceremony: `decision_records` **0**, `heby_action_requests` **0**,
`action_permits` **0**, `action_execution_attempts` **0**. **No provider call, no paid generation,
no publishing, no permit, no execution, no Governance mutation.** The only thing that changed in
production is one selection row.

### Schema delta — exactly one table

Ledger 58 → 59, applied digest identical to canonical@59, migration 59 recorded exactly once.
Public base tables 72 → **73**. `media_assets` 14 columns, `media_generation_invocations` 23,
`work_artifacts` 19, `work_artifact_revisions` 10, `decision_records` 32 — all unchanged.

The table as applied: 7 NOT NULL columns; unique on
`(tenant_id, artifact_id, revision_no, media_asset_id)`; tenant-safe composite foreign keys to
`work_artifact_revisions(tenant_id, artifact_id, revision_no)` and `media_assets(tenant_id, id)`,
both `ON DELETE RESTRICT`; `CHECK (revision_no >= 1)`; one index on
`(tenant_id, artifact_id, revision_no)`.

## Custody gates selection; Governance gates readiness

Any **admitted** image may be chosen whether it is approved, declined or never reviewed — the
MEDIA-5 doctrine, unchanged: accepting may not authorize an internal act, so declining may not
forbid one. Only RETIREMENT removes the option, because that is a custody fact rather than a
judgement. Whether the result is READY is the separate question, and it is Governance's.

Unreadable Governance reads as `unreviewed` and **blocks**. It is never allowed to read as approval.
A package is ready only while Hebun can currently see that it is.

## READY is not authorized, and cannot become it

|  |  |
|---|---|
| this image is in this draft | a fact a human recorded |
| **≠** this image is approved | Governance decides that, separately, about the image |
| **≠** this draft is published | no publishing authority exists |
| **≠** this draft is scheduled or queued | neither exists |
| **≠** anything was sent | `AGENT_ORIGINABLE_ACTION_KINDS` is send / record-work; there is no publish kind, and Instagram's `/media_publish` is on an explicitly banned path list |

`ready` is consumed by no permit, no execution attempt and no provider path, and none exists to
consume it. It is a sentence for a human. The non-claims are rendered verbatim beside the badge
every time, ready or not, because the entire risk of this surface is reading READY as "Hebun will
post this".

## What CONTENT-COMPOSE-1 deliberately did NOT add

No publishing, scheduling, permit or execution reach. No ordering column — nothing consumes an order
today, and MEDIA-4B's own finding was that durable state whose only reader is the surface that writes
it should not be built. No second Governance system: review stays where MEDIA-3 and TRH-10 put it.
No copy of destination, copy or review state into a package row, because a copy is a second truth
that goes stale the moment a decision is superseded. No `destination-missing` blocker, because
`work_artifacts_content_draft_destination_chk` makes the state unrepresentable and the reader refuses
any artifact that is not a content-draft — **a blocker that cannot fire is not a guard.**

Still out of scope and untouched: backup and restore (**BACKUP-ACCEPTED remains no**, Director-
deferred), publishing, scheduling, measurement, and a tenant-wide media library.

## What this record does NOT claim

The production panel's rendered text was observed by the Director, not by this process. What is
measured here is the persisted row, the authoritative inputs the derivation consumes, and every
pinned count — from which the package's contents follow, given the derivation the suite pins against
real Postgres. **The released reader was NOT executed against production from this process**: the
control-plane client refuses a remote target unless `HEBUN_CONTROL_PLANE_ALLOW_REMOTE` is set, and
that guard was left in place rather than bypassed to produce a tidier artefact. Availability of a
bypass is not a reason to use one.

## Lessons

- **Ask what is derivable before adding a column.** Four of the five parts of a content package were
  already live-readable; only selection was not. The phase reduced to one table because the question
  "what cannot be computed?" was asked before the schema was drawn, not after.
- **A stored flag would have become an authority.** Readiness looks like a field and is actually a
  question Governance already answers. Persisting it would have created something that can disagree
  with the ledger, silently, at exactly the moment a decision is superseded.
- **Predict the result before the click.** Writing the expected blockers down in advance turned the
  acceptance from "does this look right?" into a comparison. A NOT READY package that was predicted
  is stronger evidence than a READY one that was hoped for.
- **A blocker that cannot fire is a claim nobody can check.** `destination-missing` was written,
  then deleted when a CHECK constraint proved the state unreachable. The schema was consulted about
  what is possible rather than assumed.
- **When a released guard blocks your evidence, the guard is usually right.** The remote-database
  refusal stopped a nicer-looking verification. Bypassing it would have proved the reader works and
  disproved that Hebun's own safety rails mean anything.
