"""BR-2 media snapshot/restore. Synthetic objects in a temporary store; nothing outside it.

    python3 -m unittest test_hebun_media_backup.py      (from infra/media-store-vps)
"""
from __future__ import annotations

import io
import json
import os
import stat
import tarfile
import tempfile
import unittest
import uuid

import hebun_media_backup as mb

T1, T2 = str(uuid.UUID(int=1)), str(uuid.UUID(int=2))
A1, A2, A3 = str(uuid.UUID(int=11)), str(uuid.UUID(int=12)), str(uuid.UUID(int=13))
NO_FLOOR = 0


class MediaBackupTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="hebun-br2-media-")
        self.base = os.path.realpath(self.tmp.name)
        self.root = os.path.join(self.base, "store")
        self.objects = {
            (T1, A1): b"synthetic-object-one-" + os.urandom(2 * 1024 * 1024),
            (T1, A2): b"synthetic-object-two",
            (T2, A3): b"",
        }
        for (t, a), body in self.objects.items():
            d = os.path.join(self.root, "tenants", t, "media")
            os.makedirs(d, exist_ok=True)
            with open(os.path.join(d, a), "wb") as f:
                f.write(body)
            os.chmod(os.path.join(d, a), 0o440)
        # An in-flight write: never part of a snapshot.
        with open(os.path.join(self.root, "tenants", T1, "media", f".tmp-{A3}-abcd"), "wb") as f:
            f.write(b"partial")
        self.snap = os.path.join(self.base, "snap.tar")

    def tearDown(self):
        for dirpath, dirnames, filenames in os.walk(self.base):
            for n in dirnames + filenames:
                p = os.path.join(dirpath, n)
                if not os.path.islink(p):
                    os.chmod(p, 0o700)
        self.tmp.cleanup()

    def leftovers(self):
        return [n for n in os.listdir(self.base) if n.startswith(".restore-staging-") or n.endswith(".part")]

    def take(self):
        return mb.snapshot(self.root, self.snap, NO_FLOOR)

    def refused(self, reason, fn, *args):
        with self.assertRaises(mb.Refused) as cm:
            fn(*args)
        self.assertEqual(cm.exception.reason, reason, cm.exception.detail)

    def rewrite(self, members):
        """Write a tar of (name, bytes|None-for-symlink) to self.snap."""
        os.unlink(self.snap) if os.path.exists(self.snap) else None
        with tarfile.open(self.snap, "w") as tar:
            for name, body in members:
                info = tarfile.TarInfo(name)
                if body is None:
                    info.type = tarfile.SYMTYPE
                    info.linkname = "/etc/passwd"
                    tar.addfile(info)
                else:
                    info.size = len(body)
                    tar.addfile(info, io.BytesIO(body))

    def members(self):
        with tarfile.open(self.snap) as tar:
            return [(m.name, tar.extractfile(m).read()) for m in tar]

    # ── snapshot ───────────────────────────────────────────────────────────

    def test_snapshot_then_restore_is_exact(self):
        r = self.take()
        self.assertEqual(r["objects"], 3)
        self.assertEqual(stat.S_IMODE(os.stat(self.snap).st_mode), 0o600)
        names = [n for n, _ in self.members()]
        self.assertEqual(names[-1], mb.MANIFEST)
        self.assertFalse(any(".tmp-" in n for n in names), "in-flight writes are skipped")
        self.assertEqual(mb.verify(self.snap)["objects"], 3)
        new_root = os.path.join(self.base, "restored")
        out = mb.restore(self.snap, new_root, NO_FLOOR)
        self.assertEqual(out["status"], "restored")
        for (t, a), body in self.objects.items():
            p = os.path.join(new_root, "tenants", t, "media", a)
            with open(p, "rb") as f:
                self.assertEqual(f.read(), body)
            self.assertEqual(stat.S_IMODE(os.lstat(p).st_mode), 0o440)
        for d in (new_root, os.path.join(new_root, "tenants"), os.path.join(new_root, "tenants", T1),
                  os.path.join(new_root, "tenants", T1, "media")):
            self.assertEqual(stat.S_IMODE(os.stat(d).st_mode), 0o700, d)
        self.assertEqual(self.leftovers(), [])

    def test_empty_store_snapshots(self):
        empty = os.path.join(self.base, "empty")
        os.mkdir(empty)
        self.assertEqual(mb.snapshot(empty, self.snap, NO_FLOOR)["objects"], 0)
        self.assertEqual(mb.verify(self.snap)["objects"], 0)

    def test_snapshot_refuses_symlink_and_strangers(self):
        os.symlink("/etc/passwd", os.path.join(self.root, "tenants", T1, "media", str(uuid.UUID(int=99))))
        self.refused("unexpected-entry", self.take)
        self.assertFalse(os.path.exists(self.snap))
        self.assertEqual(self.leftovers(), [])

    def test_snapshot_refuses_unexpected_name(self):
        open(os.path.join(self.root, "tenants", T2, "media", "notes.txt"), "w").close()
        self.refused("unexpected-entry", self.take)

    def test_snapshot_never_overwrites(self):
        open(self.snap, "w").close()
        self.refused("target-exists", self.take)

    def test_disk_floor(self):
        self.refused("disk-below-floor", mb.snapshot, self.root, self.snap, 2 ** 62)
        self.assertFalse(os.path.exists(self.snap))
        self.take()
        self.refused("disk-below-floor", mb.restore, self.snap, os.path.join(self.base, "r"), 2 ** 62)
        self.assertFalse(os.path.exists(os.path.join(self.base, "r")))

    # ── restore fails closed ──────────────────────────────────────────────

    def assert_restore_refused(self, reason):
        new_root = os.path.join(self.base, "restored")
        self.refused(reason, mb.restore, self.snap, new_root, NO_FLOOR)
        self.assertFalse(os.path.lexists(new_root), "nothing is accepted")
        self.assertEqual(self.leftovers(), [], "staging is removed")

    def test_corrupt_object_byte(self):
        self.take()
        data = bytearray(open(self.snap, "rb").read())
        i = data.find(b"synthetic-object-two")
        data[i] ^= 0x01
        open(self.snap, "wb").write(bytes(data))
        self.refused("digest-mismatch", mb.verify, self.snap)
        self.assert_restore_refused("digest-mismatch")

    def test_truncated_snapshot(self):
        self.take()
        data = open(self.snap, "rb").read()
        open(self.snap, "wb").write(data[: len(data) // 2])
        new_root = os.path.join(self.base, "restored")
        with self.assertRaises(mb.Refused):
            mb.restore(self.snap, new_root, NO_FLOOR)
        self.assertFalse(os.path.lexists(new_root))
        self.assertEqual(self.leftovers(), [])

    def test_missing_manifest(self):
        self.take()
        self.rewrite([m for m in self.members() if m[0] != mb.MANIFEST])
        self.assert_restore_refused("manifest-missing")

    def test_manifest_lists_missing_object(self):
        self.take()
        members = self.members()
        self.rewrite([m for m in members if not m[0].endswith(A2)])
        self.assert_restore_refused("manifest-mismatch")

    def test_unlisted_extra_object(self):
        self.take()
        members = self.members()
        extra = (f"media/{T2}/{uuid.UUID(int=77)}", b"smuggled")
        self.rewrite(members[:-1] + [extra, members[-1]])
        self.assert_restore_refused("manifest-mismatch")

    def test_tampered_manifest_digest(self):
        self.take()
        members = self.members()
        doc = json.loads(members[-1][1])
        doc["objects"][0]["sha256"] = "0" * 64
        self.rewrite(members[:-1] + [(mb.MANIFEST, json.dumps(doc).encode())])
        self.assert_restore_refused("digest-mismatch")

    def test_path_traversal_and_symlink_members(self):
        for bad in ([("../escape", b"x")], [(f"media/{T1}/../../escape", b"x")], [("/abs", b"x")],
                    [(f"media/{T1}/{A1}", None)]):
            self.rewrite(bad + [(mb.MANIFEST, b'{"format":"hebun-media-snapshot","version":1,"count":0,"objects":[]}')])
            self.assert_restore_refused("member-refused")
        self.assertFalse(os.path.exists(os.path.join(os.path.dirname(self.base), "escape")))

    def test_duplicate_member(self):
        self.take()
        members = self.members()
        self.rewrite([members[0], members[0]] + members[1:])
        self.assert_restore_refused("member-refused")

    def test_restore_never_merges(self):
        self.take()
        self.refused("target-exists", mb.restore, self.snap, self.root, NO_FLOOR)

    def test_cli_exit_codes(self):
        self.assertEqual(mb.main(["snapshot", self.root, self.snap, "--min-free-bytes", "0"]), 0)
        self.assertEqual(mb.main(["verify", self.snap]), 0)
        self.assertEqual(mb.main(["restore", self.snap, self.root, "--min-free-bytes", "0"]), 1)
        self.assertEqual(mb.main(["bogus"]), 2)


if __name__ == "__main__":
    unittest.main()
