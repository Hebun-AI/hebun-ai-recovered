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
        HEAD /v1/read/<key>?ct=&exp=&sig=
                                    MV-1: same grant, same checks, headers only

    MV-1 (storage v2 foundation) adds, additively and without touching the v1 signatures:

        PUT  /v2/objects/<key>      streamed write-once. The caller does NOT know the digest: the
                                    store counts and hashes while it writes, and answers the measured
                                    {"byteSize","sha256Hex"} (+ probe facts when the grant asked).
        Range: bytes=a-b | a- | -n  on the v1 read (GET): one range, 206; bad/unsatisfiable, 416.

    MV-5 adds one transform, additively:

        POST /v2/derive/<dest key>  DERIVE-V1. Runs ONE closed, fixed-argument ffmpeg profile over an
                                    already-stored source object of the SAME tenant, writes the result
                                    temp-first and write-once under the destination key, ffprobes the
                                    stored result and answers the measured facts. The request carries
                                    only a source key, a destination key and a closed derivation name.
                                    It is execution, never admission: no `media_assets` row exists
                                    because of it, and the source is only ever opened read-only.

    A v2 success is technical custody, never Media admission. Video types are known to this file but
    INERT unless HEBUN_MEDIA_STORE_ENABLE_VIDEO=1, which the production unit does not set.

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
import subprocess
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
WRITE_V2_SCHEME = "HEBUN-MEDIA-WRITE-V2"

# MV-1. Known, never enabled by default. Only HEBUN_MEDIA_STORE_ENABLE_VIDEO=1 makes them writable or
# readable, and the production unit does not set it: video stays unavailable until a later gate.
VIDEO_CONTENT_TYPES = frozenset({"video/mp4"})
WRITE_V2_MAX_TTL_SECONDS = 600
LENGTH_RE = re.compile(r"^[0-9]{1,15}$")
RANGE_RE = re.compile(r"^bytes=([0-9]{0,15})-([0-9]{0,15})$")
CHUNK_LINE_MAX = 1024
PROBE_MODES = frozenset({"none", "required"})
PROBE_TIMEOUT_SECONDS = 10
PROBE_MAX_OUTPUT = 256 * 1024
DEFAULT_FFPROBE = "/usr/bin/ffprobe"
PROBE_FORMATS = "mov,mp4,m4a,3gp,3g2,mj2"
TEMP_PREFIX = ".tmp-"

# MV-5 — DERIVE-V1. A CLOSED set: the name selects a fixed argv below; nothing from the request ever
# reaches ffmpeg except two descriptors this process opened itself.
DERIVE_SCHEME = "HEBUN-MEDIA-DERIVE-V1"
DERIVATIONS = frozenset({"mp4-normalize-v1"})
DERIVATION_RE = re.compile(r"^[a-z0-9-]{1,40}$")
DEFAULT_FFMPEG = "/usr/bin/ffmpeg"
DERIVE_TIMEOUT_SECONDS = 90          # inside Caddy's 120 s write timeout
DERIVE_MAX_TTL_SECONDS = 600
# mp4-normalize-v1: H.264 (libx264, preset pinned) CRF 23, yuv420p, AAC 128k only when the source has
# audio, faststart, metadata/chapters/subtitles/data stripped, one thread. Never upscales: the box is
# min(1920, source); aspect ratio preserved; both dimensions forced even.
NORMALIZE_PRESET = "veryfast"
NORMALIZE_MAX_DIMENSION = 1920
NORMALIZE_FILTER = (
    f"scale=w='min({NORMALIZE_MAX_DIMENSION},iw)':h='min({NORMALIZE_MAX_DIMENSION},ih)'"
    ":force_original_aspect_ratio=decrease:force_divisible_by=2"
)
_derive_slot = threading.BoundedSemaphore(1)


def write_v2_canonical(key: str, timestamp: str, nonce: str, content_type: str, expected_length: str,
                       max_bytes: int, expires: str, probe: str) -> bytes:
    """No digest: the caller streams bytes it has not hashed, and the store measures them."""
    return "\n".join([WRITE_V2_SCHEME, "PUT", key, timestamp, nonce, content_type, expected_length,
                      str(max_bytes), expires, probe]).encode("utf-8")


def write_canonical(method: str, key: str, timestamp: str, nonce: str, sha256_hex: str,
                    content_type: str, content_length: int) -> bytes:
    return "\n".join([WRITE_SCHEME, method, key, timestamp, nonce, sha256_hex, content_type,
                      str(content_length)]).encode("utf-8")


def read_canonical(key: str, content_type: str, expires: str) -> bytes:
    return "\n".join([READ_SCHEME, key, content_type, expires]).encode("utf-8")


def derive_canonical(dest_key: str, source_key: str, derivation: str, timestamp: str, nonce: str,
                     expires: str) -> bytes:
    return "\n".join([DERIVE_SCHEME, "POST", dest_key, source_key, derivation, timestamp, nonce,
                      expires]).encode("utf-8")


def sign(secret: bytes, canonical: bytes) -> str:
    return hmac.new(secret, canonical, hashlib.sha256).hexdigest()


class Config:
    def __init__(self, root: str, write_secret: bytes, read_secret: bytes, min_free_bytes: int,
                 clock=time.time, v2_max_bytes: int = MAX_BYTE_SIZE, enable_video: bool = False,
                 ffprobe: str = DEFAULT_FFPROBE, ffmpeg: str = DEFAULT_FFMPEG,
                 derive_timeout: int = DERIVE_TIMEOUT_SECONDS):
        self.root = root
        self.write_secret = write_secret
        self.read_secret = read_secret
        self.min_free_bytes = min_free_bytes
        self.clock = clock
        self.v2_max_bytes = v2_max_bytes
        self.ffprobe = ffprobe
        self.ffmpeg = ffmpeg
        self.derive_timeout = derive_timeout
        self.enable_video = enable_video
        self.content_types = ALLOWED_CONTENT_TYPES | (VIDEO_CONTENT_TYPES if enable_video else frozenset())


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
    # MV-1. Unset means the v1 ceiling: no larger object is accepted until someone decides a number.
    try:
        v2_max = int(env.get("HEBUN_MEDIA_STORE_V2_MAX_BYTES", str(MAX_BYTE_SIZE)))
        if v2_max < 1:
            raise ValueError
    except ValueError:
        problems.append("HEBUN_MEDIA_STORE_V2_MAX_BYTES must be a positive integer")
        v2_max = MAX_BYTE_SIZE
    video = env.get("HEBUN_MEDIA_STORE_ENABLE_VIDEO", "")
    if video not in ("", "0", "1"):
        problems.append("HEBUN_MEDIA_STORE_ENABLE_VIDEO must be 0 or 1")
    ffprobe = env.get("HEBUN_MEDIA_STORE_FFPROBE", DEFAULT_FFPROBE)
    if not os.path.isabs(ffprobe):
        problems.append("HEBUN_MEDIA_STORE_FFPROBE must be an absolute path")
    ffmpeg = env.get("HEBUN_MEDIA_STORE_FFMPEG", DEFAULT_FFMPEG)
    if not os.path.isabs(ffmpeg):
        problems.append("HEBUN_MEDIA_STORE_FFMPEG must be an absolute path")
    if problems:
        # Names of the problems only. Never a secret value.
        raise SystemExit("hebun-media-store refuses to start: " + "; ".join(problems))
    return Config(root, write_secret.encode("utf-8"), read_secret.encode("utf-8"), min_free,
                  v2_max_bytes=v2_max, enable_video=video == "1", ffprobe=ffprobe, ffmpeg=ffmpeg)


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


# MV-3 read integrity. READ-V1 signs `ct`, but a signature only proves the SIGNER chose that type; the
# store keeps no MIME metadata of its own. The one type truth it has is the object's bytes, so a read
# is served only when the signed type agrees with the stored object's leading signature. No sidecar,
# no second authority, no database: the object is the authority for what it is.
_SNIFF_BYTES = 12


def object_matches_content_type(head: bytes, content_type: str) -> bool:
    if content_type == "image/png":
        return head[:8] == b"\x89PNG\r\n\x1a\n"
    if content_type == "image/jpeg":
        return head[:3] == b"\xff\xd8\xff"
    if content_type == "image/webp":
        return head[:4] == b"RIFF" and head[8:12] == b"WEBP"
    if content_type == "video/mp4":
        return head[4:8] == b"ftyp"
    return False


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


# ── MV-1: streamed write, probe, orphan temp cleanup ──────────────────────────────────────────────

def _finalize_once(dir_fd: int, tmp_name: str, asset_id: str) -> None:
    """link() never replaces an existing name: the atomic write-once step, shared shape with v1."""
    try:
        os.link(tmp_name, asset_id, src_dir_fd=dir_fd, dst_dir_fd=dir_fd, follow_symlinks=False)
    except FileExistsError:
        raise StoreError(409, "key-exists")
    os.fsync(dir_fd)


def put_object_stream(config: Config, key: str, content_type: str, expected: int | None,
                      max_bytes: int, probe_required: bool, chunks) -> dict:
    """
    Stream `chunks` into a private temp file while counting and hashing, then — only if every check
    holds — link it under its final write-once name. Nothing is visible under the key until then.
    Any refusal, truncation or probe failure unlinks the temp file and leaves the key absent.
    """
    m = KEY_RE.match(key)
    if not m:
        raise StoreError(400, "invalid-key")
    if content_type not in config.content_types:
        raise StoreError(415, "content-type-refused")
    if max_bytes < 1 or max_bytes > config.v2_max_bytes:
        raise StoreError(413, "size-refused")
    if expected is not None and (expected < 1 or expected > max_bytes):
        raise StoreError(413, "size-refused")

    reserve = expected if expected is not None else max_bytes
    vfs = os.statvfs(config.root)
    if vfs.f_bavail * vfs.f_frsize - reserve < config.min_free_bytes:
        raise StoreError(507, "insufficient-storage")

    dir_fd = _open_object_dir(config.root, m.group(1), create=True)
    try:
        asset_id = m.group(2)
        # Early refusal only; link() below is the authoritative write-once step.
        try:
            os.lstat(asset_id, dir_fd=dir_fd)
        except FileNotFoundError:
            pass
        else:
            raise StoreError(409, "key-exists")

        tmp_name = f"{TEMP_PREFIX}{asset_id}-{os.urandom(8).hex()}"
        tmp_fd = os.open(tmp_name, os.O_RDWR | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW
                         | getattr(os, "O_CLOEXEC", 0), 0o600, dir_fd=dir_fd)
        try:
            digest = hashlib.sha256()
            size = 0
            for chunk in chunks:
                size += len(chunk)
                if size > max_bytes or (expected is not None and size > expected):
                    raise StoreError(413, "size-exceeded")
                digest.update(chunk)
                view = memoryview(chunk)
                while view:
                    view = view[os.write(tmp_fd, view):]
            if size < 1:
                raise StoreError(400, "body-empty")
            if expected is not None and size != expected:
                raise StoreError(400, "size-mismatch")
            os.fsync(tmp_fd)
            probe = probe_local_fd(config, tmp_fd) if probe_required else None
            os.fchmod(tmp_fd, 0o440)
            _finalize_once(dir_fd, tmp_name, asset_id)
        finally:
            os.close(tmp_fd)
            try:
                os.unlink(tmp_name, dir_fd=dir_fd)
            except FileNotFoundError:
                pass
    finally:
        os.close(dir_fd)
    result = {"status": "stored", "byteSize": size, "sha256Hex": digest.hexdigest()}
    if probe is not None:
        result["probe"] = probe
    return result


_CODEC_RE = re.compile(r"^[a-z0-9_]{1,32}$")
_FORMAT_RE = re.compile(r"^[a-z0-9_,]{1,64}$")
_RATE_RE = re.compile(r"^[0-9]{1,9}/[0-9]{1,9}$")
_DURATION_RE = re.compile(r"^[0-9]{1,9}(\.[0-9]{1,9})?$")


def _bounded_int(value, low: int, high: int):
    return value if isinstance(value, int) and not isinstance(value, bool) and low <= value <= high else None


def parse_probe(raw: bytes) -> dict:
    """
    Allowlisted, bounded technical facts from ffprobe JSON. Everything not named here — tags, titles,
    encoder strings, file names, anything a file author controls as free text — is dropped.
    """
    try:
        doc = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, ValueError):
        raise StoreError(422, "probe-failed")
    if not isinstance(doc, dict) or not isinstance(doc.get("format"), dict):
        raise StoreError(422, "probe-failed")
    fmt = doc["format"]
    format_name = fmt.get("format_name")
    duration = fmt.get("duration")
    if not (isinstance(format_name, str) and _FORMAT_RE.match(format_name)):
        raise StoreError(422, "probe-failed")
    result = {
        "container": format_name,
        "durationSeconds": float(duration) if isinstance(duration, str) and _DURATION_RE.match(duration) else None,
        "video": None,
        "audio": None,
    }
    streams = doc.get("streams")
    if not isinstance(streams, list) or len(streams) > 64:
        raise StoreError(422, "probe-failed")
    for s in streams:
        if not isinstance(s, dict):
            continue
        kind = s.get("codec_type")
        codec = s.get("codec_name")
        if not (isinstance(codec, str) and _CODEC_RE.match(codec)):
            continue
        if kind == "video" and result["video"] is None:
            rate = s.get("avg_frame_rate") or s.get("r_frame_rate")
            result["video"] = {
                "codec": codec,
                "width": _bounded_int(s.get("width"), 1, 65535),
                "height": _bounded_int(s.get("height"), 1, 65535),
                "frameRate": rate if isinstance(rate, str) and _RATE_RE.match(rate) else None,
            }
        elif kind == "audio" and result["audio"] is None:
            result["audio"] = {"codec": codec}
    return result


def probe_local_fd(config: Config, fd: int) -> dict:
    """
    ffprobe over an ALREADY-OPEN local file descriptor. The child inherits exactly that fd and is
    pointed at /dev/fd/N through the `file` protocol only, so it cannot be handed a URL, a path
    another process could swap, a playlist, or a concat list. Fixed argv, no shell, minimal env,
    bounded time and bounded output. Memory and task limits are the unit's cgroup (MemoryMax,
    TasksMax), which a child shares — this function claims nothing beyond that.
    """
    if not (os.path.isabs(config.ffprobe) and os.access(config.ffprobe, os.X_OK)):
        raise StoreError(503, "probe-unavailable")
    os.lseek(fd, 0, os.SEEK_SET)
    argv = [
        config.ffprobe, "-v", "error", "-hide_banner",
        "-protocol_whitelist", "file",
        "-format_whitelist", PROBE_FORMATS,
        "-print_format", "json", "-show_format", "-show_streams",
        f"file:/dev/fd/{fd}",
    ]
    try:
        done = subprocess.run(argv, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                              stderr=subprocess.DEVNULL, pass_fds=(fd,), close_fds=True,
                              env={"PATH": "/usr/bin:/bin"}, timeout=PROBE_TIMEOUT_SECONDS, check=False)
    except subprocess.TimeoutExpired:
        raise StoreError(422, "probe-timeout")
    except OSError:
        raise StoreError(503, "probe-unavailable")
    if done.returncode != 0 or len(done.stdout) > PROBE_MAX_OUTPUT:
        raise StoreError(422, "probe-failed")
    return parse_probe(done.stdout)


def normalize_argv(ffmpeg: str, source_fd: int, out_path: str, max_bytes: int) -> list:
    """
    mp4-normalize-v1, fixed. The only variable parts are a descriptor and a path THIS process chose.
    `-n` refuses to overwrite; `-fs` stops writing one byte past the ceiling so an oversize result is
    detected, never trusted.
    """
    return [
        ffmpeg, "-nostdin", "-hide_banner", "-loglevel", "error",
        "-protocol_whitelist", "file", "-format_whitelist", PROBE_FORMATS,
        "-threads", "1", "-filter_threads", "1",
        "-i", f"file:/dev/fd/{source_fd}",
        "-map", "0:v:0", "-map", "0:a:0?",
        "-vf", NORMALIZE_FILTER,
        "-c:v", "libx264", "-preset", NORMALIZE_PRESET, "-crf", "23", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "128k",
        "-map_metadata", "-1", "-map_chapters", "-1", "-sn", "-dn",
        "-movflags", "+faststart", "-fs", str(max_bytes + 1),
        "-threads", "1", "-f", "mp4", "-n", out_path,
    ]


def derive_object(config: Config, source_key: str, dest_key: str, derivation: str) -> dict:
    """
    Run the closed transform over the stored source; write the result temp-first, link it write-once
    under `dest_key`, probe the STORED result and answer measured facts. Any failure leaves no object
    under `dest_key` and the source untouched (it is only ever opened O_RDONLY).
    """
    ms, md = KEY_RE.match(source_key), KEY_RE.match(dest_key)
    if not ms or not md:
        raise StoreError(400, "invalid-key")
    if ms.group(1) != md.group(1):
        raise StoreError(403, "cross-tenant-refused")
    if ms.group(2) == md.group(2):
        raise StoreError(400, "source-is-destination")
    if derivation not in DERIVATIONS:
        raise StoreError(400, "derivation-unknown")
    if not config.enable_video:
        raise StoreError(415, "derivation-unavailable")
    if not (os.path.isabs(config.ffmpeg) and os.access(config.ffmpeg, os.X_OK)):
        raise StoreError(503, "derive-unavailable")
    max_bytes = config.v2_max_bytes
    if not _derive_slot.acquire(blocking=False):
        raise StoreError(503, "derive-busy")
    try:
        opened = _open_object_file(config.root, source_key)
        if opened is None:
            raise StoreError(404, "source-absent")
        src_fd, st = opened
        try:
            if st.st_size < 1 or st.st_size > max_bytes:
                raise StoreError(413, "source-size-refused")
            if os.pread(src_fd, 12, 0)[4:8] != b"ftyp":
                raise StoreError(422, "source-not-mp4")
            vfs = os.statvfs(config.root)
            if vfs.f_bavail * vfs.f_frsize - max_bytes < config.min_free_bytes:
                raise StoreError(507, "insufficient-storage")
            tenant_id, asset_id = md.group(1), md.group(2)
            dir_fd = _open_object_dir(config.root, tenant_id, create=True)
            try:
                try:
                    os.lstat(asset_id, dir_fd=dir_fd)
                except FileNotFoundError:
                    pass
                else:
                    raise StoreError(409, "key-exists")
                tmp_name = f"{TEMP_PREFIX}{asset_id}-{os.urandom(8).hex()}"
                out_path = os.path.join(config.root, "tenants", tenant_id, "media", tmp_name)
                try:
                    try:
                        done = subprocess.run(
                            normalize_argv(config.ffmpeg, src_fd, out_path, max_bytes),
                            stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                            pass_fds=(src_fd,), close_fds=True, env={"PATH": "/usr/bin:/bin"},
                            timeout=config.derive_timeout, check=False)
                    except subprocess.TimeoutExpired:
                        raise StoreError(422, "derive-timeout")
                    except OSError:
                        raise StoreError(503, "derive-unavailable")
                    if done.returncode != 0:
                        raise StoreError(422, "derive-failed")
                    try:
                        out_fd = os.open(tmp_name, os.O_RDONLY | os.O_NOFOLLOW | getattr(os, "O_CLOEXEC", 0),
                                         dir_fd=dir_fd)
                    except OSError:
                        raise StoreError(422, "derive-failed")
                    try:
                        ost = os.fstat(out_fd)
                        if not stat.S_ISREG(ost.st_mode) or ost.st_size < 1:
                            raise StoreError(422, "derive-failed")
                        if ost.st_size > max_bytes:
                            raise StoreError(413, "output-too-large")
                        digest = hashlib.sha256()
                        size = 0
                        while True:
                            chunk = os.read(out_fd, CHUNK)
                            if not chunk:
                                break
                            digest.update(chunk)
                            size += len(chunk)
                        probe = probe_local_fd(config, out_fd)
                        os.fchmod(out_fd, 0o440)
                        _finalize_once(dir_fd, tmp_name, asset_id)
                    finally:
                        os.close(out_fd)
                finally:
                    try:
                        os.unlink(tmp_name, dir_fd=dir_fd)
                    except FileNotFoundError:
                        pass
            finally:
                os.close(dir_fd)
        finally:
            os.close(src_fd)
    finally:
        _derive_slot.release()
    return {"status": "stored", "byteSize": size, "sha256Hex": digest.hexdigest(), "probe": probe}


def sweep_orphan_temps(root: str) -> int:
    """
    Remove temp files a crash left behind. Called once, at startup, before the socket is bound —
    the only moment this single process provably has no write in flight. Symlinked components are
    never followed; only regular files with the temp prefix are removed.
    """
    removed = 0
    try:
        tenants_fd = os.open(os.path.join(root, "tenants"), _DIR_FLAGS)
    except FileNotFoundError:
        return 0
    try:
        for tenant in os.listdir(tenants_fd):
            if not re.fullmatch(_UUID, tenant):
                continue
            try:
                t_fd = os.open(tenant, _DIR_FLAGS, dir_fd=tenants_fd)
            except OSError:
                continue
            try:
                try:
                    m_fd = os.open("media", _DIR_FLAGS, dir_fd=t_fd)
                except OSError:
                    continue
                try:
                    for name in os.listdir(m_fd):
                        if not name.startswith(TEMP_PREFIX):
                            continue
                        st = os.stat(name, dir_fd=m_fd, follow_symlinks=False)
                        if stat.S_ISREG(st.st_mode):
                            os.unlink(name, dir_fd=m_fd)
                            removed += 1
                finally:
                    os.close(m_fd)
            finally:
                os.close(t_fd)
    finally:
        os.close(tenants_fd)
    return removed


def _content_length_chunks(rfile, length: int, counter: list):
    remaining = length
    while remaining > 0:
        chunk = rfile.read(min(CHUNK, remaining))
        if not chunk:
            raise StoreError(400, "body-truncated")
        counter[0] += len(chunk)
        remaining -= len(chunk)
        yield chunk


def _chunked_chunks(rfile):
    """HTTP/1.1 chunked decoding, bounded line lengths, fails closed on anything malformed or short."""
    while True:
        line = rfile.readline(CHUNK_LINE_MAX + 1)
        if not line:
            raise StoreError(400, "body-truncated")
        if len(line) > CHUNK_LINE_MAX or not line.endswith(b"\r\n"):
            raise StoreError(400, "body-malformed")
        size_text = line[:-2].split(b";", 1)[0].strip()
        if not re.fullmatch(rb"[0-9a-fA-F]{1,8}", size_text):
            raise StoreError(400, "body-malformed")
        size = int(size_text, 16)
        if size == 0:
            for _ in range(32):
                trailer = rfile.readline(CHUNK_LINE_MAX + 1)
                if not trailer:
                    raise StoreError(400, "body-truncated")
                if trailer == b"\r\n":
                    return
            raise StoreError(400, "body-malformed")
        remaining = size
        while remaining > 0:
            chunk = rfile.read(min(CHUNK, remaining))
            if not chunk:
                raise StoreError(400, "body-truncated")
            remaining -= len(chunk)
            yield chunk
        if rfile.read(2) != b"\r\n":
            raise StoreError(400, "body-malformed")


def parse_range(header: str, size: int):
    """One `bytes=` range → (start, end) inclusive; None → unsatisfiable/invalid (416)."""
    m = RANGE_RE.match(header.strip())
    if not m:
        return None
    first, last = m.group(1), m.group(2)
    if first == "" and last == "":
        return None
    if first == "":
        n = int(last)
        if n == 0:
            return None
        return max(0, size - n), size - 1
    start = int(first)
    end = size - 1 if last == "" else min(int(last), size - 1)
    if start >= size or start > end:
        return None
    return start, end


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

        def _put_v2(self, key: str):
            """
            MV-1 streamed write. Headers carry the grant; the signature binds key, type, the expected
            length ("" when unknown), the ceiling, the expiry and the probe mode — never a digest.
            """
            h = self.headers
            ts = h.get("X-Hebun-Timestamp", "")
            nonce = h.get("X-Hebun-Nonce", "")
            sig = h.get("X-Hebun-Signature", "")
            ctype = h.get("Content-Type", "")
            expected_text = h.get("X-Hebun-Expected-Length", "")
            max_text = h.get("X-Hebun-Max-Bytes", "")
            expires = h.get("X-Hebun-Expires", "")
            probe = h.get("X-Hebun-Probe", "")
            te = h.get("Transfer-Encoding")
            length_header = h.get("Content-Length")
            chunked = te is not None
            if chunked and (te.strip().lower() != "chunked" or length_header is not None):
                return self._send(400, {"error": "invalid-framing"})
            if not chunked:
                if length_header is None or not length_header.isdigit():
                    return self._send(411, {"error": "length-required"})
                self._unread_body = int(length_header)
            if not KEY_RE.match(key):
                return self._send(400, {"error": "invalid-key"})
            if not (TS_RE.match(ts) and NONCE_RE.match(nonce) and SIG_RE.match(sig)
                    and TS_RE.match(expires) and LENGTH_RE.match(max_text) and probe in PROBE_MODES
                    and (expected_text == "" or LENGTH_RE.match(expected_text))):
                return self._send(401, {"error": "unauthorized"})
            now = config.clock()
            t, e = int(ts), int(expires)
            if t < int(started_at) or abs(now - t) > CLOCK_SKEW_SECONDS:
                return self._send(401, {"error": "unauthorized"})
            if e <= now or e > t + WRITE_V2_MAX_TTL_SECONDS:
                return self._send(401, {"error": "unauthorized"})
            expected_sig = sign(config.write_secret, write_v2_canonical(
                key, ts, nonce, ctype, expected_text, int(max_text), expires, probe))
            if not hmac.compare_digest(expected_sig, sig) or not nonces.claim(nonce, now):
                return self._send(401, {"error": "unauthorized"})
            expected = int(expected_text) if expected_text else None
            if not chunked and expected is not None and int(length_header) != expected:
                return self._send(400, {"error": "size-mismatch"})
            if not chunked and int(length_header) > int(max_text):
                return self._send(413, {"error": "size-refused"})
            counter = [0]
            chunks = _chunked_chunks(self.rfile) if chunked else _content_length_chunks(
                self.rfile, int(length_header), counter)
            try:
                result = put_object_stream(config, key, ctype, expected, int(max_text), probe == "required", chunks)
            except StoreError as err:
                # A refused chunked body cannot be drained safely; the connection is closed instead.
                self._unread_body = 0 if chunked else int(length_header) - counter[0]
                return self._send(err.status, {"error": err.code})
            except OSError as err:
                self._unread_body = 0 if chunked else int(length_header) - counter[0]
                code = "symlink-refused" if err.errno in (errno.ELOOP, errno.ENOTDIR) else "storage-error"
                return self._send(500, {"error": code})
            self._unread_body = 0
            return self._send(201, result)

        def do_PUT(self):
            parts = urlsplit(self.path)
            if parts.path.startswith("/v2/objects/") and not parts.query:
                return self._put_v2(parts.path[len("/v2/objects/"):])
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
            if (not KEY_RE.match(key) or ctype not in config.content_types or not TS_RE.match(exp)
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
            # MV-3: the signed type must be what the stored bytes are — checked before HEAD, Range or
            # body, answered exactly like any other refused grant.
            try:
                head = os.pread(fd, _SNIFF_BYTES, 0)
            except OSError:
                head = b""
            if not object_matches_content_type(head, ctype):
                os.close(fd)
                return self._send(403, {"error": "forbidden"})
            # MV-1: one byte range, decided only after the grant held and the object exists.
            size = st.st_size
            start, end, status = 0, size - 1, 200
            range_header = self.headers.get("Range")
            if range_header is not None:
                span = parse_range(range_header, size)
                if span is None:
                    os.close(fd)
                    self.send_response(416)
                    self.send_header("Content-Range", f"bytes */{size}")
                    self.send_header("Accept-Ranges", "bytes")
                    self.send_header("Content-Length", "0")
                    self.send_header("Cache-Control", "private, no-store")
                    self.send_header("Connection", "close")
                    self.end_headers()
                    self.close_connection = True
                    return
                start, end, status = span[0], span[1], 206
            with os.fdopen(fd, "rb") as f:
                self.send_response(status)
                self.send_header("Content-Type", ctype)
                self.send_header("Content-Length", str(end - start + 1))
                self.send_header("Accept-Ranges", "bytes")
                if status == 206:
                    self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
                self.send_header("Cache-Control", "private, no-store")
                self.send_header("X-Content-Type-Options", "nosniff")
                self.send_header("Content-Disposition", "inline")
                self.send_header("Content-Security-Policy", "default-src 'none'; sandbox")
                self.send_header("Referrer-Policy", "no-referrer")
                self.send_header("Connection", "close")
                self.end_headers()
                if self.command != "HEAD":
                    f.seek(start)
                    remaining = end - start + 1
                    while remaining > 0:
                        chunk = f.read(min(CHUNK, remaining))
                        if not chunk:
                            break
                        self.wfile.write(chunk)
                        remaining -= len(chunk)
            self.close_connection = True

        def do_HEAD(self):
            # MV-1: HEAD exists only for the signed read, under exactly the same grant checks as GET.
            parts = urlsplit(self.path)
            if parts.path.startswith("/v1/read/"):
                return self._read(parts)
            return self._send(404, {"error": "not-found"})

        def _derive(self, dest_key: str):
            """
            MV-5 DERIVE-V1. Headers carry the grant; the write secret signs destination, source,
            derivation, timestamp, nonce and expiry. The body must be empty.
            """
            h = self.headers
            ts = h.get("X-Hebun-Timestamp", "")
            nonce = h.get("X-Hebun-Nonce", "")
            sig = h.get("X-Hebun-Signature", "")
            expires = h.get("X-Hebun-Expires", "")
            source_key = h.get("X-Hebun-Source-Key", "")
            derivation = h.get("X-Hebun-Derivation", "")
            if h.get("Transfer-Encoding") is not None or h.get("Content-Length", "0") != "0":
                return self._send(400, {"error": "body-refused"})
            if not KEY_RE.match(dest_key) or not KEY_RE.match(source_key):
                return self._send(400, {"error": "invalid-key"})
            if not (TS_RE.match(ts) and NONCE_RE.match(nonce) and SIG_RE.match(sig) and TS_RE.match(expires)
                    and DERIVATION_RE.match(derivation)):
                return self._send(401, {"error": "unauthorized"})
            now = config.clock()
            t, e = int(ts), int(expires)
            if t < int(started_at) or abs(now - t) > CLOCK_SKEW_SECONDS:
                return self._send(401, {"error": "unauthorized"})
            if e <= now or e > t + DERIVE_MAX_TTL_SECONDS:
                return self._send(401, {"error": "unauthorized"})
            expected = sign(config.write_secret, derive_canonical(dest_key, source_key, derivation, ts, nonce, expires))
            if not hmac.compare_digest(expected, sig) or not nonces.claim(nonce, now):
                return self._send(401, {"error": "unauthorized"})
            try:
                result = derive_object(config, source_key, dest_key, derivation)
            except StoreError as err:
                return self._send(err.status, {"error": err.code})
            except OSError as err:
                code = "symlink-refused" if err.errno in (errno.ELOOP, errno.ENOTDIR) else "storage-error"
                return self._send(500, {"error": code})
            return self._send(201, result)

        def do_POST(self):
            parts = urlsplit(self.path)
            if parts.path.startswith("/v2/derive/") and not parts.query:
                return self._derive(parts.path[len("/v2/derive/"):])
            self._send(405, {"error": "method-not-allowed"})

        def _refuse_method(self):
            self._send(405, {"error": "method-not-allowed"})

        do_DELETE = _refuse_method
        do_PATCH = _refuse_method

    return Handler


def build_server(config: Config, host: str, port: int) -> ThreadingHTTPServer:
    started_at = config.clock()
    sweep_orphan_temps(config.root)
    server =ThreadingHTTPServer((host, port), make_handler(config, started_at, NonceCache()))
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
