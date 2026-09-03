/* ── Auth ──────────────────────────────────────────────────────────── */
export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  organizationId?: number;
  role?: string;
}

export interface AuthResponse {
  token: string;
  id: number;
  username: string;
  email: string;
  /** e.g. "ROLE_SUPER_ADMIN", "ROLE_ADMIN" or "ROLE_USER" */
  role: string;
  organizationId?: number | null;
  organizationName?: string | null;
}

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  role: string;
  organizationId?: number | null;
  organizationName?: string | null;
}

/* ── Organization ──────────────────────────────────────────────────── */
export interface OrganizationDto {
  id: number;
  name: string;
  description?: string;
}

export interface NewAdminDto {
  username: string;
  email?: string;
  password?: string;
}

export interface NewUserDto {
  username: string;
  email?: string;
  password?: string;
}

export interface CreateOrganizationRequest {
  name: string;
  description?: string;
  adminUserId?: number | null;
  newAdmin?: NewAdminDto | null;
  initialUserId?: number | null;
  memberUserIds?: number[] | null;
  newUser?: NewUserDto | null;
}

export interface AssignMembersRequest {
  userIds: number[];
}

/* ── Board ─────────────────────────────────────────────────────────── */
export type BoardType = 'STANDARD' | 'INTEGRATION' | 'QA_TEST';

export interface BoardRequest {
  name: string;
  description?: string;
  organizationId?: number;
  boardType?: BoardType;
}

export interface BoardResponse {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
  columns: ColumnResponse[];
  organizationId?: number | null;
  organizationName?: string | null;
  boardType?: BoardType;
}

/* ── Column ────────────────────────────────────────────────────────── */
export interface ColumnRequest {
  title: string;
}

export interface ColumnReorderRequest {
  newPosition: number;
}

export interface ColumnResponse {
  id: number;
  title: string;
  position: number;
  boardId: number;
  tasks: TaskResponse[];
}

/* ── Custom Field ──────────────────────────────────────────────────── */
export type CustomFieldType = 'TEXT' | 'NUMBER' | 'DATE';

export interface CustomFieldDto {
  id?: number;
  fieldName: string;
  fieldType: CustomFieldType;
  fieldValue: string;
}

/* ── Task ──────────────────────────────────────────────────────────── */
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH';

export interface TaskRequest {
  title: string;
  description?: string;
  priority?: Priority;
  dueDate?: string;   // ISO-8601 date string (YYYY-MM-DD)
  assignee?: string;
  customFields?: CustomFieldDto[];
}

export interface MoveTaskRequest {
  targetColumnId: number;
  targetPosition: number;
}

export interface TaskResponse {
  id: number;
  title: string;
  description: string | null;
  priority: Priority;
  dueDate: string | null;
  assignee: string | null;
  position: number;
  columnId: number;
  customFields?: CustomFieldDto[];
}

/* ── User ──────────────────────────────────────────────────────────── */
export interface UserSummary {
  id: number;
  username: string;
  email: string;
  role?: string;
  organizationId?: number | null;
  organizationName?: string | null;
  createdAt?: string;
}

/* ── Comment ───────────────────────────────────────────────────────── */
export interface CommentDto {
  id: number;
  content: string;
  authorId: number;
  authorName: string;
  taskId: number;
  createdAt: string;
}

/* ── Attachment ────────────────────────────────────────────────────── */
export interface AttachmentDto {
  id: number;
  fileName: string;
  fileType: string;
  fileUrl: string;
  uploadedAt: string;
  uploadedById: number;
  uploadedByName: string;
  taskId: number;
}

/* ── API Errors ────────────────────────────────────────────────────── */
export interface ApiError {
  title: string;
  detail: string;
  status: number;
}
