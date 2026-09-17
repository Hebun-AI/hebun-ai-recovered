# Hebun VPS media store

The VPS side of the `MediaObjectStore` port.

```
Media Asset authority → MediaObjectStore → VPS adapter (vps-media-object-store.server.ts)
                      → hebun_media_store.py on the dedicated Hebun VPS → /var/lib/hebun-media
```

It is a transport/storage adapter. It owns no media lifecycle, tenant authority, Governance,
generation, publishing, permit or execution. Neon `media_assets` stays authoritative.

## Files

| File | Role |
|------|------|
| `hebun_media_store.py` | The service. Python 3.12 standard library only. |
| `hebun-media-store.service` | systemd unit (hardened, non-root, loopback bind). |
| `test_hebun_media_store.py` | 22 tests; real server on an ephemeral port, throwaway secrets. |
| `signing-vectors.json` | Throwaway HMAC vectors shared with the TypeScript adapter test. |
| `Caddyfile` | HTTPS ingress for `media.hebuntech.com` → `127.0.0.1:8787` (store routes only). |

## Protocol

| Verb | Path | Auth |
|------|------|------|
| put | `PUT /v1/objects/tenants/<uuid>/media/<uuid>` | write HMAC |
| verify | `GET /v1/verify/tenants/<uuid>/media/<uuid>` | write HMAC |
| read | `GET /v1/read/tenants/<uuid>/media/<uuid>?ct=&exp=&sig=` | read HMAC, expiry ≤ 300s |
| health | `GET /healthz` | none, returns only `{"status":"ok"}` |

Write canonical string (HMAC-SHA256, write secret), joined by `\n`:
`HEBUN-MEDIA-WRITE-V1, method, key, timestamp, nonce, sha256Hex, contentType, contentLength`.
Headers: `X-Hebun-Timestamp`, `X-Hebun-Nonce` (32–64 hex), `X-Hebun-Signature`,
`X-Hebun-Content-SHA256`. Verify signs empty digest/type and length `0`.

Read canonical string (HMAC-SHA256, read secret): `HEBUN-MEDIA-READ-V1, key, contentType, expires`.

Refusals: `400` invalid key, `401` unauthorized (stale/future/pre-start timestamp, reused nonce, bad
signature), `403` bad/expired read grant, `409` key exists, `411` no length, `413` > 20 MiB,
`415` type not png/jpeg/webp, `422` digest mismatch, `507` free space below threshold.

## Controls

- Canonical key regex; no other path reaches the filesystem.
- Every directory component opened `O_NOFOLLOW` relative to its parent fd; object opened `O_NOFOLLOW`.
- Write: temp file `O_EXCL` → streamed SHA-256 + size check → `fsync` → `chmod 0440` →
  `link()` (never replaces) → unlink temp → `fsync` dir. Write-once and atomic.
- Nonce single-use inside ±60s; requests signed before process start refused (restart-safe).
- Free-space floor (`HEBUN_MEDIA_STORE_MIN_FREE_BYTES`, unit sets 5 GiB).
- Read responses: `nosniff`, `Cache-Control: private, no-store`, `CSP: default-src 'none'; sandbox`,
  `Referrer-Policy: no-referrer`. No listing, no static root, no delete verb.
- Logs record method, route segment and status only. Never a key, query string or signature.
- Missing/short/equal secrets or bad root: process refuses to start.

## Host layout (as installed 2026-09-17)

| Path | Owner | Mode |
|------|-------|------|
| `/opt/hebun-media-store/hebun_media_store.py` | root:root | 0644 |
| `/etc/hebun-media-store/` | root:hebun-media | 0750 |
| `/etc/hebun-media-store/env` (two secrets) | root:hebun-media | 0640 |
| `/var/lib/hebun-media` (storage root) | hebun-media:hebun-media | 0700 |
| `/etc/systemd/system/hebun-media-store.service` | root:root | 0644 |

Service account `hebun-media` (system, nologin, no home). Listens on `127.0.0.1:8787` only.
Firewall: ufw default deny incoming, allow outgoing, allow `22/tcp`, `80/tcp`, `443/tcp`.

## HTTPS ingress (as installed 2026-09-17)

- DNS: `media.hebuntech.com A 31.97.33.174` in Vercel DNS (record `rec_2ec37b5b1e4d52b59436e655`). No
  AAAA record: IPv4 only.
- Caddy `2.6.2-6ubuntu0.24.04.3` from the Ubuntu archive (no third-party apt source), `/etc/caddy/Caddyfile`
  = this repo's `Caddyfile`. Let's Encrypt certificate, automatic renewal. Admin API on `127.0.0.1:2019`.
- The proxy forwards only `GET|PUT /v1/(objects|verify|read)/tenants/<uuid>/media/<uuid>`, caps
  bodies at 20 MiB, writes no access log, and answers 404 to everything else (including `/healthz`).
  Port 80 only redirects to HTTPS (308) and serves ACME challenges.
- It adds and removes no authentication. HMAC decisions stay in the store.

## Not yet in place (Director gate)

- **Vercel configuration.** `HEBUN_MEDIA_STORE_ORIGIN`, `HEBUN_MEDIA_STORE_WRITE_SECRET`,
  `HEBUN_MEDIA_STORE_READ_SECRET` are not set anywhere. Until all three are, production answers
  `storage-not-connected`; a partial set answers `storage-misconfigured`.

## Backup truth

Bytes are durable on the VPS ext4 filesystem (fsync'd). **They are not backed up.** Hostinger
daily backup is not enabled, and no independent backup or restore has been built or tested.
Storage acceptance is not backup acceptance. Loss of the VPS disk loses every stored object;
`media_assets` rows would then answer `object-absent`.

## Rotating secrets

Regenerate `/etc/hebun-media-store/env`, `systemctl restart hebun-media-store`, update the two Vercel
variables, redeploy. Read grants signed with the old read secret stop working immediately (they
expire within 300s anyway).
