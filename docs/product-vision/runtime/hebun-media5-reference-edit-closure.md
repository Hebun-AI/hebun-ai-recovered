# MEDIA-5 — Reference Image and Editing

**Final status: MEDIA-5 CLOSED — RELEASED + PRODUCTION-ACCEPTED** (declared by the Director on the
measured production evidence below).

**Release** `0fd1dc678bfc1ff75244f1342b277834874af808` · **Parent** `dcd7121d` · on `origin/main`.
**Repair** `8bd177cf49b4535c69ee7389f581a97df490f412` · **Parent** `0fd1dc67` · on `origin/main`.
**Deployment** `dpl_9Kj8uMVXguvtCCfb4SCgPxnsrnH3`, READY, production, `meta.githubCommitSha` exactly
`8bd177cf…`, serving `hebuntech.com` and `www.hebuntech.com`.
**Migration 58** `20260918105811_media5_reference_edit_lineage` — applied through the released
production migration ceremony. The ledger stands at **58**.

**One admitted image became the input to a new one, and the original was never opened for writing.**
Hebun has no code path that rewrites admitted bytes. The output is a new Media Asset with its own
immutable byte identity, its own storage key, and no decision inherited from its source.

Design and implementation record: the release commit message on `0fd1dc67`. The repair is recorded
on `8bd177cf`.

---

## Truth semantics

| Truth | State |
|-------|-------|
| DESIGNED | **yes** |
| IMPLEMENTED | **yes** — `0fd1dc67`, repaired by `8bd177cf` |
| VERIFIED | **yes** — MEDIA-5 contract/firewall and reference-postgres suites, VPS adapter contract (now covering `get()`), MEDIA-1 (3), MEDIA-2A (2), VPS bite-proofs; `tsc` 0 errors; lint 0 errors; production build |
| PRODUCTION-SCHEMA-ACCEPTED | **yes** — ledger 57 → 58, applied digest `5d33f4cf56f2d79a19a7b5300f439362`, verdict `converged`; the before/after schema delta is exactly one column and one foreign key |
| DEPLOYED | **yes** — `meta.githubCommitSha` on the production deployment is exactly `8bd177cf…`, read from the Vercel REST API; both apex aliases resolve to it from the alias side |
| CONFIGURED | **yes** — transport `live` and the image credential present in production; now proven by a call that succeeded, not by presence alone |
| CONNECTED | **yes** — the provider answered, and the VPS read succeeded server-side |
| AVAILABLE | **yes** — the `/v1/images/edits` contract has now succeeded in production. Before that it was code, not availability |
| AUTHORIZED | **yes** — the released human door, under the standing Director control `openai-image-generation` |
| EXECUTED | **yes** — provider request `req_8359f076cb274da1b1dad08e20e532d9` |
| SUCCESSFUL | **yes** — `provider-succeeded`, `admission_outcome = admitted`, `provider_failure` NULL |
| PRODUCTION-ACCEPTED | **yes** — Director-performed manual acceptance, populated state, human visual confirmation |
| Persisted A → invocation → B lineage | **production proven** |
| Source asset unchanged by the edit | **production proven** |
| Asset B inherited no Governance decision | **production proven** |
| publishing, scheduling, permit, execution, social authority | **no** |
| masks, multiple references, variations | **no** |
| MEDIA-4B Selected Media Authority | **DEFERRED**, unchanged |
| BACKUP-ACCEPTED | **no** — out of scope, unchanged |

## What shipped

One new durable fact, and one column for it. `media_generation_invocations` gained a nullable
`source_media_asset_id` with a composite `(tenant_id, source_media_asset_id)` foreign key into the
uniqueness MEDIA-1 already declared on `media_assets`, `ON DELETE RESTRICT`.

Nullable because every released text-to-image invocation legitimately has none — **absence is a
permanent kind of request, not a backfill gap.** Nothing was added to `media_assets`. A column and
not a relation table because the input is **singular**: the provider's edit contract has one
distinguished image. If additional references are ever admitted, that is a different fact and
deserves its own table.

`source_artifact_id` / `source_revision_no` stayed NOT NULL. A reference edit is still asked from a
draft revision; draft provenance and asset lineage answer different questions, and collapsing them
would lose one.

## Production acceptance

Performed manually by the Director on `www.hebuntech.com`, against the asset MEDIA-2B generated,
MEDIA-3 reviewed and approved, and MEDIA-4A kept reachable. **One click. One provider call.**

Instruction given: *"Keep the same three ceramic spheres and overall composition. Change only the
background to a soft pale blue studio background. No text, no logos, no people."*

### The acceptance chain, from authoritative rows

| | |
|---|---|
| Source **Asset A** | `8494e3ad-0077-4282-b84a-cf6d29fd09c0` — `admitted`, 1024×1024 PNG, 1134590 B, digest `97defc87…c282291` |
| **Reference-edit invocation** | `c087a0b8-7d49-439c-8fb4-60459b116b48` |
| Resulting **Asset B** | `63a33cbb-82bc-4e56-8d2a-5c9f875dc502` — `admitted`, 1024×1024 PNG, 1158995 B, digest `bea34234…dc4b5e7` |
| Provider request | `req_8359f076cb274da1b1dad08e20e532d9` |

The lineage was proven by a single tenant-predicated SQL join traversing real foreign keys — the
MEDIA-5 composite FK on the A side, the MEDIA-1 invocation FK on the B side — **not by reading the
surface back to itself**:

```
A 8494e3ad… (admitted, 97defc87…)
  → invocation c087a0b8… (source_media_asset_id = 8494e3ad…, provider-succeeded, admitted)
    → B 63a33cbb… (admitted, bea34234…)
```

### Observed and measured

| Observed | Meaning |
|---|---|
| `transport = live`, provider `openai`, model `gpt-image-2.5-flare-2026-09-08` | the released live transport, not a fake |
| `state = provider-succeeded`, `provider_failure` NULL | the real `/v1/images/edits` contract held |
| usage **1071 in / 439 out**, against **37 in** for the text-to-image invocation on the same artifact | an image part was genuinely uploaded; a prompt alone does not cost 1071 |
| `input_digest` `7497c148…` differs from the text-to-image `448898ec…` | the v2 digest form engaged exactly when a source asset is present |
| requested 12:30:43.942Z → finalized 12:30:56.243Z | 12.3 s, one shot, no retry |
| **Asset A: all 14 columns identical** to their pre-click values | the original was not mutated in place, and `media_assets` has exactly 14 columns, so this is total rather than a sample |
| **Asset B has zero `decision_records`** | nothing was inherited from A's approval |
| A's own approval (`approve` / `media-asset-accepted`, 08:17:04Z) untouched, version still 1 | the edit neither copied nor superseded a Governance judgement |
| `decision_records` total 26, **0 created after 12:00Z** | Governance was not written by this act at all |
| One invocation for that `request_key`, one asset from that invocation | a single click produced a single of everything |
| Private preview of B rendered, UI stating *"Verified against the admitted digest before it was shown."* | the released `readMediaAsset` integrity seam ran, unchanged, on the new asset |
| Human confirmed: three spheres preserved, composition preserved, background pale blue, no text, no logos, no people | the requested edit is what came back |

### Non-effects, measured rather than asserted

Every watched authority table had **zero rows created after 12:00Z**, against a click at 12:30:43Z:
`action_execution_attempts` 1 · `action_permits` 6 · `decision_records` 26 · `executions` 0 ·
`governance_sessions` 26 · `heby_action_requests` 11 · `knowledge_edges` 0 · `knowledge_facts` 7 ·
`knowledge_nodes` 7 · `tenant_machine_execution_authorizations` 1.

No permit, no execution, no action request, no Knowledge write, no Instagram or YouTube or social
mutation, no connectivity change. `72` public base tables before and after — no table was created.

**What the preview evidence proves, stated exactly:** the released application path re-verified byte
size and SHA-256 against the store and then minted a short-lived private grant, and the image
rendered. That is the application path succeeding. **No independent external VPS byte audit was
performed or is claimed here** — the same boundary MEDIA-2B, MEDIA-3 and MEDIA-4A drew.

## The acceptance incident, recorded honestly

**The first production acceptance attempt failed.** It is recorded here because a closure that
mentions only the successful click would misrepresent how this capability was proven.

The UI reported: *"The stored bytes could not be read, or no longer match the admitted digest.
Nothing was sent. This is a storage custody problem and should be raised."*

It was **not** a custody problem. The stored bytes were intact — the preview's `/v1/verify` step had
confirmed the store's own SHA-256 against the row minutes earlier.

| | |
|---|---|
| Failed stage | the VPS read returned **403**, before the signature was even checked |
| Cause | `MediaObjectStore.get()` took only a key and a ceiling, so the VPS adapter **invented** a content type and signed `application/octet-stream` |
| Why 403 | the store's `/v1/read` admits only the media types it stores — `image/png`, `image/jpeg`, `image/webp` — and checks that allowlist **before** the HMAC, so a perfectly signed grant for any other type is still refused |
| Why the preview always worked | `createReadAccess` is handed `record.mimeType`; it never had to invent anything |
| Cost of the failure | **zero** — no provider call, no invocation row, no asset row, no Governance write, source asset untouched |

**It failed closed, exactly as designed.** The verification block sits above the dispatch boundary,
so a refusal there cannot reach a transport and cannot write a row.

### The repair

`8bd177cf` — six TypeScript files, no schema, no migration, no VPS change, no credential or
connectivity change.

`MediaObjectStore.get()` now **requires** the authoritative content type, narrowed to
`MediaAssetMimeType`. The generation authority passes the `media_assets` row's own `mime_type`,
which it had already resolved. The adapter signs and sends that. The client still supplies an asset
ID and nothing else — no mime type, no storage key — and the key is still derived, never accepted.

The repair is total rather than a patch: `ALLOWED_CONTENT_TYPES` on the store is byte-identical to
`MediaAssetMimeType` and to the `media_assets` CHECK constraint, so every storable asset is
guaranteed to satisfy the route.

**`application/octet-stream` was deliberately NOT added to any VPS allowlist.** The same frozen set
gates `PUT`; widening it to fix a client bug would have permitted writing non-image bytes — a real
security regression traded for a convenience.

### Why the suite was green, and what now stops that

Every MEDIA-5 test ran against the in-memory fake, whose `get()` ignores content type entirely. The
one suite that speaks to the **real Python store process** never called `get()`. The defect lived
precisely in the gap between them, where no amount of re-running would have found it.

The gap is now closed from both sides, and both halves were bite-proofed by reintroducing the bug:

| Layer | Catches |
|---|---|
| **Behavioural** — put and read back a real object of each of the three types through the real store, asserting the literal `ct` sent and the signature **recomputed from the canonical string** for that exact type | the original `octet-stream` bug **and** a hardcoded `image/png`, which the literal guard cannot see |
| **Structural** — a source-level guard rejecting an invented content type anywhere in the adapter, comments stripped | a literal reappearing in a branch no test happens to walk |

| Injected defect | Result |
|---|---|
| `"application/octet-stream"` (the original) | **FAIL** — "the VPS adapter must never invent a content type" |
| `"image/png"` (invisible to the structural guard) | **FAIL** — "image/jpeg: ct is the authoritative type" |
| repaired | **PASS** |

## Custody gates eligibility; Governance does not

An admitted asset may be a reference whether it is **approved, declined, or never reviewed**.
Accepting may not authorize an external act, so declining may not forbid an internal one. Only
retirement removes the control, because that is a custody fact rather than a judgement.

The generation authority reads **no Governance state at all** on this path. Production proved the
consequence directly: **A was approved, and B inherited nothing.**

|  |  |
|---|---|
| B was generated from A | a fact the invocation records |
| **≠** B is approved | B arrived unreviewed and remains so |
| **≠** A's approval transferred | no inheritance exists, and none was invented |
| **≠** A was edited | A's bytes and row are unchanged; B is a new object |
| **≠** publishable | no publishing authority exists to grant |

## What MEDIA-5 deliberately did NOT add

No mask, no multiple references, no variations, no in-place edit, no new VPS route, no new secret,
no widened TTL, no new connectivity control, no Governance writer, no publish or permit or execution
reach, and no column on `media_assets`.

`input_fidelity` is **not sent**. Official OpenAI surfaces disagree about it — the Go API reference
lists it; the generation guide and Python reference do not. MEDIA-5 omits it rather than building
correctness on a contradiction. **The contract is "source image + instruction → new image", not
guaranteed composition preservation.** The human confirmed the composition held on this attempt;
that is an observation about one result, not a promise the contract makes.

The reference grant is built, used and discarded inside one function. It is never returned, never
serialized into a response, never logged, and no caller can obtain it. The bytes are re-digested and
compared to the `media_assets` row **before** the provider is called and **before** the invocation
row exists, so a custody mismatch costs nothing and unverified bytes can never leave Hebun.

Still out of scope and untouched: backup and restore (**BACKUP-ACCEPTED remains no**), selected
media, attachment, composition, publishing, scheduling, execution, and a tenant-wide media library.

## Lessons

- **A fused refusal code will send you to the wrong system.** `source-asset-unavailable` covers both
  "the store refused the request" and "the bytes did not match", so a client bug wearing a custody
  problem's words cost the first read of the incident. The system failed closed correctly and
  diagnosed itself incorrectly; those are separate qualities and only one of them was designed.
- **A port that omits a required input invites an implementation to invent one.** The defect was not
  in the adapter that invented `application/octet-stream` — it was in the `get()` signature that
  gave it nowhere to get the real answer. Making the input required and narrowly typed did not
  discourage the mistake; it made it unrepresentable.
- **Two fakes can agree with each other and both be wrong about the world.** The in-memory store and
  the port were perfectly consistent; neither knew the real route has an allowlist. A contract test
  that never calls a verb is not coverage of that verb, and a green suite said so for as long as
  nobody asked.
- **Fix the client, not the allowlist.** The tempting one-line repair was adding `octet-stream` to
  the store's frozen set. The same set gates writes, so that would have bought a client fix with
  permission to store non-image bytes.
- **Evidence beats a plausible story.** "The stored bytes are corrupt" was consistent with every
  symptom. `/v1/verify` had already computed the store's own SHA-256 minutes earlier, and that one
  measurement eliminated the whole hypothesis before any byte was re-read.
