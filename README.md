# Kanban Task Management

> **Staj Projesi – Part 1** | Çok kiracılı (multi-tenant), rol tabanlı yetkilendirme (RBAC) ve REST API mimarisine sahip kurumsal Kanban board uygulaması.
> Tüm stack'i tek komutla başlat: `docker compose up -d`

---

## İçindekiler

- [Proje Tanımı ve Genel Bakış](#proje-tanımı-ve-genel-bakış)
- [Özellikler](#özellikler)
- [Kullanıcı Rolleri ve Yetki Hiyerarşisi (RBAC)](#kullanıcı-rolleri-ve-yetki-hiyerarşisi-rbac)
- [Varsayılan Test Hesapları (Seed Data)](#varsayılan-test-hesapları-seed-data)
- [Teknoloji Yığını](#teknoloji-yığını)
- [Mimari ve Çok Kiracılık (Multi-Tenancy)](#mimari-ve-çok-kiracılık-multi-tenancy)
- [Docker ile Kurulum ve Çalıştırma](#docker-ile-kurulum-ve-çalıştırma)
- [Lokal Geliştirme Ortamı (Development Setup)](#lokal-geliştirme-ortamı-development-setup)
- [API Referansı](#api-referansı)
- [Proje Yapısı](#proje-yapısı)
- [Mimari Kararlar ve Teknik Gerekçeler](#mimari-kararlar-ve-teknik-gerekçeler)
- [Ortam Değişkenleri](#ortam-değişkenleri)
- [Güvenlik Notları](#güvenlik-notları)
- [Git Commit Sözleşmesi](#git-commit-sözleşmesi)
- [Geliştirici](#geliştirici)

---

## Proje Tanımı ve Genel Bakış

Bu uygulama, kurumsal organizasyonların ve departmanların iş süreçlerini dijital Kanban panoları üzerinden izole bir şekilde yönetmelerini sağlar.

Sistem **çok kiracılı (multi-tenant)** bir veri mimarisine sahiptir. Kullanıcılar sisteme kaydolurken departmanlarını (örneğin: **Muhasebe**, **Uyum ve Risk**) seçer. Veri izolasyonu sayesinde her departmanın üyeleri yalnızca kendi departmanlarına ait panoları, görevleri ve çalışma arkadaşlarını görebilir. 

Sürükle-bırak (drag-and-drop) arayüzü sayesinde kartlar aynı kolon içinde sıralanabilir ya da kolonlar arasında taşınabilir; her pozisyon değişikliği veritabanında atomik olarak saklanır. Görevler üzerinde yorumlaşma ve dosya/medya ekleme özellikleri Jira standartlarında sunulmaktadır.

---

## Özellikler

| Alan | Detay |
|---|---|
| **Kimlik Doğrulama** | Kayıt & giriş; JWT Bearer token ile stateless oturum yönetimi |
| **Çok Kiracılık (Multi-Tenancy)** | Departman bazlı veri izolasyonu (Muhasebe, Uyum ve Risk vb.) |
| **Rol Tabanlı Erişim (RBAC)** | 3 seviyeli yetki matrisi: Super Admin, Departman Yöneticisi, Ekip Üyesi |
| **Pano Yönetimi** | Departman bazlı pano oluşturma, listeleme, güncelleme ve silme |
| **Kolon Yönetimi** | Dinamik kolon CRUD işlemleri ve yatay sürükle-bırak sıralama |
| **Görev (Task) Yönetimi** | Başlık, açıklama, öncelik (Low/Medium/High), son teslim tarihi ve atanan kişi |
| **Yorum ve Ekler (Attachments)** | Görev detay modalı üzerinden çoklu yorumlaşma ve dosya/medya yükleme/indirme |
| **Kanban Drag & Drop** | Kolon içi sıralama & kolonlar arası anlık taşıma (optimistic UI update) |
| **Pozisyon Algoritması** | O(k) veritabanı güncellemesi; tam tablo yazımı olmaksızın aralık kaydırma |
| **Otomatik Seed Verisi** | Başlangıçta hazır departmanlar ve test kullanıcılarının otomatik yüklenmesi |
| **Hata Yönetimi** | RFC 7807 `ProblemDetail` standart hata formatı |

---

## Kullanıcı Rolleri ve Yetki Hiyerarşisi (RBAC)

Uygulama 3 farklı yetki seviyesine göre yapılandırılmıştır:

| Kullanıcı Seviyesi | Rol Tanımı | Departman Bağımlılığı | Pano Yetkileri | Görev Yetkileri | Kullanıcı Görünürlüğü |
|---|---|---|---|---|---|
| **Super Admin** | `ROLE_ADMIN` | Yok (`null`) | Şirket genelindeki tüm panoları görüntüler, istediği departmana pano açabilir ve silebilir. | Tüm panolarda görev açabilir, düzenleyebilir ve silebilir. | Şirketteki tüm kayıtlı kullanıcıları listeler. |
| **Departman Yöneticisi** | `ROLE_ADMIN` | Var (örn: `Muhasebe`) | Yalnızca kendi departmanının panolarını görüntüler, açar ve silebilir. | Kendi departman panolarında tam yetkilidir. | Yalnızca kendi departmanındaki ekip üyelerini listeler. |
| **Ekip Üyesi** | `ROLE_USER` | Var (örn: `Uyum & Risk`) | Yalnızca kendi departmanının panolarını görüntüler; pano açamaz ve silemez. | Kendi departman panolarında görev açar, düzenler, taşır ve yorum/ek ekler. | Yalnızca kendi departmanındaki çalışma arkadaşlarını listeler. |

---

## Varsayılan Test Hesapları (Seed Data)

Veritabanı ilk kez başlatıldığında veya sıfırlandığında `DataInitializer` tarafından otomatik oluşturulan hazır hesaplar:

| Kullanıcı Adı | Şifre | Rol | Departman | Açıklama |
|---|---|---|---|---|
| **`superadmin`** | `admin123` | `ROLE_ADMIN` | *(Genel Yönetim)* | Tüm şirket panolarını ve departmanları merkezi yöneten yönetici |
| **`muhasebe_admin`** | `admin123` | `ROLE_ADMIN` | `Muhasebe` | Muhasebe departmanı yöneticisi |
| **`uyum_admin`** | `admin123` | `ROLE_ADMIN` | `Uyum & Risk` | Uyum ve Risk departmanı yöneticisi |
| **`ahmet_muhasebe`** | `user123` | `ROLE_USER` | `Muhasebe` | Muhasebe departmanı ekip üyesi |
| **`mehmet_muhasebe`** | `user123` | `ROLE_USER` | `Muhasebe` | Muhasebe departmanı ekip üyesi |
| **`yunus_uyum`** | `user123` | `ROLE_USER` | `Uyum & Risk` | Uyum ve Risk departmanı ekip üyesi |
| **`elif_uyum`** | `user123` | `ROLE_USER` | `Uyum & Risk` | Uyum ve Risk departmanı ekip üyesi |

> **Not:** Sistem ilk açıldığında panolar listesi tertemiz ve boş gelir; panolar kullanıcılar veya yöneticiler tarafından oluşturulur.

---

## Teknoloji Yığını

### Backend

| Teknoloji | Versiyon | Seçim Gerekçesi |
|---|---|---|
| Java | 21 (LTS) | Virtual Thread desteği, modern dil özellikleri (records, pattern matching), uzun vadeli destek |
| Spring Boot | 3.3.x | Auto-configuration, embedded Tomcat, güçlü ekosistem; kurumsal Java standardı |
| Spring Security | 6.x | Stateless JWT için `SecurityFilterChain` DSL, `@EnableMethodSecurity` ile metot düzeyinde yetkilendirme |
| Spring Data JPA | -- | Repository pattern ile boilerplate-free veri erişimi; JPQL `@Modifying` sorguları |
| PostgreSQL | 16 | ACID uyumlu, ilişkisel veri bütünlüğü, üretim kanıtlanmış veritabanı |
| jjwt | 0.12.x | Modern fluent API, güvenli HMAC-SHA256 JWT üretimi ve doğrulaması |
| Lombok | 1.18.x | Getter, setter, builder kodlarını derleme zamanında üretir |
| MapStruct | 1.5.x | Annotation-processor tabanlı tip güvenli DTO mapper (sıfır runtime overhead) |

### Frontend

| Teknoloji | Versiyon | Seçim Gerekçesi |
|---|---|---|
| React | 18.x | Bileşen tabanlı kullanıcı arayüzü, Concurrent Mode |
| TypeScript | 5.x | Derleme zamanı statik tip güvenliği; API sözleşmesi uyumu |
| Vite | 5.x | ESM tabanlı hızlı geliştirme sunucusu ve optimize bundle çıktısı |
| Tailwind CSS | 3.x | Utility-first kurumsal açık renk tema tasarımı |
| @hello-pangea/dnd | 16.x | Fizik tabanlı, erişilebilir ve kararlı sürükle-bırak (DnD) desteği |
| TanStack React Query | 5.x | Sunucu state yönetimi, otomatik önbellekleme ve arka plan senkronizasyonu |
| Axios | 1.x | HTTP istemcisi, Bearer token interceptor ve merkezi hata yakalama |
| react-hot-toast | 2.x | Kullanıcı bildirimleri ve toast mesajları |
| date-fns | 3.x | Türkçe yerelleştirme destekli hafif tarih kütüphanesi |

### Altyapı

| Teknoloji | Seçim Gerekçesi |
|---|---|
| Docker + Compose V2 | Tek komutla yeniden üretilebilir ve izole çalışma ortamı |
| Multi-stage Dockerfile | Derleme araçlarını üretim imajından ayırarak minimum imaj boyutu |
| Nginx (Alpine) | SPA yönlendirmeleri ve `/api` reverse proxy sunumu |
| PostgreSQL 16 Alpine | Hafif, kararlı ve üretim standardı veritabanı imajı |

---

## Mimari ve Çok Kiracılık (Multi-Tenancy)

```
+-----------------------------------------------------------------+
|                   Docker Network (kanban-network)               |
|                                                                 |
|  +--------------+    /api/*    +--------------+    JDBC         |
|  |   Frontend   | ----------> |   Backend    | --------------> |
|  | nginx:alpine |  proxy_pass | Spring Boot 3|                 |
|  |   port: 80   |             |  port: 8080  |  +------------+ |
|  |              |  static     |              |  | PostgreSQL | |
|  |  React SPA   |  files      |  REST API    |  |     16     | |
|  |  (Vite dist) |             |  + JPA + JWT |  |  port:5432 | |
|  +--------------+             +--------------+  +------------+ |
|        ^                                                        |
|        | HTTP :80                                               |
+--------+-------------------------------------------------------+
         |
    Browser / Client
```

### Backend Katmanlı Mimari ve İzolasyon

```
Controller  ->  Service  ->  Repository  ->  Entity / DB
     |              |
     DTO       SecurityUtils / Tenant Filter
```

- **Organizasyon İzolasyonu:** `Board` ve `User` entity'leri `@ManyToOne` ilişkisi ile `Organization` tablosuna bağlıdır.
- **Tenant Guard:** `BoardService` ve `UserController` sorgularında giriş yapan kullanıcının rolü (`ROLE_ADMIN` vs `ROLE_USER`) ve `organization_id` değeri denetlenir. Super Admin tüm panoları görürken, standart kullanıcılar yalnızca kendi departmanlarının kayıtlarına erişebilir.

---

## Docker ile Kurulum ve Çalıştırma

### Ön Koşullar

- Docker Engine >= 24.0
- Docker Compose V2 (`docker compose` komutu)

### Adım 1 -- Repoyu Klonla

```bash
git clone https://github.com/ahmetfarukdurmus/kanban-task-management.git
cd kanban-task-management
```

### Adım 2 -- Tüm Servisleri Başlat

```bash
docker compose up -d
```

İlk çalıştırmada Docker imajları derlenir ve PostgreSQL sağlık kontrolünden geçtikten sonra backend ve frontend servisleri ayağa kaldırılır.

### Adım 3 -- Servislerin Durumunu Kontrol Et

```bash
docker compose ps
```

Beklenen çıktı:

```
NAME               STATUS          PORTS
kanban-postgres    healthy         127.0.0.1:5432->5432/tcp
kanban-backend     running         0.0.0.0:8080->8080/tcp
kanban-frontend    running         0.0.0.0:80->80/tcp
```

### Adım 4 -- Uygulamaya Eriş

| Servis | URL |
|---|---|
| **Frontend (React UI)** | http://localhost |
| **Backend API** | http://localhost:8080/api |
| **PostgreSQL** | `localhost:5432` / DB: `kanban_db` |

### Veritabanını Sıfırlama ve Temiz Başlangıç

Veritabanındaki verileri tamamen temizleyip başlangıç tohum verilerini (seed data) sıfırdan yüklemek için:

```bash
docker compose down -v && docker compose up --build
```

---

## Lokal Geliştirme Ortamı (Development Setup)

### Backend (Spring Boot)

**Ön koşullar:** Java 21, Maven 3.9+, çalışan PostgreSQL instance

```bash
# Sadece PostgreSQL servisini Docker ile başlat
docker compose up -d postgres

cd backend
mvn spring-boot:run
# Sunucu adresi: http://localhost:8080/api
```

### Frontend (React + Vite)

**Ön koşullar:** Node.js 20+, npm 10+

```bash
cd frontend
npm install
npm run dev
# Uygulama adresi: http://localhost:5173
```

Vite geliştirme sunucusu `/api/*` isteklerini otomatik olarak `http://localhost:8080` adresine yönlendirir (`vite.config.ts`).

---

## API Referansı

Korumalı tüm endpoint'ler `Authorization: Bearer <token>` başlığı gerektirir.

### 1. Kimlik Doğrulama (Authentication) & Departmanlar

| Metot | Endpoint | Açıklama | Yetki / Erişim |
|---|---|---|---|
| `GET` | `/api/organizations` | Kayıt için mevcut departmanları listele | Herkese Açık |
| `POST` | `/api/auth/register` | Yeni ekip üyesi hesabı oluştur | Herkese Açık |
| `POST` | `/api/auth/login` | Giriş yap ve JWT token al | Herkese Açık |

**Register istek gövdesi:**

```json
{
  "username": "ahmet_muhasebe",
  "email": "ahmet@example.com",
  "password": "user123",
  "organizationId": 1
}
```

---

### 2. Panolar (Boards)

| Metot | Endpoint | Açıklama | Yetki / Erişim |
|---|---|---|---|
| `GET` | `/api/boards` | Rol ve departmana göre panoları listele | Doğrulanmış Kullanıcı |
| `POST` | `/api/boards` | Yeni pano oluştur | Super Admin & Departman Admini |
| `GET` | `/api/boards/{id}` | Panoyu kolonlar ve görevlerle getir | Departman İçi / Admin |
| `PUT` | `/api/boards/{id}` | Pano adı/açıklamasını güncelle | Departman İçi / Admin |
| `DELETE` | `/api/boards/{id}` | Panoyu ve tüm içeriğini sil | `ROLE_ADMIN` (Super / Dept Admin) |

---

### 3. Kolonlar (Columns)

| Metot | Endpoint | Açıklama | Yetki / Erişim |
|---|---|---|---|
| `GET` | `/api/boards/{boardId}/columns` | Kolondaki görevleri listele | Doğrulanmış Kullanıcı |
| `POST` | `/api/boards/{boardId}/columns` | Panoya yeni kolon ekle | `ROLE_ADMIN` |
| `PUT` | `/api/boards/{boardId}/columns/{id}` | Kolon başlığını güncelle | `ROLE_ADMIN` |
| `DELETE` | `/api/boards/{boardId}/columns/{id}` | Kolonu ve altındaki görevleri sil | `ROLE_ADMIN` |
| `PATCH` | `/api/boards/{boardId}/columns/{id}/reorder` | Kolon yatay sırasını değiştir | Doğrulanmış Kullanıcı |

---

### 4. Görevler (Tasks)

| Metot | Endpoint | Açıklama | Yetki / Erişim |
|---|---|---|---|
| `GET` | `/api/boards/{boardId}/columns/{colId}/tasks` | Kolon görevlerini listele | Doğrulanmış Kullanıcı |
| `POST` | `/api/boards/{boardId}/columns/{colId}/tasks` | Kolona yeni görev ekle | Tüm Roller (`USER` / `ADMIN`) |
| `GET` | `/api/boards/{boardId}/columns/{colId}/tasks/{id}` | Görev detayını getir | Doğrulanmış Kullanıcı |
| `PUT` | `/api/boards/{boardId}/columns/{colId}/tasks/{id}` | Görevi güncelle | Tüm Roller (`USER` / `ADMIN`) |
| `DELETE` | `/api/boards/{boardId}/columns/{colId}/tasks/{id}` | Görevi sil | Tüm Roller (`USER` / `ADMIN`) |
| `PATCH` | `/api/tasks/{id}/move` | Görevi taşı / sırala (Drag & Drop) | Tüm Roller (`USER` / `ADMIN`) |

**Görev oluşturma istek gövdesi:**

```json
{
  "title": "KDV Beyannamesi Onayı",
  "description": "Ağustos ayı KDV-1 beyannamesinin sisteme yüklenmesi",
  "priority": "HIGH",
  "dueDate": "2026-09-15",
  "assignee": "ahmet_muhasebe"
}
```

---

### 5. Yorumlar ve Medya Ekleri (Comments & Attachments)

| Metot | Endpoint | Açıklama | Yetki / Erişim |
|---|---|---|---|
| `GET` | `/api/tasks/{taskId}/comments` | Göreve ait yorumları listele | Doğrulanmış Kullanıcı |
| `POST` | `/api/tasks/{taskId}/comments` | Göreve yeni yorum yaz | Doğrulanmış Kullanıcı |
| `GET` | `/api/tasks/{taskId}/attachments` | Göreve eklenmiş dosyaları listele | Doğrulanmış Kullanıcı |
| `POST` | `/api/tasks/{taskId}/attachments` | Göreve dosya/medya yükle (Multipart) | Doğrulanmış Kullanıcı |
| `GET` | `/api/tasks/{taskId}/attachments/{id}/download` | Ekli dosyayı indir / görüntüle | Doğrulanmış Kullanıcı |

---

### 6. Kullanıcılar (Users)

| Metot | Endpoint | Açıklama | Yetki / Erişim |
|---|---|---|---|
| `GET` | `/api/users` | Departmandaki veya şirketteki ekip üyelerini listele | Doğrulanmış Kullanıcı |

---

## Proje Yapısı

```
kanban-task-management/
+-- docker-compose.yml            <- PostgreSQL, Backend ve Frontend konteyner orkestrasyonu
+-- .env.example                  <- Ortam değişkeni şablonu
+-- .gitignore
+-- README.md
|
+-- backend/                      <- Spring Boot 3 REST API
|   +-- Dockerfile                <- Multi-stage derleme: Maven -> JRE Alpine (appuser)
|   +-- pom.xml
|   +-- src/main/java/com/kanban/
|       +-- KanbanApplication.java
|       +-- config/               <- CorsConfig, DataInitializer
|       +-- controller/           <- AuthController, OrganizationController,
|       |                            BoardController, TaskController, UserController, ...
|       +-- dto/                  <- auth/, organization/, board/, column/, task/, comment/, attachment/
|       +-- entity/               <- Organization, User, Board, BoardColumn, Task, Comment, Attachment
|       +-- exception/            <- GlobalExceptionHandler, ResourceNotFoundException
|       +-- repository/           <- OrganizationRepository, UserRepository, BoardRepository, ...
|       +-- security/             <- SecurityConfig, JwtUtils, AuthTokenFilter, SecurityUtils
|       +-- service/              <- AuthService, BoardService, TaskService, AttachmentService, ...
|
+-- frontend/                     <- React 18 + TypeScript + Tailwind CSS
    +-- Dockerfile                <- Multi-stage derleme: Node -> Nginx Alpine
    +-- nginx.conf                <- SPA fallback + /api reverse proxy
    +-- package.json
    +-- vite.config.ts
    +-- tailwind.config.js
    +-- src/
        +-- api/                  <- axiosClient, authApi, boardApi, taskApi, ...
        +-- components/           <- KanbanBoard (DnD), KanbanColumn, TaskCard, modals, Navbar
        +-- contexts/             <- AuthContext (JWT, rol, departman state)
        +-- pages/                <- LoginPage, RegisterPage, BoardsPage, BoardDetailPage
        +-- services/             <- organizationService, userService, commentService, attachmentService
        +-- types/                <- TypeScript veri modelleri ve DTO tanımları
```

---

## Mimari Kararlar ve Teknik Gerekçeler

### 1. Departman Bazlı Çok Kiracılık (Multi-Tenancy)
Veri güvenliği ve organizasyonel hiyerarşi gereği her pano bir `Organization` entity'sine bağlanmıştır. Bu sayede departmanlar arası veri sızıntısı önlenmiş, Super Admin seviyesinde ise şirket genelini izleme kabiliyeti korunmuştur.

### 2. Stateless JWT Mimarisi
Spring Security 6'nın `SecurityFilterChain` yapısıyla stateless oturum yönetimi uygulanmıştır. Token içinde kullanıcı kimliği ve rolü taşınır; sunucu tarafında oturum state'i tutulmadığından yatay ölçeklendirme kolaylaşır.

### 3. O(k) Task Pozisyon Algoritması
Sürükle-bırak sıralama işlemlerinde tüm tabloyu yeniden yazmak (full-table scan/update) yerine, yalnızca taşınan kartın aralığındaki kayıtlar `shiftPositionsLeft` ve `shiftPositionsRight` JPQL `@Modifying` sorguları ile güncellenir.

```
Aynı kolon içinde sıralama (srcCol == dstCol):
  dst > src : (srcPos, dstPos] aralığı sola kayar  (position - 1)
  dst < src : [dstPos, srcPos) aralığı sağa kayar  (position + 1)
  task.position = dstPos

Kolonlar arası taşıma (srcCol != dstCol):
  1. Kaynak kolondan çıkar  -> position > srcPos olanları sola kaydır
  2. Hedef kolonda yer aç   -> position >= dstPos olanları sağa kaydır
  3. task.column = targetColumn, task.position = dstPos
```

### 4. Container Güvenliği ve Non-Root Yetkileri
Backend Dockerfile içinde uygulama `USER appuser` yetkileriyle çalıştırılır. Dosya yüklemeleri için `/app/uploads` dizini otomatik oluşturularak dosya yazma izinleri container başlangıcında yapılandırılır.

---

## Ortam Değişkenleri

### Backend

| Değişken | Varsayılan Değer | Açıklama |
|---|---|---|
| `DB_HOST` | `postgres` | PostgreSQL host adı |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_NAME` | `kanban_db` | Veritabanı adı |
| `DB_USER` | `kanban_user` | Veritabanı kullanıcısı |
| `DB_PASS` | `kanban_pass` | Veritabanı şifresi |
| `JWT_SECRET` | *(base64 key)* | JWT imzalama anahtarı (min. 256-bit base64) |
| `JWT_EXPIRATION_MS` | `86400000` | Token geçerlilik süresi (ms) -- varsayılan 24 saat |
| `SERVER_PORT` | `8080` | Backend HTTP portu |
| `CORS_ORIGINS` | `http://localhost:5173,...` | İzin verilen CORS adresleri |

### PostgreSQL

| Değişken | Değer |
|---|---|
| `POSTGRES_DB` | `kanban_db` |
| `POSTGRES_USER` | `kanban_user` |
| `POSTGRES_PASSWORD` | `kanban_pass` |

---

## Güvenlik Notları

1. **JWT Güvenliği:** Üretim ortamında `JWT_SECRET` değeri mutlaka güçlü bir anahtarla değiştirilmeli ve ortam değişkeni olarak iletilmelidir.
2. **Parola Güvenliği:** Kullanıcı parolaları veritabanında asla düz metin olarak saklanmaz; BCrypt algoritması ile hashlenir.
3. **Veri İzolasyonu:** Kullanıcının yetkisi olmayan bir departman kaynağına erişim isteklerinde varlık ifşasını önlemek adına `404 Not Found` yanıtı döner.
4. **Veritabanı Ağ Koruması:** `docker-compose.yml` üzerinde PostgreSQL yalnızca `127.0.0.1:5432` ile yerel erişime kısıtlanmıştır.
5. **Non-root İmaj:** Backend imajı `appuser` kullanıcısı ile çalışarak yetki yükseltme risklerini engeller.

---

## Git Commit Sözleşmesi

Projede [Conventional Commits](https://www.conventionalcommits.org/) standardı uygulanmaktadır:

| Önek | Kullanım Amacı |
|---|---|
| `feat(backend):` | Yeni backend özelliği |
| `feat(frontend):` | Yeni frontend özelliği |
| `fix:` | Hata düzeltmesi |
| `chore:` | Yapılandırma, bağımlılık güncellemesi |
| `docs:` | Dokümantasyon güncellemesi |
| `refactor:` | Davranış değiştirmeyen kod iyileştirmesi |

---

## Geliştirici

| Alan | Bilgi |
|---|---|
| **Ad Soyad** | Ahmet Faruk Durmuş |
| **Proje** | Staj Projesi – Part 1: Kanban Task Management |
| **Yıl** | 2026 |
