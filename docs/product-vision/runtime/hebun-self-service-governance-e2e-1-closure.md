# SELF-SERVICE-GOVERNANCE-E2E-1 · production onboarding chain · closure record · PRODUCTION-ACCEPTED (scoped)

First production run of the self-service chain: sign-up, operator nomination, email ownership proof,
genesis acceptance and Governance establishment. **Scope of the acceptance: one purpose-built test
organization, one human, one run, on one release.** No code changed in this phase. It measures the
release; it adds no capability.

## What was tested

- **Test organization:** `hebun-e2e-test-01` (Hebun E2E Test 01), `provisioning_source =
  self-service-signup`. It represents no customer and no real organization.
- **Test identity:** `senoltr+hebun-e2e-1@gmail.com`, the only member.
- **Release:** Git `35359843bb3c65857b9fb6fb186b09222c4096c6`, deployment
  `dpl_CE2yuDJhVvEZNRD4FYGEMQV6sXH3`, READY, aliased to `www.hebuntech.com` and `hebuntech.com`.
- **Order, chosen by the Director:** G1 → G3 → G4 → negative control → G2 → G5 → G6. Proving the
  address after the nomination made the production refusal observable.

## Chain evidence (2026-10-30, UTC)

| Step | When | Actor | Evidence | Result |
|---|---|---|---|---|
| G1 sign-up | 17:16:01 | Director | Tenant row created; Director saw Owner role; verification mail in the Inbox | PASS |
| G3 listing | after 17:16 | Operator read | `--pending`: 1 organization, this slug, one member, `address NOT confirmed` | PASS (CLI) |
| G3 screen | — | Director | Director-supplied screenshot, not independently verified; see below | NOT PROVEN |
| G4 nomination | 17:23:36 | Director, terminal | Row `d45a1eab-3589-4e1e-915d-3c33062df0cf`, `pending`, `production-operator-ceremony`, identity matches | PASS |
| Negative control | before G2 | Director | Director reported the nomination shown, no accept button, because the address was unproven | PASS (Director report) |
| G2 ownership proof | 17:28:58 | Director | `email_ownership_verified_at` set; challenge consumed at the same instant, linked, not superseded, `delivery_outcome = accepted`, address matches; 1 challenge issued, 1 consumed | PASS |
| G5 acceptance | 17:32:45 | Director | Nomination `accepted`, `aal1`, `consumed_at` empty; one `governance.genesis-nomination.accepted` audit row whose challenge id equals the proving challenge; no decision, no session | PASS |
| G6 establishment | 17:40:36 | Director | Decision `7e4ad0b7-cb54-4688-aaa8-4b7cf4287055`, session `2ef191da-c918-4baa-8086-6875b2320030`; see below | PASS |

**G6 detail.** One `decision_records` row: `bootstrap = true`, `certify`, `authority-established`, human
actor who is the nominee, evidence naming the nomination, 221-character justification beginning
"Test amaçlı kurulum:". One `governance_sessions` row, linked to the decision. Nomination consumed at
17:40:36 by that decision. One `governance.bootstrap.established` audit row naming the decision, session
and nomination. The tenant's Governance audit rows are exactly the acceptance and the establishment, so
no refusal was recorded. Member count 1.

**Other tenants.** A digest over the 3 non-test tenants was taken before G5 and read again after G5 and
after G6: `467bfa220eb4d87047d21ffac77cb3ed` all three times. It covers tenant status, nominations,
bootstrap decisions, memberships and roles. **It does not cover those tenants' ordinary Knowledge, Work
or Heby activity**, which is live and was deliberately left out.

**How production was read.** Every database check ran in a connection with
`default_transaction_read_only=on`, inside `BEGIN READ ONLY`, aborted unless `transaction_read_only =
on` and unless the cluster identifier and database equalled the pinned target, and always ended in
`ROLLBACK`. Secrets were loaded by `node --env-file` and not printed. Two of these reads failed on a
wrong column name in the session's own query and wrote nothing.

## Follow-ups, assessed one by one

- **AEO-1-GOVERNANCE-NOMINATION-1 — CLOSED, scoped.** Its dependency was one real nomination accepted in
  production by an identity with a proof. G5 is that act. It covers this test identity and tenant.
- **TA1-PROD-PENDING-CLI-1 — CLOSED.** The production listing ran under Director authorization on both
  paths: empty (`None`, 0 organizations, before G1) and populated (1 organization, after G1).
- **TA1-PROD-PENDING-UI-1 — remains DEFERRED, NOT PROVEN.** The Director states that a screenshot showing
  "Awaiting platform review" together with "Hebun E2E Test 01" was shared in a ChatGPT conversation,
  outside this session. It is Director-supplied evidence. The executing session never saw it and did not
  verify it independently: the only images received here are from 16:50–16:52 UTC, before the tenant
  existed. The `/governance/authority` readiness row was not verified either, so no full PASS is recorded.
  The nomination at 17:23:36 ended this state for this tenant, so neither half can be observed on it
  again. By Director decision the §22 row is unchanged.
- **AEO-1-OWNERSHIP-ROW-READ-1 — remains DEFERRED.** Its subject is the `senoltr@gmail.com` proof from the
  AEO-1 acceptance, and that row was not read. This phase read the test identity's proof only, so the same
  link is shown on one other identity. The §22 row is unchanged.

## Not covered

- A separate mailbox: the test address is a Gmail plus-alias, so a distinct address string received mail,
  and it landed in the same inbox as `senoltr@gmail.com`.
- More than one organization, a second run, or a real customer.
- Anything after Governance exists: data-use decision, delegation, member role, invitations, providers.
- Strong authentication: acceptance and establishment ran at `aal1` with no MFA.
- Mail provider logs: the Resend log and message id were not read for this send.
- First nomination output: the terminal was closed and its output lost. The row above is the evidence. A
  second run by the Director was refused with `already has a pending genesis nomination` and wrote nothing;
  one row exists.

## Records left in production

No path deletes these and none was attempted: the user, identity and credential, the tenant with its role
and membership, sessions, one consumed challenge, the consumed nomination, the bootstrap decision, its
session and two audit rows. The slug and the address stay taken. The tenant is still **active** with
Governance held by the test identity (E2E-TEST-TENANT-RETENTION-1). Suspension is an operator ceremony and
was not run.

## Open items

- **E2E-TEST-TENANT-RETENTION-1 (DEFERRED).** A Director decision to suspend the test tenant with
  `tenant:lifecycle` or keep it active. Reactivation exists; deletion does not.
- **E2E-REGISTER-LEGAL-LINKS-1 (DEFERRED).** Production `/register` shows no link to `/terms` or
  `/privacy`, and its source has none. Observed in passing. It did not affect this test and nothing was
  changed. A Director decision on sign-up consent and wording.

## Verification (V0)

V0: this phase changes documents only and no behaviour. The production chain above is acceptance
evidence, and it is not a test result. No suite ran. An earlier V3 result is not claimed as current.

| Check on this branch | Result |
|---|---|
| `tests/development-continuity/closure-contract.ts` | PASS |
| `git diff --check` | clean |

## Three questions

1. **What did we learn?** The onboarding chain holds together in production on one run, and ordering the
   proof after the nomination let a real refusal be seen without any extra write to Governance records.
2. **How does this improve Turkish Rug House?** It changes nothing in TRH. It shows that the path that
   gives a new organization its first Governance holder works, so a future client organization has a route.
3. **How does this become part of Hebun AI?** New organizations can reach Governance through the product,
   with one operator nomination still between sign-up and acceptance.

## Closure Contract (v1)

- Phase: SELF-SERVICE-GOVERNANCE-E2E-1
- Owner: docs/product-vision/runtime/ acceptance record over apps/dashboard/src/features/self-service-signup, governance-genesis and governance-decision; no code changed
- Reached state: PRODUCTION-ACCEPTED
- Implementation commit: 35359843 (the release measured; this phase has no implementation of its own)
- Verification level: V0 — documents only, no behaviour changed; the production chain is acceptance evidence, not a test result
- Verification evidence: closure-contract.ts PASS and git diff --check clean on this branch; no suite ran
- Test environment: separate git worktree, Node 24 for the continuity test
- Deployment evidence: dpl_CE2yuDJhVvEZNRD4FYGEMQV6sXH3, READY, Git 35359843, aliased to www.hebuntech.com and hebuntech.com; the release measured, not a new deployment
- Production acceptance evidence: scoped to one test organization, one identity, one run — nomination d45a1eab-3589-4e1e-915d-3c33062df0cf accepted 2026-10-30T17:32:45Z after a proof at 17:28:58Z; bootstrap decision 7e4ad0b7-cb54-4688-aaa8-4b7cf4287055 and session 2ef191da-c918-4baa-8086-6875b2320030 at 17:40:36Z; audit rows accepted and established; digest of 3 other tenants unchanged; forced read-only reads
- Deferred risks: AEO-1-GOVERNANCE-NOMINATION-1 (CLOSED); TA1-PROD-PENDING-CLI-1 (CLOSED); E2E-TEST-TENANT-RETENTION-1 (DEFERRED); E2E-REGISTER-LEGAL-LINKS-1 (DEFERRED)
- Director approvals: on 2026-10-30, separately — A1 one sign-up with this address and name; read-only production listings; A4 one nomination; G2 one use of the existing link; A5 one acceptance; A6 one establishment with the recorded justification; acceptance of the G1–G6 result and preparation of this closure; the decision that TA1-PROD-PENDING-UI-1 stays DEFERRED; one local commit of this record. Push, deployment and suspension of the test tenant are NOT approved
