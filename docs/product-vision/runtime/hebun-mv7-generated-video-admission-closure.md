# MV-7 — Generated Video Admission · Closure

Before MV-7, a provider-generated video could reach `provider-succeeded` in the MV-4 lifecycle and
stop there: the Media authority had no writer that could take the provider's output, verify it from
bytes and admit it as a `generated` asset. MV-7 added that writer inside the existing Media authority
and proved it end to end against one real production generation.

**Implementation commit:** `e36e143a` (generated-video admission writer, output location, bounded
download seam). **Output host pin:** `0dcc73d6` (`HIGGSFIELD_OUTPUT_HOSTS`, one exact host,
Director-approved). **Production acceptance harness + production reach decision:** `c2905715`.
**Deployed commit:** `c2905715` — `dpl_ERg6UgpwEwWoEK5mnhpAwMyfkZjG`, READY, production, serving
`www.hebuntech.com` and `hebuntech.com`.
**Production migration:** none. Ledger **67**, unchanged.

---

## 1 · Truth semantics

```
IMPLEMENTED                                   YES   e36e143a + 0dcc73d6 + c2905715
DEPLOYED                                      YES   c2905715
MIGRATED (production)                         n/a   no migration; ledger 67 unchanged
HIGGSFIELD REAL-PROVIDER GENERATION           VERIFIED   (production, one job)
GENERATED-VIDEO PRODUCTION ADMISSION          VERIFIED
STORAGE V2 PRODUCTION PERSISTENCE             VERIFIED
GENERATED-VIDEO AUTHORITATIVE READ/PLAYBACK   VERIFIED
EXACT-HOST FAIL-CLOSED OUTPUT RETRIEVAL       VERIFIED
PRODUCTION CONNECTIVITY AFTER CEREMONY        DISABLED   (version 2)
VERCEL PRODUCTION PROVIDER CREDENTIAL         NOT CONFIGURED
VERCEL PRODUCTION VIDEO TRANSPORT SELECTION   NOT CONFIGURED
```

**MV-7: PRODUCTION ACCEPTED / CLOSED.**

## 2 · What MV-7 does not prove or claim

- automatic Heby video orchestration
- application route- or action-triggered video generation
- image-to-video
- YouTube upload or publish
- always-on Higgsfield production connectivity
- Vercel production provider credential configuration

The accepted path is an **operator harness** (`apps/dashboard/scripts/mv7-production-acceptance.ts`)
calling released writers. No product surface dispatches a video generation or admits its output.

## 3 · The authority decision

- **No new authority, table or migration.** The admission writer
  (`admit-generated-video.server.ts`) is the sole owner of an async invocation's
  `admission_outcome`. It admits only from `provider-succeeded` + `not-attempted` (CAS), writes the
  asset row and the admission outcome in one transaction, and records a verdict only about bytes.
- **Output location is a status read, not a dispatch.** The transport's `locateOutput` makes one
  status GET, touches no spend budget and reveals the output URL only in memory. The URL is never
  stored or logged.
- **Exact host before any byte.** An output is fetched only from a host in
  `HIGGSFIELD_OUTPUT_HOSTS` (exact match, no wildcard, no IP literal), resolved to public addresses
  only, with every redirect hop re-checked, bounded by the 20 MiB Media ceiling. A host outside the
  set stops the run before any byte is fetched and leaves the invocation `provider-succeeded` /
  `not-attempted`.
- **Verified from bytes.** Bytes stream into a write-once Storage V2 key with a required store probe;
  the store's byte count and SHA-256 must equal the relay's; the same video policy the supplied-video
  path uses (`evaluateVideoPolicy`, MP4 major brand) decides admissibility.
- **Provenance through the invocation.** The asset carries `invocation_id`; the invocation carries
  the tenant, the exact draft revision, the requesting human and the durable agent. `supplied_source`
  is null.
- **Production reach of the control.** `c2905715` enumerated `higgsfield-video-generation` in
  `GENERIC_PRODUCTION_REACHABLE_KEYS`, the same decision MEDIA-2B made for images. That made it
  armable, not armed. Arming and disarming used the existing generic connectivity ceremony only.

## 4 · Production acceptance evidence (2026-09-27)

**Gates, in order:** `origin/main` = deployed = `c2905715` · preflight PASS (read-only: target bound,
ledger 67, TRH draft, Director membership, durable agent, control, counts, signed store verify of an
existing video) · validated backup · Director ARM · one run · Director DISARM · independent read-only
verification.

**Backup:** `~/Developer/hebun-backups/hebun_production_pre_mv7_acceptance_20260927-132243.dump`,
637686 bytes, `pg_restore -l` PASS, 774 TOC entries, PostgreSQL 18.6 (custom format).

**Provenance:** tenant Turkish Rug House · draft `57b57106-2848-41f7-a5b3-d2475e0b7dba` revision 3
(content-draft, draft) · requested by the Director's active membership (human) · durable agent
`67f4460c-0d44-4ae7-a3ed-729c705e2609`.

**Generation:**

```
provider / transport       higgsfield / live
model / profile            pixverse/v6/text-to-video@3s-540p-16x9-silent  (pinned, unchanged)
invocation                 895f7bd7-ca29-45e7-8b67-d08815492d1d
provider request id        95b45ba6-909f-44fb-ad61-0007ea0dac7f
lifecycle                  provider-succeeded; output ref = request id
dispatch                   exactly 1 POST; no retry, no resubmit, no second generation
polls                      5, ~33 s
provider requests (run)    1 POST, 7 GET, 0 refused
output host                d3u0tzju9qaucj.cloudfront.net  (the one approved exact host)
```

**Admission and storage:**

```
admission_outcome          admitted; admission_failure null
asset                      c3eb1139-08b8-4962-b1de-c1b9844d485e
bytes / sha256             687549 / 2a776ebb6d391461d18ca698479ffb7a52de55f1ecbcf106cbf1c8652571b80c
video                      mp4 (isom), h264, no audio, 1024x576, 3042 ms, 24/1
backend                    hebun-vps (Storage V2); store verify: size and SHA match the row
assets for invocation      exactly 1; supplied_source null
```

**Playback:** read model origin `generated`, invocation linked, signed grant issued,
`Range: bytes=0-1023` → HTTP 206, 1024 bytes. Re-verified independently after DISARM.

**Production deltas:** invocations 2 → 3 · Higgsfield invocations 0 → 1 · media_assets 6 → 7 ·
Turkish Rug House assets 4 → 5 · VPS objects 13 → 14. Ledger 67 → 67.

**Connectivity after acceptance:** `higgsfield-video-generation` DISABLED, version 2, source
`production-operator-ceremony`, `updated_by` NULL. Vercel production holds neither
`HEBUN_HIGGSFIELD_API_KEY` nor `HEBUN_VIDEO_GENERATION_TRANSPORT`; the deployed app cannot dispatch a
video generation even with the control ON.

## 5 · Remaining technical debt (non-blocking)

- **Output host allowlist** holds only `d3u0tzju9qaucj.cloudfront.net`. A provider host change fails
  closed (stop before fetch) and requires an explicit Director approval and a code change.
- **Profile name vs output.** The profile is named `540p`; the observed output was 1024x576.
- **No product entry point.** No application route or action invokes async generation or generated
  admission; only operator harnesses do.
- **No store delete authority.** A rejected admission after bytes are stored leaves an object no row
  names; that orphan risk remains.
- **Existing orphan objects** from earlier phases remain on the store.
- **Connectivity ceremony writes no audit event** (terminal has no actor; `updated_by` is NULL).
- **Automatic Heby orchestration** of video is not part of MV-7.

```
GENERATED              != APPROVED != PUBLISHED
CONTROL ARMABLE        != ARMED
PRODUCTION-ACCEPTED    != PRODUCT-REACHABLE
```
