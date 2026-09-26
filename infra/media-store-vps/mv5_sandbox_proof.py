#!/usr/bin/env python3
"""
MV-5 sandbox proof — run the store's EXACT mp4-normalize-v1 argv under the media-store unit's
hardening (MemoryDenyWriteExecute, NoNewPrivileges, ProtectSystem=strict, PrivateTmp, MemoryMax, ...).

Touches no store data: a synthetic clip is made and normalized inside the transient unit's private
/tmp, which disappears with it. Run through `mv5-sandbox-proof.sh` (systemd-run), not directly.
"""
import ctypes, json, mmap, os, subprocess, sys, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hebun_media_store as store  # noqa: E402

FFMPEG, FFPROBE = "/usr/bin/ffmpeg", "/usr/bin/ffprobe"
ok = True
def check(cond, label, detail=""):
    global ok
    ok &= bool(cond)
    print(("PASS " if cond else "FAIL ") + label + (f"  — {detail}" if detail else ""), flush=True)

try:
    mdwe = ctypes.CDLL(None, use_errno=True).prctl(66, 0, 0, 0, 0)  # PR_GET_MDWE (Linux >= 6.3)
except AttributeError:
    mdwe = "n/a"
wx_refused = False
try:
    m = mmap.mmap(-1, 4096, prot=mmap.PROT_READ | mmap.PROT_WRITE | mmap.PROT_EXEC)
    m.close()
except (OSError, PermissionError):
    wx_refused = True
check(wx_refused, "W+X mapping refused in this process (MemoryDenyWriteExecute is in force)", f"PR_GET_MDWE={mdwe}")
check(os.geteuid() != 0, "not root", f"uid={os.geteuid()}")

with tempfile.TemporaryDirectory() as d:
    src = os.path.join(d, "src.mp4")
    gen = subprocess.run([FFMPEG, "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
                          "-f", "lavfi", "-i", "testsrc2=size=2560x1440:rate=25:duration=3",
                          "-f", "lavfi", "-i", "sine=frequency=440:duration=3",
                          "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", src], capture_output=True)
    check(gen.returncode == 0, "synthetic source encoded (libx264 + aac) under the sandbox", gen.stderr.decode()[-200:])
    out = os.path.join(d, ".tmp-out.mp4")
    fd = os.open(src, os.O_RDONLY)
    run = subprocess.run(store.normalize_argv(FFMPEG, fd, out, store.MAX_BYTE_SIZE), pass_fds=(fd,),
                         stdin=subprocess.DEVNULL, capture_output=True, env={"PATH": "/usr/bin:/bin"},
                         timeout=store.DERIVE_TIMEOUT_SECONDS)
    check(run.returncode == 0, "mp4-normalize-v1 argv exits 0 under the sandbox", run.stderr.decode()[-300:])
    if run.returncode == 0:
        p = json.loads(subprocess.run([FFPROBE, "-v", "error", "-show_entries",
                                       "format=format_name,duration:stream=codec_type,codec_name,width,height,pix_fmt",
                                       "-of", "json", out], capture_output=True, check=True).stdout)
        v = next(s for s in p["streams"] if s["codec_type"] == "video")
        a = next((s for s in p["streams"] if s["codec_type"] == "audio"), None)
        check(v["codec_name"] == "h264" and v["pix_fmt"] == "yuv420p", "h264 yuv420p", json.dumps(v))
        check((v["width"], v["height"]) == (1920, 1080), "bounded to 1920x1080, aspect kept")
        check(a is not None and a["codec_name"] == "aac", "aac audio kept")
        check(abs(float(p["format"]["duration"]) - 3.0) < 0.25, "duration within 250 ms", p["format"]["duration"])
        check(os.path.getsize(out) <= store.MAX_BYTE_SIZE, "under the 20 MiB ceiling", str(os.path.getsize(out)))
print("SANDBOX PROOF", "ALL PASS" if ok else "FAILED", flush=True)
sys.exit(0 if ok else 1)
