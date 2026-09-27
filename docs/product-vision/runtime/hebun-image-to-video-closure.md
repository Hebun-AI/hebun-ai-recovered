# IMAGE → VIDEO — Video Generated from an Admitted Image · Closure

Before this program, Hebun could generate a video only from text (MV-4/MV-6/MV-7). IMAGE → VIDEO made
an ADMITTED image the source of a Higgsfield image-to-video generation, through the SAME lifecycle
(MV-4), transport (MV-6), admission (MV-7) and lineage column (MEDIA-5) — and proved it in production
with exactly one real generation on a synthetic, non-sensitive source image.

**Implementation commit:** `df94e78a` (source verification, MEDIA-5 lineage on registration, input
digest v4, documented Higgsfield upload, PixVerse V6 image-to-video profile, separate control).
**Acceptance preparation commit:** `5a130086` (operator harness, fetch guard, control named in the
connectivity ceremony).
**Deployed commit at acceptance:** `5a130086` — `dpl_4V2sji8PJGQVf3QY1Yyh7XBkG4hq`, READY, production.
**Production migration:** none. Ledger **67**, unchanged.
**Implementation record (historical evidence, not a second authority):** `hebun-image-to-video.md`.

---

## 1 · Truth semantics

```
IMPLEMENTED                                        YES        df94e78a + 5a130086
DEPLOYED                                           YES        5a130086
MIGRATED (production)                              n/a        no migration; ledger 67 unchanged
REAL IMAGE-TO-VIDEO GENERATION                     VERIFIED   (production, exactly one)
GENERATED-VIDEO MEDIA ADMISSION                    VERIFIED   (production, MV-7 writer)
SOURCE → VIDEO LINEAGE                             VERIFIED   (production, MEDIA-5 column)
AUTHORITATIVE READ MODEL (origin generated)        VERIFIED   (production, released readers)
SIGNED RANGE READ OF THE VIDEO                     DIRECTOR-OBSERVED (not re-verified by Claude; see §3)
MEDIA REVIEW OF THIS VIDEO                         VERIFIED   (production, APPROVED — §9)
CONTENT SELECTION OF THIS VIDEO                    VERIFIED   (production, rev 3 — §9)
CONTENT PACKAGE REPRESENTATION                     VERIFIED   (production, authoritative re-read — §9)
PUBLISHING                                         NOT PERFORMED (no platform path accepts video)
APPLICATION DOOR, REAL PROVIDER                    NOT EXERCISED (operator harness only; see §6)
HIGGSFIELD CONNECTIVITY                            DISABLED   (both keys, version 2)
PRICE                                              UNKNOWN
REAL TRH / CUSTOMER IMAGES ON THIS PATH            NOT AUTHORIZED (Terms §4.4, see §5)
```

**IMAGE → VIDEO: PRODUCTION ACCEPTED / CLOSED** — for one Director-performed, harness-driven
generation on a synthetic source, followed through the existing VIDEO CONTENT CHAIN (§9). Nothing
here claims publishing, publish authorization or copy approval.

## 2 · The authority decision

- **No new authority, table, writer or migration.** Lineage is MEDIA-5's
  `media_generation_invocations.source_media_asset_id` ("the admitted image this attempt was performed
  ON"). Registration and polling stay MV-4; the Higgsfield transport stays MV-6; admission stays MV-7's
  single writer, which resolves the transport by the row's input mode.
- **Four facts stay four facts.**
  ```
  SOURCE SUPPLIED IMAGE   media_assets 3f7b9e66…  origin supplied (google-drive), image
  PROVIDER INVOCATION     media_generation_invocations a0d5ba5d…  higgsfield, provider-succeeded
  GENERATED VIDEO         media_assets ad4978da…  origin generated, video
  MEDIA ADMISSION         invocation.admission_outcome = admitted (MV-7)
  ```
  Review, selection and publishing are separate authorities (MEDIA-3, CONTENT-COMPOSE-1, PUBLISH-0)
  and were not exercised.
- **Supplied-media semantics unchanged.** The source is a supplied image; supplied images stay outside
  review and selection exactly as MEDIA-SUPPLIED left them. Being a SOURCE of a generation does not
  make a supplied image reviewable, and nothing here widens that.
- **Separate control.** `higgsfield-image-to-video` is its own row; arming text-to-video does not arm
  image-to-video, and the reverse.

## 3 · Production acceptance evidence (2026-09-27)

Performed by the Director through `apps/dashboard/scripts/i2v-production-acceptance.ts` on deployment
`5a130086`. Claude performed no production write, arming, provider call, upload or generation.

**Director-supplied ceremony evidence:**

| Step | Result |
|---|---|
| Preflight (read-only) | PASS; ledger 67 |
| Backup | `hebun_production_pre_i2v_acceptance_20260927-201205.dump`, 640153 B, 774 TOC entries, validated |
| Control | `higgsfield-image-to-video` enabled for the ceremony, then DISABLED (version 2) |
| Provider calls (harness fetch guard) | upload preparation **1**, upload PUT **1**, generation POST **1**, status GET **8**, refused **0**; no retry, no resubmit |
| Lifecycle | provider-succeeded; 6 polls; ~48 s harness wall time |
| Output host | `d3u0tzju9qaucj.cloudfront.net` — the exact approved host |
| Admission | admitted, 477513 B, H.264, no audio, 1280x720, 5042 ms, 24/1, brand isom |
| Read model | origin generated, invocation linked |
| Signed Range read 0-1023 | 206, 1024 bytes |
| Temporary store env | `~/.hebun-i2v-store.env` deleted, absence verified |
| Source policy | synthetic, non-sensitive PNG; no real TRH product image sent to Higgsfield |

**Independently re-verified by Claude (read-only, after the ceremony, 2026-09-27):** production target
bound to the G4 pin in a read-only transaction, then the released read seams
(`resolveDirectorEnabled`, `readAsyncMediaGeneration`, `listArtifactVideoGenerations`,
`listArtifactMediaVideos`, `readMediaAssetReviewState`). No store, provider or write path was used.

```
ledger                         67
higgsfield-image-to-video      director_enabled false · version 2 · production-operator-ceremony
higgsfield-video-generation    director_enabled false · version 2
resolveDirectorEnabled         false (both keys — the fail-closed kill-switch read)

source asset   3f7b9e66-b165-86df-ab9b-77fcc7d36f14
               image/png · 1280x720 · 30989 B · admitted · supplied google-drive
               sha256 3daa7c242f0349bbc9dfad2231059be3b9f8f0de4abba34dc66eb2e507ce9ccd
               draft 57b57106-2848-41f7-a5b3-d2475e0b7dba rev 3 · Turkish Rug House

invocation     a0d5ba5d-7804-44bc-a1f8-6bd620b00f15
               live · higgsfield · pixverse/v6/image-to-video@5s-720p-silent
               provider-succeeded · admission_outcome admitted · poll_count 6 · simulated false
               source_media_asset_id 3f7b9e66-b165-86df-ab9b-77fcc7d36f14
               source draft 57b57106… rev 3 · human-requested · durable agent 67f4460c…
               requested 20:14:44.861Z · accepted 20:14:47.168Z · completed 20:15:28.649Z (UTC)

generated      ad4978da-0839-44df-af28-411c55ab84b0
               video/mp4 · 1280x720 · 477513 B · h264 · no audio · 5042 ms · 24/1 · admitted
               sha256 59ee581e19417b20d9b9be6b75905f9611053e2e054ebb8e2f38e2a9ca9d60c7
               read model: origin generated · invocation a0d5ba5d… · source draft rev 3
               only asset for the invocation: yes
               review state: no decision (0) · content selections: 0

counts         media_assets 9 · invocations 4 · higgsfield 2 · higgsfield image-to-video 1
```

Status GET accounting is consistent with the rows: 6 lifecycle polls (`poll_count`) plus MV-7's two
admission status reads = 8. The file-level brand (`isom`) and the Range read were NOT re-verified by
Claude — they need the store credentials, which were deliberately deleted after the ceremony; they
stand as Director evidence. The backup file exists at the recorded path, 640153 B, 774 TOC entries
(`pg_restore -l`). Vercel production holds no Higgsfield variable (names listed, values never read).

## 4 · Local verification

Focused suites at `5a130086`, PASS: `tests/image-to-video/{transport-contract, source-firewall,
production-acceptance, lifecycle-postgres}` (lifecycle on a disposable real Postgres),
`tests/mv6-higgsfield-video/transport-contract`, `tests/mv7-generated-video/authority-firewall`,
`tests/video-content-chain/chain-firewall`. This closure changes documentation only, so the full suite
was not re-run; the known baseline red is listed in §7.

## 5 · Data-use boundary (unresolved)

Higgsfield's Terms of Use §4.4 (last updated 26 Jul 2026) allow inputs to be used for model training
absent an Enterprise Agreement. **Real Turkish Rug House, company or customer images remain NOT
AUTHORIZED for IMAGE → VIDEO** until that data-use / Enterprise Agreement question is explicitly
resolved by the Director. The code does not enforce "synthetic only" — the Director control and this
record do. The synthetic source was uploaded with `retention=temporary`; how long Higgsfield keeps it
is undocumented, and Hebun has no delete path for it.

## 6 · What this program does not prove or include

- copy review, package readiness, or any publish authorization (§9 stops at selection)
- publishing of any video (no platform path accepts one)
- the `/operations` application door with a real provider — Vercel production holds no Higgsfield
  configuration and both controls are DISABLED; the real generation ran through the operator harness
- price, billing or any estimate call
- real TRH/customer images (§5)
- Heby or agent-requested generation; scheduler or background generation
- any provider or model other than PixVerse V6 at `5s-720p-silent`

## 7 · Remaining debt

- **PRICE UNKNOWN.** No documented price for the profile; `POST /estimate` was never called because its
  non-billability is undocumented.
- **Data use (§5)** — the gate for any real image.
- **Application door real-provider acceptance** needs its own Director gate (Vercel env, control ARM,
  cost, POST budget).
- **Upload retention unknown** — Higgsfield-side lifetime of the uploaded source and of `public_url`.
- **`tests/prodmig-flow/boundaries-and-firewall.ts` red** at baseline: acceptance harnesses (MV-7,
  IMAGE → VIDEO) import the validated backup from `production-migration`. Firewall-policy decision
  left to the Director.
- **Director-only evidence** for file brand and Range read (store credentials deleted by design).
- MV-7 debt carries forward unchanged (one approved output host, orphan-object risk without a store
  delete authority, the ceremony writes no audit event).

## 8 · Next

Candidate, **not selected, not authorized, not started:** show a generated video's source lineage in the
Content Package itself — each package video item naming the admitted image it was generated from
(already on the invocation row as MEDIA-5 lineage), as a read-model change only: no new authority, no
migration, no provider call. The data-use decision (§5) is a separate Director decision that gates any
real image and is not a product build.

## 9 · Content chain follow-through (2026-09-27)

The generated video `ad4978da` was taken through the EXISTING VIDEO CONTENT CHAIN — MEDIA-3 review →
CONTENT-COMPOSE-1 selection → Content Package — with no code change, no new authority and no migration.

**Human-performed by the Director** in production `/operations` on deployment `7361505c`
(`dpl_DME212kSRi4Y7tw6gJJYC4Bt1yds`): playback verified; review reason "Production acceptance:
image-to-video output playback verified." → **Accept video** (UI: APPROVED, "Accepted. Nothing was
published."); **Use in revision 3** (UI: "Added to this draft. It appears in the content package above.").
**By Claude:** no production write — eligibility checked read-only BEFORE the actions, outcomes
re-verified read-only AFTER them through the released readers (`readMediaAssetReviewState`,
`readContentPackage`, `listArtifactMediaVideos`, `listArtifactVideoGenerations`,
`readAsyncMediaGeneration`, `resolveDirectorEnabled`), target bound to the G4 pin, ledger 67.

```
review        ad4978da  MEDIA-3 decision f7e28209-ac7e-499c-9894-ca709ff23c9e
                        subject media_asset · outcome media-asset-accepted · 20:37:08Z · 1 decision
selection     draft 57b57106… rev 3 (current revision 3): c3eb1139 + ad4978da, selected 20:37:51Z
package       rev 3, authoritative re-read: 0 images · 2 videos
                c3eb1139  1024x576 · 3042 ms · h264 · no audio · approved
                ad4978da  1280x720 · 5042 ms · h264 · no audio · approved
              blockers [copy-unreviewed] · ready false
lineage       ad4978da → invocation a0d5ba5d (admitted, provider-succeeded)
                       → source_media_asset_id 3f7b9e66 (synthetic supplied PNG)
controls      higgsfield-image-to-video false · higgsfield-video-generation false
side effects  since 20:30Z: action_permits 0 · heby_action_requests 0 · action_execution_attempts 0
counts        media_assets 9 · invocations 4 (unchanged) · no generation, no provider call
```

The media review is MEDIA-3's creative review of generated output, recorded in its own ledger. It is
not publish authorization and not copy approval; the package stays NOT READY on the copy alone. No
video was published — no platform path accepts one. Supplied-media semantics are unchanged: the
supplied SOURCE image is still outside review and selection. The package item does not show the
source image; lineage is visible on the generation row ("from image 3f7b9e66") and in the invocation
row (§8 candidate).

```
SOURCE SUPPLIED  != GENERATED
GENERATED        != ADMITTED != APPROVED != SELECTED != PUBLISHED
PRODUCTION-ACCEPTED != PRODUCT-COMPLETE
SYNTHETIC ACCEPTED  != REAL IMAGES AUTHORIZED
```
