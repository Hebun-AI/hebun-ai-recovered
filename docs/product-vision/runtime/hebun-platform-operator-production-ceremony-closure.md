# Platform Operator Production Ceremony — Closure

**Status:** RELEASED. Runtime/ceremony extension only — **zero schema, zero migration, zero canonical write, zero production business row.**
**Suite:** 410 passed, 0 failed (408 + this phase's two files). Lint 0 errors (14 pre-existing warnings, untouched), typecheck clean, build clean.
**Canonical:** `hebun_r1` unchanged — 31/31/31, 57 tables, business rows byte-identical.
**Production:** preflight READY against the real Neon target. **No tenant. No Genesis. Provider DISARMED.**

Fourth gate of the Platform Operator Foundation. G1 gave production a provenance vocabulary and said a later gate would build the ceremony that may use it. This is that gate.

---

## What this gate is

Three ceremonies that already existed — tenant provisioning, tenant lifecycle, Genesis nomination — can now run against the production database, bound to one specific cluster, recording the production root. Nothing else changed.

**It invents no authority.** The root of trust is the one R4A, R4B, G2.1, D1.1 and R5.1 already rest on: possession of the deployment. G4 only makes it name *which* deployment is possessed. No platform principal, no operator identity, no platform role, no sentinel tenant, no admin tenant, no UI, no route, no server action, no Heby command. Possession is still a SOURCE and never an ACTOR — `created_by` stays NULL and no `audit_log` row is written, in either posture, for the same reason as before: a terminal has no honest actor to name.

**Availability is not execution.** The correct production result for this gate is *ready, and nothing provisioned*. That is what was measured.

## The surface, decided per ceremony

| Ceremony | Verdict | Why |
|---|---|---|
| `tenant:provision` | **INCLUDED** | G5's subject. The released G1 vocabulary exists precisely so this row can be truthful. |
| `tenant:lifecycle` (suspend / reactivate) | **INCLUDED** | A live tenant that cannot be suspended is an operational trap. Writes no provenance, so it needed none. |
| `governance:nominate-genesis` | **INCLUDED** | The bootstrap seam G5 must cross, and the second released production vocabulary. |
| `provider:connectivity` | **EXCLUDED** | The provider stays disarmed after G4. A production-reachable arming switch is one command away from armed, and this ceremony has no production provenance to record — it writes `updated_by` NULL and carries no source column. |
| `auth:dev-credential` | **EXCLUDED** | A *development* credential tool by name and by design. Production reach for it would be the first-human question answered by the wrong seam. |

A test pins both exclusions: neither excluded CLI may name the posture, the production root, or the possession environment variable.

## The possession contract

`HEBUN_PRODUCTION_CEREMONY` opens the production posture, and only when it is **exactly** `production-operator-ceremony` — deliberately the same string the released vocabulary writes, so the operator types the name of the root they are claiming.

**Absent means local. Anything else REFUSES.** `true`, `TRUE`, `1`, `yes`, `""`, `" production-operator-ceremony"`, `"production-operator-ceremony "`, case variants, and even `local-operator-ceremony` all refuse — and, the load-bearing half, **none of them silently becomes local**. An operator who meant production and mistyped it must not quietly get a different ceremony than the one they asked for.

### Why not `HEBUN_CONTROL_PLANE_ALLOW_REMOTE`

That variable was audited first, as the brief required. It is the established remote seam and it was **rejected**, because it answers a different question.

`ALLOW_REMOTE` asks *may this process reach a remote database*. G3 set it on the Vercel web runtime, where it is true for every request forever. A ceremony asks *may this operator mutate production right now*. Reusing the reachability flag as the mutation authorization would mean any environment permitted to **read** production is also permitted to **provision a tenant** in it, and that a `.env` copied from the running deployment silently carries constitutional authority.

**Reachability is not authorization.** They are kept apart, and the ceremony variable is set nowhere in the deployment.

## Target binding — and why the ledger could not be it

A valid credential pointed at the wrong PostgreSQL database is the failure this gate exists to prevent. Three candidates were measured, not assumed.

**A hostname check was rejected outright** — it is a guess about a string the operator already controls.

**The migration ledger was rejected as the binding, by measurement.** The local canonical database and the hosted production database carry a byte-identical ledger — 31 rows, digest `212559d177d44b3f15aeaa0df78e6799` on both — *because they are the same release*. A schema fingerprint proves "this is a Hebun control plane at the released schema" and proves nothing about which deployment it is. It is necessary and insufficient, and is now checked as a co-factor after identity, never as identity. A test pins that ordering, and the database-proved test re-measures the shared digest on a third database so the premise cannot rot.

**The binding is `pg_control_system().system_identifier`** — a 64-bit value written at `initdb`, identifying the *cluster*, not settable from a connection string and not derivable from a credential. Measured on both targets: they differ. Because a cluster can hold several databases, `current_database()` is pinned beside it.

Both expected values are supplied **out of band** by the operator and compared against what the live server reports. That is a binding, not a heuristic.

**Stability was proved, not assumed.** The concern was that a serverless provider might regenerate the identifier on compute restart, which would break the binding. Neon's compute *did* restart mid-gate — postmaster start time moved from `19:43:47Z` to `19:55:44Z` — and the identifier was **unchanged**. The design is also safe if that had gone the other way: a mismatch always refuses, so instability would have cost availability and never safety.

## Provenance

The root is a **parameter, never an argument.** It is derived from the resolved posture and cannot be named at the command line, because `provisioning_source` is the only evidence tenant birth leaves — no `audit_log` row is possible, since `actor_id` and `actor_type` are both NOT NULL there — so a value the caller picks would be a permanent lie in the one place the truth is kept.

- Local posture → `local-operator-ceremony`, exactly as before.
- Production posture → `production-operator-ceremony`, admitted by the released CHECK.
- **Omitting it yields the LOCAL root**, proved against a real database. A caller that says nothing can never accidentally make a production claim.
- Neither writer module contains the production literal at all — a property *stronger* than the one G1 pinned.
- The target's own `pg_get_constraintdef` is probed before any write, so a database predating the vocabulary is refused rather than discovered mid-ceremony.

## Preflight — one path, zero mutation

There is exactly one validation function. Execution is defined as *preflight that did not refuse, followed by the write*, and a ceremony has no other way to obtain a bound target — so a green preflight is evidence about the ceremonies, not about itself.

Zero mutation is proved **twice**: structurally, by a test over the module's own source that forbids every write verb and every file-write call; and empirically, by counting six tables before and after both a successful and a refused preflight against a real database.

`npm run platform:preflight` is the operator-facing report. It reads **counts, never content** — no tenant name, no email, no Knowledge, no Memory. Its table list is a closed literal, so there is no expressible way for an operator to make it read a table they name; a test strips that literal and asserts no governed table name survives anywhere else in the file.

## Firewalls

`src/` cannot import anything under `scripts/`, statically or dynamically, and no route may reach it — the R5.1 property, re-asserted and widened from one ceremony to the whole directory. Nothing under `src/` may even *name* the possession contract.

Write firewall over everything G4 added: no governance table, no Knowledge, no session, no action surface, no provider control, and no `director_enabled` in any position. No actor is fabricated anywhere.

**One firewall assertion was corrected rather than satisfied.** The first version forbade the *name* of every governed table across all three new files, and it failed — on the preflight report, which legitimately counts `audit_log` and `provider_connectivity_controls` rows to prove they stayed at zero. Forbidding the name would have forbidden the evidence. The assertion now forbids the write verbs everywhere, forbids the two library modules from reading those tables at all, and confines the report's mentions to its closed list.

## Bite-proofs

Nine mutations, each restored and verified byte-identically by sha256.

| | Mutation | Result |
|---|---|---|
| A | Accept `true` as the production signal | caught |
| B | Stop comparing the cluster identifier | caught |
| C | Make the production root the default | caught |
| D | Import the ceremony from `src/` | caught |
| E | Add a forbidden write (arm the provider) to preflight | caught |
| F | Make preflight insert a company | caught |
| G | Remove the `begin` from the bootstrap transaction | caught |
| H | Let `process.argv` name the provenance root | caught |
| I | Give the provider ceremony production posture | caught |
| J | Remove the locality guard from the shared path | caught **by the three repaired released tests** |

**Two of them did not bite on the first attempt, and both were real.**

*H* spliced `(process.argv[5] as never) ?? environment.posture.source` into the CLI and survived, because the assertion only required the posture to be *mentioned somewhere* — and it still was, as the fallback. The binding is now pinned whole, as an exact single-match line.

*G* is the more interesting one. Replacing the transaction's `rollback` with `commit` left the suite **green**, and the first reading was "the test is weak." It was not, quite: the two refusals the file exercised never reached that catch — a taken slug is decided by the courtesy read, and an unknown human is refused before `begin`. So a mid-transaction failure was added, provoked by a trigger at the third insert, which is the only point where an orphan company and role can exist. The mutation *still* survived — and the measurement explains why: once a statement raises, PostgreSQL puts the transaction in an aborted state where `COMMIT` performs an implicit rollback. **The explicit `rollback` is connection hygiene; `begin` is the atomicity guarantee.** Removing `begin` turns the suite red. Both facts are recorded in the test, because a reader who assumed the rollback call was the protection would draw the wrong conclusion about what is safe to change.

## Released-test repairs

Three released tests pinned boundaries that G4 legitimately moved. Each was repaired to assert the same property where it now lives, and **bite-proof J confirms all three still fail when the guard is removed** — the repairs are not weakenings.

- **G1 `provenance-vocabulary`** pinned "vocabulary only — no writer exists" and that all five CLIs call `assertLocalDatabaseUrl` directly. G4 is the gate G1's own schema header anticipated. The repair keeps everything G1 owned (the vocabulary, the CHECKs, `src/` naming and writing nothing) and re-expresses only the two claims G4 changed.
- **R4A / R4B boundary** pinned `assertLocalDatabaseUrl(databaseUrl)` at the old call site. The property — *the guard is reused, not re-implemented* — is unchanged; only its location moved. Keeping the old regex would have been satisfied by an unused import: a grep passing while the property rotted.
- **R4A** also forbade `provisioningSource` on the ceremony input. That field is exactly what G4 adds. It left the forbidden list, and four narrower assertions took its place: the type is the two-member released union, omitting it yields the local root, the only caller binds it to the posture and nothing else, and `src/` cannot import the module. Everything else on that list is still forbidden, `createdBy` included.

## One defect found in new code, by a test

`new URL()` reports a bracketed IPv6 host **with** its brackets — `[::1]`, not `::1` — so the first version of the non-local guard would have accepted `postgresql://…@[::1]:5432/…` as a legitimate production target. Caught on the first run of the new test file. The brackets are now stripped. The released `assertLocalDatabaseUrl` has the same blind spot in the opposite direction, where it errs *safe*, so a bracketed loopback is now refused in **both** postures — coherent and fail-closed. Correcting D1.1's guard is a separate decision this gate did not take.

## Real production result

Run against the real Neon database, read-only:

```
posture    : PRODUCTION deployment possession — cluster <pinned>, database neondb
authored   : 31 migrations in this checkout
✔ tenant provisioning: ready        31 applied
✔ genesis nomination : ready        31 applied

companies 0   users 0   auth_identities 0   memberships 0
roles 0   genesis_nominations 0   provider_connectivity_controls 0   audit_log 0
```

And the three refusals, also against the real target: no signal → the released local guard refuses the remote host; signal `true` → refused as malformed with an explicit "it was NOT treated as a local ceremony"; a wrong pinned cluster → refused with the observed and expected identifiers named, before any application table is read.

**Zero-mutation re-proved after:** 0 rows across all 57 production tables.

## Canonical firewall

`hebun_r1` byte-identical throughout: 57 tables, 31 applied, migrations sha `212559d177d44b3f15aeaa0df78e6799`, companies 2 (digest `2f5b35c7e52bf8b44e8cee613372d9eb`), users 3, memberships 3, roles 3, audit 17, knowledge 1, genesis 1, provider `claude/false/v30`, permits/requests/providers 0/0/0, only `hebun_r1` — no disposable residue.

## Truth status

| | |
|---|---|
| Production ceremonies | **IMPLEMENTED · CONNECTED · AVAILABLE · EXECUTABLE** |
| Tenant provisioning in production | **NOT EXECUTED** |
| Tenant zero | **DOES NOT EXIST** |
| Genesis nomination in production | **NOT EXECUTED** |
| Provider | **DISARMED** — no control row, no credential |

## Remaining limitations

- **G5 is blocked on a first human, and G4 did not smuggle one in.** `tenant:provision` requires a human who already exists; the only writers of `users` / `auth_identities` are a development seed and the enrollment path, and enrollment needs an invitation, which needs a membership authorization, which needs a Governance decision, which needs Genesis, which needs a membership. Production holds zero users, so production tenant provisioning would refuse `identity-not-found` today. That is the honest state, not a defect of this gate — R4A's refusal to create people is a boundary, and the brief forbade moving it.
- **The cluster identifier is not committed** and lives with the operator beside the connection string. A lost pin is a refusal, not a loss.
- **No audit trail for possession acts**, still blocked on `audit_log.actor_id`/`actor_type` being NOT NULL. Row provenance remains the only evidence, exactly as before.
- **The lifecycle ceremony records no provenance at all** — the released schema gives suspension no source column, so a production suspension is indistinguishable from a local one in the row. Not introduced here; not fixed here.
- **Preflight proves readiness, not correctness of intent.** It cannot know whether a tenant *should* exist.
- **`provider:connectivity` remains local-only**, which means the production provider control has no writer at all — the R5.1 position, unchanged and still fail-closed.

## Next gate

**G5 — First Production Tenant Bootstrap.** Its entry condition is a production-capable path to the first human, which does not exist yet. Not started.
