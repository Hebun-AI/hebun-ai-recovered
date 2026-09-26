"""
MV-5 DERIVE-V1 — the store's one closed transform, against a REAL ffmpeg/ffprobe (skipped when absent).

Fixtures are synthesised with ffmpeg's lavfi sources, so nothing binary is checked in. Set
HEBUN_TEST_FFMPEG / HEBUN_TEST_FFPROBE to pin binaries (the Docker sandbox proof does).
"""
import hashlib
import http.client
import json
import os
import secrets
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hebun_media_store as store  # noqa: E402

FFMPEG = os.environ.get("HEBUN_TEST_FFMPEG") or shutil.which("ffmpeg") or ""
FFPROBE = os.environ.get("HEBUN_TEST_FFPROBE") or shutil.which("ffprobe") or ""
REAL = bool(FFMPEG and FFPROBE)

T1 = "0b6f3d9e-6c1a-4f5e-9d2b-3a4c5d6e7f80"
T2 = "1c7a4e0f-7d2b-4a6f-8e3c-4b5d6e7f8091"
SRC = "2d8b5f10-8e3c-4b70-9f4d-5c6e7f8091a2"
DST = "3e9c6021-9f4d-4c81-a05e-6d7f8091a2b3"
DST2 = "4fad7132-a05e-4d92-b16f-7e8091a2b3c4"
FIXTURES: dict = {}


def key(t, a):
    return f"tenants/{t}/media/{a}"


def synth(name, video, audio=True, seconds=2, extra=()):
    """A small MP4 made by ffmpeg itself."""
    if name in FIXTURES:
        return FIXTURES[name]
    out = os.path.join(tempfile.gettempdir(), f"hebun-mv5-{name}-{os.getpid()}.mp4")
    argv = [FFMPEG, "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
            "-f", "lavfi", "-i", f"testsrc2={video}:rate=25:duration={seconds}"]
    if audio:
        argv += ["-f", "lavfi", "-i", f"sine=frequency=440:duration={seconds}", "-c:a", "aac"]
    argv += ["-c:v", "libx264", *extra, "-metadata", "title=secret-camera-serial-123", out]
    subprocess.run(argv, check=True)
    with open(out, "rb") as f:
        FIXTURES[name] = f.read()
    os.unlink(out)
    return FIXTURES[name]


def box_order(data):
    """Top-level ISO-BMFF box types in order."""
    i, order = 0, []
    while i + 8 <= len(data):
        size = int.from_bytes(data[i:i + 4], "big")
        order.append(data[i + 4:i + 8].decode("latin-1"))
        if size < 8:
            break
        i += size
    return order


class DeriveCase(unittest.TestCase):
    enable_video = True
    ffmpeg_override = None
    derive_timeout = store.DERIVE_TIMEOUT_SECONDS
    v2_max = store.MAX_BYTE_SIZE

    def setUp(self):
        self.root = tempfile.mkdtemp(prefix="hebun-mv5-")
        self.write_secret = secrets.token_hex(32)
        self.read_secret = secrets.token_hex(32)
        self.now = time.time()
        self.config = store.Config(self.root, self.write_secret.encode(), self.read_secret.encode(), 0,
                                   clock=lambda: self.now, v2_max_bytes=self.v2_max,
                                   enable_video=self.enable_video, ffprobe=FFPROBE or "/nonexistent",
                                   ffmpeg=self.ffmpeg_override or FFMPEG or "/nonexistent",
                                   derive_timeout=self.derive_timeout)
        self.server = store.build_server(self.config, "127.0.0.1", 0)
        self.port = self.server.server_address[1]
        threading.Thread(target=self.server.serve_forever, daemon=True).start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        shutil.rmtree(self.root, ignore_errors=True)

    def place(self, t, a, data):
        d = os.path.join(self.root, "tenants", t, "media")
        os.makedirs(d, exist_ok=True)
        p = os.path.join(d, a)
        with open(p, "wb") as f:
            f.write(data)
        os.chmod(p, 0o440)
        return p

    def path(self, t, a):
        return os.path.join(self.root, "tenants", t, "media", a)

    def grant(self, dest, source, derivation="mp4-normalize-v1", ts=None, expires=None, nonce=None, secret=None):
        ts = str(int(self.now if ts is None else ts))
        expires = str(int(self.now + 120 if expires is None else expires))
        nonce = nonce or secrets.token_hex(16)
        sig = store.sign((secret or self.write_secret).encode(),
                         store.derive_canonical(dest, source, derivation, ts, nonce, expires))
        return {"X-Hebun-Timestamp": ts, "X-Hebun-Nonce": nonce, "X-Hebun-Signature": sig,
                "X-Hebun-Expires": expires, "X-Hebun-Source-Key": source, "X-Hebun-Derivation": derivation,
                "Content-Length": "0"}

    def post(self, dest, headers, body=b"", path=None):
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=180)
        conn.request("POST", path or f"/v2/derive/{dest}", body=body, headers=headers)
        resp = conn.getresponse()
        data = resp.read()
        conn.close()
        return resp.status, json.loads(data or b"{}"), data

    def derive(self, source_t=T1, source_a=SRC, dest_t=T1, dest_a=DST, **kw):
        s, d = key(source_t, source_a), key(dest_t, dest_a)
        return self.post(d, self.grant(d, s, **kw))

    def temps(self, t=T1):
        d = os.path.join(self.root, "tenants", t, "media")
        return [n for n in os.listdir(d) if n.startswith(".tmp-")] if os.path.isdir(d) else []


@unittest.skipUnless(REAL, "real ffmpeg/ffprobe not available")
class NormalizeProfile(DeriveCase):
    def test_landscape_with_audio_normalizes_to_the_profile(self):
        src = synth("hd-audio", "size=1280x720")
        before = hashlib.sha256(src).hexdigest()
        self.place(T1, SRC, src)
        status, body, raw = self.derive()
        self.assertEqual(status, 201, body)
        with open(self.path(T1, DST), "rb") as f:
            out = f.read()
        self.assertEqual(body["byteSize"], len(out))
        self.assertEqual(body["sha256Hex"], hashlib.sha256(out).hexdigest(), "facts are the STORED bytes")
        p = body["probe"]
        self.assertIn("mp4", p["container"].split(","))
        self.assertEqual(p["video"]["codec"], "h264")
        self.assertEqual((p["video"]["width"], p["video"]["height"]), (1280, 720), "no rescale needed, none done")
        self.assertEqual(p["audio"]["codec"], "aac")
        self.assertLess(abs(p["durationSeconds"] - 2.0), 0.25)
        order = box_order(out)
        self.assertLess(order.index("moov"), order.index("mdat"), f"faststart: moov before mdat ({order})")
        self.assertNotIn(b"secret-camera-serial-123", out, "metadata stripped")
        self.assertEqual(oct(os.stat(self.path(T1, DST)).st_mode & 0o777), "0o440")
        with open(self.path(T1, SRC), "rb") as f:
            self.assertEqual(hashlib.sha256(f.read()).hexdigest(), before, "the source is byte-identical")
        self.assertEqual(self.temps(), [])
        self.assertNotIn(self.write_secret.encode(), raw)
        pix = subprocess.run([FFPROBE, "-v", "error", "-select_streams", "v:0", "-show_entries",
                              "stream=pix_fmt,profile", "-of", "json", self.path(T1, DST)],
                             capture_output=True, check=True).stdout
        self.assertEqual(json.loads(pix)["streams"][0]["pix_fmt"], "yuv420p")

    def test_large_source_is_bounded_to_1920_preserving_aspect(self):
        self.place(T1, SRC, synth("qhd", "size=2560x1440", audio=False, seconds=1))
        status, body, _ = self.derive()
        self.assertEqual(status, 201, body)
        self.assertEqual((body["probe"]["video"]["width"], body["probe"]["video"]["height"]), (1920, 1080))
        self.assertIsNone(body["probe"]["audio"], "a silent source gets no synthetic audio track")

    def test_portrait_source_bounds_its_long_side(self):
        self.place(T1, SRC, synth("portrait", "size=1080x2400", audio=False, seconds=1))
        status, body, _ = self.derive()
        self.assertEqual(status, 201, body)
        w, h = body["probe"]["video"]["width"], body["probe"]["video"]["height"]
        self.assertEqual(h, 1920)
        self.assertEqual(w % 2, 0)
        self.assertLess(abs(w / h - 1080 / 2400), 0.01)

    def test_odd_dimensions_become_even_and_small_is_never_upscaled(self):
        self.place(T1, SRC, synth("odd", "size=321x241", audio=False, seconds=1, extra=("-pix_fmt", "yuv444p")))
        status, body, _ = self.derive()
        self.assertEqual(status, 201, body)
        w, h = body["probe"]["video"]["width"], body["probe"]["video"]["height"]
        self.assertTrue(w % 2 == 0 and h % 2 == 0, (w, h))
        self.assertTrue(w <= 321 and h <= 241, "never upscaled")

    def test_write_once_and_repeat_leaves_source_and_result_intact(self):
        src = synth("hd-audio", "size=1280x720")
        self.place(T1, SRC, src)
        self.assertEqual(self.derive()[0], 201)
        with open(self.path(T1, DST), "rb") as f:
            first = f.read()
        status, body, _ = self.derive()
        self.assertEqual((status, body), (409, {"error": "key-exists"}), "the destination is never overwritten")
        with open(self.path(T1, DST), "rb") as f:
            self.assertEqual(f.read(), first)
        # Informational only: determinism is NOT a correctness requirement (Director decision).
        status, body, _ = self.derive(dest_a=DST2)
        self.assertEqual(status, 201)
        print(f"\n  [info] repeat derivation byte-identical on this runtime: "
              f"{body['sha256Hex'] == hashlib.sha256(first).hexdigest()}")
        with open(self.path(T1, SRC), "rb") as f:
            self.assertEqual(f.read(), src)

    def test_garbage_with_an_mp4_header_fails_and_leaves_nothing(self):
        self.place(T1, SRC, b"\x00\x00\x00\x18ftypmp42" + os.urandom(4096))
        status, body, _ = self.derive()
        self.assertEqual((status, body), (422, {"error": "derive-failed"}))
        self.assertFalse(os.path.lexists(self.path(T1, DST)))
        self.assertEqual(self.temps(), [])

    def test_source_that_is_not_mp4_is_refused_before_ffmpeg(self):
        self.place(T1, SRC, b"\x89PNG\r\n\x1a\n" + b"\x00" * 64)
        self.assertEqual(self.derive()[:2], (422, {"error": "source-not-mp4"}))


class Protocol(DeriveCase):
    """Grant and key checks. None of these reach ffmpeg."""

    def setUp(self):
        super().setUp()
        self.place(T1, SRC, b"\x00\x00\x00\x18ftypmp42" + b"\x00" * 64)

    def assert_nothing(self):
        self.assertFalse(os.path.lexists(self.path(T1, DST)))
        self.assertFalse(os.path.isdir(os.path.join(self.root, "tenants", T2)))

    def test_tampered_grants_are_refused(self):
        s, d = key(T1, SRC), key(T1, DST)
        cases = []
        g = self.grant(d, s); g["X-Hebun-Source-Key"] = key(T1, DST2); cases.append((d, g))
        g = self.grant(d, s); g["X-Hebun-Derivation"] = "mp4-normalize-v2"; cases.append((d, g))
        g = self.grant(d, s); cases.append((key(T1, DST2), g))
        g = self.grant(d, s); g["X-Hebun-Expires"] = str(int(self.now) + 300); cases.append((d, g))
        cases.append((d, self.grant(d, s, secret=self.read_secret)))
        cases.append((d, self.grant(d, s, expires=self.now - 1)))
        cases.append((d, self.grant(d, s, expires=self.now + store.DERIVE_MAX_TTL_SECONDS + 5)))
        cases.append((d, self.grant(d, s, ts=self.now - store.CLOCK_SKEW_SECONDS - 5)))
        g = self.grant(d, s); g["X-Hebun-Signature"] = "0" * 64; cases.append((d, g))
        g = self.grant(d, s); del g["X-Hebun-Signature"]; cases.append((d, g))
        for dest, g in cases:
            status, body, raw = self.post(dest, g)
            self.assertEqual((status, body), (401, {"error": "unauthorized"}), g)
            self.assertNotIn(self.write_secret.encode(), raw)
        self.assert_nothing()

    def test_unauthenticated_callers_learn_syntax_only(self):
        """
        Same contract as WRITE-V1/V2: framing and key SYNTAX are refused before authentication (400),
        exactly as documented; nothing about existence, tenancy or the derivation set is answered
        until the signature holds.
        """
        unsigned = {"Content-Length": "0", "X-Hebun-Derivation": "mp4-normalize-v1"}
        d = key(T1, DST)
        for source, why in ((key(T1, DST2), "absent source"), (key(T2, SRC), "cross-tenant source"),
                            (key(T1, SRC), "present source")):
            status, body, _ = self.post(d, {**unsigned, "X-Hebun-Source-Key": source})
            self.assertEqual((status, body), (401, {"error": "unauthorized"}), f"unsigned, {why}")
        status, body, _ = self.post(d, {**unsigned, "X-Hebun-Source-Key": key(T1, SRC), "X-Hebun-Derivation": "x-unknown"})
        self.assertEqual((status, body), (401, {"error": "unauthorized"}), "unsigned, unknown derivation")
        s, _ = key(T1, SRC), None
        g = self.grant(d, key(T1, SRC)); g["X-Hebun-Signature"] = "f" * 64
        self.assertEqual(self.post(d, g)[:2], (401, {"error": "unauthorized"}), "forged signature, canonical keys")
        for headers, why in (({"Content-Length": "0"}, "no source header"),
                             ({**unsigned, "X-Hebun-Source-Key": "tenants/x/media/y"}, "malformed source")):
            self.assertEqual(self.post(d, headers)[:2], (400, {"error": "invalid-key"}), why)
        self.assert_nothing()

    def test_replayed_nonce_refused(self):
        s, d = key(T1, SRC), key(T1, DST)
        g = self.grant(d, s)
        self.assertNotEqual(self.post(d, g)[0], 401)
        self.assertEqual(self.post(d, {**g})[:2], (401, {"error": "unauthorized"}), "the exact same grant, replayed")

    def test_a_signed_unknown_derivation_is_refused(self):
        for name in ("mp4-normalize-v2", "scale", "x"):
            self.assertEqual(self.derive(derivation=name)[:2], (400, {"error": "derivation-unknown"}), name)
        s, d = key(T1, SRC), key(T1, DST)
        for name in ("-vf evil", "../x", "MP4-NORMALIZE-V1", "a" * 41, ""):
            self.assertEqual(self.post(d, self.grant(d, s, derivation=name))[0], 401, name)
        self.assert_nothing()

    def test_keys_are_canonical_same_tenant_and_distinct(self):
        self.assertEqual(self.derive(dest_t=T2)[:2], (403, {"error": "cross-tenant-refused"}))
        self.assertEqual(self.derive(dest_a=SRC)[:2], (400, {"error": "source-is-destination"}))
        for bad in ("tenants/../media/x", f"tenants/{T1}/media/{SRC}/../{DST}", f"/etc/passwd",
                    f"tenants/{T1}/media/{SRC.upper()}", f"tenants/{T1}/media/{SRC}%00"):
            d = key(T1, DST)
            self.assertEqual(self.post(d, self.grant(d, bad))[0], 400, bad)
            self.assertIn(self.post(bad, self.grant(bad, key(T1, SRC)), path=f"/v2/derive/{bad}")[0], (400, 404), bad)
        self.assert_nothing()

    def test_body_and_query_are_refused(self):
        s, d = key(T1, SRC), key(T1, DST)
        g = self.grant(d, s); g["Content-Length"] = "4"
        self.assertEqual(self.post(d, g, body=b"-vf ")[0], 400)
        self.assertEqual(self.post(d, self.grant(d, s), path=f"/v2/derive/{d}?x=1")[0], 405)
        self.assert_nothing()

    def test_absent_source(self):
        self.assertEqual(self.derive(source_a=DST2)[:2], (404, {"error": "source-absent"}))

    def test_symlinked_source_is_never_followed(self):
        target = self.place(T1, DST2, synth("hd-audio", "size=1280x720") if REAL else b"\x00\x00\x00\x18ftyp")
        link = self.path(T1, "5abe8243-b16f-4ea3-8270-8f91a2b3c4d5")
        os.symlink(target, link)
        self.assertEqual(self.derive(source_a="5abe8243-b16f-4ea3-8270-8f91a2b3c4d5")[:2], (404, {"error": "source-absent"}))


class VideoOff(DeriveCase):
    enable_video = False

    def test_derive_is_inert_without_video(self):
        self.place(T1, SRC, b"\x00\x00\x00\x18ftypmp42")
        self.assertEqual(self.derive()[:2], (415, {"error": "derivation-unavailable"}))


FAKE_FFMPEG = """#!{python}
import json, os, sys, time
argv = sys.argv[1:]
with open({log!r}, "a") as log:
    log.write(json.dumps(argv) + "\\n")
mode = {mode!r}
out = argv[-1]
if mode == "sleep":
    time.sleep(30)
if mode == "fail":
    sys.exit(1)
if mode == "garbage":
    with open(out, "wb") as f:
        f.write(b"\\x00\\x00\\x00\\x18ftypmp42" + b"\\x01" * 500)
    sys.exit(0)
if mode == "huge":
    with open(out, "wb") as f:
        f.write(b"\\x00" * 5000)
    sys.exit(0)
"""


class FakeFfmpeg(DeriveCase):
    """ffmpeg exit status is never success on its own."""
    mode = "fail"

    def setUp(self):
        self.tools = tempfile.mkdtemp(prefix="hebun-mv5-tools-")
        self.log = os.path.join(self.tools, "argv.log")
        self.ffmpeg_override = os.path.join(self.tools, "ffmpeg")
        with open(self.ffmpeg_override, "w") as f:
            f.write(FAKE_FFMPEG.format(python=sys.executable, log=self.log, mode=self.mode))
        os.chmod(self.ffmpeg_override, 0o755)
        super().setUp()
        self.place(T1, SRC, b"\x00\x00\x00\x18ftypmp42" + b"\x00" * 64)

    def tearDown(self):
        super().tearDown()
        shutil.rmtree(self.tools, ignore_errors=True)

    def argv(self):
        with open(self.log) as f:
            return [json.loads(line) for line in f]


class FfmpegFails(FakeFfmpeg):
    mode = "fail"

    def test_nonzero_exit_leaves_nothing_and_argv_is_fixed(self):
        self.assertEqual(self.derive()[:2], (422, {"error": "derive-failed"}))
        self.assertFalse(os.path.lexists(self.path(T1, DST)))
        self.assertEqual(self.temps(), [])
        (argv,) = self.argv()
        fixed = store.normalize_argv("X", 0, "OUT", self.config.v2_max_bytes)[1:]
        self.assertEqual(len(argv), len(fixed))
        variable = [i for i, (a, b) in enumerate(zip(argv, fixed)) if a != b]
        self.assertEqual(variable, [fixed.index("file:/dev/fd/0"), len(fixed) - 1],
                         "only the input descriptor and the store-chosen output path vary")
        self.assertTrue(argv[-1].startswith(os.path.join(self.root, "tenants", T1, "media", ".tmp-" + DST)))
        self.assertIn("-n", argv, "ffmpeg may never overwrite")


class FfmpegGarbage(FakeFfmpeg):
    mode = "garbage"

    def test_exit_zero_with_unprobeable_output_is_refused(self):
        if not FFPROBE:
            self.skipTest("no ffprobe")
        self.assertEqual(self.derive()[:2], (422, {"error": "probe-failed"}))
        self.assertFalse(os.path.lexists(self.path(T1, DST)))
        self.assertEqual(self.temps(), [])


class FfmpegHuge(FakeFfmpeg):
    mode = "huge"
    v2_max = 4096

    def test_oversize_output_is_refused(self):
        self.assertEqual(self.derive()[:2], (413, {"error": "output-too-large"}))
        self.assertFalse(os.path.lexists(self.path(T1, DST)))
        self.assertEqual(self.temps(), [])


class FfmpegHangs(FakeFfmpeg):
    mode = "sleep"
    derive_timeout = 1

    def test_timeout_is_bounded_and_leaves_nothing(self):
        started = time.time()
        self.assertEqual(self.derive()[:2], (422, {"error": "derive-timeout"}))
        self.assertLess(time.time() - started, 10)
        self.assertFalse(os.path.lexists(self.path(T1, DST)))
        self.assertEqual(self.temps(), [])


class Vectors(unittest.TestCase):
    def test_derive_signing_vector_is_stable(self):
        with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "signing-vectors.json")) as f:
            vectors = json.load(f)
        for v in vectors["derive"]:
            self.assertEqual(store.sign(vectors["writeSecret"].encode(), store.derive_canonical(
                v["destKey"], v["sourceKey"], v["derivation"], v["timestamp"], v["nonce"], v["expires"])), v["signature"])


if __name__ == "__main__":
    unittest.main()
