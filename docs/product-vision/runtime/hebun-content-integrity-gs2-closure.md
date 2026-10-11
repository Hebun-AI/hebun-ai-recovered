# CONTENT-INTEGRITY GS-2 · Release Closure

GS-2 is deployed and observed in production. The advisory grounding check now flags a dropped qualifier and an
unstated quality/selection process, in English and Turkish, and the review control opens the evidence when a
reviewer starts to decide. It decides nothing. Detail of the change and every benchmark movement:
`hebun-content-integrity-gs2.md`.

```
GROUNDING CHECK      == advisory comparison of words, never a verdict on truth
INSUFFICIENT         != rejected, blocked or unpublishable
CONTENT ACCEPTED     != publication authorized
```

| Item | Value |
|---|---|
| Implementation | `36e15898` (signals, EN/TR method equivalence, review auto-open) |
| Pre-release corrections | `9efbd966` (every benchmark movement pinned by case id, ESLint fix without suppression, manual-inspection line on `unavailable`) |
| Release | fast-forward `2c6a4129..9efbd966`, 2026-10-11 |
| Production deployment | `dpl_4Ep2vfGA2GRY7ZhaFJgXgycgpmB7` READY, `gitSource.sha 9efbd966`; re-read from the served page 2026-10-11 |
| Rollback target | `dpl_GJzNEvCUGj8ZC6VsHVHFpJqt7MR1` (`2c6a4129`) |
| Schema | none; no migration |

## 1 · Verified acceptance

- Benchmarks: all five frozen sets re-run against `2c6a4129`. `falseSupported` 0 on every set. Four cases moved,
  each pinned by id; GS4-013 moved away from the Director's label and is recorded as human-label review required.
- Focused tests on PG18 (`:55433`): baseline 52/0 at `2c6a4129`, candidate 54/0, no regressions. Mutations 5/5
  bite. `tsc` 0. ESLint: no new error.
- Local browser acceptance on a disposable PG18 tenant: register → genesis → Governance authority → agent →
  Knowledge ratify + public use → prepare (fake transport) → review. All requirements seen except a true
  `unavailable` evidence state, which is proved by the server-render test only.
- Production, Director session, before and after deploy: Operations 5 artifacts, revision 5 awaiting review;
  Approvals pending 2 / approved 11 / published 3 / drafts 5 / failed 0; permits 8; pending action requests 0;
  Knowledge 5 ratified, 3 allowed for public use.
- Production, revision 5 evidence panel: 3 public-use-eligible Knowledge records supplied whole; check result
  "Some sentences state things the supplied Knowledge records do not state"; manual-inspection line shown; flagged
  sentences:
  - "Handmade rugs, kilims and cushions…" / "El yapımı halılar, kilimler ve yastıklar…" — `qualifier-dropped`
    (Knowledge: most of the range is handmade).
  - "…a carefully selected collection…" / "…seçilmiş geleneksel tekstil koleksiyonu…" — `quality-process`.
  - Hashtag lines — `proper-noun` (acceptable flag; the check compares words, not meaning).

## 2 · Content Agent operational state at closure (re-read 2026-10-11)

- Knowledge v2 ratified and allowed for public use; the generator grounds on it.
- Revision 5 (TRH, Instagram, written by the organization's durable agent): awaiting Governance review. Not
  accepted, not rejected.
- No publication after the release: the latest provider-accepted publication is 2026-10-10 12:04 UTC, before the
  deploy.
- No execution authority introduced: pending action requests 0; the only standing envelope (Heby, record-work) is
  revision 4, withdrawn; no new permit.

The Content Agent prepares a grounded draft and shows a reviewer where it goes beyond Knowledge. A human decides.
It is not autonomous, and accepting content authorizes no publication: publishing remains a separate proposal,
Governance decision, single-use permit and arming.

## 3 · Known limitations

- The check is lexical. It can miss a paraphrased unsupported claim and can flag an acceptable one (hashtags).
  Semantic grounding was rejected at GS-4 and is not part of this release.
- GS4-013: GS-2 disagrees with the Director's human label; unresolved.
- Insufficient grounding does not block acceptance. Whether accepting an insufficient revision should require an
  acknowledgement is a Governance decision, not taken.

## 4 · Deferred

- **React #418 (hydration text mismatch) — NON-BLOCKER, deferred debt.** Reproduced on every load of
  `/operations` and `/approvals`; not on `/knowledge`. Cause, from server HTML vs client DOM: timestamps rendered
  with `new Date(…).toLocaleString()` and no time zone in client components — server UTC, browser UTC+3
  ("10/10/2026, 12:04:04 PM" vs "3:04:04 PM"). Sites: `action-authorizations.tsx:734` (permit "expires"),
  `revision-media-assets.tsx:292` ("Admitted"); the same pattern exists in `execution-ledger.tsx`,
  `revision-media-videos.tsx`, `agent-outcome-observation.tsx`, `section-detail-list.tsx`,
  `widget-runtime-board.tsx`. Pre-dates GS-2 (files from 2026-08-16 and 2026-09-18; the GS-2 diff touches no date
  formatting). React recovers by rendering on the client; after the error the page handlers work (an image
  disclosure in the affected component opened on click). Only display text differs; no decision, revision or
  authorization path reads it. Smallest fix when scheduled: one shared formatter with an explicit `timeZone` (and
  locale), used by these call sites.
- Provider-id surface, `expectedRevisionNo` on review, stale `PUBLIC_USE_NON_CLAIMS` line (carried from GS-2).

## 5 · Next human act

Revision 5 goes to Governance as **Request changes** (Operations → the draft → History → revision 5 → Request
changes → reason → Record changes requested). Suggested reason:

> Two claims go beyond ratified Knowledge. 1) "Handmade rugs, kilims and cushions" / "El yapımı halılar, kilimler
> ve yastıklar" drops the qualifier: Knowledge says most of the range is handmade, not all of it. 2) "carefully
> selected collection" / "seçilmiş koleksiyon" states a selection process no record states. Keep the qualifier and
> remove the selection claim. Hashtags are fine.
