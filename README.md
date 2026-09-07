# Multi-Tenant Kanban ve Dinamik Is Akisi Yonetim Sistemi

Kurumsal ekipler ve organizasyonlar icin gelistirilmis; mantiksal cok kiracili mimari (Logical Multi-tenancy), dinamik gorev sablonlari, kural bazli kolon gecis mekanizmalari (Workflow Transition Guards) ve rol tabanli erisim kontrolu (RBAC) sunan gorev yonetim platformu.

---

## 1. Proje Ozeti

Bu platform, birden fazla departman veya ekibin ayni sistem uzerinde izole sekilde calisabilecegi kurumsal olcekte bir Kanban ve is akisi yonetim sistemidir. Temel ozellikleri sunlardir:

- **Dinamik Gorev Tipleri:** Sistem yoneticileri, "Bug", "Tasarim Gorevi" veya "Story" gibi ozel gorev tiplerini renk, kolon yapisi ve gecis kurallariyla birlikte sifirdan tanimlayabilir.
- **Kural Bazli Workflow Guards:** Bir gorev belirli bir kolona tasinmadan once checklist tamamlanmasi veya dosya/ek yuklenmesi gibi on kosullar zorunlu kilinabilir.
- **Mantiksal Cok Kiracililik:** Her organizasyon, pano ve gorev verisi birbirinden izole calisir; bir kullanici birden fazla organizasyona uye olabilir.
- **Coklu Atama Destegi:** Bir goreve birden fazla kullanici atanabilir (Set<User> assignees).
- **Gercek Zamanli Sirali Kolon Yonetimi:** Pano kolonlari pozisyon bazli siralama motoruyla yonetilir.

---

## 2. Mimari ve Teknoloji Yigini

```
+---------------------------+       +---------------------------+
|     React 18 SPA          |       |   Spring Boot 3.3 API     |
|   TypeScript + Vite       | ----> |   Java 21 + Maven         |
|   TailwindCSS + Context   |  JWT  |   Spring Security + JPA   |
+---------------------------+       +---------------------------+
                                              |
                                    +---------+---------+
                                    |  PostgreSQL 16    |
                                    |  (Docker Volume)  |
                                    +-------------------+
```

| Katman              | Teknoloji                         | Fonksiyon                                              |
|---------------------|-----------------------------------|--------------------------------------------------------|
| Sunum (Frontend)    | React 18, TypeScript, Vite        | Tek sayfa uygulamasi (SPA), dinamik bilesenler         |
| Stil                | TailwindCSS                       | Utility-first CSS cercevesi                            |
| Durum Yonetimi      | React Context API                 | Kimlik dogrulama ve global uygulama durumu             |
| API Katmani         | Spring Boot 3.3.2, Java 21        | RESTful servis katmani, is mantigi                     |
| Guvenlik            | Spring Security, JWT (Stateless)  | BCrypt sifreleme, Bearer token dogrulama, RBAC         |
| Kalici Depolama     | Spring Data JPA, Hibernate        | ORM katmani, entity iliskileri                         |
| Veritabani          | PostgreSQL 16                     | Iliskisel veritabani, Docker named volume ile kalicilik |
| Konteynerlestirme   | Docker, Docker Compose            | Servis orkestrasyon, ag izolasyonu                     |
| Dosya Depolama      | Yerel dosya sistemi (/uploads)    | Gorev eklerinin (attachment) sunucu tarafinda saklanmasi|

---

## 3. Veritabani ve Iliski Modeli

### 3.1 Temel Entity'ler ve Iliskiler

```
User (N) <---[user_organizations]---> (N) Organization
  |
  +-- (N) assignees <---> (N) Task [task_assignees]

Organization (1) <---> (N) Board
Board (1) <---> (N) BoardColumn
BoardColumn (1) <---> (N) Task

Task (N) <---> (1) TaskType
Task (1) <---> (N) TaskChecklistItem
Task (1) <---> (N) Attachment
Task (1) <---> (N) Comment

TaskType (1) <---> (N) TaskTypeColumn      [Dinamik kolon sablonu]
TaskType (1) <---> (N) TaskTypeTransitionRule
TaskTypeTransitionRule (N) <---> (1) TaskTypeColumn [kaynak / hedef]
```

### 3.2 Entity Tanimlari

| Entity                   | Tablo Adi                     | Aciklama                                                      |
|--------------------------|-------------------------------|---------------------------------------------------------------|
| User                     | users                         | Kimlik dogrulama, rol ve organizasyon iliskileri              |
| Organization             | organizations                 | Departman / sirket birimi; multi-tenant yalitim siniri        |
| Board                    | boards                        | Pano; bir organizasyona bagli                                 |
| BoardColumn              | board_columns                 | Panoya bagli kolonlar, position alanli siralama               |
| Task                     | tasks                         | Gorev kartlari; kolon, tip ve coklu atama iliskileri          |
| TaskChecklistItem        | task_checklist_items          | Goreve bagli yapilacaklar listesi ogeleri                     |
| Attachment               | attachments                   | Goreve yuklenen dosyalar (yol, tip, boyut)                    |
| Comment                  | comments                      | Goreve eklenen zaman damgali yorumlar                         |
| TaskType                 | task_types                    | Admin tarafindan tanimlanan dinamik gorev sablonu             |
| TaskTypeColumn           | task_type_columns             | TaskType'a ait is akisi kolon sablonu (position bazli)        |
| TaskTypeTransitionRule   | task_type_transition_rules    | Kolon gecisi on kosul kurallari (Guard)                       |

### 3.3 Workflow Transition Guard Mekanizmasi

`TaskTypeTransitionRule`, bir gorev belirli bir kaynak kolondan hedef kolona tasinmadan once hangi kosulun saglanmasi gerektigini tanimlar.

| Alan               | Tip                                  | Aciklama                                        |
|--------------------|--------------------------------------|-------------------------------------------------|
| ruleType           | Enum: CHECKLIST_REQUIRED             | Tum checklist ogeleri tamamlanmali              |
| ruleType           | Enum: ATTACHMENT_REQUIRED            | En az bir dosya eki yuklenmis olmali            |
| sourceColumnTitle  | String                               | Kaynak kolon adi (title bazli eslestirme)       |
| targetColumnTitle  | String                               | Hedef kolon adi (title bazli eslestirme)        |

Kural ihlali durumunda `TaskService.moveTask()` metodu `400 Bad Request` yaniti dondurur.

---

## 4. Kurumsal Is Mantigi ve Guvenlik

### 4.1 Mantiksal Cok Kiracililik

Veritabani duzeyinde fiziksel ayrim yapilmamistir; yalitim, servis katmaninda uygulanir:

- Her `Board`, bir `Organization`'a baglidir.
- `BoardService.getAllBoards()`, `ROLE_SUPER_ADMIN` icin tum panolari; diger roller icin yalnizca kullanicinin uye oldugu organizasyonlara ait panolari dondurur.
- `TaskTypeService.getTaskTypes()`, organizasyon filtresi ile calisir (`?organizationId=` parametresi).

### 4.2 Rol Tabanli Erisim Kontrolu (RBAC)

| Rol              | Yetkiler                                                                                  |
|------------------|-------------------------------------------------------------------------------------------|
| ROLE_USER        | Pano goruntuleme, gorev olusturma/duzenleme, yorum ve ek yukleme                         |
| ROLE_ADMIN       | ROLE_USER yetkilerine ek olarak pano silme, gorev tipi olusturma/duzenleme/silme         |
| ROLE_SUPER_ADMIN | Tum sistem yetkisi; organizasyon olusturma/silme, uye yonetimi, tum panolara erisim      |

Erisim kontrolu Spring Security'nin `@PreAuthorize` anotasyonu ile metot duzeyinde uygulanir.

### 4.3 Kimlik Dogrulama Akisi

1. `POST /api/auth/login` veya `POST /api/auth/register` ile JWT alinir.
2. Sonraki tum isteklerde `Authorization: Bearer <token>` basligi gonderilir.
3. `JwtAuthenticationFilter`, her istekte tokeni dogrular ve `SecurityContext`'i doldurur.
4. Token gecerlilik suresi `JWT_EXPIRATION_MS` ortam degiskeniyle yapilandirilir (varsayilan: 24 saat).

### 4.4 Dinamik Kolon Siralama Motoru

`BoardColumnService.reorderColumn()` metodu, bir kolonun yeni pozisyona tasinmasiyla birlikte ayni panonun diger kolonlarinin `position` degerlerini yeniden hesaplar. Pozisyon degerleri 0'dan baslayan tamsayi dizisidir.

---

## 5. Kurulum ve Calistirma Kilavuzu

### 5.1 Onkosullar

| Arac          | Surumu  | Amac                                     |
|---------------|---------|------------------------------------------|
| Docker        | 24+     | Konteyner calistirma altyapisi           |
| Docker Compose| 2.x     | Coklu servis orkestrasyon                |
| Java          | 21      | Yerel gelistirme (opsiyonel)             |
| Maven         | 3.9+    | Yerel derleme (opsiyonel)                |
| Node.js       | 20+     | Frontend yerel gelistirme (opsiyonel)    |

### 5.2 Docker Compose ile Baslangic

```bash
# Depoyu klonla
git clone <repo-url>
cd kanban-task-management

# Ortam degiskenlerini yapilandir (opsiyonel)
cp .env.example .env

# Tum servisleri arka planda baslat (ilk calistirmada image'lar derlenir)
docker compose up -d --build

# Servis loglarini canli izle
docker compose logs -f

# Yalnizca backend loglarini izle
docker compose logs -f backend
```

Basarili baslatma sonrasinda:

| Servis   | URL                        |
|----------|----------------------------|
| Frontend | http://localhost           |
| Backend  | http://localhost:8080/api  |
| Postgres | localhost:5432 / kanban_db |

**Onemli:** `docker compose down -v` komutu Postgres named volume'unu silerek tum veriyi kalici olarak kaybettirir. Volume'u korumak icin yalnizca `docker compose down` kullanin.

### 5.3 Konteyner Durdurma ve Yeniden Baslama

```bash
# Servisleri durdur, konteynerleri kaldir (volume korunur)
docker compose down

# Yeniden baslat (volume verisi korunur)
docker compose up -d

# Sadece backend'i yeniden olustur ve baslat
docker compose up -d --build backend
```

### 5.4 Yerel Gelistirme Ortami

**Backend:**
```bash
cd backend
export DB_HOST=localhost DB_PORT=5432 DB_NAME=kanban_db DB_USER=kanban_user DB_PASS=kanban_pass
mvn spring-boot:run -DskipTests
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev      # Gelistirme sunucusu: http://localhost:5173
npm run build    # Uretim derlemesi dogrulamasi
```

---

## 6. REST API Referans Tablosu

Tum endpoint'ler `/api` on eki ile erisilebilir (ornek: `http://localhost:8080/api/auth/login`).

### Kimlik Dogrulama

| HTTP Metodu | Endpoint           | Aciklama                             | Yetki Seviyesi  |
|-------------|--------------------|--------------------------------------|-----------------|
| POST        | /auth/register     | Yeni kullanici kaydi ve JWT donus    | Herkese Acik    |
| POST        | /auth/login        | Kimlik dogrulama ve JWT donus        | Herkese Acik    |

### Kullanicilar

| HTTP Metodu | Endpoint | Aciklama                                            | Yetki Seviyesi   |
|-------------|----------|-----------------------------------------------------|------------------|
| GET         | /users   | Tum kullanicilari listele (atama ve ekip yonetimi)  | Giris Yapilmis   |

### Organizasyonlar

| HTTP Metodu | Endpoint                                  | Aciklama                                        | Yetki Seviyesi  |
|-------------|-------------------------------------------|-------------------------------------------------|-----------------|
| GET         | /organizations                            | Tum organizasyonlari listele                    | Giris Yapilmis  |
| POST        | /organizations                            | Yeni organizasyon olustur                       | SUPER_ADMIN     |
| DELETE      | /organizations/{id}                       | Organizasyonu sil (pano ve baglantilar silinir) | SUPER_ADMIN     |
| GET         | /organizations/{orgId}/members            | Organizasyon uyelerini listele                  | Giris Yapilmis  |
| POST        | /organizations/{orgId}/members            | Mevcut kullanicilari organizasyona ekle         | SUPER_ADMIN     |
| POST        | /organizations/{orgId}/members/new        | Yeni kullanici olustur ve organizasyona ekle    | SUPER_ADMIN     |
| DELETE      | /organizations/{orgId}/members/{userId}   | Kullanicinin organizasyon uyeligini kaldir      | SUPER_ADMIN     |

### Panolar

| HTTP Metodu | Endpoint       | Aciklama                                          | Yetki Seviyesi     |
|-------------|----------------|---------------------------------------------------|--------------------|
| GET         | /boards        | Mevcut kullanicinin erisebilecegi panolari listele| Giris Yapilmis     |
| POST        | /boards        | Yeni pano olustur (opsiyonel: taskTypeId ile)     | Giris Yapilmis     |
| GET         | /boards/{id}   | Panonun kolon ve gorev detaylarini getir          | Giris Yapilmis     |
| PUT         | /boards/{id}   | Pano ad ve aciklamasini guncelle                  | Giris Yapilmis     |
| DELETE      | /boards/{id}   | Panoyu ve tum alt ogelerini sil                   | ADMIN / SUPER_ADMIN|

### Pano Kolonlari

| HTTP Metodu | Endpoint                                        | Aciklama                                  | Yetki Seviyesi  |
|-------------|-------------------------------------------------|-------------------------------------------|-----------------|
| GET         | /boards/{boardId}/columns                       | Kolonlari gorev listesiyle birlikte getir | Giris Yapilmis  |
| POST        | /boards/{boardId}/columns                       | Panoya yeni kolon ekle                    | Giris Yapilmis  |
| GET         | /boards/{boardId}/columns/{columnId}            | Tek kolon detayini getir                  | Giris Yapilmis  |
| PUT         | /boards/{boardId}/columns/{columnId}            | Kolon adini guncelle                      | Giris Yapilmis  |
| DELETE      | /boards/{boardId}/columns/{columnId}            | Kolonu ve gorevlerini sil                 | Giris Yapilmis  |
| PATCH       | /boards/{boardId}/columns/{columnId}/reorder    | Kolon sirasini degistir                   | Giris Yapilmis  |

### Gorevler

| HTTP Metodu | Endpoint                                                | Aciklama                                             | Yetki Seviyesi  |
|-------------|---------------------------------------------------------|------------------------------------------------------|-----------------|
| GET         | /boards/{boardId}/columns/{columnId}/tasks              | Kolondaki gorevleri listele                          | Giris Yapilmis  |
| POST        | /boards/{boardId}/columns/{columnId}/tasks              | Yeni gorev olustur (assigneeIds, taskTypeId destegi) | Giris Yapilmis  |
| GET         | /boards/{boardId}/columns/{columnId}/tasks/{taskId}     | Gorev detayini getir                                 | Giris Yapilmis  |
| PUT         | /boards/{boardId}/columns/{columnId}/tasks/{taskId}     | Gorevi guncelle (kolon yolu ile)                     | Giris Yapilmis  |
| PUT         | /tasks/{taskId}                                         | Gorevi dogrudan guncelle (kolon yolu olmadan)        | Giris Yapilmis  |
| DELETE      | /boards/{boardId}/columns/{columnId}/tasks/{taskId}     | Gorevi sil                                           | Giris Yapilmis  |
| PATCH       | /tasks/{taskId}/move                                    | Gorevi baska kolona tasi (Transition Guard calisir)  | Giris Yapilmis  |

### Checklist (Yapilacaklar Listesi)

| HTTP Metodu | Endpoint                                       | Aciklama                          | Yetki Seviyesi  |
|-------------|------------------------------------------------|-----------------------------------|-----------------|
| POST        | /tasks/{taskId}/checklists                     | Goreve checklist ogesi ekle       | Giris Yapilmis  |
| PATCH       | /tasks/{taskId}/checklists/{itemId}/toggle     | Checklist ogesini tamamla/geri al | Giris Yapilmis  |
| PUT         | /tasks/{taskId}/checklists/{itemId}            | Checklist ogesi metnini guncelle  | Giris Yapilmis  |
| DELETE      | /tasks/{taskId}/checklists/{itemId}            | Checklist ogesini sil             | Giris Yapilmis  |

### Ekler (Attachments)

| HTTP Metodu | Endpoint                                             | Aciklama                              | Yetki Seviyesi  |
|-------------|------------------------------------------------------|---------------------------------------|-----------------|
| GET         | /tasks/{taskId}/attachments                          | Goreve ait dosya eklerini listele     | Giris Yapilmis  |
| POST        | /tasks/{taskId}/attachments                          | Dosya yukle (multipart/form-data)     | Giris Yapilmis  |
| GET         | /tasks/{taskId}/attachments/{attachmentId}/download  | Dosyayi indir veya aktar              | Giris Yapilmis  |
| DELETE      | /tasks/{taskId}/attachments/{attachmentId}           | Dosya ekini sil                       | Giris Yapilmis  |

### Yorumlar

| HTTP Metodu | Endpoint                               | Aciklama                                   | Yetki Seviyesi  |
|-------------|----------------------------------------|--------------------------------------------|-----------------|
| GET         | /tasks/{taskId}/comments               | Goreve ait yorumlari kronolojik listele    | Giris Yapilmis  |
| POST        | /tasks/{taskId}/comments               | Yorum ekle (yazar: giris yapan kullanici) | Giris Yapilmis  |
| DELETE      | /tasks/{taskId}/comments/{commentId}   | Yorumu sil                                 | Giris Yapilmis  |

### Gorev Tipleri (Task Types)

| HTTP Metodu | Endpoint                         | Aciklama                                                        | Yetki Seviyesi     |
|-------------|----------------------------------|-----------------------------------------------------------------|--------------------|
| GET         | /task-types                      | Gorev tiplerini listele (opsiyonel: ?organizationId=)           | Giris Yapilmis     |
| GET         | /task-types/{id}                 | Tek gorev tipi detayini getir (kolonlar ve kurallar dahil)      | Giris Yapilmis     |
| POST        | /task-types                      | Yeni gorev tipi olustur (kolonlar ve kurallar birlikte)         | ADMIN / SUPER_ADMIN|
| PUT         | /task-types/{id}                 | Gorev tipini guncelle                                           | ADMIN / SUPER_ADMIN|
| DELETE      | /task-types/{id}                 | Gorev tipini sil                                                | ADMIN / SUPER_ADMIN|
| POST        | /task-types/{id}/rules           | Gorev tipine gecis kurali ekle                                  | ADMIN / SUPER_ADMIN|
| DELETE      | /task-types/{id}/rules/{ruleId}  | Gecis kurali sil                                                | ADMIN / SUPER_ADMIN|

---

## 7. Ortam Degiskenleri

| Degisken           | Varsayilan Deger  | Aciklama                                         |
|--------------------|-------------------|--------------------------------------------------|
| DB_HOST            | postgres          | Veritabani sunucusu adresi                       |
| DB_PORT            | 5432              | Veritabani portu                                 |
| DB_NAME            | kanban_db         | Veritabani adi                                   |
| DB_USER            | kanban_user       | Veritabani kullanici adi                         |
| DB_PASS            | kanban_pass       | Veritabani sifresi                               |
| JWT_SECRET         | (zorunlu)         | JWT imzalama anahtari; uretim icin degistirilmeli|
| JWT_EXPIRATION_MS  | 86400000          | Token gecerlilik suresi (ms); varsayilan 24 saat |
| CORS_ORIGINS       | http://localhost  | Izin verilen kaynak adresler (CORS)              |
| SERVER_PORT        | 8080              | Spring Boot dinleme portu                        |

Uretim ortamina gecis oncesinde `JWT_SECRET` mutlaka guclu ve rastgele bir deger ile degistirilmelidir.
Ornek uretim: `openssl rand -base64 64`

---

## 8. Proje Dizin Yapisi

```
kanban-task-management/
+-- backend/
|   +-- src/main/java/com/kanban/
|   |   +-- controller/        # REST katmani (AuthController, BoardController, ...)
|   |   +-- service/           # Is mantigi (BoardService, TaskService, TaskTypeService, ...)
|   |   +-- repository/        # Spring Data JPA arayuzleri
|   |   +-- entity/            # JPA entity siniflari (User, Board, Task, TaskType, ...)
|   |   +-- dto/               # Veri transfer nesneleri (Request / Response / Dto Records)
|   |   +-- security/          # JWT filtresi, SecurityConfig, UserDetailsService
|   |   +-- config/            # Uygulama yapilandirmasi (DataInitializer, CorsConfig, ...)
|   +-- Dockerfile
|   +-- pom.xml
+-- frontend/
|   +-- src/
|   |   +-- components/        # Yeniden kullanilabilir React bilesenler
|   |   +-- pages/             # Sayfa duzeyindeki bilesenler (BoardPage, AdminTaskTypesPage, ...)
|   |   +-- context/           # AuthContext (JWT, kullanici durumu)
|   |   +-- types/             # TypeScript tip tanimlari (index.ts)
|   |   +-- App.tsx            # Rota tanimlari
|   +-- Dockerfile
|   +-- vite.config.ts
+-- docker-compose.yml
+-- .env.example
+-- README.md
```

---

## 9. Test Kullanicilari (DataInitializer)

Sistem ilk calistirildiginda asagidaki kullanicilar otomatik olarak olusturulur.

| Kullanici Adi  | E-posta               | Sifre    | Rol              |
|----------------|-----------------------|----------|------------------|
| superadmin     | -                     | admin123 | ROLE_SUPER_ADMIN |
| ali_yilmaz     | ali@kanban.local      | user123  | ROLE_USER        |
| ayse_kaya      | ayse@kanban.local     | user123  | ROLE_USER        |
| mehmet_demir   | mehmet@kanban.local   | user123  | ROLE_USER        |
| zeynep_celik   | zeynep@kanban.local   | user123  | ROLE_USER        |
| can_ozkan      | can@kanban.local      | user123  | ROLE_ADMIN       |

---

## 10. Lisans

Bu proje kurumsal ic kullanim amacli gelistirilmistir. Ac kaynak lisans uygulanmamaktadir.
