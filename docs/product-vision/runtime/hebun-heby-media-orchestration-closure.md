# HEBY MEDIA ORCHESTRATION (HEBY-MEDIA-1…4) · Closure

Before this program Heby could not see media at all: no source class read media, generation,
review, selection or the Content Package, and no agent-originable action touched them. The program
gave Heby a read-and-recommend layer over the authorities that already own media — and nothing
else. Heby reads, reasons, recommends, prepares and observes. Humans act through the existing
gates, and the existing writers stay the only authorities.

```
READ → RECOMMEND → PREPARE → HUMAN ACTS (existing authority) → OBSERVE → NEXT STEP
```

| Phase | Commit | What it added |
|---|---|---|
| HEBY-MEDIA-1 | `3328a7f0` | `content-media` Heby source class (Operations only): each open content draft's media, review records, video attempts with source lineage, package summary, two Higgsfield switches. Caption preparation resolves it unread. |
| HEBY-MEDIA-2 | `e36ac1d5` | Pure deterministic media-choice evaluator: closed kinds and codes, no score. |
| HEBY-MEDIA-3 | `851d86b0` | Pure, ephemeral human-gate prefill on `/operations`; the only reachable mutation is the existing per-asset selection action on an explicit click. |
| HEBY-MEDIA-4 | `41f7087a` | Pure next-step observation: current state, the existing human action it points at, and whether the media part is complete. |

Discovery decision (Director-accepted): **B — a narrow read-and-recommend layer; no new authority,
subsystem, table, action kind or migration.** Production ledger **67** throughout.

## 1 · Truth semantics

```
HEBY READS DRAFT MEDIA (content-media)              VERIFIED  (production, read-only)
DETERMINISTIC RECOMMENDATION                        VERIFIED  (production, read-only)
HUMAN-GATE PREFILL (selection only)                 VERIFIED  (production, read-only: satisfied)
OBSERVED NEXT STEP                                  VERIFIED  (production, read-only: media-complete)
GENERATION PREFILL                                  NOT AVAILABLE (every path price-unknown)
ANY HEBY-PERFORMED MUTATION                         NONE (by construction; pinned by tests)
PRODUCTION MUTATION FOR ACCEPTANCE                  NONE
```

**HEBY MEDIA ORCHESTRATION (first program): CLOSED.**

## 2 · The boundary

- Three pure modules (`media-choice.ts`, `media-prefill.ts`, `media-next-step.ts`) with type-only
  imports, and one shaper (`heby-content-media-source.server.ts`) whose import list is pinned to the
  released readers: `listWorkArtifacts`, `listArtifactMediaAssets`, `listArtifactMediaVideos`,
  `listArtifactVideoGenerations`, `readMediaAssetReviewStates`, `readContentPackage`,
  `resolveDirectorEnabled`. One read feeds both the Heby grounding and the `/operations` panel.
- Eligible existing media = admitted, generated, MEDIA-3 review accepted. Supplied media is outside
  review and selection and is never eligible or "awaiting review".
- Blockers and unknowns stay visible: `provider-disabled`, `provider-state-unknown`,
  `provider-readiness-unverified`, `price-unknown` (every generation path), `data-use-unresolved`
  (every image-to-video path, no exception for any asset id), `destination-rule-unknown` (always),
  `publish-capability-unavailable` (video, TikTok, YouTube).
- Media orchestration stops at `media-complete`. Copy review, Governance and publishing are named as
  outside the loop and never pursued. A ready package is not publish capability, authorization or a
  publish.

```
MEDIA COMPLETE != CONTENT PACKAGE READY != PUBLISHABLE
PROVIDER SUCCEEDED != ADMITTED != REVIEW ACCEPTED != SELECTED
RECOMMENDED != PREPARED != SELECTED
```

## 3 · Production acceptance (read-only, 2026-09-28)

G4-pinned target, ledger 67, released readers only. Draft `57b57106-2848-41f7-a5b3-d2475e0b7dba`
(Turkish Rug House, Instagram), revision 3:

| Layer | Result |
|---|---|
| content-media | 0 images · 2 videos selected; package ready no; blocker `copy-unreviewed`; `ad4978da` generated from image `3f7b9e66`; supplied `b4a8491e` and `99a0bf52` outside review; both Higgsfield switches off |
| recommendation | `use-existing` [`ad4978da`, `c3eb1139`]; reasons `existing-selection-reviewed`, `supplied-media-outside-review`, `publish-capability-unavailable`; unknown `destination-rule-unknown`; every generation path blocked |
| prefill | `satisfied` — no selection needed |
| next step | `media-complete`, human action `none`; package not ready; outside media: `copy-unreviewed` |

No storage key, URL, provider output reference, digest or Drive id appeared in any output. No
production write, generation, poll, admission, review, selection, publish or connectivity change.

## 4 · Verification

Focused suites: `tests/heby-media-1…4`, `heby-integration/contracts`, `cgo6` (real Postgres),
`cgo7`, `cgo3`, `e28`, `media1` firewall, `content-compose1`, `video-content-chain` firewall,
`media2b`, `media3`, `cgo9`; `tsc` and eslint clean; Turbopack `next build` clean for phases 3 and 4.
Red at baseline and untouched: `agent-runtime-0`, `cmdb2` navigation, `ops-p1` preparation firewall.
The full suite was not re-run.

## 5 · Not part of this program

Autonomous or agent-initiated generation; provider execution by Heby; automatic polling, admission,
review or selection; publishing; Governance authorization; spend authority; data-use authority;
destination-specific media policy; generation prefill; chat-native action buttons.

## 6 · Remaining debt

- **Data use:** no provenance/data-use classification exists; image-to-video stays unresolved.
- **Price:** no price representation exists; generation cannot become actionable.
- **Destination rules:** none encoded; video publishing absent.
- **Image generation switch** is not read by `content-media`.
- The prefill panel reads separately from the page's own reads; the writer remains the arbiter.
- Draft cap of 10 in grounding.
- No production observation of a live Heby model answer grounded on `content-media`.

## 7 · Next

Candidate, **not selected, not started:** a data-use / provenance authority (who may declare an
asset cleared for an external provider's terms), the prerequisite that blocks every image-to-video
path and any future actionable generation.
