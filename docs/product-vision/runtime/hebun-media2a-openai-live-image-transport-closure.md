# MEDIA-2A — OpenAI Live Image Transport (Inert Release)

**Final status: MEDIA-2A RELEASED + PRODUCTION-SCHEMA-ACCEPTED** (approved by the Director).

**Release** `f0aad238e026d27185d6f363bce7d5d902db1e18` · **Migration 57** `20260917135027_media2a_live_image_transport` ·
**Deployment** `dpl_EP3gguT6TJ43JB1YaLFUj2y5BYVw`, READY, production, serving `www.hebuntech.com` and `hebuntech.com`

**This is schema acceptance only. It is not provider acceptance.** No OpenAI credential exists in any
environment, the connectivity control `openai-image-generation` has no row in production, no request
has ever reached OpenAI, no human can reach a generation writer, and both media tables are empty.

Design and implementation record: `hebun-media2a-openai-live-image-transport.md`.

---

## Truth semantics

| Truth | State |
|-------|-------|
| DESIGNED | **yes** |
| IMPLEMENTED | **yes** |
| VERIFIED | **yes** — fake HTTP boundary, real Postgres, 13 bite proofs, full suite, tsc, lint, build |
| PRODUCTION-SCHEMA-ACCEPTED | **yes** — migration 57 applied to production, recorded exactly once |
| CONFIGURED | **no** — production carries no `HEBUN_MEDIA_GENERATION_TRANSPORT` and no `HEBUN_OPENAI_IMAGE_API_KEY` |
| CONNECTED | **no** — no request has ever reached OpenAI |
| AVAILABLE | **no** — the resolver is fail-closed and answers `no-generation-provider` in production |
| AUTHORIZED | **no** — control `openai-image-generation` has no row in production (= OFF) |
| EXECUTED | **no** — zero generation invocations |
| SUCCESSFUL | **no** |

The three "no" rows that matter are independent locks, and all three are shut: **no credential, no
control row, no transport selection.** Any one of them alone is sufficient to keep the live transport
inert. A credential by itself would still select nothing.

## What was accepted

Migration 57 widens the *invocation* record so it can one day describe a real provider attempt. It
adds no table, no route and no reachability:

- **`media_generation_invocations.transport`** CHECK widened from `fake` to `fake | live`.
- **`provider_failure`** — nullable `text`, closed set of ten codes, tied by CHECK to the two failure
  states (`dispatch-failed`, `provider-failed`) in both directions.
- **`provider_input_tokens` / `provider_output_tokens`** — nullable `integer`, CHECK-bound to be
  null together, non-null together, and non-negative.
- **`media_assets` is untouched by this migration.**

## Release sequence

| Step | Evidence |
|---|---|
| Commit | `f0aad238`, on `origin/main` |
| Deployment | Vercel auto-deployed on push: `dpl_EP3gguT6TJ43JB1YaLFUj2y5BYVw`, READY, production, `meta.githubCommitSha = f0aad238…`, branch `main` |
| Migration | `npm run platform:migrate`, run by the Director at a TTY (the ceremony refuses piped confirmation) |

**The deployment went live before the migration, and that was safe by construction** — for the same
reason MEDIA-1 was. The released transport is unreachable from any request: no route or action
reaches `requestMediaGeneration`, and the resolver refuses in production on all three locks.

## Production verification

Read-only, in a `transaction read only`, SELECT only. Measured from a throwaway worktree pinned at
`f0aad238`, so the canonical side of every comparison is the released tree and not a working copy.

**Target identity:** `neondb`.

| Check | Result |
|---|---|
| Canonical authored ledger | **57**, last tag `20260917135027_media2a_live_image_transport` |
| Canonical digest@57 | `91ea9382a425cf2289b38dfe7abd2789` |
| Applied ledger | **57** |
| Prefix verdict | **`converged`**, digest `91ea9382a425cf2289b38dfe7abd2789` — identical to canonical@57 |
| Migration 57 recorded | **exactly once** (1 occurrence by hash) |
| New columns | `provider_failure` text nullable, `provider_input_tokens` integer nullable, `provider_output_tokens` integer nullable |
| Named constraints of the migration | all 4 present: `..._transport_chk`, `..._provider_failure_chk`, `..._provider_failure_state_chk`, `..._provider_usage_chk` |
| Transport CHECK definition | `CHECK ((transport = ANY (ARRAY['fake'::text, 'live'::text])))` |
| Rows | invocations **0**, assets **0** |
| `media_generation_invocations` shape | 13 CHECK, 3 FK, 1 PK, 1 unique, 4 indexes |
| `media_assets` shape | 14 columns, 9 CHECK, 2 FK, 1 PK, 1 unique — **unchanged** |
| Unrelated schema | 72 public tables, **unchanged** from the MEDIA-1 post-state (migration 57 adds no table) |
| Act authority unchanged | action requests 11, permits 6, execution attempts 1, decision records 25 — **identical to the MEDIA-1 baseline** |

## Runtime truth in production

- **Credential:** production holds 41 environment variables and **not one** whose name matches
  `openai`, `generation` or `image`. Names were listed; no value was read.
- **Control:** `provider_connectivity_controls` holds exactly **4** rows — `claude` (ON),
  `external-send` (ON), `provider-observation-read` (ON), `machine-internal-execution` (OFF).
  **`openai-image-generation` is absent**, and absence is OFF by the fail-closed read.
- **Transport:** with no `HEBUN_MEDIA_GENERATION_TRANSPORT=live`, no credential and no control row,
  `resolveMediaGenerationTransport()` answers `no-generation-provider` in production.
- **No generation was attempted.** The invocation table is empty.

## What MEDIA-2A does not claim

It does not claim that an image can be generated in production. The schema can now *describe* a live
attempt; nothing can *make* one. Each of the following is a separate gate that has not been opened:

1. **OpenAI credential admission** — no key exists in any environment.
2. **Connectivity control** — `openai-image-generation` is not production-reachable; the ceremony
   refuses it in both directions until MEDIA-2B.
3. **Human door** — no route or action reaches `requestMediaGeneration`.
4. **Publication** — no action request binds an accepted draft revision to an accepted asset.

**The next program is MEDIA-2B (production-reachable generation control), not a credential.**
