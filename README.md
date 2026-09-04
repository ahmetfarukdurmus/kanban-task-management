# Multi-Tenant Kanban & Task Management System

Kurumsal ekipler ve organizasyonlar için geliştirilmiş; çoklu organizasyon desteği, rol tabanlı erişim kontrolü (RBAC) ve dinamik iş akışı sunan görev yönetim platformu.

---

## Mimari Yapı ve Teknoloji Yığını

Proje, katmanlı mimari (Layered Architecture) prensiplerine göre tasarlanmış olup istemci ve sunucu tamamen ayrık (decoupled) çalışmaktadır.

* Backend: Java 17, Spring Boot 3.x, Spring Data JPA, Spring Security
* Kimlik Doğrulama & Güvenlik: Stateless JWT (JSON Web Token), BCrypt Password Hashing, Metot Düzeyinde RBAC (@PreAuthorize)
* Veritabanı: PostgreSQL (Hibernate / JPA ORM)
* Frontend: React 18, TypeScript, Tailwind CSS, Context API
* Konteynerizasyon: Docker, Docker Compose

---

## Veri Modeli ve Temel İlişkiler

* User - Organization (@ManyToMany): Bir kullanıcı birden fazla organizasyona üye olabilir veya yönetici atanabilir. İlişki user_organizations ara tablosu ile yönetilir.
* Organization - Board (@OneToMany): Panolar organizasyonlara bağlıdır. Her organizasyon altında birden fazla iş akış panosu oluşturulabilir.
* Board - Column - Task (@OneToMany): Panolar dinamik sütunlardan (To Do, In Progress, Review, Done vb.), sütunlar ise görev kartlarından meydana gelir. Pano silindiğinde alt görevler transaction güvenliğiyle temizlenir.
* Task - User (@ManyToOne): Görevler organizasyon içi veya organizasyonlar arası çapraz şekilde kullanıcılara atanabilir.

---

## Rol ve Yetkilendirme Hiyerarşisi

| Rol | Kapsam | Yetkiler |
| :--- | :--- | :--- |
| ROLE_SUPER_ADMIN | Sistem Geneli | Yeni organizasyon oluşturma, silme, tüm panoları ve kullanıcıları yönetme, çapraz görev atama. |
| ROLE_ADMIN | Organizasyon Düzeyi | Yalnızca bağlı olduğu organizasyon(lar) içinde yeni pano açma, düzenleme, silme ve departman üyelerine görev atama. |
| ROLE_USER | Ekip Üyesi | Atandığı/üyesi olduğu panolardaki görevleri görüntüleme, durum güncelleme ve kart taşıma. |

---

## Varsayılan Test Kullanıcıları (Seed Data)

Sistem DataInitializer ile temiz bir başlangıç durumunda ayağa kalkar. Varsayılan test hesapları:

* Super Admin: superadmin / user123 (veya admin123)
* Organizasyon Admini: can_ozkan / user123
* Ekip Üyeleri: ali_yilmaz, ayse_kaya, mehmet_demir, zeynep_celik / user123

---

## Kurulum ve Çalıştırma

### 1. Docker ile Hızlı Başlangıç
Tüm altyapıyı (PostgreSQL, Backend, Frontend) tek komutla başlatmak için:

```bash
docker compose up -d --build
```
