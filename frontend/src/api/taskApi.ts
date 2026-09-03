import api from './axiosClient';
import type { MoveTaskRequest, TaskRequest, TaskResponse } from '@/types';

const base = (boardId: number, columnId: number) =>
  `/boards/${boardId}/columns/${columnId}/tasks`;

export const taskApi = {
  getAll: (boardId: number, columnId: number): Promise<TaskResponse[]> =>
    api.get<TaskResponse[]>(base(boardId, columnId)).then((r) => r.data),

  getOne: (boardId: number, columnId: number, taskId: number): Promise<TaskResponse> =>
    api.get<TaskResponse>(`${base(boardId, columnId)}/${taskId}`).then((r) => r.data),

  getTask: (boardId: number, columnId: number, taskId: number): Promise<TaskResponse> =>
    api.get<TaskResponse>(`${base(boardId, columnId)}/${taskId}`).then((r) => r.data),

  create: (boardId: number, columnId: number, data: TaskRequest): Promise<TaskResponse> =>
    api.post<TaskResponse>(base(boardId, columnId), data).then((r) => r.data),

  update: (boardId: number, columnId: number, taskId: number, data: TaskRequest): Promise<TaskResponse> =>
    api.put<TaskResponse>(`${base(boardId, columnId)}/${taskId}`, data).then((r) => r.data),

  updateDirect: (taskId: number, data: TaskRequest): Promise<TaskResponse> =>
    api.put<TaskResponse>(`/tasks/${taskId}`, data).then((r) => r.data),

  remove: (boardId: number, columnId: number, taskId: number): Promise<void> =>
    api.delete(`${base(boardId, columnId)}/${taskId}`).then(() => undefined),

  /**
   * Unified move endpoint – handles both:
   * - Same-column reorder (targetColumnId === current columnId)
   * - Cross-column move   (targetColumnId !== current columnId)
   */
  move: (taskId: number, data: MoveTaskRequest): Promise<TaskResponse> =>
    api.patch<TaskResponse>(`/tasks/${taskId}/move`, data).then((r) => r.data),
};

export default taskApi;
