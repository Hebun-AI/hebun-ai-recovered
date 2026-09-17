# MEDIA-1 — Media Asset Authority

**Status:** MEDIA-1 RELEASED + PRODUCTION-SCHEMA-ACCEPTED (release `288e5583`, migration 56 applied to production) — see `hebun-media1-media-asset-authority-closure.md`. Not production storage acceptance and not generation-provider acceptance.

**Local validation:** tsc 0, lint 0, `next build` 0, full suite 788/788, MEDIA-1 bite proofs 16/16.

**Not production storage acceptance, and not generation-provider acceptance.** No storage backend is connected and no generation provider is integrated. Every production path is refused before anything is written.

## What exists

The chain MEDIA-1 proves, with fakes injected only by tests:

```
content-draft revision → generation invocation → image admission → media asset → Governance review
```

| Part | Where |
|---|---|
| Schema | `apps/dashboard/src/db/schema/media-asset.ts` — `media_generation_invocations`, `media_assets` |
| Migration | `20260917001519_media1_media_asset_authority.sql` (ledger 55 → 56): two new tables, one `governance_domain` value `media-asset-review`; no DROP, no change to an existing table |
| Runtime | `apps/dashboard/src/features/media-assets/*` |
| Review | `apps/dashboard/src/features/media-asset-review/*`, Governance subject `media_asset` |
| Tests | `apps/dashboard/tests/media1-asset-authority/*` |

## Decisions carried by the code

- **Two facts, two tables.** A refused or failed generation leaves a durable invocation and no asset. The asset's byte identity (SHA-256, size, MIME, dimensions, storage key) has no writer. The only transition is `admitted → retired`, and it keeps the bytes.
- **Image-only.** PNG, JPEG and WebP, detected from magic bytes. No media kind column, no duration column. Limits: 20 MiB, 8192×8192, prompt 4,000 code points. They are enforced in code and by database CHECKs.
- **Fake-only.** `media_generation_invocations.transport` is CHECKed to `'fake'`. The runtime transport resolver answers `unavailable`.
- **Storage port, not a vendor.** `media-object-store.ts` has `put` (write-once, digest-checked), `verify` and `createReadAccess`, and no delete. The runtime resolver answers `unavailable` unconditionally and reads no environment. **No S3 adapter, AWS dependency, bucket or credential was added**: an adapter with nothing behind it would let a deployment look configured.
- **References, not copies.** The invocation references the draft revision through the revision table's existing unique key `(tenant_id, artifact_id, revision_no)`. Provider, model, transport and job id live on the invocation only. The input digest folds in the revision's content digest, so it is recomputable by join.
- **Idempotent dispatch.** `unique(tenant_id, request_key)` plus `ON CONFLICT DO NOTHING` before the transport is called.
- **No URL persisted.** Neither table has a URL column. A provider URL is followed once, through an exact-host allowlist, with manual redirects (at most 2, each re-checked), a timeout and a streaming byte cap.
- **Review.** A decision is bound to the asset id. The reviewer must present the byte digest they were shown, and it rides in the evidence. State is derived from the ledger. Acceptance creates no action request, no permit and no execution.
- **Future publication**, not implemented: one action request whose canonical payload names the draft revision (with its digest) and the asset (with its digest), so `payload_digest` and the permit bind both.

## Known limits, stated

- If storage `put` succeeds and the asset transaction fails, an object exists that no row names. It is unreadable through this authority and is not swept (orphan sweeping is out of scope). The invocation records `persistence-failed`.
- Host allowlisting does not pin resolved IPs, so it does not by itself defeat DNS rebinding of an allowlisted name. A real provider integration must re-evaluate this.
- `media_assets` immutability is enforced by the writer set (structural test) and by CHECKs on the storage key, MIME and bounds. There is no database trigger, consistent with the rest of the repository.

## Documentation corrected

- `apps/dashboard/src/db/schema/document.ts` no longer claims bytes live in Supabase Storage.
- `apps/dashboard/docs/database-architecture.md` §1, §2 and §8 are marked as a plan, not implemented: zero RLS statements, local auth, Neon.

## Out of scope

Higgsfield or any real provider, live generation, production bucket provisioning, production admission, publishing, scheduling, provider write scopes, human uploads, Knowledge ingestion, CGO-9 changes, video, transcoding, thumbnails, purge, orphan sweeping, and any new execution authority.
