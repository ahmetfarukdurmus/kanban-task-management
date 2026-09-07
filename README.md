# Multi-Tenant Kanban ve Dinamik İş Akışı Yönetim Sistemi

Kurumsal ekipler ve organizasyonlar için geliştirilmiş; mantıksal çok kiracılı mimari (Logical Multi-tenancy), dinamik görev şablonları, kural bazlı kolon geçiş mekanizmaları (Workflow Transition Guards) ve rol tabanlı erişim kontrolü (RBAC) sunan görev yönetim platformu.

---

## 1. Proje Özeti

Bu platform, birden fazla departman veya ekibin aynı sistem üzerinde izole şekilde çalışabildiği kurumsal ölçekte bir Kanban ve iş akışı yönetim sistemidir. Temel özellikleri şunlardır:

- **Dinamik Görev Tipleri:** Sistem yöneticileri, "Bug", "Tasarım Görevi" veya "Story" gibi özel görev tiplerini renk, kolon yapısı ve geçiş kurallarıyla birlikte sıfırdan tanımlayabilir.
- **Kural Bazlı Workflow Guards:** Bir görev belirli bir kolona taşınmadan önce checklist tamamlanması veya dosya/ek yüklenmesi gibi ön koşullar zorunlu kılınabilir.
- **Mantıksal Çok Kiracılılık:** Her organizasyon, pano ve görev verisi birbirinden izole çalışır; bir kullanıcı birden fazla organizasyona üye olabilir.
- **Çoklu Atama Desteği:** Bir göreve birden fazla kullanıcı atanabilir (Set<User> assignees).
- **Gerçek Zamanlı Sıralı Kolon Yönetimi:** Pano kolonları pozisyon bazlı sıralama motoruyla yönetilir.

---

## 2. Mimari ve Teknoloji Yığını

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
| Sunum (Frontend)    | React 18, TypeScript, Vite        | Tek sayfa uygulaması (SPA), dinamik bileşenler         |
| Stil                | TailwindCSS                       | Utility-first CSS çerçevesi                            |
| Durum Yönetimi      | React Context API                 | Kimlik doğrulama ve global uygulama durumu             |
| API Katmanı         | Spring Boot 3.3.2, Java 21        | RESTful servis katmanı, iş mantığı                     |
| Güvenlik            | Spring Security, JWT (Stateless)  | BCrypt şifreleme, Bearer token doğrulama, RBAC         |
| Kalıcı Depolama     | Spring Data JPA, Hibernate        | ORM katmanı, entity ilişkileri                         |
| Veritabanı          | PostgreSQL 16                     | İlişkisel veritabanı, Docker named volume ile kalıcılık |
| Konteynerleştirme   | Docker, Docker Compose            | Servis orkestrasyon, ağ izolasyonu                     |
| Dosya Depolama      | Yerel dosya sistemi (/uploads)    | Görev eklerinin (attachment) sunucu tarafında saklanması|

---

## 3. Veritabanı ve İlişki Modeli

### 3.1 Temel Entity'ler ve İlişkiler

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

TaskType (1) <---> (N) TaskTypeColumn      [Dinamik kolon şablonu]
TaskType (1) <---> (N) TaskTypeTransitionRule
TaskTypeTransitionRule (N) <---> (1) TaskTypeColumn [kaynak / hedef]
```

### 3.2 Entity Tanımları

| Entity                   | Tablo Adi                     | Aciklama                                                      |
|--------------------------|-------------------------------|---------------------------------------------------------------|
| User                     | users                         | Kimlik doğrulama, rol ve organizasyon ilişkileri              |
| Organization             | organizations                 | Departman / şirket birimi; multi-tenant yalıtım sınırı        |
| Board                    | boards                        | Pano; bir organizasyona bağlı                                 |
| BoardColumn              | board_columns                 | Panoya bağlı kolonlar, position alanlı sıralama               |
| Task                     | tasks                         | Görev kartları; kolon, tip ve çoklu atama ilişkileri          |
| TaskChecklistItem        | task_checklist_items          | Göreve bağlı yapılacaklar listesi öğeleri                     |
| Attachment               | attachments                   | Göreve yüklenen dosyalar (yol, tip, boyut)                    |
| Comment                  | comments                      | Göreve eklenen zaman damgalı yorumlar                         |
| TaskType                 | task_types                    | Admin tarafından tanımlanan dinamik görev şablonu             |
| TaskTypeColumn           | task_type_columns             | TaskType'a ait iş akışı kolon şablonu (position bazlı)        |
| TaskTypeTransitionRule   | task_type_transition_rules    | Kolon geçişi ön koşul kuralları (Guard)                       |

### 3.3 Workflow Transition Guard Mekanizması

`TaskTypeTransitionRule`, bir görev belirli bir kaynak kolondan hedef kolona taşınmadan önce hangi koşulun sağlanması gerektiğini tanımlar.

| Alan               | Tip                                  | Aciklama                                        |
|--------------------|--------------------------------------|-------------------------------------------------|
| ruleType           | Enum: CHECKLIST_REQUIRED             | Tüm checklist öğeleri tamamlanmalı              |
| ruleType           | Enum: ATTACHMENT_REQUIRED            | En az bir dosya eki yüklenmiş olmalı            |
| sourceColumnTitle  | String                               | Kaynak kolon adı (title bazlı eşleştirme)       |
| targetColumnTitle  | String                               | Hedef kolon adı (title bazlı eşleştirme)        |

Kural ihlali durumunda `TaskService.moveTask()` metodu `400 Bad Request` yanıtı döndürür.

---

## 4. Kurumsal İş Mantığı ve Güvenlik

### 4.1 Mantıksal Çok Kiracılılık

Veritabanı düzeyinde fiziksel ayrım yapılmamıştır; yalıtım, servis katmanında uygulanır:

- Her `Board`, bir `Organization`'a bağlıdır.
- `BoardService.getAllBoards()`, `ROLE_SUPER_ADMIN` için tüm panoları; diğer roller için yalnızca kullanıcının üye olduğu organizasyonlara ait panoları döndürür.
- `TaskTypeService.getTaskTypes()`, organizasyon filtresi ile çalışır (`?organizationId=` parametresi).

### 4.2 Rol Tabanlı Erişim Kontrolü (RBAC)

| Rol              | Yetkiler                                                                                  |
|------------------|-------------------------------------------------------------------------------------------|
| ROLE_USER        | Pano görüntüleme, görev oluşturma/düzenleme, yorum ve ek yükleme                         |
| ROLE_ADMIN       | ROLE_USER yetkilerine ek olarak pano silme, görev tipi oluşturma/düzenleme/silme         |
| ROLE_SUPER_ADMIN | Tüm sistem yetkisi; organizasyon oluşturma/silme, üye yönetimi, tüm panolara erişim      |

Erişim kontrolü Spring Security'nin `@PreAuthorize` anotasyonu ile metot düzeyinde uygulanır.

### 4.3 Kimlik Doğrulama Akışı

1. `POST /api/auth/login` veya `POST /api/auth/register` ile JWT alınır.
2. Sonraki tüm isteklerde `Authorization: Bearer <token>` başlığı gönderilir.
3. `JwtAuthenticationFilter`, her istekte tokeni doğrular ve `SecurityContext`'i doldurur.
4. Token geçerlilik süresi `JWT_EXPIRATION_MS` ortam değişkeniyle yapılandırılır (varsayılan: 24 saat).

### 4.4 Dinamik Kolon Sıralama Motoru

`BoardColumnService.reorderColumn()` metodu, bir kolonun yeni pozisyona taşınmasıyla birlikte aynı panonun diğer kolonlarının `position` değerlerini yeniden hesaplar. Pozisyon değerleri 0'dan başlayan tamsayı dizisidir.

---

## 5. Kurulum ve Çalıştırma Kılavuzu

### 5.1 Önkoşullar

| Arac          | Surumu  | Amac                                     |
|---------------|---------|------------------------------------------|
| Docker        | 24+     | Konteyner çalıştırma altyapısı           |
| Docker Compose| 2.x     | Çoklu servis orkestrasyon                |
| Java          | 21      | Yerel geliştirme (opsiyonel)             |
| Maven         | 3.9+    | Yerel derleme (opsiyonel)                |
| Node.js       | 20+     | Frontend yerel geliştirme (opsiyonel)    |

### 5.2 Docker Compose ile Başlangıç

```bash
# Depoyu klonla
git clone <repo-url>
cd kanban-task-management

# Ortam değişkenlerini yapılandır (opsiyonel)
cp .env.example .env

# Tüm servisleri arka planda başlat (ilk çalıştırmada image'lar derlenir)
docker compose up -d --build

# Servis loglarını canlı izle
docker compose logs -f

# Yalnızca backend loglarını izle
docker compose logs -f backend
```

Başarılı başlatma sonrasında:

| Servis   | URL                        |
|----------|----------------------------|
| Frontend | http://localhost           |
| Backend  | http://localhost:8080/api  |
| Postgres | localhost:5432 / kanban_db |

**Önemli:** `docker compose down -v` komutu Postgres named volume'unu silerek tüm veriyi kalıcı olarak kaybettirir. Volume'u korumak için yalnızca `docker compose down` kullanın.

### 5.3 Konteyner Durdurma ve Yeniden Başlama

```bash
# Servisleri durdur, konteynerleri kaldır (volume korunur)
docker compose down

# Yeniden başlat (volume verisi korunur)
docker compose up -d

# Sadece backend'i yeniden oluştur ve başlat
docker compose up -d --build backend
```

### 5.4 Yerel Geliştirme Ortamı

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
npm run dev      # Geliştirme sunucusu: http://localhost:5173
npm run build    # Üretim derlemesi doğrulaması
```

---

## 6. REST API Referans Tablosu

Tüm endpoint'ler `/api` ön eki ile erişilebilir (örnek: `http://localhost:8080/api/auth/login`).

### Kimlik Doğrulama

| HTTP Metodu | Endpoint           | Aciklama                             | Yetki Seviyesi  |
|-------------|--------------------|--------------------------------------|-----------------|
| POST        | /auth/register     | Yeni kullanıcı kaydı ve JWT dönüş    | Herkese Açık    |
| POST        | /auth/login        | Kimlik doğrulama ve JWT dönüş        | Herkese Açık    |

### Kullanıcılar

| HTTP Metodu | Endpoint | Aciklama                                            | Yetki Seviyesi   |
|-------------|----------|-----------------------------------------------------|------------------|
| GET         | /users   | Tüm kullanıcıları listele (atama ve ekip yönetimi)  | Giriş Yapılmış   |

### Organizasyonlar

| HTTP Metodu | Endpoint                                  | Aciklama                                        | Yetki Seviyesi  |
|-------------|-------------------------------------------|-------------------------------------------------|-----------------|
| GET         | /organizations                            | Tüm organizasyonları listele                    | Giriş Yapılmış  |
| POST        | /organizations                            | Yeni organizasyon oluştur                       | SUPER_ADMIN     |
| DELETE      | /organizations/{id}                       | Organizasyonu sil (pano ve bağlantılar silinir) | SUPER_ADMIN     |
| GET         | /organizations/{orgId}/members            | Organizasyon üyelerini listele                  | Giriş Yapılmış  |
| POST        | /organizations/{orgId}/members            | Mevcut kullanıcıları organizasyona ekle         | SUPER_ADMIN     |
| POST        | /organizations/{orgId}/members/new        | Yeni kullanıcı oluştur ve organizasyona ekle    | SUPER_ADMIN     |
| DELETE      | /organizations/{orgId}/members/{userId}   | Kullanıcının organizasyon üyeliğini kaldır      | SUPER_ADMIN     |

### Panolar

| HTTP Metodu | Endpoint       | Aciklama                                          | Yetki Seviyesi     |
|-------------|----------------|---------------------------------------------------|--------------------|
| GET         | /boards        | Mevcut kullanıcının erişebileceği panoları listele| Giriş Yapılmış     |
| POST        | /boards        | Yeni pano oluştur (opsiyonel: taskTypeId ile)     | Giriş Yapılmış     |
| GET         | /boards/{id}   | Panonun kolon ve görev detaylarını getir          | Giriş Yapılmış     |
| PUT         | /boards/{id}   | Pano ad ve açıklamasını güncelle                  | Giriş Yapılmış     |
| DELETE      | /boards/{id}   | Panoyu ve tüm alt öğelerini sil                   | ADMIN / SUPER_ADMIN|

### Pano Kolonları

| HTTP Metodu | Endpoint                                        | Aciklama                                  | Yetki Seviyesi  |
|-------------|-------------------------------------------------|-------------------------------------------|-----------------|
| GET         | /boards/{boardId}/columns                       | Kolonları görev listesiyle birlikte getir | Giriş Yapılmış  |
| POST        | /boards/{boardId}/columns                       | Panoya yeni kolon ekle                    | Giriş Yapılmış  |
| GET         | /boards/{boardId}/columns/{columnId}            | Tek kolon detayını getir                  | Giriş Yapılmış  |
| PUT         | /boards/{boardId}/columns/{columnId}            | Kolon adını güncelle                      | Giriş Yapılmış  |
| DELETE      | /boards/{boardId}/columns/{columnId}            | Kolonu ve görevlerini sil                 | Giriş Yapılmış  |
| PATCH       | /boards/{boardId}/columns/{columnId}/reorder    | Kolon sırasını değiştir                   | Giriş Yapılmış  |

### Görevler

| HTTP Metodu | Endpoint                                                | Aciklama                                             | Yetki Seviyesi  |
|-------------|---------------------------------------------------------|------------------------------------------------------|-----------------|
| GET         | /boards/{boardId}/columns/{columnId}/tasks              | Kolondaki görevleri listele                          | Giriş Yapılmış  |
| POST        | /boards/{boardId}/columns/{columnId}/tasks              | Yeni görev oluştur (assigneeIds, taskTypeId desteği) | Giriş Yapılmış  |
| GET         | /boards/{boardId}/columns/{columnId}/tasks/{taskId}     | Görev detayını getir                                 | Giriş Yapılmış  |
| PUT         | /boards/{boardId}/columns/{columnId}/tasks/{taskId}     | Görevi güncelle (kolon yolu ile)                     | Giriş Yapılmış  |
| PUT         | /tasks/{taskId}                                         | Görevi doğrudan güncelle (kolon yolu olmadan)        | Giriş Yapılmış  |
| DELETE      | /boards/{boardId}/columns/{columnId}/tasks/{taskId}     | Görevi sil                                           | Giriş Yapılmış  |
| PATCH       | /tasks/{taskId}/move                                    | Görevi başka kolona taşı (Transition Guard çalışır)  | Giriş Yapılmış  |

### Checklist (Yapılacaklar Listesi)

| HTTP Metodu | Endpoint                                       | Aciklama                          | Yetki Seviyesi  |
|-------------|------------------------------------------------|-----------------------------------|-----------------|
| POST        | /tasks/{taskId}/checklists                     | Göreve checklist öğesi ekle       | Giriş Yapılmış  |
| PATCH       | /tasks/{taskId}/checklists/{itemId}/toggle     | Checklist öğesini tamamla/geri al | Giriş Yapılmış  |
| PUT         | /tasks/{taskId}/checklists/{itemId}            | Checklist öğesi metnini güncelle  | Giriş Yapılmış  |
| DELETE      | /tasks/{taskId}/checklists/{itemId}            | Checklist öğesini sil             | Giriş Yapılmış  |

### Ekler (Attachments)

| HTTP Metodu | Endpoint                                             | Aciklama                              | Yetki Seviyesi  |
|-------------|------------------------------------------------------|---------------------------------------|-----------------|
| GET         | /tasks/{taskId}/attachments                          | Göreve ait dosya eklerini listele     | Giriş Yapılmış  |
| POST        | /tasks/{taskId}/attachments                          | Dosya yükle (multipart/form-data)     | Giriş Yapılmış  |
| GET         | /tasks/{taskId}/attachments/{attachmentId}/download  | Dosyayı indir veya aktar              | Giriş Yapılmış  |
| DELETE      | /tasks/{taskId}/attachments/{attachmentId}           | Dosya ekini sil                       | Giriş Yapılmış  |

### Yorumlar

| HTTP Metodu | Endpoint                               | Aciklama                                   | Yetki Seviyesi  |
|-------------|----------------------------------------|--------------------------------------------|-----------------|
| GET         | /tasks/{taskId}/comments               | Göreve ait yorumları kronolojik listele    | Giriş Yapılmış  |
| POST        | /tasks/{taskId}/comments               | Yorum ekle (yazar: giriş yapan kullanıcı) | Giriş Yapılmış  |
| DELETE      | /tasks/{taskId}/comments/{commentId}   | Yorumu sil                                 | Giriş Yapılmış  |

### Görev Tipleri (Task Types)

| HTTP Metodu | Endpoint                         | Aciklama                                                        | Yetki Seviyesi     |
|-------------|----------------------------------|-----------------------------------------------------------------|--------------------|
| GET         | /task-types                      | Görev tiplerini listele (opsiyonel: ?organizationId=)           | Giriş Yapılmış     |
| GET         | /task-types/{id}                 | Tek görev tipi detayını getir (kolonlar ve kurallar dahil)      | Giriş Yapılmış     |
| POST        | /task-types                      | Yeni görev tipi oluştur (kolonlar ve kurallar birlikte)         | ADMIN / SUPER_ADMIN|
| PUT         | /task-types/{id}                 | Görev tipini güncelle                                           | ADMIN / SUPER_ADMIN|
| DELETE      | /task-types/{id}                 | Görev tipini sil                                                | ADMIN / SUPER_ADMIN|
| POST        | /task-types/{id}/rules           | Görev tipine geçiş kuralı ekle                                  | ADMIN / SUPER_ADMIN|
| DELETE      | /task-types/{id}/rules/{ruleId}  | Geçiş kuralı sil                                                | ADMIN / SUPER_ADMIN|

---

## 7. Ortam Değişkenleri

| Değişken           | Varsayılan Değer  | Açıklama                                         |
|--------------------|-------------------|--------------------------------------------------|
| DB_HOST            | postgres          | Veritabanı sunucusu adresi                       |
| DB_PORT            | 5432              | Veritabanı portu                                 |
| DB_NAME            | kanban_db         | Veritabanı adı                                   |
| DB_USER            | kanban_user       | Veritabanı kullanıcı adı                         |
| DB_PASS            | kanban_pass       | Veritabanı şifresi                               |
| JWT_SECRET         | (zorunlu)         | JWT imzalama anahtarı; üretim için değiştirilmeli|
| JWT_EXPIRATION_MS  | 86400000          | Token geçerlilik süresi (ms); varsayılan 24 saat |
| CORS_ORIGINS       | http://localhost  | İzin verilen kaynak adresler (CORS)              |
| SERVER_PORT        | 8080              | Spring Boot dinleme portu                        |

Üretim ortamına geçiş öncesinde `JWT_SECRET` mutlaka güçlü ve rastgele bir değer ile değiştirilmelidir.
Örnek üretim: `openssl rand -base64 64`

---

## 8. Proje Dizin Yapısı

```
kanban-task-management/
+-- backend/
|   +-- src/main/java/com/kanban/
|   |   +-- controller/        # REST katmanı (AuthController, BoardController, ...)
|   |   +-- service/           # İş mantığı (BoardService, TaskService, TaskTypeService, ...)
|   |   +-- repository/        # Spring Data JPA arayüzleri
|   |   +-- entity/            # JPA entity sınıfları (User, Board, Task, TaskType, ...)
|   |   +-- dto/               # Veri transfer nesneleri (Request / Response / Dto Records)
|   |   +-- security/          # JWT filtresi, SecurityConfig, UserDetailsService
|   |   +-- config/            # Uygulama yapılandırması (DataInitializer, CorsConfig, ...)
|   +-- Dockerfile
|   +-- pom.xml
+-- frontend/
|   +-- src/
|   |   +-- components/        # Yeniden kullanılabilir React bileşenler
|   |   +-- pages/             # Sayfa düzeyindeki bileşenler (BoardPage, AdminTaskTypesPage, ...)
|   |   +-- context/           # AuthContext (JWT, kullanıcı durumu)
|   |   +-- types/             # TypeScript tip tanımları (index.ts)
|   |   +-- App.tsx            # Rota tanımları
|   +-- Dockerfile
|   +-- vite.config.ts
+-- docker-compose.yml
+-- .env.example
+-- README.md
```

---

## 9. Test Kullanıcıları (DataInitializer)

Sistem ilk çalıştırıldığında aşağıdaki kullanıcılar otomatik olarak oluşturulur.

| Kullanıcı Adı  | E-posta               | Şifre    | Rol              |
|----------------|-----------------------|----------|------------------|
| superadmin     | -                     | admin123 | ROLE_SUPER_ADMIN |
| ali_yilmaz     | ali@kanban.local      | user123  | ROLE_USER        |
| ayse_kaya      | ayse@kanban.local     | user123  | ROLE_USER        |
| mehmet_demir   | mehmet@kanban.local   | user123  | ROLE_USER        |
| zeynep_celik   | zeynep@kanban.local   | user123  | ROLE_USER        |
| can_ozkan      | can@kanban.local      | user123  | ROLE_ADMIN       |

---

## 10. Lisans

Bu proje kurumsal iç kullanım amaçlı geliştirilmiştir. Açık kaynak lisans uygulanmamaktadır.
