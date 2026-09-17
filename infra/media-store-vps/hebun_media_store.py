#!/usr/bin/env python3
"""
hebun_media_store.py — the Hebun VPS media byte store (transport/storage adapter, NOT an authority).

WHAT THIS PROCESS IS
    The far side of the `MediaObjectStore` port's VPS adapter. It keeps bytes on the dedicated Hebun
    VPS filesystem and answers exactly the three verbs the port defines:

        PUT  /v1/objects/<key>      write-once, digest- and size-verified, atomic
        GET  /v1/verify/<key>       {"status":"present","byteSize":N,"sha256Hex":H} | {"status":"absent"}
        GET  /v1/read/<key>?ct=&exp=&sig=
                                    short-lived signed browser read

WHAT THIS PROCESS IS NOT
    It owns no media lifecycle, no tenant authority, no Governance, no generation, no publishing and no
    permit. Neon `media_assets` is authoritative for asset identity/provenance/lifecycle. This process
    cannot tell whether a key names an admitted asset — it stores what an authenticated caller wrote
    and refuses to overwrite it. There is no delete verb.

AUTHENTICATION (two secrets, two jobs, never shared)
    write secret   HMAC-SHA256 over a canonical request (method, key, timestamp, nonce, digest,
                   content type, length). Timestamp window +/-60s, nonce single-use inside the window,
                   and any request signed before this process started is refused, so a restart does
                   not reopen the replay window. Used for PUT and verify (server-to-server only).
    read secret    HMAC-SHA256 over (key, content type, expiry). Expiry must be in the future and at
                   most READ_MAX_TTL_SECONDS ahead. A leaked read-signing key cannot write.

FAIL CLOSED
    Missing/short/equal secrets or a missing storage root: the process exits non-zero at startup.

Python standard library only. No third-party dependency is installed on the VPS.
"""

from __future__ import annotations

import errno
import hashlib
import hmac
import json
import os
import re
import stat
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit

MAX_BYTE_SIZE = 20 * 1024 * 1024
ALLOWED_CONTENT_TYPES = frozenset({"image/png", "image/jpeg", "image/webp"})
CLOCK_SKEW_SECONDS = 60
READ_MAX_TTL_SECONDS = 300
MIN_SECRET_LENGTH = 32
DEFAULT_MIN_FREE_BYTES = 2 * 1024 * 1024 * 1024
CHUNK = 64 * 1024

_UUID = r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
KEY_RE = re.compile(rf"^tenants/({_UUID})/media/({_UUID})$")
NONCE_RE = re.compile(r"^[0-9a-f]{32,64}$")
DIGEST_RE = re.compile(r"^[0-9a-f]{64}$")
SIG_RE = re.compile(r"^[0-9a-f]{64}$")
TS_RE = re.compile(r"^[0-9]{1,12}$")

WRITE_SCHEME = "HEBUN-MEDIA-WRITE-V1"
READ_SCHEME = "HEBUN-MEDIA-READ-V1"


def write_canonical(method: str, key: str, timestamp: str, nonce: str, sha256_hex: str,
                    content_type: str, content_length: int) -> bytes:
    return "\n".join([WRITE_SCHEME, method, key, timestamp, nonce, sha256_hex, content_type,
                      str(content_length)]).encode("utf-8")


def read_canonical(key: str, content_type: str, expires: str) -> bytes:
    return "\n".join([READ_SCHEME, key, content_type, expires]).encode("utf-8")


def sign(secret: bytes, canonical: bytes) -> str:
    return hmac.new(secret, canonical, hashlib.sha256).hexdigest()


class Config:
    def __init__(self, root: str, write_secret: bytes, read_secret: bytes, min_free_bytes: int,
                 clock=time.time):
        self.root = root
        self.write_secret = write_secret
        self.read_secret = read_secret
        self.min_free_bytes = min_free_bytes
        self.clock = clock


def load_config(env) -> Config:
    """Every problem is fatal. An unconfigured store is closed, never open."""
    root = env.get("HEBUN_MEDIA_STORE_ROOT", "").strip()
    write_secret = env.get("HEBUN_MEDIA_STORE_WRITE_SECRET", "")
    read_secret = env.get("HEBUN_MEDIA_STORE_READ_SECRET", "")
    problems = []
    if not root or not os.path.isabs(root):
        problems.append("HEBUN_MEDIA_STORE_ROOT must be an absolute path")
    elif not os.path.isdir(root) or os.path.islink(root):
        problems.append("HEBUN_MEDIA_STORE_ROOT must be an existing, non-symlink directory")
    if len(write_secret) < MIN_SECRET_LENGTH:
        problems.append("HEBUN_MEDIA_STORE_WRITE_SECRET missing or too short")
    if len(read_secret) < MIN_SECRET_LENGTH:
        problems.append("HEBUN_MEDIA_STORE_READ_SECRET missing or too short")
    if write_secret and write_secret == read_secret:
        problems.append("write and read secrets must differ")
    try:
        min_free = int(env.get("HEBUN_MEDIA_STORE_MIN_FREE_BYTES", str(DEFAULT_MIN_FREE_BYTES)))
        if min_free < 0:
            raise ValueError
    except ValueError:
        problems.append("HEBUN_MEDIA_STORE_MIN_FREE_BYTES must be a non-negative integer")
        min_free = DEFAULT_MIN_FREE_BYTES
    if problems:
        # Names of the problems only. Never a secret value.
        raise SystemExit("hebun-media-store refuses to start: " + "; ".join(problems))
    return Config(root, write_secret.encode("utf-8"), read_secret.encode("utf-8"), min_free)


class NonceCache:
    def __init__(self):
        self._seen: dict[str, float] = {}
        self._lock = threading.Lock()

    def claim(self, nonce: str, now: float) -> bool:
        with self._lock:
            horizon = now - 2 * CLOCK_SKEW_SECONDS - 1
            if len(self._seen) > 4096:
                self._seen = {n: t for n, t in self._seen.items() if t > horizon}
            if nonce in self._seen and self._seen[nonce] > horizon:
                return False
            self._seen[nonce] = now
            return True


# ── Filesystem: every directory component is opened O_NOFOLLOW relative to its parent fd ─────────

_DIR_FLAGS = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | getattr(os, "O_CLOEXEC", 0)


def _open_object_dir(root: str, tenant_id: str, create: bool) -> int | None:
    """Return an fd for <root>/tenants/<tenant>/media, refusing any symlinked component."""
    fd = os.open(root, _DIR_FLAGS)
    try:
        for component in ("tenants", tenant_id, "media"):
            if create:
                try:
                    os.mkdir(component, 0o700, dir_fd=fd)
                except FileExistsError:
                    pass
            try:
                child = os.open(component, _DIR_FLAGS, dir_fd=fd)
            except FileNotFoundError:
                if create:
                    raise
                os.close(fd)
                return None
            os.close(fd)
            fd = child
        return fd
    except BaseException:
        os.close(fd)
        raise


def _open_object_file(root: str, key: str) -> tuple[int, os.stat_result] | None:
    m = KEY_RE.match(key)
    if not m:
        return None
    dir_fd = _open_object_dir(root, m.group(1), create=False)
    if dir_fd is None:
        return None
    try:
        try:
            fd = os.open(m.group(2), os.O_RDONLY | os.O_NOFOLLOW | getattr(os, "O_CLOEXEC", 0), dir_fd=dir_fd)
        except FileNotFoundError:
            return None
        except OSError as e:
            if e.errno == errno.ELOOP:  # the object name is a symlink: never followed, never served
                return None
            raise
        st = os.fstat(fd)
        if not stat.S_ISREG(st.st_mode):
            os.close(fd)
            return None
        return fd, st
    finally:
        os.close(dir_fd)


class StoreError(Exception):
    def __init__(self, status: int, code: str):
        super().__init__(code)
        self.status = status
        self.code = code


def verify_object(root: str, key: str) -> dict:
    opened = _open_object_file(root, key)
    if opened is None:
        return {"status": "absent"}
    fd, st = opened
    digest = hashlib.sha256()
    size = 0
    with os.fdopen(fd, "rb") as f:
        while True:
            chunk = f.read(CHUNK)
            if not chunk:
                break
            digest.update(chunk)
            size += len(chunk)
    return {"status": "present", "byteSize": size, "sha256Hex": digest.hexdigest()}


def put_object(config: Config, key: str, content_type: str, content_length: int, sha256_hex: str,
               body) -> None:
    m = KEY_RE.match(key)
    if not m:
        raise StoreError(400, "invalid-key")
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise StoreError(415, "content-type-refused")
    if content_length < 1 or content_length > MAX_BYTE_SIZE:
        raise StoreError(413, "size-refused")
    if not DIGEST_RE.match(sha256_hex):
        raise StoreError(400, "invalid-digest")

    vfs = os.statvfs(config.root)
    if vfs.f_bavail * vfs.f_frsize - content_length < config.min_free_bytes:
        raise StoreError(507, "insufficient-storage")

    dir_fd = _open_object_dir(config.root, m.group(1), create=True)
    try:
        asset_id = m.group(2)
        try:
            os.stat(asset_id, dir_fd=dir_fd, follow_symlinks=False)
            raise StoreError(409, "key-exists")
        except FileNotFoundError:
            pass

        tmp_name = f".tmp-{asset_id}-{os.urandom(8).hex()}"
        tmp_fd = os.open(tmp_name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW
                         | getattr(os, "O_CLOEXEC", 0), 0o600, dir_fd=dir_fd)
        linked = False
        try:
            digest = hashlib.sha256()
            remaining = content_length
            while remaining > 0:
                chunk = body.read(min(CHUNK, remaining))
                if not chunk:
                    raise StoreError(400, "body-truncated")
                digest.update(chunk)
                os.write(tmp_fd, chunk)
                remaining -= len(chunk)
            if not hmac.compare_digest(digest.hexdigest(), sha256_hex):
                raise StoreError(422, "digest-mismatch")
            os.fsync(tmp_fd)
            os.fchmod(tmp_fd, 0o440)
            try:
                # link() never replaces an existing name: the atomic write-once step.
                os.link(tmp_name, asset_id, src_dir_fd=dir_fd, dst_dir_fd=dir_fd, follow_symlinks=False)
                linked = True
            except FileExistsError:
                raise StoreError(409, "key-exists")
        finally:
            os.close(tmp_fd)
            try:
                os.unlink(tmp_name, dir_fd=dir_fd)
            except FileNotFoundError:
                pass
        if linked:
            os.fsync(dir_fd)
    finally:
        os.close(dir_fd)


class _CountingReader:
    def __init__(self, raw):
        self.raw = raw
        self.count = 0

    def read(self, n):
        chunk = self.raw.read(n)
        self.count += len(chunk)
        return chunk


# ── HTTP ─────────────────────────────────────────────────────────────────────────────────────────

def make_handler(config: Config, started_at: float, nonces: NonceCache):
    class Handler(BaseHTTPRequestHandler):
        server_version = "hebun-media-store"
        sys_version = ""
        protocol_version = "HTTP/1.1"
        timeout = 30

        def log_message(self, fmt, *args):  # never the query string (it carries a signature)
            return

        def log_request(self, code="-", size="-"):
            route = urlsplit(self.path).path.split("/")[2] if self.path.count("/") >= 2 else "-"
            sys.stderr.write(f"{self.command} {route} {code}\n")

        _unread_body = 0
        MAX_DRAIN = 1024 * 1024

        def _send(self, status: int, payload: dict | None = None):
            # A refused small body is drained so closing the socket does not reset the response away.
            if 0 < self._unread_body <= self.MAX_DRAIN:
                try:
                    self.rfile.read(self._unread_body)
                except OSError:
                    pass
            self._unread_body = 0
            body = json.dumps(payload or {}).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Connection", "close")
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(body)
            self.close_connection = True

        def _authorize_write(self, method: str, key: str, sha: str, ctype: str, length: int) -> bool:
            ts = self.headers.get("X-Hebun-Timestamp", "")
            nonce = self.headers.get("X-Hebun-Nonce", "")
            sig = self.headers.get("X-Hebun-Signature", "")
            if not (TS_RE.match(ts) and NONCE_RE.match(nonce) and SIG_RE.match(sig)):
                return False
            now = config.clock()
            t = int(ts)
            if abs(now - t) > CLOCK_SKEW_SECONDS or t < int(started_at):
                return False
            expected = sign(config.write_secret, write_canonical(method, key, ts, nonce, sha, ctype, length))
            if not hmac.compare_digest(expected, sig):
                return False
            # Claimed only after the signature holds, so an attacker cannot burn legitimate nonces.
            return nonces.claim(nonce, now)

        def do_PUT(self):
            parts = urlsplit(self.path)
            if not parts.path.startswith("/v1/objects/") or parts.query:
                return self._send(404, {"error": "not-found"})
            key = parts.path[len("/v1/objects/"):]
            if self.headers.get("Transfer-Encoding"):
                return self._send(411, {"error": "length-required"})
            length_header = self.headers.get("Content-Length", "")
            if not length_header.isdigit():
                return self._send(411, {"error": "length-required"})
            length = int(length_header)
            self._unread_body = length
            ctype = self.headers.get("Content-Type", "")
            sha = self.headers.get("X-Hebun-Content-SHA256", "")
            if not KEY_RE.match(key):
                return self._send(400, {"error": "invalid-key"})
            if not self._authorize_write("PUT", key, sha, ctype, length):
                return self._send(401, {"error": "unauthorized"})
            reader = _CountingReader(self.rfile)
            try:
                put_object(config, key, ctype, length, sha, reader)
            except StoreError as e:
                self._unread_body = length - reader.count
                return self._send(e.status, {"error": e.code})
            except OSError as e:
                self._unread_body = length - reader.count
                code = "symlink-refused" if e.errno in (errno.ELOOP, errno.ENOTDIR) else "storage-error"
                return self._send(500, {"error": code})
            self._unread_body = 0
            return self._send(201, {"status": "stored"})

        def do_GET(self):
            parts = urlsplit(self.path)
            if parts.path == "/healthz" and not parts.query:
                return self._send(200, {"status": "ok"})
            if parts.path.startswith("/v1/verify/"):
                key = parts.path[len("/v1/verify/"):]
                if parts.query or not KEY_RE.match(key):
                    return self._send(400, {"error": "invalid-key"})
                if not self._authorize_write("GET", key, "", "", 0):
                    return self._send(401, {"error": "unauthorized"})
                try:
                    return self._send(200, verify_object(config.root, key))
                except OSError:
                    return self._send(500, {"error": "storage-error"})
            if parts.path.startswith("/v1/read/"):
                return self._read(parts)
            return self._send(404, {"error": "not-found"})

        def _read(self, parts):
            key = parts.path[len("/v1/read/"):]
            q = parse_qs(parts.query, keep_blank_values=True, strict_parsing=False)
            ctype = (q.get("ct") or [""])[0]
            exp = (q.get("exp") or [""])[0]
            sig = (q.get("sig") or [""])[0]
            if (not KEY_RE.match(key) or ctype not in ALLOWED_CONTENT_TYPES or not TS_RE.match(exp)
                    or not SIG_RE.match(sig) or any(len(v) != 1 for v in q.values())
                    or set(q.keys()) != {"ct", "exp", "sig"}):
                return self._send(403, {"error": "forbidden"})
            now = config.clock()
            e = int(exp)
            if e <= now or e > now + READ_MAX_TTL_SECONDS:
                return self._send(403, {"error": "forbidden"})
            expected = sign(config.read_secret, read_canonical(key, ctype, exp))
            if not hmac.compare_digest(expected, sig):
                return self._send(403, {"error": "forbidden"})
            try:
                opened = _open_object_file(config.root, key)
            except OSError:
                opened = None
            if opened is None:
                return self._send(404, {"error": "not-found"})
            fd, st = opened
            with os.fdopen(fd, "rb") as f:
                self.send_response(200)
                self.send_header("Content-Type", ctype)
                self.send_header("Content-Length", str(st.st_size))
                self.send_header("Cache-Control", "private, no-store")
                self.send_header("X-Content-Type-Options", "nosniff")
                self.send_header("Content-Disposition", "inline")
                self.send_header("Content-Security-Policy", "default-src 'none'; sandbox")
                self.send_header("Referrer-Policy", "no-referrer")
                self.send_header("Connection", "close")
                self.end_headers()
                while True:
                    chunk = f.read(CHUNK)
                    if not chunk:
                        break
                    self.wfile.write(chunk)
            self.close_connection = True

        def do_POST(self):
            self._send(405, {"error": "method-not-allowed"})

        do_DELETE = do_POST
        do_PATCH = do_POST

    return Handler


def build_server(config: Config, host: str, port: int) -> ThreadingHTTPServer:
    started_at = config.clock()
    server = ThreadingHTTPServer((host, port), make_handler(config, started_at, NonceCache()))
    server.daemon_threads = True
    return server


def main() -> None:
    config = load_config(os.environ)
    host = os.environ.get("HEBUN_MEDIA_STORE_BIND", "127.0.0.1")
    port = int(os.environ.get("HEBUN_MEDIA_STORE_PORT", "8787"))
    os.umask(0o077)
    server = build_server(config, host, port)
    bound_host, bound_port = server.server_address[:2]
    sys.stderr.write(f"hebun-media-store listening on {bound_host}:{bound_port}\n")
    sys.stderr.flush()
    server.serve_forever()


if __name__ == "__main__":
    main()
