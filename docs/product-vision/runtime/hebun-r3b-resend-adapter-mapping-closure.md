# R3B — Resend adapter mapping (implementation closure record)

**Date:** 2026-08-17
**Predecessor:** `hebun-r3b-first-executed-action.md` (released `8c9b527`, tag
`hebun-first-executed-action-complete`), then the R3B canonical migration ceremony
(`hebun_r1` 28 → 29) and the R3B vendor selection gate.

**What this gate did:** bound the already-released execution runtime to one concrete provider.
**What it did not do:** arm anything. No credential, no sender, no subject, no connectivity row, no
external call, no send.

---

## 1. Vendor

**Resend.** Selected in the vendor gate on two facts no other candidate had together:

- the message id arrives in the **JSON response body** (`{"id": "…"}`), which is the only place
  `FetchLike` can see it — SendGrid returns it solely in an `X-Message-Id` response header, so under
  the released transport every SendGrid send would classify as 2xx-without-id and be UNKNOWN forever;
- a **general-purpose `Idempotency-Key`** with published duplicate semantics — Postmark publishes
  that it has none, and Mailgun's only key is scoped to Inbox Placement tests, not to sends.

Runner-up Postmark; rejected SendGrid and Mailgun. Full evidence in the vendor gate report.

## 2. The host is now a frozen constant

`HEBUN_EXTERNAL_SEND_ENDPOINT` is **gone**. The provider host is
`RESEND_SEND_ENDPOINT = "https://api.resend.com/emails"`, a literal in the transport.

This is a narrowing, not a convenience. A settable URL is an arbitrary-URL capability, and
`ADAPTER_SANDBOX_BOUNDARY` says none exists; while no vendor was chosen, configuration was the only
honest option, and now it is the weaker one. Nothing is given up: Resend's sending region is a
property of the verified **domain**, not of the base URL.

The boundary value was updated accordingly, and both new phrases are pinned by test:

- `the provider host is a frozen constant, not configuration, not a record, not a model`
- `the sender and the subject come from deployment configuration, never from a record or a model`

## 3. The request

```
POST https://api.resend.com/emails
Content-Type: application/json
Authorization: Bearer <HEBUN_EXTERNAL_SEND_API_KEY>
Idempotency-Key: <action_permits.handoff_id>

{ "from": <HEBUN_EXTERNAL_SEND_FROM>,
  "to":   [ <resolved recipient address> ],
  "subject": <HEBUN_EXTERNAL_SEND_SUBJECT>,
  "text": <exact approved work-artifact revision bytes> }
```

No `html`, no CC/BCC, no attachments, no metadata, no signature, no sanitisation, no summarisation.
Exactly four body fields, asserted by test — and asserted again as an exhaustive key set, so a fifth
cannot appear unnoticed.

## 4. Internal contract ≠ provider contract

`SendExternalMessageInput` is **unchanged**: `endpointKind · endpoint · content · idempotencyKey`.
Neither `endpointKind` nor `idempotencyKey` belongs in Resend's body — the key is a header for
Resend, so keeping it in the body too would be a second, unread copy of an authorization-bearing
value. It was removed from the wire and kept in the adapter input.

A test asserts the body contains no `channel`, `content`, `idempotencyKey`, `endpointKind`,
`tenantId`, `permitId`, `actionRequestId`, `handoffId`, `recipientId` or credential, and that the
handoff string appears nowhere in the body at all.

## 5. Fixed subject — Director decision

Generation one's subject is **deployment configuration** (`HEBUN_EXTERNAL_SEND_SUBJECT`), by
explicit Director decision. R3W artifact authority was not touched, no subject column was added, and
the canonical payload and permit digest semantics are unchanged.

This closes the gap the vendor gate flagged. `work_artifacts.title` exists, but it lives on the
parent artifact, is mutable independently of revisions, and is covered by **no digest** — routing it
to the wire would transmit bytes the permit's `bound_payload_digest` never bound. Configuration is
the only option that touches no released authority.

**Subject firewall**, proved two ways: behaviourally, by varying every field of the adapter input
(including content that starts with `Subject:`) and asserting the emitted subject never moves; and
structurally, by asserting the adapter input still has exactly four fields, and that the live
feature's source cannot reach `workArtifact`, `artifactTitle`, `revision`, `knowledge`, `heby`,
`model`, `actionRequest`, `canonicalPayload` or `tenantId` at all.

## 6. System-owned sender

`HEBUN_EXTERNAL_SEND_FROM`, deployment configuration, one sender for every tenant. Same firewall
shape as the subject, plus: the recipient never becomes the sender, and the recipient address appears
**exactly once** in the whole request — inside `to`.

**Recorded as R5 debt, not hidden:** there is no tenant-owned sender identity. One sender and one
global kill switch are coherent for generation one and wrong for a customer product.

## 7. Idempotency

`Idempotency-Key` = `action_permits.handoff_id`, **verbatim** — no transformation, no prefix, no
minted token. Tests assert the header equals the handoff exactly, that the same handoff always
produces the same key, and that the live feature contains no `randomUUID`, `randomBytes`,
`Math.random` or `uuid`.

`RESEND_IDEMPOTENCY_DOCTRINE` records what Hebun **relies on** and what it **refuses to do with it**:

| | |
|---|---|
| `headerName` | `Idempotency-Key` |
| `vendorWindowHours` | 24 — a dependency on the outside world, not something Hebun enforces |
| `automaticReplay` | `false` |
| `automaticReconciliation` | `false` |
| `replaySafeAfterWindow` | `false` — past the window a replay is **not** assumed safe |

Resend documents that the same key within 24 hours returns the original response without sending
again, which would make a replay both a reconciliation and a duplicate guarantee. **Generation one
uses none of it.** An `ambiguous` attempt becomes UNKNOWN and stays UNKNOWN until a human looks.
Acting on it would be a second external effect without a second authorization, and
`ExternalSendAdapter` still has exactly one operation with no reconciliation consumer.

Asserted by mechanism rather than vocabulary — the live feature has no `Date.now`, no `new Date(`,
no `setInterval`, no `86400`, no loop, and **exactly one dispatch site**.

## 8. Acceptance and UNKNOWN

`classifyResponse` now reads **only** `id`. Before a vendor was chosen it also honoured `messageId`;
keeping that would mean claiming ACCEPTED on a shape Resend never returns. Narrower acceptance can
only fail toward `ambiguous`, which is the safe direction.

| Provider answer | Class | Attempt status |
|---|---|---|
| 2xx + non-empty `id` | `accepted` | `accepted` + provider message id |
| 2xx, no usable id | `ambiguous` | **`unknown`** |
| 4xx (incl. **409**) | `rejected` | `failed` / `provider-rejected` |
| 5xx | `ambiguous` | **`unknown`** |
| our own timeout after dispatch | `ambiguous` | **`unknown`** |
| provably pre-write connection failure | `unreachable` | `failed` / `provider-unreachable` |

**On 409.** Resend uses it for both "same key, different payload" and "same key already in flight".
As a 4xx it reads as `rejected` — *nothing was sent* — which is true for the first and would be a lie
for the second. Hebun is safe structurally rather than by luck: `handoff_id` is minted once inside
the permit spend, and `action_execution_attempts_handoff_uq` / `_permit_uq` make a second attempt on
that key impossible, so Hebun cannot race itself. Pinned by test.

No wording changed. `EXECUTION_OUTCOME_WORDING` and `PROVIDER_ACCEPTANCE_NON_CLAIMS` are untouched:
the strongest claim remains **"Accepted by provider — message id X"**, and delivery is still
unprovable.

## 9. Configuration boundary

| Variable | Role | Configured? |
|---|---|---|
| `HEBUN_EXTERNAL_SEND_API_KEY` | Resend credential | **No** |
| `HEBUN_EXTERNAL_SEND_FROM` | system-owned sender | **No** |
| `HEBUN_EXTERNAL_SEND_SUBJECT` | fixed generation-one subject | **No** |
| ~~`HEBUN_EXTERNAL_SEND_ENDPOINT`~~ | removed — host is a frozen constant | n/a |

**All three are required.** Any one missing makes the adapter not exist: `checkAdapterAvailability`
returns `credential-unavailable`, `resolveExternalSendAdapter` returns `null`, and construction
throws before any network primitive is reached. Each value is proved individually — removed alone,
refusing alone, leaving the permit spendable — in both the unit and the Postgres suite.

`credential-unavailable` now covers three values, which reads slightly wide. Deliberate:
`action_execution_failure_class` has exactly two values, a third would be a migration, and of the two
this is the one whose documented meaning is *"one exists but deployment has not armed it."* A missing
sender is an un-armed deployment, not a missing channel.

## 10. Adapter identity renamed

`email-https-v1` → **`resend-email-v1`**, and the module `email-https-transport.server.ts` →
`resend-email-transport.server.ts`.

`adapter_id` is the only durable record of **who** produced a given `provider_message_id`, and a
provider id is meaningless without knowing whose it is. Zero attempt rows exist, so the rename cost
nothing now and would have cost something forever after.

## 11. Firewalls held

| Firewall | Result |
|---|---|
| Canonical schema | **no change, no migration** — 29 files = 29 journal = 29 applied |
| Canonical data | `action_execution_attempts` 0, recipients 0, artifacts 0, revisions 0, requests 0, permits 0, legacy `executions` 0, `audit_log` 17 (unchanged) |
| Arming | `external-send` row **absent**; only `claude`, disabled, `updated_at` 2026-08-10 untouched |
| Credential / sender / subject | none configured; `.env.local` unchanged (`7f254e16…3304c`, mtime Aug 10) |
| Dependencies | `package.json` untouched; **no Resend SDK**, zero new packages |
| Network | zero live provider calls; every test injects `FetchLike` |
| Privacy | no raw address, credential, sender or body in any attempt row, audit row, error or returned outcome; the provider response is never persisted wholesale — only its classification and its id |
| Authorities | Governance, action request, permit, `handoff_id`, attempt ownership, R3R, R3W and kill-switch ownership all **unchanged** |
| Abstraction | no generic multi-provider layer; one vendor did not become a platform |

## 12. Tests

**385 passed, 0 failed** (384 baseline + 1 new file). Lint 0 errors / 14 pre-existing warnings,
typecheck clean, build clean, `git diff --check` clean, zero leaked disposable databases.

New: `tests/r3b-flow/resend-mapping.ts` — request mapping (endpoint, method, three headers,
exhaustive body keys, byte-exact Turkish/₺/em-dash/newline content), all six outcome classes, the
three configuration gates, zero-retry across four provider answers, the subject firewall, the sender
firewall, the privacy firewall, and the idempotency doctrine.

### Inherited test repairs — each classified, none blanket-updated

| Test | Old invariant | Why it legitimately changed | Replacement |
|---|---|---|---|
| `adapter-and-phases.ts` — `classifyResponse(202, {messageId})` → accepted | any of two id keys proved acceptance | the vendor is known and sends `id` | `{messageId}` now asserts **ambiguous** — strictly narrower |
| `adapter-and-phases.ts` — construction refuses non-HTTPS `endpointUrl` | validated a settable URL | there is no `endpointUrl` argument any more | replaced by three construction gates (credential, sender, subject) — a removed capability beats a validated one |
| `adapter-and-phases.ts` — body contains the handoff | key travelled in header **and** body | Resend takes it as a header only | asserts the body does **not** contain it |
| `adapter-and-phases.ts` — empty env → `adapter-unavailable` | unset endpoint meant the channel was unreachable | the host is frozen, so the channel is reachable and only arming is missing | `credential-unavailable`, plus each of the three values proved individually |
| `boundaries-and-firewall.ts` — "the provider host is never a literal in the transport" | a literal would have been an invented vendor | the vendor is selected; a settable URL is now the weaker arrangement | **inverted and tightened**: exactly one https literal may appear, it must be Resend's endpoint, no endpoint env var may return, and the orchestration layer names no host at all |
| `execution-postgres.ts` — "no credential" / "no endpoint" / "plaintext endpoint" | proved refusal for the credential only | no endpoint exists to omit or downgrade | each of the three values removed alone must refuse before the spend and leave the permit spendable — strictly more coverage |
| `execution-postgres.ts` — privacy sweep over key + endpoint | endpoint was a secret-ish value | it is a public constant now | sweeps over key + **sender + subject** |

Every repair narrowed or widened coverage deliberately; none deleted a guard.

## 13. Record-integrity repairs

Claims this gate falsified, and only those:

- `adapter-registry.server.ts` — the descriptor no longer says "No vendor is selected until
  deployment configuration names one"; it names Resend and states what deployment still owes.
- `operations-substrate/model.ts` — the headline detail no longer says "no vendor has been
  selected", and the `requiredToExecute` entry demanding a vendor choice was removed; the remaining
  entry names the three values and states that the host is fixed in code.
- `action-authorization/contracts.ts` — `EXECUTION_SUBSTRATE_GAP.observation` updated,
  `observedRealityAt` 2026-08-16 → 2026-08-17.
- `adapter-contract.ts` — `ADAPTER_SANDBOX_BOUNDARY` host line rewritten, sender/subject line added.

**Not** repaired, deliberately: `hebun-r3b-first-executed-action.md` still says "no vendor selected".
That was true on 2026-08-16 and is a historical release-time statement. This record supersedes it.

## 14. Limitations (deliberate, recorded)

1. **Nothing is armed.** No credential, no sender, no subject, no `external-send` row. The adapter
   is implemented and does not exist at runtime.
2. **No reconciliation.** An UNKNOWN attempt is surfaced to a human by `readUnreconciledAttempts`
   and resolved by nobody. Resend's replay guarantee is recorded and unused.
3. **No tenant-owned sender.** One system sender, one global kill switch, all tenants.
4. **Fixed subject.** Every generation-one message carries the same configured subject line.
5. **Plain text only.** No `html`, no attachments.
6. **Delivery is still unprovable.** Acceptance is acceptance.
7. **Unverified against the live API** — a bare UUID as an idempotency key, the exact 2xx status
   code, and lowercase header tolerance were all flagged in the vendor gate and remain unverified,
   because verifying them requires a real call.
8. **Resend account data is stored in the US** regardless of sending region. Not a blocker now; a
   real question if EU data residency is ever required.

## 15. Next gate

**R3B RESEND CREDENTIAL + SENDER CONFIGURATION GATE.** Then: enable the durable `external-send`
switch, then the first real execution ceremony. Then R4.
