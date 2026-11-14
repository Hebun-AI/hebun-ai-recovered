# P5 · BYOK (customer-owned model provider key) · DESIGN GATE — DECIDED, NOT IMPLEMENTED

Master Plan V2 P5 ("Heby & AI Agent Platform") lists BYOK as decided **as a goal** with its technical
architecture **not decided** and nothing in code. This gate records the facts the architecture has to
start from and the decisions the Director must take before any code, schema or migration exists.
Nothing below is built, and nothing here authorizes a migration, a provider call, a credential, a
deployment or a key.

**Director decision (2026-11-11):** B1–B8 accepted as recommended. See "Final decisions". Each
migration (B2, B6, B7), the key-verification provider call (B5), every production step and the first
real tenant key remain separate Director gates.

## Measured at `fe7b96a5` (remote `main`, 2026-11-11)

1. **One platform model credential.** The live Claude transport reads one deployment-wide key,
   `ANTHROPIC_API_KEY` (`features/heby-model-live/claude-http-transport.server.ts`), gated by
   `HEBUN_MODEL_CONNECTIVITY_ENABLED` / `HEBUN_MODEL_PROVIDER` / `HEBUN_MODEL_ID`
   (`features/heby-model/model-connectivity-environment.server.ts`). Every tenant's Heby turn is billed
   to, and processed under, the platform's own provider account. No code path selects a credential
   per tenant.
2. **A tenant-owned sealed-secret store already exists.** `integration_credentials`
   (`db/schema/integration-credential.ts`) holds per-tenant secrets, AES-256-GCM sealed under the
   integration key set, with the AAD bound to `(tenant, integration, kind)` so a row moved between
   tenants does not decrypt. Its kind enum already admits `api_key`, and the integration authority
   contract already admits `authMethod: "api_key"` (`features/integration-authority/contracts.ts`).
   Today it holds OAuth tokens (Google, Instagram, YouTube); no `api_key` row and no model provider in
   the catalog exist.
3. **Data-use authority assumes one platform account.** `processor_attestations`
   (`db/schema/external-ai-data-use.ts`) is a root (tenant-less) table: "One deployment holds one
   account per provider; this row describes it." `tenant_external_ai_data_use_authorizations` grants
   purposes per tenant against that platform attestation. A customer's own account has different
   terms (training, retention, ZDR) that no row can describe today.
4. **Operational controls are platform-wide.** `provider_connectivity_controls` (R2E) and the R2F.1
   usage reader (`messages` token columns, tenant-scoped) record provider, model and transport, but
   not whose credential carried a call.
5. **P4 operators read no credential.** The P4 admin readers select only their listed columns and a
   firewall pins that no credential column is read. BYOK must keep that true.
6. **Production Anthropic readiness is BLOCKED** (GATE-D-PROVIDER-RECONCILIATION-1, roadmap §22) for
   attribution of the platform key. BYOK does not resolve it and must not be used to route around it.

## Principles every option is held to

- The key is the **tenant's**. It is entered by a human of that tenant with the authority to connect
  integrations, sealed at rest, and never returned to any browser, log, audit row, model prompt or
  operator view after entry.
- **No silent fallback.** A tenant that chose BYOK never has its calls quietly carried by the
  platform key, and a tenant that did not never has its calls carried by someone else's.
- **Every call records whose credential carried it**, so usage, cost and data-use evidence are
  attributable per credential.
- **Data use stays governed.** A call under a customer key still needs the tenant's External-AI Data
  Use authorization for its purpose; the processor terms are the customer's account's, not ours.
- **Fail closed.** An unreadable, revoked or unverified key refuses the call; it never degrades to
  another credential.

## Decisions for the Director

**B1 · First slice.** Recommended: **Anthropic only**, through the existing live Claude transport,
for Heby conversation. Other providers and other model-calling features (image, video, research)
follow as separate decisions.

**B2 · Where the key lives.** Recommended: reuse `integrations` + `integration_credentials`
(`kind = api_key`) with a new catalog entry for the model provider, so the sealing, AAD binding,
revocation and audit seams already proven for OAuth tokens carry the key. Alternative: a dedicated
table and its own key set (as P4 did for MFA, design gate O2) — stronger separation, one more key set
to operate. Either needs a migration (catalog/enum entry at minimum), which is its own Director gate.

**B3 · What "operators can never read it" means.** In-product: no operator surface, admin reader or
audit row can return the key — enforceable by firewall and test. **At the deployment level it is not
absolute:** whoever holds both the production database and the encryption key set can decrypt any
sealed row, exactly as for today's OAuth tokens. Options: (a) accept that, documented; (b) a separate
key set held outside the main deployment; (c) envelope encryption under an external KMS. Recommended:
(a) for the first slice, with (b)/(c) recorded as a later hardening decision.

**B4 · Selection and precedence.** Recommended: a tenant with an **active, verified** BYOK connection
uses it for every in-scope call; a tenant without one keeps the platform key; a tenant whose BYOK
connection is revoked or failing is **refused**, not moved back to the platform key, until a human of
that tenant chooses otherwise.

**B5 · Key verification.** Recommended: verify a key once at entry with one minimal provider call
(e.g. the models list), never storing the response. That is a new provider call class and needs its
own approval; without it, a key is stored as "unverified" and the first real call is the test.

**B6 · Data-use evidence.** Recommended: add a tenant-scoped processor attestation (the customer's
account terms, attested by the tenant's human) next to the platform one, and require the tenant's
existing purpose authorization against it. Alternative: treat BYOK calls as covered by the tenant's
own contract with the provider and record only that the tenant asserted it.

**B7 · Attribution.** Recommended: record a credential source (`platform` | `tenant`, plus the
connection id for `tenant`) on every model call row, so R2F.1 usage, P4 AI Usage and provider-cost
evidence can separate the two. This is a schema change (migration gate).

**B8 · Lifecycle.** Rotation = add a new key, verify, then revoke the old one; revocation takes
effect on the next call; tenant suspension (R4B) stops BYOK calls exactly as it stops every other
tenant act. All acts audited with no key material in the row.

## What implementation must prove before it can be called done

- The key never appears in a response body, log line, audit row, prompt, error, or P4 admin view —
  firewall plus a leak test over every new module.
- A key sealed for tenant A cannot be opened as tenant B (row moved between tenants refuses).
- With BYOK active, a call is carried by the tenant key; with it revoked, the call is refused and the
  platform key is **not** used.
- A tenant without BYOK is unchanged (platform key, same behaviour as today).
- Every call row records its credential source; usage readers can split by it.
- A call under BYOK without the tenant's data-use authorization for its purpose is refused.
- Only a human with integration-connect authority in that tenant can add, rotate or revoke the key.

## Explicitly out of scope for the first slice

Other providers; image/video/research providers; any operator ability to view, test or use a
customer key; automatic fallback between credentials; provider billing integration; resolving
GATE-D-PROVIDER-RECONCILIATION-1.

## Implementation path (after decisions)

B1–B8 decided → migration design (B2, B7, B6 as decided; local first, production through the
migration ceremony as a separate gate) → key entry and sealing on the integration authority →
transport credential selection with the no-fallback rule → attribution on call rows → data-use check
→ the proofs above → local acceptance → Director gates for production migration, deployment and the
first real tenant key.

## Final decisions (Director, 2026-11-11)

- **B1 · ACCEPTED** — first slice is Anthropic only, Heby conversation, through the existing live
  Claude transport.
- **B2 · ACCEPTED** — the key lives in `integrations` + `integration_credentials` (`kind = api_key`)
  under a new model-provider catalog entry, sealed with the integration key set and its existing AAD
  binding. The required migration is its own gate.
- **B3 · ACCEPTED (a)** — in-product non-readability is enforced and tested; deployment-level
  possession (database plus key set) can still decrypt, as for OAuth tokens today, and is documented
  as such. A separate key set or external KMS is a later hardening decision.
- **B4 · ACCEPTED** — an active, verified BYOK connection carries every in-scope call; no BYOK keeps
  the platform key; a revoked or failing BYOK connection refuses the call and never falls back.
- **B5 · ACCEPTED** — one minimal verification call at entry, response not stored; this new provider
  call class needs its own approval, and until then a key is stored as unverified.
- **B6 · ACCEPTED** — a tenant-scoped processor attestation for the customer's account, attested by
  the tenant's human, with the tenant's existing purpose authorization required against it.
- **B7 · ACCEPTED** — every model call row records its credential source (`platform` | `tenant` plus
  connection id). Schema change through the migration gate.
- **B8 · ACCEPTED** — rotation by add-verify-revoke; revocation effective on the next call; tenant
  suspension stops BYOK calls; every act audited with no key material.
