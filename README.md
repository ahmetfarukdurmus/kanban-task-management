# Kanban Task Management

> **Staj Projesi – Part 1** | Full-stack, production-ready Kanban board uygulaması.
> Tüm stack'i tek komutla başlat: `docker compose up -d`

---

## İçindekiler

- [Proje Tanımı ve Genel Bakış](#proje-tanımı-ve-genel-bakış)
- [Özellikler](#özellikler)
- [Teknoloji Yığını](#teknoloji-yığını)
- [Mimari](#mimari)
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

Bu uygulama, ekiplerin veya bireylerin işlerini dijital Kanban panoları üzerinden organize etmelerini sağlar. Her kullanıcı kendi panolarını oluşturur; kolon ve kart verilerine yalnızca kendisi erişebilir (**multi-tenancy / data isolation**).

Sürükle-bırak (drag-and-drop) arayüzü sayesinde kartlar aynı kolon içinde sıralanabilir ya da kolonlar arasında taşınabilir; her pozisyon değişikliği veritabanında kalıcı olarak saklanır.

---

## Özellikler

| Alan | Detay |
|---|---|
| **Kimlik Doğrulama** | Kayıt & giriş; JWT Bearer token ile stateless oturum |
| **Çok Kiracılık (Multi-tenancy)** | Her kullanıcı yalnızca kendi panolarına erişebilir |
| **Pano Yönetimi** | Pano oluşturma, listeleme, güncelleme, silme |
| **Kolon Yönetimi** | Dinamik kolon CRUD + sürükle-bırak ile sıralama |
| **Kart Yönetimi** | Başlık, açıklama, öncelik, bitiş tarihi, sorumlu kişi |
| **Kanban Drag & Drop** | Kolon içi sıralama & kolonlar arası taşıma (optimistic update) |
| **Pozisyon Algoritması** | O(k) veritabanı güncellemesi; tam tablo yazımı yok |
| **Hata Yönetimi** | RFC 7807 `ProblemDetail` standart hata formatı |

---

## Teknoloji Yığını

### Backend

| Teknoloji | Versiyon | Seçim Gerekçesi |
|---|---|---|
| Java | 21 (LTS) | Virtual Thread desteği, modern dil özellikleri (records, pattern matching), uzun vadeli destek |
| Spring Boot | 3.3.x | Auto-configuration, embedded Tomcat, güçlü ekosistem; kurumsal Java standardı |
| Spring Security | 6.x | Stateless JWT için `SecurityFilterChain` DSL, `@EnableMethodSecurity` ile metot düzeyinde yetkilendirme |
| Spring Data JPA | -- | Repository pattern ile boilerplate-free veri erişimi; JPQL `@Modifying` sorguları |
| PostgreSQL | 16 | ACID uyumlu, güçlü JSON/JSONB desteği, üretim kanıtlanmış ilişkisel veritabanı |
| jjwt | 0.12.x | Modern fluent API, deprecated metodsuz güvenli JWT üretimi |
| Lombok | 1.18.x | Boilerplate kodunu (getter/setter/builder) derleme zamanında üretir |
| MapStruct | 1.5.x | Annotation-processor tabanlı tip güvenli DTO mapper (sıfır runtime overhead) |

### Frontend

| Teknoloji | Versiyon | Seçim Gerekçesi |
|---|---|---|
| React | 18.x | Bileşen tabanlı UI, büyük ekosistem, Concurrent Mode |
| TypeScript | 5.x | Derleme zamanı tip güvenliği; API sözleşmesi ihlalleri production'a gitmeden yakalanır |
| Vite | 5.x | ESM-native dev server, sub-saniye HMR; Create React App'in yerini aldı |
| Tailwind CSS | 3.x | Utility-first; tasarım tutarlılığı, sıfır ölü CSS (PurgeCSS built-in), hızlı prototipleme |
| @hello-pangea/dnd | 16.x | react-beautiful-dnd'nin aktif fork'u; erişilebilir, fizik tabanlı sürükle-bırak |
| TanStack React Query | 5.x | Sunucu state yönetimi; otomatik caching, arka plan yenileme, loading/error state |
| Axios | 1.x | İstek/yanıt interceptor ile JWT ekleme ve global 401 yönlendirmesi |
| react-hot-toast | 2.x | Bildirim toastları; kolay API, özelleştirilebilir stil |
| date-fns | 3.x | Hafif, tree-shakeable tarih kütüphanesi |

### Altyapı

| Teknoloji | Seçim Gerekçesi |
|---|---|
| Docker + Compose V2 | Tek komutla yeniden üretilebilir ortam; geliştirici → production tutarlılığı |
| Multi-stage Dockerfile | Build araçları final imajda bulunmaz; backend ~180 MB, frontend ~25 MB |
| Nginx (Alpine) | Yüksek performanslı statik dosya sunumu + `/api` reverse proxy |
| PostgreSQL 16 Alpine | Hafif, production kalitesinde resmi imaj |

---

## Mimari

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

### Backend Katmanlı Mimari

```
Controller  ->  Service  ->  Repository  ->  Entity / DB
     |              |
     DTO            SecurityUtils / JwtUtils
```

- **Controller**: HTTP mapping, `@Valid`, `ResponseEntity`
- **Service**: İş mantığı, `@Transactional`, multi-tenancy guard
- **Repository**: Spring Data JPA, custom JPQL `@Modifying` queries
- **Entity**: JPA entity'leri; pozisyon algoritması Repository katmanında uygulanır

---

## Docker ile Kurulum ve Çalıştırma

### Ön Koşullar

- [Docker Engine](https://docs.docker.com/get-docker/) >= 24.0
- Docker Compose V2 (`docker compose` komutu -- eski `docker-compose` **değil**)

### Adım 1 -- Repoyu Klonla

```bash
git clone https://github.com/<kullanici-adi>/kanban-task-management.git
cd kanban-task-management
```

### Adım 2 -- (Opsiyonel) JWT Secret'i Değiştir

Üretim ortamı için `docker-compose.yml` içindeki `JWT_SECRET` değerini güvenli bir anahtarla değiştir:

```bash
# Güvenli 64-byte base64 anahtar üret
openssl rand -base64 64
```

Üretilen değeri `docker-compose.yml` → `backend` → `environment.JWT_SECRET` alanı ile değiştir.

### Adım 3 -- Tüm Servisleri Başlat

```bash
docker compose up -d
```

İlk çalıştırmada Docker imajları derlenir (yaklaşık 3-5 dakika). Sonraki başlatmalar önbellekten dolayı çok daha hızlıdır.

### Adım 4 -- Servislerin Durumunu Kontrol Et

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

> **Not:** `kanban-backend` servisi, PostgreSQL `healthy` durumuna geçmeden başlamaz (`depends_on: condition: service_healthy`). Bu yapılandırma, startup race condition'larını önler.

### Adım 5 -- Uygulamayı Aç

| Servis | URL |
|---|---|
| **Frontend (React UI)** | http://localhost |
| **Backend API** | http://localhost:8080/api |
| **PostgreSQL** | `localhost:5432` / DB: `kanban_db` |

### Servisleri Durdurmak İçin

```bash
docker compose down           # container'ları sil (volume korunur)
docker compose down -v        # container + postgres volume'unu sil
```

---

## Lokal Geliştirme Ortamı (Development Setup)

### Backend (Spring Boot)

**Ön koşullar:** Java 21, Maven 3.9+, çalışır durumda bir PostgreSQL instance

```bash
# Yalnızca PostgreSQL'i Docker Compose ile başlat
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

Vite dev server, `/api/*` isteklerini otomatik olarak `http://localhost:8080` adresine proxy'ler (`vite.config.ts` → `server.proxy`). Backend servisi aynı anda çalışır olmalıdır.

---

## API Referansı

Tüm korumalı endpoint'ler `Authorization: Bearer <token>` header'ı gerektirir.

### Kimlik Doğrulama (Authentication)

| Metot | Endpoint | Açıklama | Kimlik Doğrulama |
|---|---|---|---|
| `POST` | `/api/auth/register` | Yeni hesap oluştur | Gerekmiyor |
| `POST` | `/api/auth/login` | JWT token al | Gerekmiyor |

**Register istek gövdesi:**

```json
{
  "username": "ahmet",
  "email": "ahmet@example.com",
  "password": "guvenli123"
}
```

**Login / Register yanıtı:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "id": 1,
  "username": "ahmet",
  "email": "ahmet@example.com"
}
```

---

### Panolar (Boards)

| Metot | Endpoint | Açıklama | Kimlik Doğrulama |
|---|---|---|---|
| `GET` | `/api/boards` | Kullanıcının tüm panolarını listele | Gerekli |
| `POST` | `/api/boards` | Yeni pano oluştur | Gerekli |
| `GET` | `/api/boards/{id}` | Panoyu kolonlar ve kartlarla getir | Gerekli |
| `PUT` | `/api/boards/{id}` | Panoyu güncelle | Gerekli |
| `DELETE` | `/api/boards/{id}` | Panoyu ve tüm içeriğini sil | Gerekli |

> **Multi-tenancy Garantisi:** Her endpoint, kimlik doğrulanmış kullanıcının yalnızca kendi panolarına erişebildiğini Repository katmanında zorunlu kılar. Başka bir kullanıcının panosuna erişim girişimi `404 Not Found` döner (403 yerine; kaynak ID'sinin varlığını gizlemek için).

---

### Kolonlar (Columns)

| Metot | Endpoint | Açıklama | Kimlik Doğrulama |
|---|---|---|---|
| `GET` | `/api/boards/{boardId}/columns` | Kolonları kartlarla listele | Gerekli |
| `POST` | `/api/boards/{boardId}/columns` | Yeni kolon ekle | Gerekli |
| `GET` | `/api/boards/{boardId}/columns/{id}` | Tek kolon getir | Gerekli |
| `PUT` | `/api/boards/{boardId}/columns/{id}` | Kolon başlığını güncelle | Gerekli |
| `DELETE` | `/api/boards/{boardId}/columns/{id}` | Kolonu ve kartlarını sil | Gerekli |
| `PATCH` | `/api/boards/{boardId}/columns/{id}/reorder` | Kolon sırasını değiştir | Gerekli |

**Reorder istek gövdesi:**

```json
{ "newPosition": 2 }
```

---

### Kartlar (Tasks)

| Metot | Endpoint | Açıklama | Kimlik Doğrulama |
|---|---|---|---|
| `GET` | `/api/boards/{boardId}/columns/{colId}/tasks` | Kartları listele | Gerekli |
| `POST` | `/api/boards/{boardId}/columns/{colId}/tasks` | Yeni kart ekle | Gerekli |
| `GET` | `/api/boards/{boardId}/columns/{colId}/tasks/{id}` | Tek kart getir | Gerekli |
| `PUT` | `/api/boards/{boardId}/columns/{colId}/tasks/{id}` | Kart bilgilerini güncelle | Gerekli |
| `DELETE` | `/api/boards/{boardId}/columns/{colId}/tasks/{id}` | Kartı sil | Gerekli |
| `PATCH` | `/api/tasks/{id}/move` | Kartı taşı / sırala (Drag & Drop) | Gerekli |

**Task oluşturma / güncelleme istek gövdesi:**

```json
{
  "title": "API entegrasyonu yaz",
  "description": "Axios client ve interceptor'lari kur",
  "priority": "HIGH",
  "dueDate": "2026-09-15",
  "assignee": "Ahmet"
}
```

**Move istek gövdesi** (hem aynı kolon sıralama hem kolonlar arası taşıma için):

```json
{
  "targetColumnId": 3,
  "targetPosition": 1
}
```

> **Pozisyon Algoritması:** Aynı kolonsa yalnızca etkilenen aralık güncellenir (`shiftPositionsLeft` / `shiftPositionsRight` ile O(k) JPQL `@Modifying` sorgusu). Farklı kolonsa kaynak kolonda boşluk kapatılır, hedef kolonda yer açılır. Tam tablo yeniden yazımı (full-table UPDATE) yapılmaz.

---

### Hata Formatı

Tüm hatalar RFC 7807 `ProblemDetail` formatında döner:

```json
{
  "title": "Validation Failed",
  "detail": "title: Task title must not be blank",
  "status": 400
}
```

---

## Proje Yapısı

```
kanban-task-management/
+-- docker-compose.yml            <- Tüm stack tek komutla
+-- .env.example                  <- Ortam değişkeni şablonu
+-- .gitignore
+-- README.md
|
+-- backend/                      <- Spring Boot 3 REST API
|   +-- Dockerfile                <- Multi-stage: Maven -> JRE Alpine
|   +-- pom.xml
|   +-- src/main/java/com/kanban/
|       +-- KanbanApplication.java
|       +-- config/               <- CorsConfig
|       +-- controller/           <- AuthController, BoardController,
|       |                            BoardColumnController, TaskController
|       +-- dto/                  <- auth/, board/, column/, task/
|       +-- entity/               <- User, Board, BoardColumn, Task
|       +-- exception/            <- GlobalExceptionHandler, ResourceNotFoundException
|       +-- repository/           <- JPQL @Modifying pozisyon sorguları
|       +-- security/             <- SecurityConfig, JWT filter/utils
|       +-- service/              <- AuthService, BoardService,
|                                    BoardColumnService, TaskService
|
+-- frontend/                     <- React 18 + TypeScript + Tailwind CSS
    +-- Dockerfile                <- Multi-stage: Node -> Nginx Alpine
    +-- nginx.conf                <- SPA fallback + /api proxy
    +-- package.json
    +-- vite.config.ts
    +-- tailwind.config.js
    +-- src/
        +-- api/                  <- axiosClient, authApi, boardApi,
        |                            columnApi, taskApi
        +-- components/           <- KanbanBoard (DnD), KanbanColumn,
        |                            TaskCard, modals, Navbar
        +-- contexts/             <- AuthContext (JWT localStorage)
        +-- pages/                <- Login, Register, Boards, BoardDetail
        +-- types/                <- TypeScript interface'leri
```

---

## Mimari Kararlar ve Teknik Gerekçeler

### Stateless JWT -- Session Tabanlı Kimlik Doğrulamaya Kıyasla

| Kriter | Session Tabanlı | JWT (Bu Proje) |
|---|---|---|
| Ölçeklendirme | Yapışkan session veya Redis gerektirir | Herhangi bir pod cevap verebilir |
| Docker uyumu | Container yeniden başlatmada session kaybolur | Token client'ta saklanır |
| Mikro-servis | Session paylaşımı karmaşıktır | Her servis token'ı doğrulayabilir |
| Basitlik | HttpSession yönetimi | Yalnızca bir signing key gerekli |

Spring Security 6'nin `SecurityFilterChain` DSL'i kullanılarak `OncePerRequestFilter` tabanlı bir JWT filtresi uygulanmıştır. Her istek: token çıkarma → imza doğrulama → `SecurityContextHolder`'a `UsernamePasswordAuthenticationToken` ekleme adımlarından geçer. Herhangi bir adımda hata olursa `401 Unauthorized` döner.

### PostgreSQL Seçimi

- **ACID uyumlu:** Kart pozisyon güncellemeleri atomik transaction içinde gerçekleşir; kısmi güncelleme riski yoktur.
- **Spring Data JPA entegrasyonu:** `@Modifying` + `@Query` ile toplu aralık UPDATE sorguları doğrudan çalıştırılabilir.
- **Pozisyon algoritması için uygundur:** `WHERE position BETWEEN :from AND :to` sorguları PostgreSQL'in index'leri ile verimli çalışır.
- MySQL/MariaDB yerine PostgreSQL: `text[]`, window functions ve daha güçlü JPQL desteği.

### Multi-stage Docker Build -- Tek Aşamalı Build'e Kıyasla

```
Backend  -- tek aşamalı: ~600 MB  |  multi-stage: ~180 MB (yalnızca JRE-Alpine)
Frontend -- tek aşamalı: ~400 MB  |  multi-stage:  ~25 MB (Nginx Alpine + dist/)
```

Multi-stage build avantajları:

1. **Güvenlik:** Maven, JDK, Node.js ve kaynak kodlar üretim imajında bulunmaz.
2. **Boyut:** Docker layer cache sayesinde yalnızca değişen katmanlar yeniden derlenir.
3. **CI/CD hızı:** Küçük imajlar daha hızlı push/pull ve deploy süresi sağlar.

### `depends_on: condition: service_healthy` Kullanımı

Standart `depends_on` yalnızca container'ın **başladığını** bekler, **hazır olduğunu** değil. PostgreSQL init script'ini çalıştırırken backend bağlanmaya çalışırsa `Connection refused` hatası alır ve uygulama çöker. `service_healthy` + `pg_isready` healthcheck kombinasyonu bu startup race condition'ını ortadan kaldırıp veritabanı tamamen hazır olmadan backend'in başlamamasını garanti eder.

### Task Pozisyon Algoritmasının Tasarımı

`float` veya LexoRank (`lexicographic`) alternatiflerine kıyasla sıfır tabanlı `Integer` pozisyon seçilmiştir:

- **Anlaşılabilir:** Geliştirici hata ayıklamada pozisyon değerlerini kolayca okur.
- **Yeterli:** Kart sayısı teorik olarak `Integer.MAX_VALUE` değeri olan 2.147.483.647'ye kadar çıkabilir.
- **Verimli:** Her taşıma işlemi yalnızca etkilenen aralık güncellenir.

Algoritma detayı:

```
Aynı kolon içinde sıralama (srcCol == dstCol):
  dst > src : (srcPos, dstPos] aralığı sola kayar  (position - 1)
  dst < src : [dstPos, srcPos) aralığı sağa kayar  (position + 1)
  task.position = dstPos

Kolonlar arası taşıma (srcCol != dstCol):
  1. Kaynak kolondan çıkar  -> position > srcPos olanları sola kaydır
  2. Hedef kolonda yer aç   -> position >= dstPos olanları sağa kaydır
  3. task.column = targetColumn, task.position = dstPos (clamped)
```

Her iki durum da `TaskRepository`'deki `@Modifying` JPQL sorguları ile tek bir `@Transactional` sınırı içinde atomik olarak gerçekleştirilir.

---

## Ortam Değişkenleri

### Backend

| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `DB_HOST` | `postgres` | PostgreSQL host adı |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_NAME` | `kanban_db` | Veritabanı adı |
| `DB_USER` | `kanban_user` | Veritabanı kullanıcısı |
| `DB_PASS` | `kanban_pass` | Veritabanı şifresi |
| `JWT_SECRET` | *(şablon değer)* | **Üretimde mutlaka değiştir** -- min. 256-bit base64 |
| `JWT_EXPIRATION_MS` | `86400000` | Token geçerlilik süresi (ms) -- varsayılan 24 saat |
| `SERVER_PORT` | `8080` | Backend HTTP portu |
| `CORS_ORIGINS` | `http://localhost:5173,...` | İzin verilen CORS origin'leri |

### PostgreSQL

| Değişken | Değer |
|---|---|
| `POSTGRES_DB` | `kanban_db` |
| `POSTGRES_USER` | `kanban_user` |
| `POSTGRES_PASSWORD` | `kanban_pass` |

---

## Güvenlik Notları

1. **JWT Secret:** `docker-compose.yml` içindeki örnek secret **yalnızca geliştirme ortamı içindir**. Üretimde `openssl rand -base64 64` komutuyla yeni bir anahtar oluştur ve environment variable olarak enjekte et.

2. **Şifre Saklama:** Kullanıcı şifreleri asla düz metin olarak saklanmaz; BCrypt hash (strength=10) kullanılır.

3. **Multi-tenancy İzolasyonu:** Her Board/Column/Task sorgusunda `owner_id` filtresi uygulanır. Başka bir kullanıcının kaynağına erişim `403 Forbidden` yerine **`404 Not Found`** döner; bu şekilde kaynak ID'sinin varlığı dış dünyaya gizlenmiş olur.

4. **PostgreSQL Port Kısıtlaması:** `docker-compose.yml` içinde Postgres yalnızca `127.0.0.1:5432` üzerinden erişilebilir; dış ağdan ulaşım engellenmiştir.

5. **Non-root Container:** Backend container, `appuser` adıyla özel bir sistem kullanıcısı olarak çalışır (root yetkisi yoktur).

---

## Git Commit Sözleşmesi

Proje boyunca [Conventional Commits](https://www.conventionalcommits.org/) standardı uygulanmıştır:

| Prefix | Kullanım |
|---|---|
| `feat(backend):` | Yeni backend özelliği |
| `feat(frontend):` | Yeni frontend özelliği |
| `fix:` | Hata düzeltmesi |
| `chore:` | Yapılandırma, bağımlılık güncellemesi |
| `docs:` | Dokümantasyon değişikliği |
| `refactor:` | Davranış değiştirmeyen kod iyileştirmesi |

---

## Geliştirici

| Alan | Bilgi |
|---|---|
| **Ad Soyad** | Ahmet Faruk Durmuş |
| **Proje** | Staj Projesi – Part 1: Kanban Task Management |
| **Yıl** | 2026 |
