# Hebun — Durable Authorization to Act (R3A) — Closure

**Phase:** R3A, the first half of the readiness audit's §25 **R3 — Execution**
**Date:** 2026-08-16
**Baseline:** `3901a2b`, canonical `hebun_r1` at 25 applied migrations, 368 tests
**Verdict:** see §16

**R3A authorizes. R3A does not execute.** Every claim below is bounded by that sentence.

---

## 1. The cliff this phase closes

The Heby action lifecycle has, since UI Phase 17, produced a complete, honest verdict for a
consequential action and then thrown it away.

`action-preparer.ts` evaluates gates in a fixed order, and the sixth line is decisive:

```
!argumentsValid → FAILED · !workspacePermitted → RESTRICTED · !targetValid → FAILED
DEVICE_ACTION → RESTRICTED · stale → EXPIRED
humanReviewRequired → REQUIRES_HUMAN_REVIEW   ← here
govRequired && !satisfied → REQUIRES_GOVERNANCE · !available → UNAVAILABLE
```

Every mutation tool declares `authorityRequirement: "human-review-required"`, so
`REQUIRES_HUMAN_REVIEW` fires **before** the substrate-availability check. The architecture was
already saying *"a human must decide"* rather than *"this is impossible"* — and there was nowhere
for that decision to happen. `approvals` held zero rows and zero writers, `features/approvals/`
contained only `mock.ts`, and no permit existed anywhere in the schema.

**The prepared action was a value, not a row.** R3A makes it a row, and gives the row a decision.

## 2. The authority owner — unchanged

```
HUMAN ACTOR      Director, or a delegated Governance authority holder
      ↓          resolved by resolveGovernanceAuthority reading decision_records (G2/G3)
AUTHORITY OWNER  Governance
      ↓
DURABLE DECISION decision_records   (approve | reject | revoke)
      ↓          FK, NOT NULL, ON DELETE RESTRICT
PERMIT           action_permits
      ↓          one atomic compare-and-set
HANDOFF          ExecutionAuthorization — no effect
      ↓
EXECUTION        R3B — does not exist
```

There is **no second resolver**. A firewall test asserts every R3A writer calls
`resolveGovernanceAuthority` and names none of `roleType`, `role_permissions`, `authorityScope` or
`permissions`, and that no writer contains `twin` or `predict` — a predicted approval is not one.

## 3. Two tables, because a permit must never exist unapproved

`heby_action_requests` holds the frozen proposal and exists from the moment Heby prepares it.
`action_permits` holds the authorization and exists **only** once a decision approved it.

One table would need a `pending` permit row, and a row in a table called *permit* that nobody
authorized is precisely the collapse this phase exists to prevent. The pairing is not invented:
`identity_enrollment_requests` → `membership_authorizations` is the same shape, written by the same
authority, for the same reason.

## 4. Parameter integrity — the binding is a second digest

`HebyPreparedAction.actionId` is FNV-1a, a **32-bit non-cryptographic** hash, as its own source
says. It is right for dedupe and wrong for a security binding: 32 bits is searchable in seconds, so
a second action could present the same identity and inherit an approval.

R3A therefore adds `payload_digest` — **SHA-256** over a canonical serialization of
`{actionKind, toolId, targetKind, targetRef, sorted typed arguments}` — written on the request,
copied onto the permit at issuance, and re-verified **three ways** at consumption (recomputed
vs. stored vs. bound). Both values are carried; only this one binds.

The serialization is total because the payload cannot be anything else: the Heby argument schema
admits `string | number | boolean`, rejects unknown keys, and `asCanonicalPayload` fails closed on
objects, arrays and non-finite numbers. Separators use characters a JSON scalar cannot contain
unescaped, so `{"a":"1","b":"2"}` cannot be forged from inside a key — the classic canonicalization
bug, asserted against directly.

A plain digest rather than an HMAC, deliberately: the enrollment continuation reference is secret
and is keyed; an action payload is **shown to a human in full**, because a human cannot approve what
they cannot read. Keying it would imply a confidentiality this data does not have.

## 5. Single spend is one statement

```sql
UPDATE action_permits
   SET status='consumed', consumed_at=$3, handoff_id=$4
 WHERE id=$1 AND tenant_id=$2 AND status='active' AND expires_at > now()
```

Validation **is** the spend. A `check → then update` shape leaves a window in which two callers both
read `active` — precisely how one approval becomes two sends. Here the loser updates zero rows.
There is no window to crash inside: a process that dies after the commit has already spent the
permit; one that dies before it has spent nothing.

`now()` is the **database** clock, not the caller's, because a caller that could pass its own could
pass a convenient one.

Proven with eight parallel callers on real PostgreSQL: **exactly one** authorization, seven honest
refusals, one handoff row, and **one** audit event — not eight, not zero.

## 6. Expiry is derived; there is no `expired` state

`expires_at <= now()`. Hebun has **no scheduler** (`setInterval` = 0), so a stored `expired` status
would be a state with no writer — and this repository has already paid twice for declaring a state
nothing transitions rows into. The status enum is `active | consumed | revoked`; the surface derives
`expired` at read time, and a firewall test asserts the enum never gains it.

Expiry is mandatory and server-bounded: max **24h**, clamped server-side, enforced again by
`action_permits_ttl_bounds_chk`. A client may shorten and may never widen.

`action_permits_expiry_after_issue_chk` additionally refuses `expires_at < issued_at` — an operator
cannot quietly retro-expire a live authorization instead of revoking it, because revocation is the
auditable act and expiry is not.

## 7. Revocation ships in the same phase as issuance

I1 declared `revoked_at` and `revocation_reason` on `membership_authorizations` and left them
unwritten; closing that took a whole later phase, and the invitation work had already paid the same
cost once. **A revocation column with no writer is not a safety feature, it is a claim.**

R3A refuses to issue an authorization it cannot withdraw. Revocation costs a `revoke` Governance
decision, a justification and a stated reason, atomically with the permit transition and its audit
row. Its decision **subject is the permit**, and its outcome is `action-authorization-revoked` — the
R3A branch is evaluated *before* the generic `revoke` branch in `writeGovernanceDecisionWithin`,
because otherwise the ledger would record "Governance authority was revoked" when one action's
authorization ended. That ordering is load-bearing.

A consumed permit cannot be revoked, in code and in `action_permits_terminal_exclusive_chk`.

## 8. Tenant isolation is structural

Composite FK `(tenant_id, action_request_id) → heby_action_requests(tenant_id, id)`, over a new
parent unique index. A permit for another tenant's request is a **database error**, proven from both
directions: moving a permit's tenant is refused, and so is moving the request out from under it.

Every read carries `tenant_id = <session tenant>`; there is no unscoped query and no parameter
through which a caller could ask about another tenant.

## 9. Human supremacy at the approval boundary

An agent **may** propose — that is what Heby is for, and `proposed_by_actor_type` records `agent`
honestly. The approver is constrained to `human` by `heby_action_requests_human_approver_chk` and
`action_permits_human_authorizer_chk`, so a model approving its own proposal is a database error
rather than a code-review finding.

## 10. Computer Use stays out

`DEVICE_ACTION` is absent from `AUTHORIZABLE_SIDE_EFFECTS` and refused by
`heby_action_requests_no_device_action_chk`. `READ_ONLY` is absent for the opposite reason: reading
needs no permit, and issuing one would teach the system that it does.

## 11. Audit — five events, and two deliberate absences

`approved · rejected · permit issued · permit revoked · permit consumed`, appended to the existing
`audit_log` through a sixth `governance-audit` sibling. **Zero audit schema change.**

Not audited: **request creation** (a proposal moves no authority; the row is its own record) and
**expiry** (derived — an "expired" event would be a fabricated act with no actor).

Every event carries `executed: false`, and a test asserts no row may say otherwise.

## 12. The execution firewall

The success condition is **AUTHORIZED BUT NOT EXECUTED**, and this is the phase where "wire it up
while you're here" would be most tempting. So the absence is asserted, not trusted. No R3A file may
contain `fetch(`, an HTTP client, `child_process`, process execution, `node:fs`, a browser driver,
a mail transport, a model provider, device/Computer-Use runtime, an execution dispatcher, or agent
dispatch. The only `node:` import permitted is `node:crypto`. No R3A module may import the action
registry it would have to mutate, and no writer may name `substrateConnected`.

Every mutation tool still declares `substrateConnected: false`, asserted directly.

There is **no execute action** in the server-action boundary, and **no propose action** either — a
request is written server-side by the Heby lifecycle, because letting a browser post an arbitrary
action request would make the proposal channel the weakest link in a chain whose whole value is
that the strong link comes later.

## 13. The `/approvals` surface

Extended, not redesigned. Phase 14 built this workspace with honest empty states and its own note
read: *"no real, safe, server-authorized decision-mutation path exists"*. R3A is that path, for
exactly one class of decision.

The region renders the exact target, **every** typed parameter, the expected effect, the
consequences and the reversibility **before** any control to authorize appears — consequences
before confirmation is the Heby Core Phase 6 rule. Permit state, expiry and revocation follow.

Every other region is unchanged and still empty, because no briefing, evidence, recommendation or
history source became connected. A real queue for one class of decision does not license presenting
the others as though it had. "Connected" means the durable read answered — not that rows exist.

## 14. The existing `approvals` table

**Untouched, and deliberately not built on.** Its five columns carry no actor pair, no decision FK,
no target, no scope, no expiry, no revocation, no parameter binding and not one unique constraint,
and `approvalStateEnum` is a review-state vocabulary rather than a permit lifecycle. Extending it
would mean bolting fourteen columns onto a mock and inheriting the wrong enum.

It remains dead: zero rows, zero writers, zero importers. Dropping it is a separate Director
decision and was not taken here.

## 15. Verification

`npm run verify` **exit 0** — lint 0 errors, typecheck, build, **371 passed / 0 failed / 371 total**
(368 inherited + 3 new). `git diff --check` clean.

**Eleven inherited tests were REPAIRED, not weakened**, each audited individually:

- **One** running migration total, 25 → 26, in `authentication-schema/migration.ts` — whose own
  comment says it is *"the ONE place a running total belongs"*.
- **Three** governance-audit sink allowlists, five declared owners → six.
- **Seven** phase-boundary lists that said *"my phase added no migration and what follows is a
  declared later phase"*. Each now names R3A's migration. These are claims about the FUTURE, and a
  legitimate later phase must be added to them rather than allowed to falsify them.

The generated migration was **wrong in the same way KR5's was**: drizzle-kit emitted the composite
FK before the unique index PostgreSQL requires. Proven on a disposable database first —
`there is no unique constraint matching given keys for referenced table "heby_action_requests"` —
then the index was hoisted, and the corrected chain re-proven to 26 applied with `plpgsql` as the
only extension. A firewall test asserts the index precedes the FK.

**Canonical `hebun_r1` is untouched:** still 25 applied, R3A tables absent, `decision_records` 8,
`audit_log` 17, knowledge 1/1, conversations 34, messages 124, approvals 0, `plpgsql` only. Every
mutating test used a disposable database; the one manual probe created for the ordering proof was
dropped, and `pg_database` holds only `hebun_r1` and `postgres`.

## 16. Remaining limitations

1. **Nothing executes.** `EXECUTION_SUBSTRATE_GAP` states it in code: authorization present,
   execution absent, owner R3B. An issued permit is authorization nothing can currently spend into
   an effect.
2. **The handoff has no consumer.** `consumeActionPermit` returns an `ExecutionAuthorization` and
   single-spend is proven, but only a test has ever received one.
3. **No request writer in production yet.** `recordActionRequest` is the seam; the Heby answer path
   does not call it. Wiring that is a deliberate follow-on so that the authorization chain lands
   before anything starts filling it.
4. **`handoff_id` has no foreign key**, because R3B's execution-attempt table does not exist. R3B
   references this id; R3A does not invent a row in a table it does not own.
5. **No browser/e2e harness** — the repository still has none. `/approvals` is proven at source and
   integration level.
6. **Retention is untouched.** Permits and requests accumulate; no deletion path exists anywhere in
   Hebun.
7. **The migration is not applied to canonical.** That is a separate Director-gated ceremony.

## 17. Next gate

Commit gate. **No commit, tag or push was made in this phase.** The roadmap successor is
**R3B — First Executed Action**: one sandboxed adapter, a durable execution attempt keyed by
`handoff_id`, a receipt, and enforced revocation at the execution moment.
