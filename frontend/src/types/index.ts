/* ── Auth ──────────────────────────────────────────────────────────── */
export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  id: number;
  username: string;
  email: string;
  /** e.g. "ROLE_ADMIN" or "ROLE_USER" */
  role: string;
}

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  role: string;
}

/* ── Board ─────────────────────────────────────────────────────────── */
export interface BoardRequest {
  name: string;
  description?: string;
}

export interface BoardResponse {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
  columns: ColumnResponse[];
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

/* ── Task ──────────────────────────────────────────────────────────── */
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH';

export interface TaskRequest {
  title: string;
  description?: string;
  priority?: Priority;
  dueDate?: string;   // ISO-8601 date string (YYYY-MM-DD)
  assignee?: string;
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
}

/* ── User ──────────────────────────────────────────────────────────── */
export interface UserSummary {
  id: number;
  username: string;
  email: string;
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
