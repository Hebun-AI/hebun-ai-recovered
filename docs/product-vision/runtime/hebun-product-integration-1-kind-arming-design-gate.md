# PRODUCT-INTEGRATION-1 · kind-scoped external arming · DESIGN GATE — NOT IMPLEMENTED

**Not a closure record.** This records why `EA1-KIND-ARMING-1` (§22, DEFERRED) was not implemented
inside PRODUCT-INTEGRATION-1, what the code measured at `5b8800d0`, and the decisions an
implementation needs. Nothing here authorizes a change.

## Measured at `5b8800d0`

- `tenant_external_send_authorizations` (Governance-ledger subject `tenant_external_send_authorization`,
  domain `external-send`) holds, per revision: tenant, `authorization_revision`, `state`
  (`active` | `withdrawn`), the governance decision and session, the human authorizer and
  `supersedes_authorization_id`. **There is no act-kind column and no payload column.**
- The writer (`authorize-tenant-external-send.server.ts`, reached only from the operator ceremony
  `scripts/tenant-arm-external-send.ts`) refuses an active → active revision (`already-armed`).
- The only jsonb is the governance decision's `evidence`, which the writer fills with the *shape of
  what was decided* (authority route, revision, state). No reader treats it as authority.
- `executeAuthorizedAction` resolves reachability **before** it reads the request's kind
  (`resolveExternalSendReachability(tenantId)` at the top; kind dispatch to email, Instagram
  `publish-instagram-media` and YouTube `publish-youtube-video` afterwards) and again after the spend.
  One arming therefore opens all three kinds.

## Why it stopped here (the boundary in the PRODUCT-INTEGRATION-1 brief)

1. **Schema.** A kind dimension has nowhere to live without a migration. Writing kinds into the
   decision's `evidence` and reading them at execution would turn a descriptive record into an
   authority input with no database constraint behind it. Rejected.
2. **Lifecycle semantics.** Re-scoping an armed tenant (Instagram → Instagram + YouTube) needs an
   active → active revision, which the released lifecycle forbids. That is a change to a consequential
   authorization rule, not an implementation detail.
3. **Legacy interpretation is a production decision.** Every active arming today means "all kinds".
   Reading those rows fail-closed (no kinds) would, at deploy, silently stop every currently armed
   organization's sends and posts. Reading them as "all kinds" keeps today's breadth. Either is a
   Director decision.

## What an implementation would need (for the Director's gate)

- **Storage (choose one):**
  - **A — kinds on the revision.** `act_kinds text[] NOT NULL`, CHECK non-empty and ⊆
    {`send-external-communication`, `publish-instagram-media`, `publish-youtube-video`}; one lineage
    per tenant; re-scoping is a new revision. Smallest change to the existing authority.
  - **B — one lineage per (tenant, kind).** Unique `(tenant_id, act_kind, authorization_revision)`;
    each kind armed and disarmed independently; no active → active re-scope needed.
- **Legacy rows:** either a migration that writes the explicit set the Director names for each
  existing active arming (behaviour-preserving, recorded), or fail-closed (behaviour-changing).
- **Enforcement:** read the request's kind first, then `resolveExternalSendReachability(tenantId,
  kind)` both before the spend and at the post-spend re-check. Root control stays a separate,
  mandatory conjunct. Tenant isolation unchanged (session-minted tenant only).
- **Writer:** the operator ceremony gains an explicit kind list; disarm stays unconditional (all kinds,
  or the named kind under B).
- **Visibility:** the readiness `publishing` row and the provider-matrix arming card report per kind.
- **Verification (V3):** Instagram-only arming refuses YouTube and email at execution; other tenants
  unaffected; legacy rule as decided; disarm per lifecycle; root control, approvals and permits still
  mandatory; negative tests plus bite-proofs; migration through the production migration ceremony.

## What PRODUCT-INTEGRATION-1 did instead

The readiness `publishing` row now states, when armed, that one arming covers email sending,
Instagram publication and YouTube publication together and is not granted per kind. No authority,
arming state or execution path changed.
