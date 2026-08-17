# R4A — Tenant bootstrap ceremony (implementation closure record)

**Date:** 2026-08-17
**Predecessor:** `hebun-r3b-external-send-arming-closure.md` (released `6ba5e38`, tag
`hebun-external-send-arming-complete`), plus the untagged test-runner reporting repair at `48e5804`.

**What this phase did:** made a tenant creatable by a governed ceremony instead of fixture SQL.
**What it did not do:** deliver production tenant provisioning, self-service signup, or a
platform-admin authority. It is local and development-only, by Director decision.

---

## 1. The gap this closed

`insert into companies` appeared **nowhere** in `src/`. The only thing in the repository that could
create a tenant was `scripts/r1-seed.mjs` — a two-fixture seed (Acme, Globex) that raw-inserts
`companies`, `users`, `auth_identities`, `roles` and `memberships` in one block, with
`on conflict do update`, bypassing I1, I1.2, G2, G2.1, G3 and tenant-role-baseline entirely.

R4's stated exit is *"a customer onboards and gets trustworthy answers over their own connected
data."* Onboarding, membership, governance, knowledge and Heby were all built. A customer still
could not onboard, because Hebun could not give them a tenant to onboard **into**.

## 2. The cycle, and why the exception is exactly three tables

Gate B proved the bootstrap cycle is closed by foreign keys, not by convention:

| Node | Blocked by |
|---|---|
| `memberships` | only `accept-invitation` writes it; needs an invitation |
| `invitations` | needs a `membership_authorization` |
| `membership_authorizations` | `governance_decision_id` **and** `governance_session_id` are both NOT NULL |
| `decision_records` / `governance_sessions` | only G2 writes them; G2 needs an **accepted** genesis nomination |
| `genesis_nominations` | composite FK `(tenant_id, nominated_user_id) → memberships (tenant_id, user_id)` |

Genesis needs a membership that needs an invitation that needs a Governance decision that needs
Genesis. **The cut point cannot be moved later than `memberships`** — so the ceremony writes
`companies`, `roles`, `memberships` and nothing else. A test asserts that write set from the
module's extracted SQL statements, not from a vocabulary scan.

**This falsified Gate A's proposed scope.** Gate A said "delegate the first root to
`governance-genesis`, delegate baseline roles to `tenant-role-baseline`." Neither delegation is
reachable from an empty tenant: `provision-member-role` refuses with `no-governance-authority`, and
`resolveNominationTarget` joins four tables that do not yet exist. The test proves the refusal
directly, then proves it stops refusing once G2 has run.

## 3. Authority

**Deployment possession / local operator ceremony.** Not Governance, not membership, not
platform-admin, not tenant-owner, not an authenticated user, not public signup, not agent, not Heby.

Guards are **reused, not re-implemented**: `assertLocalDatabaseUrl` is imported from D1.1's tool, and
a test asserts the CLI carries no copy of the local-host list. `NODE_ENV !== 'production'`, an
interactive TTY, and retyping the slug are all required. The only environment variables read are
`DATABASE_URL` and `NODE_ENV` — asserted exhaustively, because a tenant that config can name is a
tenant a deployment mistake can create.

**Structural containment.** The logic lives in `scripts/lib/provision-tenant.ts`. `tsconfig.json`
maps `@/*` to `./src/*` only, so nothing under `scripts/` is reachable from a server action, a route
or a component. Gate B originally proposed `src/features/tenant-provisioning/`; that was withdrawn
during Gate B in favour of this, which makes "must never become a runtime writer" a build-graph fact
rather than a promise. Tests assert both directions: zero `src/` importers, and no `@/` import in
either R4A module.

## 4. Identity precondition (Director Decision 1)

The human must **already exist**. The resolver is the identity half of `resolveNominationTarget`,
minus the tenant and membership joins that cannot exist yet. No match ⇒ refused before any write,
non-zero exit. No fallback, no development shortcut, no raw `users` insert. `users`,
`auth_identities` and `auth_credentials` remain owned by D1/I1.2.

## 5. What was built

| File | Role |
|---|---|
| `src/db/schema/company.ts` | `provisioning_source` + CHECK + `COMPANY_PROVISIONING_SOURCE_LOCAL_OPERATOR` |
| `src/db/migrations/20260817195446_r4a_tenant_provisioning_source.sql` | *(new)* two statements |
| `scripts/lib/provision-tenant.ts` | *(new)* resolution, validation, the single transaction |
| `scripts/tenant-provision.ts` | *(new)* guards, confirmation, output, exit codes |
| `package.json` | `tenant:provision` |

## 6. The transaction

```
BEGIN
  1. resolve the existing active identity   (refused before any write if absent)
  2. check the slug is unclaimed            (courtesy read; companies_slug_uq is the invariant)
  3. insert companies, tenant_status='provisioning', provisioning_source='local-operator-ceremony'
  4. insert the owner role
  5. insert the bootstrap membership
  6. update companies → 'active'
COMMIT
```

`provisioning` is transient **inside** the transaction and never observable. A failure injected at
the last step — the hardest window, with all three rows already inserted — leaves **zero rows of all
three kinds**, proved by a temporary CHECK that rejects the activation. There is deliberately no
recovery state machine: there is no incomplete tenant to recover.

## 7. Owner role — the Gate B open item, resolved

| Question | Answer, from the repository |
|---|---|
| Invented vocabulary? | No. `owner` is existing `roleTypeEnum`; a test asserts it is already declared there |
| Does the membership need a role? | Yes — the session resolver treats `role_id IS NULL` as a refusal |
| Does G2 read the band? | **No.** `decision-authority.server.ts` names `roles.type` among what is deliberately not consulted. Proved: `provisionMemberRole` refuses `no-governance-authority` while the owner holds the band, and succeeds only after Genesis |
| Permissions before Genesis? | None. `authority_rank` and `policy_refs` stay NULL, matching the one existing role writer |
| Collision with `tenant-role-baseline`? | **No.** `roles_one_member_per_tenant_uq` is PARTIAL on `type='member'`; both roles coexist, asserted |
| Any other origin for an owner role? | **No.** `ONBOARDING_EXCLUDED_ROLE_TYPES` keeps `owner` off the invitation path forever. Bootstrap is the only possible origin — which is why the exception is needed |

**The band carries real product authority before Genesis, and that is recorded rather than
discovered later.** `PROVIDER_CONTROL_ROLE_TYPES` and `KNOWLEDGE_AUTHOR_ROLE_TYPES` both admit
`owner`, so the first human can author Knowledge and reach the provider control the moment they sign
in. That control is **global across tenants** — R5 debt, unchanged by this phase and now multiplied
by it. The CLI prints this before asking for confirmation.

## 8. Membership — no fabricated provenance

Columns written: `tenant_id`, `user_id`, `role_id`, `status='active'`, `status_changed_at`. Nothing
else, asserted by extracting the column list from the statement.

`accepted_invitation_id` stays **NULL** and that is the truthful value — no invitation exists.
`memberships_accepted_invitation_uq` is a plain UNIQUE and Postgres treats NULLs as distinct, so
bootstrap and invited memberships coexist. No invitation id, no authorization id, no delegating
actor, no `created_by` is invented.

## 9. Audit — zero rows, and why that is the honest answer

`audit_log.actor_type` and `actor_id` are **both NOT NULL**. A terminal operator has neither.
`start-enrollment.server.ts` already records the doctrine: *"inventing a system actor would put a
claim in a tenant's ledger that no human made."* G2.1's CLI writes its nomination and no audit row
for the same reason; the audit covers the **acceptance**, performed under a verified session.

So the row is the evidence, and the row was made capable of being evidence: `provisioning_source`
records **which root** acted, never who operated it, sharing its literal with
`GENESIS_NOMINATION_SOURCE_LOCAL_OPERATOR`. `created_by` and `created_by_type` stay NULL on all three
rows. A test asserts no audit action ever claims the bootstrap ceremony, and that every audit row
which does exist names a real actor.

**The tenant's ledger begins at Genesis acceptance** — the first moment an honest actor exists.

## 10. Schema verdict — B, additive

`companies.provisioning_source varchar(64)` NULL, with
`CHECK (provisioning_source is null or provisioning_source = 'local-operator-ceremony')`.

Nullable so the two seeded rows need no backfill — and NULL is *meaningful*, not merely tolerated:
it says no ceremony created that row, which is true of a fixture. The CHECK literal is written
**inline**; drizzle-kit renders an interpolated constant as a bind parameter, which is invalid inside
a CHECK. A test asserts the migration literal, the schema constant and the ceremony constant all
agree, and that the migration contains no bind parameter at all.

`plan` is untouched and assigned no meaning — the insert omits it so the column keeps its own
default, asserted.

## 11. A latent defect surfaced and healed: the R3B snapshot was stale

`drizzle-kit generate` emitted four statements that had nothing to do with R4A — dropping
`action_execution_attempts_refused_chk` and `..._unknown_chk`, re-adding `..._response_class_chk`.

Investigated rather than accepted. Canonical was queried directly: it **has**
`response_class_chk`, **has** `unknown_chk` with `IS NOT DISTINCT FROM`, and **lacks**
`refused_chk` — matching the R3B migration SQL and the schema, and contradicting the R3B *snapshot*.
R3B hand-edited its migration and schema after generating and never regenerated the snapshot.

That phantom repair **would have failed against canonical**: `DROP CONSTRAINT refused_chk` on a
constraint that does not exist aborts the transaction, and drizzle applies all pending migrations in
one. So the SQL was hand-authored down to R4A's own two statements, and the generated snapshot was
kept — it is computed from the schema and therefore describes reality, healing the drift for every
future `generate`. Canonical's constraint state is unchanged: 11 checks before, 11 after.

## 12. Genesis handoff — the proof the cycle is really broken

After the ceremony commits, with **no R4A-specific branch anywhere**:

1. `resolveNominationTarget` satisfies all ten of its predicates against the new tenant;
2. `nominateGenesisHuman` writes the pending nomination;
3. `acceptGenesisNomination` succeeds under a verified session (`aal1`);
4. `provisionMemberRole` **refuses** `no-governance-authority` before G2;
5. `establishGovernanceAuthority` creates the one bootstrap decision and consumes the entitlement;
6. `provisionMemberRole` now succeeds, and `member:Member` coexists with `owner:Owner`;
7. `authorizeMembership` still works — bootstrap did not become an invitation bypass.

R4A performs none of these. A test asserts it imports no part of them, and the CLI prints the next
command.

## 13. Firewalls held

| Firewall | Result |
|---|---|
| Canonical | **29 applied, unchanged.** `provisioning_source` column and CHECK both **ABSENT** |
| Canonical data | 2 companies (`acme`, `globex`), 3 roles, 3 memberships, `audit_log` 17, `genesis_nominations` 1 — every count identical to the pre-implementation baseline |
| Bootstrap ceremonies on canonical | **zero** |
| Arming | `external-send` row still **absent**; only `claude=false`, untouched |
| Configuration | `.env.local` byte-identical (`7f254e16c7a382b0…`, mtime Aug 10 22:21) |
| Secrets | no credential-shaped identifier, no hasher import, no statement touching credential storage; three CLI arguments and no fourth |
| Network | zero calls; no Resend, Vercel, DNS or provider contact |
| Dependencies | none added |
| Disposable databases | zero residue — `hebun_r1`, `postgres`, `template0`, `template1` only |

## 14. Tests

**390 passed, 0 failed** (388 baseline + 2 new files). Lint 0 errors / 14 pre-existing warnings,
typecheck clean, build clean, `git diff --check` clean.

- `tests/r4a-flow/provisioning-boundary.ts` — the exact three-table write set extracted from real
  SQL statements, all 26 forbidden tables absent, no `ON CONFLICT`, zero `src/` importers, no route
  or action, every guard, the exhaustive env-var list, a three-field input that cannot express
  identity or lifecycle, the untouched `plan`, the id-keyed activation, one transaction, the frozen
  band, the unfabricated membership columns, the actor-less company insert, constant/literal
  agreement, an additive migration, and the mechanism-level secret firewall.
- `tests/r4a-flow/provisioning-postgres.ts` — the CHECK enforcing, pure validation, refusal before
  any write, the three rows field by field, zero audit rows, sixteen tables untouched, duplicate slug
  leaving the existing tenant byte-identical, injected failure at the hardest window, real
  concurrency with no orphan rows, the full seven-step Genesis handoff, and one human founding two
  tenants without damaging the first.

**Nine inherited tests repaired, in two classes.** Seven "declare every later migration" guards
(`g3`, `invitation-revocation`, `knowledge-ingestion`, `kr3`, `kr4`, `kr5`, `stranded-enrollment`)
gained R4A's declaration — they worked exactly as designed by refusing to let a migration appear
silently. `authentication-schema/migration.ts` is the one place a running tally belongs, so its total
moved 29 → 30 and its **rerun** assertion became state-relative, since that assertion is about
idempotence, not about the total. `r3b-flow/execution-postgres.ts` pinned the global literal 29 — the
exact pattern it had itself forced R3R to repair — and is now state-relative against the migrations
on disk.

## 15. Record-integrity repairs

Two live doctrine comments in `governance-decision/contracts.ts` described role bands as *"seeded"*
and *"never established by any ceremony"*. I1.1's member baseline had already made that origin claim
false and R4A's bootstrap owner makes it plainly so. The **conclusion** — a role band is not
Governance — is untouched and now argued from a stronger fact: the bootstrap owner exists before any
Governance decision does, so a model that read the band would hand a tenant its first authority with
no ceremony ever running.

Nothing else was stale. `genesis-nominate.ts` and `auth-dev-credential.ts` both say they cannot
create tenants; both statements remain true of those tools.

## 16. Limitations (deliberate, recorded)

1. **Local and development-only.** `NODE_ENV=production` and any non-local `DATABASE_URL` are
   refused. **No production tenant can be provisioned.**
2. **No self-service signup.** No stranger can obtain a tenant.
3. **No platform-admin authority exists.** The operator is unidentified; possession of the
   deployment is the trust assumption.
4. **A pre-existing human is required.** R4A creates no user, identity or credential.
5. **The owner band carries real product authority before Genesis** — Knowledge authoring and the
   provider control, the latter still **global across tenants**. R5 debt.
6. **No audit event**, because no honest actor exists. `provisioning_source` records the source, not
   an identity.
7. **Genesis remains a separate ceremony.** R4A stops at three rows.
8. **Multiple `owner` roles per tenant remain schema-legal.** R4A creates exactly one, once, and adds
   no new constraint — that would be role administration.
9. **The canonical migration is NOT applied.** See §17.

## 17. Release state

- **R4A code:** released.
- **R4A migration definition:** released (30 files, 30 journal entries).
- **Canonical migration:** **NOT APPLIED.** `hebun_r1` remains at 29; the column and CHECK are
  absent. Applying it is a separate Director-gated ceremony.
- **Tenant bootstrap ceremonies performed on canonical:** **zero.**

## 18. Next gate

**R4A CANONICAL MIGRATION CEREMONY** (29 → 30), then optionally a first real bootstrap on canonical.
After that, the R4 successors: **R4B** tenant lifecycle writer (`tenant_status` is enforced at
session issuance and still has no writer), **R4C** file ingestion (upload and parse into the existing
chunker), and the reopening of **R2F** provider operations depth. R3B's three gates — Resend
configuration, arming, first send ceremony — remain open and untouched.
