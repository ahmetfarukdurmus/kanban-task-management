# 🏦 Kanban Task Management — Enterprise Edition

> **FinTech & Core Banking Solutions** — A production-grade, full-stack Kanban board application built as a realistic simulation of a payment-system engineering workflow.  
> Demonstrates 3D Secure task tracking, PCI-DSS compliance checklists, and environment-gated deployment workflows — all enforced by server-side transition guards.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Architecture & Design Principles](#3-architecture--design-principles)
4. [Database Model & Relationships](#4-database-model--relationships)
5. [Workflow Engine & Transition Guards](#5-workflow-engine--transition-guards)
6. [Role-Based Access Control (RBAC)](#6-role-based-access-control-rbac)
7. [REST API Reference](#7-rest-api-reference)
8. [Running the Project](#8-running-the-project)
9. [Demo Seed Data](#9-demo-seed-data)

---

## 1. Project Overview

This application is a **Kanban-style project management system** tailored for a FinTech engineering department. Tasks model real banking engineering artifacts:

| Scenario | How it maps |
|---|---|
| **3D Secure integration** | Task with `targetEnvironment = PROD`, requiring full checklist completion before moving to "Done" |
| **PCI-DSS audit prep** | Tasks gate-blocked by `ATTACHMENT_REQUIRED` rule — auditors must upload evidence before progressing |
| **Deployment pipeline** | Columns represent `DEV → TEST → STAGING → PROD`; transition rules enforce QA sign-off |
| **Security & DevOps review** | Reporter field tracks accountability; test due date drives sprint planning |

The system supports **multiple organizations (departments)**, **dynamic task types** with configurable column workflows, and **server-side enforcement** of all transition rules — so rules cannot be bypassed from the frontend.

---

## 2. Tech Stack

### Backend
| Layer | Technology |
|---|---|
| Language | Java 21 (LTS) |
| Framework | Spring Boot 3.x |
| Security | Spring Security 6 + JWT (stateless) |
| ORM | Spring Data JPA / Hibernate 6 |
| Database | PostgreSQL 16 |
| Build | Apache Maven |
| Utilities | Lombok (`@RequiredArgsConstructor`, `@Data`) |
| File Upload | Spring Multipart (25 MB limit) |

### Frontend
| Layer | Technology |
|---|---|
| Language | TypeScript 5 |
| Framework | React 18 |
| State / Data | TanStack React Query (server state) |
| Styling | Tailwind CSS 3 |
| Bundler | Vite |
| HTTP Client | Axios |
| Drag & Drop | `@hello-pangea/dnd` |

### Infrastructure
| Component | Technology |
|---|---|
| Containerisation | Docker + Docker Compose |
| Frontend server | Nginx (reverse-proxies `/api` to backend) |
| Data persistence | Docker named volume `kanban_postgres_data` |

---

## 3. Architecture & Design Principles

```
┌─────────────────────────────────────┐
│           React 18 SPA              │  http://localhost (Nginx)
│   TypeScript · Tailwind · Vite      │
└────────────────┬────────────────────┘
                 │  HTTP  /api/*
┌────────────────▼────────────────────┐
│       Spring Boot REST API          │  :8080
│  Controller → Service → Repository  │
│  JWT filter on every request        │
└────────────────┬────────────────────┘
                 │  JDBC
┌────────────────▼────────────────────┐
│         PostgreSQL 16               │  :5432
│   kanban_db / kanban_user           │
└─────────────────────────────────────┘
```

### Controller → Service → Repository

- **Controllers** are thin: they validate input (`@Valid`), delegate to the service layer, and map the result to an HTTP response.
- **Services** contain all business logic: authorization checks, position calculations, transition rule enforcement, DTO mapping.
- **Repositories** are plain `JpaRepository` extensions. Custom JPQL lives here (shift operations, `findBy*` queries).

### DTO Pattern — No Entity Leakage

Every endpoint returns a **DTO**, never a raw JPA entity. This prevents:
- Jackson circular-reference / infinite-recursion errors (bidirectional `@OneToMany ↔ @ManyToOne`)
- Accidental exposure of password hashes or lazy-loaded proxies
- Breaking API clients on internal schema changes

Key DTOs:

| DTO | Description |
|---|---|
| `BoardResponse` | Board summary with `taskTypeName`, `taskTypeColor`, column list |
| `TaskResponse` | Full task with assignees, checklist items, attachments, reporter |
| `TaskTypeDto` | Task type with column definitions and transition rules |
| `AuthResponse` | JWT token + user info on login/register |
| `UserSummaryDto` | Safe user projection (no password) |

### Constructor Injection (`@RequiredArgsConstructor`)

All Spring beans use **constructor injection** (via Lombok's `@RequiredArgsConstructor`) rather than field injection. This makes dependencies explicit, enables immutability, and simplifies unit testing.

### Column & Task Position Algorithm

Columns and tasks maintain an integer `position` (0-based) within their parent. When an item is inserted or removed, adjacent items are shifted to keep positions contiguous using two JPQL `@Modifying` queries:

```java
// Shifts remaining columns/tasks up when one is deleted
@Modifying
@Query("UPDATE BoardColumn c SET c.position = c.position - 1 " +
       "WHERE c.board.id = :boardId AND c.position > :position")
void shiftPositionsLeft(@Param("boardId") Long boardId, @Param("position") int position);

// Shifts existing columns/tasks down to make room for an insert
@Modifying
@Query("UPDATE BoardColumn c SET c.position = c.position + 1 " +
       "WHERE c.board.id = :boardId AND c.position >= :position")
void shiftPositionsRight(@Param("boardId") Long boardId, @Param("position") int position);
```

`TaskRepository` has identical methods scoped to `columnId`. The reorder endpoint (`PATCH .../reorder`) orchestrates both shift operations atomically inside a `@Transactional` service method.

---

## 4. Database Model & Relationships

### Entity Map

```
Organization
  │  ManyToMany ←──────────────────────── User  (user_organizations join table)
  │  OneToMany
  └─► TaskType
        │  OneToMany
        └─► TaskTypeColumn          (ordered by position)
        │  OneToMany
        └─► TaskTypeTransitionRule  (references two TaskTypeColumns)

Board  ManyToOne──► Organization
       ManyToOne──► User (owner)
       ManyToOne──► TaskType (optional)
  │  OneToMany  (cascade ALL, orphanRemoval)
  └─► BoardColumn  (position)
        │  OneToMany  (cascade ALL, orphanRemoval)
        └─► Task  (position)
              ManyToMany──► User[]        (task_assignees join table)
              ManyToOne──► User           (reporter)
              ManyToOne──► TaskType       (override, optional)
              OneToMany──► TaskChecklistItem
              OneToMany──► Attachment
              OneToMany──► Comment
```

### Entity Reference

| Entity | Table | Key Fields | Notes |
|---|---|---|---|
| `User` | `users` | `username`, `email`, `password` (BCrypt), `role`, `createdAt` | Implements `UserDetails` |
| `Organization` | `organizations` | `name` | ManyToMany with User |
| `Board` | `boards` | `name`, `description`, `position` | columns cascade ALL + orphan |
| `BoardColumn` | `board_columns` | `title`, `position` | tasks cascade ALL + orphan |
| `Task` | `tasks` | `title`, `description`, `priority`, `dueDate`, `testDueDate`, `targetEnvironment`, `estimatedHours`, `storyPoints`, `position` | checklists + attachments + comments cascade ALL + orphan |
| `TaskChecklistItem` | `task_checklist_items` | `content`, `isCompleted`, `requiredForColumnId` | gates column transitions |
| `Attachment` | `attachments` | `fileName`, `fileType`, `filePath`, `fileSize` | stored in `uploads/` dir |
| `Comment` | `comments` | `content`, `createdAt` | chronological order |
| `TaskType` | `task_types` | `name`, `colorHex`, `description` | columns + rules cascade ALL + orphan |
| `TaskTypeColumn` | `task_type_columns` | `title`, `colorHex`, `position` | blueprint columns |
| `TaskTypeTransitionRule` | `task_type_transition_rules` | `ruleType`, `sourceColumnTitle`, `targetColumnTitle` | workflow gate definitions |

### Enumerations

| Enum | Values |
|---|---|
| `Role` | `ROLE_USER`, `ROLE_ADMIN`, `ROLE_SUPER_ADMIN` |
| `Priority` | `LOW`, `MEDIUM`, `HIGH` |
| `TransitionRuleType` | `CHECKLIST_REQUIRED`, `ATTACHMENT_REQUIRED` |

---

## 5. Workflow Engine & Transition Guards

### How Transition Rules Work

Each `TaskType` can define **column transition rules**. A rule specifies:

- **Source column** (optional) — the column the task is moving *from*
- **Target column** (required) — the column the task is moving *into*
- **Rule type** — what condition must be satisfied

When the frontend calls `PATCH /api/tasks/{taskId}/move`, `TaskService` evaluates all applicable rules **server-side** before allowing the move:

```
PATCH /api/tasks/{id}/move  →  TaskService.moveTask()
  │
  ├─ Find matching rules for target column (by ID, then title fuzzy-match)
  ├─ Optionally check source column match
  │
  ├─ CHECKLIST_REQUIRED ──► all TaskChecklistItems must have isCompleted = true
  │                          (items flagged with requiredForColumnId are prioritised)
  │
  └─ ATTACHMENT_REQUIRED ──► task must have at least one Attachment row
```

### Turkish Character Normalization

Column titles are matched using `normalizeColumnName()`, which folds Turkish diacritics to ASCII for fuzzy comparison:

```
ş → s   ç → c   ğ → g   ı → i   ö → o   ü → u
```

This allows rules created against `"Tamamlandı"` to still match board columns with slight spelling variants.

### Example: PCI-DSS Banking Workflow

| → Target Column | Rule Type | Meaning |
|---|---|---|
| `Test Aşamasında` | `CHECKLIST_REQUIRED` | All dev checklist items must be ticked before QA |
| `Onay Bekliyor` | `CHECKLIST_REQUIRED` | All QA checklist items must be ticked before sign-off |
| `Canlıya Alındı` | `ATTACHMENT_REQUIRED` | Release evidence (screenshot/PDF) must be uploaded before going live |

---

## 6. Role-Based Access Control (RBAC)

### Roles

| Role | Access Level |
|---|---|
| `ROLE_SUPER_ADMIN` | Full system access — create/delete organizations, manage all users and boards |
| `ROLE_ADMIN` | Manage boards and task types within their organization |
| `ROLE_USER` | Create tasks, comment, upload attachments; read-only on sensitive fields |

### Endpoint-Level Guards (`@PreAuthorize`)

| Action | Required Role |
|---|---|
| `DELETE /api/boards/{id}` | `ADMIN` or `SUPER_ADMIN` |
| `POST /api/organizations` | `SUPER_ADMIN` |
| `DELETE /api/organizations/{id}` | `SUPER_ADMIN` |
| `POST/DELETE /api/organizations/{id}/members/*` | `SUPER_ADMIN` |
| `POST/PUT/DELETE /api/task-types/*` | `ADMIN` or `SUPER_ADMIN` |
| `POST/DELETE /api/task-types/{id}/rules/*` | `ADMIN` or `SUPER_ADMIN` |

### Frontend UI Guards

The React application reads `currentUser.role` from the JWT-derived auth context:

- **Task Detail Modal** — `dueDate`, `testDueDate`, `taskType`, `reporter`, and `targetEnvironment` fields are `disabled` and rendered as read-only badges for `ROLE_USER`.
- **Board list actions** — Delete board button is hidden for `ROLE_USER`.
- **Task Type management** — The entire admin panel is hidden for `ROLE_USER`.

---

## 7. REST API Reference

> **Base URL:** `http://localhost:8080/api`  
> All endpoints except `/auth/*` and `GET /organizations` require an `Authorization: Bearer <JWT>` header.

### Authentication

| Method | Path | Body | Description |
|---|---|---|---|
| `POST` | `/auth/register` | `{ username, email, password, organizationId? }` | Register, returns JWT |
| `POST` | `/auth/login` | `{ username, password }` | Login, returns JWT |

### Users

| Method | Path | Description |
|---|---|---|
| `GET` | `/users` | List all users (for assignment dropdowns) |

### Organizations

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/organizations` | Any | List all organizations |
| `POST` | `/organizations` | `SUPER_ADMIN` | Create organization |
| `DELETE` | `/organizations/{id}` | `SUPER_ADMIN` | Delete organization (cascades boards) |
| `GET` | `/organizations/{orgId}/members` | Authenticated | List members |
| `POST` | `/organizations/{orgId}/members/existing` | `SUPER_ADMIN` | Add existing users to org |
| `POST` | `/organizations/{orgId}/members/new` | `SUPER_ADMIN` | Create & add new user |
| `DELETE` | `/organizations/{orgId}/members/{userId}` | `SUPER_ADMIN` | Remove member |

### Boards

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/boards` | Authenticated | List all boards |
| `POST` | `/boards` | Authenticated | Create board |
| `GET` | `/boards/{id}` | Authenticated | Board detail (columns + tasks) |
| `PUT` | `/boards/{id}` | Authenticated | Update board |
| `DELETE` | `/boards/{id}` | `ADMIN` / `SUPER_ADMIN` | Delete board and all children |

### Board Columns

| Method | Path | Description |
|---|---|---|
| `GET` | `/boards/{boardId}/columns` | List columns |
| `POST` | `/boards/{boardId}/columns` | Add column |
| `GET` | `/boards/{boardId}/columns/{columnId}` | Get column |
| `PUT` | `/boards/{boardId}/columns/{columnId}` | Rename column |
| `DELETE` | `/boards/{boardId}/columns/{columnId}` | Delete column + tasks |
| `PATCH` | `/boards/{boardId}/columns/{columnId}/reorder` | Reorder `{ "newPosition": 2 }` |

### Tasks

| Method | Path | Description |
|---|---|---|
| `GET` | `/boards/{boardId}/columns/{columnId}/tasks` | List tasks |
| `POST` | `/boards/{boardId}/columns/{columnId}/tasks` | Create task |
| `GET` | `/boards/{boardId}/columns/{columnId}/tasks/{taskId}` | Get task |
| `PUT` | `/boards/{boardId}/columns/{columnId}/tasks/{taskId}` | Update task |
| `PUT` | `/tasks/{taskId}` | Update task (column-agnostic) |
| `DELETE` | `/boards/{boardId}/columns/{columnId}/tasks/{taskId}` | Delete task |
| `PATCH` | `/tasks/{taskId}/move` | Move/reorder — enforces transition rules |

**Move request body:**
```json
{
  "targetColumnId": 12,
  "newPosition": 0
}
```

### Checklist Items

| Method | Path | Description |
|---|---|---|
| `POST` | `/tasks/{taskId}/checklists` | Add item |
| `PATCH` | `/tasks/{taskId}/checklists/{itemId}/toggle` | Toggle completion |
| `PUT` | `/tasks/{taskId}/checklists/{itemId}` | Update content |
| `DELETE` | `/tasks/{taskId}/checklists/{itemId}` | Delete item |

### Comments

| Method | Path | Description |
|---|---|---|
| `GET` | `/tasks/{taskId}/comments` | List comments (chronological) |
| `POST` | `/tasks/{taskId}/comments` | Add comment |
| `DELETE` | `/tasks/{taskId}/comments/{commentId}` | Delete comment |

### Attachments

| Method | Path | Description |
|---|---|---|
| `GET` | `/tasks/{taskId}/attachments` | List attachments |
| `POST` | `/tasks/{taskId}/attachments` | Upload (`multipart/form-data`, field: `file`) — max 25 MB |
| `GET` | `/tasks/{taskId}/attachments/{attachmentId}/download` | Stream/download |
| `DELETE` | `/tasks/{taskId}/attachments/{attachmentId}` | Delete |

### Task Types

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/task-types` | Authenticated | List (filter: `?organizationId=`) |
| `GET` | `/task-types/{id}` | Authenticated | Get task type |
| `POST` | `/task-types` | `ADMIN` / `SUPER_ADMIN` | Create |
| `PUT` | `/task-types/{id}` | `ADMIN` / `SUPER_ADMIN` | Update |
| `DELETE` | `/task-types/{id}` | `ADMIN` / `SUPER_ADMIN` | Delete |
| `POST` | `/task-types/{id}/rules` | `ADMIN` / `SUPER_ADMIN` | Add transition rule |
| `DELETE` | `/task-types/{id}/rules/{ruleId}` | `ADMIN` / `SUPER_ADMIN` | Remove rule |

---

## 8. Running the Project

### Prerequisites

- Docker Desktop (v24+) and Docker Compose v2
- No other local dependencies required — everything runs inside containers

### Quick Start

```bash
# 1. Clone the repository
git clone <repo-url>
cd kanban-task-management

# 2. (Optional) Copy the example environment file and customise
cp .env.example .env

# 3. Start all services (postgres → backend → frontend)
docker compose up -d

# 4. Follow logs to watch startup
docker compose logs -f

# 5. Open the app
open http://localhost
```

> First startup takes ~2–3 minutes while Docker builds the backend and frontend images. Subsequent starts are fast — images are cached.

### Service URLs

| Service | URL |
|---|---|
| Frontend (React SPA) | http://localhost |
| Backend REST API | http://localhost:8080/api |
| PostgreSQL | localhost:5432 (host-only, not exposed externally) |

### Stop & Cleanup

```bash
docker compose down          # stop (data preserved)
docker compose down -v       # stop + delete all data
```

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DB_HOST` | `postgres` | PostgreSQL hostname |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_NAME` | `kanban_db` | Database name |
| `DB_USER` | `kanban_user` | Database user |
| `DB_PASS` | `kanban_pass` | Database password |
| `JWT_SECRET` | *(base64 key)* | HMAC-SHA256 signing secret — **change in production** |
| `JWT_EXPIRATION_MS` | `86400000` | Token TTL (24 hours) |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:3000` | Allowed CORS origins |
| `SERVER_PORT` | `8080` | Backend HTTP port |
| `UPLOAD_DIR` | `uploads` | Attachment storage directory |

> **Production checklist:** generate a fresh JWT secret with `openssl rand -base64 64`, set `spring.jpa.hibernate.ddl-auto: validate`, and do not expose port 5432 publicly.

### Local Development (without Docker)

```bash
# Backend — requires local PostgreSQL with kanban_db / kanban_user / kanban_pass
cd backend
mvn spring-boot:run

# Frontend — Vite dev server (proxies /api to localhost:8080)
cd frontend
npm install
npm run dev   # http://localhost:5173
```

---

## 9. Demo Seed Data

`DataInitializer` (a Spring `CommandLineRunner`) seeds a complete **FinTech banking scenario** on every startup. All records are idempotent — created only if they do not already exist.

### Organization

| Field | Value |
|---|---|
| Name | FinTech & Core Banking Solutions |

### Users

| Username | Full Name | Role | Password |
|---|---|---|---|
| `superadmin` | Sistem Yöneticisi | `SUPER_ADMIN` | `password123` |
| `ali.yilmaz` | Ali Yılmaz — Backend Lead | `USER` | `password123` |
| `zeynep.kaya` | Zeynep Kaya — Frontend Dev | `USER` | `password123` |
| `mehmet.demir` | Mehmet Demir — QA Automation | `USER` | `password123` |
| `ayse.celik` | Ayşe Çelik — Security & DevOps | `USER` | `password123` |
| `burak.ozkan` | Burak Özkan — Product Owner | `USER` | `password123` |

### Task Types

| Name | Color | Columns |
|---|---|---|
| Kritik Ödeme Entegrasyonu | `#2563EB` (blue) | Backlog → Geliştirme Aşamasında → Test Aşamasında → Onay Bekliyor → Canlıya Alındı |
| Internship Task | `#EF4444` (red) | Backlog → In Progress → In Review → Done |

**Transition Rules (Kritik Ödeme Entegrasyonu):**

| → Target Column | Rule Type | Meaning |
|---|---|---|
| `Test Aşamasında` | `CHECKLIST_REQUIRED` | Dev checklist must be complete before QA |
| `Onay Bekliyor` | `CHECKLIST_REQUIRED` | QA checklist must be complete before sign-off |
| `Canlıya Alındı` | `ATTACHMENT_REQUIRED` | Release evidence must be uploaded before going live |

### Seed Board & Tasks

**Board:** `Ödeme Sistemleri Ana Board` — linked to *Kritik Ödeme Entegrasyonu* task type

| # | Task Title | Column | Priority | Assignees |
|---|---|---|---|---|
| 1 | 3D Secure 2.0 Entegrasyon Modülü | Geliştirme Aşamasında | HIGH | ali.yilmaz, zeynep.kaya |
| 2 | PCI-DSS Uyumluluk Denetim Altyapısı | Test Aşamasında | HIGH | mehmet.demir, ayse.celik |
| 3 | SWIFT MT103 Mesaj Parser Geliştirmesi | Backlog | MEDIUM | ali.yilmaz |

Each task has pre-seeded checklist items demonstrating the transition gate requirements.

---

## Project Structure

```
kanban-task-management/
├── backend/
│   ├── src/main/java/com/kanban/
│   │   ├── config/          # SecurityConfig, DataInitializer, JwtConfig
│   │   ├── controller/      # 9 REST controllers
│   │   ├── dto/             # Request/Response DTOs (no entity leakage)
│   │   ├── entity/          # JPA entities
│   │   ├── repository/      # Spring Data JPA repositories
│   │   ├── security/        # JwtFilter, JwtUtil, UserDetailsService
│   │   └── service/         # Business logic layer
│   ├── src/main/resources/
│   │   └── application.yml
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── api/             # Axios API clients
│   │   ├── components/      # Reusable UI components
│   │   ├── context/         # AuthContext (JWT decode, currentUser)
│   │   ├── pages/           # Route-level page components
│   │   └── types/           # TypeScript interfaces
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

---

*Built with ❤️ on Java 21 · Spring Boot 3 · React 18 · TypeScript · Tailwind CSS · PostgreSQL 16*
