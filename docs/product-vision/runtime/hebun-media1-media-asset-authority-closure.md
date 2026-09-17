# MEDIA-1 — Media Asset Authority

**Final status: MEDIA-1 RELEASED + PRODUCTION-SCHEMA-ACCEPTED** (approved by the Director).

**Release** `288e558360603fb81755b91e98424b32cdf88ae1` · **Migration 56** `20260917001519_media1_media_asset_authority` ·
**Deployment** `dpl_Bt8gjGnEdJFLWy7A7mHjcnvNeXPJ`, READY, production, serving `www.hebuntech.com`

**This is not production storage acceptance and not generation-provider acceptance.** No object storage is connected, no generation provider is integrated, no human can reach a generation writer, and no asset exists in production.

Design and implementation record: `hebun-media1-media-asset-authority.md`.

---

## What was accepted

Hebun has a dedicated, tenant-owned Media Asset authority whose schema is live in production:

- **`media_generation_invocations`:** who asked (human), which durable agent authored, which draft revision (by reference), which transport, provider, model and job, and how far the attempt got.
- **`media_assets`:** the verified byte identity of one admitted image (SHA-256, size, MIME, dimensions, storage key) and its only transition, `admitted → retired`.
- **Governance subject `media_asset`**, domain `media-asset-review`. Acceptance binds the asset id and its byte digest, and creates no action request, permit or execution.

## Release sequence

| Step | Evidence |
|---|---|
| Commit | `288e5583`, fast-forward onto `983c7948`, pushed to `origin/main` |
| Local validation | tsc 0, lint 0, `next build` 0, suite 788/788, MEDIA-1 bite proofs 16/16 |
| Deployment | Vercel auto-deployed on push: `dpl_Bt8gjGnEdJFLWy7A7mHjcnvNeXPJ`, READY, `fra1`, aliased to `www.hebuntech.com` and `hebuntech.com` |
| Migration | `npm run platform:migrate`, run by the Director at a TTY (the ceremony refuses piped confirmation), from a clean worktree at `288e5583` |

**The deployment went live before the migration**, and that was safe by construction. No route, action or surface reads the new tables: `src/app` and `src/components` import nothing from the Media Asset authority, and a structural test asserts it. The only released runtime code that touches them is unreachable from a request.

## Production verification

Read-only, in a `transaction read only`, SELECT only.

**Before migration:**
- Target identity matched (`neondb`, pinned system identifier).
- Ledger 55, digest `31056ffd14779350d191a2d17ddbcde5` = canonical@55.
- Prefix verdict `pending`, with exactly one pending migration: 56 `20260917001519_media1_media_asset_authority`.
- MEDIA-1 tables absent, `media-asset-review` absent.
- Baseline: 70 public tables; action requests 11, permits 6, execution attempts 1, decision records 25.

**After migration:**

| Check | Result |
|---|---|
| Ledger | 56 applied, 56 authored |
| Prefix verdict | `converged`, digest `3296764e10a243fa621c03b0bfd3cbd7` = canonical@56 |
| Migration 56 recorded | exactly once |
| Tables | `media_generation_invocations`, `media_assets` present |
| Rows | invocations 0, assets 0 |
| `governance_domain` | `media-asset-review` present |
| Constraints | all 26 named constraints of the migration present (19 CHECK including `transport = 'fake'` and human requester, 2 unique, 5 FK), plus 2 primary keys; 8 indexes |
| Unrelated schema | public tables 70 → 72, exactly the two new ones |
| Act authority unchanged | action requests 11, permits 6, execution attempts 1, decision records 25 — identical to baseline |
| MEDIA-1 Governance activity | 0 `media_asset` decisions, 0 `media-asset-review` sessions |

## Runtime truth in production

- **Storage:** the released `resolveMediaObjectStore()` returns `unavailable / storage-not-connected` unconditionally and reads no environment. No adapter exists in the release.
- **Generation transport:** the released `resolveMediaGenerationTransport()` returns `unavailable / no-generation-provider` unconditionally.
- **Environment:** the production environment carries no AWS, S3, bucket, Blob, Supabase, media or generation variable (names checked, values not read).
- **No production asset was admitted** and no generation was attempted. Both tables are empty.

## What MEDIA-1 does not claim

It does not claim that images can be generated, stored, read, reviewed or published in production. Each of those needs a gate that has not been opened. **The next program is S3 Storage Connection and Production Acceptance (gate 1), not generation-provider integration.**

1. **Storage connection:** AWS S3 `eu-central-1` via Vercel OIDC — bucket, IAM trust, adapter and its dependency, credential model, and a production storage acceptance.
2. **Generation provider:** a real transport, widening `media_generation_invocations_transport_chk`, spend and idempotency accounting, and a DNS-rebinding review of the download seam.
3. **Human door:** a route or action that reaches `requestMediaGeneration`, and a review surface.
4. **Publication:** one action request binding the accepted draft revision and the accepted asset by digest.

## Lessons carried from the phase

- `AbortSignal.timeout` uses an unref'd timer. A test awaiting a hanging fake can drain the event loop and exit 0 without finishing, so a test that never ran looks green. MEDIA-1's contract test now fails when it exits before completing.
- When two tables are new in the same migration, drizzle-kit emits composite foreign keys before unique indexes. A composite FK target must be declared as a table `unique()` constraint so it exists inline in `CREATE TABLE`.
- A migration ledger bump fans out across many released test pins (74 files here). Every changed line was audited as a transform of its deletion or a named census entry before commit.
