# YOUTUBE-WRITE-2 · One Governed Upload to the Organization's Own Channel · Closure

One approved video from a ready Content Package was uploaded, once, PRIVATE, to Turkish Rug House's
own verified YouTube channel — through the existing proposal → Governance → permit →
`executeAuthorizedAction` → attempt-ledger chain, under TENANT-ARM-1 and the root external-send
control. No second authority, no durable YouTube state.

```
PREPARED != AUTHORIZED != EXECUTION STARTED != UPLOAD SESSION != BYTES TRANSFERRED
         != VIDEO RESOURCE CREATED != PROCESSED != VISIBLE
PACKAGE READY        != AUTHORIZED TO PUBLISH
ACCEPTED (ledger)    == a video resource exists, nothing more
```

| Item | Value |
|---|---|
| Implementation | `e9a715cd` (proposal, capability `google.youtube.video.upload`, upload adapter `youtube-resumable-upload-v1`, read-back) |
| Acceptance-path repair | `4779b92f` — MV-7 production harness ledger pin 67 → 68 (stale pin only) |
| Deployment at acceptance | `4779b92f` → `dpl_H1CXB656UGrDzkhfdo1Wi6CNk1n1` READY |
| Schema | migration 68 (`20260928084834_youtube_write2_recipientless_kind`, CHECK widen only); **ledger 68** |
| Production acceptance | 2026-09-28, TRH, one real private upload |

## 1 · What was built (`e9a715cd`)

- **Action kind `publish-youtube-video`** under the PUBLISH-0 chain. `/publish-youtube <draft@rev>
  <video> <privacy> <category> <made-for-kids yes|no> <synthetic yes|no>` files ONE pending request;
  it authorizes and uploads nothing.
- **Every consequential fact is read from its owner and sealed in the payload digest:** the one
  write-capable `google-youtube` connection and its Google account (`sub`), the one channel
  `channels.list?mine=true` names for that token, the Content Package's title and copy verbatim
  (refused, never truncated, outside YouTube's limits), the package's own `ready`, the selected approved
  video and its byte digest, the revision digest. Privacy, category and the two declarations are the
  human's inputs, bound by the same digest and persisted nowhere else.
- **Execution** re-checks, before spending: arming conjunction, record binding, package binding,
  connection + account, channel. After the atomic spend (permit + attempt + audit): arming again,
  package again, bytes verified by Media against the sealed digest, channel re-read with the uploading
  token, ONE resumable upload. An interrupted upload is recovered only by the documented status query;
  a lost answer is `unknown` and never retried.
- **Read-back** (`readYouTubeUploadedVideo`, `/approvals`) asks YouTube on demand for upload/processing
  status, applied privacy and channel. Nothing is stored.
- **Migration 68** widens `action_execution_attempts_recipient_binding_chk` to admit the
  recipient-less kind (ledger 67 → 68).

## 2 · Production acceptance (2026-09-28)

**Content Package** — TRH draft `e6c38ea3-81f5-4a73-bfd6-d89295878dda`, destination `youtube`.

- Revision 1 (agent-authored) called the kilim "hand-knotted"; the Director did not accept it.
- Revision 2 (agent-authored, `d04fa83e…3f30`) accepted as text — decision `d5717f04`. Copy acceptance
  does not assert that a not-yet-generated video matches it; Media review judged the video separately.
- Video `3793184a-77b2-4972-8092-b926b7eb0052` generated through the `/operations` application door
  (invocation `7a27f8b4`, Higgsfield PixVerse V6 `3s-540p-16x9-silent`, text-to-video), admitted
  (791137 B, SHA-256 `05e3e3842e4a64da46634dde33470c61747c09ad24a2d2e9ef6a4a8dd0020b02`, mp4 h264,
  no audio, 1024x576, 3042 ms), MEDIA-3 accepted (`aa886dd2`), selected into revision 2. Package
  `ready: true`, no blockers.
- The first application-door attempt, `198f9a18`, was refused by Higgsfield with 401
  (`authentication-failed`, no job id, no asset); the production key was replaced and nothing was
  retried. It stays as historical truth.

**Proposal** — request `9232af76-f004-4e76-96c6-33c9970c111f` (`act_bc48290e`), digest
`1e97f3cb7fddbf8c95e40e51ff16f32628dc90fe2cea755febdef1bf0357cb27` (recomputed: match). Sealed:
connection `c5e8637d` (`turkishrughouseist@gmail.com`, sub `117622225072141590877`), channel
"Turkish Rug House" `UC5Yf5U_YOKR0K38tWF82kjA` (read live at preparation), title
`Handwoven Kilim Rug in Soft Daylight`, revision-2 copy, `privacyStatus=private`, `categoryId=22`
(read by the Director from YouTube Studio), `selfDeclaredMadeForKids=false`,
`containsSyntheticMedia=true`.

**Governance** — approval decision `a2052b41`; permit `85b8a5f7-0e85-435e-9097-a4b35f56f15e`, TTL 1 h,
bound to the same digest.

**Gates** — TRH arming ACTIVE rev 5 (`979246c7`, decision `6c4a1d30`) → reachable; root external-send
ON v1 (unchanged throughout); `higgsfield-video-generation` OFF v6.

**Execution (one click)** — attempt `3f53e7d5-ee2a-4af8-b1c1-7f16774cb2e9`: `publish-youtube-video`,
adapter `youtube-resumable-upload-v1`, no recipient, `accepted` / `accepted`,
`provider_message_id` = **`Rlp-bPNHXkw`** (second character lowercase L, ASCII 108), started
15:38:18.790Z, completed 15:38:21.919Z. Permit `consumed` at 15:38:18.790Z (handoff `5d3adb11`).

**Read-back (Director, deployed read seam)** — uploadStatus `processed`, processing `succeeded`,
applied privacy `private` = authorized `private`, channel = authorized channel.

**Restore** — TRH DISARMED: rev 6 `1b20811f`, decision `6e71904f`, 15:41:36Z; effective reachability
`refused` / `tenant-arming-withdrawn`.

**Independent read-only closure audit (Claude, no provider call)** — exactly one YouTube request, one
permit (consumed), one attempt, all bound to the same digest; attempt digest and draft-revision digest
equal the sealed values; Media row, artifact (current revision 2), revisions (2), selection (one video)
and package (`ready`) unchanged by execution; both TRH Google connections unchanged; root unchanged;
arming withdrawn rev 6.

## 3 · What this does not prove or claim

- `unlisted` or `public` publication. The Google API project is unverified; YouTube restricts such
  projects' uploads to private. Verification/audit is deferred and not proven.
- A durable YouTube processing lifecycle. Processing and visibility are read live, on demand; nothing
  is stored.
- Any other tenant's upload, any second upload, scheduling, or Heby-initiated publishing.
- Video quality or brand fit beyond the Director's Media review of this one synthetic video.

## 4 · Remaining debt (carried, not fixed here)

- **Google project verification/audit** deferred; public/unlisted acceptance not proven.
- **Google OAuth credential-before-account-change** — the callback stores the credential before an
  account-changed refusal (open since SCOPE-REPAIR-1).
- **TENANT-ARM-1 ceremony hardening** — `scripts/tenant-arm-external-send.ts` writes through whatever
  `DATABASE_URL` names, without the production target pin (`verifyProductionIdentity`) the
  connectivity ceremony uses; and a production run needs `HEBUN_CONTROL_PLANE_ALLOW_REMOTE=true` in the
  process, which `.env.ceremony.local` does not hold (first run refused, nothing written).
- **HEBY-MEDIA structural firewall regression** — int5a/int5b1/int5c firewalls red since `3328a7f0`.
- **No blind retry.** An ambiguous upload stays `unknown` and needs reconciliation; there is no
  reconciliation surface yet.
- **Runtime bounds as implemented** — Media's 20 MiB ceiling; `/approvals` `maxDuration = 180`.
- **MV-7 image-to-video harness** still pins ledger 67 (`scripts/i2v-production-acceptance.ts`).
- **Vercel Skew Protection** (12 h) keeps an open tab on the deployment that served it; after an env
  change + redeploy, a ceremony must start from a new tab.
- Vercel production now holds `HEBUN_VIDEO_GENERATION_TRANSPORT=live` and `HEBUN_HIGGSFIELD_API_KEY`
  (Sensitive) permanently, by Director decision; `higgsfield-video-generation` remains the runtime
  gate and is OFF.

## 5 · Verdict

**YOUTUBE-WRITE-2: REAL-PROVIDER PRODUCTION ACCEPTED / CLOSED** — one governed, digest-bound, private
upload of one approved video to Turkish Rug House's own channel, read back as processed and private,
with every temporary gate restored.
