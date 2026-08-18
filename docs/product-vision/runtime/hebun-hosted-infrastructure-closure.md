# Hosted Infrastructure — Closure

**Status:** RELEASED. **External infrastructure only.** Zero application code changed, zero schema, zero migration, zero canonical write.
**Released at:** the commit carrying this record.
**Repository delta:** one line-pair in the root `.gitignore` plus this document. No `src/` file, no test, no dependency, no `vercel.json`.
**Suite:** 408 passed, 0 failed, 0 added — the application source is unchanged, so there was nothing new to pin. Lint 0 errors (14 pre-existing warnings, untouched), typecheck clean, build clean.
**Canonical:** `hebun_r1` unchanged — 31/31/31, 57 tables, business rows byte-identical.
**Production:** <https://hebun-ai-recovered.vercel.app> — auth CONFIGURED, provider DISARMED, no tenant.

Third gate of the Platform Operator Foundation. G1 gave production a provenance vocabulary; G2 made compiled-in organizational fiction unreachable wherever a real tenant can authenticate. G3 creates the place a real tenant could exist at all — and proves that nothing yet does.

---

## What this gate is, and what it is not

**It is:** a hosted Postgres, a hosted runtime, and the six environment values that connect them, configured entirely outside the repository.

**It is not** a feature. The application deployed at `af884a1` is byte-for-byte the application that was already on `main`. Nothing was built for this gate. What changed is *where the code runs and what it is pointed at* — and the honest test of such a gate is not "does new code work" but "does the existing code behave differently, in the direction it always claimed it would, once the environment is real."

It did. That is the entire result.

## The hazard this gate closed

Before this gate, `hebuntechs-projects/hebun-ai-recovered` was deployed at the same commit with **zero environment variables**. Measured live:

```
GET /            -> 307 /command
GET /command     -> 200,   "Active Agents"  36        "active-workflows" 14
GET /login       -> 307 /command
```

A public URL, no sign-in reachable, and the compiled-in organizational fiction rendered under the label *"Available"* — the exact claim G2 exists to prevent, presented to anyone with the link.

This was not a defect in G2. G2's gate reads the authentication environment and permits demo data **only** when auth resolves `disabled`. With no variables set, `HEBUN_AUTH_ENABLED` was absent, auth resolved `disabled`, and the gate did precisely what it was written to do. The fiction was reachable because *the deployment was honestly a pre-auth shell* — and nothing said so.

**The lesson is the shape of the hazard: an unconfigured production is not a broken production, it is a truthfully-configured demo that nobody labelled.** A gate keyed to configuration cannot protect a deployment that was never configured. That is why Step 4's invariant — production is invalid unless `HEBUN_AUTH_ENABLED=true` is *positively proven from runtime behaviour* — is the load-bearing requirement of this gate, and why the same measurement is repeated after.

Measured after:

```
GET /            -> 307 /login
GET /command     -> 307 /login
GET /heby        -> 307 /login
GET /director    -> 307 /login
GET /login       -> 200,  Email + Password sign-in form
```

Every organizational path funnels to the same 9,968-byte `/login` body. Zero occurrences of `active-agents`, `Active Agents`, `active-workflows`, `36` or `14` on any publicly reachable path. The redirect **inverted**: `/login → /command` became `/command → /login`. That inversion is the runtime proof of `HEBUN_AUTH_ENABLED=true`; no configuration readback was trusted for it.

## The database

A dedicated Neon project, created before this half of the gate and re-proved at its start and again after deployment:

| | |
|---|---|
| Organization / project / branch | HebunTech / `hebun-production` / `production` |
| Region | AWS `eu-central-1`, Frankfurt |
| Endpoint | pooled |
| Server | PostgreSQL 18.4 |
| Tables | 57 |
| Migration ledger | 31 authored `.sql` = 31 journal entries = 31 applied, **0 sha256 mismatches**, 0 applied-not-in-ledger |
| Extensions | `plpgsql` only |
| Rows | **0 across all 57 public tables** |

No migration was applied by this gate, nothing was seeded, no extension installed. The ledger was verified by hashing each authored file and matching it against `drizzle.__drizzle_migrations` — by content, never by count.

Turkish text search was re-confirmed live: `to_tsvector('turkish', 'Ürünler ve şirket bilgisi')` → `'bilgis':4 'ürün':1 'şirket':3`.

## TLS: `require` normalized to `verify-full`

The connection string arrived as `sslmode=require&channel_binding=require`. Verified against the **installed** artifact — `node_modules/pg-connection-string@8.22.0`, not documentation:

```js
// uselibpqcompat unset (our case):
case 'prefer': case 'require': case 'verify-ca': case 'verify-full': {
  if (config.sslmode !== 'verify-full') deprecatedSslModeWarning(config.sslmode)
  break            // <- no ssl option overridden: full verification
}
```

`require` today sets nothing, so `rejectUnauthorized` stays `true` and the hostname is checked: today `require` *is* `verify-full`. The library emits its own warning that in `pg` v9 these modes adopt libpq semantics — where `require` becomes `rejectUnauthorized = false`, i.e. encrypted but MITM-able.

The ignored local secret file was normalized to `sslmode=verify-full`. **The change is a no-op today and a pin against tomorrow** — the point is that the guarantee stops depending on a library default that is already scheduled to change. Re-proved after: TLSv1.3, `authorized: true`, peer certificate CN matching the Neon endpoint, and the deprecation warning no longer emitted.

Credentials, host, database and role were not touched.

## The deployment target

Verified before any mutation, and read from three independent places that had to agree:

| | Repository | Vercel |
|---|---|---|
| Git remote | `hebuntech/hebun-ai-recovered` | link `github:hebuntech/hebun-ai-recovered` |
| Production branch | `main` | `main` |
| Deployable app | `apps/dashboard` (the only entry with `next.config.ts` + `package.json`) | `rootDirectory: apps/dashboard` |
| HEAD | `af884a1` = cached `origin/main` = `git ls-remote` | production deployment `gitSource.sha` = `af884a1` |

`vercel link` had written a **repo-level** link — `.vercel/repo.json` at the *repository root*, not a project link under `apps/dashboard`. Its recorded project id `prj_NXzcQeXAtYY9UmRc2NhjSPQbFHlF` matches `vercel project inspect` exactly. Root directory was already correct and was **not** changed.

## Runtime region

`serverlessFunctionRegion` was `iad1` — Virginia — against a Frankfurt database. Every server-rendered page in this application resolves the session against the control plane before it renders anything, so *every* request paid a transatlantic round trip, and a page issuing several sequential queries paid it several times: roughly 85–100 ms each way, before any work.

**The narrowest seam already existed.** Runtime placement is a Vercel *project* setting; this repository owns no deployment configuration and has no `vercel.json` anywhere. Creating one would have invented a second configuration surface — a new deployment-authority file — to express something the project already owned. The project setting was changed to `fra1` instead, and **no repository file was created**.

Verified in the deployment record (`regions: ['fra1']`) and in the response header: `x-vercel-id: fra1::fra1::…` — edge *and* function both in Frankfurt, where the single `fra1::` before the change was the CDN edge alone.

## The production environment contract

Exactly six variables. Nothing else was set.

| Name | Value | Why this value |
|---|---|---|
| `DATABASE_URL` | *(secret)* | Piped from the ignored `apps/dashboard/.env.hosted.local`, never printed, never written to a tracked file |
| `HEBUN_CONTROL_PLANE_ALLOW_REMOTE` | `true` | `client.server.ts` refuses any non-localhost target without exactly this literal |
| `HEBUN_AUTH_ENABLED` | `true` | `auth-environment.server.ts` returns `disabled` for anything that is not exactly `"true"` |
| `HEBUN_AUTH_PROVIDER` | `local` | The only mode with an implemented sign-in flow; `supabase` is a marker interface with no SDK |
| `HEBUN_AUTH_SESSION_DIGEST_CURRENT_VERSION` | `1` | **Derived, not chosen.** `parseKeyVersion` requires a positive integer, and `user_session_contexts` holds 0 rows in the hosted database — there is no earlier version to rotate away from |
| `HEBUN_AUTH_SESSION_DIGEST_SECRET` | *(secret)* | 32 random bytes rendered hex (64 chars), matching the local convention. Generated in-pipe and never written to disk |

The digest secret is an HMAC-SHA256 key — the code imposes no format, only the operator's entropy. It exists in exactly one place, Vercel's encrypted store, and nowhere else.

**Absent by intent:** `ANTHROPIC_API_KEY`, `HEBUN_MODEL_CREDENTIAL`, `HEBUN_MODEL_CONNECTIVITY_ENABLED`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `HEBUN_PERSISTENCE_POSTGRES_DATABASE_URL`. The deployment build environment was read back and confirms only the six above plus Vercel's own.

## Database connectivity, proved by measurement

That production *reaches* Neon could not be settled by a redirect alone — a refusal looks the same whether the database answered or the code never asked. So it was measured on the database side, with `pg_stat_database.xact_commit`:

| Window | Production requests | Transactions observed |
|---|---|---|
| Control, 15 s | 0 | **1** (the audit connection's own reads) |
| Measured | 25 | **28** |

Twenty-five requests, twenty-five extra transactions. The pooled endpoint hides client `application_name` behind `pgbouncer`, so `pg_stat_activity` could not attribute them — the counter could. `tup_returned` stayed `0` throughout: the session-digest lookups matched nothing, because nothing exists to match.

## What production did *not* create

Re-proved against Neon after every probe, redeploy and validation request:

```
all 57 public tables:            0 rows total
providers                        0
provider_connectivity_controls   0
action_permits                   0
heby_action_requests             0
genesis_nominations              0
companies / users / memberships  0 / 0 / 0
audit_log                        0
```

No tenant. No company. No user. No Genesis nomination. No provider row. **Reads create nothing** — proved directly, not assumed: `resolveDirectorEnabled` was run against the live hosted database and the control tables re-counted immediately after.

## Bite-proofs

Executed against the real modules and, where the claim is about the hosted database, against the hosted database itself. 27 assertions, all passing.

| | Claim | How it was proved |
|---|---|---|
| **A** | Absent `HEBUN_AUTH_ENABLED` resolves *disabled* | `{}`, `"TRUE"`, `"True"`, `"1"`, `"yes"`, `" true"`, `"true "`, `""` all → `disabled`; only exact `"true"` does not. **And the hazard was observed, not hypothesised** — the pre-existing deployment was live proof, and closing it was the fix. Production was never weakened to demonstrate this |
| **B** | Malformed auth fails closed | Enabled-without-keys → `invalid` naming all three missing keys; digest version `"0"` and `"v1"` → `invalid`; unrecognized provider → `invalid`. The layout redirects to `/login` on `invalid` |
| **C** | Absent provider control resolves disabled and writes nothing | Against hosted Neon: `getControl('claude')` → `null`; `resolveDirectorEnabled` → `false`; with no repository at all → `false`; control and provider tables still `0` after the read |
| **D** | Configured auth cannot build the fiction | `resolveMockSurfaceGate()` under the exact production environment → `{permitted: false, reason: "real-tenant-reachable"}`, and confirmed live on eight public paths |
| **E** | Only literal `true` opens the remote control seam | `undefined`, `"TRUE"`, `"True"`, `"1"`, `"yes"`, `"false"`, `" true"` each raise `ControlPlaneUnavailableError` against the real Neon URL; `"true"` connects |

## Secret handling

- `apps/dashboard/.env.hosted.local` — ignored by `apps/dashboard/.gitignore:3` (`.env.*`), untracked, never staged.
- `apps/dashboard/.env.local` — same. It holds `ANTHROPIC_API_KEY` and `HEBUN_MODEL_CREDENTIAL` for local development; **neither reached Vercel**.
- `.vercel/` — ignored by the root `.gitignore`, untracked.
- No secret value was printed, logged or echoed at any point. `DATABASE_URL` was inspected structurally (`new URL(...)`, component names only) and piped to Vercel through stdin.
- Build logs for the deployment: **0 matches** for the database role, the Neon domain, a `postgres` URL scheme, an Anthropic key prefix, the endpoint identifier, or any 64-hex literal.
- Repository-wide scan of tracked files: two matches, both obvious localhost test fixtures with placeholder credentials. No real credential is tracked.
- Public HTML on eight paths: zero secret-shaped tokens.

## Deployment mechanism

The project is Git-linked with production branch `main`, and local `main` was already equal to the real remote — 0 ahead, 0 behind. There was nothing to push, so `vercel redeploy` was used on the existing production deployment rather than `vercel deploy`, which would have uploaded a local working tree and severed Git provenance. The result carries `gitSource.sha = af884a1a75c91278d49c66553370e54e4a32ba29` — the same commit, rebuilt against the new environment.

**No repository mutation was required to deploy.**

## Exposure boundary

| URL | Result |
|---|---|
| `hebun-ai-recovered.vercel.app` (production alias) | **public** — 200 on `/login`, everything else 307 to it |
| `…-git-main-….vercel.app` (branch alias) | 302 — Vercel SSO challenge |
| `…-97k2yh5rw-….vercel.app` (immutable deployment) | 302 — Vercel SSO challenge |

`ssoProtection: all_except_custom_domains` exempts the production alias in practice while gating previews. A public sign-in page is the intended boundary; the application's own gate is what protects everything behind it, and that gate is now the one doing the work.

## Canonical firewall

The hosted deployment never touched local canonical. Captured before deployment and re-proved after all validation traffic, byte-identical:

```
57 tables | 31 applied | migrations sha 212559d177d44b3f15aeaa0df78e6799
companies 2  users 3  memberships 3  roles 3
audit_log 17  knowledge_nodes 1  genesis_nominations 1
action_permits 0  heby_action_requests 0  providers 0
provider control: claude / director_enabled=false / version=30
companies digest 2f5b35c7e52bf8b44e8cee613372d9eb
databases: hebun_r1 only — no disposable residue
```

## Repository delta

One tracked change beyond this document: the root `.gitignore` gains `.vercel` and `.env*`. This is not incidental tidying — it is the repository's half of the secret-handling contract above. Without it, `.vercel/repo.json` and every future `.env*` at or above `apps/` are untracked-but-visible, one `git add -A` away from being committed.

**No empty commit, no fabricated implementation claim.** The application source is unchanged, and this record says so in its first line.

## Remaining limitations

- **The digest secret has exactly one copy**, in Vercel's encrypted store, and it is marked sensitive so it cannot be read back. Losing it invalidates every session. That costs nothing today — there are zero sessions and zero users — but it must be escrowed before the first real human signs in.
- **No custom domain.** Production is a `vercel.app` alias. `www.hebuntech.com` still serves a different repository and was not moved.
- **No hosted migration path.** Migrations are applied from an operator's machine against `DATABASE_URL`. There is no deploy-time migration step and no CI, deliberately — a build that migrates is a build that can migrate wrongly, unattended.
- **No monitoring, no alerting, no backup policy of our own.** Neon's defaults are whatever Neon's defaults are; nothing here has verified them.
- **Sign-in is reachable but unusable.** `/login` renders and accepts input, and there is no identity to authenticate against. That is G4's work, not a defect here.
- **Provider is disarmed by absence, twice over** — no control row and no credential. Neither absence is a durable *decision*; both are simply the state of a database and an environment that nobody has written to.
- **The pre-auth shell still exists** and is still the intended development experience. It is now unreachable in production only because `HEBUN_AUTH_ENABLED=true` is set. Unset it and G2's gate correctly permits the fiction again — which is the hazard recorded at the top of this document, and the reason that variable is part of the contract rather than an optimization.

## Next gate

**G4 — Platform Operator Production Ceremony.** A hosted control plane exists with 57 tables and zero rows; the first tenant, the first human and the first Genesis nomination are its subject. Not started.
