# Enterprise Multi-Tenant Kanban & Workflow Management Platform

A production-ready, full-stack project management platform supporting multiple organizations, dynamic task type definitions, and rule-based workflow transition guards enforced at the server layer.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Technology Stack](#2-technology-stack)
3. [System Architecture & Design Principles](#3-system-architecture--design-principles)
4. [Domain Model & Database Relationships](#4-domain-model--database-relationships)
5. [Workflow Engine — Transition Guards](#5-workflow-engine--transition-guards)
6. [Security & Role-Based Access Control](#6-security--role-based-access-control)
7. [REST API Design](#7-rest-api-design)
8. [Setup & Running](#8-setup--running)

---

## 1. Overview

This platform provides Kanban-style board management across multiple isolated tenant organizations. Each organization can define its own **Task Types** — workflow blueprints that prescribe the column structure and inter-column transition rules for tasks that follow that type. Transition rules are validated server-side, making it impossible to bypass workflow guards from the client.

**Core capabilities:**

- Multi-tenant organization management with member assignment
- Dynamic, per-organization Task Type definitions (custom columns + color)
- Configurable column transition rules (`CHECKLIST_REQUIRED`, `ATTACHMENT_REQUIRED`)
- Drag-and-drop task ordering with a gap-efficient position shift algorithm
- Task detail enrichment: assignees, reporter, priority, due dates, target environment, story points, estimated hours
- Threaded comments and file attachments per task
- Stateless JWT authentication with three-tier RBAC

---

## 2. Technology Stack

### Backend

| Concern | Technology |
|---|---|
| Language | Java 21 (LTS) |
| Framework | Spring Boot 3.x |
| Security | Spring Security 6 + JJWT (stateless JWT) |
| Persistence | Spring Data JPA / Hibernate 6 |
| Database | PostgreSQL 16 |
| Build | Apache Maven |
| Boilerplate reduction | Lombok (`@Data`, `@RequiredArgsConstructor`, `@Builder`) |
| File handling | Spring Multipart (25 MB per file / per request) |
| Schema management | Hibernate DDL auto (`update` in dev, `validate` in production) |

### Frontend

| Concern | Technology |
|---|---|
| Language | TypeScript 5 |
| Framework | React 18 |
| Server state | TanStack React Query v5 |
| Styling | Tailwind CSS 3 |
| Bundler | Vite |
| HTTP client | Axios |
| Drag and drop | @hello-pangea/dnd |

### Infrastructure

| Concern | Technology |
|---|---|
| Containerization | Docker + Docker Compose v2 |
| Frontend serving | Nginx (also reverse-proxies `/api` to the backend) |
| Database persistence | Docker named volume (`kanban_postgres_data`) |

---

## 3. System Architecture & Design Principles

### Layered Architecture

```
Client (React SPA)
        |
        |  HTTP / JSON
        v
Controller Layer          — Input validation (@Valid), HTTP mapping, no business logic
        |
        v
Service Layer             — All business logic: authorization, transition guards,
        |                   position recalculation, DTO assembly
        v
Repository Layer          — Spring Data JPA interfaces; custom JPQL for bulk operations
        |
        v
Database (PostgreSQL 16)
```

Each layer is strictly separated. Controllers are thin: they validate the incoming request, call the appropriate service method, and return the result as an HTTP response. No JPA entity is returned directly from any controller.

### DTO Pattern — Entity Isolation

Every API response is a Data Transfer Object (DTO), never a raw JPA entity. This design decision enforces three guarantees:

1. **No circular serialization.** Bidirectional JPA relationships (`@OneToMany` ↔ `@ManyToOne`) would cause Jackson to recurse infinitely if entities were serialized directly. DTOs break the cycle by including only the fields needed by the client.
2. **No credential leakage.** `User.password` (BCrypt hash) is never included in any response DTO.
3. **Stable API contract.** Internal schema changes (field renames, relation restructuring) do not affect the API surface as long as the DTO mapper is updated accordingly.

Key response DTOs:

| DTO | Contents |
|---|---|
| `BoardResponse` | Board metadata, `taskTypeName`, `taskTypeColor`, flat column list |
| `TaskResponse` | Full task fields, assignee summaries, checklist items, attachment list, reporter summary |
| `TaskTypeDto` | Task type definition, ordered column list, transition rules |
| `AuthResponse` | JWT token string + user summary (id, username, role, organization) |
| `UserSummaryDto` | Safe user projection — id, username, email, role, organization IDs |

### Dependency Injection — Constructor Injection

All Spring-managed beans use constructor injection exclusively, enabled by Lombok's `@RequiredArgsConstructor`. This means every dependency is `final`, making beans effectively immutable after construction. Benefits:

- Dependencies are explicit and visible in the constructor signature
- No partial initialization is possible — a bean either fully constructs or fails
- Unit tests can inject mocks without any Spring context

### Position & Ordering Algorithm

Board columns and tasks each carry an integer `position` field (zero-based) within their parent. When a column or task is inserted, deleted, or reordered, only the affected range of sibling records is updated — not every sibling.

Two `@Modifying` JPQL methods are used:

```java
// Shift all positions > deleted position down by 1 (close the gap)
@Modifying
@Query("""
    UPDATE BoardColumn c
    SET c.position = c.position - 1
    WHERE c.board.id = :boardId AND c.position > :position
    """)
void shiftPositionsLeft(@Param("boardId") Long boardId, @Param("position") int position);

// Shift all positions >= target position up by 1 (open a slot)
@Modifying
@Query("""
    UPDATE BoardColumn c
    SET c.position = c.position + 1
    WHERE c.board.id = :boardId AND c.position >= :position
    """)
void shiftPositionsRight(@Param("boardId") Long boardId, @Param("position") int position);
```

`TaskRepository` has equivalent methods scoped to `columnId`. The reorder service method runs both operations inside a single `@Transactional` boundary to prevent intermediate inconsistency. This approach issues one SQL `UPDATE` touching only the affected rows — an O(k) operation where k is the number of elements displaced, not O(n) for the entire collection.

---

## 4. Domain Model & Database Relationships

### Entity Relationship Map

```
Organization
  |-- ManyToMany --> User              (join table: user_organizations)
  |-- OneToMany  --> TaskType
                       |-- OneToMany  --> TaskTypeColumn       (position-ordered)
                       |-- OneToMany  --> TaskTypeTransitionRule

Board
  |-- ManyToOne  --> Organization
  |-- ManyToOne  --> User (owner)
  |-- ManyToOne  --> TaskType (optional blueprint)
  |-- OneToMany  --> BoardColumn       (cascade ALL, orphanRemoval)
                       |-- OneToMany  --> Task                 (cascade ALL, orphanRemoval)
                                            |-- ManyToMany --> User[]         (task_assignees)
                                            |-- ManyToOne  --> User           (reporter)
                                            |-- ManyToOne  --> TaskType       (override)
                                            |-- OneToMany  --> TaskChecklistItem  (cascade ALL)
                                            |-- OneToMany  --> Attachment         (cascade ALL)
                                            |-- OneToMany  --> Comment            (cascade ALL)
```

### Entity Reference

| Entity | Table | Notable Fields |
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

### Cascade & Lifecycle Management

| Parent | Cascaded Children | orphanRemoval |
|---|---|---|
| `Board` | `BoardColumn` | Yes |
| `BoardColumn` | `Task` | Yes |
| `Task` | `TaskChecklistItem`, `Attachment`, `Comment` | Yes |
| `TaskType` | `TaskTypeColumn`, `TaskTypeTransitionRule` | Yes |

`orphanRemoval = true` ensures that removing a child from its parent collection in Java causes the corresponding database row to be deleted automatically — no explicit delete query is needed.

### Enumerations

| Enum | Values |
|---|---|
| `Role` | `ROLE_USER`, `ROLE_ADMIN`, `ROLE_SUPER_ADMIN` |
| `Priority` | `LOW`, `MEDIUM`, `HIGH` |
| `TransitionRuleType` | `CHECKLIST_REQUIRED`, `ATTACHMENT_REQUIRED` |

---

## 5. Workflow Engine — Transition Guards

### Mechanism

When a client sends `PATCH /api/tasks/{taskId}/move`, the service layer evaluates all transition rules associated with the task's `TaskType` before permitting the column change. The guard runs entirely on the server — the frontend has no ability to skip or override it.

Evaluation sequence in `TaskService.moveTask()`:

```
1. Resolve the task and its TaskType
2. Collect all rules whose targetColumnTitle matches the destination column
   (matched by column ID → TaskTypeColumn title → normalizeColumnName() fuzzy match)
3. Optionally filter rules by sourceColumnTitle if the rule specifies a source
4. For each matched rule:
     CHECKLIST_REQUIRED  →  all TaskChecklistItems must have isCompleted = true
     ATTACHMENT_REQUIRED →  task must have at least one Attachment record
5. If any rule is violated → throw BusinessException (mapped to 400 Bad Request)
6. Otherwise → update task.column, recalculate positions, persist
```

### Turkish Character Normalization

Rule column titles are compared using `normalizeColumnName()`, which folds Turkish locale diacritics to their ASCII base characters before string comparison:

```
ş → s   ç → c   ğ → g   ı → i   ö → o   ü → u
```

This allows rules created against titles containing Turkish characters to match board columns regardless of minor spelling differences.

### Rule Configuration Example

A Task Type with the following rules enforces a progressive verification workflow:

| Target Column | Rule Type | Enforcement |
|---|---|---|
| `In Testing` | `CHECKLIST_REQUIRED` | All development checklist items must be completed |
| `Awaiting Approval` | `CHECKLIST_REQUIRED` | All QA checklist items must be completed |
| `Released` | `ATTACHMENT_REQUIRED` | At least one file attachment must be present |

---

## 6. Security & Role-Based Access Control

### Authentication

The application uses stateless JWT authentication:

1. Client sends credentials to `POST /api/auth/login`
2. Server validates credentials, issues a signed JWT (HMAC-SHA256)
3. Client includes the token in subsequent requests: `Authorization: Bearer <token>`
4. `JwtAuthenticationFilter` intercepts every request, validates the token, and populates the Spring Security context

Token lifetime defaults to 24 hours (`JWT_EXPIRATION_MS = 86400000`).

### Roles

| Role | Description |
|---|---|
| `ROLE_SUPER_ADMIN` | Full platform access — manage organizations, all users, all boards and task types |
| `ROLE_ADMIN` | Manage boards and task types within their organization |
| `ROLE_USER` | Create and update tasks, add comments, upload attachments; read-only on process-critical fields |

### Endpoint-Level Authorization (`@PreAuthorize`)

| Endpoint | Minimum Required Role |
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

### Frontend UI Access Control

The React application derives RBAC state from the decoded JWT token via `useAuth()`:

- **Process fields in Task Detail** (`taskType`, `reporter`, `dueDate`, `testDueDate`, `targetEnvironment`) — rendered as disabled, read-only components for `ROLE_USER`
- **Board delete action** — hidden for `ROLE_USER`
- **Task Type management panel** — hidden for `ROLE_USER`

---

## 7. REST API Design

### Design Principles

**Hierarchical routing** is used for resources that are always accessed in the context of a parent:

```
/boards/{boardId}/columns/{columnId}/tasks/{taskId}
```

**Flat routing** shortcuts are provided for operations that cross parent boundaries (e.g., moving a task between columns) or where the parent context is not required:

```
PATCH /tasks/{taskId}/move
PUT   /tasks/{taskId}
```

**HTTP status codes** follow REST conventions:
- `200 OK` — successful read or update
- `201 Created` — resource successfully created (includes `Location`-equivalent body)
- `204 No Content` — successful delete or member assignment
- `400 Bad Request` — validation failure or transition rule violation (`BusinessException`)
- `401 Unauthorized` — missing or invalid JWT
- `403 Forbidden` — insufficient role
- `404 Not Found` — resource does not exist

**PATCH** is used for partial, semantic state changes that do not replace the full resource:
- `PATCH /tasks/{taskId}/move` — column transition with position recalculation
- `PATCH /tasks/{taskId}/checklists/{itemId}/toggle` — single boolean flip

---

### Base URL

```
http://localhost:8080/api
```

All endpoints except `/auth/*` and `GET /organizations` require:

```
Authorization: Bearer <JWT>
```

---

### Authentication

| Method | Path | Request Body | Response |
|---|---|---|---|
| `POST` | `/auth/register` | `{ username, email, password, organizationId? }` | `201` + `AuthResponse` |
| `POST` | `/auth/login` | `{ username, password }` | `200` + `AuthResponse` |

---

### Users

| Method | Path | Response |
|---|---|---|
| `GET` | `/users` | `200` + `UserSummaryDto[]` |

---

### Organizations

| Method | Path | Required Role | Response |
|---|---|---|---|
| `GET` | `/organizations` | None (public) | `200` + `OrganizationDto[]` |
| `POST` | `/organizations` | `SUPER_ADMIN` | `201` + `OrganizationDto` |
| `DELETE` | `/organizations/{id}` | `SUPER_ADMIN` | `204` |
| `GET` | `/organizations/{orgId}/members` | Authenticated | `200` + `UserSummaryDto[]` |
| `POST` | `/organizations/{orgId}/members/existing` | `SUPER_ADMIN` | `204` |
| `POST` | `/organizations/{orgId}/members/new` | `SUPER_ADMIN` | `201` + `UserSummaryDto` |
| `DELETE` | `/organizations/{orgId}/members/{userId}` | `SUPER_ADMIN` | `204` |

---

### Boards

| Method | Path | Required Role | Response |
|---|---|---|---|
| `GET` | `/boards` | Authenticated | `200` + `BoardResponse[]` |
| `POST` | `/boards` | Authenticated | `201` + `BoardResponse` |
| `GET` | `/boards/{id}` | Authenticated | `200` + `BoardResponse` |
| `PUT` | `/boards/{id}` | Authenticated | `200` + `BoardResponse` |
| `DELETE` | `/boards/{id}` | `ADMIN` | `204` |

---

### Board Columns

| Method | Path | Description |
|---|---|---|
| `GET` | `/boards/{boardId}/columns` | List columns with tasks |
| `POST` | `/boards/{boardId}/columns` | Create column |
| `GET` | `/boards/{boardId}/columns/{columnId}` | Get column |
| `PUT` | `/boards/{boardId}/columns/{columnId}` | Rename column |
| `DELETE` | `/boards/{boardId}/columns/{columnId}` | Delete column and all child tasks |
| `PATCH` | `/boards/{boardId}/columns/{columnId}/reorder` | Change column position — body: `{ "newPosition": <int> }` |

---

### Tasks

| Method | Path | Description |
|---|---|---|
| `GET` | `/boards/{boardId}/columns/{columnId}/tasks` | List tasks in column |
| `POST` | `/boards/{boardId}/columns/{columnId}/tasks` | Create task |
| `GET` | `/boards/{boardId}/columns/{columnId}/tasks/{taskId}` | Get task detail |
| `PUT` | `/boards/{boardId}/columns/{columnId}/tasks/{taskId}` | Update task fields |
| `PUT` | `/tasks/{taskId}` | Update task (column-context-free shortcut) |
| `DELETE` | `/boards/{boardId}/columns/{columnId}/tasks/{taskId}` | Delete task |
| `PATCH` | `/tasks/{taskId}/move` | Move task across columns, enforcing transition rules |

Move request body:

```json
{
  "targetColumnId": 12,
  "newPosition": 0
}
```

---

### Checklist Items

| Method | Path | Description |
|---|---|---|
| `POST` | `/tasks/{taskId}/checklists` | Add checklist item |
| `PATCH` | `/tasks/{taskId}/checklists/{itemId}/toggle` | Toggle `isCompleted` |
| `PUT` | `/tasks/{taskId}/checklists/{itemId}` | Update item content |
| `DELETE` | `/tasks/{taskId}/checklists/{itemId}` | Delete item |

---

### Comments

| Method | Path | Description |
|---|---|---|
| `GET` | `/tasks/{taskId}/comments` | List comments (ascending by `createdAt`) |
| `POST` | `/tasks/{taskId}/comments` | Add comment (author resolved from JWT) |
| `DELETE` | `/tasks/{taskId}/comments/{commentId}` | Delete comment |

---

### Attachments

| Method | Path | Description |
|---|---|---|
| `GET` | `/tasks/{taskId}/attachments` | List attachments |
| `POST` | `/tasks/{taskId}/attachments` | Upload file — `multipart/form-data`, field name: `file`, max 25 MB |
| `GET` | `/tasks/{taskId}/attachments/{attachmentId}/download` | Stream file with correct `Content-Type` |
| `DELETE` | `/tasks/{taskId}/attachments/{attachmentId}` | Delete attachment |

---

### Task Types

| Method | Path | Required Role | Description |
|---|---|---|---|
| `GET` | `/task-types` | Authenticated | List task types; optional filter `?organizationId=` |
| `GET` | `/task-types/{id}` | Authenticated | Get task type detail |
| `POST` | `/task-types` | `ADMIN` | Create task type |
| `PUT` | `/task-types/{id}` | `ADMIN` | Update task type |
| `DELETE` | `/task-types/{id}` | `ADMIN` | Delete task type |
| `POST` | `/task-types/{id}/rules` | `ADMIN` | Add transition rule |
| `DELETE` | `/task-types/{id}/rules/{ruleId}` | `ADMIN` | Remove transition rule |

---

## 8. Setup & Running

### Prerequisites

- Docker Desktop v24+ with Docker Compose v2 (`docker compose` — note: no hyphen)
- No local Java or Node.js installation required when using Docker

### Docker Compose (Recommended)

```bash
# Clone the repository
git clone <repository-url>
cd kanban-task-management

# Optional: override default environment variables
cp .env.example .env
# Edit .env as needed (JWT secret, DB credentials, etc.)

# Build and start all services
docker compose up --build -d

# Monitor startup logs
docker compose logs -f

# Stop containers (data volume preserved)
docker compose down

# Stop containers and delete all persistent data
docker compose down -v
```

Service availability after a successful start:

| Service | Address |
|---|---|
| Frontend | http://localhost |
| Backend API | http://localhost:8080/api |
| PostgreSQL | localhost:5432 (host-only; not exposed externally) |

The first build takes approximately 2–4 minutes. Subsequent `docker compose up` commands use the image cache and start within seconds.

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DB_HOST` | `postgres` | PostgreSQL hostname (Docker service name) |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_NAME` | `kanban_db` | Database name |
| `DB_USER` | `kanban_user` | Database username |
| `DB_PASS` | `kanban_pass` | Database password |
| `JWT_SECRET` | *(bundled base64 key)* | HMAC-SHA256 signing secret — must be replaced before production use |
| `JWT_EXPIRATION_MS` | `86400000` | Token validity period in milliseconds (default: 24 hours) |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:3000` | Allowed CORS origins for local development |
| `SERVER_PORT` | `8080` | Backend HTTP listen port |
| `UPLOAD_DIR` | `uploads` | File system directory for attachment storage |

**Production hardening checklist:**
- Generate a unique JWT secret: `openssl rand -base64 64`
- Set `spring.jpa.hibernate.ddl-auto: validate`
- Ensure port 5432 is not bound to a public interface
- Use TLS termination at the load balancer or Nginx layer

### Local Development (Without Docker)

**Backend** — requires a locally running PostgreSQL instance with the default credentials:

```bash
cd backend
mvn spring-boot:run
# API available at http://localhost:8080/api
```

**Frontend** — Vite dev server with HMR, proxies `/api` to `http://localhost:8080`:

```bash
cd frontend
npm install
npm run dev
# UI available at http://localhost:5173
```

---

## Project Structure

```
kanban-task-management/
├── backend/
│   ├── src/main/java/com/kanban/
│   │   ├── config/          SecurityConfig, DataInitializer, file upload configuration
│   │   ├── controller/      9 REST controllers (Auth, Board, Column, Task, TaskType,
│   │   │                    Organization, User, Attachment, Comment)
│   │   ├── dto/             Request and response DTOs per domain (auth, board, column,
│   │   │                    task, tasktype, organization, user, attachment, comment)
│   │   ├── entity/          JPA entity classes
│   │   ├── repository/      Spring Data JPA repositories with custom JPQL
│   │   ├── security/        JwtFilter, JwtUtil, UserDetailsServiceImpl
│   │   └── service/         Business logic — BoardService, TaskService,
│   │                        TaskTypeService, OrganizationService, etc.
│   ├── src/main/resources/
│   │   └── application.yml  Full application configuration
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── api/             Axios client modules per domain
│   │   ├── components/      Reusable React components
│   │   ├── context/         AuthContext — JWT decode, currentUser, role helpers
│   │   ├── pages/           Route-level page components (BoardsPage, BoardDetailPage, etc.)
│   │   └── types/           TypeScript interfaces aligned with backend DTOs
│   └── Dockerfile
├── docker-compose.yml
├── .env.example
└── README.md
```
