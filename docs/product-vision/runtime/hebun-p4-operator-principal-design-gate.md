# P4 · platform operator principal · DESIGN GATE — DECIDED, NOT IMPLEMENTED

**Not a closure record, and not an authorization.** This is the design gate Master Plan V2 P4 §6–7
requires before any Platform Admin surface exists: "create a real operator principal through a
design gate". Nothing below is built.

**Director decisions (2026-11-10):** D1 (option A), D3, D4, D5, D6 and D7 accepted as recommended.
**D2 decided against the recommendation: MFA is mandatory for any Platform Admin access** (see D2).

## Measured at `cdb3934e`

1. **No operator principal exists.** Master Plan V2 P4 §3: "No in-product platform operator identity
   exists." The code states it as literals that cannot be flipped:
   `BASELINE_ROLE_SEMANTICS.grantsPlatformAdministration: false`
   (`src/features/tenant-role-baseline/contracts.ts`), `GENESIS_OPERATOR_ROOT.isPlatformAdminAuthority:
   false` and `operatorIdentityVerified: false` (`src/features/governance-genesis/contracts.ts`), and
   `provider-connectivity-control.server.ts` "creates no platform operator and no platform-admin".
2. **Platform-wide acts run as CLI ceremonies under deployment possession** — `scripts/tenant-lifecycle.ts`,
   `tenant-provision`, `genesis-nominate`, `scripts/lib/provider-connectivity.ts`. Their root of trust
   is "possession of the deployment"; they say they are "NOT a platform admin". `src/` cannot reach
   them.
3. **Every session is a tenant session.** `insertSessionContext` always writes `activeTenantId` and
   `activeMembershipId` (`session-service.server.ts`). `TenantContextFields` carries no platform or
   operator field. A human with no membership cannot hold a session at all.
4. **Sessions are single-factor.** `SESSION_ASSURANCE_LEVEL = "aal1"` and every session is issued with
   `mfaVerified: false`. No MFA enrollment or step-up exists in the product.
5. **Every released read is tenant-locked by design.** Example: `provider-usage-aggregation.server.ts`
   — "There is no unscoped read, no 'all tenants' mode". A cross-tenant admin view therefore needs new
   read seams; none can be reused as-is.
6. **The audit ledger is ready to attribute operator acts.** `audit_log.authority_source` already
   admits `'platform-admin'` (CHECK constraint, migration `20260719124600`), and `audit_log.tenant_id`
   is nullable, so a platform-level row is representable. Nothing writes either today.
7. **Access control.** `src/middleware.ts` sends any session-less request on a non-public path to
   `/login` and drops the query; the `(dashboard)` layout refuses an unauthorized session. No admin
   route exists. The `HEBUN_SHELL_EXPERIENCE` setting selects navigation only and grants nothing.

## Principles this gate holds every option to

- Operator status is proven **on the server, per request, from one durable record**. Never from email,
  tenant membership, a tenant role (Director included), the shell setting, or any client value.
- Granting and revoking it is **not a product surface**. It cannot be self-granted from inside the app.
- An operator **reads less than a customer**: no tenant content, no customer credential (BYOK, P5), no
  impersonation. Each view reads only the columns it shows.
- **Every operator read is audited** with `authority_source = 'platform-admin'`.
- **Fail closed.** An unreadable grant, an unreadable ledger or an audit write that fails refuses the view.
- **Grant and MFA together.** An operator grant alone opens nothing; admin access needs the grant AND a
  server-verified MFA on the same session (D2).

## Decisions for the Director

**D1 · Shape of the principal.**
- **A (recommended):** a `platform_operator_grant` row bound to an existing `auth_identity_id`
  (status, granted_at, revoked_at, granted_by_ceremony, version). The human signs in exactly as today
  — which, per fact 3, means through a tenant membership (for the Hebun team, the Hebun tenant). The
  membership opens the session; **only the grant row** makes them an operator. Smallest change; reuses
  the released sign-in, session and revocation machinery.
- **B:** a separate operator identity with its own credential, sign-in page and session cookie. Stronger
  separation (a compromised tenant session never reaches admin), roughly a second authentication
  stack to build and prove.

**D2 · Assurance required to enter admin — DECIDED: MFA is mandatory.** Sessions are aal1 today
(fact 4), so this decision keeps admin closed until MFA exists.
1. Platform Admin access opens only with an MFA verification **verified on the server**.
2. A session without that MFA cannot reach `/admin` — not even a read-only view.
3. A password re-check is **not** a substitute for MFA. (The earlier proposal — read-only on aal1 plus
   a password step-up — is rejected.)
4. MFA status is never taken from a client-supplied value (header, cookie, query, body or any flag
   the browser sets).
5. Every admin read checks **both** an active operator grant (D1) **and** the session's verified MFA.
   The grant alone grants nothing.
6. MFA state is bound to the session in trusted server-side session state (e.g. the session row's
   assurance level and MFA-verified time, written only by the server after a successful
   verification), so it cannot be carried to another session.
7. How long an MFA verification stays valid for admin, and when re-verification is required (expiry,
   inactivity, grant change, sensitive view), is defined explicitly in the implementation phase and
   proven by tests. It is not left to a default.
8. **Until MFA infrastructure exists, Admin Dashboard access is closed.** Building MFA is outside this
   documentation task and is a prerequisite package of its own.
9. Customer and Director sign-in are unchanged by this decision; MFA is required for admin only.

**D3 · How a grant is created and revoked.** Recommended: one operator CLI with a closed verb,
`npm run operator:grant -- <email>` / `operator:revoke -- <email>`, on the `tenant-lifecycle.ts`
pattern — deployment possession, explicit confirmation prompt, audit row per act. Revocation takes
effect on the next request (the resolver reads the row every time; no cached claim). Using it against
production is a Director gate each time.

**D4 · First admin views (read-only).** Each is a new, purpose-built cross-tenant read seam that
selects only the listed columns. Recommended first slice:
1. **Organizations:** name, slug, tenant status, status changed at, created at.
2. **Organization size:** active membership count and recorded agent count per tenant — counts only.
3. **AI usage:** recorded provider usage totals per tenant (the same facts R2F.1 records, aggregated) —
   no prompts, no outputs, no conversation content.
4. **Platform services:** existing deployment-level health signals only where a reader exists;
   otherwise shown as "not connected".
Subscriptions and revenue wait for P1 on `main`; costs wait for a cost source. Neither is shown with a
placeholder.

**D5 · Audit.** Every admin page view writes one `audit_log` row: actor = the operator's user,
`authority_source = 'platform-admin'`, `tenant_id` = the tenant viewed or `null` for a platform-wide
list, action `platform.admin.view.<view>`. If the audit write fails, the view is refused.

**D6 · Route and separation.** A separate route group (e.g. `/admin`) with its own layout that runs the
operator resolver before rendering, and each admin read that runs it again (defence in depth). The
customer and Director shells are untouched. The admin theme defaults to Dark (P2 2A `THEME_DEFAULTS.admin`).

**D7 · Schema.** D1-A needs one new table and one migration. It goes through the existing production
migration ceremony; production application is a separate Director gate.

## What implementation must prove before it can be called done

- A user with no grant — customer, member, Director, or Governance holder — is refused on every admin
  route **and** every admin read, by the server.
- A user **with** a grant but without server-verified MFA on the current session is refused on every
  admin route and read; a password re-check does not change that.
- A client-supplied MFA or assurance claim changes nothing; MFA verified in one session does not open
  admin in another.
- An expired MFA verification (per the D2 validity rules) is refused until re-verified.
- A revoked grant is refused on the very next request.
- A forged client claim (header, cookie, query, body) changes nothing.
- A **cross-tenant leak test**: every admin seam returns only its listed columns; no tenant content, no
  credential column, no conversation or knowledge text.
- One audit row per admin view; a failed audit write refuses the view.
- An unreadable grant table or database fails closed.
- Released tenant-scoped readers keep their "no all-tenants mode" pins; admin seams are new modules,
  not new modes of old ones.

## Explicitly out of scope for the first slice

Any operator write (suspend, provision, plan change, credential handling), impersonation or
"view as tenant", support access to tenant content, and any change to customer or Director
authority.

## Implementation path

**Prerequisite: an MFA package** (enrollment, server-side verification, session binding, validity
rules), with its own design gate. Until it exists, admin access stays closed and the steps below may
be built and tested locally but cannot open `/admin` to anyone.

Implementation order: MFA package → D7 migration (local) → grant ceremony (D3) → server resolver +
admin layout requiring grant AND MFA (D1, D2, D6) → audit (D5) → the four read seams (D4) → the proofs
above → local acceptance → Director gates for production migration and the first production grant.
