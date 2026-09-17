# MEDIA-2B — Controlled Live OpenAI Image Generation

**Final status: MEDIA-2B RELEASED + PRODUCTION-ACCEPTED** (declared by the Director on the measured Gate 3 evidence below).

**Release** `7fcd1a6a6435685cc3146eeb4c65dfbcaffe1a49` · **Deployment** `dpl_BXhtigMEGxSY1qihK5vaewirjw8b`, READY, production, serving `www.hebuntech.com` and `hebuntech.com` · **No migration** — MEDIA-2B is code and configuration only; the ledger stays at 57.

**Hebun generated its first real AI image in production.** One authenticated human asked once, OpenAI
answered once, the bytes were verified, stored write-once on the VPS store, and filed as an
authoritative asset that is now waiting for Governance. It was not approved, attached, scheduled,
published or sent, and nothing gained the authority to do any of those.

Design and implementation record: `hebun-media2b-live-image-generation.md`.

---

## Truth semantics

| Truth | State |
|-------|-------|
| DESIGNED | **yes** |
| IMPLEMENTED | **yes** |
| VERIFIED | **yes** — focused door suite, retargeted firewall, 13/13 MEDIA-2A bites, full suite 795/795, tsc 0, lint 0, production build |
| CONFIGURED | **yes** — proven by USE, not by presence: the invocation records `transport = live`, `provider = openai`, `model = gpt-image-2.5-flare-2026-09-08` |
| CONNECTED | **yes** — a real request reached OpenAI: provider job `req_ac8aa8dd3bce41ecbadc8244de60d3f3`, usage 37 in / 439 out |
| AVAILABLE | **yes** — the resolver returned the live transport, which is what `transport = live` on the row means |
| AUTHORIZED | **yes** — Director connectivity ceremony, then an authenticated human request |
| EXECUTED | **yes** — state `provider-succeeded`, finalized 10 s after it was requested |
| SUCCESSFUL | **yes** — verified bytes admitted, stored on the VPS store, represented by an authoritative `media_assets` row, and routed to Governance unapproved (see the storage caveat) |
| PRODUCTION-ACCEPTED | **yes** |
| BACKUP-ACCEPTED | **no** — out of scope, unchanged |

## The three locks, and how each one opened

A live call needs all three true, checked fail-closed on every call. They opened in this order, and
each was opened by a different party:

| Lock | Opened by |
|---|---|
| `HEBUN_MEDIA_GENERATION_TRANSPORT = live` | the Director, in the deployment configuration |
| credential-shaped `HEBUN_OPENAI_IMAGE_API_KEY` | the Director, as a Vercel **Sensitive** variable |
| control `openai-image-generation` ON | the **Director ceremony**, writing a row in `provider_connectivity_controls` |

The third is the one the deployment cannot grant itself, and it is why configuration is not
capability. Before the ceremony the door was live and refused every click.

**The credential was never read by this session.** Its presence was verified by name and type only;
its shape was proven by the provider accepting it, not by anyone inspecting it.

## The ceremony

`openai-image-generation` `enable`, generic production ceremony, at a TTY. Result:
`director_enabled = true`, `version 1`, `control_source = production-operator-ceremony`,
`updated_by = NULL`.

Two corrections were made before it could run, and both were real:

1. **`.env.ceremony.local` could not be shell-sourced.** `DATABASE_URL` is unquoted and contains
   `&`, which zsh reads as a background operator. Fixed by loading the file with Node's built-in
   `--env-file`, which parses dotenv format with no shell interpretation — the file itself was not
   modified and the URL was never printed.
2. **The ceremony had to run from the release tree, not the primary worktree.** The primary tree
   sits 16 commits behind and does not contain MEDIA-2B's production decision, so it would have
   refused the key. Measured: `reach(openai-image-generation)` is absent there and `reachable` at
   `7fcd1a6a`.

The production cluster identity was verified read-only against the independently recorded
`pg_control_system().system_identifier` pin before any mutation, and matched.

## Gate 3 — the accepted generation

One human, one prompt, one call. The prompt was synthetic and non-sensitive by construction — three
ceramic spheres on a grey background — and carried no organizational or customer content.

**Invocation** `a86aefb4-1d36-4e8b-b493-7492def09a6c`

| Check | Result |
|---|---|
| Invocations in production | **1** · rows sharing this `request_key`: **1** · other invocations: **0** |
| Requester | `requested_by_actor_type = human`, actor `d5b496df…` |
| Transport / provider / model | `live` / `openai` / `gpt-image-2.5-flare-2026-09-08` |
| Provider job identity | `req_ac8aa8dd3bce41ecbadc8244de60d3f3` |
| Provider token usage | input **37**, output **439** |
| `provider_failure` | `NULL` |
| State / admission outcome | **`provider-succeeded`** / **`admitted`** |
| Elapsed | requested 01:06:57 → finalized 01:07:07 — **10 s** (transport allows 150 s, the route 180 s) |

**Asset** `8494e3ad-0077-4282-b84a-cf6d29fd09c0`

| Check | Result |
|---|---|
| MIME / dimensions / size | `image/png` · 1024×1024 · 1 134 590 bytes |
| SHA-256 | `97defc87126c641f08c03cdbf08e97f89e41f967af6ceedcb0788ab64c282291` |
| Row matches what the human was shown | digest, mime, dimensions and byte size all identical |
| Lifecycle | `admitted`, `retired_at NULL` |
| Storage | backend `hebun-vps`, key `tenants/<tenant>/media/<asset>` — canonical form verified |
| Provenance | content-draft *"CGO-7 observed reel caption"* revision 1 |
| Tenant isolation | invocation, asset and source revision all in tenant `f625b683…` |

**Nothing else moved.** action requests **11**, permits **6**, execution attempts **1**, decision
records **25** — byte-identical to the MEDIA-1 baseline. Public tables **72**, unchanged. The other
four connectivity rows unchanged.

Cost: roughly **1.3 cents** — 439 output tokens at $30/1M, against $5 of prepaid credit with
auto-reload off.

## Two claims this closure deliberately does NOT make

**The VPS object was not independently re-read, and that is stated rather than glossed.** Vercel
refuses to disclose Sensitive values even with `decrypt=true` — correct behaviour — so this session
could not obtain the store secrets and could not call `verify()` itself. What is proven is
deductive and tight: the adapter digests the bytes locally and refuses to send on mismatch, `put()`
demands HTTP **201** from the write-once store, and any other outcome throws → `storage-write-failed`
with **no `media_assets` row written at all**. The row exists and reads `admitted`, so the store
accepted exactly those bytes at that key. That is sound inference from the released code path, and
it is not the same thing as an independent read. An independent verification needs the store
secrets or the deployed read path.

**No Governance decision or session row was created, and none should have been.** Measured:
`decision_records` for this asset **0**, sessions in `media-asset-review` **0**, `media_asset`
decisions anywhere **0**. The released contract represents "awaiting review" as
`decision: null, decisionCount: 0` — the review state is **derived from the absence of a decision**,
never stored at admission. So the admitted asset is a reviewable `media-asset-review` subject that
**remains unreviewed and unapproved**. "A Governance state was created" would be false; "it is
routed to Governance and unapproved" is the accurate sentence.

## What MEDIA-2B does not claim

Generation success is not publishing authorization. The asset is not approved, not attached to the
draft, not scheduled, not published and not sent, and no door file can reach an approval, an action
request, a permit or an execution — asserted structurally, and confirmed by the unchanged census.

Still out of scope and untouched: backup and restore (**BACKUP-ACCEPTED remains no**), reference
images, editing, masks, video, batch generation, autonomous agent generation, publishing, social
posting, a second provider.

## Lessons carried from the phase

- A bite proof can expire by DECISION rather than by accident. MEDIA-2A's B12 bit "image generation
  becomes production-armable" — exactly what MEDIA-2B resolved to allow — and it was still passing
  only because its mutation inserted a duplicate that tripped a `deepEqual`. A proof that passes for
  a reason unrelated to its label is worse than a failing one.
- A mutation anchored at a list's LAST entry dies silently when the list grows. TRH-25's P8 anchored
  on `OBSERVATION_READ_CONTROL_KEY,\n]);` and stopped matching the moment a key followed it.
  Re-anchored away from the boundary.
- A firewall that bans WORDS catches its own honest UI copy. Banning `openai` and `publish` as
  substrings flagged the surface's own "not approved, attached or published" disclaimer. Ban
  identifiers, endpoints and module paths; let prose say what the thing is not.
- A `.env` value containing `&` cannot be shell-sourced, and the fix is to stop using the shell as a
  dotenv parser rather than to quote around the problem.
- A ceremony must run from the tree that carries its decision. The primary worktree was 16 commits
  behind and would have refused the very key the ceremony existed to arm.
