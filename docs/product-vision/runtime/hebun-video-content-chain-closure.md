# VIDEO CONTENT CHAIN — Video in the Content Workflow · Closure

Before this program, an admitted generated video (MV-7) was isolated: MEDIA-3 review and
CONTENT-COMPOSE-1 selection refused every video row (`asset-not-image`), the Content Package carried
images only, and no product surface could request, observe or admit a video generation. VIDEO CONTENT
CHAIN made a generated video a participant in the SAME content chain images use, and proved it in
production on the existing MV-7 asset, with no new generation.

**Implementation commit:** `fb1ed329` (review/selection/package for generated video; text-to-video
door over MV-4/MV-6/MV-7; per-draft video and generation reads).
**Production-acceptance fix:** `9ffd024c` (Content Package read moved to the server; see §5).
**Deployed commit:** `9ffd024c` — `dpl_DTf4y8aUXLsc6YMpCwrRze3nMQ8Y`, READY, production, serving
`www.hebuntech.com` and `hebuntech.com`.
**Production migration:** none. Ledger **67**, unchanged.
**Implementation record (historical evidence, not a second authority):** `hebun-video-content-chain.md`.

---

## 1 · Truth semantics

```
IMPLEMENTED                                        YES        fb1ed329 + 9ffd024c
DEPLOYED                                           YES        9ffd024c
MIGRATED (production)                              n/a        no migration; ledger 67 unchanged
GENERATED-VIDEO AUTHORITATIVE PLAYBACK             VERIFIED   (production)
GENERATED-VIDEO MEDIA REVIEW                       VERIFIED   (production, APPROVED)
GENERATED-VIDEO CONTENT SELECTION                  VERIFIED   (production, persisted)
CONTENT PACKAGE VIDEO REPRESENTATION               VERIFIED   (production, authoritative re-read)
VIDEO PUBLISH FAIL-CLOSED                          VERIFIED   (production UI non-claim; code + tests)
APPLICATION TEXT-TO-VIDEO DOOR                     IMPLEMENTED + LOCALLY VERIFIED (simulated provider)
APPLICATION DOOR, REAL PROVIDER                    NOT EXERCISED (connectivity DISABLED by design)
HIGGSFIELD CONNECTIVITY                            DISABLED   (unchanged)
```

**VIDEO CONTENT CHAIN: PRODUCTION ACCEPTED / CLOSED.**

## 2 · The authority decision

- **No new authority, table, writer or migration.** Review stays MEDIA-3 (subject `media_asset`,
  digest-bound, derived state). Selection stays CONTENT-COMPOSE-1 (`content_selected_media`,
  MEDIA-SELECT-INTEGRITY draft binding unchanged). The Content Package stays a derived read.
- **Kind coherence replaces the blanket refusal.** MV-2's `asset-not-image` became
  `asset-kind-incoherent`: an asset is a review/selection subject when its `media_kind` (image or
  video) equals its invocation's `output_media_kind`. Image evidence is byte-identical.
- **Package truth.** Each selected item carries `mediaKind` from the row and, for a video, its probed
  facts (duration, codec, audio codec, frame rate).
- **Generation stays with its owners.** The application door calls MV-4 register + ONE dispatch
  (MV-6 transport, provider selection, Director control and spend budget enforced there), MV-4 poll on
  an explicit human click (no scheduler), and MV-7 admission. No retry; `dispatch-unknown` stays
  unknown. Writer census unchanged (`tests/media1-asset-authority`).

## 3 · Production acceptance evidence (2026-09-27)

Human-performed by the Director in production `/operations` on deployment `9ffd024c`. Claude performed
no production review, selection, generation or database write; Claude's own read-only production
DB access was unavailable in this environment, so the evidence below is the Director's observation
through the released authoritative readers rendered by the deployed page.

**Asset (existing MV-7, reused — no new generation):**

```
asset            c3eb1139-08b8-4962-b1de-c1b9844d485e   (origin generated, invocation 895f7bd7…)
draft            57b57106-2848-41f7-a5b3-d2475e0b7dba   Turkish Rug House · content-draft · instagram
source revision  3
video            1024x576 · 3.0 s · h264 · no audio · 24/1 · 671 KiB (687549 B)
sha256           2a776ebb6d391461d18ca698479ffb7a52de55f1ecbcf106cbf1c8652571b80c
```

| Step | Result |
|---|---|
| Playback (signed read) | PASS |
| Review — reason "Production acceptance: generated video playback verified." → Accept video | PASS — badge **APPROVED**; no action request, permit or publish created |
| Selection — "Use in revision 3" | PASS — action answered `selected` |
| Content Package, authoritative re-read after `9ffd024c` + page refresh | PASS — "0 images · 1 video"; row "Video 1024x576 · 3.0 s · h264 · no audio · 671 KiB · approved · generated in revision 3" |
| Package readiness | NOT READY — only "The copy has not been reviewed yet." Expected; copy review is outside this program |
| Publish boundary | PASS — "A chosen video is part of this package only. Hebun cannot publish a video: no platform path accepts one." No Instagram or YouTube publish occurred |

**Production deltas caused by acceptance (Director-performed, product actions):** one Governance
decision on `c3eb1139` (accepted), one `content_selected_media` row (draft `57b57106…`, revision 3).
**By Claude:** none. Generation POST: **0**. Provider calls: **0**. Higgsfield connectivity: **DISABLED**,
unchanged. Provider credential configuration: none.

## 4 · Local verification

`tests/video-content-chain/chain-postgres.ts` (real Postgres, real VPS store, ffprobe; simulated
provider) and `chain-firewall.ts` (5 rules, 10 bites), plus content-compose1, media3, media1 firewall,
media2b, mv2, media4a, media-supplied, publish-0, mv7 firewall — PASS. Seven unrelated suites are red
at baseline `2be01616` as well and were left untouched (listed in the implementation record §6).

## 5 · The acceptance defect and its correction

At `fb1ed329` the selection **persisted** — the writer returns `selected` only after its insert
completes — but the Content Package panel beside it kept showing "0 images · 0 videos". The panel
fetched the package once, on mount, into client state; the action's `revalidatePath("/operations")`
re-rendered the server tree with unchanged props, so the panel never re-read. This was a
read/render-boundary defect, not an authority failure (it existed for image selection since
CONTENT-COMPOSE-1). `9ffd024c` reads each draft's package on the server with the released reader and
hands it to a stateless panel; `chain-firewall` rule 5 pins that boundary. The Director's refresh on
`9ffd024c` then showed the persisted selection.

## 6 · What this program does not prove or include

- supplied video review/selection (see §7)
- image-to-video
- Heby automatic Media orchestration or Heby-requested generation
- autonomous agent generation; scheduler/background generation or observation
- a real-provider run of the application door (connectivity DISABLED; Vercel production holds no
  Higgsfield configuration)
- Instagram video publishing
- YouTube OAuth, write, upload, publish, or its production acceptance
- post-publish measurement/learning
- APF / multiple durable agents

## 7 · Remaining debt

- **Supplied video** is admitted and playable but outside review and selection, because MEDIA-SUPPLIED
  keeps supplied IMAGES outside that path too. Changing it for video alone would split authority by
  kind; changing it for both changes image behaviour. Open Director decision; not changed here.
- **Registered-not-sent** rows (transport refused between register and dispatch) are shown truthfully
  but have no dispatch control.
- **Application door real-provider acceptance** would require a separate Director gate (Vercel env,
  control ARM, cost, POST budget).
- MV-7 debt carries forward unchanged (one approved output host, orphan-object risk without a store
  delete authority, ceremony writes no audit event).

## 8 · Next

**IMAGE → VIDEO** is the intended next Media capability and the next Director selection candidate —
**not selected, not authorized, not implemented.** Expected direction: an authoritative admitted image
asset as source lineage → the existing Media generation architecture → an image-to-video provider
profile/adapter → MV-4 lifecycle → MV-7 admission → MEDIA-3 review → CONTENT-COMPOSE-1 selection →
Content Package. It must not become a second Media authority, lifecycle, admission system, or a
provider-specific source of organizational truth.

```
GENERATED     != APPROVED != SELECTED != PUBLISHED
PACKAGE VIDEO != PUBLISHABLE VIDEO
PRODUCTION-ACCEPTED != PRODUCT-COMPLETE
```
