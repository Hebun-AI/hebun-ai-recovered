# MEDIA-3 — Per-Revision Media Asset Visibility and Governance Review

**Final status: MEDIA-3 CLOSED — RELEASED + PRODUCTION-ACCEPTED** (declared by the Director on the
manually measured production evidence below).

**Release** `2a065f82615e9d0d827541e5ddc4636885682b47` · **Parent** `697fc2ec` · pushed to
`origin/main`. **No schema, no migration, no new authority** — the ledger is unchanged, and every
seam in this phase is a reader over a relationship MEDIA-1 already owned or a pass-through to a
Governance writer MEDIA-1 already released.

**A human saw a real admitted image in production and decided about it through Governance.** The
image did not change. Nothing was published, attached, scheduled, sent or executed, and nothing
gained the authority to do any of those.

Design and implementation record: the release commit message on `2a065f82`.

---

## Truth semantics

| Truth | State |
|-------|-------|
| DESIGNED | **yes** |
| IMPLEMENTED | **yes** |
| VERIFIED | **yes** |
| DEPLOYED | **yes** — established by the accepted production surface serving the MEDIA-3 implementation. No deployment id or Vercel metadata is claimed here, because none was independently measured in this closure |
| PRODUCTION-ACCEPTED | **yes** — Director-performed manual acceptance on `hebuntech.com/operations` |
| Media Asset preview | **production application path accepted** |
| Governance Accept path | **production accepted** |
| Governance approval separate from Media Asset lifecycle | **production demonstrated** |
| publishing authority granted | **no** |
| attachment authority granted | **no** |
| execution authority granted | **no** |
| new schema / persistence | **no** |
| BACKUP-ACCEPTED | **no** — out of scope, unchanged |

## What was accepted in production

The Director performed the acceptance manually on `hebuntech.com/operations`, against an asset that
already existed — the image MEDIA-2B generated. No new generation, no provider call, no OpenAI
request was made for this acceptance.

**1 — The asset was visible under its own revision.** It appeared beneath the content draft
*"CGO-7 observed reel caption"*, under **Generated images (1)**. This is the MEDIA-3 reader doing
what it was built for: an invocation already carries
`(tenant_id, source_artifact_id, source_revision_no)` as a foreign key, so "which images belong to
this revision" needed a reader, not a column.

**2 — Before review, the surface read two truths at once.**

| Shown | What it means |
|---|---|
| `ADMITTED` | custody — the bytes were verified and stored, written once |
| `AWAITING REVIEW` | Governance — **no decision record exists** |
| `1024 × 1024`, `PNG` | the admitted asset's own facts |
| `Source: Revision 1 of this draft` | the provenance the reader derived |

`AWAITING REVIEW` is **derived from the absence of a decision**, never stored. No approval column
exists on `media_assets`, and none was added.

**3 — Private preview worked through the released integrity seam.** The Director chose **Show
image**, and the real previously generated image rendered. The surface stated:

> "Private link, expires shortly. Verified against the admitted digest before it was shown."

That sentence is the released behaviour: the preview is lazy and separate from listing, and opening
one asset calls the released `readMediaAsset`, which re-verifies byte size and SHA-256 against the
store before minting a grant with a **60-second** TTL (`MEDIA_READ_ACCESS_TTL_SECONDS = 60`). Listing
grants nothing — it resolves no store, verifies no bytes, mints no URL, and does not project the
storage key. Neither TTL was widened for UI convenience.

**What this proves, stated exactly:** the released MEDIA-3 application path successfully obtained
private preview access *after* the existing `readMediaAsset` integrity-verification seam completed.
See the caveat below — this is **not** an independent external VPS byte audit.

**4 — The review surface preserved the released accept non-effects.** The Director opened **Review
this image**, and the production UI rendered `MEDIA_ASSET_REVIEW_ACCEPT_NON_EFFECTS` verbatim beside
the decision controls rather than paraphrasing them. Accepting:

- does not authorize publication, sending, or any external act
- does not create an action request, mint a permit, or make anything executable
- does not accept the source draft revision the image was generated from
- does not change the Media Asset, its bytes, or its lifecycle
- does not become organizational Knowledge

**5 — One decision, written once.** The Director entered *"Production acceptance test for MEDIA-3.
Image reviewed and accepted for this draft."* and clicked **Accept exactly once**. Production
returned:

> "Recorded: accepted. The image is unchanged, and nothing was published."

**6 — The decisive authority proof.** After the Governance write, the asset showed both states
simultaneously:

| Surface | State | Source of truth |
|---|---|---|
| Media Asset custody / lifecycle | **`ADMITTED`** — unchanged | `media_assets` |
| Governance review | **`APPROVED`** | the Governance ledger, derived |

Two independent truths, side by side, neither overwriting the other. **The Governance approval did
not mutate the Media Asset lifecycle**, and approval did not imply publication or execution. The
ledger word remains `media-asset-accepted`, never "approved" — `APPROVED` is the surface's label for
a derived review state, not a stored column and not a publication grant.

## Five words this phase keeps distinct

| Word | Meaning |
|---|---|
| **admitted** | the bytes were verified and stored — a custody fact |
| **available** | the private object verifies *right now* |
| **approved / declined** | a Governance decision exists in the ledger |
| **retired** | the custody lifecycle ended |

`APPROVED` does not mean attached, scheduled, publishable, sent or executed. An asset with no
decision reads `Awaiting review`; an unreadable ledger reads `Review state unavailable` rather than
silently unreviewed. **Absence is never rendered as approval.** An integrity failure is worded as a
storage custody problem, never as a missing image — "no image" is exactly the wrong story to tell
about bytes that stopped matching their admitted digest.

## Claims this closure deliberately does NOT make

- **No independent external VPS byte audit is claimed.** What is proven is what the production
  application path proves: the released read path re-verified byte size and SHA-256 against the
  store and then minted a short-lived private grant, and the image rendered. That is the
  application path succeeding, not a separate out-of-band read of the object store by this session.
- **`APPROVED` does not mean publishable.** No publishing, attachment or execution authority was
  granted by this phase or by that decision.
- **Approval changed nothing in `media_assets`.** No approval column exists, none was added, and the
  lifecycle stayed `ADMITTED` across the Governance write.
- **The asset did not become organizational Knowledge.** It is a reviewed Media Asset, nothing more.
- **Decline was not production-tested.** Only the Accept path was exercised in production. The
  decline path is released and covered by the phase's verification, but it carries no production
  acceptance.
- **No tenant-wide Media Library exists.** The scope is strictly **per draft revision**: the assets
  of one content-draft revision, reachable from that revision. No cross-draft or tenant-wide
  browsing surface was built.
- **No deployment identifier is asserted.** DEPLOYED rests on the accepted production surface
  serving the MEDIA-3 implementation, and nothing more precise was independently measured.

## Scope boundary, preserved

MEDIA-1 (asset authority), MEDIA-2A (OpenAI transport), MEDIA-2B (live generation) and MEDIA-2C stay
exactly as closed — **none of them is reopened by this phase**. MEDIA-3 adds only visibility and
review, per draft revision, with private short-lived preview semantics.

Two released pins were extended by exact value, not relaxed: the MEDIA-1 allowlist now names the two
MEDIA-3 surfaces, and the operations action census enumerates the four new actions in order. The
per-file bans still apply to every listed file — no media table written directly, no provider, no
credential, no Governance record written outside the released writer, no retirement.

Still out of scope and untouched: backup and restore (**BACKUP-ACCEPTED remains no**), attachment,
scheduling, publishing, sending, autonomous agent review, a tenant-wide media library.

## Lessons

- A relationship that already exists as a foreign key needs a **reader**, not a column. Adding one
  would have created a second place where the same answer lives.
- **Listing and previewing must stay separate.** Fusing them means either N store round-trips per
  page or N grants that expire before anyone clicks one. Laziness here is a correctness property,
  not an optimization.
- **Approval belongs in the ledger, never on the subject.** Because the decision is derived, the
  custody row and the Governance row could show `ADMITTED` and `APPROVED` at the same time without
  either one lying — which is precisely what made this phase's authority claim provable in a single
  screenshot.
- **Render the promise, do not paraphrase it.** Showing `ACCEPT_NON_EFFECTS` verbatim beside the
  controls means the sentence the reviewer reads is the promise the authority actually makes.
