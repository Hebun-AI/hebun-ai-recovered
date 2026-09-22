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
SSH on that port is key-only since 2026-09-18 — see *SSH access* below.

## SSH access (VPS-SEC-1, hardened 2026-09-18)

**Key-only. No password authentication anywhere, and no direct root SSH.**

| Setting (`sshd -T`, effective) | Value |
|---|---|
| `permitrootlogin` | **no** |
| `passwordauthentication` | **no** |
| `kbdinteractiveauthentication` | **no** |
| `pubkeyauthentication` | yes |
| `permitemptypasswords` | no |
| `port` | 22 |

Administration is `hebun-admin` (uid 1000, groups `hebun-admin sudo users`), password **locked** —
it authenticates by key only. `sudo` is `NOPASSWD` via `/etc/sudoers.d/90-hebun-admin` (0440),
because an account with no password cannot answer a sudo prompt; this preserves exactly the
capability root-by-key had before, and removes password auth and direct root login. Its
`authorized_keys` carries the same Director key that was previously on root — no key was created,
copied or rotated.

Configuration lives in **`/etc/ssh/sshd_config.d/10-hebun-hardening.conf`** (0644). The number is
load-bearing: `/etc/ssh/sshd_config` line 12 includes `sshd_config.d/*.conf`, **sshd takes the first
value it obtains for a keyword**, and the image ships `50-cloud-init.conf` with
`PasswordAuthentication yes` (which already overrode `60-cloudimg-settings.conf`). A conventionally
numbered `99-` file would be silently ignored. Any future SSH change must sort before `50-`.

`ssh.socket` is the enabled unit (socket activation), so `ssh.service` reads `enabled=disabled` and
each connection spawns a fresh sshd. Config changes therefore apply to new connections on
`systemctl reload ssh`, without a host restart and without dropping live sessions.

**`root` keeps a usable password on purpose.** It is unreachable over SSH, and it is the Hostinger
console rescue path — the out-of-band recovery that makes locking down SSH safe. Locking it would
remove the safety net. This does mean Hostinger panel security is part of the SSH threat model.

### fail2ban

`fail2ban 1.0.2-3ubuntu0.1`, enabled and active, with **one** jail and no other security machinery:
`/etc/fail2ban/jail.d/hebun-sshd.conf` — `[sshd]`, `backend = systemd`, `maxretry 5`,
`findtime 10m`, `bantime 1h`.

Its security contribution after key-only hardening is small: a password brute force cannot succeed.
It earns its place on measured churn — **3,557 failed SSH authentications since boot** before
hardening, each spawning an sshd under socket activation.

**Operational warning, learned the hard way.** Deliberately testing refused logins produces exactly
the failures this jail bans on, and the operator's own address is not exempt. During VPS-SEC-1 the
acceptance tests for "root refused" and "password refused" banned the operator for the full hour.
Normal use never trips it, because successful key logins are not failures. **Stop fail2ban before
any future negative SSH testing, or test from an address you can afford to lose.**

## HTTPS ingress (as installed 2026-09-17)

- DNS: `media.hebuntech.com A 31.97.33.174` in Vercel DNS (record `rec_2ec37b5b1e4d52b59436e655`). No
  AAAA record: IPv4 only.
- Caddy `2.6.2-6ubuntu0.24.04.3` from the Ubuntu archive (no third-party apt source), `/etc/caddy/Caddyfile`
  = this repo's `Caddyfile`. Let's Encrypt certificate, automatic renewal. Admin API on `127.0.0.1:2019`.
- The proxy forwards only `GET|PUT /v1/(objects|verify|read)/tenants/<uuid>/media/<uuid>`, caps
  bodies at 20 MiB, writes no access log, and answers 404 to everything else (including `/healthz`).
  Port 80 only redirects to HTTPS (308) and serves ACME challenges.
- It adds and removes no authentication. HMAC decisions stay in the store.

## Vercel configuration (in place since MEDIA-1 production acceptance)

`HEBUN_MEDIA_STORE_ORIGIN`, `HEBUN_MEDIA_STORE_WRITE_SECRET` and `HEBUN_MEDIA_STORE_READ_SECRET`
are **all three set on the production target**, verified by listing the project's environment
variable NAMES — values are Vercel-sensitive and were never read. Until all three are set production
answers `storage-not-connected`, and a partial set answers `storage-misconfigured`; neither applies.

*(This section previously said they were unset. That was written before the MEDIA-1 acceptance
configured them and was never corrected; the storage acceptance ingress has been reaching the store
from the deployed runtime ever since.)*

## Backup truth

Bytes are durable on the VPS ext4 filesystem (fsync'd). **They are not backed up.** Hostinger
daily backup is not enabled, and no independent backup or restore has been built or tested.
Storage acceptance is not backup acceptance. Loss of the VPS disk loses every stored object;
`media_assets` rows would then answer `object-absent`.

## Rotating secrets

Regenerate `/etc/hebun-media-store/env`, `systemctl restart hebun-media-store`, update the two Vercel
variables, redeploy. Read grants signed with the old read secret stop working immediately (they
expire within 300s anyway).
