# G2.1 — Governance Genesis Authority Bootstrap

**Status: IMPLEMENTED — Option 3, the two-key genesis ceremony.**
Director cleared Gate A (root of trust) and Gate B (schema) on 2026-08-11.

The analysis below (§1–§11) is the record of how the architecture was chosen; it is kept because the
reasoning is the load-bearing part. §12 onward is what was actually built.

## The authority chain

```
DEPLOYMENT / OPERATOR ROOT          possession of the local deployment — nothing more
        ↓                           npm run governance:nominate-genesis -- <slug> <email>
pending genesis nomination          genesis_nominations.status = 'pending'
        ↓                           /governance/genesis, D1 verified session, aal1
D1 verified-human acceptance        the nominated human, and only them
        ↓
accepted pre-Governance entitlement genesis_nominations.status = 'accepted'
        ↓                           NOT BUILT — G2's job
future G2 bootstrap decision        decision_records.bootstrap = true
```

No two stages are collapsed. Each arrow is a separate act with a separate authority, and the chain
terminates OUTSIDE the application.

**The trust assumption, stated plainly.** Terminal/deployment possession is the external bootstrap
root for this stage. Hebun cannot cryptographically identify which human runs the CLI. That is why
the nomination alone entitles nobody — it takes a D1-verified human accepting it, and a human cannot
nominate themselves because no product surface can create a nomination at all.

---

## 1. What G2.1 had to determine

D1/D1.1 changed authentication reality. They did not change entitlement reality.

Three different facts, deliberately kept apart:

| fact | question | owner | state today |
|---|---|---|---|
| authentication | "I proved this is Human A" | `auth_credentials` + `user_session_contexts` | **SOLVED (D1)** |
| pre-Governance entitlement | "Human A is the nominated genesis authority for Tenant T" | *nothing* | **THE BLOCKER** |
| Governance authority | "Governance recorded the bootstrap decision" | `decision_records.bootstrap` | deferred to G2 |

G2.1 exists solely to establish the middle fact. It must not create the third.

---

## 2. Genesis destination — unchanged

`decision_records.bootstrap` remains the canonical representation of the Governance genesis
decision. The schema header states the invariant directly: a bootstrap decision is the first
authority in a tenant and its `actorType` MUST be `human`, "enforced at the write layer later —
NOT by a fabricated default user and NOT by runtime logic in this phase".

No second genesis authority is warranted. One concept, one authority.

**But the invariant is documented, not enforced.** `decision_records` carries only a primary key,
three foreign keys, and four non-unique indexes. There is **no** unique constraint restricting a
tenant to one bootstrap decision, and **no** check constraint forcing `actor_type = 'human'` when
`bootstrap = true`. That is a G2 problem, recorded here so it is not discovered late.

---

## 3. Pre-Governance root candidates — full classification

Every candidate was checked against repository code **and** live database state.

| candidate | classification | why it cannot be the root |
|---|---|---|
| `roles.type = owner` / `director` | **CONNECTED** (K2 authoring, R2E provider control) | Explicitly excluded by the Director. Also derived: the seeded role was never established by a verified human act. |
| `roles.authority_rank` | DESIGNED, NULL in every row | Optional ordinal metadata; owns no entitlement semantics. Role-derived → excluded. |
| `roles.system_role` | DESIGNED, `false` in every row | Marks built-in roles. Never written by the app. |
| `roles.policy_refs` | DESIGNED, unwritten | Documented as "data, not enforcement". |
| `memberships.authority_scope` | DESIGNED, unwritten | Free text with no owned meaning. Overloading it is forbidden. |
| `memberships.delegated_by_*` | DESIGNED, unwritten | Provenance of a grant, not a constitutional root. |
| `permissions` / `role_permissions` | **SCHEMA-ONLY**, 0 rows, zero application readers | Using them requires building a permission-resolution runtime and seeding a catalogue — a new authorization model, out of scope. |
| `organizations.owner_actor_*` | **SCHEMA-ONLY**, 0 rows, never written by any code path | Sub-organization ownership ≠ tenant constitutional root. Overload forbidden. |
| `companies.created_by` / `created_by_type` | provenance columns, **NULL** for both live tenants | Provenance is not entitlement, and tenant creation is explicitly excluded. |
| `invitations` | **SCHEMA-ONLY**, 0 rows, no runtime | An invitation grants membership, not a constitutional root. |
| `auth_identities` / `auth_credentials` | **CONNECTED, AUTHORITATIVE** (D1) | Answers "who is this human". Structurally cannot answer "why entitled". |
| `user_session_contexts` | **CONNECTED, AUTHORITATIVE** | A session is a receipt of proof, and it expires. |
| `decision_records.bootstrap` | SCHEMA-ONLY | This *is* the Governance decision. Creating it is G2, forbidden here. |
| `audit_log` | **CONNECTED** (G1) | Append-only history. History records authority; it does not confer it. |
| `provider_connectivity_controls` (R2E) | **CONNECTED, AUTHORITATIVE** | Provider connectivity authority, explicitly excluded. |
| `DIRECTOR_ID = "human-director"` | **MOCK** — a hardcoded string in a mock-fed projection builder | Not a durable identity. Not a row. Not authority. |
| `scripts/r1-seed.mjs`, `tests/helpers/*` | **SEEDED / TEST-ONLY** | Explicitly excluded. |
| `audit_log.authority_source = 'platform-admin'` | a permitted **string value** in a check constraint | No table, no runtime, no principal. A vocabulary entry, not an authority. |

### Verdict

**No durable repository fact today can state: "Human A is the nominated pre-Governance genesis
authority for Tenant T."**

The nearest things that exist are a coarse role band (excluded by the Director, and rightly — it
was seeded, not ceremonially established) and a set of empty, unread tables whose semantics belong
to other concepts.

---

## 4. Circularity test

Applied to every surviving proposal.

```
Human A performs genesis nomination
        ↓ what authorizes A?
```

| proposed authorizer | terminates at | valid? |
|---|---|---|
| a Governance decision | Governance | ✗ circular by definition |
| `roles.type = owner` | a seeded role row | ✗ excluded, and the seed had no author |
| empty Governance tables | "first writer wins" | ✗ race-based, excluded |
| tenant creation | a NULL `created_by` column | ✗ excluded, and factually absent |
| Knowledge authorship (K2) | the same seeded role band | ✗ excluded |
| R2E provider authority | the same seeded role band | ✗ excluded |
| an environment variable | deployment config string | ✗ excluded |
| Heby / agent / model | derived, non-authoritative by doctrine | ✗ excluded |
| **control of the deployment** | possession of the server + database | **✓ terminates outside the application entirely** |
| **a new in-app platform-operator class** | …whoever establishes that class → deployment control | ✓ but only after one extra hop |

Only one termination point survives: **possession of the deployment**. That is already the trust
anchor D1.1 relies on — `auth-dev-credential` refuses non-local databases and requires an
interactive TTY precisely because its authority *is* "you are at this machine".

Any in-app authority class ultimately roots there too; it merely adds a hop and a schema.

---

## 5. Director Gate A — TRIGGERED

**Reason: a new constitutional root / new authority class is unavoidable.**

Establishing "Human A is the nominated genesis authority for Tenant T" introduces an authority
class that sits between authentication and Governance and does not exist in the repository today.
Step 21 names exactly this as Gate A.

The Director must decide **where the root terminates**. Three architectures, narrowest first.

### Option 1 — Operator ceremony (CLI only), app reads

The nomination is written by an operator CLI in the D1.1 mould: local-only, interactive,
tenant-scoped, refusing non-local databases. The web application never writes it; it only reads it,
so G2 can later check "is this the nominated human?" before permitting the bootstrap decision.

- Root terminates in deployment possession. Non-circular. No new in-app authority class.
- **Conflicts with the mission's Step 12**, which requires the ceremony to run under a D1 verified
  session. A CLI has no session. The Director must relax Step 12 or reject this option.
- Cost: 1 table, 1 partial unique index, 1 CLI. No new in-app authority.

### Option 2 — In-app ceremony gated by a new platform-operator authority

A new `platform_operators` (or equivalent) authority class is introduced; holders may nominate.

- Strictly worse: that class must itself be established by the operator/deployment, so the chain
  still terminates in deployment possession — after one extra hop, one extra table, and one extra
  authority class to secure forever.
- Cost: 2 tables, new enum, new authority runtime, new attack surface.
- Recommend against unless the Director specifically wants an in-app operator role.

### Option 3 — Two-key ceremony (RECOMMENDED)

Split the act in two, so each half is anchored where it is actually true:

1. **Operator nominates** (CLI, deployment-anchored): writes a `pending` nomination binding
   Tenant T → one `auth_identity`.
2. **The nominated human accepts** (web, D1 verified session): the *same* human, proven by D1,
   confirms it. Only that identity's session can advance `pending → active`.

- Root terminates in deployment possession (Step 4 satisfied).
- The in-app act requires a D1 verified session (Step 12 satisfied), and it is a *confirmation*,
  never a self-grant — the human cannot nominate themselves.
- Gives the explicit, unmistakable ceremony surface Step 11 asks for.
- Cost: 1 table with a two-phase status, 1 partial unique index, 1 CLI, 1 narrow server action.

---

## 6. Director Gate B — TRIGGERED

**Reason: the required guarantees are not representable without schema change.**

Step 8 demands *constitutional* uniqueness: exactly one active nominated genesis human per tenant,
and no race-based bootstrap. An application-level check cannot provide that — two concurrent
requests both read "none exists" and both insert. The K3 lesson applies directly: the database
invariant must be the final defense.

Schema required (none of it exists):

| item | purpose | why nothing existing can carry it |
|---|---|---|
| new table (e.g. `tenant_genesis_nominations`) | the nomination fact | no table owns this meaning; every candidate in §3 owns something else |
| partial unique index `(tenant_id) WHERE status = 'active'` | one active genesis human per tenant, enforced by Postgres | no such constraint exists anywhere |
| status enum or varchar+check | `pending` / `active` / `revoked` (Option 3) | new vocabulary |
| composite FK `(tenant_id, user_id) → memberships(tenant_id, user_id)` | database-level tenant binding | possible today — `memberships_tenant_user_uq` already exists |
| unique index on `auth_identities (id, user_id)` | only if the row binds *both* identity and user with a composite FK | **does not exist**; current indexes are pkey, provider/issuer/subject, primary-user, user, status |

Separately, for G2 (recorded, not actioned): `decision_records` needs a partial unique index on
`(tenant_id) WHERE bootstrap` and a check that `bootstrap` implies `actor_type = 'human'`, or the
documented genesis invariant stays unenforced.

---

## 7. Identity binding (if a gate is cleared)

Bind to `auth_identities.id` — the durable identity authority. Credentials rotate (alice's
credential already shows one revoked + one active row after the Director's rotation) and sessions
expire; the identity survives both.

Do **not** bind to: email string, display name, role label, session reference, or an
`auth_credentials` row id.

Note the canonical actor convention already in force: for `actor_type = 'human'`, `actor_id` is
`users.id` — both `canonical-read/actor-resolution.ts` and the G1 audit writer
(`actorId: actor.userId`) agree. A nomination row therefore needs `user_id` as well if it is to
participate in actor references or carry the composite FK to `memberships`.

---

## 8. Tenant binding

Every read and write resolves the tenant server-side from the durable session/membership row in the
R1 `TenantContext` — the pattern K2 and R2E already use. The client supplies none of:
`tenantId`, `actorId`, `userId`, `authIdentityId`, `membershipId`, `roleId`, `authorityRank`,
`bootstrap`, `decisionId`. These must be **unrepresentable** in the action input type, not
validated away.

A nominated human for Tenant A has zero meaning for Tenant B: the partial unique index is per
`tenant_id`, and the composite FK to `memberships(tenant_id, user_id)` makes "nominated for a tenant
you do not belong to" a database error rather than a policy check.

---

## 9. Audit ownership

The nomination belongs in `audit_log` — the shared, cross-domain, append-only sink G1 already
connected. No new sink, no migration.

`KNOWLEDGE_AUDIT_BOUNDARY` must **not** be extended: it is Knowledge-specific, and its documented
boundary (authorized attempts only) was reasoned for Knowledge. A sibling contract with its own
boundary constant, its own `entity_type` (e.g. `tenant_genesis_nomination`) and its own action
vocabulary (e.g. `governance.nominate-genesis-human`) is the narrowest legitimate addition.
`action` and `entity_type` are free text on `audit_log`, so this costs zero schema.

Metadata carries identity references only: tenant id, auth identity id, user id, nominating actor
pair, assurance level at nomination time. No password, no hash, no salt, no raw email, no PII
beyond identifiers.

**One point needs the Director's ruling.** Step 14 says "no session reference". G1's existing writer
does set `session_context_id` — but that is the durable session *row id*, not the opaque cookie
reference (which is never stored anywhere; only its keyed digest is). Following G1 keeps the audit
model consistent; deviating keeps the letter of Step 14. Recommend following G1 and stating the
distinction, since the stored value is not a bearer token.

---

## 10. Assurance — stated honestly

D1 proves **aal1** only. `SESSION_ASSURANCE_LEVEL = "aal1"`, `mfaVerified: false` at every issuance
site, and the login page says so in the UI. There is no MFA, no SSO, no passkey, no TOTP, no
WebAuthn anywhere in the codebase.

A genesis nomination performed at aal1 is a constitutional act performed at the *lowest* assurance
level the standard defines. That is acceptable only if the Director explicitly accepts it for the
current development stage, and it must be recorded on the nomination row itself so a later phase
cannot retroactively claim the ceremony was strongly authenticated.

---

## 11. Firewalls verified (current state, nothing changed)

- **Heby**: no slash command, tool, model mutation, natural-language mutation, or voice mutation for
  governance. The only occurrence of "governance" in `heby-commands` is a workspace *name* in a read
  command's argument description.
- **G2**: no decision writer, no session opening, no approve/reject, no policy evaluation, no
  delegation, no voting, no quorum, no appeals, no escalation, no ratification anywhere in `src/`.
  `governance_sessions` and `decision_records` are both empty and have no application reader.
- **K4**: Knowledge untouched. `ratified_at`, `ratification_decision_id` and `governance_session_id`
  are written NULL by the K2/K3 writer by design and read read-only by canonical-read. K4 remains
  blocked behind G2.
- **Protected systems**: Computer Use, Terminal, Shell, Browser control, Device runtime, Execution
  Runtime, external mutation, Marketplace, R2F and Voice provider connectivity all untouched. The
  Director model kill-switch remains OFF.

---

## 12. Director decisions (resolved 2026-08-11)

1. **Gate A** — root terminates in **deployment possession**, split across two keys (Option 3).
2. **Gate A** — no new in-app authority class was introduced.
3. **Gate B** — approved: one table, one partial unique index, one status enum.
4. **aal1** — explicitly accepted for this development stage, recorded on the row and in the UI.
5. **Audit** — follow G1: `session_context_id` (durable row id) is recorded; the bearer reference
   never is.

---

## 13. What was built

| artifact | what it is |
|---|---|
| `src/db/schema/genesis-nomination.ts` | the `genesis_nominations` table |
| `src/db/schema/_enums.ts` | `genesis_nomination_status` = pending / accepted / revoked |
| `src/db/migrations/20260811144829_g2_1_genesis_nomination.sql` | the one additive migration |
| `scripts/genesis-nominate.ts` + `scripts/lib/nominate-genesis-human.ts` | KEY 1, the operator CLI |
| `src/features/governance-genesis/contracts.ts` | vocabulary, boundaries, consequence text as values |
| `src/features/governance-genesis/genesis-acceptance.server.ts` | KEY 2, read + accept |
| `src/features/governance-audit/genesis-nomination-audit.server.ts` | the sibling audit contract |
| `src/app/(dashboard)/governance/genesis/{page,actions}.tsx\|ts` | the acceptance surface |
| `src/components/governance-genesis/genesis-acceptance-card.tsx` | the ceremony card |

### The database carries the invariants

- `genesis_nominations_one_active_per_tenant_uq` — partial unique on `tenant_id` where
  `status <> 'revoked'`. One genesis root per tenant, enforced by Postgres. A revoked nomination
  frees the slot without a migration.
- `genesis_nominations_tenant_member_fk` — composite FK `(tenant_id, nominated_user_id)` →
  `memberships (tenant_id, user_id)`, reusing the pre-existing `memberships_tenant_user_uq`. A
  cross-tenant nomination is a constraint violation, not a policy check. No second identity model
  was created.
- `genesis_nominations_accepted_chk` — accepted implies when, which session, and what assurance.
  "Accepted but we don't know how" is not a representable state.

### Why acceptance cannot be forged

`acceptGenesisNominationAction()` **takes no arguments**. Tenant, user, identity, session and
assurance all come from the durable R1 session. A forged `tenantId`, `userId`, `authIdentityId`,
`membershipId`, `roleId`, `authorityRank`, `status`, `acceptedAt`, `bootstrap` or `decisionId` has no
parameter to arrive in. The update is predicated on `status = 'pending'`, so a replay or a
concurrent second acceptance updates zero rows.

Both halves of the identity are checked — `auth_identity_id` AND `user_id`. A row whose two halves
named different people could never be accepted by anyone, so the mismatch fails closed rather than
becoming exploitable.

### The audit deviation, stated honestly

The Director's brief listed `governance.genesis-nomination.created` as an event to record. **It is
not written, deliberately.** `audit_log.actor_type` and `actor_id` are both NOT NULL, and the
operator ceremony cannot name its actor truthfully: deployment possession is the root, and Hebun
cannot identify the human at the terminal. Writing the nominated human as the actor would be false —
they did not create it. Inventing a `system` actor id would fabricate a principal that exists in no
registry. The `genesis_nominations` row is itself the durable, timestamped record of the creation,
carrying `nominated_at` and `nomination_source`.

`governance.genesis-nomination.accepted` **is** recorded — real actor, real tenant, real consequence
— inside the same transaction as the acceptance. Refusals are not recorded, matching the boundary G1
already drew.

`KNOWLEDGE_AUDIT_BOUNDARY` was not extended. `GENESIS_AUDIT_BOUNDARY` is a sibling: its own entity
type, its own actions, and neither constant references the other. Two G1/K2 tests asserted "exactly
one module owns the audit sink"; both were updated to assert the declared-owner SET instead, which
keeps the protection they existed for (no ordinary feature module may reach the sink) while
admitting the sibling the Director required.

---

## 14. Limitations

1. **aal1 only.** A constitutional act at single-factor assurance, accepted deliberately for this
   stage. Recorded on the row so no later phase can narrate it as stronger.
2. **The operator is unidentified.** Anyone with the deployment and the database can create a
   pending nomination. The second key is what makes that survivable.
3. **`revoked` is declared but unwritten.** No G2.1 code path produces it; replacement, recovery and
   delegation are not implemented, and a test asserts no code path writes it.
4. **`decision_records` still has no bootstrap uniqueness.** Nothing constrains a tenant to one
   `bootstrap = true` decision, and nothing forces `actor_type = 'human'` when it is set. G2 must
   close this; G2.1 deliberately did not touch the Governance tables.
5. **Membership lifecycle is checked server-side, not by the FK.** The composite foreign key proves
   the membership row exists; only application code checks it is still `active`.
