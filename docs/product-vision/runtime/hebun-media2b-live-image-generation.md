# MEDIA-2B — Controlled Live OpenAI Image Generation

**Status:** MEDIA-2B RELEASED + PRODUCTION-ACCEPTED (release `7fcd1a6a`, deployment `dpl_BXhtigMEGxSY1qihK5vaewirjw8b`) — see `hebun-media2b-live-image-generation-closure.md`. One controlled human-initiated generation was executed in production and admitted; it is routed to Governance and remains unreviewed and unapproved. No migration: the ledger stays at 57.

| Truth | State |
|-------|-------|
| DESIGNED | yes |
| IMPLEMENTED | yes |
| VERIFIED | yes — focused door suite, retargeted firewall, 13/13 MEDIA-2A bites, full suite 795/795, tsc 0, lint 0, build |
| CONFIGURED | **yes** — proven by use: the invocation records `transport = live`, `provider = openai`, the pinned model. The credential was never read by any session |
| CONNECTED | **yes** — provider job `req_ac8aa8dd3bce41ecbadc8244de60d3f3`, usage 37 in / 439 out |
| AVAILABLE | **yes** — the resolver returned the live transport, which is what `transport = live` on the row means |
| AUTHORIZED | **yes** — Director connectivity ceremony (`v1`, `production-operator-ceremony`), then an authenticated human request |
| EXECUTED | **yes** — state `provider-succeeded`, finalized 10 s after it was requested |
| SUCCESSFUL | **yes** — verified bytes admitted, stored on the VPS store, authoritative `media_assets` row, routed to Governance unapproved (storage proven by construction, not independently re-read) |
| PRODUCTION-ACCEPTED | **yes** — declared by the Director on the Gate 3 evidence |
| BACKUP-ACCEPTED | no — out of scope, unchanged |

## What this adds, and what it deliberately reuses

MEDIA-1 built the authority, MEDIA-VPS connected the store, MEDIA-2A built the transport. All three
stay exactly as released. MEDIA-2B adds only **reachability**, in three places:

1. **One human action** — `requestMediaGenerationAction` in the route group that already owns
   content drafts. It resolves the tenant from the trusted session and passes the human's four
   fields to the released `requestMediaGeneration`. It is a pass-through: no validation of its own,
   no second authority, no new refusal vocabulary.
2. **One surface** — `generate-image-with-hebun.tsx`. One control, one call site, one idempotency
   key minted per mounted form.
3. **One production decision** — `openai-image-generation` joins
   `GENERIC_PRODUCTION_REACHABLE_KEYS` by value, so the existing generic ceremony can now arm it.

The released chain is unchanged and unbroken:

```
human request → requestMediaGeneration → OpenAI transport → admission verification
             → VPS MediaObjectStore → media_assets → Governance media-asset-review
```

## Why the generic ceremony, and not a dedicated one

The two keys with dedicated gates have **preconditions the generic path cannot check**:
`external-send` needs a configured sender, `machine-internal-execution` needs an armed trigger.
Image generation has none. Its control is a single boolean, and the other two conditions a live call
needs — `HEBUN_MEDIA_GENERATION_TRANSPORT=live` and a credential-shaped key — are re-checked by the
released resolver **on every call**, fail-closed. A dedicated ceremony would re-ask what the
resolver already refuses.

## Three independent locks, and what each one is for

A live call needs all three true. Any one false refuses, and they are checked in this order:

| Lock | False → | Who decides |
|---|---|---|
| `HEBUN_MEDIA_GENERATION_TRANSPORT=live` | `no-generation-provider` | deployment configuration |
| credential-shaped `HEBUN_OPENAI_IMAGE_API_KEY` | `generation-misconfigured` | deployment configuration |
| control `openai-image-generation` ON | `generation-disabled` | **Director ceremony, in the database** |

A credential alone selects nothing, and an unreadable control is OFF rather than ON. Configuration
is not capability: the third lock is a human decision recorded in `provider_connectivity_controls`,
and it is the only one the deployment cannot grant itself.

## The firewall was retargeted, not relaxed

MEDIA-1 asserted that **no** file under `src/app` or `src/components` may mention the Media Asset
authority. MEDIA-2B needs exactly two such files, so the ban became an **exact allowlist**:

```
deepEqual(doorFiles, [
  "src/app/(dashboard)/operations/actions.ts",
  "src/components/operations-preparation/generate-image-with-hebun.tsx",
])
```

A third file cannot acquire a generation path without failing that assertion. The door files are
additionally pinned to reach no provider, no credential, no environment, no media table, no
Governance writer, no act authority and no retirement — and the surface is pinned to exactly one
call site with no timer, no effect, no loop and no retry control.

**Bite proof B12 was retargeted for the same reason.** Its premise — "paid image generation must not
be production-armable" — expired by Director decision, not by accident, and it was only still
passing because its mutation inserted a duplicate. It now bites the opposite direction: the key
silently **leaving** the enumerated list.

## The route states its own duration

The transport pins a 150 s timeout. Server Actions run in the calling route's function, so
`operations/page.tsx` declares `maxDuration = 180` rather than inheriting a platform default that
the deployment API does not report (300 s under Fluid compute, far shorter without it). 180 s is
valid under both regimes and leaves 30 s of headroom, so the **transport's** abort fires first and
records `timeout` on the invocation, instead of the platform killing the function and stranding the
row in `registered`.

## One click is one paid call

`requestKey` is minted once per mounted form with `crypto.randomUUID()` and held in `useMemo`, so a
double-click or a resubmit after a stall resends the **same** key. The authority collides on
`(tenant_id, request_key)` and answers `duplicate-request` **before the transport is reached** — so
a resubmit costs nothing. A genuinely new image needs a new form. There is no retry control and
nothing dispatches on a timer.

## What a successful generation still is not

An admitted asset is a `media_assets` row and a Governance `media-asset-review` subject. It is not
approved, not attached to the draft, not scheduled, not published and not sent. No door file can
reach `acceptMediaAsset`, `recordActionRequest`, a permit or an execution — asserted structurally.

## Out of scope, unchanged

Backup and restore, reference images, editing, masks, video, batch generation, autonomous agent
generation, publishing, social posting, a second provider.
