# MEDIA-SUPPLIED — Human-Supplied Images as a Third Media Origin · Closure

Before MEDIA-SUPPLIED, the Media authority could hold only images Hebun made itself: `generated`
(MEDIA-2B / MEDIA-5) and, since PUBLISH-0, `derived` (`jpeg-publish-v1`). An organization's own
photograph — the real rug, shot by a person — had no admitted path into Media, so the first real
publish would have had to use an AI image or bypass the authority. MEDIA-SUPPLIED closed that gap
inside the existing authority rather than beside it.

**Implementation commit:** `72d2868202bb1714c547014795485c598edc0414`.
**Least-privilege correction:** `3db976a631d19f41aae95aecf03df69660459151` (Google Picker +
`drive.file` only; no schema change). **Deployed commit:** `3db976a6` — the same release that carries
PUBLISH-0's production deployment (`dpl_JCCAaKrchZHv2spus57AzhN5tJu7`, Ready).
**Production migration:** `20260925055841_media_supplied_origin` — ledger **62 → 63**.

---

## 1 · Truth semantics

```
IMPLEMENTED                              YES   72d28682
LEAST-PRIVILEGE CORRECTED                YES   3db976a6
DEPLOYED                                 YES   3db976a6
MIGRATED (production)                    YES   ledger 62 -> 63
PRODUCTION ADMISSION ACCEPTED            YES   post-check 34/34 PASS
USED BY A REAL PUBLISH                   YES   PUBLISH-0 (see hebun-publish-0-closure.md)
```

**MEDIA-SUPPLIED: RELEASED + PRODUCTION-ACCEPTED / CLOSED.**

---

## 2 · The authority decision

- **A third origin on the existing `media_assets` authority. No new table.** `supplied` sits beside
  `generated` and `derived`; the origins are CHECKed mutually exclusive in typed columns.
- **Provenance is explicit, typed and non-optional:**

  ```
  Google Drive  ->  human supplier  ->  exact work-artifact revision  ->  Media authority
  ```

  Stored as columns, not free text: the supplying human, source `google-drive`, the Drive file id,
  the content capability the bytes were read under, and the draft revision the asset belongs to.
- **Admission verifies from bytes**, not from Drive metadata alone: closed type set JPEG / PNG /
  WebP, metadata-first, 20 MiB cap, write-once store and verify-as-stored, idempotent deterministic id.
- **Reads carry origin.** The gallery marks a supplied asset as supplied and never as AI-generated.

## 3 · Source model — Google Picker + `drive.file`

The first cut (`72d28682`) accepted a pasted Drive link and read under the Drive-wide
`drive.readonly` capability. That reversed the already production-accepted least-privilege model
(MASTER-ROADMAP §12B). `3db976a6` corrected it before production acceptance:

- Media gained its own entry in the existing Picker ceremony beside the unchanged Knowledge entry.
  Both share one private token handoff, which remains the only module that returns a Google token.
  The Media entry requests no Knowledge authority.
- Google's chooser is limited server-side to JPEG / PNG / WebP; only the selected file id is admitted.
- The Drive image seam and supplied admission take no capability input and read **only** under
  `google.drive.file.content.read`. A read reporting any other grant is refused. The pasted-link
  parser was removed.
- The Google integration page offers the per-file grant as its own opt-in; default Connect scopes
  are unchanged.

```
ACCEPTED PATH      Google Picker + drive.file   google.drive.file.content.read AVAILABLE
NOT GRANTED        drive.readonly / Drive-wide content access
NOT ACCEPTED       any pasted-link or Drive-wide read path
```

## 4 · What a supplied asset is NOT

- **Not reviewable by MEDIA-3.** Generated-media review does not take supplied assets.
- **Not selectable by the composer** and **not a MEDIA-5 reference-edit input.**
- **Not a publish input as-is.** Publishing uses a deterministic `jpeg-publish-v1` derivative
  (§5); the supplied original is never sent to a provider.
- **Admission is not authorization.** It created no Governance decision, no permit, no execution
  attempt and no publish request.

## 5 · Publish derivative lineage

`jpeg-publish-v1` derivation and PUBLISH-0's lineage checks accept a supplied original (refusal
code renamed `source-not-original`). One derivative per source, same tenant, JPEG only; the proposal
binds both digests and execution re-verifies them (see PUBLISH-0 closure §4).

## 6 · Production acceptance

```
migration          20260925055841_media_supplied_origin   ledger 62 -> 63
admission post-check                                      34/34 PASS
supplied asset     b4a8491e-8011-8d29-8697-7dc942281d87
source file        Rc_22188_0_Black_Rose_Kilim_Rugs.jpg
Drive file id      1MH8wDjal8C9MPUwT38uhB218HnyraNyQ
draft              work-artifact/57b57106-2848-41f7-a5b3-d2475e0b7dba@3
capability         google.drive.file.content.read
```

Admission side effects: one `media_assets` row of origin `supplied`; zero decisions, permits,
attempts or publish requests. The asset later became the original behind PUBLISH-0's derivative
`78bff036-3ed7-8456-bef0-3a5c2b122b06`.

## 7 · Limitations recorded

1. **Safari Google Picker failed during acceptance; Chrome succeeded.** One observation, not a proven
   universal Safari incompatibility.
2. Supplied assets have no review surface of their own; they enter the publish path only through a
   human `/publish` proposal and Governance approval.

**MEDIA-SUPPLIED IS CLOSED — RELEASED + PRODUCTION-ACCEPTED.**
