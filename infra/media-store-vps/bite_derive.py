"""
MV-5 store bite-proofs: each mutation disables ONE DERIVE-V1 guard in a copy of the store; the derive
test module must FAIL against every copy. Run: python3 bite_derive.py
"""
import os, shutil, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
SOURCE = open(os.path.join(HERE, "hebun_media_store.py")).read()
BITES = [
    ("S1 cross-tenant derive allowed", '    if ms.group(1) != md.group(1):\n        raise StoreError(403, "cross-tenant-refused")\n', ""),
    ("S2 derivation set not closed", '    if derivation not in DERIVATIONS:\n        raise StoreError(400, "derivation-unknown")\n', ""),
    ("S3 stored result not probed", "                        probe = probe_local_fd(config, out_fd)\n", "                        probe = {}\n"),
    ("S4 output ceiling not enforced", '                        if ost.st_size > max_bytes:\n                            raise StoreError(413, "output-too-large")\n', ""),
    ("S5 destination overwritable", "                        _finalize_once(dir_fd, tmp_name, asset_id)\n",
     "                        os.replace(tmp_name, asset_id, src_dir_fd=dir_fd, dst_dir_fd=dir_fd)\n"),
    ("S6 nonce not claimed", "if not hmac.compare_digest(expected, sig) or not nonces.claim(nonce, now):\n                return self._send(401, {\"error\": \"unauthorized\"})\n            try:\n                result = derive_object",
     "if not hmac.compare_digest(expected, sig):\n                return self._send(401, {\"error\": \"unauthorized\"})\n            try:\n                result = derive_object"),
    ("S9 signature not checked", "if not hmac.compare_digest(expected, sig) or not nonces.claim(nonce, now):\n                return self._send(401, {\"error\": \"unauthorized\"})\n            try:\n                result = derive_object",
     "if not nonces.claim(nonce, now):\n                return self._send(401, {\"error\": \"unauthorized\"})\n            try:\n                result = derive_object"),
    ("S7 expiry not enforced", "            if e <= now or e > t + DERIVE_MAX_TTL_SECONDS:\n", "            if False:\n"),
    ("S8 non-mp4 source reaches ffmpeg", '            if os.pread(src_fd, 12, 0)[4:8] != b"ftyp":\n                raise StoreError(422, "source-not-mp4")\n', ""),
]
S5_PRECHECK = ('                try:\n                    os.lstat(asset_id, dir_fd=dir_fd)\n                except FileNotFoundError:\n'
               '                    pass\n                else:\n                    raise StoreError(409, "key-exists")\n                tmp_name = f"{TEMP_PREFIX}{asset_id}')


def run(module_text: str) -> int:
    d = tempfile.mkdtemp(prefix="mv5-bite-")
    try:
        open(os.path.join(d, "hebun_media_store.py"), "w").write(module_text)
        shutil.copy(os.path.join(HERE, "test_hebun_media_store_derive.py"), d)
        shutil.copy(os.path.join(HERE, "signing-vectors.json"), d)
        return subprocess.run([sys.executable, "-m", "unittest", "-q", "test_hebun_media_store_derive"], cwd=d,
                              capture_output=True).returncode
    finally:
        shutil.rmtree(d, ignore_errors=True)


assert run(SOURCE) == 0, "control copy must pass"
for name, find, replace in BITES:
    assert SOURCE.count(find) == 1, f"{name}: mutation site not unique ({SOURCE.count(find)})"
    text = SOURCE.replace(find, replace)
    if name.startswith("S5"):
        assert text.count(S5_PRECHECK) == 1
        text = text.replace(S5_PRECHECK, '                tmp_name = f"{TEMP_PREFIX}{asset_id}')
    code = run(text)
    print(f"BITE {name}: {'bitten' if code != 0 else 'SURVIVED'}")
    assert code != 0, f"{name} SURVIVED"
print(f"media-store derive bite-proofs: ok ({len(BITES)} bites)")
