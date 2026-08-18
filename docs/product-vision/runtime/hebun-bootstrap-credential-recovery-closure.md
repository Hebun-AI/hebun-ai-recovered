# Bootstrap Credential Recovery — Closure

**Status:** RELEASED. Runtime/ceremony extension only — **zero schema, zero migration, zero canonical write, zero production row.**
**Canonical:** `hebun_r1` unchanged — 31/31/31, 57 tables, business rows byte-identical.
**Production:** the ceremony **REFUSES** on the real target, because there is no human to recover. Zero mutations.

G5A closed with one named limitation: *"If the bootstrap human's credential is lost before a tenant exists, there is no ceremony to rotate it."* This is that ceremony, and nothing more.

---

## What it is, in one sentence

One escape hatch for one human's password, during the window in which the deployment has a person but no organization — and it dies the moment an organization exists.

It is not a password reset, not account recovery, not an admin capability, not a tenant-administrator capability. It cannot choose whom it acts on, and there is no configuration anywhere in this phase that can reopen it.

## The bootstrap window

```
exactly one row in `users`   AND   zero rows in `companies`
```

That is the whole condition, and the second predicate does almost all the work.

**Measured, not assumed:** 44 tables carry a NOT NULL foreign key to `companies`, and they include `roles`, `memberships`, `invitations`, `membership_authorizations`, `genesis_nominations`, `governance_sessions`, `decision_records` and `identity_enrollment_requests`. **Zero companies therefore means zero organizational state of any kind** — enforced by referential integrity, not by this module remembering to check a list.

A test re-derives that implication from the live `pg_constraint` catalogue rather than trusting this paragraph, so a future table that escapes it fails the build instead of silently widening the window.

`users = 1` is the other half, and it does two jobs: it proves the human exists, and it makes *which human* unanswerable in any way other than "the only one".

**The single exception**, checked and deliberately allowed: `user_session_contexts.active_tenant_id` is nullable, so a signed-in human can belong nowhere. That is exactly the state G5A leaves behind, it is not organizational authority, and it correctly does not close the window.

## The closure condition, stated once

**The moment the first company row exists, this ceremony refuses forever.** Not warns, not "requires a flag" — refuses, on every subsequent run. There is no environment variable, no override argument and no force mode in this phase; a test asserts the CLI reads only `DATABASE_URL` and `NODE_ENV`, and that the words *force*, *override*, *skipGuard* appear nowhere.

**Tenant provisioning is the event that permanently retires this capability.**

A test proves the closure directly: with the correct email and a valid password, one `companies` row makes the recovery refuse and change nothing.

## It is not a credential authority

Neither ceremony file contains credential SQL, a query-builder call, or any cryptography — no `hashPassword`, no `scrypt`, no `salt`, no `secret_hash`. After this gate there is still exactly **one** module under `src/` that writes `auth_credentials`, asserted as a list rather than a count.

The narrowest legitimate extension was added to that authority instead: `replacePasswordCredential`, transaction-joinable via a `CredentialReplacer = Pick<db, "insert" | "update">` — widened from `CredentialWriter` for the same reason I1.2 widened that one, because two statements must commit together.

## The transition was derived, not chosen

`auth_credentials_active_identity_type_uq` is a **partial unique index** on `(auth_identity_id, credential_type) WHERE status = 'active'`. An identity may hold exactly one active password credential, which forbids inserting the replacement beside the old one and **forces the revoke to happen first**.

- **Not an update in place.** It would satisfy the index, and is rejected for the reason `revokeCredential` already states: the record that a credential existed must survive. A revoked row keeps its material, its failure history and its reason.
- **Not delete-and-insert**, for the same reason and for FK discipline.
- **The derivation runs before the revoke.** A scrypt failure must not be able to strand the human, and it is the only step here that can fail for a reason the database does not own.
- **The revoke sets exactly four columns** — `status`, `revokedAt`, `revocationReason`, `updatedAt` — asserted by parsing the `.set({…})` block, and scoped by identity, type and status so it can only ever touch the one row the index permits to be active.
- **`auth_credentials_revoked_chk` requires a non-blank reason**, so the revocation cannot be done quietly. The reason names the ceremony, because no person is known.
- **`revoked_by_id` and `revoked_by_type` stay NULL together**, which `auth_credentials_revocation_actor_chk` permits and which is the only truthful pair. Possession is a SOURCE, never an ACTOR.

## The human is resolved, never selected

The CLI takes **no arguments at all**. `resolveRecoveryEligibility` takes a database reader and nothing else, and its query carries no bind placeholder and no template hole — it reads the only row that exists. Arbitrary targeting is not forbidden; it is unrepresentable.

`confirmEmail` is an **operator safety check**, not a selector: it is compared against the human the database already resolved, never used to look one up. Its whole job is to let an operator discover they are pointed at the wrong deployment before changing a password on it. A test asserts it never reaches a predicate, and a database test proves a mismatched confirmation recovers nobody.

## Possession, target binding and secrets

Possession and target binding are **G4's, reused**: the ceremony is forbidden from naming `pg_control_system`, `system_identifier`, or either locality guard. Target is proved **before** any credential state is read. Reachability stays a separate guard — a non-loopback target still needs `HEBUN_CONTROL_PLANE_ALLOW_REMOTE=true`.

The password can arrive from exactly one place: a hidden TTY prompt, entered twice, with the email retyped first. No argv, no environment, no file. It never reaches an output — asserted on the *identifier* after stripping string literals — and errors surface as `error.message` only. The floor is imported from the enrollment contract rather than restated.

## Atomicity and concurrency

Revoke and insert commit together or not at all. Proved by provoking a failure at the replacement insert **after** the revoke has run: the human still holds exactly one active credential, it is the same row as before, and it still verifies with the password they had.

Two concurrent recoveries on two independent connections leave **exactly one active credential**, and exactly one of the two passwords is live. `SHARE ROW EXCLUSIVE` self-conflicts so the ceremonies serialize, conflicts with the `ROW EXCLUSIVE` that both statements take, and leaves `ACCESS SHARE` readers alone so a sign-in is never blocked by a recovery in flight.

## Bite-proofs

Nine mutations, each restored and verified byte-identically by sha256.

| | Mutation | Result |
|---|---|---|
| A | Remove the bootstrap-window guard | caught |
| B | Let a company no longer close the window | caught |
| C | Let a caller-supplied email reach the resolution predicate | caught |
| D | Read the password from argv | caught |
| E | Move the replacement outside the transaction | caught |
| F | Remove the table lock | caught |
| G | Bypass G4 target binding | caught |
| H | Import the ceremony from `src/` | caught |
| I | Create a company as a side effect | caught |

**One process defect worth recording.** The first bite-proof run reported C as surviving — and it had not run at all: the inline Python quoting mangled the edit, so nothing was mutated and the suite passed for the ordinary reason. A bite-proof that fails to apply proves nothing, and looks identical to one that failed to bite. The mutations were rewritten as standalone files and the runner now **verifies each mutation applied before trusting its verdict.** The same run also timed out mid-proof and left an edit in place; restoration is now checked by hash before anything else.

## Assertions corrected before they were right

Four more of the shape G5A recorded, each fixed by narrowing the mechanism rather than loosening the rule:

- `/set\(\{[\s\S]*?secretHash/` spanned the whole function and matched the `secretHash` in the **insert's** arguments — one regex reading two statements as one. Now scoped to the update statement.
- The set-block key list missed `revocationReason` because it is a **shorthand property** with no colon.
- `"id ="` flagged the join condition `i.user_id = u.id`, which is the query's own structure and not a caller's input. Now asserted as the absence of any injected value.
- A module-wide `indexOf` put `resolveRecoveryEligibility` before the target probe, because it also appears in the **import block** — the third time this repository has hit that shape. Ordering is now scoped to `main()`.

## Schema verdict

**Zero changes.** No table, no column, no enum, no CHECK, no index, no migration. Every guarantee comes from constraints that already existed: the partial unique index, the revoked check, the revocation-actor check, and the 44 NOT NULL foreign keys that define the window.

## Production result

Read-only against the real Neon target: posture and cluster bind, then the ceremony **refuses** with `no-bootstrap-human`, because production has zero humans. That is the correct and expected outcome for this gate — the capability is proved reachable and proved to decline. **Zero rows across all 57 production tables, before and after.**

## Record integrity

**One live claim is now false**, and it is in a historical closure record: G5A's *"No recovery path… there is no ceremony to rotate it."* That statement was true when G5A was released, and this repository's convention — verified across G1→G2 and G2→G3 — is that closure records are frozen at their release and are not rewritten when a later gate changes the world. It is left intact, and this record names it instead.

No live **code** claim was falsified. The only in-code statement about recoverability is the one this phase wrote.

## Remaining limitations

- **Recovery is not itself recoverable.** If the operator loses deployment possession, nothing here helps.
- **No provenance and no audit row.** `audit_log.actor_id` and `actor_type` are NOT NULL and a terminal has no actor, exactly as every prior possession ceremony concluded. The revocation reason on the old row is the only durable trace.
- **The window is a ceremony guard, not a schema invariant.** Nothing in the database prevents a credential replacement after tenant zero; this ceremony refuses to perform one, and it is the only caller of the new primitive.
- **`replacePasswordCredential` is now available to Credential authority's future callers.** A test pins that no route, action or feature calls it today, but the primitive itself is general — a later product password-change flow would use it, and should, rather than growing a second one.
- **No rate limiting and no cooldown.** An operator with possession can run this repeatedly during the window.

## Next gate

**G5B — Tenant Zero Bootstrap Execution.** Create the real first human, provision the first tenant, nominate Genesis, accept it in-product under a verified session, and prove login and tenant access. Not started.
