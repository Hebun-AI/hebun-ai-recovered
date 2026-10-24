# AUTH-EMAIL-OWNERSHIP-1 · deferred production acceptance · NOT a closure record

**This is not a closure record and the phase is not CLOSED.** It carries no §16.1 contract and has
no §21 row. It exists so the open blocker AEO-1-PROD-DELIVERY-1 (§22) has a detail record. The
Director deferred the remaining production acceptance on 2026-10-24 in favour of product work.

## Measured state (2026-10-24)

- **Implementation:** commit `dfbc6b5d` on `main` (fast-forward from `69701d3f`).
- **Schema:** production migration #81 `20261024105301_auth_email_ownership` applied through the
  production migration ceremony; ledger 81, digest `709c61502d8121fe14706af9b74957a3`. Read-only
  post-checks: table, enum, constraints and indexes present; the three existing identities preserved,
  ownership evidence NULL on all.
- **Deployment:** `dpl_C83rYx19pBGg4w6LJxpyYcDH1hLd`, built from Git `dfbc6b5d` without build cache,
  READY, aliased to `www.hebuntech.com` and `hebuntech.com`. (The first build of the push,
  `dpl_2EwwzJNGKa6jQVGYBpiWjewW9bLR`, failed on a restored Vercel build cache — a `next/font/google`
  Turbopack resolve error — and was never promoted; a no-cache rebuild of the same commit succeeded.)
- **Provider:** Resend workspace `hebuntech`, Free plan. Domain `auth.hebuntech.com` VERIFIED in
  `us-east-1` with three Vercel DNS records (DKIM TXT `resend._domainkey.auth`, CNAME `send.auth`,
  CNAME `rsend.auth`); stored domain settings `click_track: false`, `open_track: false`, no tracking
  domain. Dedicated key `hebun-auth-mail`: `sending_access`, restricted to `auth.hebuntech.com`,
  created and installed by the Director. Root-domain records and the tenant external-send key are
  unchanged. The Free plan's 100/day quota is shared with tenant external send.
- **Configuration:** `HEBUN_AUTH_MAIL_API_KEY`, `HEBUN_AUTH_MAIL_FROM`, `HEBUN_AUTH_MAIL_LINK_ORIGIN`
  present in Production (all stored Sensitive; values not read), each created before the deployment.
  The deployed server treated the configuration as usable: the ownership notice rendered.

## The blocker — AEO-1-PROD-DELIVERY-1

One production verification request was made from the Director's signed-in account
(2026-10-24 18:49:44Z). The application recorded one challenge with `delivery_outcome = rejected`:
the provider answered with a 4xx and nothing was sent. No email was received and no ownership was
verified.

**The HTTP status is UNKNOWN.** Hebun records only the outcome class (`rejected` covers every 400–499
response), the runtime logs show only the server action's own 200, and the Resend dashboard showed no
log for the request — without a positive control, since older sends are no longer listed and the
dashboard's per-key usage counters read 0 even for a key that has sent. Authentication, sender or
domain permission, request format and quota cannot be told apart from this evidence. An earlier
"invalid API key" attribution was withdrawn for that reason.

**Product consequence of the deferral.** Since `dfbc6b5d`, accepting a Governance genesis
nomination requires proven email ownership (`genesis-acceptance.server.ts` refuses with
`email-ownership-unproven`). While no verification email can be delivered, no new self-service
organization can complete activation to its first Governance holder. Organizations whose Governance
already exists are unaffected.

**What PRODUCTION-ACCEPTED still needs:** the provider's status for a send (for example the
attempt's status in Vercel Observability, or a Director-approved diagnostic), a correction if one is
indicated, then one accepted send, the email received, the confirmation completed in the account's
own session, the ownership evidence linked to the consumed challenge, and the notice gone.

## Preserved

Existing sign-in, tenant membership, Governance authority and EXTERNAL-AI-DATA-USE authorization are
unchanged: a full read-only table digest before and after the attempt differed only in the new
challenge row, the Director's sign-in sessions and the sign-in update of `auth_credentials`.
