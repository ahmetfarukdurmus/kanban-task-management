# 🗂 Kanban Task Management

> **Staj Projesi – Part 1** | Full-stack, production-ready Kanban board uygulaması.  
> Tüm stack'i tek komutla başlat: `docker compose up -d`

---

## 📌 İçindekiler

- [Proje Hakkında](#-proje-hakkında)
- [Özellikler](#-özellikler)
- [Teknoloji Yığını](#-teknoloji-yığını)
- [Mimari](#-mimari)
- [Hızlı Başlangıç – Docker](#-hızlı-başlangıç--docker)
- [Yerel Geliştirme](#-yerel-geliştirme)
- [API Referansı](#-api-referansı)
- [Proje Yapısı](#-proje-yapısı)
- [Mimari Kararlar](#-mimari-kararlar)
- [Ortam Değişkenleri](#-ortam-değişkenleri)
- [Güvenlik Notları](#-güvenlik-notları)
- [Git Commit Sözleşmesi](#-git-commit-sözleşmesi)

---

## 📖 Proje Hakkında

Bu uygulama, ekiplerin veya bireylerin işlerini dijital Kanban panoları üzerinden organize etmelerini sağlar. Her kullanıcı kendi panolarını oluşturur; kolon ve kart verilerine yalnızca kendisi erişebilir (**multi-tenancy / data isolation**).

Sürükle-bırak (drag-and-drop) arayüzü sayesinde kartlar aynı kolon içinde sıralanabilir ya da kolonlar arasında taşınabilir; her pozisyon değişikliği veritabanında kalıcı olarak saklanır.

---

## ✨ Özellikler

| Alan | Detay |
|---|---|
| **Kimlik Doğrulama** | Kayıt & giriş; JWT Bearer token ile stateless oturum |
| **Çok Kiracılık** | Her kullanıcı yalnızca kendi panolarına erişebilir |
| **Pano Yönetimi** | Pano oluşturma, listeleme, güncelleme, silme |
| **Kolon Yönetimi** | Dinamik kolon CRUD + sürükle-bırak ile sıralama |
| **Kart Yönetimi** | Başlık, açıklama, öncelik, bitiş tarihi, sorumlu kişi |
| **Kanban DnD** | Kolon içi sıralama & kolonlar arası taşıma (optimistic update) |
| **Pozisyon Algoritması** | O(k) veritabanı güncellemesi; tam tablo yazımı yok |
| **Hata Yönetimi** | RFC 7807 `ProblemDetail` standart hata formatı |

---

## 🛠 Teknoloji Yığını

### Backend

| Teknoloji | Versiyon | Seçim Gerekçesi |
|---|---|---|
| Java | 21 (LTS) | Virtual Thread desteği, modern dil özellikleri (records, pattern matching), uzun vadeli destek |
| Spring Boot | 3.3.x | Auto-configuration, embedded Tomcat, güçlü ekosistem; kurumsal Java standardı |
| Spring Security 6 | 6.x | Stateless JWT için `SecurityFilterChain` DSL, `@EnableMethodSecurity` ile metot düzeyinde yetkilendirme |
| Spring Data JPA | – | Repository pattern ile boilerplate-free veri erişimi; JPQL `@Modifying` sorguları |
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
| PostgreSQL 16 Alpine | Hafif, production-kalitesinde resmi imaj |

---

## 🏗 Mimari

```
┌─────────────────────────────────────────────────────────────────┐
│                         Docker Network (kanban-network)          │
│                                                                  │
│  ┌──────────────┐    /api/*    ┌──────────────┐    JDBC         │
│  │   Frontend   │ ──────────▶ │   Backend    │ ──────────────▶ │
│  │ nginx:alpine │  proxy_pass │ Spring Boot 3│                  │
│  │   port: 80   │             │  port: 8080  │  ┌────────────┐ │
│  │              │  static     │              │  │ PostgreSQL │ │
│  │  React SPA   │  files      │ REST API     │  │     16     │ │
│  │  (Vite dist) │             │ + JPA + JWT  │  │ port: 5432 │ │
│  └──────────────┘             └──────────────┘  └────────────┘ │
│        ▲                                                         │
│        │ HTTP :80                                                │
└────────┼────────────────────────────────────────────────────────┘
         │
    Browser / Client
```

### Katmanlı Mimari (Backend)

```
Controller  →  Service  →  Repository  →  Entity / DB
     │             │
     DTO           SecurityUtils / JwtUtils
```

- **Controller**: HTTP mapping, @Valid, ResponseEntity
- **Service**: İş mantığı, @Transactional, multi-tenancy guard
- **Repository**: Spring Data JPA, custom JPQL @Modifying queries
- **Entity**: JPA entity'leri, position algoritması Repository'de

---

## 🚀 Hızlı Başlangıç – Docker

### Ön Koşullar

- [Docker Engine](https://docs.docker.com/get-docker/) ≥ 24.0
- Docker Compose V2 (`docker compose` — eski `docker-compose` **değil**)

### Adım 1 – Repoyu Klonla

```bash
git clone https://github.com/<kullanici-adi>/kanban-task-management.git
cd kanban-task-management
```

### Adım 2 – (Opsiyonel) JWT Secret'ı Değiştir

Üretim ortamı için `docker-compose.yml` içindeki `JWT_SECRET` değerini güvenli bir anahtarla değiştir:

```bash
# Güvenli 64-byte base64 anahtar üret
openssl rand -base64 64
```

Üretilen değeri `docker-compose.yml` → `backend` → `environment.JWT_SECRET` ile değiştir.

### Adım 3 – Tüm Servisleri Başlat

```bash
docker compose up -d
```

İlk çalıştırmada Docker imajları derlenir (~3-5 dakika). Sonraki başlatmalar önbellekten dolayı çok daha hızlıdır.

### Adım 4 – Servislerin Durumunu Kontrol Et

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

> ⚠ **Not:** `kanban-backend`, PostgreSQL `healthy` durumuna geçmeden başlamaz (`depends_on: condition: service_healthy`). Bu, startup race condition'larını önler.

### Adım 5 – Uygulamayı Aç

| Servis | URL |
|---|---|
| **Frontend (React UI)** | http://localhost |
| **Backend API** | http://localhost:8080/api |
| **PostgreSQL** | `localhost:5432` / DB: `kanban_db` |

### Durdurmak İçin

```bash
docker compose down           # container'ları sil (volume korunur)
docker compose down -v        # container + postgres volume'unu sil
```

---

## 🔧 Yerel Geliştirme

### Backend (Spring Boot)

**Ön koşullar:** Java 21, Maven 3.9+, çalışan bir PostgreSQL instance

```bash
# PostgreSQL sadece için Docker Compose ile başlat
docker compose up -d postgres

cd backend
mvn spring-boot:run
# → http://localhost:8080/api
```

### Frontend (React + Vite)

**Ön koşullar:** Node.js 20+, npm 10+

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

Vite dev server, `/api/*` isteklerini otomatik olarak `http://localhost:8080` adresine proxy'ler (`vite.config.ts` → `server.proxy`). Backend ayrıca çalışıyor olmalıdır.

---

## 📡 API Referansı

Tüm korumalı endpoint'ler `Authorization: Bearer <token>` header'ı gerektirir.

### 🔐 Kimlik Doğrulama

| Metot | Endpoint | Açıklama | Kimlik Doğrulama |
|---|---|---|---|
| `POST` | `/api/auth/register` | Yeni hesap oluştur | ❌ |
| `POST` | `/api/auth/login` | JWT token al | ❌ |

**Register isteği:**
```json
{
  "username": "ahmet",
  "email": "ahmet@example.com",
  "password": "güvenli123"
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

### 📋 Panolar (Boards)

| Metot | Endpoint | Açıklama | Kimlik Doğrulama |
|---|---|---|---|
| `GET` | `/api/boards` | Kullanıcının tüm panolarını listele | ✅ |
| `POST` | `/api/boards` | Yeni pano oluştur | ✅ |
| `GET` | `/api/boards/{id}` | Panoyu kolonlar ve kartlarla getir | ✅ |
| `PUT` | `/api/boards/{id}` | Panoyu güncelle | ✅ |
| `DELETE` | `/api/boards/{id}` | Panoyu ve tüm içeriğini sil | ✅ |

> **Multi-tenancy:** Her endpoint, kimlik doğrulanmış kullanıcının yalnızca kendi panolarına erişebildiğini garanti eder. Başka bir kullanıcının panosuna erişim girişimi **404** döner.

---

### 📊 Kolonlar (Columns)

| Metot | Endpoint | Açıklama | Kimlik Doğrulama |
|---|---|---|---|
| `GET` | `/api/boards/{boardId}/columns` | Kolonları kartlarla listele | ✅ |
| `POST` | `/api/boards/{boardId}/columns` | Yeni kolon ekle | ✅ |
| `GET` | `/api/boards/{boardId}/columns/{id}` | Tek kolon getir | ✅ |
| `PUT` | `/api/boards/{boardId}/columns/{id}` | Kolon başlığını güncelle | ✅ |
| `DELETE` | `/api/boards/{boardId}/columns/{id}` | Kolonu ve kartlarını sil | ✅ |
| `PATCH` | `/api/boards/{boardId}/columns/{id}/reorder` | Kolon sırasını değiştir | ✅ |

**Reorder isteği:**
```json
{ "newPosition": 2 }
```

---

### 🃏 Kartlar (Tasks)

| Metot | Endpoint | Açıklama | Kimlik Doğrulama |
|---|---|---|---|
| `GET` | `/api/boards/{boardId}/columns/{colId}/tasks` | Kartları listele | ✅ |
| `POST` | `/api/boards/{boardId}/columns/{colId}/tasks` | Yeni kart ekle | ✅ |
| `GET` | `/api/boards/{boardId}/columns/{colId}/tasks/{id}` | Tek kart getir | ✅ |
| `PUT` | `/api/boards/{boardId}/columns/{colId}/tasks/{id}` | Kart bilgilerini güncelle | ✅ |
| `DELETE` | `/api/boards/{boardId}/columns/{colId}/tasks/{id}` | Kartı sil | ✅ |
| `PATCH` | `/api/tasks/{id}/move` | Kartı taşı / sırala (DnD) | ✅ |

**Task oluşturma / güncelleme isteği:**
```json
{
  "title": "API entegrasyonu yaz",
  "description": "Axios client ve interceptor'ları kur",
  "priority": "HIGH",
  "dueDate": "2026-09-15",
  "assignee": "Ahmet"
}
```

**Move isteği (hem aynı kolon sıralama hem kolonlar arası taşıma):**
```json
{
  "targetColumnId": 3,
  "targetPosition": 1
}
```

> **Pozisyon Algoritması:** Aynı kolonsa sadece etkilenen aralık güncellenir (O(k)). Farklı kolonsa kaynak kolonda boşluk kapatılır, hedef kolonda yer açılır — tam tablo yeniden yazımı yapılmaz.

---

### ⚠ Hata Formatı

Tüm hatalar RFC 7807 `ProblemDetail` formatında döner:

```json
{
  "title": "Validation Failed",
  "detail": "title: Task title must not be blank",
  "status": 400
}
```

---

## 🗃 Proje Yapısı

```
kanban-task-management/
├── docker-compose.yml            ← Tüm stack tek komutla
├── .env.example                  ← Ortam değişkeni şablonu
├── .gitignore
├── README.md
│
├── backend/                      ← Spring Boot 3 REST API
│   ├── Dockerfile                ← Multi-stage: Maven → JRE Alpine
│   ├── pom.xml
│   └── src/main/java/com/kanban/
│       ├── KanbanApplication.java
│       ├── config/               ← CorsConfig
│       ├── controller/           ← AuthController, BoardController,
│       │                            BoardColumnController, TaskController
│       ├── dto/                  ← auth/, board/, column/, task/
│       ├── entity/               ← User, Board, BoardColumn, Task
│       ├── exception/            ← GlobalExceptionHandler, ResourceNotFoundException
│       ├── repository/           ← JPQL @Modifying position queries
│       ├── security/             ← SecurityConfig, JWT filter/utils
│       └── service/              ← AuthService, BoardService,
│                                    BoardColumnService, TaskService
│
└── frontend/                     ← React 18 + TypeScript + Tailwind
    ├── Dockerfile                ← Multi-stage: Node → Nginx Alpine
    ├── nginx.conf                ← SPA fallback + /api proxy
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.js
    └── src/
        ├── api/                  ← axiosClient, authApi, boardApi,
        │                            columnApi, taskApi
        ├── components/           ← KanbanBoard (DnD), KanbanColumn,
        │                            TaskCard, modals, Navbar
        ├── contexts/             ← AuthContext (JWT localStorage)
        ├── pages/                ← Login, Register, Boards, BoardDetail
        └── types/                ← TypeScript interface'leri
```

---

## 🧠 Mimari Kararlar

### Neden Stateless JWT (Session yerine)?

| Kriter | Session | JWT (Bu Proje) |
|---|---|---|
| Ölçeklendirme | Yapışkan session veya Redis gerektirir | Herhangi bir pod cevap verebilir |
| Docker uyumu | Container yeniden başlatmada session kaybolur | Token client'ta saklanır |
| Mikro-servis | Session paylaşımı karmaşıktır | Her servis token'ı doğrulayabilir |
| Basitlik | HttpSession yönetimi | Yalnızca bir signing key gerekli |

### Neden PostgreSQL?

- **ACID uyumlu** → Kart pozisyon güncellemeleri atomik transaction içinde gerçekleşir
- **Spring Data JPA** ile mükemmel entegrasyon
- **Kolon pozisyon algoritması** için toplu UPDATE sorguları verimli çalışır
- MySQL/MariaDB yerine PostgreSQL: `text[]`, window functions, daha güçlü JPQL desteği

### Neden Multi-stage Docker Build?

```
Backend final image:  ~180 MB  (JRE-only, no Maven, no JDK)
Frontend final image:  ~25 MB  (Nginx + dist/, no Node.js)
```

Tekil-stage build olsaydı backend ~600 MB, frontend ~400 MB olurdu. Multi-stage build:
1. **Güvenlik**: Build araçları production imajında bulunmaz
2. **Boyut**: Docker layer cache sayesinde sadece değişen katmanlar yeniden derlenir
3. **Hız**: CI/CD pipeline süreleri kısalır

### Neden `depends_on: condition: service_healthy`?

`depends_on` standart haliyle yalnızca container'ın **başladığını** bekler, **hazır olduğunu** değil. PostgreSQL init script'ini çalıştırırken backend bağlanmaya çalışırsa `Connection refused` hatası alır. `service_healthy` + `pg_isready` healthcheck bu race condition'ı ortadan kaldırır.

### Pozisyon Algoritması Neden Integer?

`float`/`lexicographic` (LexoRank) alternatiflerine kıyasla:
- **Anlaşılabilir**: Geliştirici debugging'de kolay okunur
- **Yeterli**: Kart sayısı teorik olarak Integer.MAX_VALUE'ye kadar çıkabilir
- **Verimli**: Sadece taşınan aralıktaki satırlar güncellenir (`shiftPositionsLeft`/`Right`)

---

## 🌍 Ortam Değişkenleri

### Backend

| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `DB_HOST` | `postgres` | PostgreSQL host adı |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_NAME` | `kanban_db` | Veritabanı adı |
| `DB_USER` | `kanban_user` | Veritabanı kullanıcısı |
| `DB_PASS` | `kanban_pass` | Veritabanı şifresi |
| `JWT_SECRET` | *(şablon değer)* | **Üretimde mutlaka değiştir** – min 256-bit base64 |
| `JWT_EXPIRATION_MS` | `86400000` | Token geçerlilik süresi (ms) – varsayılan 24 saat |
| `SERVER_PORT` | `8080` | Backend HTTP portu |
| `CORS_ORIGINS` | `http://localhost:5173,...` | İzin verilen CORS origin'leri |

### PostgreSQL

| Değişken | Değer |
|---|---|
| `POSTGRES_DB` | `kanban_db` |
| `POSTGRES_USER` | `kanban_user` |
| `POSTGRES_PASSWORD` | `kanban_pass` |

---

## 🔒 Güvenlik Notları

1. **JWT Secret**: `docker-compose.yml` içindeki örnek secret **yalnızca geliştirme içindir**. Üretimde `openssl rand -base64 64` ile yeni bir anahtar oluştur ve environment variable olarak enjekte et.

2. **Şifre Saklama**: Kullanıcı şifreleri asla düz metin olarak saklanmaz — BCrypt hash (strength=10) kullanılır.

3. **Multi-tenancy**: Her Board/Column/Task sorgusunda `owner_id` filtresi uygulanır. Başka bir kullanıcının kaynağına erişim 403 yerine **404** döner (resource ID'nin varlığını gizlemek için).

4. **PostgreSQL Port**: `docker-compose.yml` içinde Postgres yalnızca `127.0.0.1:5432` üzerinden erişilebilir — dış ağdan ulaşılamaz.

5. **Non-root Container**: Backend container `appuser` olarak çalışır (root değil).

---

## 📝 Git Commit Sözleşmesi

Proje boyunca [Conventional Commits](https://www.conventionalcommits.org/) standardı kullanılmıştır:

| Prefix | Kullanım |
|---|---|
| `feat(backend):` | Yeni backend özelliği |
| `feat(frontend):` | Yeni frontend özelliği |
| `fix:` | Hata düzeltmesi |
| `chore:` | Yapılandırma, bağımlılık güncellemesi |
| `docs:` | Dokümantasyon değişikliği |
| `refactor:` | Davranış değiştirmeyen kod iyileştirmesi |

---

## 👨‍💻 Geliştirici

| | |
|---|---|
| **Ad Soyad** | Ahmet Faruk Durmuş |
| **Proje** | Staj Projesi – Part 1: Kanban Task Management |
| **Yıl** | 2026 |
