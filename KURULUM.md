# KURULUM KILAVUZU

> Bu döküman, uygulamayı ayağa kaldırmak için gereken operasyonel adımları kapsar.  
> Proje hakkında genel bilgi için `README.md` dosyasına bakın.

---

## İÇİNDEKİLER

1. [Sistem Gereksinimleri](#1-sistem-gereksinimleri)
2. [Tek Komutla Çalıştırma (Docker)](#2-tek-komutla-çalıştırma-docker)
3. [Erişim Adresleri ve Varsayılan Kullanıcılar](#3-erişim-adresleri-ve-varsayılan-kullanıcılar)
4. [Geliştirme Ortamı (Opsiyonel)](#4-geliştirme-ortamı-opsiyonel)
5. [Operasyonel Komutlar ve Sorun Giderme](#5-operasyonel-komutlar-ve-sorun-giderme)

---

## 1. SİSTEM GEREKSİNİMLERİ

### Zorunlu Yazılımlar

| Bileşen | Minimum Sürüm | Kontrol Komutu |
|---|---|---|
| **Docker Engine** | 24.0+ | `docker --version` |
| **Docker Compose** | 2.20+ (Compose v2) | `docker compose version` |

> ⚠️ **Not:** Eski `docker-compose` (v1, tire ile) desteklenmemektedir. `docker compose` (boşluk ile, v2) kullanılmalıdır.

### Port Gereksinimleri

Sistem aşağıdaki portları kullanmaktadır. Başlamadan önce bu portların boş olduğundan emin olun:

| Port | Servis | Protokol |
|---|---|---|
| `80` | React Frontend (Nginx) | HTTP |
| `8080` | Spring Boot REST API | HTTP |
| `5432` | PostgreSQL 16 | TCP (yalnızca `127.0.0.1`) |

### Port Çakışma Kontrolü

```bash
# Linux / macOS
lsof -i :80
lsof -i :8080
lsof -i :5432

# Windows (PowerShell)
netstat -ano | findstr ":80 "
netstat -ano | findstr ":8080"
netstat -ano | findstr ":5432"
```

---

## 2. TEK KOMUTLA ÇALIŞTIRMA (DOCKER)

### Adım 1 — Repoyu Klonlayın

```bash
git clone <repo-url>
cd kanban-task-management
```

### Adım 2 — Derleme ve Başlatma

```bash
docker compose up --build -d
```

> 🕐 **İlk çalıştırma:** Maven bağımlılıkları ve npm paketleri indirildiği için **3–8 dakika** sürebilir.  
> Sonraki başlatmalar Docker katman önbelleği sayesinde çok daha hızlı olur.

Servisler başlatma sırası:

```
postgres (sağlık kontrolü geçene kadar bekler)
    └─▶ backend (Postgres hazır olduktan sonra başlar)
            └─▶ frontend (Backend başladıktan sonra başlar)
```

### Adım 3 — Konteynerlerin Durumunu Doğrulayın

```bash
docker compose ps
```

Beklenen çıktı — üç servis de `running` durumunda olmalıdır:

```
NAME               IMAGE               STATUS          PORTS
kanban-postgres    postgres:16-alpine  Up (healthy)    127.0.0.1:5432->5432/tcp
kanban-backend     kanban-backend      Up              0.0.0.0:8080->8080/tcp
kanban-frontend    kanban-frontend     Up              0.0.0.0:80->80/tcp
```

### Adım 4 — Backend Hazırlığını Loglardan Kontrol Edin

```bash
# Tüm servislerin loglarını canlı izle
docker compose logs -f

# Yalnızca backend loglarını izle
docker compose logs -f backend
```

Backend hazır olduğunda şu satırları görmelisiniz:

```
kanban-backend | Started KanbanApplication in X.XXX seconds
kanban-backend | DataInitializer completed: Banking scenario seed data is ready.
```

Loglardan çıkmak için `Ctrl+C` tuşuna basın (konteynerler çalışmaya devam eder).

---

## 3. ERİŞİM ADRESLERİ VE VARSAYILAN KULLANICILAR

### Servis Adresleri

| Servis | URL | Açıklama |
|---|---|---|
| **Frontend** | http://localhost | React uygulaması (Nginx) |
| **Backend API** | http://localhost:8080/api | Spring Boot REST API |
| **PostgreSQL** | `localhost:5432` | Yalnızca yerel erişim |

> Frontend, `/api/*` isteklerini otomatik olarak `http://backend:8080/api/` adresine proxy'ler.

### PostgreSQL Bağlantı Bilgileri

```
Host:     localhost
Port:     5432
Database: kanban_db
User:     kanban_user
Password: kanban_pass
```

---

### Hazır Gelen Kullanıcı Hesapları (Seed Data)

| Kullanıcı Adı | Şifre | Rol |
|---|---|---|
| `superadmin` | `password123` | **Super Admin** |
| `admin` | `password123` | **Super Admin** |
| `ali.yilmaz` | `password123` | Kullanıcı |
| `zeynep.kaya` | `password123` | Kullanıcı |
| `mehmet.demir` | `password123` | Kullanıcı |
| `ayse.celik` | `password123` | Kullanıcı |
| `burak.ozkan` | `password123` | Kullanıcı |

> 🔑 **Önerilen giriş:** `superadmin` / `password123`

---

### Hazır Gelen Panolar ve Görev Tipleri

| Pano / Board | Görev Tipi | Kod (Prefix) | Iş Akışı Kolonları |
|---|---|---|---|
| Ödeme Sistemleri Ana Board | Kritik Ödeme Entegrasyonu | `PAY` | Backlog → Geliştirme → QA & Güvenlik → Canlıya Alındı |
| — | Firewall & Ağ Kural Tanımı | `FW` | Talep Açıldı → Güvenlik Onayı → Kural Uygulandı → Doğrulandı & Aktif |
| — | internship task | `INT` | — |

Görev kodları `{PREFIX}-{ID}` formatında otomatik atanır (ör: `PAY-3`, `FW-7`).

**Organizasyon:** `FinTech & Core Banking Solutions`

---

## 4. GELİŞTİRME ORTAMI (OPSİYONEL)

Backend ve frontend'i yerel olarak (hot-reload ile) çalıştırırken yalnızca veritabanını Docker üzerinde tutmak için:

### Adım 1 — Yalnızca PostgreSQL'i Başlatın

```bash
docker compose up postgres -d
```

### Adım 2 — Backend'i Yerel Olarak Çalıştırın

**Gereksinim:** Java 21 JDK, Maven 3.9+

```bash
cd backend
mvn spring-boot:run
```

Backend `http://localhost:8080/api` adresinde başlar.

### Adım 3 — Frontend'i Yerel Olarak Çalıştırın

**Gereksinim:** Node.js 20+, npm

```bash
cd frontend
npm install
npm run dev
```

Frontend `http://localhost:5173` adresinde başlar.

---

## 5. OPERASYONEL KOMUTLAR VE SORUN GİDERME

### Temel Konteyner Komutları

```bash
# Tüm servisleri durdur (veriler korunur)
docker compose down

# Servisleri yeniden başlat
docker compose restart

# Yeniden derleyerek başlat
docker compose up --build -d

# Sadece bir servisi yeniden başlat
docker compose restart backend
docker compose restart frontend
```

### Veritabanını Sıfırlama

> ⚠️ **Uyarı:** Aşağıdaki komut tüm veritabanı verilerini kalıcı olarak siler!

```bash
# Konteynerleri ve volume'u sil (DB tamamen sıfırlanır)
docker compose down -v

# Schema ve seed data ile yeniden başlat
docker compose up --build -d
```

### Önbellek Temizleme

```bash
# Frontend imajını önbelleksiz yeniden derle
docker compose build --no-cache frontend
docker compose up -d frontend

# Docker build önbelleğini tamamen temizle
docker builder prune -f
```

---

### Sık Karşılaşılan Sorunlar

#### ❌ Port zaten kullanımda

```
Error: Bind for 0.0.0.0:80 failed: port is already allocated
```

```bash
lsof -ti :80 | xargs kill -9
lsof -ti :8080 | xargs kill -9
docker compose up -d
```

---

#### ❌ Backend başlamıyor / Postgres bağlantısı reddediliyor

```bash
# Postgres durumunu kontrol et
docker compose logs postgres
docker exec kanban-postgres pg_isready -U kanban_user -d kanban_db

# Backend'i yeniden başlat
docker compose restart backend
```

---

#### ❌ Frontend boş sayfa / API 502 hatası

Backend henüz tam başlamamış olabilir. İlk açılışta 30–60 saniye beklenebilir:

```bash
docker compose logs -f backend   # "Started KanbanApplication" satırını bekleyin
```

Ardından tarayıcıda `Ctrl+Shift+R` ile hard refresh yapın.

---

#### ❌ Konteyner sürekli yeniden başlıyor

```bash
docker compose logs --tail=200 backend
docker compose stop backend && docker compose start backend
```

---

#### ❌ Veritabanı şeması eski / migration hatası

```bash
docker compose down -v
docker compose up --build -d
```

Uygulama `ddl-auto: update` ayarı ile her başlatmada şemayı otomatik günceller.

---

#### ❌ Disk alanı yetersiz

```bash
# Kullanılmayan kaynakları temizle
docker system prune -f

# Tüm Docker kaynaklarını temizle (dikkatli kullanın)
docker system prune -a --volumes -f
```

---

### Hızlı Başvuru

```bash
docker compose up --build -d                    # Derleme + başlatma
docker compose down                             # Durdur (veri korunur)
docker compose down -v                          # Durdur + DB sıfırla
docker compose ps                               # Servis durumları
docker compose logs -f                          # Canlı log
docker compose logs -f backend                  # Yalnızca backend logu
docker compose restart backend                  # Backend yeniden başlat
docker compose build --no-cache frontend \
  && docker compose up -d frontend              # Frontend yeniden derle
```
