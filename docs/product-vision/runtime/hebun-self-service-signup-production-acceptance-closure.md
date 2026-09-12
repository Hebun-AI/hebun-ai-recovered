# Self-service signup — production acceptance closure

**Release** `e8f3608cc092ebcd84223ea244656af5addc1b1d` · **parent** `8ba77b13686a5e718c382986cfc5a97b687ad24f`
**Migration** 53 · **Production ledger** 52 → **53** · **Canonical digest** `ed173ef9839d3688fd550a522f85f115`
**Suite** 751 passed / 0 failed

A new customer can now bring their own organization into existence without an operator ceremony.

---

## 1 · What changed architecturally

Tenant creation was previously unreachable from runtime **by construction**. The bootstrap cycle is
closed by foreign keys — `memberships ← invitations ← membership_authorizations ← decision_records`
`← genesis_nominations ← memberships` — and R4A cut it with a three-table exception placed under
`scripts/`, where `tsconfig`'s `@/* → ./src/*` mapping made "this must never become a runtime writer"
a build-graph fact rather than a promise.

The Director approved moving that cut into `src/`. The rule was **narrowed, not removed**:

| | before | after |
|---|---|---|
| implementations that write tenant bootstrap state | 1 (`scripts/lib/provision-tenant.ts`) | **1** (`src/features/tenant-provisioning`) |
| write set | `companies`, `roles`, `memberships` | **unchanged** |
| callers | operator ceremony | operator ceremony **+ self-service signup** |
| reachable from an arbitrary product module | no | **no** — exhaustive caller census |

The authority also **stopped owning a transaction**. Signup must compose it with identity and
credential creation so that "user created, tenant absent" is *unrepresentable* rather than unlikely,
and a function that opens its own transaction cannot join a larger one. The caller owns it now — the
same shape `insertLocalIdentity` already used, for the same stated reason.

---

## 2 · Production schema truth

Production was measured **behind by exactly one migration**, never inferred from local state. The
released verifier `verifyCanonicalMigrationPrefix` reported `pending` with one entry.

The ceremony `platform:migrate` was run **by the Director at a TTY**; it refuses piped stdin by
design and no attempt was made to bypass it. Two refusals happened first and both were correct:

- the shell could not source `.env.hosted.local` — `DATABASE_URL` is the one unquoted entry and
  contains `&`, which zsh parses as a background operator. Notably **bash would not have errored**;
  it would have silently truncated the URL at the `&`. Failing loudly was the better outcome.
- `BACKUP_FAILED` — `pg_dump` 14.20 against a PostgreSQL 18.6 server. The version gate fired
  **before** the operator confirmation and before any mutation. This gate had once been inert (it
  read the server version under the wrong key and interpreted every server as major 0); that defect
  is repaired, the version now arrives pre-parsed, and this is the first observation of it working.

Neither the backup requirement nor the confirmation was weakened. A PostgreSQL 18.6 `pg_dump` was
already installed keg-only and was put on `PATH` for that one invocation.

| | before | after |
|---|---|---|
| ledger applied | 52 | **53** |
| prefix verdict | `pending` (1) | **`converged`** |
| digest | — | `ed173ef9839d3688fd550a522f85f115` |
| `companies_provisioning_source_chk` | NULL, local, production | **+ `self-service-signup`** |
| rows violating the new CHECK | — | **0** |
| `genesis_nominations_source_chk` | unchanged | **unchanged — did not leak the new value** |

Convergence was re-verified independently after the ceremony rather than taken from its report.

---

## 3 · Deployment

Automatic, triggered by the push. Deployment `hebun-ai-recovered-4mwrkg6vx`, target production,
observed READY. Binding proved by a **discriminating** query: `--meta githubCommitSha=e8f3608…`
returns exactly that one deployment, the previous SHA returns a *different* single deployment
(`kbtfrwb9k`), and an all-zeros control degrades to the unfiltered list. `www.hebuntech.com` and
`hebuntech.com` alias it.

---

## 4 · Production acceptance — one real signup

Performed through the real UI at `/register` by the Director, who entered the email and password
personally. No database insert, no internal helper, no bypass.

**Tenant `mulify`** — the only `self-service-signup` tenant in production.

| | |
|---|---|
| `provisioning_source` | **`self-service-signup`** |
| `tenant_status` | `active` |
| `created_by` | NULL — the human did not exist when the row was begun |
| membership | 1 · `owner`/`Owner` · `system_role=false` · `status=active` |
| `accepted_invitation_id` | NULL — no invitation invented |
| `delegated_by_id` | NULL — no delegating actor invented |
| credential | `scrypt`, 128-char hash, identity `active` |

**Deltas against the pre-signup baseline** — exactly one row in each identity/tenant table and
nothing anywhere else:

| +1 | +0 |
|---|---|
| `companies` 2→3 · `users` 1→2 · `auth_identities` 1→2 · `auth_credentials` 1→2 · `memberships` 2→3 · `roles` 3→4 | `integrations` · `integration_credentials` · `provider_observations` · `decision_records` · `governance_sessions` · `invitations` · `knowledge_nodes` · `audit_log` · `action_permits` |

`audit_log` +0 is by design, not an omission: `actor_type` and `actor_id` are NOT NULL there and at
the instant a tenant is born the only candidate actor does not yet exist. `provisioning_source`
carries what is actually known. `organizations` holds **0 rows for every tenant** — the organization
authority derives from the company row — so signup created none.

---

## 5 · Tenant isolation, through released seams

Not asserted from row counts. Each seam was called with **both** tenant contexts and returns real
data for Turkish Rug House and nothing for the new tenant *through the same code path*, so the empty
result is tenant predication working rather than an empty table.

| seam | new tenant | TRH |
|---|---|---|
| `integration-authority` `listConnections` | 0 | **2** |
| `provider-observation-history` `readProviderObservations` | 0 | **9** |
| `getCapabilityAvailability` | 0 of 7 available | **3** available |
| `auth-runtime` `readPeopleRegister` | `unavailable (not-authorized)` — fails closed | `available, 1 people` |
| `organization-authority` `readOrganizationAuthority` | its own "Mulify" | "Turkish Rug House" |

Cross-tenant probe: **0** TRH-owned observations reachable from the new context.

**Turkish Rug House was not modified.** `updated_at` remains `2026-09-04T17:04:18Z`, and its
1 membership, 1 role, 2 integrations, 9 provider observations, 5 knowledge nodes, 7 decisions and
2 integration credentials are all intact.

---

## 6 · Owner security

Director Decision 3 permits the first self-service human to originate as their own tenant's `owner`.
What that actually grants was **measured, not assumed**:

- the only connected authority that consults a role band is Knowledge authoring, whose resolver
  predicates on `roles.tenantId` and fails closed;
- the deployment-global `provider_connectivity_controls` (root-scoped, no tenant column) has **no
  writer anywhere under `src/`** — R5-1 removed every one, and asserts `PROVIDER_CONTROL_ROLE_TYPES`
  does not exist. Its three rows last changed 2026-08-25 / 08-31 / 09-08, all predating this release;
- the new role carries `system_role=false`, `authority_rank` NULL, `policy_refs` NULL;
- the human holds **0** memberships in any other tenant, and **0** sessions pointing at one.

R4A's own header still warns that an owner reaches a deployment-global provider control. **That prose
is stale** — R5-1 removed the path. Recorded here rather than silently relied upon.

---

## 7 · Session regression, and one thing NOT observed

The Director signed out and signed back in with the same credentials. A **fresh** session was created
and is bound to `mulify`; no session points at another tenant; no membership, role, identity or
credential was added by the re-login.

**The earlier session was not revoked, and this closure does not claim it was.** Production holds two
live session rows for that human (`06:47:25Z` and `07:01:41Z`), neither carrying `revoked_at`.

The released logout path *does* revoke durably — `logoutAction` → `revokeSessionByReference` →
`revokeSession`, which writes `revoked_at` and `revocation_reason`. That was exercised on this exact
release locally and produced two rows stamped `logout`. The production sign-out therefore appears not
to have gone through the Sign out control. **It is an unobserved check, not a failed one**, it belongs
to the pre-existing session authority rather than to this phase, and it is left open here rather than
reported as passing.

---

## 8 · What did NOT happen

No Instagram, YouTube or Google connection. No provider credential, observation or observation
trigger. No Governance decision, session, nomination or membership authorization. No permit, no
execution attempt, no external send. No invitation. No Social Intelligence change, no YT-SOC3, no
Social Intelligence V2. No billing, no team management. No second migration. The two local
disposable test tenants and the production acceptance tenant were all left in place.

---

## 9 · Open items

- the unobserved production sign-out revocation above;
- non-Latin organization names derive to poor slugs (`Türkçe Halı` → `t-rk-e-hal`). The slug is an
  internal identifier and the display name is stored verbatim, so nothing user-visible degrades;
  transliteration is an unmade product decision, pinned by test rather than quietly improved;
- a taken organization name is refused rather than disambiguated with a suffix — honest, and a
  deliberate V1 limitation;
- no email verification exists in this build, and the signup page says so.
