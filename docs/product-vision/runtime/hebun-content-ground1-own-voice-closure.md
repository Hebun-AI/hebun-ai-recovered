# CONTENT-GROUND-1 — The Organization's Own Voice

**Final status: CONTENT-GROUND-1 CLOSED — RELEASED + PRODUCTION-ACCEPTED** (declared by the
Director on the measured production evidence below, with one limitation recorded in full).

**Release** `8a0bd3953a5aa287b58f843079d7c3534bb687b5` · **Parent** `d05803b3` · on `origin/main`.
**UI correction** `92c3f5d745c705a9d8aa7c58d666e0f2d4ce0904` — see *The first attempt failed* below.
**Deployment** `hebun-ai-recovered-qgbd9ajlw`, READY, production, bound to `92c3f5d7…` by a
`--meta githubCommitSha` filter that was control-tested against a non-matching SHA in the same
session (the filter degrades to UNFILTERED on a miss, so the control is what makes the match mean
anything). **No migration.** The ledger stands at **59**, untouched by this phase.

**Hebun could write a caption, revise it, see the draft it was revising and know where it was
going. It had never seen what this organization sounds like.** The material was already in
production and already governed: `provider_observations` holds this tenant's own recent Instagram
media, captions included, recorded under TRH-21's standing authorization. Nothing read it.

Design and implementation record: the release commit message on `8a0bd395`.

---

## Truth semantics

| Truth | State |
|-------|-------|
| DESIGNED | **yes** — a boolean at the door, a server-resolved supplement, a fenced block, a named disposition |
| IMPLEMENTED | **yes** — `8a0bd395` |
| VERIFIED | **yes** — the CONTENT-GROUND-1 grounding/firewall suite and the CGO-9 surface/firewall suite; `tsc` 0 errors; lint 0 errors; production build |
| DEPLOYED | **yes** — exact SHA on the production deployment |
| AVAILABLE | **yes** — but NOT on the first attempt; see below |
| AUTHORIZED | **yes** — an authenticated human, in the Turkish Rug House tenant, through the released surface |
| EXECUTED | **yes** — one model call, one appended revision |
| PRODUCTION-VERIFIED | **yes, with one exception** — every criterion below is proven from persisted rows except the grounding fact itself, which is architecturally unpersisted |
| PRODUCTION-ACCEPTED | **yes** — Director-performed manual acceptance, 2026-09-23 04:10:06Z |
| Grounding actually used | **derived + corroborated, NOT independently persisted** — see *The limitation* |
| Tenant isolation | **production proven** |
| Append-only history | **production proven** |
| Governance, permit, publish, execution, media | **none** — production proven |
| BACKUP-ACCEPTED | **no** — Director-deferred, unchanged |

## The production acceptance

One human click, in the **Turkish Rug House** tenant (`9947c78e-2080-4331-81c6-456cb4be7a96`), on
artifact `57b57106-2848-41f7-a5b3-d2475e0b7dba` — *"Turkish Rug House Instagram içerik taslağı"*.

| Criterion | Evidence | Verdict |
|---|---|---|
| Revision 3 belongs to TRH | `work_artifacts.tenant_id = 9947c78e…`, joined to `companies.name = 'Turkish Rug House'` | **PASS** |
| Agent-authored by TRH's durable agent | `authored_by_actor_type = agent`, `authored_by_actor_id = 67f4460c-0d44-4ae7-a3ed-729c705e2609` — the tenant's single in-service identity, `Heby` | **PASS** |
| `source_message_id` present and resolving | `33822e6b-d95c-487d-9b77-b221d83af9d0` → `messages`, role `assistant`, conversation `b5b0c3ce…`, tenant TRH | **PASS** |
| The model call succeeded | exactly two `messages` rows exist since 2026-09-23 00:00Z, both at `04:10:06.334527Z`: the user row carries the typed instruction verbatim, the assistant row carries the revision bytes | **PASS** |
| Exactly 5 captions supplied | **NOT independently proven** — see *The limitation* | **DERIVED** |
| Revision 2 byte-identical, 3 appended | rev 2 `created_at 2026-09-16 21:16:14.809Z` and digest `7181b2fc…` unchanged across two reads a day apart; all three digests recomputed as `sha256(content)` and matched | **PASS** |
| No cross-tenant observation | Hebun AI owns **zero** Instagram observations; every one belongs to TRH; `readProviderObservations` opens with an unconditional `eq(providerObservations.tenantId, tenant.tenantId)` and takes no tenantId parameter | **PASS** |
| No consequential side effect | since 2026-09-23 00:00Z: `action_permits` 0, `decision_records` 0, `executions` 0, `action_execution_attempts` 0, `approvals` 0, `knowledge_facts` 0, `knowledge_nodes` 0, `governance_sessions` 0, `heby_action_requests` 0, `notifications` 0, `audit_log` 0, `event_log` 0; newest `media_assets` 2026-09-18, `media_generation_invocations` 2026-09-18, `content_selected_media` 2026-09-22; no `provider_observations` written (newest `recorded_at` 2026-09-22 23:00:20Z) | **PASS** |
| Revision 3 awaiting review | no `decision_records` row of subject type `work_artifact_revision` exists at all; the newest decision of any kind is 2026-09-18 | **PASS** |

**Preparing contacted Instagram never.** The captions came from storage, so no provider call was
made and no quota was spent. The observation read was `42fa186d-d637-4237-95d1-2824afa4f80f`,
observed `2026-09-22 23:00:20.336Z`, holding 8 media with 8 captions.

## The limitation — grounding leaves no durable trace

**The supplement is never stored.** By design: it reaches the model through the brief, is absent
from every message row, and nothing reads it back. `live-spend-budget.server.ts` persists nothing
either, so there is no token count to compare. The disposition — `grounded`, and the caption count —
is shown to the human **once**, transiently, in the sentence beside the result, and then it is gone.

So "grounding was used, with 5 captions" is not a fact this database can be asked. What can be said:

1. **Deterministic derivation.** Destination was `instagram`, the tenant held an observation with 8
   captions, `GROUNDING_LIMITS.maxCaptions` is a frozen `5`. Given a `requested: true` boolean, the
   released code path yields `grounded` with `captionCount: 5` and no other outcome — unless the
   observation read threw, which would have had to happen in the same instant the same database
   successfully wrote the revision.
2. **Observational corroboration, offered as evidence and not as causation.** Revision 3 introduces
   `one-of-a-kind`, `hand-knotted` and `texture`. None appears in revision 1 or revision 2 of this
   artifact, both written by the same agent for the same destination. All three are the dominant
   signature of the observed captions: *"this one-of-a-kind hand-knotted rug from Anatolia"* recurs
   across the first five, and `texture` appears in two of them. A model's word choice cannot be
   traced to an input with certainty, and this is not offered as proof that the captions caused the
   wording — only that the wording changed in the direction of material the phase claims to supply.

**This is the phase's real gap, and it is recorded rather than fixed:** a reviewer opening revision
3 tomorrow cannot tell whether it was grounded. Durable grounding provenance — which observation,
how many captions, which disposition — is **deferred**, and it is a schema question about who owns
that row, so it is not something to add opportunistically.

## The first attempt failed, and the failure was the screen

The first acceptance click, from the **wrong tenant**, produced revision 2 of an unrelated Hebun AI
draft containing the instruction sentence verbatim, `authored_by_actor_type = human`,
`source_message_id` NULL, and **no model call at all** (`messages` had zero rows that day).

Two causes, both now closed:

1. **The controls were indistinguishable.** The human append form and the Hebun form were adjacent
   flat rows sharing a border, a fill and a text size; the Hebun instruction field was `rows={1}`
   and told apart only by placeholder text, which vanishes on the first keystroke. Closed by
   `92c3f5d7` — named sections, labelled fields, a button that says *Save manual revision*.
2. **The tenant was wrong, and no leak followed from it.** Hebun AI owns zero Instagram
   observations, so grounding from that account could only ever have returned `no-observation`. The
   isolation held; what failed was that nothing on the screen said which organization's material was
   in reach.

The accidental revision is **left in place**. It is a true record of what a person wrote.

## What this phase did not touch

No schema, no migration, no new authority, no provider call, no Governance subject, no publishing,
no permit, no execution, no media. Work Artifacts still owns revision creation,
`prepareWorkArtifact` is still the only seam that writes one, and `readProviderObservations` is
still the grounding read. The human door asks a **boolean**; an `observationSupplement?: string` on
the action would have been an open channel from any client into the model's brief, and a firewall
test asserts no action and no surface may carry grounding text.

## Deferred

| Item | Why |
|---|---|
| **Durable grounding provenance** | the gap this closure names; a schema question, not a patch |
| **Destinations other than Instagram** | `destination-not-supported` is returned deliberately; another destination with real observed content is its own phase |
| **`bg-surface-1` / `bg-surface-2`** | ~32 remaining uses resolve to nothing; a separate sweep |
| **The 68 red suites on `main`** | the migration-ledger pin fan-out (`59 !== 57`); present before this phase and unchanged by it |
| **BACKUP-ACCEPTED** | Director-deferred, unchanged |
