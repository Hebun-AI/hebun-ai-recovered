"""
Tests for hebun_media_store.py. Standard library only.

    python3 -m unittest infra/media-store-vps/test_hebun_media_store.py

Every case runs a real server on an ephemeral loopback port over a temporary storage root, with
throwaway secrets generated per run. No production secret or production byte is involved.
"""

import hashlib
import http.client
import json
import os
import secrets
import shutil
import sys
import tempfile
import threading
import time
import unittest
from urllib.parse import quote

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hebun_media_store as store  # noqa: E402

VECTORS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "signing-vectors.json")

T1 = "0b6f3d9e-6c1a-4f5e-9d2b-3a4c5d6e7f80"
T2 = "1c7a4e0f-7d2b-4a6f-8e3c-4b5d6e7f8091"
A1 = "2d8b5f10-8e3c-4b70-9f4d-5c6e7f8091a2"
A2 = "3e9c6021-9f4d-4c81-a05e-6d7f8091a2b3"
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64


def key(t, a):
    return f"tenants/{t}/media/{a}"


class StoreTestCase(unittest.TestCase):
    min_free = 0

    def setUp(self):
        self.root = tempfile.mkdtemp(prefix="hebun-media-test-")
        self.write_secret = secrets.token_hex(32)
        self.read_secret = secrets.token_hex(32)
        self.now = time.time()
        self.config = store.Config(self.root, self.write_secret.encode(), self.read_secret.encode(),
                                   self.min_free, clock=lambda: self.now)
        self.server = store.build_server(self.config, "127.0.0.1", 0)
        self.port = self.server.server_address[1]
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        shutil.rmtree(self.root, ignore_errors=True)

    # ── client helpers ────────────────────────────────────────────────────────
    def request(self, method, path, body=b"", headers=None):
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=10)
        conn.request(method, path, body=body, headers=headers or {})
        resp = conn.getresponse()
        data = resp.read()
        conn.close()
        return resp.status, data, resp

    def signed_headers(self, method, k, sha="", ctype="", length=0, ts=None, nonce=None, secret=None):
        ts = str(int(self.now if ts is None else ts))
        nonce = nonce or secrets.token_hex(16)
        canonical = store.write_canonical(method, k, ts, nonce, sha, ctype, length)
        return {
            "X-Hebun-Timestamp": ts,
            "X-Hebun-Nonce": nonce,
            "X-Hebun-Signature": store.sign((secret or self.write_secret).encode(), canonical),
        }

    def put(self, k, data=PNG, ctype="image/png", sha=None, **kw):
        sha = sha or hashlib.sha256(data).hexdigest()
        headers = {"Content-Type": ctype, "Content-Length": str(len(data)), "X-Hebun-Content-SHA256": sha}
        headers.update(self.signed_headers("PUT", k, sha, ctype, len(data), **kw))
        return self.request("PUT", "/v1/objects/" + k, data, headers)

    def verify(self, k, **kw):
        status, data, _ = self.request("GET", "/v1/verify/" + k, headers=self.signed_headers("GET", k, **kw))
        return status, (json.loads(data) if data else None)

    def read_url(self, k, ctype="image/png", exp=None, secret=None):
        exp = str(int(self.now + 60 if exp is None else exp))
        sig = store.sign((secret or self.read_secret).encode(), store.read_canonical(k, ctype, exp))
        return f"/v1/read/{k}?ct={quote(ctype, safe='')}&exp={exp}&sig={sig}"


class WriteOnce(StoreTestCase):
    def test_put_then_verify_reports_stored_identity(self):
        status, _, _ = self.put(key(T1, A1))
        self.assertEqual(status, 201)
        status, body = self.verify(key(T1, A1))
        self.assertEqual(status, 200)
        self.assertEqual(body, {"status": "present", "byteSize": len(PNG),
                                "sha256Hex": hashlib.sha256(PNG).hexdigest()})

    def test_verify_absent(self):
        self.assertEqual(self.verify(key(T1, A1)), (200, {"status": "absent"}))

    def test_duplicate_key_refused_and_original_bytes_kept(self):
        self.assertEqual(self.put(key(T1, A1))[0], 201)
        other = PNG + b"\x01"
        status, data, _ = self.put(key(T1, A1), data=other)
        self.assertEqual((status, json.loads(data)["error"]), (409, "key-exists"))
        self.assertEqual(self.verify(key(T1, A1))[1]["sha256Hex"], hashlib.sha256(PNG).hexdigest())

    def test_stored_file_is_read_only_and_no_temp_remains(self):
        self.put(key(T1, A1))
        media = os.path.join(self.root, "tenants", T1, "media")
        self.assertEqual(os.listdir(media), [A1])
        self.assertEqual(os.stat(os.path.join(media, A1)).st_mode & 0o777, 0o440)
        self.assertEqual(os.stat(media).st_mode & 0o777, 0o700)

    def test_digest_mismatch_refused_and_nothing_stored(self):
        status, data, _ = self.put(key(T1, A1), sha="0" * 64)
        self.assertEqual((status, json.loads(data)["error"]), (422, "digest-mismatch"))
        self.assertEqual(self.verify(key(T1, A1))[1], {"status": "absent"})
        self.assertEqual(os.listdir(os.path.join(self.root, "tenants", T1, "media")), [])

    def test_size_and_content_type_bounds(self):
        # Oversize is refused on the declared length alone, before any body byte is read.
        k = key(T1, A1)
        sha = "a" * 64
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=10)
        conn.putrequest("PUT", "/v1/objects/" + k)
        headers = {"Content-Type": "image/png", "Content-Length": str(store.MAX_BYTE_SIZE + 1),
                   "X-Hebun-Content-SHA256": sha}
        headers.update(self.signed_headers("PUT", k, sha, "image/png", store.MAX_BYTE_SIZE + 1))
        for h, v in headers.items():
            conn.putheader(h, v)
        conn.endheaders()
        resp = conn.getresponse()
        self.assertEqual((resp.status, json.loads(resp.read())["error"]), (413, "size-refused"))
        conn.close()
        self.assertEqual(self.put(key(T1, A1), ctype="image/svg+xml")[0], 415)
        self.assertEqual(self.put(key(T1, A1), ctype="text/html")[0], 415)
        exact = b"\x00" * store.MAX_BYTE_SIZE
        self.assertEqual(self.put(key(T1, A2), data=exact)[0], 201)

    def test_missing_content_length_refused(self):
        headers = {"Content-Type": "image/png", "Transfer-Encoding": "chunked"}
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=10)
        conn.putrequest("PUT", "/v1/objects/" + key(T1, A1))
        for h, v in headers.items():
            conn.putheader(h, v)
        conn.endheaders()
        conn.send(b"0\r\n\r\n")
        self.assertEqual(conn.getresponse().status, 411)
        conn.close()


class Keys(StoreTestCase):
    def test_traversal_and_noncanonical_keys_refused(self):
        bad = [
            "tenants/../../etc/passwd",
            f"tenants/{T1}/media/../{A1}",
            f"tenants/{T1}/media/{A1}/..",
            f"tenants/{T1.upper()}/media/{A1}",
            f"tenants/{T1}/media/{A1}.png",
            f"tenants/{T1}/other/{A1}",
            f"/tenants/{T1}/media/{A1}",
            f"tenants/{T1}/media/%2e%2e",
            f"tenants/{T1}/media/{A1}%00",
        ]
        for k in bad:
            self.assertEqual(self.put(k)[0], 400, k)
            self.assertEqual(self.request("GET", "/v1/verify/" + k)[0], 400, k)
        self.assertFalse(os.path.exists(os.path.join(self.root, "tenants", T1)))

    def test_symlink_escape_refused_for_write_verify_and_read(self):
        outside = tempfile.mkdtemp(prefix="hebun-outside-")
        try:
            secret_file = os.path.join(outside, A1)
            with open(secret_file, "wb") as f:
                f.write(PNG)
            os.makedirs(os.path.join(self.root, "tenants"))
            # tenant directory is a symlink pointing outside the root
            os.symlink(outside, os.path.join(self.root, "tenants", T1))
            status, data, _ = self.put(key(T1, A2))
            self.assertEqual((status, json.loads(data)["error"]), (500, "symlink-refused"))
            self.assertEqual(os.listdir(outside), [A1])
            self.assertEqual(self.verify(key(T1, A1))[0], 500)
            self.assertEqual(self.request("GET", self.read_url(key(T1, A1)))[0], 404)

            # object name itself is a symlink inside a real media dir
            media = os.path.join(self.root, "tenants", T2, "media")
            os.makedirs(media)
            os.symlink(secret_file, os.path.join(media, A1))
            self.assertEqual(self.verify(key(T2, A1)), (200, {"status": "absent"}))
            self.assertEqual(self.request("GET", self.read_url(key(T2, A1)))[0], 404)
            self.assertEqual(self.put(key(T2, A1))[0], 409)
            with open(secret_file, "rb") as f:
                self.assertEqual(f.read(), PNG)
        finally:
            shutil.rmtree(outside, ignore_errors=True)

    def test_tenant_isolation(self):
        self.put(key(T1, A1))
        self.assertEqual(self.verify(key(T2, A1))[1], {"status": "absent"})
        self.assertEqual(self.request("GET", self.read_url(key(T2, A1)))[0], 404)
        # a read grant for T1's object does not open T2's path, and vice versa
        url = self.read_url(key(T1, A1)).replace(T1, T2)
        self.assertEqual(self.request("GET", url)[0], 403)


class Authentication(StoreTestCase):
    def test_unsigned_and_wrong_secret_refused(self):
        k = key(T1, A1)
        headers = {"Content-Type": "image/png", "Content-Length": str(len(PNG)),
                   "X-Hebun-Content-SHA256": hashlib.sha256(PNG).hexdigest()}
        self.assertEqual(self.request("PUT", "/v1/objects/" + k, PNG, headers)[0], 401)
        self.assertEqual(self.put(k, secret=secrets.token_hex(32))[0], 401)
        self.assertEqual(self.put(k, secret=self.read_secret)[0], 401, "read secret cannot write")
        self.assertEqual(self.verify(k, secret=secrets.token_hex(32))[0], 401)
        self.assertEqual(self.request("GET", "/v1/verify/" + k)[0], 401)
        self.assertEqual(self.verify(k)[1], {"status": "absent"})

    def test_signature_binds_digest_and_length(self):
        k = key(T1, A1)
        sha = hashlib.sha256(PNG).hexdigest()
        headers = {"Content-Type": "image/png", "Content-Length": str(len(PNG)), "X-Hebun-Content-SHA256": sha}
        headers.update(self.signed_headers("PUT", k, "f" * 64, "image/png", len(PNG)))
        self.assertEqual(self.request("PUT", "/v1/objects/" + k, PNG, headers)[0], 401)

    def test_replayed_nonce_refused(self):
        nonce = secrets.token_hex(16)
        self.assertEqual(self.put(key(T1, A1), nonce=nonce)[0], 201)
        self.assertEqual(self.put(key(T1, A2), nonce=nonce)[0], 401)
        self.assertEqual(self.verify(key(T1, A1), nonce=nonce)[0], 401)

    def test_stale_future_and_pre_start_timestamps_refused(self):
        self.assertEqual(self.put(key(T1, A1), ts=self.now - store.CLOCK_SKEW_SECONDS - 5)[0], 401)
        self.assertEqual(self.put(key(T1, A1), ts=self.now + store.CLOCK_SKEW_SECONDS + 5)[0], 401)
        # within the skew window but signed before this process started: refused across restarts
        self.assertEqual(self.put(key(T1, A1), ts=self.now - 10)[0], 401)
        self.assertEqual(self.put(key(T1, A1))[0], 201)

    def test_disallowed_methods(self):
        for m in ("POST", "DELETE", "PATCH"):
            self.assertEqual(self.request(m, "/v1/objects/" + key(T1, A1))[0], 405)


class ReadAccess(StoreTestCase):
    def test_signed_read_serves_bytes_with_safe_headers(self):
        self.put(key(T1, A1))
        status, data, resp = self.request("GET", self.read_url(key(T1, A1)))
        self.assertEqual((status, data), (200, PNG))
        self.assertEqual(resp.getheader("Content-Type"), "image/png")
        self.assertEqual(resp.getheader("X-Content-Type-Options"), "nosniff")
        self.assertIn("no-store", resp.getheader("Cache-Control"))
        self.assertIn("sandbox", resp.getheader("Content-Security-Policy"))

    def test_expired_overlong_tampered_and_write_secret_grants_refused(self):
        self.put(key(T1, A1))
        k = key(T1, A1)
        self.assertEqual(self.request("GET", self.read_url(k, exp=self.now - 1))[0], 403)
        self.assertEqual(self.request("GET", self.read_url(k, exp=self.now + store.READ_MAX_TTL_SECONDS + 5))[0], 403)
        self.assertEqual(self.request("GET", self.read_url(k, secret=self.write_secret))[0], 403)
        url = self.read_url(k)
        self.assertEqual(self.request("GET", url.replace("image%2Fpng", "image%2Fjpeg"))[0], 403)
        self.assertEqual(self.request("GET", url + "&sig=" + "0" * 64)[0], 403)
        self.assertEqual(self.request("GET", self.read_url(k, ctype="text/html"))[0], 403)
        self.assertEqual(self.request("GET", "/v1/read/" + k)[0], 403)

    def test_grant_expires_with_the_clock(self):
        self.put(key(T1, A1))
        url = self.read_url(key(T1, A1), exp=self.now + 30)
        self.assertEqual(self.request("GET", url)[0], 200)
        self.now += 31
        self.assertEqual(self.request("GET", url)[0], 403)

    def test_no_listing_or_static_root(self):
        self.put(key(T1, A1))
        for path in ("/", "/v1/", "/v1/read/", f"/v1/read/tenants/{T1}/media/", "/tenants/" + T1,
                     "/v1/objects/" + key(T1, A1)):
            status, data, _ = self.request("GET", path)
            self.assertIn(status, (403, 404), path)
            self.assertNotIn(PNG, data)


class DiskThreshold(StoreTestCase):
    min_free = 1 << 62  # larger than any disk: every write must be refused

    def test_writes_refused_below_free_space_threshold(self):
        status, data, _ = self.put(key(T1, A1))
        self.assertEqual((status, json.loads(data)["error"]), (507, "insufficient-storage"))
        self.assertFalse(os.path.exists(os.path.join(self.root, "tenants")))


class Configuration(unittest.TestCase):
    def test_missing_or_weak_configuration_refuses_to_start(self):
        root = tempfile.mkdtemp()
        try:
            good = {"HEBUN_MEDIA_STORE_ROOT": root, "HEBUN_MEDIA_STORE_WRITE_SECRET": "w" * 64,
                    "HEBUN_MEDIA_STORE_READ_SECRET": "r" * 64}
            store.load_config(good)
            for broken in (
                {},
                {**good, "HEBUN_MEDIA_STORE_ROOT": ""},
                {**good, "HEBUN_MEDIA_STORE_ROOT": "relative/path"},
                {**good, "HEBUN_MEDIA_STORE_ROOT": os.path.join(root, "missing")},
                {**good, "HEBUN_MEDIA_STORE_WRITE_SECRET": ""},
                {**good, "HEBUN_MEDIA_STORE_READ_SECRET": "short"},
                {**good, "HEBUN_MEDIA_STORE_READ_SECRET": "w" * 64},
                {**good, "HEBUN_MEDIA_STORE_MIN_FREE_BYTES": "-1"},
            ):
                with self.assertRaises(SystemExit) as ctx:
                    store.load_config(broken)
                self.assertNotIn("w" * 32, str(ctx.exception))
        finally:
            shutil.rmtree(root)

    def test_signing_vectors_are_stable(self):
        with open(VECTORS) as f:
            vectors = json.load(f)
        for v in vectors["write"]:
            c = store.write_canonical(v["method"], v["key"], v["timestamp"], v["nonce"], v["sha256Hex"],
                                      v["contentType"], v["contentLength"])
            self.assertEqual(store.sign(vectors["writeSecret"].encode(), c), v["signature"])
        for v in vectors["read"]:
            c = store.read_canonical(v["key"], v["contentType"], v["expires"])
            self.assertEqual(store.sign(vectors["readSecret"].encode(), c), v["signature"])


if __name__ == "__main__":
    unittest.main()
