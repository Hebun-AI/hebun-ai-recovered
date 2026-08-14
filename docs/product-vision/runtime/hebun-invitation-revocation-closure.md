# HEBUN — HUMAN ONBOARDING INVITATION REVOCATION — CLOSURE RECORD

Date: 2026-08-14. Baseline: `ec7f8e3` (`main`, `0/0` with `origin/main`, release tag
`hebun-public-onboarding-entry-surface-complete` published).

Gate A for this phase is PART FOURTEEN (§105–112) of
`hebun-first-durable-governance-ceremony-execution.md`, which classified the situation **C — schema
support exists, no authoritative runtime**. That classification held: this phase added a writer and
nothing else.

---

## 1. Root cause

A one-time onboarding capability was lost before it was spent. That part is correct behaviour —
`randomBytes(32)` returned once, only an HMAC-SHA256 digest persisted, no read seam returns it, no
audit row carries it. It is unrecoverable by construction and remains so.

The **defect** was what happened next. `invitations_pending_email_uq` is
`(tenant_id, normalized_email) WHERE status = 'pending'`, and production wrote exactly two status
values ever: `pending` at issuance and `accepted` at acceptance. `expired` and `revoked` were enum
members nothing ever set.

Expiry is a **predicate** the runtime evaluates (`expires_at <= now`), never a state it **records**.
So a lapsed invitation stayed `pending` forever and kept holding the tenant/address slot —
`issueInvitation` would have refused `invitation-already-pending` permanently. **Waiting for expiry
made the address permanently un-invitable rather than resolving it.**

This was never specific to the incident: in the previous build, *any* lapsed invitation permanently
blocked re-invitation of that address in that tenant.

---

## 2. What was built

**Runtime**

| File | Responsibility |
|---|---|
| `src/features/human-onboarding/revoke-invitation.server.ts` | The missing writer. Ends one `pending` invitation. |
| `src/features/human-onboarding/read-revocable-invitations.server.ts` | Authority-gated, tenant-scoped list of outstanding invitations. |

**Extended, not duplicated**

| File | Change |
|---|---|
| `src/features/human-onboarding/contracts.ts` | Revocation vocabulary, `INVITATION_REVOKED_ACTION`, `REVOCATION_SEMANTICS`, non-effects. |
| `src/features/governance-audit/human-onboarding-audit.server.ts` | `recordInvitationRevokedWithin` + `recordsInvitationRevocation` on the existing boundary constant. **No new sink.** |
| `src/app/(dashboard)/governance/authority/actions.ts` | `revokeInvitationAction`. |
| `src/app/(dashboard)/governance/authority/page.tsx` | Reads the new seam. |
| `src/components/governance-authority/membership-authorization-card.tsx` | The `InvitationRevocation` control, beside issuance. |

**Zero schema, migration and dependency delta.** The columns were already there:
`revoked_at`, `revoked_by_type`, `revoked_by_id`, `revocation_reason`, the enum member `revoked`,
`invitations_revocation_actor_chk` and `invitations_revoked_chk`. Only the writer was missing.

---

## 3. Authority

Revocation takes the **same** authority as issuance, through the **same** resolver
(`resolveGovernanceAuthority`), for a reason that is not decorative: whoever may mint an outstanding
bearer secret is exactly who may destroy one.

Like issuance, it is an act performed **under** Governance authority and **not a Governance
decision** — `decision_records` is not written. The decision was made at I1; ending the capability it
produced is mechanical, and inflating the constitutional ledger with it would make history claim
decisions nobody made.

Human Onboarding owns invitations, so it owns their revocation. No new subsystem, no new resolver.

---

## 4. Semantics

- **Revoked ≠ deleted.** The row, the digest and the issuance history all remain. Nothing anywhere
  deletes an invitation, asserted by test.
- **The digest is never rotated.** `revoke-invitation.server.ts` contains no `tokenHash`, no
  `digestInvitationToken`, no `randomBytes` — the lost capability is now permanently bound to a row
  every validation path refuses.
- **The authorization stays `consumed`.** Revocation reads it for provenance and never writes it.
  Un-consuming it would erase the fact that a capability really was issued and let one Governance
  decision produce two. This is the phase's most important structural claim and has its own test.
- **Eligibility is `status = 'pending'` and nothing else.** `expires_at` is deliberately *not* a gate:
  a lapsed invitation is exactly the case that stranded the slot, so refusing to revoke it would have
  left the original defect open. The result reports `wasAlreadyExpiredByClock`; the act is identical.
- **Input is two things:** which invitation, and why. Tenant, actor, status and timestamps are derived.
  The reason uses the shared `validateJustification` (24–2000) and the column keeps the leading 128,
  exactly as I1.2's rejection already resolves the same mismatch.

---

## 5. Audit

Action `onboarding.invitation.revoked`, entity type `invitation`, on the **existing** shared sink.
Metadata carries `invitationId`, `membershipAuthorizationId`, `authorizationRemainsConsumed: true`
and `wasAlreadyExpiredByClock`. It carries **no** capability, **no** digest, **no** address, and
**not the reason** — `invitations.revocation_reason` owns that, and copying a human-authored sentence
into two places that can drift would be the inflation.

---

## 6. Concurrency

`resolve authority → transaction → conditional UPDATE … WHERE status = 'pending' → audit → commit`.
A zero-row update throws `RevocationRaceLost`, which unwinds the audit row with it. Proven against
real PostgreSQL: two simultaneous revocations produce exactly one `revoked`, one stable refusal, and
**exactly one** audit row.

---

## 7. Verification

| Check | Result |
|---|---|
| `tsc --noEmit` | clean |
| `eslint` | 0 errors (14 pre-existing warnings, none in new files) |
| `npm run test:run` | **351 passed, 0 failed** (was 349) |
| `npm run build` | clean |
| `git diff --check` | clean |
| schema / migration / dependency delta | **0 / 0 / 0** (24 files, 24 journal entries) |

**Attack matrix proven on disposable PostgreSQL** (`tests/invitation-revocation-flow/revocation-postgres.ts`):
unauthenticated · ordinary member · `owner` band without Governance · foreign tenant · guessed and
malformed ids · missing/short/oversized reason · live delegate permitted · **revoked delegate
refused** · happy path · durable row shape · revoked-is-not-deleted · **authorization stays
consumed** · exactly one audit row with no secret · lost capability refused by Act 1 *and* acceptance
· replay refused with no audit · **slot freed and full C2→C3 flow works again** · old capability still
dead after a replacement exists · **lapsed-by-clock invitation revocable and slot freed** · accepted
invitation refused with its membership untouched · concurrent revoke with exactly one winner.

---

## 8. Two sibling tests were narrowed, deliberately

`tests/i2-flow/boundaries-and-firewall.ts` and this repository's own
`tests/onboarding-entry-flow/boundaries-and-firewall.ts` both asserted that no `page.tsx` may contain
the string `human-onboarding`. That was a **proxy** for the real invariant, not the invariant itself.

A server page legitimately imports read seams — `/governance/authority` already imports them from
`membership-authority`, `identity-enrollment`, `tenant-role-baseline`, `governance-decision` and
`governance-genesis` — and this phase added one under `human-onboarding`. The proxy would have failed
that legitimate read while still permitting anything named differently.

Both now assert what they were always standing in for: **no page reaches the onboarding mutation
path** — not `issue-invitation.server`, `accept-invitation.server` or `revoke-invitation.server`, and
not `issueInvitationAction` or `revokeInvitationAction`. Stricter about acts, honest about reads.

---

## 9. Durable database non-effects

`hebun_r1` was **read only** for the whole phase. Every flow test ran against disposable databases
through their own ownership handles. Verified at the end:

```
invitation  9e3af81e…  status pending · revoked_at NULL · revocation_reason NULL
authorization 97d165f3… status consumed
identity_enrollment_requests 0 · users for senoltr@gmail.com 0 · memberships 0
invitations 1 · audit_log 6 · applied migrations 24
```

**The real invitation was not revoked, and was never used as a test fixture.**

---

## 10. UI proof, and its honest limit

Verified against the running dev server on port 4000 (port 3000 untouched):

```
GET /governance/authority → HTTP 307 → /login     (still protected)
GET /login/join           → HTTP 200
GET /login                → HTTP 200
```

**The populated revocation control was not proven in a browser.** Reaching it requires an
authenticated session for the Acme Governance authority; those credentials were not available and
were not requested, and the only alternative — creating fixture state — would have meant writing to
`hebun_r1`, which was forbidden and correctly so.

What *is* proven: the control's wording, its four operator statements rendered from frozen values,
and its action wiring by the firewall test; its behaviour end to end by the PostgreSQL flow test; and
the route's protection by the live check above. The gap is the rendered control with real data, and
it will close the moment the Director opens the page.

---

## 11. Remaining limitation — expiry is still not materialized

Revocation frees the slot for a lapsed invitation, so the operational recovery path is closed. But
**nothing still writes the lapsed status value**: a lapsed invitation reads `pending` until a human
revokes it, and it keeps holding the tenant/address slot until then.

Automatic expiry materialization is **deliberately deferred**, not forgotten. Building a sweeper now
would have meant a background writer, a schedule, and a second thing that mutates invitations —
scope this phase did not need, because an authorized human revocation demonstrably frees the slot.
It is recorded here so the deferral is a decision rather than an oversight.
`REVOCATION_SEMANTICS.expiryStillNotMaterialized` states it in code.

---

## 12. The real incident: exact recovery point after release

Nothing is fixed yet. After this phase is released and the Director explicitly acts:

1. `/governance/authority` → the Acme onboarding for `senoltr@gmail.com` →
   **Revoke onboarding capability**, with a reason of at least 24 characters.
   → invitation `9e3af81e…` becomes `revoked`; the lost capability dies; the slot is freed.
   → authorization `97d165f3…` stays **consumed**. It is not returned and must not be.
2. **Authorize New Member** for `senoltr@gmail.com` — a new Governance decision, which is exactly
   what `CONSUMPTION_SEMANTICS` already required for re-inviting.
3. **Issue onboarding capability** against that new authorization — and this time preserve it before
   closing the display.

C3 remains historically completed. Act 1 remains not started. **The incident stays unresolved until
this feature is released AND the Director performs step 1 themselves.**

---

## 13. What this phase did not do

No migration, schema change, new table, column or enum value. No new authority, resolver, audit sink,
token format or authentication mechanism. No middleware change. No invitation deletion, digest
rotation or authorization resurrection. No mail, provider, execution or Computer Use reach. No
automatic expiry sweeper. **No commit, no tag, no push. The real invitation was not revoked.**
