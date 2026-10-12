# PHASE B1 — Stranded primary-tree knowledge · verbatim snapshot

Evidence file for `hebun-phase-b1-knowledge-preservation-closure.md`. It is **not** a closure record and
not an authority. It freezes, byte for byte, the two uncommitted documentation changes found in the stale
primary working tree, so the tree can later be reconciled (Phase B2) without losing them.

Nothing here is current truth by being here. Each item's status — verified, historical, superseded,
unverified — is decided in the closure record §2 and §3, not in this file.

## Provenance

| | `learnings.md` | `docs/product-vision/runtime/hebun-google-picker-1-expired-token-refresh-closure.md` |
|---|---|---|
| Tree | primary `~/Developer/Hebun AI`, branch `main`, HEAD `e96dd36558745143afa0cf3b1235e8952816e457` | same |
| Base blob at HEAD | `5220894ccd3d7162c8c106e923a8c9a83580e8cd` | `af52daa145540ab4035e43e40a28df5f1d714c8c` |
| Blob on `origin/main` `3bdb999b` | `306539b05749e3e9ae75ac4267a94a0956f0a518` | `af52daa145540ab4035e43e40a28df5f1d714c8c` (unchanged since `11496b44`) |
| Working-file blob | `b4fce4fcd849b58df2d129c7a8299f0742f5e544` | `13d140fb2e43ec019ced858627e954af894d9b1e` |
| Working-file sha256 | `d802af80657a27dea1cd6dc7ef75566391a39ef5080fb27bd4e7d091d59cdfd7` | `bb9d2bc88ee0ccae3643e4bb8fbc6071a6b934ed099bb0da855e0d987b390b02` |
| Working-file mtime (local) | 2026-10-11 13:44:22 | 2026-09-04 00:56:18 |
| Measured | 2026-10-12, read-only | 2026-10-12, read-only |

Re-check: `git hash-object <file>` in the primary tree must print the working-file blob above. If it does
not, the tree changed after this snapshot and this file no longer describes it.

## A · `learnings.md` — uncommitted append in the primary tree (verbatim `git diff e96dd365 -- learnings.md`)

103 added lines (92 nonempty, 11 blank), 0 removed. 89 distinct non-empty lines are absent from `origin/main`; the other 3 (the
`GS-1.2` section) are already on `main`.

~~~~diff
diff --git a/learnings.md b/learnings.md
index 5220894c..b4fce4fc 100644
--- a/learnings.md
+++ b/learnings.md
@@ -4243,3 +4243,106 @@ exist is anything that would invoke it.
 - **Ben de yanlış rapor ettim.** Director'a "o dosyada production DATABASE_URL ve
   ALLOW_REMOTE=true vardı" dedim. İkisi de `[SENSITIVE]` maskesiydi; tehlike gerçekti ama LATENT'ti,
   gerçekleşmemişti. **Bir güvenlik bulgusunu bildirmeden önce değeri gerçekten oku.**
+
+## CMD-V2 — Command Center Visual V2 (local, Director görsel kabulü bekliyor)
+
+- **Sayım zayıf bir kontrattır; kayıt (registry) güçlüdür.** CMD-B1'in "tam üç section" pini beş
+  fazdır sayfanın üçte birini koruyordu: LMX-1 ve CMD-W, sayım onları kabul edemediği için route'ta
+  KARDEŞ olarak birleşti. `COMMAND_REGIONS` sayımdan KATI: bildirilmemiş bölge, düşen bölge, sıra
+  değişimi, yanlış provenance türü ve provenance bildirmeyen bölgedeki chip — hepsi patlar.
+- **Bir bite-proof, mutasyonu ilk eşleşmeye uygular.** Kompozisyon değişince "ilk `</h2>`" veya
+  "ilk `<span class="min-w-0">"` artık korunan şeye denk gelmiyordu; testler yeşil kalıp ısırmayı
+  bırakmıştı. Mutasyonu ASSERTION'IN BAKTIĞI bölgeye adıyla nişanla.
+- **Firewall'ı gevşetme, ÖZELLEŞTİR.** I1/INT-3, Command'ın bağlantı altsistemine hiç değmemesini
+  şart koşuyordu. V2'de Command "hangi sağlayıcı BAĞLI" diyor; çözüm, INT-5A'nın writer'sız
+  read yarısını (contracts + integration-read.server) ADIYLA kabul edip geri kalanını ve
+  provider-catalog'u yasak bırakmak, ayrıca yedi connection act'ini sembol bazında yasaklamak.
+- **Kelime yasağı guard'ları ürünün kendi dürüst cümlesine takılır.** "never a trend/percentage"
+  cümlesi `/\btrend\b/` ve `/%/` yasağına çarptı; iddia aynı kalacak şekilde yeniden yazıldı.
+- **Aynı erişilebilir ada sahip iki landmark, ekran okuyucu için tek bir bulanıklıktır.** Hero
+  "Organization" ise rail "Organization map" olmalı.
+- **Personalization authority YOK (ölçüldü):** tenant-owned config/profile/branding tablosu,
+  kolonu veya writer'ı repoda yok; Settings yüzeyi zaten "no durable configuration store" diyor.
+  Hero bu yüzden yalnızca ORG ADI (Organization Authority) + dekoratif plaka + "yapılandırılmadı"
+  cümlesi taşıyor; sahte alıntı, sahte görsel, sahte "Configure" düğmesi yok.
+
+## Delivery Legibility (RUNG 1.5 surface) — 2026-09-15
+
+- `next build` fails NONDETERMINISTICALLY at HEAD: `Cannot access 'o' before initialization` at
+  `Module.tenantColumns`, collecting page data for `/api/machine-delivery/scan`. Cause is a
+  pre-existing schema-layer mutual recursion (`_base` imports `companies`; `company` spreads
+  `rootColumns` eagerly) that is safe in exactly one evaluation order. Load-dependent.
+- A GREEN BUILD IS NOT EVIDENCE OF ABSENCE for a load-dependent failure. I measured HEAD 3/3 green
+  while idle and a candidate 3/3 red under load, and concluded I had caused a regression. A single
+  sequential back-to-back comparison inverted it: HEAD failed, candidate passed. Re-measure the
+  baseline under the SAME machine load before attributing a flaky failure to your own change.
+- A module reached from a `"use client"` component must not name a `.server` module in ANY import,
+  type-only included: `tsc` erases it, the BUNDLER still resolves it, and the database layer lands
+  in a client chunk. Restate the union and pin both directions in a test.
+- `requestedTtlSeconds` was accepted end-to-end by the server action and `clampTtlSeconds` since
+  R3A and dropped at exactly ONE line: the approve call in the UI. Trace a "missing" capability to
+  the single seam that drops it before designing anything new.
+- Offer bounded TTL presets, never a number field: the clamp is SILENT, so a free field lets a
+  human choose one lifetime and the row record another with nothing said.
+- Nothing durable distinguishes a machine-delivered permit from a human-executed one: the permit
+  row has no consuming actor and the consumption audit row records the AUTHORIZING human for both
+  doors. So "delivered" may only mean SPENT AND RECORDED, and the sentence must say so.
+- A refused delivery writes NOTHING, so "expired undelivered" proves the permit lapsed unspent and
+  proves nothing about whether delivery was attempted. State that denial adjacent to the claim.
+
+## GS-1.2 — held-out validation of grounding rules (2026-10-05)
+- Test candidate grounding rules individually against a frozen independent evaluation set before
+  shipping; aggregate improvement must not hide a per-rule regression.
+
+## INSTAGRAM P1 publication acceptance — READY is not provider compatibility (2026-10-10)
+
+- **Evrensel ilke:** Hedeften bağımsız bir hazırlık kapısı (READY), hedefe özgü kabulü kanıtlamaz.
+  Provider'a özgü kısıtlar (oran, boyut, format, byte limiti) provider'a özgü verifier'da, harcanan
+  her yetkiden (permit, arming) ÖNCE kontrol edilmeli; genel package okuyucusuna taşımak ikinci bir
+  authority yaratır.
+- **Doğrulanmış Hebun vakası:** TRH artifact `3b28d86d`@2 ilk seçili görsel `a1f77c45` (WEBP
+  1400×1931, oran 0.725) Content Package `ready=true` VE `verifyInstagramPackageReadiness` = ok aldı;
+  Meta 4:5 tabanının altındaydı. Kodda hiçbir katman (package blockers, IG verifier, transport)
+  oran/genişlik/8 MB kontrol etmiyor — yalnızca caption ≤2200. Açığı preflight'ta insan yakaladı;
+  yerine `bb51ba4c` (PNG 1122×1402, 0.80029) seçildi, derivative `1812ff44` 794351 B, attempt
+  `46921142` accepted, media 18147024463562197, TRH disarm rev 10.
+- **Sınır kontrolünü tam sayıyla yaz:** 0.80029 vs 0.8 gibi ince marjlarda `5w >= 4h` ve
+  `100w <= 191h`; float oran karşılaştırması sınırda yanlış karar verir.
+- **Provider kabulü teslim değildir:** attempt `accepted` + media id, yayın sonrası okuma olmadan
+  "DELIVERY NOT INDEPENDENTLY VERIFIED" olarak raporlanır; Director'ın ekran gözlemi ayrı kanıt sınıfıdır.
+- **Karşı kanıt (aynı gün, prod read-only):** PUBLISH-0 görseli `b4a8491e` → derivative `78bff036`
+  JPEG 2000×2601 (oran 0.76894, 4:5 DIŞI, genişlik >1440) 2026-09-25'te Meta tarafından `accepted`
+  (media 18091512017663172). Dokümante aralık gözlenen davranıştan katı; 0.725'in reddedileceği hiç
+  doğrulanmadı. Bir provider'ın belgesiz toleransı kontrat değildir — ama katı bir gate, daha önce
+  kabul edilmiş bir yayını reddeder; bu bir Director kararıdır, sessiz varsayım değil.
+
+## AGENT-TEST-RECOVERY + CONTENT-AGENT-2 — doğrulanmış teknik dersler (2026-10-10)
+
+- **Bayat bir sayım pin'i, arkasındaki her assertion'ı maskeler.** Ledger 67≠76 düzeltilince ama2/ama3/agent-runtime-0'da
+  gerçek, adlandırılması gereken değişiklikler açığa çıktı (AP-4A, L-2b suspend, AP-2 placement). Onarım: sonraki fazı
+  ADIYLA ekle, asla gevşetme. Bir testi "baseline" diye sınıflandırmadan önce tüm assertion'ları atmadan kaydeden bir
+  soft-assert önyüklemesiyle iki ağaçta koş ve TAM listeleri karşılaştır: ops-p1-flow'un bayat action census'ı CA-2'nin
+  yeni `readRevisionChangeRequestAction`'ını gizliyordu — mesajlar aynı, içerik farklı.
+- **Bir kapıdan önce yazılmış fixture, test edilen yolu sessizce durdurur.** r3b/sia1/sia2 TENANT-ARM-1'den beri
+  `tenant-not-armed`'da duruyordu; ajan send yolu hiç çalışmıyordu. Düzeltme stub değil, yayındaki writer
+  (`armTenantExternalSend`) — kapı yolun içinde kalır.
+- **Yetki sorusu verinin sahibi olan modülde sorulur.** "Review'dan revize edebilir mi" kontrolünü preparation seam'ine
+  koymak R3W/AGENT-RUNTIME-0 firewall'unu kırdı; doğru yer gerekçe okumayı da yöneten review modülü (`mayReviseFromReview`).
+- **Stale-state kontrolü kilidin İÇİNDE yapılır; modelden önceki kontrol yalnızca maliyet tasarrufudur.** Tek satır,
+  tek protokol: writer `FOR UPDATE`, review `FOR SHARE` → yükseltme yok, döngü yok, deadlock yok.
+- **Ortam tuzakları:** worktree köküne bırakılan untracked `.mts` tsc'yi ve `next build`'i kırar (tsconfig `**/*.ts`
+  dahil eder); `node_modules/node_modules` öz-referans symlink'i Turbopack'i "out of filesystem root" ile kırar; tarayıcı
+  ref'leri navigasyondan sonra yeniden atanır — her tıklamadan önce yeniden al ve hedefi doğrula.
+- **Next 16 server-function argüman log'u yalnızca dev'dir** (`action-handler.js:736`: `NODE_ENV === 'development'`):
+  dev log gerekçe metnini basar, production build basmaz. Production iddiası kodla kanıtlanır, varsayılmaz.
+
+## CA-2 PREPARATION FAILURE LEGIBILITY — EAI importer firewall (2026-10-11, 2c6a4129)
+
+- **Hebun'a özgü bulgu:** Own-caption grounding seçeneğini platform disclosure policy'den türetmek için
+  `decidePlatformDisclosure` okunmalıydı. EAI-1A firewall'u (`tests/external-ai-data-use-1a/firewall-and-inertness.ts` §3)
+  `@/features/external-ai-data-use/` importer kümesini tam 7 modüle pinliyor. `content-grounding/contracts.ts`'i 8. importer
+  yapmak yerine karar, zaten listede olan `heby-answer/model-facing-projection.ts` içinde
+  `OWN_CONTENT_GROUNDING_DISCLOSABLE` olarak hesaplandı ve grounding sözlüğünden yeniden export edildi. Importer kümesi,
+  EAI enforcement, Governance ve revision writer değişmedi; policy "allowed" olursa seçenek kod değişmeden açılır.
+- **Genel ilke (ayrı, evrensel):** Güvenlik ve yetki sınırları yeni bir özellik için kolaylık amacıyla genişletilmez.
+  Önce mevcut yetkili okuma yolu kullanılır; sınırı genişletmek ayrı, adlandırılmış bir karar ve gate'tir.
~~~~

## B · GOOGLE-PICKER-1 closure — uncommitted rewrite in the primary tree (verbatim working file)

`11496b44` ("production-accept the expired-token refresh and close GOOGLE-PICKER-1") committed only the
rename `…-status.md → …-closure.md`, 0 insertions and 0 deletions. The rewritten text below was never
committed. The committed document on `main` still declares **RELEASED / ACCEPTANCE PENDING**, and that
committed document remains the closure state. See the closure record §3.

~~~~markdown
# GOOGLE-PICKER-1 — Expired Access Token Refresh Repair — CLOSED / PRODUCTION-ACCEPTED

**Release** `c36863ff02a766a1bf4f27432078742f7a014cfd` · **ZERO schema** · **Production ledger 47,
unchanged** · **Deployment** `dpl_A7kLb5H68gfxphNMqXdmGiVt1Um6`, running `c36863f` on `main`

---

## Root cause

`withGoogleAccessToken` could only refresh REACTIVELY — it needed Google to refuse the token before
it could act. That is enough for every caller that SPENDS the token against Google, because the
refusal arrives on its own. It was never enough for the Picker ceremony, whose callback returns the
token instead of spending it, so no `auth` failure ever came back and the reactive rule could not
fire. Production handed a browser a token that had expired ~92 hours earlier and Google rendered its
own 403 inside the chooser.

`expires_at` was WRITTEN by the credential store and the refresh path, and PROJECTED by the metadata
reader, and consulted by nothing in the repository.

## Implementation

One seam — the one that already owns the refresh ordering. `isAccessCredentialUsable(expiresAt, now)`
with `ACCESS_TOKEN_EXPIRY_SKEW_MS = 60_000`; when it says no, the runner enters the EXISTING
`refreshAndReplace` before the attempt instead of after a refusal that would never arrive, and fails
closed when there is no refresh credential to replace it with.

Only a stated expiry in the past makes the rule false. `null` and unparseable both stay usable, so
every other caller keeps its released behaviour byte for byte. `live` semantics were NOT redefined: a
temporally spent access token and a lifecycle-dead credential remain different concepts, and refresh
credentials — which carry no expiry — are never asked the question.

---

## Production acceptance

The Director opened **Hebun → Knowledge → Choose from Google Drive** in Chrome. The Picker opened and
listed browsable Drive documents. No document was selected, and none was admitted.

### The proof is in the timestamp

| | |
|---|---|
| Previous access credential `c0ec8b88…` | `expires_at` **`2026-09-03T20:30:36.006Z`** |
| Skew window therefore opened at | **`2026-09-03T20:29:36.006Z`** |
| Refresh actually occurred at | **`2026-09-03T20:30:13.303Z`** |

The replacement happened **22.7 seconds BEFORE the token's own stated expiry** — inside the skew
window, while Google would still have accepted the token.

**That is a signature only the repaired branch can produce.** The reactive path requires Google to
REFUSE the credential, and Google does not refuse a token with 23 seconds of life left. A refresh
performed while the token was still nominally valid could not have come from the old rule. The first
Chrome attempt, ~90 seconds earlier and outside the window, produced no refresh at all — the same
code, the same browser, the same account, separated only by whether the token was old enough.

### The nine checks

| # | Check | Result |
|---|---|---|
| 1 | The attempt triggered the refresh path via the skew window | **PASS** — refresh at `20:30:13.303Z`, inside a window that opened `20:29:36.006Z` |
| 2 | A new `oauth_access` credential exists | **PASS** — `ef0ad729…`, `key_id` k2, `expires_at` `21:30:12.303Z` (Google's own hour, recorded) |
| 3 | Previous revoked, exactly one live | **PASS** — `c0ec8b88…` revoked at `20:30:13.303Z`; `live_access = 1` |
| 4 | Google credential rows 19 → 20 | **PASS** — total **20** |
| 5 | Exactly one `integration.credential.replaced`, `origin=provider-refresh` | **PASS** — one row, `20:30:13.303Z`, `result=committed`, `entity_id = ef0ad729…` |
| 6 | `oauth_refresh` unchanged | **PASS** — `90e0b5d7…`, k1, version 1, created `2026-08-30T21:50:49.612Z`, `revoked_at` null; refresh row count still **4**. Google returned no rotated token and none was invented |
| 7 | Connection connected/healthy, scopes unchanged | **PASS** — version **9**, `updated_at` still `2026-08-30T21:50:49.480Z`, `last_error_at` null, scopes `openid` / `drive.file` / `userinfo.profile` / `userinfo.email` |
| 8 | Knowledge unchanged, nothing admitted | **PASS** — `knowledge_nodes` **2**, `work_artifacts` **6** |
| 9 | Other providers untouched | **PASS** — YouTube version 3, GitHub version 3; census `google-workspace` k1×18 + k2×2, `youtube` k2×1 |

**Check 7 is worth reading twice.** The connection's `version` and `updated_at` did not move, because
`replaceCredentialFromProviderRefresh` writes no lifecycle. That is INT-4's correction still holding:
honouring a refresh IS the provider saying the grant is intact, and demoting the connection to
`unverified` would have disabled every capability it carries.

---

## Non-effects, measured

Zero schema — production migration ledger **47**, unchanged. No Google Console change, no OAuth scope
change, no consent re-requested, no encryption-key rotation, no credential revoked but the one the
refresh replaced. No Knowledge admitted. No YouTube or GitHub lifecycle change. No document selected.

---

## Carried forward: Safari is a recorded limitation, not a repair

Safari renders Google's own *"Can't access your Google Account … allowing cookie access"* text on the
same surface, same Director, same account, because the Picker frame reads Google session cookies in a
third-party context. Chrome succeeds with the identical credential, configuration and server path.

Hebun sends no `Cross-Origin-Opener-Policy`, `Cross-Origin-Embedder-Policy`, `Content-Security-Policy`
or `X-Frame-Options`; the Picker client sets no origin because Knowledge is not itself framed; and the
granting account matches the browser's. Nothing Hebun controls causes it, and every fix would mean
weakening a browser's own privacy control or widening Hebun's reach.

**Chrome is verified. Safari is NOT verified and is not claimed as supported.**

**UX debt, recorded and not implemented:** when the Picker cannot establish its Google session, Hebun
should eventually say so truthfully rather than leaving a person to conclude the connection is broken.
The failure is rendered by Google inside its own frame, where Hebun has no visibility, so there is no
seam to hang an honest message on without inventing detection Hebun cannot perform.

---

## Repository parity

`HEAD` = `origin/main`. The deployment serving `www.hebuntech.com` runs `c36863f`, the release commit,
on `main`.
~~~~
