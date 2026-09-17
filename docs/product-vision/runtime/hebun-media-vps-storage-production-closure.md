# Hebun VPS Media Storage — Production Closure

Date: 2026-09-17. `origin/main = 5c348f14`. Production deployment `dpl_SH8DxDFfJx8ughivfSwTA2tCCAYn`
(READY, SHA `5c348f14`, aliased `www.hebuntech.com` and `hebuntech.com`).

| Label | State |
|-------|-------|
| IMPLEMENTED | yes |
| VERIFIED | yes |
| HTTPS-REACHABLE | yes — `https://media.hebuntech.com` |
| CONNECTED | yes — proven by the deployed production runtime itself |
| PRODUCTION-ACCEPTED | **yes, storage port level** |
| BACKUP-ACCEPTED | **no** |
| Generation provider | unavailable (`no-generation-provider`) |

## What was accepted

```
deployed runtime → resolveMediaObjectStore() → VPS adapter (hebun-vps)
                 → https://media.hebuntech.com (Caddy, Let's Encrypt) → 127.0.0.1:8787 → /var/lib/hebun-media
```

The storage PORT, through the released resolver, in production. Not the Media Asset authority end to
end: admission and a `media_assets` insert cannot run in production while no generation transport
exists. That remains unproven and is not claimed.

## Releases

| Commit | Content |
|--------|---------|
| `68a5ed3e` | VPS adapter, fail-closed resolver, VPS store, systemd unit, Caddyfile, tests |
| `5c348f14` | `GET /api/media-storage/acceptance` machine ingress + `runStorageAcceptance` |

Why the ingress exists: MEDIA-1 has no human door, so no deployed code evaluated the resolver, and
Vercel sensitive variables cannot be read back. Only a caller inside the runtime could prove the
configured values reach the store.

## Production configuration

Vercel production, all `sensitive`:

- `HEBUN_MEDIA_STORE_ORIGIN`, `HEBUN_MEDIA_STORE_WRITE_SECRET`, `HEBUN_MEDIA_STORE_READ_SECRET` —
  secrets read from the VPS env file in memory and sent to the Vercel API; never displayed.
- `HEBUN_MEDIA_STORAGE_ACCEPTANCE_SECRET` — created for the acceptance run, **removed** afterwards
  (project envs 41 → 40; the three storage variables' ids and `updatedAt` unchanged), then production
  redeployed from the same commit.

## Production acceptance (deployment `dpl_DbwqtXPEPPmaznutSCY8wMDber6A`, SHA `5c348f14`)

- Door: no bearer and wrong bearer → 401, no `/login` redirect; POST → 405.
- Authorized call (secret sent from a file header, value never printed) → HTTP 200:
  `accepted`, backend `hebun-vps`, all 10 checks passed — `resolved`, `absentBeforePut`, `put`,
  `verifiedDigestAndSize`, `signedReadExactBytes`, `grantShortLived`, `writeOnceRefused`,
  `otherTenantAbsent`, `otherTenantGrantEmpty`, `tamperedGrantRefused`.
- VPS corroboration during the run: exactly one 55-byte object, mode 0440, owner `hebun-media`, under
  reserved tenant `00000000-0000-4000-8000-279e04dfe2a8`, PNG signature + `HEBUN-MEDIA-STORAGE-ACCEPTANCE`
  label. Store journal matched the check sequence exactly: `PUT 201`, `PUT 409`, 3 × `verify 200`,
  `read 200`, `read 404`, `read 403`. No journal line contained `sig=` or `authorization`.
- Fixture removed; storage root empty.

## Closure verification (deployment `dpl_SH8DxDFfJx8ughivfSwTA2tCCAYn`)

- Acceptance secret absent from production env; the route answers 401 to no bearer, a wrong bearer
  and an empty bearer, POST 405. Externally, "secret absent" and "wrong secret" are the same answer by
  design; absence is proven by the env listing before the redeploy. No new secret was created.
- The ingress code stays: with its variable unset it refuses every request, which is its designed
  closed state. Re-running acceptance requires a new, deliberate secret.
- VPS: `caddy` and `hebun-media-store` active, storage root 0 entries, TLS verified.

## Production database (READ ONLY transaction) — unchanged across acceptance and closure

| Table | Count |
|-------|-------|
| `media_assets` | 0 |
| `media_generation_invocations` | 0 |
| `heby_action_requests` | 11 |
| `action_permits` | 6 |
| `action_execution_attempts` | 1 |
| `decision_records` | 25 |
| migration ledger | 56 |

No media asset, invocation, Governance decision, request, permit or execution was created. No
generation provider was called. Nothing was published.

## Still open

- **Backup / restore** — bytes live only on the VPS ext4 disk. Hostinger backup not enabled; no
  independent backup exists. Separate gate.
- **Media Asset authority end to end in production** — requires a generation transport. Separate gate.
- sshd `PermitRootLogin yes` / `PasswordAuthentication yes` on the VPS — not changed, flagged.
