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

export interface CreateNewMemberRequest {
  username: string;
  email?: string;
  password?: string;
  role?: string;
}

/* ── Board ─────────────────────────────────────────────────────────── */
export type BoardType = 'STANDARD' | 'INTEGRATION' | 'QA_TEST';

export interface BoardRequest {
  name: string;
  description?: string;
  organizationId?: number;
  boardType?: BoardType;
  taskTypeId?: number;
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
  taskTypeId?: number | null;
  taskTypeName?: string | null;
  taskTypeColor?: string | null;
}

/* ── Column ────────────────────────────────────────────────────────── */
export interface ColumnRequest {
  title: string;
  colorHex?: string;
}

export interface ColumnReorderRequest {
  newPosition: number;
}

export interface ColumnResponse {
  id: number;
  title: string;
  position: number;
  boardId: number;
  colorHex?: string | null;
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

/* ── Dynamic Task Types & Transition Rules ────────────────────────── */
export type TransitionRuleType = 'CHECKLIST_REQUIRED' | 'ATTACHMENT_REQUIRED';

export interface TaskTypeColumnDto {
  id: number;
  taskTypeId?: number;
  title: string;
  colorHex?: string | null;
  position: number;
}

export interface CreateTaskTypeColumnRequest {
  id?: number;
  title: string;
  colorHex?: string;
  position?: number;
}

export interface TaskTypeTransitionRuleDto {
  id: number;
  taskTypeId: number;
  sourceColumnId?: number | null;
  sourceColumnTitle?: string | null;
  targetColumnId: number;
  targetColumnTitle: string;
  ruleType: TransitionRuleType;
  description?: string | null;
}

export interface CreateTransitionRuleRequest {
  sourceColumnId?: number | null;
  sourceColumnTitle?: string;
  targetColumnId?: number;
  targetColumnTitle?: string;
  ruleType: TransitionRuleType;
  description?: string;
}

export interface TaskTypeDto {
  id: number;
  name: string;
  colorHex?: string | null;
  requireTestDate?: boolean;
  requireEnvironment?: boolean;
  organizationId?: number | null;
  organizationName?: string | null;
  columns?: TaskTypeColumnDto[];
  rules: TaskTypeTransitionRuleDto[];
  createdAt?: string;
}

export interface CreateTaskTypeRequest {
  name: string;
  colorHex?: string;
  requireTestDate?: boolean;
  requireEnvironment?: boolean;
  organizationId?: number | null;
  columns?: CreateTaskTypeColumnRequest[];
  rules?: CreateTransitionRuleRequest[];
}

export interface UpdateTaskTypeRequest {
  name: string;
  colorHex?: string;
  requireTestDate?: boolean;
  requireEnvironment?: boolean;
  columns?: CreateTaskTypeColumnRequest[];
  rules?: CreateTransitionRuleRequest[];
}

/* ── Task Checklist Items ─────────────────────────────────────────── */
export interface TaskChecklistItemDto {
  id: number;
  taskId: number;
  title: string;
  isCompleted: boolean;
  requiredForColumnId?: number | null;
  createdAt?: string;
}

export interface CreateChecklistItemRequest {
  title: string;
  requiredForColumnId?: number | null;
}

export interface UpdateChecklistItemRequest {
  title?: string;
  isCompleted?: boolean;
  requiredForColumnId?: number | null;
}

/* ── Task ──────────────────────────────────────────────────────────── */
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH';

export interface TaskRequest {
  title: string;
  description?: string;
  priority?: Priority;
  dueDate?: string;   // ISO-8601 date string (YYYY-MM-DD)
  testDueDate?: string | null; // ISO-8601 date string (YYYY-MM-DD)
  targetEnvironment?: string | null; // DEV, TEST, STAGING, PROD
  estimatedHours?: number | null;
  reporterId?: number | null;
  reporter?: string | null;
  assignee?: string;
  assigneeIds?: number[];
  taskTypeId?: number | null;
  customFields?: CustomFieldDto[];
  checklistItems?: CreateChecklistItemRequest[];
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
  testDueDate?: string | null;
  targetEnvironment?: string | null;
  estimatedHours?: number | null;
  reporterId?: number | null;
  reporterName?: string | null;
  reporter?: UserSummary | null;
  assignee: string | null;
  position: number;
  columnId: number;
  customFields?: CustomFieldDto[];
  taskTypeId?: number | null;
  taskTypeName?: string | null;
  taskTypeColor?: string | null;
  assigneeIds?: number[];
  assignees?: UserSummary[];
  checklistItems?: TaskChecklistItemDto[];
}

/* ── User ──────────────────────────────────────────────────────────── */
export interface UserSummary {
  id: number;
  username: string;
  email: string;
  role?: string;
  organizationId?: number | null;
  organizationName?: string | null;
  organizationIds?: number[];
  organizationNames?: string[];
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
