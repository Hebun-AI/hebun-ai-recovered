# HEBY-CONTENT-OPS-1 · Supplied Video → YouTube · Closure

A human-supplied Google Drive MP4 went through the same Media review, selection and Content Package a
generated video uses, and was uploaded once, PRIVATE, to Turkish Rug House's own YouTube channel through
the existing proposal → Governance → permit → `executeAuthorizedAction` → attempt-ledger chain, under
TENANT-ARM-1 and the root external-send control. No new authority, no schema.

```
SUPPLIED != REVIEWED != SELECTED != PACKAGE READY != AUTHORIZED != UPLOADED != VISIBLE
PACKAGE READY        != AUTHORIZED TO PUBLISH
ACCEPTED (ledger)    == a video resource exists, nothing more
```

| Item | Value |
|---|---|
| Implementation | `0308f020` (supplied originals reviewable, selectable into their own draft, carried by the Content Package with `origin`) |
| Deployment at acceptance | `0308f020` (recorded at release as `dpl_D4JcTsR1utn8Se8vaQHUYfX4BYyP`; not re-measured by this closure) |
| Schema | none; **ledger 68** unchanged |
| Production acceptance | 2026-09-28, TRH, one real private upload |

## 1 · What was built (`0308f020`)

- **Review.** The released MEDIA-3 writer takes a supplied ORIGINAL (never a derivative). Same decision
  words and digest binding; evidence names origin `supplied` and its Drive source; `invocationId` stays
  null. Nothing is written to `media_assets`.
- **Selection.** A supplied original is selectable into its own draft only, proved by
  `supplied_artifact_id`. Generated media keeps MEDIA-SELECT-INTEGRITY. Selection stays custody-only;
  review is read at package time (MEDIA-5 doctrine, kept by Director decision).
- **Content Package.** Left join on the invocation; each selected item carries `origin`
  (`generated | supplied`) and its source revision. A row that is neither makes the package
  unreadable, never defaulted.
- **Heby.** Eligibility is admitted + review-accepted for either origin; `supplied-media-outside-review`
  is replaced by `unreviewed-supplied-media` / `declined-supplied-media`. Heby recommends; it writes
  nothing.
- **`/operations`.** Review and "use in draft" for supplied images and videos; "use as reference" stays
  hidden for supplied images.

Unchanged: the YouTube proposal and its execution-side binding (package-driven, origin-neutral);
PUBLISH-0 (still takes a supplied image through its `jpeg-publish-v1` derivative). Derivatives stay
outside review and selection.

## 2 · Production acceptance (2026-09-28)

**Draft** — TRH `bd3ab228-61c2-4b42-a2a9-82bd23e8eae1` "Black Rose Floral Kilim Rug", destination
`youtube`. Revision 1 agent-authored; revision 2 human-authored (`cf8a5ab1…5f5f`), current revision 2.

**Supplied video** — `0e32a72d-e85e-4e97-9c9c-ed29a8058f25`, origin `supplied`, source `google-drive`
via `google.drive.file.content.read` (Picker + `drive.file`), supplied into the draft's revision 2 by a
human. `video/mp4`, 2938150 B, SHA-256
`84f54644c2854dd5e1406e3698331a8033b00267ca821bf7f4b24499df12c8fe`, h264 + aac, 1280x720, 15083 ms,
`hebun-vps`, `admitted`, no invocation, no derivation.

**Media review** — decision `7d074995-1a0a-4b97-a2af-d6ef51c1a6a1` `media-asset-accepted` (human, the
only decision on the asset). **Selection** — `c0249fc5`, exactly one row binding this video to revision
2. **Copy review** — decision `83619d9d-9874-49bf-8144-d06b7d410b96` `artifact-revision-accepted`
(human). **Package** — `ready: true`, blockers `[]`, one selected item, origin `supplied`, copy
`approved`.

**Proposal** — request `ba731823-f2a4-4fb9-acf9-6b8d02278c1a`, `publish-youtube-video`, target
`work-artifact/bd3ab228-…@2`, digest `535cf96491da3a1feeb71216f54fa346407d563bcbb3d764d973def0235c5d61`
(recomputed: match). Sealed: connection `c5e8637d` (`google-youtube`), channel
`UC5Yf5U_YOKR0K38tWF82kjA`, title `Black Rose Floral Kilim Rug`, video + byte digest, revision digest,
`privacyStatus=private`, `categoryId=22`, `selfDeclaredMadeForKids=false`,
`containsSyntheticMedia=false` (real footage, not generated).

**Governance** — approval decision `8d25ac0a` `action-authorized` (human); permit
`87febc3c-9538-4790-9f27-fd2a29d80da6`, TTL 1 h, bound to the same digest.

**Gates** — TRH arming ACTIVE rev 7 (`ea30ffc8`, decision `d2338d6f`, 20:31:27Z); root external-send ON
(unchanged throughout); `higgsfield-video-generation` and `higgsfield-image-to-video` OFF.

**Execution (once)** — attempt `dfeef4d4-0535-47a4-9cf7-09f05d082308`, adapter
`youtube-resumable-upload-v1`, `accepted` / `accepted`, `provider_message_id` = **`DQr18fVuevM`**,
20:40:10.071Z → 20:40:13.292Z, digest match. Permit `consumed` at 20:40:10.071Z; exactly one attempt
for the permit and for the request; no other attempt carries this video id.

**Read-back (Director, deployed `/approvals` read seam)** — uploadStatus `processed`, processing
`succeeded`, applied privacy `private` = authorized `private`, on the authorized channel.

**Restore** — TRH DISARMED rev 8 `caeea910-92c2-4d68-807c-c12e4a02be3f`, decision `fb19ef44`
(`external-send-disarmed`), session `e1301101`, 20:49:55Z; effective reachability `refused` /
`tenant-arming-withdrawn`.

## 3 · Final read-only verification (Claude, 20:52Z, no provider call)

Released seams + one `read only` transaction. All 18 checks passed: arming, reachability, root,
draft, asset, review, selection, package, request, digest, permit, attempt, video id, no duplicate,
binding, counts, isolation.

```
table          pre-flight  final  delta  cause
media               10       11    +1    supplied video 0e32a72d
invocations          6        6     0    no generation
selections           4        5    +1    c0249fc5
decisions           38       43    +5    media review, copy review, arm, approval, disarm
requests            13       14    +1    ba731823
permits              8        9    +1    87febc3c (consumed)
attempts             3        4    +1    dfeef4d4 (accepted)
```

Also inside the window, TRH only: the draft (1 artifact, 2 revisions), 2 arming rows (rev 7, rev 8),
2 `integration.credential.replaced` audit rows for `oauth_access` credentials (`google-workspace`
at admission, `google-youtube` at proposal). Every
media, selection, decision, request, permit, attempt, arming, revision and audit row written since
19:00Z belongs to TRH; zero other-tenant rows.

**Evidence boundary.** The attempt ledger (accepted, video id) is persisted and was re-read.
Processing, privacy and channel are read live and stored nowhere by design (YOUTUBE-WRITE-2); they rest
on the Director's production read-back and were not re-read here, to avoid a new provider call.

## 4 · What this does not prove or claim

- `unlisted` or `public` publication (Google project unverified; uploads are private).
- Automatic Drive ingestion, folder monitoring, or any intake beyond one manual Picker file.
- Heby-initiated or autonomous publishing, scheduling, or automatic daily content operations.
- Authorization to send supplied media to any external generative AI provider (DATA-USE unresolved).
- Any other tenant, a second upload, or provider capabilities not exercised here.

## 5 · Remaining debt (carried, not fixed here)

- Heby may still say YouTube publish capability is unavailable (`media-choice` wording predates
  YOUTUBE-WRITE-2).
- Heby responses truncate in the UI; Heby markdown renders as plain text.
- Picker is manual and single-file; no automatic folder intake.
- Connection/account provenance is not persisted on supplied media.
- DATA-USE authority for external generative AI unresolved; the image → video custody/data-use gap
  stays separate.
- Baseline firewall and migration-pin reds stay separate.

## 6 · Verdict

**HEBY-CONTENT-OPS-1 SUPPLIED VIDEO → YOUTUBE: REAL-PROVIDER PRODUCTION ACCEPTED / CLOSED** — one
human-supplied Drive MP4, admitted, reviewed, selected, packaged READY, authorized by a human through a
digest-bound single-use permit, uploaded once PRIVATE to Turkish Rug House's own channel, read back as
processed, with the tenant disarmed again.
