"""hebun_media_backup.py — BR-2: snapshot, verify and restore the media store's objects.

    python3 -I hebun_media_backup.py snapshot ROOT OUT.tar [--min-free-bytes N]
    python3 -I hebun_media_backup.py verify   SNAPSHOT.tar
    python3 -I hebun_media_backup.py restore  SNAPSHOT.tar NEW_ROOT [--min-free-bytes N]

Standard library only, like the store. Python has no authenticated cipher in its standard library,
so this tool does NOT encrypt: the snapshot is copied to the operator host and sealed there with
`backup-vault seal --kind media-tar` before anything leaves for off-site storage.

SNAPSHOT. A plain tar of every object `tenants/<uuid>/media/<uuid>` under ROOT, as members
`media/<tenant>/<asset>`, followed by `MANIFEST.json` listing each object's size and SHA-256. Objects
are write-once (0440, linked into place atomically), so each is copied whole or not at all; `.tmp-`
files are in-flight writes and are skipped. A symlink, a non-regular file or an unexpected name under
`tenants/` refuses the whole snapshot: an unexplained entry is not something to back up quietly.
The file is written as OUT.tar.part (0600), fsynced, then renamed.

RESTORE FAILS CLOSED. Members are extracted, never with `extractall`, into a private staging
directory beside NEW_ROOT; each is hashed while written. Only when every object matches the manifest,
and the manifest names nothing that is missing, is staging renamed to NEW_ROOT. Any failure removes
staging. NEW_ROOT must not exist: a restore never merges into, or overwrites, a live store.

Output is one JSON line of counts and digests. Exit 0 ok, 1 refused, 2 usage.
"""
from __future__ import annotations

import hashlib
import io
import json
import os
import re
import secrets
import shutil
import stat
import sys
import tarfile
import time

UUID = r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
UUID_RE = re.compile(rf"^{UUID}$")
MEMBER_RE = re.compile(rf"^media/({UUID})/({UUID})$")
MANIFEST = "MANIFEST.json"
TEMP_PREFIX = ".tmp-"
CHUNK = 1024 * 1024
DEFAULT_MIN_FREE = 8 * 1024 ** 3
NOFOLLOW = os.O_NOFOLLOW | getattr(os, "O_CLOEXEC", 0)


class Refused(Exception):
    def __init__(self, reason: str, detail: str = ""):
        super().__init__(f"{reason}: {detail}")
        self.reason = reason
        self.detail = detail


def _free(path: str) -> int:
    v = os.statvfs(path)
    return v.f_bavail * v.f_frsize


def _require_free(path: str, floor: int) -> None:
    free = _free(path)
    if free < floor:
        raise Refused("disk-below-floor", f"{free} bytes free, floor is {floor}")


class _Hashing(io.RawIOBase):
    """Wraps a file object; hashes exactly what tarfile reads from it."""

    def __init__(self, f):
        self.f = f
        self.h = hashlib.sha256()
        self.n = 0

    def readable(self):
        return True

    def readinto(self, b):
        data = self.f.read(len(b))
        b[: len(data)] = data
        self.h.update(data)
        self.n += len(data)
        return len(data)


def _list_objects(root: str) -> list[tuple[str, str]]:
    tenants_dir = os.path.join(root, "tenants")
    if not os.path.lexists(tenants_dir):
        return []
    if os.path.islink(tenants_dir) or not os.path.isdir(tenants_dir):
        raise Refused("unexpected-entry", "tenants is not a directory")
    out = []
    for tenant in sorted(os.listdir(tenants_dir)):
        tpath = os.path.join(tenants_dir, tenant)
        if not UUID_RE.match(tenant) or os.path.islink(tpath) or not os.path.isdir(tpath):
            raise Refused("unexpected-entry", f"tenants/{tenant}")
        for sub in sorted(os.listdir(tpath)):
            if sub != "media":
                raise Refused("unexpected-entry", f"tenants/{tenant}/{sub}")
        mdir = os.path.join(tpath, "media")
        if os.path.islink(mdir) or not os.path.isdir(mdir):
            raise Refused("unexpected-entry", f"tenants/{tenant}/media")
        for asset in sorted(os.listdir(mdir)):
            if asset.startswith(TEMP_PREFIX):
                continue
            apath = os.path.join(mdir, asset)
            st = os.lstat(apath)
            if not UUID_RE.match(asset) or not stat.S_ISREG(st.st_mode):
                raise Refused("unexpected-entry", f"tenants/{tenant}/media/{asset}")
            out.append((tenant, asset))
    return out


def snapshot(root: str, out: str, min_free: int = DEFAULT_MIN_FREE) -> dict:
    if not os.path.isabs(root) or os.path.islink(root) or not os.path.isdir(root):
        raise Refused("root-invalid", "ROOT must be an absolute, non-symlink directory")
    out_dir = os.path.dirname(os.path.abspath(out))
    _require_free(out_dir, min_free)
    if os.path.lexists(out):
        raise Refused("target-exists", out)
    objects = _list_objects(root)
    part = f"{out}.part"
    fd = os.open(part, os.O_WRONLY | os.O_CREAT | os.O_EXCL | NOFOLLOW, 0o600)
    entries = []
    ok = False
    try:
        with os.fdopen(fd, "wb") as raw:
            with tarfile.open(fileobj=raw, mode="w", format=tarfile.PAX_FORMAT) as tar:
                for tenant, asset in objects:
                    src = os.open(os.path.join(root, "tenants", tenant, "media", asset), os.O_RDONLY | NOFOLLOW)
                    with os.fdopen(src, "rb") as f:
                        st = os.fstat(f.fileno())
                        info = tarfile.TarInfo(f"media/{tenant}/{asset}")
                        info.size = st.st_size
                        info.mode = 0o440
                        info.mtime = int(st.st_mtime)
                        hashing = _Hashing(f)
                        tar.addfile(info, io.BufferedReader(hashing, CHUNK))
                        if hashing.n != st.st_size:
                            raise Refused("object-changed", f"{tenant}/{asset}")
                    entries.append({"key": f"tenants/{tenant}/media/{asset}", "bytes": st.st_size, "sha256": hashing.h.hexdigest()})
                manifest = json.dumps({
                    "format": "hebun-media-snapshot", "version": 1,
                    "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "count": len(entries), "totalBytes": sum(e["bytes"] for e in entries), "objects": entries,
                }, sort_keys=True).encode("utf-8")
                info = tarfile.TarInfo(MANIFEST)
                info.size = len(manifest)
                info.mode = 0o440
                info.mtime = int(time.time())
                tar.addfile(info, io.BytesIO(manifest))
            raw.flush()
            os.fsync(raw.fileno())
        os.rename(part, out)
        ok = True
    finally:
        if not ok and os.path.lexists(part):
            os.unlink(part)
    return {"status": "snapshot", "objects": len(entries), "totalBytes": sum(e["bytes"] for e in entries),
            "manifestSha256": hashlib.sha256(manifest).hexdigest()}


def _walk(snapshot_path: str, write_into: str | None) -> dict:
    """Read every member; hash it; optionally write it under write_into. Then check the manifest."""
    seen: dict[str, tuple[int, str]] = {}
    manifest = None
    with tarfile.open(snapshot_path, mode="r:") as tar:
        for m in tar:
            if m.name == MANIFEST:
                if manifest is not None or not m.isreg() or m.size > 64 * 1024 * 1024:
                    raise Refused("manifest-invalid", "duplicate or irregular manifest")
                manifest = tar.extractfile(m).read()
                continue
            match = MEMBER_RE.match(m.name)
            if not match or not m.isreg():
                raise Refused("member-refused", m.name)
            key = f"tenants/{match.group(1)}/media/{match.group(2)}"
            if key in seen:
                raise Refused("member-refused", f"duplicate {m.name}")
            h = hashlib.sha256()
            n = 0
            src = tar.extractfile(m)
            out = None
            if write_into is not None:
                d = write_into
                for part in ("tenants", match.group(1), "media"):
                    d = os.path.join(d, part)
                    if not os.path.isdir(d):
                        os.mkdir(d, 0o700)
                out = os.open(os.path.join(d, match.group(2)), os.O_WRONLY | os.O_CREAT | os.O_EXCL | NOFOLLOW, 0o600)
            try:
                while True:
                    chunk = src.read(CHUNK)
                    if not chunk:
                        break
                    h.update(chunk)
                    n += len(chunk)
                    if out is not None:
                        os.write(out, chunk)
                if out is not None:
                    os.fsync(out)
                    os.fchmod(out, 0o440)
            finally:
                if out is not None:
                    os.close(out)
            seen[key] = (n, h.hexdigest())
    if manifest is None:
        raise Refused("manifest-missing", "snapshot has no MANIFEST.json")
    try:
        doc = json.loads(manifest)
        listed = {e["key"]: (e["bytes"], e["sha256"]) for e in doc["objects"]}
        assert doc["format"] == "hebun-media-snapshot" and doc["version"] == 1 and doc["count"] == len(doc["objects"])
    except Exception:
        raise Refused("manifest-invalid", "manifest is not the v1 shape")
    if set(listed) != set(seen):
        missing = sorted(set(listed) - set(seen))[:3]
        extra = sorted(set(seen) - set(listed))[:3]
        raise Refused("manifest-mismatch", f"missing {missing} extra {extra}")
    for key, value in seen.items():
        if listed[key] != value:
            raise Refused("digest-mismatch", key)
    return {"objects": len(seen), "totalBytes": sum(v[0] for v in seen.values()),
            "manifestSha256": hashlib.sha256(manifest).hexdigest()}


def verify(snapshot_path: str) -> dict:
    try:
        return {"status": "verified", **_walk(snapshot_path, None)}
    except tarfile.TarError as e:
        raise Refused("tar-invalid", str(e))


def restore(snapshot_path: str, new_root: str, min_free: int = DEFAULT_MIN_FREE) -> dict:
    new_root = os.path.abspath(new_root)
    parent = os.path.dirname(new_root)
    if os.path.lexists(new_root):
        raise Refused("target-exists", "NEW_ROOT must not exist; a restore never merges into a store")
    if not os.path.isdir(parent):
        raise Refused("target-invalid", "parent of NEW_ROOT must exist")
    _require_free(parent, min_free)
    staging = os.path.join(parent, f".restore-staging-{secrets.token_hex(8)}")
    os.mkdir(staging, 0o700)
    ok = False
    try:
        try:
            result = _walk(snapshot_path, staging)
        except tarfile.TarError as e:
            raise Refused("tar-invalid", str(e))
        os.rename(staging, new_root)
        ok = True
        return {"status": "restored", **result}
    finally:
        if not ok:
            shutil.rmtree(staging, ignore_errors=True)


def main(argv: list[str]) -> int:
    args = list(argv)
    min_free = DEFAULT_MIN_FREE
    if "--min-free-bytes" in args:
        i = args.index("--min-free-bytes")
        try:
            min_free = int(args[i + 1])
        except (IndexError, ValueError):
            print("usage: --min-free-bytes needs an integer", file=sys.stderr)
            return 2
        del args[i:i + 2]
    try:
        if len(args) == 3 and args[0] == "snapshot":
            result = snapshot(args[1], args[2], min_free)
        elif len(args) == 2 and args[0] == "verify":
            result = verify(args[1])
        elif len(args) == 3 and args[0] == "restore":
            result = restore(args[1], args[2], min_free)
        else:
            print(__doc__.split("\n\n")[1], file=sys.stderr)
            return 2
    except Refused as r:
        print(json.dumps({"status": "refused", "reason": r.reason, "detail": r.detail}))
        return 1
    print(json.dumps(result))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
