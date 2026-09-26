#!/usr/bin/env python3
"""
MV-5 DERIVE-V1 production READINESS probe. Run ON THE VPS: sudo python3 mv5_derive_readiness.py
Proves the deployed store answers DERIVE-V1 and its WRITE routes are alive and closed, WITHOUT running
ffmpeg and WITHOUT writing any object: every signed request below is refused before any file is
opened (unknown derivation, cross-tenant, source == destination). The write secret stays on the host.
"""
import hashlib, hmac, os, secrets, subprocess, sys, time, urllib.request, urllib.error

O = os.environ.get("MV5_ORIGIN", "https://media.hebuntech.com")
STORE_ROOT = os.environ.get("MV5_ROOT", "/var/lib/hebun-media")
ROOT = os.path.join(STORE_ROOT, "tenants")
TRH = "9947c78e-2080-4331-81c6-456cb4be7a96"
VIDEO = f"tenants/{TRH}/media/99a0bf52-1117-488b-923d-71085090a921"
DEST = f"tenants/{TRH}/media/00000000-0000-4000-8000-00000000d5e5"
OTHER = "tenants/00000000-0000-4000-8000-0000000000aa/media/00000000-0000-4000-8000-00000000d5e5"
env = dict(l.strip().split("=", 1) for l in open(os.environ.get("MV5_ENV_FILE", "/etc/hebun-media-store/env")) if "=" in l)
WS = env["HEBUN_MEDIA_STORE_WRITE_SECRET"].strip().strip("\"'").encode()
ok = True


def check(cond, label, detail=""):
    global ok
    ok &= bool(cond)
    print(("PASS " if cond else "FAIL ") + label + (f"  — {detail}" if detail else ""), flush=True)


def objects():
    out = subprocess.run(["find", ROOT, "-type", "f"], capture_output=True, text=True).stdout.split()
    return sorted(p for p in out if not os.path.basename(p).startswith(".tmp-")), [p for p in out if os.path.basename(p).startswith(".tmp-")]


def call(method, path, headers):
    req = urllib.request.Request(O + path, method=method, data=b"" if method in ("POST", "PUT") else None, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


def derive_grant(dest, source, derivation):
    ts = str(int(time.time())); exp = str(int(time.time()) + 60); n = secrets.token_hex(16)
    canon = "\n".join(["HEBUN-MEDIA-DERIVE-V1", "POST", dest, source, derivation, ts, n, exp]).encode()
    return {"X-Hebun-Timestamp": ts, "X-Hebun-Nonce": n, "X-Hebun-Expires": exp, "X-Hebun-Source-Key": source,
            "X-Hebun-Derivation": derivation, "X-Hebun-Signature": hmac.new(WS, canon, hashlib.sha256).hexdigest(),
            "Content-Length": "0"}


before, temps = objects()
print(f"objects before: {len(before)}  temps: {len(temps)}")

# Contract (same as WRITE-V1/V2, README "MV-5 — DERIVE-V1"): framing and key SYNTAX are refused before
# authentication with 400 invalid-key; existence, tenancy and the derivation set only after the signature.
s, b = call("POST", f"/v2/derive/{DEST}", {"Content-Length": "0", "X-Hebun-Source-Key": VIDEO, "X-Hebun-Derivation": "mp4-normalize-v1"})
check((s, b.strip()) == (401, b'{"error": "unauthorized"}'), "DERIVE-V1 is deployed and refuses an unsigned request with canonical keys", f"{s} {b[:60]!r}")
s, b = call("POST", f"/v2/derive/{OTHER}", {"Content-Length": "0", "X-Hebun-Source-Key": VIDEO, "X-Hebun-Derivation": "x-unknown"})
check((s, b.strip()) == (401, b'{"error": "unauthorized"}'), "unsigned: no tenancy or derivation-set answer before auth", f"{s} {b[:60]!r}")
s, b = call("POST", f"/v2/derive/{DEST}", {"Content-Length": "0"})
check((s, b.strip()) == (400, b'{"error": "invalid-key"}'), "unsigned without a source key: syntax refusal only (documented)", f"{s} {b[:60]!r}")
s, b = call("POST", f"/v2/derive/{DEST}", derive_grant(DEST, VIDEO, "x-unknown"))
check((s, b.strip()) == (400, b'{"error": "derivation-unknown"}'), "a signed unknown derivation is refused (closed set)", f"{s} {b!r}")
s, b = call("POST", f"/v2/derive/{OTHER}", derive_grant(OTHER, VIDEO, "mp4-normalize-v1"))
check((s, b.strip()) == (403, b'{"error": "cross-tenant-refused"}'), "a signed cross-tenant derive is refused", f"{s} {b!r}")
s, b = call("POST", f"/v2/derive/{VIDEO}", derive_grant(VIDEO, VIDEO, "mp4-normalize-v1"))
check((s, b.strip()) == (400, b'{"error": "source-is-destination"}'), "a signed source==destination derive is refused", f"{s} {b!r}")
s, b = call("POST", f"/v2/derive/{DEST}?x=1", {"Content-Length": "0"})
check(s in (404, 405), "a derive with a query string never reaches the handler", str(s))
s, b = call("PUT", f"/v1/objects/{DEST}", {"Content-Type": "image/png", "Content-Length": "0"})
check(s == 401, "WRITE-V1 route alive and closed to unsigned writes", str(s))
s, b = call("PUT", f"/v2/objects/{DEST}", {"Content-Type": "video/mp4", "Content-Length": "0", "X-Hebun-Timestamp": "1",
                                           "X-Hebun-Nonce": "0" * 32, "X-Hebun-Signature": "0" * 64, "X-Hebun-Expires": "2",
                                           "X-Hebun-Max-Bytes": "1", "X-Hebun-Expected-Length": "", "X-Hebun-Probe": "none"})
check(s == 401, "WRITE-V2 route alive and closed to a forged grant", str(s))
if O.startswith("https://"):  # through Caddy only
    s, b = call("GET", "/healthz", {})
    check(s == 404, "healthz is not exposed publicly", str(s))

after, temps_after = objects()
check(after == before, "no object was created", f"{len(before)} -> {len(after)}")
check(temps_after == [], "no temp file left")
check(not os.path.exists(os.path.join(STORE_ROOT, DEST)), "the probe destination does not exist")
print("DERIVE READINESS", "ALL PASS" if ok else "FAILED", flush=True)
sys.exit(0 if ok else 1)
