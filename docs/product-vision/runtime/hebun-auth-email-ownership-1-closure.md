# AUTH-EMAIL-OWNERSHIP-1 · email ownership proof · closure record · PRODUCTION-ACCEPTED (scoped)

Closes the deferred production acceptance recorded in
`docs/product-vision/runtime/hebun-auth-email-ownership-1-deferred-acceptance.md` and resolves
AEO-1-PROD-DELIVERY-1. **Scope of the acceptance: one production account, `senoltr@gmail.com`, one
send, one confirmation.** Nothing here is a claim about any other account, organization or address.

## What changed

- **Implementation:** `dfbc6b5d` (email ownership proof, migration 81), described in the deferred
  acceptance record. Not changed by this closure.
- **Delivery diagnostic:** `8b5e8b04` makes `auth-mail.server.ts` log one line when a send is not
  accepted: `[auth-mail] delivery=<outcome> http=<status>`. It logs no recipient, token, key or
  provider response text. It logs nothing on an accepted send.
- **Configuration:** the Director created a new Resend key and replaced
  `HEBUN_AUTH_MAIL_API_KEY` in Vercel Production (updated 2026-10-30T07:26:31Z). `HEBUN_AUTH_MAIL_FROM`
  and `HEBUN_AUTH_MAIL_LINK_ORIGIN` were not changed. No value was read, printed or logged by the
  executing session.
- **Deployment:** `8b5e8b04` was redeployed so production took the new value. No code changed for
  the redeploy.

## Delivery attempts

| When (UTC) | Deployment | Application outcome | Provider evidence | Mail received |
|---|---|---|---|---|
| 2026-10-24 18:49:44 | `dpl_C83rYx19pBGg4w6LJxpyYcDH1hLd` | `rejected` | HTTP status unknown | No |
| 2026-10-30 ~07:04 | `dpl_uoyRX2zKZcXwRdWjUwVZxh2DEvt8` | `rejected` | `[auth-mail] delivery=rejected http=400`; the Director found no `POST /emails` in Resend Logs for the prior 15 days | No |
| 2026-10-30 16:49:08 | `dpl_3d8HDDc2kHaguBY88ZXrfUSgRgn1` | `accepted` | No `[auth-mail]` line; numeric status and Resend log not observed | Yes |

## Production acceptance — measured

- **Deployment:** `dpl_3d8HDDc2kHaguBY88ZXrfUSgRgn1`, READY, target production, Git
  `8b5e8b04d3fc86024e4c541c66b8a8381f1786d3`, created 2026-10-30T07:33:01Z, after the key update.
  `www.hebuntech.com` and `hebuntech.com` resolved to it by `vercel inspect` before the send and
  after the confirmation.
- **Before the send:** signed-in account `senoltr@gmail.com` (Owner); ownership notice rendered, so
  the state was unverified.
- **Send — accepted:** one click on `Send a new link`. The UI showed the `accepted` text. By
  `classifyResponse`, that outcome needs a non-error response carrying a provider message id. A log
  line's absence was not counted as proof on its own.
- **Delivery — confirmed:** the Director reported the mail in the Inbox of `senoltr@gmail.com`, from
  `no-reply@auth.hebuntech.com`, at 19:49 local (16:49 UTC). Provider acceptance is recorded apart
  from this; only the received mail proves delivery.
- **Verification link — confirmed:** the Director opened the link. The first open, in a browser with
  no Hebun session, was refused with the sign-in message. The code refuses that case before reading
  the token, so the link stayed usable. After the Director signed in, the second open reached the
  confirmation button and the page showed "Your email address is confirmed." That text renders only
  for the `verified` result, which `confirmEmailVerification` returns only after one transaction has
  consumed the challenge and written the identity's proof.
- **UI — confirmed:** after a reload of `/command`, the account read `senoltr@gmail.com` (Owner), the
  ownership notice was gone and no send button was present. The notice also hides when delivery is
  unavailable, so this counts as evidence only together with the confirmation result.

## Not proven — not counted as a pass

- **Root cause of the HTTP 400:** the 400 stopped after the key replacement and redeploy, and the key
  was the only value changed. That is a strong indication, not a diagnosis. The previous key and the
  provider's error body were never read. **The exact root cause of the old key's failure is NOT
  PROVEN.**
- **Numeric status of the accepted send:** UNAVAILABLE. Accepted sends write no status line.
- **Provider log and message id of the accepted send:** UNAVAILABLE. The Director did not report a
  Resend Logs entry, and the id was not read.
- **New key's scope and domain restriction, and whether the previous key is still active:**
  UNAVAILABLE. The key is Sending Access by the Director's statement.
- **Production row read:** the proof columns and the challenge row were not read
  (AEO-1-OWNERSHIP-ROW-READ-1). The link between them rests on the transaction above.
- **Governance nomination acceptance with a proof:** not exercised in production
  (AEO-1-GOVERNANCE-NOMINATION-1).
- **Any second account or recipient:** not exercised.

## Open follow-ups

- **AEO-1-NOTICE-UX-1 (DEFERRED).** `EmailOwnershipNotice` renders in `(dashboard)/layout.tsx`, so an
  unverified account sees it on every dashboard screen, `/heby` included. This is a separate UX
  improvement and not a delivery defect. No change was made.
- **AEO-1-GOVERNANCE-NOMINATION-1 (DEFERRED).** `genesis-acceptance.server.ts` refuses with
  `email-ownership-unproven` without a proof. A real acceptance by a confirmed identity has not been
  observed in production. Delivery is no longer the known blocker, and this acceptance stays open
  until it is measured.
- **AEO-1-OWNERSHIP-ROW-READ-1 (DEFERRED).** One authorized read-only production read of the proof
  columns and the consumed challenge.

## Verification (V2)

V2 for the closure delta: `8b5e8b04` changes one auth-mail seam, with no schema, lifecycle or
authorization change. The Director accepted V2 for this documentation closure on 2026-10-30. The
full suite was NOT run at `8b5e8b04`. An earlier V3 run at `dfbc6b5d` exists only in that session's
own notes (candidate 1081/1, baseline `69701d3f` 1076/2). It is historical, was not re-measured and
is NOT a current test result. `EHO-1-RED-SUITE-BASELINE-1` stays open.

| Check at `8b5e8b04`, pre-commit session | Result |
|---|---|
| `tests/auth-email-ownership-1/delivery-status-log.ts` | PASS |
| `tests/auth-email-ownership-1/boundaries-and-firewall.ts` | PASS |
| `tests/auth-email-ownership-1/ownership-postgres.ts` and `email-case-postgres.ts`, isolated PG18 | PASS |
| `tests/auth-email-ownership-1/bite-proofs.ts` | 18/18 bite |
| `tsc --noEmit`, `eslint` on the 5 changed files, production build | PASS |
| `tests/development-continuity/closure-contract.ts` on this record's branch | PASS |

## Three questions

1. **What did we learn?** A stored outcome class hid the failure for six days. One status line made
   it a single-variable question.
2. **How does this improve Turkish Rug House?** Account email proof now works in production, so a
   human holding Governance authority can have a proven address.
3. **How does this become part of Hebun AI?** Ownership proof is the precondition for a new
   organization's first Governance holder. The nomination step is still to be measured.

## Closure Contract (v1)

- Phase: AUTH-EMAIL-OWNERSHIP-1
- Owner: `apps/dashboard/src/features/auth-email-ownership/`
- Reached state: PRODUCTION-ACCEPTED
- Implementation commit: dfbc6b5d (ownership proof) and 8b5e8b04 (delivery status line)
- Verification level: V2 — the closure delta 8b5e8b04 changes one auth-mail seam with no schema, lifecycle or authorization change; the full suite was not run at 8b5e8b04
- Verification evidence: at 8b5e8b04, delivery-status-log, boundaries-and-firewall, ownership-postgres and email-case-postgres PASS, bite-proofs 18/18, tsc, eslint and production build PASS; closure-contract.ts PASS on this branch
- Test environment: disposable worktree with a session-owned PG18 instance; Node 24 for the continuity test
- Deployment evidence: dpl_3d8HDDc2kHaguBY88ZXrfUSgRgn1, READY, Git 8b5e8b04, aliased to www.hebuntech.com and hebuntech.com
- Production acceptance evidence: scoped to one production account, senoltr@gmail.com — one send accepted at 2026-10-30T16:49:08Z, mail received in the Inbox, link opened by the Director, "Your email address is confirmed." shown, notice gone on /command after reload; numeric status, provider log, production row read and root cause of the earlier 400 are not proven
- Deferred risks: AEO-1-PROD-DELIVERY-1 (CLOSED); AEO-1-NOTICE-UX-1 (DEFERRED); AEO-1-GOVERNANCE-NOMINATION-1 (DEFERRED); AEO-1-OWNERSHIP-ROW-READ-1 (DEFERRED)
- Director approvals: push of 8b5e8b04 with automatic production deployment; redeploy of 8b5e8b04 with the updated key; each of the two single production sends to senoltr@gmail.com, on 2026-10-30; preparation of this closure in a separate worktree; on 2026-10-30 the Director accepted PRODUCTION-ACCEPTED (scoped) for this one account and one successful verification only, accepted V2 for this documentation closure, and approved one local commit of this record. Push and deployment of this record are NOT approved

## Amendment (2026-10-30)

The text above is preserved as written and states what was true when this record closed. Its statements
that Governance nomination acceptance and a second account were not exercised describe that moment.
SELF-SERVICE-GOVERNANCE-E2E-1 later exercised both for one test identity, and
AEO-1-GOVERNANCE-NOMINATION-1 is resolved there:
`docs/product-vision/runtime/hebun-self-service-governance-e2e-1-closure.md`. The acceptance scope of this
record is unchanged. AEO-1-NOTICE-UX-1 and AEO-1-OWNERSHIP-ROW-READ-1 stay open here.
