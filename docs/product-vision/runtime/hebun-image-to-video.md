# IMAGE → VIDEO — Implementation Record

**State:** SELECTED / IN PROGRESS · IMPLEMENTED · locally VERIFIED (simulated provider) ·
**real-provider generation NOT performed** · **not CLOSED**. This is an implementation record.

**Baseline:** `origin/main` = `243e9835` (VIDEO CONTENT CHAIN closure). Branch `feat/image-to-video`.
**Schema:** no migration; ledger unchanged (67).

## 1 · Director gate decisions (2026-09-27)

- **G1 — source delivery = Higgsfield's documented upload.** The Hebun Media store stays private; no
  Hebun read grant is handed to the provider.
- **G2 — first acceptance on a SYNTHETIC, non-sensitive image.** Higgsfield's Terms of Use §4.4
  (last updated 26 Jul 2026) allow inputs to be used for model training absent an Enterprise
  Agreement. **Real company or customer images are NOT authorized for this provider path** until a
  separate data-use decision.
- **G3 — estimates only if proven non-billable.** Not proven (see §4) → not called → price UNKNOWN.

## 2 · Architecture (existing owners, extended)

```
admitted image (supplied or generated, this tenant)
  → read-verified-source-image  private store read; size + SHA-256 vs row (MEDIA-5 semantics)
  → MV-4 register              source_media_asset_id (MEDIA-5 lineage) + input digest v4
  → transport.prepareSourceImage  POST /files/generate-upload-url → PUT verified bytes (no credential)
  → MV-4 dispatch              ONE generation POST, image_url = provider public_url (in memory only)
  → MV-4 poll (human click)    → provider-succeeded
  → MV-7 admission             unchanged, except it resolves the transport for the row's input mode
  → VIDEO CONTENT CHAIN        review → selection → Content Package
```

- **Lineage:** `media_generation_invocations.source_media_asset_id` — MEDIA-5's column, "the admitted
  image this attempt was performed ON". Tenant composite FK, no kind CHECK. Generated video → its
  invocation → source image. No second lineage concept.
- **Identity:** input digest **v4** (`video` + source asset id + verified byte digest). v3
  (text-to-video) is untouched and byte-identical.
- **Transport contract:** `inputMode` (`text` default | `image`), optional `prepareSourceImage`,
  `dispatch` takes an optional prepared source. The prepared source's URL is reachable only through
  `reveal()`, which only the transport's own dispatch calls; it is never persisted or returned.
- **Profile (provisional, not priced):** `pixverse/v6/image-to-video@5s-720p-silent` — `prompt`,
  `image_url`, `duration: 5`, `resolution: "720p"`, `generate_audio: false`; closed provider schema.
- **Control:** a SEPARATE key `higgsfield-image-to-video`, read fail-closed, **not** named by the
  connectivity ceremony, so production cannot arm it without a code change and a Director decision.
  Arming text-to-video does not arm image-to-video, and the reverse.
- **Order and failure:** source verified before anything is written; upload after registration and
  before the generation POST. Any upload refusal → row stays `registered`, generation POST = 0,
  nothing retried. A registered image attempt cannot be dispatched without its prepared source.

## 3 · Official upload contract (docs.higgsfield.ai/docs/concepts/file-uploads, read 2026-09-27)

| | |
|---|---|
| DOCUMENTED | `POST /files/generate-upload-url` with `Authorization: Key …` and `{"content_type": …}` → `{ public_url, upload_url, content_type, upload_headers }` |
| DOCUMENTED | `PUT upload_url` with only `upload_headers` (Content-Type, `x-amz-tagging`); "Do not send Higgsfield API credentials to the presigned storage URL" |
| DOCUMENTED | upload URL expires after one hour; tag `retention=temporary`; PUT type must match; image types jpeg/jpg/png/webp/gif |
| UNKNOWN | size/dimension limits; how long `public_url` stays readable; error bodies; retry safety; whether the model fetches `image_url` once or more; redirect behaviour |

Hebun's handling of the unknowns: no retry, `redirect: "error"`, only `content-type` and
`x-amz-tagging` accepted in `upload_headers`, `retention=temporary` REQUIRED, https-only URLs without
embedded credentials, Media's own 20 MiB ceiling.

## 4 · Pricing

The billing guide documents `POST /estimate/<model>` but does **not** state whether calling it is free
or creates a request. Per G3 it was **not called**. An image-to-video estimate would also need an
`image_url`, i.e. an upload. **Price: UNKNOWN.** (Documented: `failed` and `nsfw` requests are not
charged.)

## 5 · Deliberately not done

Real-provider generation; production arming; estimate calls; real TRH images; Heby/agent
orchestration; scheduler; YouTube; Instagram video; APF. `read-verified-source-image` restates MEDIA-5
eligibility instead of refactoring MEDIA-5 (whose order of operations is pinned by its firewall);
`tests/image-to-video/lifecycle-postgres.ts` proves the two refuse the same sources the same way.
