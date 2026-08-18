# First-Human Bootstrap Ceremony — Closure

**Status:** RELEASED. Runtime/ceremony extension only — **zero schema, zero migration, zero canonical write, zero production row.**
**Suite:** 412 passed, 0 failed (410 + this phase's two files). Lint 0 errors (14 pre-existing warnings, untouched), typecheck clean, build clean.
**Canonical:** `hebun_r1` unchanged — 31/31/31, 57 tables, business rows byte-identical.
**Production:** preflight READY, `users = 0`. **The first human has NOT been created.**

Fifth gate of the Platform Operator Foundation. G4 made three ceremonies production-capable and closed with one blocker: `tenant:provision` requires a human who already exists, and production had none. This is the missing seam.

---

## The premise Gate A corrected

The problem was framed as a bootstrap *cycle*. It is not one.

**`users` has zero outbound foreign keys.** `auth_identities → users`, `auth_credentials → auth_identities`, and that is the entire chain — no company, no role, no membership, no governance touches it. `users` uses `rootColumns`, so it carries no `tenant_id` at all. **Identity is a root of the dependency graph.**

The real cycle is tenant-side — `memberships → invitations → membership_authorizations → decision_records/governance_sessions → genesis_nominations → memberships`, every link NOT NULL — and **R4A already broke it**, at the one nullable edge (`memberships.accepted_invitation_id`).

So there was never a cycle to break here. There was a **missing production seam**: every caller of the identity writer happened to be enrollment, which needs an invitation, which needs a tenant. The writer itself needs none of that, and says so in its own header.

## It is not a new Identity authority

This is the load-bearing claim of the phase, and it is asserted rather than promised: **neither new file contains an INSERT of any kind** — no `insert into`, no `.insert(`, no `.values(`, no `on conflict`.

The ceremony orchestrates two existing authorities inside one transaction and owns neither:

| | |
|---|---|
| `insertLocalIdentity` | Identity authority — the sole writer of `users` and `auth_identities`, whose header states it *"does not decide whether the human MAY be created — that is the caller's authority to have established."* Authority-neutral by design, and transaction-joinable because it takes a writer rather than a database. |
| `establishFirstPasswordCredential` | Credential authority — hashes **and** persists, so a plaintext goes in and an id comes out. No salt and no derived key ever cross into the ceremony, which is what keeps the stored secret confined to the three files D1 permits to name it. |

Deployment possession supplies exactly the authorization those writers refuse to decide. It supplies no second implementation of what they do. After this gate, `src/` still holds exactly one module that may insert into `users` or `auth_identities` — a test asserts the list, not a count.

## One-shot, and the lock level

"First" *is* the authorization. If any human exists, the ceremony refuses — **including when that human has a different email.**

`users_email_uq` is not the guard and could not be: it prevents the same address twice and would happily admit a second, different first human. So the check is `select count(*) from users`, unfiltered, taken **inside the transaction, after a table lock**. A test asserts the ordering inside the function body, and that the guard region reads no email at all.

**`SHARE ROW EXCLUSIVE` is the narrowest level that works**, and the level was chosen by conflict analysis rather than by caution:

- it **self-conflicts**, so two concurrent ceremonies serialize;
- it conflicts with `ROW EXCLUSIVE`, which is what `INSERT` takes, so nothing can add a user between the check and the write;
- it does **not** conflict with `ACCESS SHARE`, so a sign-in or a session lookup is never blocked by a bootstrap.

`EXCLUSIVE` (Gate A's suggestion) also works and additionally blocks `SELECT … FOR UPDATE` for no benefit here.

The concurrency proof runs two ceremonies on two independent connections through `Promise.all` and requires exactly one winner and one `humans-already-exist` refusal. **It is not passing by luck:** weakening the lock to `ROW EXCLUSIVE` turns it red.

There is no rotation, no repair, no reset. A second run refuses and changes nothing.

## The self-attribution correction

Gate A found the one thing that would have been *false*. `insertLocalIdentity` set `created_by` on the identity to the new user's own id **unconditionally**, whatever the declared actor type said. For enrollment that is true — a person followed an invitation and brought themselves into existence. For a possession-bootstrapped human it is false: they did not perform the act.

The fix is the narrowest possible one, and it needed **no new field**: the existing optional `createdByType` already distinguishes the two cases, and `createdBy` now follows it.

```ts
createdBy: input.createdByType === "human" ? userId : undefined,
```

- **Enrollment passes `createdByType: "human"` and is unchanged** — proved against a real database, not by reading.
- **The bootstrap omits it**, so `created_by` and `created_by_type` are NULL **together**. Both-or-neither, and no actor invented.

A separate test asserts the bootstrap identity's `created_by` is not equal to its own `user_id` — the specific lie, named.

## Provenance, honestly

The released schema has no `users.*_source` column. The bootstrap row therefore **cannot record which root created it**, and none was invented. Silence writes nothing false; a fabricated actor or a borrowed tenant vocabulary would. G1 widened provenance for `companies` and `genesis_nominations` because those rows had a lie to avoid — this row does not. No `audit_log` row either, for the reason every possession ceremony gives: `actor_id` and `actor_type` are both NOT NULL there.

**Accepted limitation, recorded rather than papered over.** A bootstrap human and an enrollment-born human differ in the database only by the enrollment row the latter carries.

## Secret handling

The password can arrive from exactly one place. `argv` carries the email and nothing else (asserted as the literal set `["2"]`); the environment yields only `DATABASE_URL` and `NODE_ENV` (asserted as the exact sorted set); no file is read or written. It is entered twice, hidden, and only on a real TTY. The email is retyped to confirm.

It never reaches an output: the assertion strips string literals and then checks that no `console.log` / `console.error` / `process.stdout.write` call receives the *identifier*. Errors surface as `error.message` only — never a stack frame that could carry the plaintext. The declared success shape is four fields, none of them a secret.

Cryptography is the product's, unchanged: scrypt N=32768 r=8 p=3 keylen=64 with a 32-byte random salt, and the stored credential is proved to verify with the **same** `verifyPassword` the login path uses. The minimum length is imported from the enrollment contract rather than restated, so the most privileged account in the deployment cannot end up under a second password policy.

## Possession and target binding are G4's, reused

No second authorization mechanism. The ceremony calls `resolveCeremonyPosture`, `preflightEnvironment` and `preflight`, and a test forbids it from naming `pg_control_system`, `system_identifier`, or either locality guard — target binding is G4's to own.

The two layers compose as designed: a production run needs `HEBUN_PRODUCTION_CEREMONY` (authorization) **and** `HEBUN_CONTROL_PLANE_ALLOW_REMOTE=true`, which `createControlPlaneDb` enforces on its own for a non-loopback target. Reachability is still not authorization.

Target is proved on a plain client and the act happens on a Drizzle handle, because the Identity and Credential authorities take a writer. The proving connection is closed before the write.

## Bite-proofs

Seven mutations, each restored and verified byte-identically by sha256.

| | Mutation | Result |
|---|---|---|
| A | Remove the users-empty one-shot guard | caught |
| B | Weaken the lock to `ROW EXCLUSIVE` | caught — this is what makes the concurrency proof real |
| C | Restore unconditional self-attribution | caught |
| D | Hoist the credential out of the transaction | caught |
| E | Add a membership side effect | caught |
| F | Import the ceremony from `src/` | caught |
| G | Leak the password into the success banner | caught |

## Four assertions were wrong before they were right

Every one failed on the ceremony's own honest prose, and each fix narrowed the mechanism instead of loosening the rule. Recorded because it is the same shape four times.

1. **"the ceremony must not name `created_by`"** failed on the operator banner that says those columns stay NULL. Forbidding the name would have forbidden the disclosure. The CLI is now checked with its `console.log` lines removed.
2. **"the write follows the proven count"** could never pass: `insertLocalIdentity` also appears in the import block, so a module-wide `indexOf` puts the write first. The mirror of R4C.1, where an import made an ordering assertion impossible to *fail*. Ordering is now scoped to the function body.
3. **"no rotation"** as a word-list failed on the refusal message that says it will not *"repair an account"* or *"reset a password"* — the denial, not the capability, exactly as R3B recorded. Now asserted by mechanism: no UPDATE, no DELETE, and the establish-first primitive rather than the rotating one.
4. **"the password is never logged"** failed on the banner phrase *"ONE password credential"*, and **"never returns the plaintext"** failed on the refusal reason `"password-too-short"`. Both now strip string literals first and check the identifier.

**The lesson, stated once: prose, refusal reasons and denials are made of the same words as the things they forbid.** A guard that greps words will flag the sentence that documents it.

## Real production result

Read-only preflight against the real Neon target: **READY**, with `users = 0`, `auth_identities = 0`, `auth_credentials = 0` and every other bootstrap surface at zero. Three refusals also proved live: no signal → the released local guard refuses the remote host; `true` → refused as malformed with an explicit "it was NOT treated as a local ceremony"; a wrong pinned cluster → refused with observed and expected identifiers named, before any application table is read.

**Zero-mutation re-proved after: 0 rows across all 57 production tables.**

**The ceremony was NOT executed against production.** That is G5B, under explicit Director approval.

## Canonical firewall

`hebun_r1` byte-identical: 57 tables, 31 applied, migrations sha `212559d177d44b3f15aeaa0df78e6799`, companies 2 (digest `2f5b35c7e52bf8b44e8cee613372d9eb`), users 3, identities 3, credentials 3, memberships 3, roles 3, audit 17, knowledge 1, genesis 1, provider `claude/false/v30`, only `hebun_r1` — no disposable residue.

## Truth status

| | |
|---|---|
| First-human ceremony | **IMPLEMENTED · AVAILABLE · EXECUTABLE** |
| First human in production | **NOT YET CREATED** |
| Tenant zero | **DOES NOT EXIST** |
| Genesis | **NOT NOMINATED, NOT ACCEPTED** |
| Provider | **DISARMED** |

## Remaining limitations

- **The bootstrap human belongs nowhere.** They can sign in and will have no workspace until a tenant ceremony gives them a membership. That is the correct sequence, not a gap.
- **No provenance on the row**, per the schema verdict above.
- **`users.created_by_type` can still be set without `created_by`** on the enrollment path — enrollment writes `created_by_type='human'` with `created_by` NULL on the *user* row, a pre-existing asymmetry this gate deliberately did not change, because Step 4 required enrollment behaviour to remain exactly as before. No CHECK enforces both-or-neither on `created_by` anywhere in the schema; the constraint exists only on revocation pairs.
- **One-shot is a ceremony guard, not a schema invariant.** Nothing in the database prevents a second user; the lock and the count do. A future path that inserts a user without this ceremony is unaffected by it.
- **No recovery path.** If the bootstrap human's credential is lost before a tenant exists, there is no ceremony to rotate it — `auth:dev-credential` remains local-only by design. This is a real gap and it is cheapest to fix before G5B, not after.

## Next gate

**G5B — Tenant Zero Bootstrap Execution.** Create the real first human, provision the first tenant, nominate Genesis, and complete Governance through the existing product path. Not started.
