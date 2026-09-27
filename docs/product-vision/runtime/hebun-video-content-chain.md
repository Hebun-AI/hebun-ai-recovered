# VIDEO CONTENT CHAIN — Implementation Record

**State:** SELECTED / IN PROGRESS · IMPLEMENTED · locally VERIFIED · **production acceptance NOT done** ·
**not CLOSED**. This is an implementation record, not a closure record.

**Baseline:** `origin/main` = `2be01616` (MV-7 closure). Branch `feat/video-content-chain`.
**Schema:** no migration. Ledger unchanged (67).

## 1 · What it does

A generated video joins the content workflow through the authorities images already use:

```
authenticated human → content draft revision
  → request text-to-video       MV-4 register → ONE dispatch (MV-6 transport, control, budget)
  → observe                     MV-4 poll, one status read per human click (no scheduler)
  → admit                       MV-7 admission (exact host → bounded stream → Storage V2 → policy)
  → review                      MEDIA-3 Governance review (subject media_asset, digest-bound)
  → select                      CONTENT-COMPOSE-1 (MEDIA-SELECT-INTEGRITY draft binding)
  → Content Package             selected item carries mediaKind "video" + probed facts
  → playback                    MV-3 signed read, Range 206
```

## 2 · Phase 1 authority answers

| | Question | Answer |
|---|---|---|
| A | MEDIA-3 review for video without changing semantics? | Yes. Same subject type, decision words, digest binding, derived state. The MV-2 blanket `asset-not-image` becomes `asset-kind-incoherent`: the asset's `media_kind` must equal its invocation's `output_media_kind`. Image evidence is byte-identical; video evidence adds kind + probed facts. |
| B | Selection without a new authority? | Yes. `content_selected_media` has no kind constraint; only the code guard changed, with the same coherence rule. MEDIA-SELECT-INTEGRITY join unchanged. |
| C | Schema already represents it? | Yes (MV-2 video columns, MV-4 `output_media_kind`). |
| D | Migration needed? | No. No CHECK, enum, trigger or FK restricts kind in review or selection. |
| E | Reuse MV-4/MV-6/MV-7? | Yes. `requestAsyncVideoGeneration` = the released register + dispatch, once. Poll and admission are called unchanged. No new writer (writer census in `tests/media1-asset-authority` unchanged). |
| F | Who owns completion observation? | The human, by an explicit "Observe" click → `pollAsyncMediaGeneration`. No job system. |
| G | UI from authoritative reads? | Yes. Two new reads: `listArtifactMediaVideos` (supplied + generated, per draft, with source revision) and `listArtifactVideoGenerations` (lifecycle view; the output reference never leaves the lifecycle — only `providerOutputReported`). |
| H | Governance/execution widened? | No. No action request, permit, execution or publish path is reachable. |

## 3 · Files

Server: `media-asset-review/{contracts,review-media-asset.server}.ts`,
`content-composition/{contracts,select-media.server,read-content-package.server}.ts`,
`media-assets/async-generation-lifecycle.server.ts` (+ `requestAsyncVideoGeneration`,
`listArtifactVideoGenerations`), `media-assets/read-media-videos.server.ts` (+ `listArtifactMediaVideos`),
`app/(dashboard)/operations/actions.ts` (+5 pass-through actions).
UI: `generate-video-with-hebun.tsx` (new door), `revision-media-videos.tsx` (`DraftVideos`: attempts,
observe, admit, review, select, play), `content-package-panel.tsx` (kind + video non-claim),
`operations-preparation.tsx` (server reads; drafts with only videos now render),
`revision-media-assets.tsx` (refusal wording).
Tests: `tests/video-content-chain/{chain-postgres,chain-firewall}.ts` (new);
`tests/media1-asset-authority/authority-firewall.ts` and `tests/mv2-media-video/video-authority-postgres.ts`
updated deliberately (door enumeration; refusal name).

## 4 · Truth rules held

```
control OFF / no credential / no selection  → refused before registration, nothing written
dispatch-unknown                            → recorded as unknown; never retried; same key sends nothing
provider-pending / unreadable observation   → pending, not failed
provider-succeeded                          → not admitted; no video listed
admission refused before a verdict          → nothing recorded
admitted ≠ reviewed ≠ selected ≠ published
selected video                              → package says VIDEO; "Hebun cannot publish a video"
publish chain                               → selectMediaAssetRecord returns null; derivePublishJpeg refuses
```

## 5 · Deliberately NOT done

- **Supplied video review/selection.** MEDIA-SUPPLIED keeps supplied IMAGES out of review and selection
  (review is of generated output; the package reads through the invocation). Opening that for video
  alone would give video a different authority than image; opening it for both changes image
  behaviour. That is a Director decision, not part of this program. Supplied videos are listed and
  playable only.
- **Registered-not-sent re-dispatch.** A row left `registered` (transport refused between register and
  dispatch) is shown truthfully; there is no button to dispatch it.
- **Image-to-video.** Not implemented. Intended next Media capability.
- **YouTube / Heby orchestration / APF.** Not started.

## 6 · Verification (local, 2026-09-27)

- `tests/video-content-chain/chain-postgres.ts` — real Postgres + real VPS store + ffprobe: PASS.
- `tests/video-content-chain/chain-firewall.ts` — 4 rules, 6 bites: PASS.
- Related suites (media*, mv*, content-compose1, content-ground1, publish-0, ops-p1-flow, instagram*,
  agent-runtime-0): all PASS except four that are **red at baseline `2be01616` too**:
  agent-runtime-0 ×3 (`media_assets_supplied_human_chk` census),
  `instagram-oauth-admission/ceremony-firewall` (scope census), `ops-p1-flow/{preparation-firewall,
  bite-proofs}` (PUBLISH-0 inlet census) and `media2a-openai-image-transport/bite-proofs` (B12 anchor).
  74 PASS / 7 baseline-red in that set.
- `tsc --noEmit` clean; eslint clean on touched paths.

## 7 · Production acceptance — pending

Non-billable plan: after deploy, the Director opens `/operations`, sees MV-7 asset
`c3eb1139-08b8-4962-b1de-c1b9844d485e` under Turkish Rug House draft `57b57106…` (generated from
revision 3), plays it, reviews it (a real Governance act — only the Director may perform it), selects
it, and the Content Package shows it as a video. The application generation door is expected to answer
**Not sent** in production (Vercel holds no Higgsfield configuration; control DISABLED) — that is the
truthful fail-closed state, and it is not a billable call. A real application-path generation would
need a separate Director gate (env + control + cost).
