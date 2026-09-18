# MEDIA-4A — Revision Media History

**Final status: MEDIA-4A CLOSED — RELEASED + PRODUCTION-ACCEPTED** (declared by the Director on the
measured production evidence below).

**Release** `598bf57217ce4de6c9915bae6e2e16e0488bb0dd` · **Parent** `2c79a1ff` · on `origin/main`.
**Deployment** `dpl_9NZaTnv9Z28A3HB6mNkEFNq1VfB5`, READY, production, serving `hebuntech.com` and
`www.hebuntech.com`. **No schema, no migration, no persistence, no writer** — the ledger stays at 57.

**A draft moved on, and its earlier images stayed reachable.** MEDIA-3 asked "what images exist for
THIS revision", so the moment a content draft advanced to revision 2 the images of revision 1
vanished from the surface. They were never lost and never stopped being authoritative — the surface
was simply asking a narrower question than the human has. MEDIA-4A widens the question by one
predicate and records nothing new.

Design and implementation record: the release commit message on `598bf572`.

---

## Truth semantics

| Truth | State |
|-------|-------|
| DESIGNED | **yes** |
| IMPLEMENTED | **yes** |
| VERIFIED | **yes** — MEDIA-4A firewall suite, plus MEDIA-1/2A/2B/3, VPS storage, storage acceptance, OPS-P1, R3W and TRH-10 suites; `tsc` 0 errors; lint 0 errors; production build |
| DEPLOYED | **yes** — `meta.githubCommitSha` on the production deployment is exactly `598bf572…`, read from the Vercel REST API |
| PRODUCTION-ACCEPTED | **yes** — Director-performed manual acceptance, populated historical state |
| Historical revision media visible | **production demonstrated** |
| Exact per-card provenance preserved | **production demonstrated** |
| Private preview on a historical asset | **production accepted** |
| Governance state unchanged by history | **production demonstrated** |
| new schema / migration / persistence | **no** |
| writers added | **no** |
| selected / attached / inherited state introduced | **no** |
| publishing, scheduling, permit, execution authority | **no** |
| MEDIA-4B Selected Media Authority | **DEFERRED** |
| BACKUP-ACCEPTED | **no** — out of scope, unchanged |

## Implementation scope

Three source files and two test files. One reader, one pass-through action, one composition.

| Seam | What it is |
|---|---|
| `listArtifactMediaAssets` | the MEDIA-3 listing with the revision predicate dropped and the artifact predicate kept, batched across the drafts on the page with one `inArray` |
| `listArtifactMediaAssetsAction` | a pass-through: resolves the session tenant, calls the reader, owns nothing |
| `operations-preparation.tsx` | groups assets by their own source revision and splits current from previous |

`media_generation_invocations_source_idx` is `(tenant_id, source_artifact_id, source_revision_no)`,
so the wider read uses the same index by its leading columns: **no column, no table, no index added.**
The batched read **replaces** the per-draft query MEDIA-3 issued rather than adding to it — the media
section is three statements regardless of how many drafts or revisions exist.

## Authoritative read flow

```
listWorkArtifacts      (Work Artifact authority) → currentRevision   ─┐
                                                                      ├─ compared in the composer
listArtifactMediaAssets (Media Asset authority)  → sourceRevisionNo  ─┘

  media_assets ⋈ media_generation_invocations on (id, tenant_id)
    where tenant = session tenant on BOTH tables
      and source_artifact_id IN (drafts on page)
    order by source_revision_no desc, admitted_at asc

readMediaAssetReviewStates → decision_records        (derived, batched)
readMediaAsset             → verify size + SHA-256, then a 60 s private grant  (unchanged)
```

**Two authorities, side by side, neither invented.** `currentRevision` is the Work Artifact
authority's answer, carried on the artifact row through its released listing. `sourceRevisionNo` is
the Media Asset authority's answer, carried on the invocation's composite foreign key into
`work_artifact_revisions` — so a revision number here cannot name a revision that does not exist.
The media reader never reads or guesses `current_revision`, which is exactly the bug the split
exists to prevent: a draft sitting at revision 3 whose newest image came from revision 2 must not
report revision 2 as current.

## Validation already completed (at implementation, not repeated at closure)

| Check | Result |
|---|---|
| `media4a-revision-history/history-and-firewall` | pass |
| `media3-asset-review`, `media1-asset-authority` (4), `media2a` (2), `media2b-human-door` | pass |
| `media-vps-storage` (2), `media-storage-acceptance` (2) | pass |
| `ops-p1-flow` firewall + bite-proofs, `r3w-flow` (5), `trh10-artifact-review` (2) | pass |
| `tsc --noEmit` | 0 errors |
| `eslint` | 0 errors; 19 pre-existing warnings, none in MEDIA-4A files |
| `next build` | succeeded, `BUILD_ID Br1j5b4iqdP7zoHakrRbj` |

The full suite was deliberately not run; the affected suites were. Nothing was re-run for this
closure.

## Production acceptance

Performed manually by the Director on `www.hebuntech.com/operations`, against the draft
*"CGO-7 observed reel caption"* — the same draft whose image MEDIA-2B generated and MEDIA-3
reviewed. **The populated historical state was reached through the normal Work Artifact UI**, by
advancing the draft from revision 1 to revision 2. No fixture, no seeded row, no direct write.

| Observed | Meaning |
|---|---|
| Revision 2 became **CURRENT** | the Work Artifact authority advanced its own pointer, through its own released path |
| Revision 2 has **no generated image** | and the surface says so rather than hiding the section |
| **Previous revisions → Revision 1** rendered | the MEDIA-4A grouping, with revision 1's media reachable again |
| The revision-1 asset still read **ADMITTED + APPROVED** | neither custody nor Governance state was disturbed by the draft moving on |
| Per-card provenance still read **"Revision 1 of this draft"** | exact provenance survives grouping, and survives being read out of context |
| The asset was **not carried into revision 2** | no inheritance exists, and none was invented |
| **Show image** exercised on the historical asset | the real image rendered through the existing private preview path |
| UI confirmed the admitted digest was verified before display | the released `readMediaAsset` integrity seam ran, unchanged, for a historical asset |
| **No new Governance decision was required** | history is a read; it asks nothing of Governance |
| No publishing, scheduling, permit or execution occurred | MEDIA-4A grants none of them and reaches none of them |

**What the preview evidence proves, stated exactly:** the released application path re-verified byte
size and SHA-256 against the store and then minted a short-lived private grant, and the image
rendered. That is the application path succeeding. **No independent external VPS byte audit was
performed or is claimed here** — the same boundary MEDIA-2B and MEDIA-3 drew.

## Historical means one thing

**The asset's authoritative source revision is not this draft's current revision.** That is the
whole of it.

It does **not** mean retired, declined, obsolete, superseded, **inherited**, **selected** or
**attached**. The firewall suite bans every one of those words from the surface, and the surface
states the negative out loud: *"none of them is carried forward into revision N."*

|  |  |
|---|---|
| generated from revision N | a fact the invocation records |
| **≠** selected for revision N | no such fact exists anywhere in the repository |
| **≠** inherited by revision N+1 | no inheritance exists, and none was invented |
| **≠** approved | approval is a Governance judgement about the Media Asset, nothing more |
| **≠** publishable | no publishing authority exists to grant |

`APPROVED` remains a Governance judgement about the Media Asset and about nothing else. It does not
mean attached, scheduled, publishable, sent or executed, and MEDIA-4A did not widen it by showing it
next to an older revision.

## What MEDIA-4A deliberately did NOT add

No schema, no migration, no new table, no new column, no new index. No writer: measured over the 229
added source lines, zero `.insert(`/`.update(`/`.delete(`, zero Governance writers, zero media
lifecycle mutation, zero publish/permit/execution reach, zero TTL or access widening, zero
`process.env`, zero client-supplied tenant. The single textual match for
*selected/attached/inherited* is prose denying those concepts, not an identifier.

Review authority is **not narrowed by age**. If Governance may decide about an asset, it may decide
about an older revision's asset; the released MEDIA-3 card renders every asset in every group, so
there is one review implementation, one preview path and one set of accept non-effects — and no
UI-invented restriction layered over the released authority.

Retired assets are still shown and still say so; the listing filters no lifecycle away.

## MEDIA-4B remains deferred, on purpose

MEDIA-4 discovery established that **provenance is not usage**: "this asset was generated from
revision 1" is not "this asset is the selected image for revision 1". The second fact is **not
derivable** — a revision may have several approved assets — so a durable Selected Media Authority
would genuinely require new persistence.

It is deferred because **there is no consumer**. Approval currently gates nothing, no publish path
exists, and Instagram's `/media_publish` is structurally unrepresentable rather than merely unused.
Building selection now would create durable organizational state whose only reader is the surface
that writes it. **MEDIA-4B is deferred until a real composition or publishing consumer exists** —
not abandoned, and not redesigned.

Still out of scope and untouched: backup and restore (**BACKUP-ACCEPTED remains no**), selected
media, attachment, composition, publishing, scheduling, execution, a tenant-wide media library,
reference images and editing.

## Lessons

- **A missing capability can be a missing question, not a missing fact.** Revision 1's images never
  stopped existing; the surface stopped asking about them. The fix was one predicate, not a column —
  and the discovery that preceded it is what kept a table from being built for it.
- **When two authorities each hold half an answer, put them side by side and compute nothing.**
  Current-ness belongs to the Work Artifact authority, provenance to the Media authority. Deriving
  either from the other's rows is the bug; a draft at revision 3 whose newest image came from
  revision 2 would have claimed revision 2 was current.
- **A widening read is the moment to re-ban the words you have not earned.** Showing older material
  is exactly when a surface starts wanting to say "superseded" or "inherited". Banning them in the
  test is cheaper than un-saying them later.
- **State the empty case.** "Revision 2 is current and has no images" is what makes the historical
  group below it readable; suppressing it would have made the older images look like current ones.
