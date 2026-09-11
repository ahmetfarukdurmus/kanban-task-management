# Kurumsal Çok Kiracılı Kanban ve İş Akışı Yönetim Platformu

Birden fazla organizasyonu, dinamik görev tipi tanımlarını ve sunucu katmanında zorunlu kılınan kural tabanlı iş akışı geçiş denetleyicilerini destekleyen, üretime hazır tam yığın bir proje yönetim platformu.

---

## İçindekiler

1. [Genel Bakış](#1-genel-bakış)
2. [Teknoloji Yığını](#2-teknoloji-yığını)
3. [Sistem Mimarisi ve Tasarım Prensipleri](#3-sistem-mimarisi-ve-tasarım-prensipleri)
4. [Alan Modeli ve Veritabanı İlişkileri](#4-alan-modeli-ve-veritabanı-i̇lişkileri)
5. [İş Akışı Motoru — Geçiş Denetleyicileri](#5-i̇ş-akışı-motoru--geçiş-denetleyicileri)
6. [Güvenlik ve Rol Tabanlı Erişim Kontrolü](#6-güvenlik-ve-rol-tabanlı-erişim-kontrolü)
7. [REST API Tasarımı](#7-rest-api-tasarımı)
8. [Kurulum ve Çalıştırma](#8-kurulum-ve-çalıştırma)

---

## 1. Genel Bakış

Bu platform, birbirinden yalıtılmış birden fazla kiracı organizasyonunda Kanban tarzı board yönetimi sunar. Her organizasyon kendi **Görev Tiplerini** tanımlayabilir. Görev Tipleri; o tipe ait görevlerin kolon yapısını ve kolonlar arası geçiş kurallarını önceden belirleyen iş akışı şablonlarıdır. Geçiş kuralları sunucu tarafında doğrulandığından, istemci tarafından iş akışı denetleyicilerinin atlatılması mümkün değildir.

**Temel Yetenekler:**

- Üye atamasını destekleyen çok kiracılı organizasyon yönetimi
- Organizasyon bazlı dinamik Görev Tipi tanımları (özel kolonlar ve renk desteği)
- Yapılandırılabilir kolon geçiş kuralları (`CHECKLIST_REQUIRED`, `ATTACHMENT_REQUIRED`)
- Boşluk açmadan pozisyon kaydıran verimli bir algoritmayla sürükle-bırak görev sıralama
- Kapsamlı görev detay alanları: atanan kullanıcılar, raporlayan, öncelik, bitiş tarihleri, hedef ortam, hikaye puanı, tahmini saat
- Görev başına iş parçacıklı yorumlar ve dosya ekleri
- Üç kademeli RBAC ile vatansız JWT kimlik doğrulaması

---

## 2. Teknoloji Yığını

### Backend

| Konu | Teknoloji |
|---|---|
| Dil | Java 21 (LTS) |
| Framework | Spring Boot 3.x |
| Güvenlik | Spring Security 6 + JJWT (vatansız JWT) |
| Kalıcılık | Spring Data JPA / Hibernate 6 |
| Veritabanı | PostgreSQL 16 |
| Derleme | Apache Maven |
| Tekrar eden kod azaltma | Lombok (`@Data`, `@RequiredArgsConstructor`, `@Builder`) |
| Dosya yönetimi | Spring Multipart (dosya/istek başına 25 MB) |
| Şema yönetimi | Hibernate DDL otomatik (`update` geliştirmede, `validate` üretimde) |

### Frontend

| Konu | Teknoloji |
|---|---|
| Dil | TypeScript 5 |
| Framework | React 18 |
| Sunucu durumu | TanStack React Query v5 |
| Stil | Tailwind CSS 3 |
| Paketleyici | Vite |
| HTTP istemcisi | Axios |
| Sürükle ve bırak | @hello-pangea/dnd |

### Altyapı

| Konu | Teknoloji |
|---|---|
| Konteynerizasyon | Docker + Docker Compose v2 |
| Frontend sunumu | Nginx (`/api` isteklerini backend'e ters vekil olarak yönlendirir) |
| Veritabanı kalıcılığı | Docker adlandırılmış birimi (`kanban_postgres_data`) |

---

## 3. Sistem Mimarisi ve Tasarım Prensipleri

### Katmanlı Mimari

```
İstemci (React SPA)
        |
        |  HTTP / JSON
        v
Controller Katmanı    — Girdi doğrulama (@Valid), HTTP eşleme, iş mantığı yok
        |
        v
Service Katmanı       — Tüm iş mantığı: yetkilendirme, geçiş denetleyicileri,
        |               pozisyon yeniden hesaplama, DTO birleştirme
        v
Repository Katmanı    — Spring Data JPA arayüzleri; toplu işlemler için özel JPQL
        |
        v
Veritabanı (PostgreSQL 16)
```

Her katman birbirinden kesin olarak ayrılmıştır. Controller'lar incedir: gelen isteği doğrular, ilgili service metodunu çağırır ve sonucu HTTP yanıtı olarak döndürür. Hiçbir controller'dan doğrudan JPA entity'si döndürülmez.

### DTO Deseni — Entity İzolasyonu

Her API yanıtı, ham bir JPA entity'si değil, bir Veri Aktarım Nesnesidir (DTO). Bu tasarım kararı üç garantiyi beraberinde getirir:

1. **Döngüsel serileştirme yok.** Çift yönlü JPA ilişkileri (`@OneToMany` ↔ `@ManyToOne`), entity'ler doğrudan serileştirilseydi Jackson'ın sonsuz döngüye girmesine yol açardı. DTO'lar yalnızca istemcinin ihtiyaç duyduğu alanları içererek bu döngüyü kırar.
2. **Kimlik bilgisi sızıntısı yok.** `User.password` (BCrypt özeti) hiçbir yanıt DTO'suna dahil edilmez.
3. **Kararlı API sözleşmesi.** İç şema değişiklikleri (alan yeniden adlandırma, ilişki yeniden yapılandırma), DTO eşleştiricisi buna göre güncellendiği sürece API yüzeyini etkilemez.

Temel yanıt DTO'ları:

| DTO | İçerik |
|---|---|
| `BoardResponse` | Board meta verisi, `taskTypeName`, `taskTypeColor`, düz kolon listesi |
| `TaskResponse` | Tam görev alanları, atanan kullanıcı özetleri, kontrol listesi öğeleri, ek listesi, raporlayan özeti |
| `TaskTypeDto` | Görev tipi tanımı, sıralı kolon listesi, geçiş kuralları |
| `AuthResponse` | JWT token dizesi + kullanıcı özeti (id, username, rol, organizasyon) |
| `UserSummaryDto` | Güvenli kullanıcı projeksiyonu — id, username, e-posta, rol, organizasyon ID'leri |

### Bağımlılık Enjeksiyonu — Constructor Injection

Tüm Spring tarafından yönetilen bean'ler, Lombok'un `@RequiredArgsConstructor` anotasyonu aracılığıyla yalnızca constructor injection kullanır. Bu, her bağımlılığın `final` olduğu anlamına gelir ve bean'leri yapılandırma sonrasında fiilen değişmez kılar. Faydaları:

- Bağımlılıklar açık ve constructor imzasında görünürdür
- Kısmi başlatma mümkün değildir; bir bean ya tamamen oluşur ya da başarısız olur
- Birim testleri, herhangi bir Spring bağlamına ihtiyaç duymadan sahte nesneler enjekte edebilir

### Pozisyon ve Sıralama Algoritması

Board kolonları ve görevler, ebeveynleri içinde sıfır tabanlı bir tam sayı `position` alanı taşır. Bir kolon veya görev eklendiğinde, silindiğinde ya da yeniden sıralandığında, yalnızca etkilenen aralıktaki kardeş kayıtlar güncellenir; tüm kardeşler değil.

İki `@Modifying` JPQL metodu kullanılır:

```java
// Silinen pozisyondan büyük tüm pozisyonları 1 azalt (boşluğu kapat)
@Modifying
@Query(\"\"\"
    UPDATE BoardColumn c
    SET c.position = c.position - 1
    WHERE c.board.id = :boardId AND c.position > :position
    \"\"\")
void shiftPositionsLeft(@Param(\"boardId\") Long boardId, @Param(\"position\") int position);

// Hedef pozisyondan büyük veya eşit tüm pozisyonları 1 artır (yer aç)
@Modifying
@Query(\"\"\"
    UPDATE BoardColumn c
    SET c.position = c.position + 1
    WHERE c.board.id = :boardId AND c.position >= :position
    \"\"\")
void shiftPositionsRight(@Param(\"boardId\") Long boardId, @Param(\"position\") int position);
```

`TaskRepository`'de `columnId` kapsamlı eşdeğer metodlar bulunmaktadır. Yeniden sıralama service metodu, ara tutarsızlığı önlemek amacıyla her iki işlemi tek bir `@Transactional` sınırı içinde çalıştırır. Bu yaklaşım, yalnızca etkilenen satırları güncelleyen tek bir SQL `UPDATE` işlemi yayınlar; tüm koleksiyon için O(n) yerine, kaydırılan eleman sayısı k olmak üzere O(k) karmaşıklığına sahiptir.

---

## 4. Alan Modeli ve Veritabanı İlişkileri

### Entity İlişki Haritası

```
Organization
  |-- ManyToMany --> User              (birleştirme tablosu: user_organizations)
  |-- OneToMany  --> TaskType
                       |-- OneToMany  --> TaskTypeColumn       (pozisyon sıralı)
                       |-- OneToMany  --> TaskTypeTransitionRule

Board
  |-- ManyToOne  --> Organization
  |-- ManyToOne  --> User (sahip)
  |-- ManyToOne  --> TaskType (isteğe bağlı şablon)
  |-- OneToMany  --> BoardColumn       (cascade ALL, orphanRemoval)
                       |-- OneToMany  --> Task                 (cascade ALL, orphanRemoval)
                                            |-- ManyToMany --> User[]         (task_assignees)
                                            |-- ManyToOne  --> User           (reporter)
                                            |-- ManyToOne  --> TaskType       (geçersiz kılma)
                                            |-- OneToMany  --> TaskChecklistItem  (cascade ALL)
                                            |-- OneToMany  --> Attachment         (cascade ALL)
                                            |-- OneToMany  --> Comment            (cascade ALL)
```

### Entity Referansı

| Entity | Tablo | Önemli Alanlar |
|---|---|---|
| `User` | `users` | `username`, `email`, `password` (BCrypt), `role` (enum), `createdAt` |
| `Organization` | `organizations` | `name` |
| `Board` | `boards` | `name`, `description`, `position` |
| `BoardColumn` | `board_columns` | `title`, `position` |
| `Task` | `tasks` | `title`, `description`, `priority`, `dueDate`, `testDueDate`, `targetEnvironment`, `estimatedHours`, `storyPoints`, `position` |
| `TaskChecklistItem` | `task_checklist_items` | `content`, `isCompleted`, `requiredForColumnId` |
| `Attachment` | `attachments` | `fileName`, `fileType`, `filePath`, `fileSize` |
| `Comment` | `comments` | `content`, `createdAt` |
| `TaskType` | `task_types` | `name`, `colorHex`, `description` |
| `TaskTypeColumn` | `task_type_columns` | `title`, `colorHex`, `position` |
| `TaskTypeTransitionRule` | `task_type_transition_rules` | `ruleType`, `sourceColumnTitle`, `targetColumnTitle` |

### Cascade ve Yaşam Döngüsü Yönetimi

| Ebeveyn | Basamaklanan Alt Kayıtlar | orphanRemoval |
|---|---|---|
| `Board` | `BoardColumn` | Evet |
| `BoardColumn` | `Task` | Evet |
| `Task` | `TaskChecklistItem`, `Attachment`, `Comment` | Evet |
| `TaskType` | `TaskTypeColumn`, `TaskTypeTransitionRule` | Evet |

`orphanRemoval = true`; Java tarafında bir alt nesnenin ebeveyn koleksiyonundan çıkarılmasının, ilgili veritabanı satırının otomatik olarak silinmesini sağlar; açık bir silme sorgusu gerektirmez.

### Numaralandırmalar (Enum)

| Enum | Değerler |
|---|---|
| `Role` | `ROLE_USER`, `ROLE_ADMIN`, `ROLE_SUPER_ADMIN` |
| `Priority` | `LOW`, `MEDIUM`, `HIGH` |
| `TransitionRuleType` | `CHECKLIST_REQUIRED`, `ATTACHMENT_REQUIRED` |

---

## 5. İş Akışı Motoru — Geçiş Denetleyicileri

### Mekanizma

Bir istemci `PATCH /api/tasks/{taskId}/move` isteği gönderdiğinde, service katmanı kolon değişikliğine izin vermeden önce görevin `TaskType`'ına bağlı tüm geçiş kurallarını değerlendirir. Denetleyici tamamen sunucu tarafında çalışır; frontend'in bunu atlama veya geçersiz kılma imkânı yoktur.

`TaskService.moveTask()` içindeki değerlendirme sırası:

```
1. Görevi ve TaskType'ını çöz
2. targetColumnTitle'ı hedef kolonla eşleşen tüm kuralları topla
   (kolon ID → TaskTypeColumn başlığı → normalizeColumnName() bulanık eşleme sırasıyla)
3. Kural kaynak kolonu belirtiyorsa sourceColumnTitle'a göre isteğe bağlı filtrele
4. Eşleşen her kural için:
     CHECKLIST_REQUIRED  →  tüm TaskChecklistItem'ların isCompleted = true olması zorunlu
     ATTACHMENT_REQUIRED →  görevin en az bir Attachment kaydına sahip olması zorunlu
5. Herhangi bir kural ihlal edilirse → BusinessException fırlat (400 Bad Request olarak eşlenir)
6. Aksi takdirde → task.column güncelle, pozisyonları yeniden hesapla, kaydet
```

### Türkçe Karakter Normalizasyonu

Kural kolon başlıkları, dize karşılaştırmasından önce `normalizeColumnName()` kullanılarak Türkçe yerel aksan karakterlerini ASCII temel karakterlerine dönüştürerek karşılaştırılır:

```
ş → s   ç → c   ğ → g   ı → i   ö → o   ü → u
```

Bu sayede Türkçe karakter içeren başlıklar için oluşturulan kurallar, küçük yazım farklılıklarına bakılmaksızın board kolonlarıyla eşleşebilir.

### Kural Yapılandırma Örneği

Aşağıdaki kurallara sahip bir Görev Tipi, aşamalı bir doğrulama iş akışı uygular:

| Hedef Kolon | Kural Tipi | Zorunluluk |
|---|---|---|
| `In Testing` | `CHECKLIST_REQUIRED` | Tüm geliştirme kontrol listesi öğeleri tamamlanmış olmalıdır |
| `Awaiting Approval` | `CHECKLIST_REQUIRED` | Tüm QA kontrol listesi öğeleri tamamlanmış olmalıdır |
| `Released` | `ATTACHMENT_REQUIRED` | En az bir dosya eki mevcut olmalıdır |

---

## 6. Güvenlik ve Rol Tabanlı Erişim Kontrolü

### Kimlik Doğrulama

Uygulama vatansız JWT kimlik doğrulaması kullanır:

1. İstemci, kimlik bilgilerini `POST /api/auth/login` adresine gönderir
2. Sunucu kimlik bilgilerini doğrular ve imzalı bir JWT (HMAC-SHA256) yayınlar
3. İstemci, sonraki isteklere token'ı ekler: `Authorization: Bearer <token>`
4. `JwtAuthenticationFilter`, her isteği durdurur, token'ı doğrular ve Spring Security bağlamını doldurur

Token ömrü varsayılan olarak 24 saattir (`JWT_EXPIRATION_MS = 86400000`).

### Roller

| Rol | Açıklama |
|---|---|
| `ROLE_SUPER_ADMIN` | Tam platform erişimi — organizasyonları, tüm kullanıcıları, tüm board'ları ve görev tiplerini yönetir |
| `ROLE_ADMIN` | Kendi organizasyonu içindeki board'ları ve görev tiplerini yönetir |
| `ROLE_USER` | Görev oluşturur ve günceller, yorum ekler, dosya yükler; süreç açısından kritik alanlarda salt okunur erişime sahiptir |

### Endpoint Düzeyinde Yetkilendirme (`@PreAuthorize`)

| Endpoint | Gerekli Minimum Rol |
|---|---|
| `DELETE /api/boards/{id}` | `ADMIN` |
| `POST /api/organizations` | `SUPER_ADMIN` |
| `DELETE /api/organizations/{id}` | `SUPER_ADMIN` |
| `POST /api/organizations/{orgId}/members/*` | `SUPER_ADMIN` |
| `DELETE /api/organizations/{orgId}/members/{userId}` | `SUPER_ADMIN` |
| `POST /api/task-types` | `ADMIN` |
| `PUT /api/task-types/{id}` | `ADMIN` |
| `DELETE /api/task-types/{id}` | `ADMIN` |
| `POST /api/task-types/{id}/rules` | `ADMIN` |
| `DELETE /api/task-types/{id}/rules/{ruleId}` | `ADMIN` |

### Frontend Arayüz Erişim Kontrolü

React uygulaması, `useAuth()` aracılığıyla çözümlenen JWT token'ından RBAC durumunu türetir:

- **Görev Detayındaki Süreç Alanları** (`taskType`, `reporter`, `dueDate`, `testDueDate`, `targetEnvironment`) — `ROLE_USER` için devre dışı bırakılmış, salt okunur bileşenler olarak gösterilir
- **Board silme eylemi** — `ROLE_USER` için gizlenir
- **Görev Tipi yönetim paneli** — `ROLE_USER` için gizlenir

---

## 7. REST API Tasarımı

### Tasarım Prensipleri

**Hiyerarşik yönlendirme**, her zaman bir ebeveyn bağlamında erişilen kaynaklar için kullanılır:

```
/boards/{boardId}/columns/{columnId}/tasks/{taskId}
```

**Düz yönlendirme** kısayolları, ebeveyn sınırlarını aşan işlemler (örneğin bir görevi kolonlar arasında taşıma) ya da ebeveyn bağlamının gerekli olmadığı durumlar için sağlanır:

```
PATCH /tasks/{taskId}/move
PUT   /tasks/{taskId}
```

**HTTP durum kodları** REST kurallarını izler:
- `200 OK` — başarılı okuma veya güncelleme
- `201 Created` — kaynak başarıyla oluşturuldu (yanıt gövdesinde eşdeğer `Location` bilgisi bulunur)
- `204 No Content` — başarılı silme veya üye ataması
- `400 Bad Request` — doğrulama hatası veya geçiş kuralı ihlali (`BusinessException`)
- `401 Unauthorized` — JWT eksik veya geçersiz
- `403 Forbidden` — yetersiz rol
- `404 Not Found` — kaynak mevcut değil

**PATCH**, tüm kaynağı değiştirmeyen kısmi, anlamsal durum değişiklikleri için kullanılır:
- `PATCH /tasks/{taskId}/move` — pozisyon yeniden hesaplamalı kolon geçişi
- `PATCH /tasks/{taskId}/checklists/{itemId}/toggle` — tek bir boolean değeri değiştirme

---

### Temel URL

```
http://localhost:8080/api
```

`/auth/*` ve `GET /organizations` dışındaki tüm endpoint'ler aşağıdaki başlığı gerektirir:

```
Authorization: Bearer <JWT>
```

---

### Kimlik Doğrulama

| Metot | Yol | İstek Gövdesi | Yanıt |
|---|---|---|---|
| `POST` | `/auth/register` | `{ username, email, password, organizationId? }` | `201` + `AuthResponse` |
| `POST` | `/auth/login` | `{ username, password }` | `200` + `AuthResponse` |

---

### Kullanıcılar

| Metot | Yol | Yanıt |
|---|---|---|
| `GET` | `/users` | `200` + `UserSummaryDto[]` |

---

### Organizasyonlar

| Metot | Yol | Gerekli Rol | Yanıt |
|---|---|---|---|
| `GET` | `/organizations` | Yok (herkese açık) | `200` + `OrganizationDto[]` |
| `POST` | `/organizations` | `SUPER_ADMIN` | `201` + `OrganizationDto` |
| `DELETE` | `/organizations/{id}` | `SUPER_ADMIN` | `204` |
| `GET` | `/organizations/{orgId}/members` | Kimliği doğrulanmış | `200` + `UserSummaryDto[]` |
| `POST` | `/organizations/{orgId}/members/existing` | `SUPER_ADMIN` | `204` |
| `POST` | `/organizations/{orgId}/members/new` | `SUPER_ADMIN` | `201` + `UserSummaryDto` |
| `DELETE` | `/organizations/{orgId}/members/{userId}` | `SUPER_ADMIN` | `204` |

---

### Board'lar

| Metot | Yol | Gerekli Rol | Yanıt |
|---|---|---|---|
| `GET` | `/boards` | Kimliği doğrulanmış | `200` + `BoardResponse[]` |
| `POST` | `/boards` | Kimliği doğrulanmış | `201` + `BoardResponse` |
| `GET` | `/boards/{id}` | Kimliği doğrulanmış | `200` + `BoardResponse` |
| `PUT` | `/boards/{id}` | Kimliği doğrulanmış | `200` + `BoardResponse` |
| `DELETE` | `/boards/{id}` | `ADMIN` | `204` |

---

### Board Kolonları

| Metot | Yol | Açıklama |
|---|---|---|
| `GET` | `/boards/{boardId}/columns` | Görevleriyle birlikte kolonları listele |
| `POST` | `/boards/{boardId}/columns` | Kolon oluştur |
| `GET` | `/boards/{boardId}/columns/{columnId}` | Kolonu getir |
| `PUT` | `/boards/{boardId}/columns/{columnId}` | Kolonu yeniden adlandır |
| `DELETE` | `/boards/{boardId}/columns/{columnId}` | Kolonu ve tüm alt görevlerini sil |
| `PATCH` | `/boards/{boardId}/columns/{columnId}/reorder` | Kolon pozisyonunu değiştir — gövde: `{ "newPosition": <int> }` |

---

### Görevler

| Metot | Yol | Açıklama |
|---|---|---|
| `GET` | `/boards/{boardId}/columns/{columnId}/tasks` | Kolondaki görevleri listele |
| `POST` | `/boards/{boardId}/columns/{columnId}/tasks` | Görev oluştur |
| `GET` | `/boards/{boardId}/columns/{columnId}/tasks/{taskId}` | Görev detayını getir |
| `PUT` | `/boards/{boardId}/columns/{columnId}/tasks/{taskId}` | Görev alanlarını güncelle |
| `PUT` | `/tasks/{taskId}` | Görevi güncelle (kolon bağlamından bağımsız kısayol) |
| `DELETE` | `/boards/{boardId}/columns/{columnId}/tasks/{taskId}` | Görevi sil |
| `PATCH` | `/tasks/{taskId}/move` | Görevi kolonlar arasında taşı, geçiş kurallarını uygula |

Taşıma isteği gövdesi:

```json
{
  "targetColumnId": 12,
  "newPosition": 0
}
```

---

### Kontrol Listesi Öğeleri

| Metot | Yol | Açıklama |
|---|---|---|
| `POST` | `/tasks/{taskId}/checklists` | Öğe ekle |
| `PATCH` | `/tasks/{taskId}/checklists/{itemId}/toggle` | `isCompleted` değerini değiştir |
| `PUT` | `/tasks/{taskId}/checklists/{itemId}` | Öğe içeriğini güncelle |
| `DELETE` | `/tasks/{taskId}/checklists/{itemId}` | Öğeyi sil |

---

### Yorumlar

| Metot | Yol | Açıklama |
|---|---|---|
| `GET` | `/tasks/{taskId}/comments` | Yorumları listele (`createdAt` artan sırada) |
| `POST` | `/tasks/{taskId}/comments` | Yorum ekle (yazar JWT'den çözümlenir) |
| `DELETE` | `/tasks/{taskId}/comments/{commentId}` | Yorumu sil |

---

### Ekler

| Metot | Yol | Açıklama |
|---|---|---|
| `GET` | `/tasks/{taskId}/attachments` | Ekleri listele |
| `POST` | `/tasks/{taskId}/attachments` | Dosya yükle — `multipart/form-data`, alan adı: `file`, maks. 25 MB |
| `GET` | `/tasks/{taskId}/attachments/{attachmentId}/download` | Doğru `Content-Type` ile dosyayı aktar |
| `DELETE` | `/tasks/{taskId}/attachments/{attachmentId}` | Eki sil |

---

### Görev Tipleri

| Metot | Yol | Gerekli Rol | Açıklama |
|---|---|---|---|
| `GET` | `/task-types` | Kimliği doğrulanmış | Görev tiplerini listele; isteğe bağlı filtre: `?organizationId=` |
| `GET` | `/task-types/{id}` | Kimliği doğrulanmış | Görev tipi detayını getir |
| `POST` | `/task-types` | `ADMIN` | Görev tipi oluştur |
| `PUT` | `/task-types/{id}` | `ADMIN` | Görev tipini güncelle |
| `DELETE` | `/task-types/{id}` | `ADMIN` | Görev tipini sil |
| `POST` | `/task-types/{id}/rules` | `ADMIN` | Geçiş kuralı ekle |
| `DELETE` | `/task-types/{id}/rules/{ruleId}` | `ADMIN` | Geçiş kuralını kaldır |

---

## 8. Kurulum ve Çalıştırma

### Ön Koşullar

- Docker Desktop v24+ ve Docker Compose v2 (`docker compose` — tire olmadan)
- Docker kullanıldığında yerel Java veya Node.js kurulumu gerekmez

### Docker Compose (Önerilen)

```bash
# Depoyu klonlayın
git clone <repository-url>
cd kanban-task-management

# İsteğe bağlı: varsayılan ortam değişkenlerini geçersiz kılın
cp .env.example .env
# .env dosyasını gerektiği gibi düzenleyin (JWT gizli anahtarı, veritabanı kimlik bilgileri vb.)

# Tüm servisleri derleyip başlatın
docker compose up --build -d

# Başlangıç günlüklerini takip edin
docker compose logs -f

# Konteynerleri durdurun (veri birimi korunur)
docker compose down

# Konteynerleri durdurun ve tüm kalıcı verileri silin
docker compose down -v
```

Başarılı bir başlatmanın ardından servis erişilebilirliği:

| Servis | Adres |
|---|---|
| Frontend | http://localhost |
| Backend API | http://localhost:8080/api |
| PostgreSQL | localhost:5432 (yalnızca yerel; dışarıya açık değil) |

İlk derleme yaklaşık 2–4 dakika sürer. Sonraki `docker compose up` komutları imaj önbelleğini kullanır ve saniyeler içinde başlar.

### Ortam Değişkenleri

| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `DB_HOST` | `postgres` | PostgreSQL sunucu adı (Docker servis adı) |
| `DB_PORT` | `5432` | PostgreSQL portu |
| `DB_NAME` | `kanban_db` | Veritabanı adı |
| `DB_USER` | `kanban_user` | Veritabanı kullanıcı adı |
| `DB_PASS` | `kanban_pass` | Veritabanı şifresi |
| `JWT_SECRET` | *(paketlenmiş base64 anahtarı)* | HMAC-SHA256 imzalama gizli anahtarı — üretim öncesinde mutlaka değiştirilmeli |
| `JWT_EXPIRATION_MS` | `86400000` | Token geçerlilik süresi (milisaniye; varsayılan: 24 saat) |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:3000` | Yerel geliştirme için izin verilen CORS kökenleri |
| `SERVER_PORT` | `8080` | Backend HTTP dinleme portu |
| `UPLOAD_DIR` | `uploads` | Ek dosya depolama dizini |

**Üretim güçlendirme kontrol listesi:**
- Benzersiz bir JWT gizli anahtarı üretin: `openssl rand -base64 64`
- `spring.jpa.hibernate.ddl-auto: validate` olarak ayarlayın
- 5432 portunun genel bir ağ arayüzüne bağlı olmadığından emin olun
- Yük dengeleyici veya Nginx katmanında TLS sonlandırması kullanın

### Yerel Geliştirme (Docker Olmadan)

**Backend** — varsayılan kimlik bilgileriyle yerel olarak çalışan bir PostgreSQL örneği gerektirir:

```bash
cd backend
mvn spring-boot:run
# API şu adreste erişilebilir: http://localhost:8080/api
```

**Frontend** — HMR ile Vite geliştirme sunucusu, `/api` isteklerini `http://localhost:8080` adresine yönlendirir:

```bash
cd frontend
npm install
npm run dev
# Arayüz şu adreste erişilebilir: http://localhost:5173
```

---

## Proje Yapısı

```
kanban-task-management/
├── backend/
│   ├── src/main/java/com/kanban/
│   │   ├── config/          SecurityConfig, DataInitializer, dosya yükleme yapılandırması
│   │   ├── controller/      9 REST controller (Auth, Board, Column, Task, TaskType,
│   │   │                    Organization, User, Attachment, Comment)
│   │   ├── dto/             Alan bazında istek ve yanıt DTO'ları (auth, board, column,
│   │   │                    task, tasktype, organization, user, attachment, comment)
│   │   ├── entity/          JPA entity sınıfları
│   │   ├── repository/      Özel JPQL içeren Spring Data JPA repository'leri
│   │   ├── security/        JwtFilter, JwtUtil, UserDetailsServiceImpl
│   │   └── service/         İş mantığı — BoardService, TaskService,
│   │                        TaskTypeService, OrganizationService vb.
│   ├── src/main/resources/
│   │   └── application.yml  Tam uygulama yapılandırması
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── api/             Alan bazında Axios istemci modülleri
│   │   ├── components/      Yeniden kullanılabilir React bileşenleri
│   │   ├── context/         AuthContext — JWT çözümleme, currentUser, rol yardımcıları
│   │   ├── pages/           Rota düzeyinde sayfa bileşenleri (BoardsPage, BoardDetailPage vb.)
│   │   └── types/           Backend DTO'larıyla hizalanmış TypeScript arayüzleri
│   └── Dockerfile
├── docker-compose.yml
├── .env.example
└── README.md
```
