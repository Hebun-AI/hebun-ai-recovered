# Hebun VPS Media Storage — Implementation + HTTPS Ingress Gate

Date: 2026-09-17. Base: `origin/main = add0ceb5`. Branch: `feat/media-vps-storage`.

| Label | State |
|-------|-------|
| IMPLEMENTED | yes — adapter, resolver, VPS store, systemd unit, Caddy ingress |
| VERIFIED | yes — local suites, VPS loopback, real HTTPS from outside |
| HTTPS-REACHABLE | yes — `https://media.hebuntech.com`, valid Let's Encrypt certificate |
| CONNECTED | **no** — no Vercel variables; production resolves `storage-not-connected` |
| PRODUCTION-ACCEPTED | **no** |
| BACKED UP | **no** |

## Architecture (preserved)

```
Media Asset Authority → MediaObjectStore → VPS adapter → https://media.hebuntech.com (Caddy)
                      → 127.0.0.1:8787 hebun-media-store → /var/lib/hebun-media
```

- Authority unchanged: preflight, admission, `media_assets` insert, reads, retirement, Governance.
- Adapter `src/features/media-assets/vps-media-object-store.server.ts` (backend `hebun-vps`).
- Resolver `media-storage.server.ts` selects it only when all three variables are valid.
- VPS store `infra/media-store-vps/hebun_media_store.py`: bytes only, no authority, no delete.
- Caddy terminates TLS and forwards only the three store routes. It adds and removes no authentication.
- No schema change, no migration: `media_assets_storage_backend_chk` is `^[a-z0-9-]{1,32}$`.
  An S3 adapter later changes only the resolver.

## Configuration contract (fail closed)

| State | Resolution |
|-------|-----------|
| none of `HEBUN_MEDIA_STORE_ORIGIN / _WRITE_SECRET / _READ_SECRET` | `unavailable / storage-not-connected` |
| any set but incomplete or invalid (non-https, path/query/credentials, secret < 32, equal secrets) | `unavailable / storage-misconfigured` |
| all valid | `available`, backend `hebun-vps` |

## Authentication

Extends the existing per-ingress shared-secret pattern instead of adding an authorization system:

- **Write secret** (server → store): HMAC-SHA256 over method, key, timestamp, nonce, digest, content
  type, length. ±60s window, nonce single-use, requests signed before service start refused.
- **Read secret** (browser grants): HMAC-SHA256 over key, content type, expiry. Expiry ≤ 300s;
  the authority requests 60s. Cannot write. Never persisted or logged.

## Infrastructure state

- DNS authority verified: `hebuntech.com` NS = `ns1/ns2.vercel-dns.com`, domain under Vercel scope
  `hebuntechs-projects`. One record added: `media A 31.97.33.174`. Before/after diff of the full record
  list shows exactly that line; apex, `www`, MX, SPF, DKIM, `_vercel` TXT unchanged. No AAAA answer.
- VPS: service account `hebun-media`; root `/var/lib/hebun-media` (0700, **empty**); secrets
  `/etc/hebun-media-store/env` (0640 root:hebun-media, generated on the VPS, never displayed);
  `hebun-media-store.service` enabled on `127.0.0.1:8787`; Caddy 2.6.2 (Ubuntu archive) enabled;
  ufw deny incoming, allow `22,80,443/tcp`. From outside, `8787` and `2019` time out.
- Certificate: `CN=media.hebuntech.com`, issuer Let's Encrypt YE2, valid to 2026-12-16, auto-renewed.

## Verified

- Python store: 22 tests (macOS and on the VPS).
- TS contract suite against the real store process; MEDIA-1 Postgres section 15 (real Postgres + real
  store); 16 bite proofs + MEDIA-1 P16. Full suite 790/790, `tsc` 0, lint 0 errors, `next build` green.
- VPS loopback acceptance (earlier): restart, `kill -9`, reboot persistence.
- **HTTPS acceptance from outside the VPS**, production service temporarily running TEST credentials:
  unsigned PUT 401; unsigned verify 401; wrong write secret 401; read secret used as write secret
  401; unsigned read 403; invalid-signature read 403; signed PUT 201 and verify with size + SHA-256;
  signed read 200 with exact bytes, `nosniff`, HSTS; write-once (identical and different bytes 409,
  original kept); wrong digest 422 with nothing stored; replayed nonce 401; stale timestamp 401;
  20 MiB + 1 byte 413; exactly 20 MiB 201; 2s grant 200 then 403 on the real clock; 86400s TTL
  clamped to ≤ 300s; extended expiry, swapped type, other-tenant key 403; tenant isolation; `/`,
  `/healthz`, listings, traversal, DELETE, POST all 404 at the proxy; plain http 308 to https.
- Reboot: Caddy and the store came back enabled and active; fixtures verified and read over HTTPS.
- Journals for Caddy and the store contained no signature, signature header, fixture key or secret.
- Cleanup: fixture objects removed, production root empty, production secrets restored (the original
  file moved back), and the test credentials are now refused (verify 401, read 403).

## Not available

- No Vercel variables. Production is not connected and still answers `storage-not-connected`.
- No production media bytes, no production `media_asset`, no generation invocation.
- Generation transport still `no-generation-provider`. No publishing.
- **Backup: none.** Bytes are durable on the VPS filesystem only. Independent backup/restore
  acceptance is OPEN. Storage acceptance must not be described as backup acceptance.
- Not changed, flagged: sshd `PermitRootLogin yes` and `PasswordAuthentication yes`.

## Next Director gates

1. Push `feat/media-vps-storage` and integrate to `main` (inert without configuration).
2. Set the three Vercel production variables (secrets piped from the VPS env file, never displayed),
   redeploy, and run production storage acceptance with fixture bytes — CONNECTED, then
   PRODUCTION-ACCEPTED.
3. Backup/restore design — separate gate.
