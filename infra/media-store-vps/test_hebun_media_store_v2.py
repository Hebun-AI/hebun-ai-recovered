"""
MV-1 tests for hebun_media_store.py: streamed WRITE-V2, HEAD, single Range, probe boundary, orphan
temp cleanup, and the video firewall. Standard library only.

    python3 -m unittest infra/media-store-vps/test_hebun_media_store_v2.py

Real server on an ephemeral loopback port, throwaway secrets, temporary root. The probe is exercised
against a FAKE ffprobe (a script that records its argv and answers canned JSON) so the boundary —
fixed argv, file-protocol-only, inherited fd, timeout, bounded parse — is proven without a system
package. A real ffprobe, when one is on this machine, is exercised by the last case; otherwise that
case is skipped and says so.
"""

import hashlib
import http.client
import json
import os
import secrets
import shutil
import socket
import stat
import sys
import tempfile
import threading
import time
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hebun_media_store as store  # noqa: E402

VECTORS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "signing-vectors.json")

T1 = "0b6f3d9e-6c1a-4f5e-9d2b-3a4c5d6e7f80"
T2 = "1c7a4e0f-7d2b-4a6f-8e3c-4b5d6e7f8091"
A1 = "2d8b5f10-8e3c-4b70-9f4d-5c6e7f8091a2"
A2 = "3e9c6021-9f4d-4c81-a05e-6d7f8091a2b3"
PNG = b"\x89PNG\r\n\x1a\n" + bytes(range(256)) * 4
MP4 = b"\x00\x00\x00\x18ftypmp42" + b"\x00" * 200

FAKE_PROBE_JSON = {
    "format": {"format_name": "mov,mp4,m4a,3gp,3g2,mj2", "duration": "2.000000",
               "tags": {"title": "attacker text <script>"}, "filename": "/etc/passwd"},
    "streams": [
        {"codec_type": "video", "codec_name": "h264", "width": 320, "height": 240,
         "avg_frame_rate": "25/1", "tags": {"handler_name": "x"}},
        {"codec_type": "audio", "codec_name": "aac"},
    ],
}

FAKE_FFPROBE = """#!{python}
import json, os, sys, time
argv = sys.argv[1:]
with open({log!r}, "a") as log:
    log.write(json.dumps(argv) + "\\n")
target = argv[-1]
assert target.startswith("file:/dev/fd/"), target
assert argv[argv.index("-protocol_whitelist") + 1] == "file"
fd = int(target[len("file:/dev/fd/"):])
head = os.read(fd, 8)
if head.startswith(b"SLEEP"):
    time.sleep(30)
if head.startswith(b"BAD"):
    sys.stderr.write("Invalid data found when processing input\\n")
    sys.exit(1)
if head.startswith(b"HUGE"):
    sys.stdout.write("x" * (1024 * 1024))
    sys.exit(0)
sys.stdout.write({payload!r})
"""


def key(t, a):
    return f"tenants/{t}/media/{a}"


class V2TestCase(unittest.TestCase):
    enable_video = True

    def setUp(self):
        self.root = tempfile.mkdtemp(prefix="hebun-media-v2-")
        self.tools = tempfile.mkdtemp(prefix="hebun-media-v2-tools-")
        self.probe_log = os.path.join(self.tools, "argv.log")
        self.ffprobe = os.path.join(self.tools, "ffprobe")
        with open(self.ffprobe, "w") as f:
            f.write(FAKE_FFPROBE.format(python=sys.executable, log=self.probe_log,
                                        payload=json.dumps(FAKE_PROBE_JSON)))
        os.chmod(self.ffprobe, 0o755)
        self.write_secret = secrets.token_hex(32)
        self.read_secret = secrets.token_hex(32)
        self.now = time.time()
        self.start_server()

    def start_server(self):
        self.config = store.Config(self.root, self.write_secret.encode(), self.read_secret.encode(), 0,
                                   clock=lambda: self.now, v2_max_bytes=64 * 1024,
                                   enable_video=self.enable_video, ffprobe=self.ffprobe)
        self.server = store.build_server(self.config, "127.0.0.1", 0)
        self.port = self.server.server_address[1]
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def stop_server(self):
        self.server.shutdown()
        self.server.server_close()

    def tearDown(self):
        self.stop_server()
        shutil.rmtree(self.root, ignore_errors=True)
        shutil.rmtree(self.tools, ignore_errors=True)

    # ── helpers ──────────────────────────────────────────────────────────────
    def grant(self, k, ctype="image/png", expected="", max_bytes=4096, probe="none", ts=None,
              expires=None, nonce=None, secret=None):
        ts = str(int(self.now if ts is None else ts))
        expires = str(int(self.now + 120 if expires is None else expires))
        nonce = nonce or secrets.token_hex(16)
        canonical = store.write_v2_canonical(k, ts, nonce, ctype, str(expected), max_bytes, expires, probe)
        return {
            "Content-Type": ctype,
            "X-Hebun-Timestamp": ts,
            "X-Hebun-Nonce": nonce,
            "X-Hebun-Signature": store.sign((secret or self.write_secret).encode(), canonical),
            "X-Hebun-Expected-Length": str(expected),
            "X-Hebun-Max-Bytes": str(max_bytes),
            "X-Hebun-Expires": expires,
            "X-Hebun-Probe": probe,
        }

    def raw(self, request_bytes):
        """Send exact bytes, half-close, read the whole answer. For framing the client lib won't make."""
        s = socket.create_connection(("127.0.0.1", self.port), timeout=10)
        s.sendall(request_bytes)
        s.shutdown(socket.SHUT_WR)
        data = b""
        while True:
            part = s.recv(65536)
            if not part:
                break
            data += part
        s.close()
        head, _, body = data.partition(b"\r\n\r\n")
        status = int(head.split(b" ", 2)[1])
        return status, body

    def put_chunked(self, k, pieces, headers, terminate=True):
        lines = [f"PUT /v2/objects/{k} HTTP/1.1", "Host: x", "Transfer-Encoding: chunked"]
        lines += [f"{n}: {v}" for n, v in headers.items()]
        req = ("\r\n".join(lines) + "\r\n\r\n").encode()
        for p in pieces:
            req += f"{len(p):x}\r\n".encode() + p + b"\r\n"
        if terminate:
            req += b"0\r\n\r\n"
        return self.raw(req)

    def put_length(self, k, data, headers, declared=None):
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=10)
        h = dict(headers)
        h["Content-Length"] = str(len(data) if declared is None else declared)
        conn.request("PUT", f"/v2/objects/{k}", body=data, headers=h)
        resp = conn.getresponse()
        body = resp.read()
        conn.close()
        return resp.status, body

    def read_url(self, k, ctype="image/png", exp=None, secret=None):
        exp = str(int(self.now + 60 if exp is None else exp))
        sig = store.sign((secret or self.read_secret).encode(), store.read_canonical(k, ctype, exp))
        return f"/v1/read/{k}?ct={ctype.replace('/', '%2F')}&exp={exp}&sig={sig}"

    def get(self, path, method="GET", headers=None):
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=10)
        conn.request(method, path, headers=headers or {})
        resp = conn.getresponse()
        body = resp.read()
        conn.close()
        return resp.status, body, resp

    def object_path(self, t, a):
        return os.path.join(self.root, "tenants", t, "media", a)

    def media_dir_names(self, t):
        d = os.path.join(self.root, "tenants", t, "media")
        return sorted(os.listdir(d)) if os.path.isdir(d) else []

    def assert_absent(self, t, a):
        self.assertFalse(os.path.lexists(self.object_path(t, a)))
        self.assertEqual([n for n in self.media_dir_names(t) if n.startswith(".tmp-")], [])


class WriteV2(V2TestCase):
    def test_streamed_write_returns_server_measured_size_and_digest(self):
        k = key(T1, A1)
        status, body = self.put_chunked(k, [PNG[:100], PNG[100:700], PNG[700:]], self.grant(k))
        self.assertEqual(status, 201, body)
        answer = json.loads(body)
        self.assertEqual(answer, {"status": "stored", "byteSize": len(PNG),
                                  "sha256Hex": hashlib.sha256(PNG).hexdigest()})
        with open(self.object_path(T1, A1), "rb") as f:
            self.assertEqual(f.read(), PNG)
        self.assertEqual(stat.S_IMODE(os.stat(self.object_path(T1, A1)).st_mode), 0o440)
        self.assertEqual([n for n in self.media_dir_names(T1) if n.startswith(".tmp-")], [])

    def test_content_length_write_with_expected_size(self):
        k = key(T1, A1)
        status, body = self.put_length(k, PNG, self.grant(k, expected=len(PNG)))
        self.assertEqual(status, 201, body)
        self.assertEqual(json.loads(body)["byteSize"], len(PNG))

    def test_expected_size_mismatch_refused_nothing_visible(self):
        k = key(T1, A1)
        status, body = self.put_chunked(k, [PNG], self.grant(k, expected=len(PNG) + 1))
        self.assertEqual((status, json.loads(body)["error"]), (400, "size-mismatch"))
        self.assert_absent(T1, A1)
        status, body = self.put_chunked(k, [PNG], self.grant(k, expected=len(PNG) - 1))
        self.assertEqual((status, json.loads(body)["error"]), (413, "size-exceeded"))
        self.assert_absent(T1, A1)
        status, body = self.put_length(k, PNG, self.grant(k, expected=len(PNG) - 1))
        self.assertEqual((status, json.loads(body)["error"]), (400, "size-mismatch"))
        self.assert_absent(T1, A1)

    def test_max_size_exceeded_mid_stream_refused(self):
        k = key(T1, A1)
        status, body = self.put_chunked(k, [PNG[:600], PNG[600:]], self.grant(k, max_bytes=700))
        self.assertEqual((status, json.loads(body)["error"]), (413, "size-exceeded"))
        self.assert_absent(T1, A1)
        status, _ = self.put_length(k, PNG, self.grant(k, max_bytes=700))
        self.assertEqual(status, 413)
        self.assert_absent(T1, A1)

    def test_grant_ceiling_cannot_exceed_server_ceiling(self):
        k = key(T1, A1)
        status, body = self.put_chunked(k, [PNG], self.grant(k, max_bytes=64 * 1024 + 1))
        self.assertEqual((status, json.loads(body)["error"]), (413, "size-refused"))
        self.assert_absent(T1, A1)

    def test_interrupted_stream_leaves_nothing(self):
        k = key(T1, A1)
        status, body = self.put_chunked(k, [PNG[:300]], self.grant(k), terminate=False)
        self.assertEqual((status, json.loads(body)["error"]), (400, "body-truncated"))
        self.assert_absent(T1, A1)
        # Content-Length that promises more than arrives.
        headers = self.grant(k)
        lines = [f"PUT /v2/objects/{k} HTTP/1.1", "Host: x", f"Content-Length: {len(PNG)}"]
        lines += [f"{n}: {v}" for n, v in headers.items()]
        status, body = self.raw(("\r\n".join(lines) + "\r\n\r\n").encode() + PNG[:10])
        self.assertEqual((status, json.loads(body)["error"]), (400, "body-truncated"))
        self.assert_absent(T1, A1)

    def test_malformed_chunk_framing_refused(self):
        k = key(T1, A1)
        lines = [f"PUT /v2/objects/{k} HTTP/1.1", "Host: x", "Transfer-Encoding: chunked"]
        lines += [f"{n}: {v}" for n, v in self.grant(k).items()]
        status, body = self.raw(("\r\n".join(lines) + "\r\n\r\n").encode() + b"zz\r\nabc\r\n0\r\n\r\n")
        self.assertEqual((status, json.loads(body)["error"]), (400, "body-malformed"))
        self.assert_absent(T1, A1)

    def test_expired_and_overlong_grants_refused(self):
        k = key(T1, A1)
        for g in (self.grant(k, expires=self.now - 1),
                  self.grant(k, expires=self.now + store.WRITE_V2_MAX_TTL_SECONDS + 5),
                  self.grant(k, ts=self.now - 120), self.grant(k, ts=self.now + 120),
                  self.grant(k, ts=self.now - 30)):  # inside the skew window but signed before start
            status, _ = self.put_chunked(k, [PNG], g)
            self.assertEqual(status, 401)
        self.assert_absent(T1, A1)

    def test_tampered_key_type_and_size_constraints_refused(self):
        k = key(T1, A1)
        cases = []
        g = self.grant(key(T1, A2))
        cases.append((k, g))                                       # grant for another key
        g = self.grant(k); g["Content-Type"] = "image/jpeg"; cases.append((k, g))
        g = self.grant(k, max_bytes=700); g["X-Hebun-Max-Bytes"] = "4096"; cases.append((k, g))
        g = self.grant(k, expected=len(PNG)); g["X-Hebun-Expected-Length"] = ""; cases.append((k, g))
        g = self.grant(k); g["X-Hebun-Expires"] = str(int(self.now + 300)); cases.append((k, g))
        g = self.grant(k); g["X-Hebun-Probe"] = "required"; cases.append((k, g))
        cases.append((k, self.grant(k, secret=self.read_secret)))  # read secret cannot write
        for target, g in cases:
            status, _ = self.put_chunked(target, [PNG], g)
            self.assertEqual(status, 401, g)
        self.assert_absent(T1, A1)

    def test_replayed_nonce_refused(self):
        k = key(T1, A1)
        g = self.grant(k)
        self.assertEqual(self.put_chunked(k, [PNG], g)[0], 201)
        self.assertEqual(self.put_chunked(key(T1, A2), [PNG], {**g})[0], 401)

    def test_duplicate_final_key_refused_original_kept(self):
        k = key(T1, A1)
        self.assertEqual(self.put_chunked(k, [PNG], self.grant(k))[0], 201)
        status, body = self.put_chunked(k, [b"other bytes"], self.grant(k))
        self.assertEqual((status, json.loads(body)["error"]), (409, "key-exists"))
        with open(self.object_path(T1, A1), "rb") as f:
            self.assertEqual(f.read(), PNG)

    def test_v1_and_v2_share_one_write_once_namespace(self):
        k = key(T1, A1)
        self.assertEqual(self.put_chunked(k, [PNG], self.grant(k))[0], 201)
        sha = hashlib.sha256(PNG).hexdigest()
        ts, nonce = str(int(self.now)), secrets.token_hex(16)
        sig = store.sign(self.write_secret.encode(),
                         store.write_canonical("PUT", k, ts, nonce, sha, "image/png", len(PNG)))
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=10)
        conn.request("PUT", f"/v1/objects/{k}", body=PNG, headers={
            "Content-Type": "image/png", "Content-Length": str(len(PNG)), "X-Hebun-Content-SHA256": sha,
            "X-Hebun-Timestamp": ts, "X-Hebun-Nonce": nonce, "X-Hebun-Signature": sig})
        self.assertEqual(conn.getresponse().status, 409)
        conn.close()

    def test_path_traversal_and_noncanonical_keys_refused(self):
        for bad in ("tenants/../../etc/media/" + A1, f"tenants/{T1}/media/../{A2}",
                    f"tenants/{T1.upper()}/media/{A1}", f"tenants/{T1}/media/{A1}/x"):
            status, _ = self.put_chunked(bad, [PNG], self.grant(bad))
            self.assertIn(status, (400, 404))
        self.assertFalse(os.path.exists(os.path.join(self.root, "etc")))

    def test_symlink_attack_refused(self):
        outside = tempfile.mkdtemp(prefix="hebun-outside-")
        try:
            os.makedirs(os.path.join(self.root, "tenants"))
            os.symlink(outside, os.path.join(self.root, "tenants", T1))
            k = key(T1, A1)
            status, _ = self.put_chunked(k, [PNG], self.grant(k))
            self.assertEqual(status, 500)
            self.assertEqual(os.listdir(outside), [])
            os.makedirs(os.path.join(self.root, "tenants", T2, "media"))
            os.symlink(os.path.join(outside, "target"), self.object_path(T2, A1))
            k2 = key(T2, A1)
            status, _ = self.put_chunked(k2, [PNG], self.grant(k2))
            self.assertEqual(status, 409)  # an existing name, symlink or not, is never replaced
            self.assertFalse(os.path.exists(os.path.join(outside, "target")))
        finally:
            shutil.rmtree(outside, ignore_errors=True)

    def test_cross_tenant_key_substitution_refused(self):
        g = self.grant(key(T1, A1))
        status, _ = self.put_chunked(key(T2, A1), [PNG], g)
        self.assertEqual(status, 401)
        self.assert_absent(T2, A1)
        self.assert_absent(T1, A1)

    def test_request_without_framing_refused(self):
        k = key(T1, A1)
        lines = [f"PUT /v2/objects/{k} HTTP/1.1", "Host: x"] + [f"{n}: {v}" for n, v in self.grant(k).items()]
        status, _ = self.raw(("\r\n".join(lines) + "\r\n\r\n").encode())
        self.assertEqual(status, 411)
        lines = [f"PUT /v2/objects/{k} HTTP/1.1", "Host: x", "Transfer-Encoding: gzip, chunked"]
        lines += [f"{n}: {v}" for n, v in self.grant(k).items()]
        status, _ = self.raw(("\r\n".join(lines) + "\r\n\r\n0\r\n\r\n").encode())
        self.assertEqual(status, 400)


class VideoFirewall(V2TestCase):
    enable_video = False

    def test_video_refused_by_default_for_write_and_read(self):
        k = key(T1, A1)
        status, body = self.put_chunked(k, [MP4], self.grant(k, ctype="video/mp4"))
        self.assertEqual((status, json.loads(body)["error"]), (415, "content-type-refused"))
        self.assert_absent(T1, A1)
        self.assertEqual(self.get(self.read_url(k, ctype="video/mp4"))[0], 403)
        self.assertEqual(self.get(self.read_url(k, ctype="video/mp4"), method="HEAD")[0], 403)

    def test_load_config_keeps_video_off_unless_explicit(self):
        base = {"HEBUN_MEDIA_STORE_ROOT": self.root, "HEBUN_MEDIA_STORE_WRITE_SECRET": "w" * 40,
                "HEBUN_MEDIA_STORE_READ_SECRET": "r" * 40}
        self.assertNotIn("video/mp4", store.load_config(base).content_types)
        self.assertEqual(store.load_config(base).v2_max_bytes, store.MAX_BYTE_SIZE)
        self.assertIn("video/mp4", store.load_config({**base, "HEBUN_MEDIA_STORE_ENABLE_VIDEO": "1"}).content_types)
        for bad in ({"HEBUN_MEDIA_STORE_ENABLE_VIDEO": "yes"}, {"HEBUN_MEDIA_STORE_V2_MAX_BYTES": "0"},
                    {"HEBUN_MEDIA_STORE_FFPROBE": "ffprobe"}):
            with self.assertRaises(SystemExit):
                store.load_config({**base, **bad})


class ReadV2(V2TestCase):
    def setUp(self):
        super().setUp()
        self.k = key(T1, A1)
        assert self.put_chunked(self.k, [PNG], self.grant(self.k))[0] == 201

    def test_normal_get_is_200_with_accept_ranges(self):
        status, body, resp = self.get(self.read_url(self.k))
        self.assertEqual((status, body), (200, PNG))
        self.assertEqual(resp.getheader("Accept-Ranges"), "bytes")
        self.assertEqual(resp.getheader("Content-Length"), str(len(PNG)))

    def test_head_matches_get_headers_without_body(self):
        status, body, resp = self.get(self.read_url(self.k), method="HEAD")
        self.assertEqual((status, body), (200, b""))
        self.assertEqual(resp.getheader("Content-Length"), str(len(PNG)))
        self.assertEqual(resp.getheader("Content-Type"), "image/png")
        self.assertEqual(resp.getheader("Accept-Ranges"), "bytes")

    def test_head_requires_the_same_grant(self):
        absent = key(T1, A2)
        for path in (self.read_url(self.k, exp=self.now - 1), self.read_url(self.k, secret=self.write_secret),
                     self.read_url(self.k, ctype="image/jpeg").replace("image%2Fjpeg", "image%2Fpng"),
                     f"/v1/read/{self.k}", self.read_url(absent, exp=self.now - 1)):
            self.assertEqual(self.get(path, method="HEAD")[0], 403, path)
        # Existence is only revealed under a valid grant.
        self.assertEqual(self.get(self.read_url(absent), method="HEAD")[0], 404)
        self.assertEqual(self.get("/v1/verify/" + self.k, method="HEAD")[0], 404)
        self.assertEqual(self.get("/v2/objects/" + self.k, method="HEAD")[0], 404)

    def test_valid_single_ranges_are_206(self):
        n = len(PNG)
        for header, (a, b) in (("bytes=0-9", (0, 9)), ("bytes=10-", (10, n - 1)), ("bytes=-5", (n - 5, n - 1)),
                               ("bytes=100-99999", (100, n - 1)), ("bytes=-99999", (0, n - 1))):
            status, body, resp = self.get(self.read_url(self.k), headers={"Range": header})
            self.assertEqual(status, 206, header)
            self.assertEqual(body, PNG[a:b + 1], header)
            self.assertEqual(resp.getheader("Content-Range"), f"bytes {a}-{b}/{n}")
            self.assertEqual(resp.getheader("Content-Length"), str(b - a + 1))
            self.assertEqual(resp.getheader("Accept-Ranges"), "bytes")

    def test_invalid_and_unsatisfiable_ranges_are_416(self):
        n = len(PNG)
        for header in (f"bytes={n}-", f"bytes={n + 10}-{n + 20}", "bytes=5-2", "bytes=-0", "bytes=-",
                       "bytes=0-1,4-5", "items=0-1", "bytes=a-b", "bytes= 0-1x"):
            status, body, resp = self.get(self.read_url(self.k), headers={"Range": header})
            self.assertEqual(status, 416, header)
            self.assertEqual(body, b"")
            self.assertEqual(resp.getheader("Content-Range"), f"bytes */{n}")

    def test_unauthorized_range_reveals_nothing(self):
        status, body, resp = self.get(self.read_url(self.k, exp=self.now - 1), headers={"Range": "bytes=0-3"})
        self.assertEqual(status, 403)
        self.assertIsNone(resp.getheader("Content-Range"))
        self.assertNotIn(PNG[:4], body)
        status, _, _ = self.get(self.read_url(self.k, exp=self.now - 1), headers={"Range": "bytes=99999-"})
        self.assertEqual(status, 403)

    def test_expired_signed_read_refused(self):
        url = self.read_url(self.k, exp=self.now + 5)
        self.assertEqual(self.get(url)[0], 200)
        self.now += 10
        self.assertEqual(self.get(url)[0], 403)
        self.assertEqual(self.get(url, headers={"Range": "bytes=0-1"})[0], 403)


class ReadContentTypeBinding(V2TestCase):
    """MV-3: a validly signed grant for the WRONG type of an existing object is refused (403) on GET,
    HEAD and Range alike. The object's own bytes are the type truth; READ-V1 is unchanged."""

    JPEG = b"\xff\xd8\xff\xe0" + bytes(range(256))
    WEBP = b"RIFF\x00\x01\x00\x00WEBPVP8 " + bytes(range(256))
    IDS = {"image/png": A1, "image/jpeg": A2,
           "image/webp": "4fad7132-a05e-4d92-b16f-7e8091a2b3c4", "video/mp4": "5abe8243-b16f-4ea3-8270-8f91a2b3c4d5"}

    def setUp(self):
        super().setUp()
        self.bodies = {"image/png": PNG, "image/jpeg": self.JPEG, "image/webp": self.WEBP, "video/mp4": MP4}
        for ct, a in self.IDS.items():
            k = key(T1, a)
            assert self.put_chunked(k, [self.bodies[ct]], self.grant(k, ctype=ct))[0] == 201, ct

    def test_matching_type_is_served_on_get_head_and_range(self):
        for ct, a in self.IDS.items():
            url, body = self.read_url(key(T1, a), ctype=ct), self.bodies[ct]
            status, data, resp = self.get(url)
            self.assertEqual((status, data, resp.getheader("Content-Type")), (200, body, ct), ct)
            status, data, resp = self.get(url, method="HEAD")
            self.assertEqual((status, data, resp.getheader("Content-Length")), (200, b"", str(len(body))), ct)
            status, data, resp = self.get(url, headers={"Range": "bytes=0-9"})
            self.assertEqual((status, data), (206, body[:10]), ct)
            self.assertEqual(self.get(url, headers={"Range": f"bytes={len(body)}-"})[0], 416, ct)

    def test_wrongly_typed_grant_is_refused_everywhere(self):
        for ct, a in self.IDS.items():
            for wrong in self.IDS:
                if wrong == ct:
                    continue
                url, body = self.read_url(key(T1, a), ctype=wrong), self.bodies[ct]
                label = f"{ct} signed as {wrong}"
                for method, headers in (("GET", {}), ("HEAD", {}), ("GET", {"Range": "bytes=0-9"}),
                                        ("GET", {"Range": f"bytes={len(body)}-"}), ("HEAD", {"Range": "bytes=0-9"})):
                    status, data, resp = self.get(url, method=method, headers=headers)
                    self.assertEqual(status, 403, f"{label} {method} {headers}")
                    self.assertIsNone(resp.getheader("Content-Range"), label)
                    self.assertNotIn(body[:8], data, label)

    def test_video_grant_refusals_unchanged(self):
        k = key(T1, self.IDS["video/mp4"])
        for path in (f"/v1/read/{k}", self.read_url(k, ctype="video/mp4", exp=self.now - 1),
                     self.read_url(k, ctype="video/mp4", secret=self.write_secret)):
            self.assertEqual(self.get(path)[0], 403, path)
            self.assertEqual(self.get(path, method="HEAD")[0], 403, path)
            self.assertEqual(self.get(path, headers={"Range": "bytes=0-1"})[0], 403, path)

    def test_bite_proof_the_guard_is_what_refuses(self):
        # Mutation: disable the byte/type check. The production failure (image/jpeg grant → 200 on an
        # MP4) must come back, proving the refusal above is this guard and nothing else.
        k = key(T1, self.IDS["video/mp4"])
        url = self.read_url(k, ctype="image/jpeg")
        self.assertEqual(self.get(url)[0], 403)
        original = store.object_matches_content_type
        store.object_matches_content_type = lambda head, ct: True
        try:
            status, data, resp = self.get(url)
            self.assertEqual((status, data, resp.getheader("Content-Type")), (200, MP4, "image/jpeg"))
        finally:
            store.object_matches_content_type = original
        self.assertEqual(self.get(url)[0], 403)

    def test_signature_table(self):
        m = store.object_matches_content_type
        self.assertTrue(m(PNG[:12], "image/png"))
        self.assertTrue(m(self.JPEG[:12], "image/jpeg"))
        self.assertTrue(m(self.WEBP[:12], "image/webp"))
        self.assertTrue(m(MP4[:12], "video/mp4"))
        self.assertFalse(m(b"RIFF\x00\x00\x00\x00AVI ", "image/webp"))
        for ct in ("image/png", "image/jpeg", "image/webp", "video/mp4"):
            self.assertFalse(m(b"", ct), ct)
            self.assertFalse(m(b"\x00" * 12, ct), ct)
        self.assertFalse(m(PNG[:12], "application/octet-stream"))


class Probe(V2TestCase):
    def read_probe_argv(self):
        with open(self.probe_log) as f:
            return [json.loads(line) for line in f]

    def test_required_probe_returns_allowlisted_facts(self):
        k = key(T1, A1)
        status, body = self.put_chunked(k, [MP4], self.grant(k, ctype="video/mp4", probe="required"))
        self.assertEqual(status, 201, body)
        answer = json.loads(body)
        self.assertEqual(answer["byteSize"], len(MP4))
        self.assertEqual(answer["probe"], {
            "container": "mov,mp4,m4a,3gp,3g2,mj2", "durationSeconds": 2.0,
            "video": {"codec": "h264", "width": 320, "height": 240, "frameRate": "25/1"},
            "audio": {"codec": "aac"}})
        self.assertNotIn("attacker", body.decode())
        self.assertNotIn("passwd", body.decode())
        argv = self.read_probe_argv()[0]
        self.assertEqual(argv[:10], ["-v", "error", "-hide_banner", "-protocol_whitelist", "file",
                                     "-format_whitelist", store.PROBE_FORMATS, "-print_format", "json",
                                     "-show_format"])
        self.assertRegex(argv[-1], r"^file:/dev/fd/[0-9]+$")

    def test_probe_not_run_unless_granted(self):
        k = key(T1, A1)
        status, body = self.put_chunked(k, [MP4], self.grant(k, ctype="video/mp4"))
        self.assertEqual(status, 201)
        self.assertNotIn("probe", json.loads(body))
        self.assertFalse(os.path.exists(self.probe_log))

    def test_malformed_media_fails_closed(self):
        k = key(T1, A1)
        status, body = self.put_chunked(k, [b"BAD" + MP4], self.grant(k, ctype="video/mp4", probe="required"))
        self.assertEqual((status, json.loads(body)["error"]), (422, "probe-failed"))
        self.assert_absent(T1, A1)

    def test_oversized_probe_output_fails_closed(self):
        k = key(T1, A1)
        status, body = self.put_chunked(k, [b"HUGE" + MP4], self.grant(k, ctype="video/mp4", probe="required"))
        self.assertEqual((status, json.loads(body)["error"]), (422, "probe-failed"))
        self.assert_absent(T1, A1)

    def test_timeout_fails_closed(self):
        k = key(T1, A1)
        original = store.PROBE_TIMEOUT_SECONDS
        store.PROBE_TIMEOUT_SECONDS = 1
        try:
            status, body = self.put_chunked(k, [b"SLEEP" + MP4], self.grant(k, ctype="video/mp4", probe="required"))
        finally:
            store.PROBE_TIMEOUT_SECONDS = original
        self.assertEqual((status, json.loads(body)["error"]), (422, "probe-timeout"))
        self.assert_absent(T1, A1)

    def test_missing_ffprobe_fails_closed(self):
        os.unlink(self.ffprobe)
        k = key(T1, A1)
        status, body = self.put_chunked(k, [MP4], self.grant(k, ctype="video/mp4", probe="required"))
        self.assertEqual((status, json.loads(body)["error"]), (503, "probe-unavailable"))
        self.assert_absent(T1, A1)

    def test_no_url_or_protocol_can_reach_the_probe(self):
        # The only probe input is the write body; the probe target is always the store's own fd.
        k = key(T1, A1)
        body = b"https://example.invalid/x.m3u8\nconcat:/etc/passwd|/etc/hosts\n"
        status, _ = self.put_chunked(k, [body], self.grant(k, ctype="video/mp4", probe="required"))
        self.assertEqual(status, 201)
        argv = self.read_probe_argv()[0]
        self.assertTrue(all("http" not in a and "concat" not in a for a in argv))
        self.assertRegex(argv[-1], r"^file:/dev/fd/[0-9]+$")
        # A probe mode outside the allowlist is not a grant.
        g = self.grant(k, probe="none")
        g["X-Hebun-Probe"] = "https://example.invalid"
        self.assertEqual(self.put_chunked(key(T1, A2), [MP4], g)[0], 401)

    def test_parser_drops_everything_not_allowlisted(self):
        parsed = store.parse_probe(json.dumps({
            "format": {"format_name": "mov,mp4", "duration": "N/A"},
            "streams": [{"codec_type": "video", "codec_name": "h264; rm -rf /", "width": 10},
                        {"codec_type": "video", "codec_name": "hevc", "width": -1, "height": True,
                         "avg_frame_rate": "../../x"}]}).encode())
        self.assertEqual(parsed, {"container": "mov,mp4", "durationSeconds": None,
                                  "video": {"codec": "hevc", "width": None, "height": None, "frameRate": None},
                                  "audio": None})
        for bad in (b"not json", b"[]", b'{"format": {"format_name": "a b"}}', b'{"streams": []}'):
            with self.assertRaises(store.StoreError):
                store.parse_probe(bad)

    @unittest.skipUnless(os.path.exists(os.environ.get("HEBUN_TEST_FFPROBE", "/nonexistent"))
                         and os.environ.get("HEBUN_TEST_MP4_FIXTURE"),
                         "no real ffprobe/fixture on this machine (HEBUN_TEST_FFPROBE, HEBUN_TEST_MP4_FIXTURE)")
    def test_real_ffprobe_on_synthetic_fixture(self):
        self.config.ffprobe = os.environ["HEBUN_TEST_FFPROBE"]
        with open(os.environ["HEBUN_TEST_MP4_FIXTURE"], "rb") as f:
            data = f.read()
        k = key(T1, A1)
        status, body = self.put_chunked(k, [data], self.grant(k, ctype="video/mp4", probe="required",
                                                               max_bytes=len(data)))
        self.assertEqual(status, 201, body)
        self.assertIsNotNone(json.loads(body)["probe"]["video"])


class OrphanTemps(V2TestCase):
    def test_startup_removes_only_temp_regular_files(self):
        k = key(T1, A1)
        self.assertEqual(self.put_chunked(k, [PNG], self.grant(k))[0], 201)
        self.stop_server()
        media = os.path.join(self.root, "tenants", T1, "media")
        with open(os.path.join(media, ".tmp-orphan"), "wb") as f:
            f.write(b"partial")
        outside = tempfile.mkdtemp(prefix="hebun-outside-")
        try:
            victim = os.path.join(outside, "keep")
            open(victim, "w").close()
            os.symlink(victim, os.path.join(media, ".tmp-link"))
            self.start_server()
            names = os.listdir(media)
            self.assertNotIn(".tmp-orphan", names)
            self.assertIn(A1, names)
            self.assertTrue(os.path.exists(victim))
        finally:
            shutil.rmtree(outside, ignore_errors=True)


class Vectors(unittest.TestCase):
    def test_write_v2_vector_is_stable(self):
        with open(VECTORS) as f:
            vectors = json.load(f)
        for v in vectors["writeV2"]:
            c = store.write_v2_canonical(v["key"], v["timestamp"], v["nonce"], v["contentType"],
                                         v["expectedLength"], v["maxBytes"], v["expires"], v["probe"])
            self.assertEqual(store.sign(vectors["writeSecret"].encode(), c), v["signature"])


if __name__ == "__main__":
    unittest.main()
