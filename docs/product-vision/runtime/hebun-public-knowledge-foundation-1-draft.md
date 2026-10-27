# Hebun AI — Verified Public Product Knowledge · DRAFT — DIRECTOR REVIEW REQUIRED

Bu dosya yalnızca kamuya açık Knowledge metnini taşır. Kanıtlar, iç kimlikler ve sınırların gerekçesi ayrı
dosyadadır: `hebun-public-knowledge-foundation-1-evidence.md`.

**Nasıl girilir.** Her bölüm `/knowledge` → *Create organizational Knowledge* ile **ayrı bir kayıt** olarak
girilir: Title ve Statement aşağıda, Scope `company-wide`. Her Statement 2.000 karakterin altındadır; her kayıt
ayrı ratify edilir ve ayrı public-use kararı alır. "Statement" bloğu kelimesi kelimesine girilir.

---

## Section 1 — Product Overview

- Fact key: `hebun-public-product-overview`
- Domain: `identity`
- Title: Hebun AI nedir

**Statement**

Hebun AI, kuruluşların işlerini yapay zekâ desteğiyle ama insan yönetişimi altında yürütmesi için geliştirilmiş bir platformdur. Çözmeye çalıştığı sorun şudur: bir kuruluşta yapay zekâ kullanıldığında kimin neye yetkili olduğu, bir önerinin hangi bilgiye dayandığı ve bir işi kimin onayladığı çoğu zaman izlenemez. Hebun bu soruları kayıt altına alır. Kuruluşun bilgisi (Knowledge), iş kayıtları, agent'ları ve yönetişim kararları aynı organizasyon içinde tutulur. Heby, kuruluşun asistanıdır: sorulara kuruluşun kendi kayıtlarına dayanarak cevap verir, taslak ve plan hazırlar, öneri sunar. Kararları insanlar verir. Hebun, yapay zekâyı kuruluşun kontrol edebildiği ve sonradan açıklayabildiği bir çalışma biçimine dönüştürmeyi hedefler.

---

## Section 2 — Verified Capabilities

- Fact key: `hebun-public-verified-capabilities`
- Domain: `offerings`
- Title: Hebun AI'ın bugün sunduğu temel yetenekler

**Statement**

Hebun AI bugün şu yetenekleri sunar. Kuruluşlar kendi organizasyonlarını oluşturabilir ve bir insan, kuruluşun yönetişim yetkisini (Governance authority) üstlenir. Kuruluş, Knowledge kayıtları yazabilir veya metin ve PDF belgelerini Knowledge'a aktarabilir; her kaydın sürümü, kaynağı ve onay durumu tutulur. Heby, kuruluşun onayladığı Knowledge'a dayanarak soruları cevaplar ve bir cevabın hangi kayda dayandığını gösterir. Kuruluş iş kayıtları (work) tutar ve bunları iş alanlarına ayırır. Heby bir iş kaydı ya da iş durumu değişikliği önerebilir; öneri ancak bir insan onaylarsa ve bir insan uygularsa gerçekleşir. Bir iş için sorumlu agent'a taslak veya plan hazırlatılabilir: Heby uygun agent'ı önerir, kişi seçer, agent taslağı yazar, taslak incelemeye gider; değişiklik istenirse agent yeni bir revizyon hazırlar. Onaylanmış içerik, kuruluş için bu yetenek ayrıca açıldığında, onaylı bir yayın akışıyla Instagram'da yayımlanabilir veya YouTube'a yüklenebilir. Hebun ayrıca agent'ların ne önerdiğini, neyin onaylandığını ve neyin yürütüldüğünü kayıtlardan gösterir.

---

## Section 3 — Human Governance

- Fact key: `hebun-public-human-governance`
- Domain: `policies`
- Title: Hebun'da insan onayı ve yetki sınırları

**Statement**

Hebun'da yapay zekâ önerir, insan karar verir. Bir öneri, onay, yürütme izni, yürütme ve sonuç birbirinden ayrı adımlardır ve her biri ayrı kaydedilir. Bir öneri onaylanmadan uygulanmaz. Onay tek başına bir işlem yapmaz; onaylanan bir işlem için ayrıca tek kullanımlık bir izin ve bir insanın yürütme adımı gerekir. Agent'lar kendi önerilerini onaylayamaz, izin veremez, işlem yürütemez ve kendi yetkilerini genişletemez. Yönetişim kararlarını kuruluşun yetkili insanları verir ve her karar gerekçesiyle birlikte kalıcı olarak saklanır. Kuruluşun verisinin bir yapay zekâ sağlayıcısına gönderilmesi de bir yönetişim kararıdır: kuruluş, hangi veri sınıflarının hangi amaçla kullanılabileceğine kendisi karar verir ve bu izni geri çekebilir. Agent'ların hazırladığı içerik, yayımlanmadan önce insan incelemesinden geçer; onaylanan bir taslak kendiliğinden yayımlanmaz.

---

## Section 4 — Agent Architecture

- Fact key: `hebun-public-agent-architecture`
- Domain: `systems`
- Title: Heby ve uzman agent'lar nasıl çalışır

**Statement**

Heby, kuruluşun genel asistanıdır ve kullanıcı ile uzman agent'lar arasında yön gösterir. Bir iş kaydı üzerinde çalışılırken Heby, o işten sorumlu uzman agent'ı tanır, gerekçesiyle önerir ve seçimi kişiye bırakır. Heby agent seçmez, öneriyi onaylamaz, izin vermez ve işlem yürütmez. Hebun'da bir agent, kuruluşun kayıt altına aldığı bir kimliktir: bir adı vardır, bir insan tarafından sahiplenilir ve bir yönetişim kararıyla kaydedilir. Her agent'ın bir görev tanımı (mandate) vardır; bu tanım agent'ın en fazla neyi önerebileceğini ve hangi iş alanından sorumlu olduğunu belirler. Bir uzman agent'ın farkı, sorumlu tutulduğu iş alanı ve bu yetki sınırıdır; agent bu sınırın dışındaki işler için önerilmez ve taslak hazırlayamaz. Agent'ların kendilerine ait oturumu veya kimlik bilgisi yoktur; Hebun içinde yalnızca insanların başlattığı işler için taslak ve öneri hazırlarlar. Her taslak, onu hazırlayan agent'ın adıyla ve revizyon geçmişiyle saklanır.

---

## Section 5 — Integration Boundaries

- Fact key: `hebun-public-integration-boundaries`
- Domain: `systems`
- Title: Hebun'un entegrasyonları ve hazırlık koşulları

**Statement**

Hebun; GitHub, Google Drive, YouTube ve Instagram ile bağlantı kurabilir. Her bağlantı kuruluşun kendi hesabıyla ve kuruluşun verdiği izinlerle kurulur; hangi işlemlerin kullanılabildiği bağlantıya, verilen izinlere ve kuruluşun yönetişim kararlarına göre değişir. Google Drive'da Hebun yalnızca kullanıcının seçtiği dosyaları okur. Okuma işlemleri ile dışarıya bir şey gönderen işlemler ayrı tutulur. Dışarıya yayın yapan işlemler, yani Instagram'da yayımlama ve YouTube'a yükleme, her kuruluş için varsayılan olarak kapalıdır ve ayrıca etkinleştirilmesi gerekir; etkin olduklarında bile her yayın kendi onayını ve iznini ister. Bir entegrasyonun bir kuruluşta çalışması, başka bir kuruluşta da hazır olduğu anlamına gelmez; her kuruluşun bağlantısı ayrı kurulur ve ayrı doğrulanır. Bir sağlayıcının bir isteği kabul etmesi, içeriğin hedef kitleye ulaştığı veya okunduğu anlamına gelmez; Hebun bu tür sonuçları ölçtüğünü iddia etmez.

---

## Section 6 — Public Communication Rules

- Fact key: `hebun-public-communication-rules`
- Domain: `policies`
- Title: Hebun hakkında kamuya açık iletişim kuralları

**Statement**

Hebun hakkında konuşurken şu ilkeler geçerlidir. Hebun işleri otomatik olarak yönetmez; yapay zekâ önerir ve hazırlar, kararları ve yürütmeyi insanlar üstlenir. Hebun'daki agent'lar bağımsız karar vermez; her agent'ın yetkisi kuruluşun belirlediği bir sınırla tanımlıdır. Hebun tamamen otonom bir şirket işletmez. Hebun insan onayı olmadan yayın yapmaz. Hebun her entegrasyonun her kuruluş için hazır olduğunu söylemez; bağlantılar kuruluş bazında kurulur. Hebun hatasız çalıştığını, mutlak güvenlik sağladığını, bir sertifikaya sahip olduğunu veya iş sonucu garanti ettiğini söylemez. Hebun'un müşteri sayısı, kullanım oranı veya verimlilik kazancı hakkında bir rakam paylaşılmaz; Hebun böyle bir ölçüm sunmaz. Henüz yayımlanmamış özellikler mevcutmuş gibi anlatılmaz ve gelecek tarihli vaatlerde bulunulmaz. Hebun'u anlatırken "insan onayıyla çalışan", "kararları kayıt altına alan", "kuruluşun kendi bilgisine dayanan" gibi ölçülü ifadeler kullanılır.

---

## Section 7 — Evidence & Limitations

- Fact key: `hebun-public-limitations`
- Domain: `offerings`
- Title: Hebun AI'ın bilinen sınırlamaları

**Statement**

Hebun AI'ın bugünkü sınırlamaları şunlardır. Giriş tek faktörlüdür; çok faktörlü doğrulama ve kurumsal tek oturum açma (SSO) henüz yoktur. Uygulama içinden parola sıfırlama henüz sunulmamaktadır. Yapay zekâ çıktıları kuruluşun Knowledge kayıtlarına dayanacak şekilde istenir, ancak her çıktı yine de insan incelemesi gerektirir; Hebun bir taslağın doğru veya etkili olduğunu garanti etmez. Bir uzman agent, sorumlu olduğu iş alanında ayrı bir alan uzmanlığı kazanmaz; taslağın niteliği kullanılan modele ve kuruluşun sağladığı bilgiye bağlıdır. Dışarıya yayın yapan yetenekler her kuruluş için ayrıca açılmalıdır. Hebun, bir yayının hedef kitleye ulaşıp ulaşmadığını, okunup okunmadığını veya iş sonucuna etkisini kaydetmez. Hebun'un bu metinde yer almayan yetenekleri, ancak ayrı olarak doğrulandıktan sonra tanıtılmalıdır.
