# MEDIA-2A — OpenAI Live Image Transport (Inert Release)

Date: 2026-09-17. Base: `origin/main = 91583701`. Branch: `feat/media2a-openai-image-transport`.

| Truth | State |
|-------|-------|
| DESIGNED | yes |
| IMPLEMENTED | yes |
| VERIFIED | yes — fake HTTP boundary, real Postgres, 13 bite proofs, full suite, tsc, lint, build |
| CONFIGURED | no — no `HEBUN_MEDIA_GENERATION_TRANSPORT`, no `HEBUN_OPENAI_IMAGE_API_KEY` anywhere |
| CONNECTED | no — no request has ever reached OpenAI |
| AVAILABLE | no — resolver answers `no-generation-provider` in every deployment |
| AUTHORIZED | no — control `openai-image-generation` has no row (= OFF); production ceremony refuses it |
| EXECUTED | no |
| SUCCESSFUL | no |
| PRODUCTION-SCHEMA-ACCEPTED | no — migration 57 authored, not applied to production |

## What exists

```
Media Asset authority → MediaGenerationTransport (port) → OpenAI transport (live, text-to-image)
                      → admission verification → MediaObjectStore (VPS) → media_assets → Governance
```

- `src/features/media-generation-live/openai-image-transport.server.ts` — implements the existing
  port. Fixed `POST https://api.openai.com/v1/images/generations`, pinned model
  `gpt-image-2.5-flare-2026-09-08`, `n=1`, `1024x1024`, `quality=medium`, `png`, `moderation=auto`.
  Base64 bytes only (GPT image models never return URLs); `allowedDownloadHosts` is empty.
  Redirects refused, 150 s timeout, 32 MiB response cap, no retry, no logging.
- `openai-image-control.ts` — control key `openai-image-generation` in the released
  `provider_connectivity_controls` authority.
- Resolver (`media-generation-transport.server.ts`) returns the transport only when
  `HEBUN_MEDIA_GENERATION_TRANSPORT=live` AND `HEBUN_OPENAI_IMAGE_API_KEY` is credential-shaped AND
  the Director control is ON (fail-closed read). A credential alone never selects anything.
- Spend: one unit of the existing shared per-process live-call budget (R2G) per call. No second budget.
- Ceremony: key added to `PROVIDER_KEYS` (locally armable); NOT production-reachable, no dedicated
  gate — production refuses it in both directions until MEDIA-2B.

Contract verified 2026-09-17 against OpenAI's model page, image generation guide, Images API reference
and error-code guide: model snapshot pinnable; `data[].b64_json`; `usage.input_tokens/output_tokens`;
`moderation_blocked`; 429 `credit_balance_exhausted`; `x-request-id` response header;
`X-Client-Request-Id` request header (correlation only). No idempotency key is documented.

## Why migration 57, and only this

Proven from code before writing it:

1. `media_generation_invocations_transport_chk` was `= 'fake'` — a live row was unwritable.
2. Dispatch/provider failures were finalized with no code, and `admission_failure` may not carry one —
   moderation, rate limit, quota, auth and timeout were indistinguishable.
3. No usage columns; OpenAI bills GPT Image per token; the live Claude path already records tokens.

Migration `20260917135027_media2a_live_image_transport`:
- `transport` CHECK widened to `in ('fake','live')` (drizzle renders this as DROP + ADD of the same
  constraint — a widening, not a removal);
- nullable `provider_failure` + closed-set CHECK + `(provider_failure is not null) = (state in
  ('dispatch-failed','provider-failed'))`;
- nullable `provider_input_tokens`, `provider_output_tokens` + both-or-neither, non-negative CHECK.
- Provider request identity reuses `provider_job_id`. `media_assets` unchanged. Production media tables
  were measured empty, so the new CHECKs meet no existing row.

Closed failure codes: `authentication-failed`, `request-rejected`, `moderation-blocked`, `rate-limited`,
`quota-exhausted`, `timeout`, `provider-unavailable`, `malformed-response`, `budget-exhausted`,
`dispatch-error`.

## Invariants kept

Provider holds no Media Asset, Governance, storage, publishing or execution authority; bytes become an
asset only after admission and a write through the MediaObjectStore; no provider URL is stored; the
transport imports types only and reads no environment; the prompt is the only organizational content
sent; human requester CHECK and `request_key` idempotency unchanged; no human or agent door.

## Known limits (recorded, not solved here)

- A timeout may still have been generated and billed; nothing is retried — a retry is a new human request.
- The per-process budget bounds a burst per instance, not deployment-wide spend.
- `registered` rows can remain if the platform kills the function mid-call (existing MEDIA-1 gap).
- Vercel function duration must exceed 150 s for the future door — MEDIA-2B.

## Next gates

1. Push, then production schema acceptance of migration 57 through `platform:migrate` (Director TTY).
2. MEDIA-2B: organization verification, restricted key, ZDR/EU decision, production control gate,
   human door, one controlled live generation → admission → VPS → Governance review.
