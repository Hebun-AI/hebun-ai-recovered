# R3B — First Executed Action (implementation closure record)

**Status:** IMPLEMENTED, NOT COMMITTED, PROVIDER DISARMED.
**Baseline:** HEAD `3d95639` (unchanged — nothing committed, tagged or pushed).
**Verification:** lint 0 errors / typecheck PASS / **384 tests passed, 0 failed** / build PASS /
`git diff --check` clean / zero leaked disposable databases.
**Canonical (`hebun_r1`):** 28 applied, **no R3B table**, no `external-send` row, all business
counts unchanged. The migration was never applied to canonical.
**Real sends performed: 0.**

---

## 1. First executed action

`send-external-communication` (`heby.operations.send-communication`).

Re-proved against the repository, not assumed. The other three registered consequential actions
were rejected again for the same reason the earlier R3B gate blocked entirely: `workflows`,
`policies`, `permissions` and `role_permissions` all still have **zero rows and zero production
writers**, so `restart-workflow`, `grant-permission` and `modify-governance-policy` point at
nothing. The latter two would additionally create a second Governance authority.

Locked, in order: **APPROVED ≠ EXECUTED · PERMIT CONSUMED ≠ SUCCESS · PROVIDER ACCEPTED ≠
DELIVERED · UNKNOWN ≠ FAILED.**

## 2. Execution owner

New narrow authority: **`action_execution_attempts`**.

The legacy `executions` table stays **DEAD** — its FKs (`workflow_id`, `task_id`, `plan_id`,
`goal_id`, `mission_id`, `effect_ledger_id`) all point at empty, writerless tables, it has zero
`src` importers, and it is already a *forbidden import* in two shipped firewall tests. A firewall
test now forbids R3B from reaching it, `providers`, or `integrations`.

The owner records outcomes and decides nothing: it writes no `decision_records`, no permit state,
and nothing reads it to determine whether an act may proceed.

## 3. Attempt / receipt model

**One row**, carrying both — an attempt has at most one provider answer, so a second table would
be a revision table with no revisions (R3R's precedent).

Structural guarantees in the schema, not in code:

| Constraint | What it makes impossible |
|---|---|
| `UNIQUE (handoff_id)` · `UNIQUE (permit_id)` | a second attempt per spend |
| `(status='accepted') = (provider_message_id IS NOT NULL)` | claiming acceptance without a receipt |
| `(status='unknown') = (provider_response_class IS NOT DISTINCT FROM 'ambiguous')` | **downgrading a possible send to a clean failure** |
| `(provider_response_class IS NOT NULL) = (status IN ('accepted','failed','unknown'))` | a terminal row that never called the adapter |
| `(status='pending') = (completed_at IS NULL)` | an incoherent terminal row |
| `(failure_class IS NOT NULL) = (status IN ('failed','refused'))` | a reason without an outcome |
| 3× composite FK on `(tenant_id, …)` | an attempt naming another tenant's permit, request or recipient |

**Never stored:** raw recipient address, message content, credential, provider response body,
model reasoning, confidence/trust, business success, retry counter.

## 4. Status vocabulary

`pending · accepted · refused · failed · unknown` — five values.

`delivered`, `successful`, `completed`, `verified`, `read`, `bounced` are all absent: no webhook,
delivery receipt or reconciliation feed exists, so each could only be set by a guess.

## 5. Permit spend + attempt atomicity

`consumeActionPermit` gained one seam — `onAuthorizedWithin(tx, authorization)` — invoked inside
the spend transaction. The attempt row and the audit event are written there.

- Crash before/inside the transaction → permit stays `active`, no attempt. Retriable.
- Crash after commit, before the adapter → permit spent, attempt `pending`, no effect. Reconcilable
  as UNKNOWN, and the permit **cannot** be respent.
- Callback throws → the spend rolls back with it. *If Hebun cannot write down what it is about to
  do, it does not become entitled to do it.*

No `check-then-insert` anywhere: the spend is one `UPDATE … WHERE status='active' AND expires_at >
now()` on the **database** clock, and uniqueness does the rest.

## 6–8. Revalidation, artifact and recipient semantics

Checked **twice** — a cheap pre-flight that refuses without spending, and an authoritative re-read
*inside* the transaction whose failure burns the permit and records a terminal `refused` attempt.
Two timings, two costs; acting on stale state is impossible in both.

**Retired recipient blocks — and a digest cannot catch it.** R3R rows are immutable, so retiring
one leaves `endpoint_digest` matching the permit's frozen copy. Only `status` catches it. Proven
by test: the digest is asserted byte-identical before and after retirement.

**Artifact policy, stated explicitly:** a **superseded** exact revision **still executes** — the
bytes are immutable and a human approved *those*. **Retirement blocks.** This is deliberately
asymmetric with `/send`, which refuses to *propose* a superseded revision: proposing stale bytes is
a fixable mistake, executing approved bytes is honouring the decision. Nothing upgrades rev1→rev2.

## 9. Idempotency

`handoff_id` — **nothing new was minted.** Already server-generated inside the spend, already
`UNIQUE` when present, already impossible for an unspent permit. It is the attempt's unique key
*and* the provider's `idempotency-key` header. Test asserts the value handed to the adapter equals
the permit's own `handoff_id`.

## 10. Retry policy

**Zero automatic retries.** No backoff, no queue, no worker. A second real send requires a new
human decision, a new permit and a new attempt. A firewall test greps for `backoff`, `maxRetries`,
`retryCount`, `while (true)` and fails if any appears.

## 11. Kill switch

A **row**, not a table: `provider_connectivity_controls` where `provider_key = 'external-send'`,
shipping `director_enabled = false`. The `claude` row is untouched and the runtime is forbidden by
test from reading it — *enabling Hebun to think must never thereby enable it to act.*

Read **twice**: before the spend (a disabled switch never burns an authorization) and immediately
before the adapter call (a Director flipping it mid-execution is obeyed → attempt `refused` /
`execution-disabled`, nothing sent, permit spent). Both paths are tested, including a control that
answers `true` then `false` to land exactly in the window.

## 12–14. Credential, adapter, registry

One system-owned environment credential (`HEBUN_EXTERNAL_SEND_API_KEY`), mirroring
`ANTHROPIC_API_KEY`: read once, never logged, returned, persisted or placed in an error. No tenant
credential storage was built — there is no secret store anywhere in the repository, and inventing
one is R5.

```
sendExternalMessage({ endpointKind, endpoint, content, idempotencyKey }) → ProviderOutcome
```

Four scalars. The adapter receives no tenant, session, permit, authority, database handle,
Knowledge or model output — asserted by test on the exact key set. It **returns** provider
conditions rather than throwing, so "the provider said no" stays distinguishable from "the adapter
broke".

Registry is a **frozen code literal** with exactly one entry — not a table. Activating `providers`
or `integrations` would create a second authority over what may run.

## 15–17. Network seam, phases, receipt, UNKNOWN

`action-execution-live/` is the only module with a network primitive; a firewall test proves
`action-execution/` cannot reach `fetch`, `node:http/https/net/tls`, `axios`, `undici` or
`nodemailer`.

**The deliberate divergence from the Claude transport:**

| Observation | Class | Status |
|---|---|---|
| DNS / ECONNREFUSED / EHOSTUNREACH / TLS failures | `unreachable` (provably pre-write) | `failed` |
| `AbortError` (our timeout), ECONNRESET, EPIPE, ETIMEDOUT, unknown codes | `ambiguous` | **`unknown`** |
| 2xx **with** a message id | `accepted` | `accepted` |
| 2xx **without** a message id | `ambiguous` | **`unknown`** |
| 4xx (incl. 429) | `rejected` | `failed` |
| 5xx | `ambiguous` | **`unknown`** |

The bias is one-directional: `unreachable` is claimed only with positive evidence the connection
never established. A wrong `unreachable` turns a possible send into a reported non-send and invites
a double send; a wrong `ambiguous` merely asks a human to look.

Reconciliation is `readUnreconciledAttempts()` — a **list for a human**, covering `unknown` and
stranded `pending`. No automatic resolution.

## 18–20. Audit, privacy, tenant isolation

Seventh governance-audit sibling: `governance.action.execution.attempted`, written **exactly once
per attempt** inside the spend transaction (asserted: `count(events) = count(attempts)`). Its
metadata interface has no field an address, credential or response body could arrive in.

Privacy proven by scanning every attempt row and every audit row for the address, the domain, the
message content, the API key and the endpoint URL — none appears.

Tenant comes from `resolveTenantContext()`, never payload; three composite FKs make cross-tenant
attempts a database error. `action_permits` gained the `UNIQUE (tenant_id, id)` anchor every
sibling already had.

## 21–22. Execute boundary and UX

One server action, `executeAuthorizedActionAction({ permitId })`, on `/approvals`. A firewall test
pins the complete set of files that can reach `executeAuthorizedAction` to exactly three, and
proves no Heby surface — inlet, commands, model, runtime, actions, or the `/heby` route — imports
it. The approve path is separately asserted not to contain it: **approving never executes.**

Surface states: pending review · authorized (not executed) · accepted by provider (+ message id) ·
refused · failed · **unknown**, rendered as a warning with "Do not retry blindly". No execution
console, no new workspace.

## 23. Arming state

**PREPARED, NOT ARMED.** Switch ships disabled; no credential; no endpoint; **no vendor selected.**
A test asserts the ambient environment yields `adapter-unavailable`, and that a non-HTTPS endpoint
is treated as absent rather than downgraded.

## 24–25. Registry tripwire and record-integrity repairs

`validateActionRegistry()` was **strengthened, not deleted**. The exception is one named action
kind, and it carries four extra obligations plus a cardinality guard:

- a device action may **never** connect, whatever the allowlist says;
- the exempt tool must stay `CONSEQUENTIAL_MUTATION` + `irreversible`;
- it must stay `human-review-required` + `governanceGated`;
- **at most one** tool in the registry may declare a connected mutation substrate.

Claims R3B made false, repaired: `EXECUTION_SUBSTRATE_GAP` (now `executionPresent: true`,
`executionArmed: false`), `ACTION_PERMIT_NON_EFFECTS`, the hard-coded `executed: false` on the
permit surface (now **derived** from the attempt), the `/approvals` page header, and the whole
Operations Substrate readiness model. The stale header in `consume-action-permit.server.ts` — which
claimed a digest mismatch *burns* the permit while the code has always rolled back — was corrected
to match the code, not the reverse.

## 26. Firewalls held

One action · one adapter · one endpoint kind · one outbound operation. No Computer Use, browser,
shell, filesystem, agent, workflow runtime, permission or policy mutation, generic dispatcher,
arbitrary URL, dynamic loading, worker, scheduler or queue. The runtime inserts into and updates
**exactly one table** — its own — and deletes nothing (asserted by AST-shaped greps).

## 27. Tests

Three new suites, 384 total passing. No live provider call anywhere: every adapter is injected,
every fetch is injected, and the only configured host is `.invalid`.

Twenty pre-existing tests were repaired, in three expected classes — substrate-connected sweeps
(narrowed by action kind, never deleted), migration-count pins (the phase-scoped-claims pattern),
and the audit-sink owner allowlist. `tests/r3r-flow/recipients-postgres.ts` had pinned a **global**
count of 28; it is now state-relative to the migrations on disk.

## 28. Limitations (deliberate, recorded)

1. **No vendor.** The transport implements a declared generic JSON contract; binding it to a real
   provider is Gate B.
2. **One sender for all tenants** — a consequence of the system-owned credential. R5.
3. **Global kill switch** — pausing one tenant pauses everyone. R5.
4. **Delivery is unclaimable.** No webhook exists (there is no `src/app/api` route surface at all).
5. **UNKNOWN reconciliation is human-only.** No provider lookup, by design.

## 29. Commit readiness

Ready for the Director commit gate. Nothing committed, tagged or pushed; no canonical migration.

**Still required before any real send — a separate Director gate:** select a provider (new external
dependency + new spend), configure its credential and HTTPS endpoint, then enable
`external-send.director_enabled`.

## 30. Roadmap

`R3A ✅ → R3W ✅ → R3R ✅ → R3A.1 ✅ → R3B ◀ (implemented, disarmed) → R4 Customer Productization
→ R5 Production Hardening`

R4 may begin after the commit gate. The UNKNOWN reconciliation surface shipped inside R3B rather
than being deferred, so no execution-hardening subphase stands between here and R4.
