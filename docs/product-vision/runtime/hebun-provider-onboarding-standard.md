# Hebun Provider Onboarding Standard

**Status:** engineering/release contract. Not runtime state, not an authority.
**Baseline:** written at `5dc8dc6`, after the Google Workspace integration (INT-1 → INT-4) reached
`CAPABILITY-AVAILABLE` and stopped at `ACCEPTANCE-UNREACHABLE`.

This document exists so the next provider does not rediscover what Google cost us. It adds **no new
authority**. Every check below consumes an authority that already exists.

---

## 1. Who already owns what

Nothing here replaces any of these. Onboarding *consumes* them.

| Concern | Authority | Notes |
|---|---|---|
| Which providers may be connected | `features/provider-catalog/catalog.ts` | Frozen code literal. The `providers` table is dormant by design — a row must never be able to ship a connector. |
| Connection lifecycle | `features/integration-authority` | `draft → unverified → connected → expired/revoked/disconnected`, plus health. |
| Capability availability | `features/integration-authority/capability-availability.server.ts` | The **only** place a capability is judged available. |
| Credential persistence | `features/integration-credentials` | AES-256-GCM, fail-closed. |
| Key registry | `features/secret-encryption/key-registry.server.ts` | `keyId:base64` map + active id. No default, no generated key, no plaintext fallback. |
| What may RUN | `features/action-execution/adapter-registry.server.ts` | Separate from the catalog, deliberately. |
| Write authorization | Governance / `action-authorization` | A read capability never mints a permit. |
| Production possession + ledger | `scripts/lib/production-possession.ts`, `scripts/lib/ceremony-preflight.ts`, `scripts/platform-preflight.ts` | Cluster binding by `system_identifier`, migration ledger currency. |
| Import-graph reachability | `tests/g6c-flow/authority-reachability.ts` (pattern) | Reused by the reachability gate. |

**Deliberately not created:** a second provider catalog, a second capability computation, a second
credential store, a second Governance authority, a runtime table for onboarding state.

---

## 2. The onboarding state model

A **release/engineering progression**, not a runtime lifecycle. It is *not persisted* — there is no
column, no table and no migration for it, because it describes the delivery of a capability rather
than the state of a tenant's connection. The runtime lifecycle (`draft…disconnected`) is unchanged
and remains the only persisted state.

```
DESIGNED
  → IMPLEMENTED              code exists and is tested
  → CONFIGURED               deployment env resolves (validated, not merely present)
  → PROVIDER-CONSOLE-ALIGNED external console agrees exactly (redirect URI, scopes)
  → DEPLOYED                 the running deployment carries that configuration
  → CONNECTION-ACCEPTED      a real provider round trip produced `connected`
  → CAPABILITY-AVAILABLE     lifecycle + usable health + granted scopes cover the read
  → RUNTIME-REACHABLE        a production surface can actually call the seam
  → REAL-PROVIDER-EXECUTED   the seam ran against the real provider
  → ACCEPTANCE-VERIFIED      the response matched the declared capability boundary
  → RELEASE-READY            external verification burden discharged
```

### Distinctions that must never collapse

```
contract         ≠ connection
credential       ≠ connection
configured       ≠ connected
connected        ≠ capability available
available        ≠ runtime reachable      ← the one Google taught us late
reachable        ≠ executed
executed         ≠ successful
provider-derived ≠ authoritative knowledge
read capability  ≠ write authorization
```

`RUNTIME-REACHABLE` sits **after** `CAPABILITY-AVAILABLE` on purpose. Google Drive reached
`CAPABILITY-AVAILABLE` and is still stuck one step later.

---

## 3. Lessons from Google, classified

`E` = enforced in code/tests · `D` = documentation/process only.

| # | Lesson | Class | Where |
|---|---|---|---|
| 1 | Public-site host and OAuth redirect authority move independently | deployment | D |
| 2 | The redirect URI is configured, never derived from a header or the public origin | OAuth | **E** — `google-environment.server.ts` forbids derivation; asserted in INT-3 suite |
| 3 | Hebun config and provider-console registration must agree exactly | OAuth | D |
| 4 | Production schema drift breaks code that is correct | production | **E** — preflight ledger check |
| 5 | Authored ≠ applied migrations; check before acceptance | production | **E** — `platform-preflight` |
| 6 | Env var *presence* ≠ valid key registry | security | **E** — key registry validates shape, length, base64 round-trip, duplicate ids, active-id membership |
| 7 | Fail closed on credential storage, even after the provider issued tokens | security | **E** — `storeCredential` refuses before opening a transaction |
| 8 | Runtime lifecycle states stay distinct from UI presentation | generic | **E** — surface model maps, never invents |
| 9 | configured ≠ connected | generic | **E** |
| 10 | connected ≠ capability available | generic | **E** — three conditions in the availability seam |
| 11 | requested ≠ granted; truth is the provider's returned scopes | generic | **E** — callback persists `grant.grantedScopes` |
| 12 | Broader permission is opt-in and capability-specific | OAuth | **E** — route takes a *capability*, resolved through a frozen map with `Object.hasOwn` |
| 13 | Static UI copy must not encode scope assumptions | generic | **E** — `tests/google-access-truth` |
| 14 | Mocks cannot prove an external contract | generic | D + **E** (transport injection is test-only) |
| 15 | An implemented seam can have zero production callers | generic | **E** — this phase's reachability gate |
| 16 | Re-consent replaces credentials through the credential authority | security | **E** — `replaceCredential` revoked the old pair |
| 17 | Configuration repair ≠ key rotation when no ciphertext depends on the key | security | D |
| 18 | Tenant identity comes from authenticated context, never input | security | **E** — `readDriveMetadata` accepts no integration id |
| 19 | Read availability never becomes write authorization | governance | **E** — no `writeAuthorized` field exists |
| 20 | Provider data is not Knowledge | governance | **E** — the Drive seam imports no writer |
| 21 | Fail-closed errors need operator-diagnosable, non-secret detail | security | **D — GAP, see §8** |
| 22 | implemented/configured/connected/available/executed/successful never collapse | generic | D + **E** |

---

## 4. The provider preflight

**Automatic, on every test run** (`npm run test:run`):

- provider keys unique; every provider declares minimum scopes
- every capability declares at least one read scope
- a scope is never both read and write for one capability
- write capability requires a declared write scope list (empty ⇒ write structurally unreachable)
- **acceptance reachability** per capability — see §5
- capability scopes cannot widen (frozen map, prototype-safe lookup) — INT-4 suite
- credential configuration fails closed — INT-2 suite
- UI access claims derive from granted scopes — `tests/google-access-truth`

**Operator-run, before acceptance** (`npm run platform:preflight`):

- production possession: cluster `system_identifier` + `current_database()`
- migration ledger currency: authored vs applied
- bootstrap surface counts only — never row content

Verdicts are reported as `PASS` / `FAIL` / `BLOCKED` / `UNAVAILABLE` / `NOT APPLICABLE`.
`UNAVAILABLE` is **never** converted to `FAIL`: an unreadable truth is not a failed one.

The preflight mutates nothing, starts no OAuth, creates no credential and calls no provider.

---

## 5. The acceptance reachability gate

`tests/provider-onboarding/acceptance-reachability.ts`.

For every capability in the catalog it reports one of:

- `REACHABLE` — a production root under `src/app` transitively imports an execution seam
- `ACCEPTANCE-UNREACHABLE` — a seam exists but nothing in production can call it
- `NOT-IMPLEMENTED` — no execution seam exists

An **execution seam** refers to the capability (by literal *or* by a constant declared equal to it)
**and** can transitively reach a module that performs outbound HTTP. Both halves were learned the
hard way: the first version of this gate matched capability text, found the `/integrations` display
model, and reported Drive `REACHABLE` — which was false. It also never found the real seam, because
that seam names the capability through a constant.

`ACCEPTANCE-UNREACHABLE` **reports, it does not fail the build.** Failing would pressure somebody to
invent a caller purely to clear the gate — the one remedy this lesson forbids. What is asserted is
the opposite error: a capability may never report `REACHABLE` without a seam a production root
genuinely imports.

---

## 6. The real-provider acceptance contract

A capability is **not** acceptance-verified because unit tests pass, mocks pass, OAuth succeeded,
credentials exist, the connection is connected, a scope was requested, or availability says
available.

**READ acceptance requires all ten:**

1. authenticated tenant, resolved server-side
2. authoritative connection (`connected`)
3. usable credential, opened through the credential authority
4. granted scopes cover the declared read scopes
5. the real provider endpoint was reached
6. the provider returned a valid response
7. the response matches the declared capability boundary
8. no broader access was used
9. provenance is explicit — provider-derived, not Knowledge
10. no unintended persistence occurred

**WRITE acceptance additionally requires:** an existing Governance permit, least-privilege provider
permission, a bounded mutation, an audit trail, a success/failure distinction, and idempotency
semantics where the provider allows retries. No new Governance authority is created — acceptance
consumes the existing one.

---

## 7. Onboarding checklist

For each stage: **evidence required** · *owner* · **stop condition** · what must **not** be claimed.

| Stage | Evidence | Owner | Stop if | Do not claim yet |
|---|---|---|---|---|
| A. Discovery | capability the business actually needs | product | no real use case | anything |
| B. Authority mapping | which existing authority owns each concern | architecture | a new authority seems needed | — |
| C. Provider/API research | endpoints, scope semantics, rate limits, verification burden | eng | scope classification unclear | that scopes are "fine" |
| D. Scope design | narrowest scope per capability, read/write split | eng + security | a scope grants more than the capability needs | capability available |
| E. Security review | credential kinds, encryption, tenant binding, fail-closed paths | security | any plaintext or derived-from-header path | configured |
| F. Credential lifecycle | store/replace/revoke through the credential authority | eng | a parallel credential path appears | connected |
| G. Capability mapping | catalog entry with read/write scopes | eng | catalog would need a second source | available |
| H. Runtime implementation | seam + transport + error mapping | eng | transport is mockable in production | executed |
| I. Production configuration | env resolves and *validates* | operator | presence assumed instead of validated | deployed |
| J. Persistence/preflight | ledger current, tables present | operator | authored ≠ applied | connected |
| K. Provider-console config | redirect URI and scopes registered, exact match | Director | console disagrees with runtime | console-aligned |
| L. Connection acceptance | real round trip → `connected` + granted scopes persisted | Director + runtime | any refusal | capability available |
| M. Capability upgrade | capability-specific consent, granted scope persisted | Director | consent shows anything broader | available |
| N. Runtime reachability | gate reports `REACHABLE` | eng | `ACCEPTANCE-UNREACHABLE` | executed |
| O. Real-provider acceptance | the ten conditions in §6 | eng | any condition unproven | successful |
| P. UI truth | access copy derives from granted scopes | eng | static copy asserts scopes | — |
| Q. Governance (writes) | permit issued and consumed | Governance | no permit path | authorized |
| R. Provenance | no silent Knowledge admission | architecture | data persists without an admission authority | knowledge |
| S. Observability | non-secret operator diagnostics | eng | failure class indistinguishable | — |
| T. Release evidence | closure doc + commit + deployment SHA | Director | any state collapsed | release-ready |

### Definition of Done — one provider capability

> The capability is declared in the catalog with its narrowest scopes; the runtime seam exists,
> is tenant-bound and reaches only the declared endpoints; a production surface imports it and the
> reachability gate says `REACHABLE`; production configuration validates; the ledger is current;
> the provider console agrees exactly; a real tenant granted the scope and the provider's own
> granted-scope list is persisted; availability derives from lifecycle + health + granted scopes;
> the seam has executed against the real provider and the response matched the declared boundary;
> the UI states access from granted scopes; nothing was persisted into Knowledge without an
> admission authority; and the closure doc records each state separately.

---

## 8. Provider template

Copy this block per provider and fill it **before** implementation.

```
Provider:
Authentication:                 (OAuth2 / API key / other)
External console requirements:
Required env:
Base scopes:
Capability scopes:              (per capability, read + write)
Credential types:               (access / refresh / api key)
Refresh model:                  (reactive-only? rotation?)
Read capabilities:
Write capabilities:
Runtime seam:                   (module path)
Tenant binding:                 (how tenant is resolved — never from input)
Governance boundary:            (which writes need a permit)
Provider data provenance:       (ephemeral read? admission authority?)
Production caller:              (the src/app surface — REQUIRED before acceptance)
Acceptance test:
External verification burden:
Known rate limits:
Known failure classes:
Release blocker:
```

### Reference example — Google Workspace, as of `5dc8dc6`

```
Provider:                       google-workspace
Authentication:                 OAuth2 authorization code + PKCE (S256)
External console requirements:  redirect URI registered; Data Access scope justification
Required env:                   GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET,
                                GOOGLE_OAUTH_REDIRECT_URI, HEBUN_GOOGLE_OAUTH_STATE_SECRET,
                                HEBUN_INTEGRATION_ENCRYPTION_KEYS,
                                HEBUN_INTEGRATION_ENCRYPTION_ACTIVE_KEY_ID
Base scopes:                    openid, email, profile
Capability scopes:              google.drive.metadata.read → read: drive.metadata.readonly, write: []
Credential types:               oauth_access, oauth_refresh (AES-256-GCM, key id k1)
Refresh model:                  reactive only, on provider `auth` refusal; never on 429/5xx/timeout
Read capabilities:              google.drive.metadata.read
Write capabilities:             none
Runtime seam:                   features/provider-google/read-drive-metadata.server.ts
Tenant binding:                 resolveTenantContext; the seam accepts no integration id
Governance boundary:            n/a — no write capability exists
Provider data provenance:       ephemeral read; the seam imports no writer and no Knowledge module
Production caller:              NONE  ← ACCEPTANCE-UNREACHABLE
Acceptance test:                bounded files.list, metadata fields only
External verification burden:   drive.metadata.readonly is a Google RESTRICTED scope — OAuth app
                                verification plus a CASA security assessment before external
                                production use; test users may grant it in Testing status
Known rate limits:              429 → transport failure, never an auth failure; never refreshed
Known failure classes:          exchange-*, insufficient-scope, credential-*, verification-*,
                                capability-not-available, wrong-provider
Release blocker:                no production caller; restricted-scope verification not submitted
```

Google-specific external policy (restricted-scope classification, CASA) stays **here, in the
provider's own row** — it is deliberately not promoted into generic runtime authority, because it is
Google's policy and not Hebun's architecture.

---

## 9. Google reference audit — run against this model, no provider called

| Dimension | State |
|---|---|
| Implementation | **IMPLEMENTED** |
| Production configuration | **CONFIGURED** |
| Provider console alignment | **CONFIGURED** (Director-observed) |
| Connection | **CONNECTED** — `connected` / `healthy` |
| Granted identity scopes | **VERIFIED** — openid, userinfo.email, userinfo.profile |
| Drive metadata scope | **VERIFIED** — `drive.metadata.readonly` granted |
| Drive metadata capability | **AVAILABLE** — `readAvailable=true`, `writeCapable=false` |
| Runtime implementation | **IMPLEMENTED** |
| Runtime production reachability | **BLOCKED — ACCEPTANCE-UNREACHABLE** |
| Real-provider Drive execution | **NOT EXECUTED** |
| Acceptance | **UNVERIFIED** |
| External verification | **NOT SUBMITTED** |

If this table ever reads acceptance-ready for Drive while no production caller exists, the model is
wrong and must be fixed before the provider is.

---

## 10. Known gaps

1. **Lesson 21 is unenforced.** The key registry computes precise `invalidKeys`/`missingKeys` — env
   var names and key ids only, never key material — and `storeCredential` discards them, returning
   only `encryption-not-configured`. That is why a live incident could not be narrowed to a failure
   class without the Director reading the values. Surfacing that detail to an operator surface would
   leak nothing. **Not built** — it is a runtime change and needs its own approval.
2. **No operator-facing provider preflight script.** The enforceable checks run as tests, which is
   stronger (automatic) but not operator-invocable before an acceptance attempt. A
   `provider:preflight` script would be a thin reporter over the same checks.
3. **The catalog cannot express required env names or credential kinds.** Adding fields was rejected
   for a single provider — the value appears at the second or third, when the same preflight must
   validate more than one shape.
