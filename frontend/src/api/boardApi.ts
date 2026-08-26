import api from './axiosClient';
import type { BoardRequest, BoardResponse } from '@/types';

export const boardApi = {
  /** GET /boards – list of the current user's boards (no column data) */
  getAll: (): Promise<BoardResponse[]> =>
    api.get<BoardResponse[]>('/boards').then((r) => r.data),

  /** GET /boards/:id – full board with columns and tasks */
  getOne: (id: number): Promise<BoardResponse> =>
    api.get<BoardResponse>(`/boards/${id}`).then((r) => r.data),

  create: (data: BoardRequest): Promise<BoardResponse> =>
    api.post<BoardResponse>('/boards', data).then((r) => r.data),

  update: (id: number, data: BoardRequest): Promise<BoardResponse> =>
    api.put<BoardResponse>(`/boards/${id}`, data).then((r) => r.data),

  remove: (id: number): Promise<void> =>
    api.delete(`/boards/${id}`).then(() => undefined),
};
