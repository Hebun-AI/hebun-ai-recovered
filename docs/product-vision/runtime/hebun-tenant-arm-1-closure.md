# TENANT-ARM-1 — Per-Organization External-Send Arming · Closure

External-send arming had no tenant dimension: `provider_connectivity_controls` is keyed by
`provider_key` alone, so the single `external-send` row answered for the whole deployment. Arming it
armed every organization at once. TENANT-ARM-1 left that row byte-unchanged and supplied the missing
half beside it:

```
effective external-send arming = tenant arming active AND root control enabled
```

**Release commit:** `8816dfba`. **Deployed and observed commit:** `8816dfba` — **identical**
(Vercel production READY, `meta.githubCommitSha = 8816dfba`). **Production migration ledger:**
**59 → 60**, applied set is an exact prefix of canonical by hash, `pending = 0`, last applied tag
`20260923071401_tenantarm1_tenant_external_send_authorization`.

---

## 1 · Truth semantics

```
IMPLEMENTED                                  YES
DEPLOYED                                     YES
MIGRATED                                     YES
TENANT CONTAINMENT PRODUCTION-VERIFIED       YES
ARM -> REACHABLE production-verified         YES
DISARM -> REFUSED production-verified        YES
CROSS-TENANT ISOLATION production-verified   YES
REAL EXTERNAL-SEND EXECUTION                 NOT VERIFIED / DEFERRED
```

**Reason for the deferral.** Turkish Rug House had no legitimate configured external recipient and
no valid unconsumed `send-external-communication` Governance permit. **No synthetic production state
was created merely for acceptance** — no recipient was invented, no permit was minted, no approval
was manufactured, and nothing was sent. An acceptance that had to fabricate its own subject would
have proved nothing about the authority it claimed to test.

---

## 2 · What was proved in production, and how

Three ceremonies and three read-only verifications, all against the deployed release from the
release tree. The primary worktree was never used and was never updated.

```
Phase B/C  root armed, every tenant unarmed  -> root ON alone authorizes NOBODY
Phase D    arm turkish-rug-house             -> rev 1 active, effective REACHABLE
Phase E    read-only                          -> containment holds, one lineage, one tenant
Phase F    read-only discovery                -> no legitimate permit, no recipient: DEFERRED
Closure    disarm turkish-rug-house           -> rev 2 withdrawn, effective REFUSED
```

### The arming transition

| | root | tenantArmed | effective | reason |
|---|---|---|---|---|
| Turkish Rug House, before | YES | NO (absent) | NO | `tenant-not-armed` |
| Turkish Rug House, armed | YES | YES (rev 1 active) | **YES** | — |
| Turkish Rug House, disarmed | YES | NO (rev 2 withdrawn) | NO | `tenant-arming-withdrawn` |

The root control read `director_enabled = true` throughout. **Arming and disarming one organization
moved the composite in both directions while the deployment-wide row never changed** —
`version = 1`, `updated_at = 2026-08-31 10:02:30.691024+00`, identical to its `created_at`, both
before and after every ceremony.

### Cross-tenant isolation

Measured at every phase, through the same authoritative seams:

```
Hebun AI   root=YES  tenantArmed=NO (absent)  effective=NO  reason=tenant-not-armed
Mulify     root=YES  tenantArmed=NO (absent)  effective=NO  reason=tenant-not-armed
```

Unchanged while Turkish Rug House was armed. Arming one organization armed no other, and no other
organization's state made Turkish Rug House reachable. Two rows exist in
`tenant_external_send_authorizations` in the whole deployment, `distinct tenants = 1`, and both
belong to `turkish-rug-house`.

---

## 3 · The lineage is append-only, and production shows it

```
rev 1  active     8b741afc-8193-41d2-92ec-ae991e7cd59a  supersedes=null
       decision   446b7921-7ecc-45c5-936f-fda435fbd201  approve / external-send-armed
       session    1524e79b-d2fb-406f-b873-a4927fbf028a
       at         2026-09-23 11:45:48.865+00

rev 2  withdrawn  93bedc37-30ee-4deb-8961-e00118c0da40  supersedes=8b741afc-…
       decision   6f5fcb56-667c-49ac-a890-0ac929d08b88  revoke / external-send-disarmed
       session    ccb29355-b742-4bb8-ae6f-465f0a55934d
       at         2026-09-23 12:20:48.893+00
```

Withdrawal wrote a NEW revision naming its predecessor. **Revision 1 was not updated, not deleted
and not rewritten** — "this organization was armed, by this named human, at this instant, and
disarmed by this one at that instant" stays answerable forever. Both decisions carry
`actor_type = human`, subject `tenant_external_send_authorization`, and both decision and session
belong to the Turkish Rug House tenant, matching the authorization they back.

---

## 4 · What the acceptance did NOT do

```
no external send occurred at any point
action_permits                  6 -> 6   (0 created in the ceremony window)
action_execution_attempts       1 -> 1   (0 created; the single row is R3B's, from 2026-08-31)
provider_connectivity_controls  5 -> 5   unchanged, external-send version still 1
tenant-machine-execution        untouched
```

The arm and disarm ceremonies mint no permit, consume no permit, create no execution attempt and
dispatch nothing. Each read-only verification re-counted every table before and after itself and
reported `verification mutated production: NO`.

---

## 5 · Why execution acceptance is deferred rather than failed

The executor requires a conjunction, and production currently satisfies only part of it for a
reason that is not a defect:

```
executeAuthorizedAction
  1. resolveExternalSendReachability(tenant.tenantId)   tenant arming AND root control
  2. permit: tenant match AND status='active' AND consumed_at is null
             AND revoked_at is null AND expires_at > now()
  3. re-read reachability immediately before dispatch
```

Turkish Rug House holds zero rows satisfying (2) — its only non-consumed permit is a `record-work`
permit that expired on 2026-09-14 — and zero external recipients. Half of the conjunction is now
production-verified in both directions; the other half needs a real recipient and a real Governance
approval, which are Director decisions about the business, not acceptance chores.

**What remains unproven is therefore narrow and named:** that a permitted send, under an armed
tenant, reaches a real person. Nothing in TENANT-ARM-1's own subject matter is unproven.

---

## 6 · Limitations recorded

1. **The root control is still a single global row.** That is deliberate: one deployment holds one
   provider account and one credential, and re-keying the table would break the identity of `claude`
   and `provider-observation-read`, keys for which per-tenant containment models a boundary that
   does not physically exist.
2. **There is no in-app path to arm a tenant**, by design. The ceremony is an operator terminal
   invoking the tenant's own Governance authority; an in-app Director path that armed a *different*
   tenant would recreate the cross-tenant authority this phase closed.
3. **Execution acceptance is outstanding**, as §1 and §5 state.

---

## 7 · Verification provenance

Read-only verifiers, run from the release tree against production, committed to nothing:
`scripts/tenant-arm-1-production-verify.ts` (Phase B/C),
`scripts/tenant-arm-1-phase-e-verify.ts` (Phase E and closure),
`scripts/tenant-arm-1-phase-f-discovery.ts` (permit and recipient discovery). Every statement in all
three is a `select`.

**TENANT-ARM-1 IS CLOSED,** with the execution acceptance deferred and named above rather than
claimed.
