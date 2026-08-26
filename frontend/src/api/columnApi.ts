import api from './axiosClient';
import type { ColumnRequest, ColumnReorderRequest, ColumnResponse } from '@/types';

const base = (boardId: number) => `/boards/${boardId}/columns`;

export const columnApi = {
  getAll: (boardId: number): Promise<ColumnResponse[]> =>
    api.get<ColumnResponse[]>(base(boardId)).then((r) => r.data),

  create: (boardId: number, data: ColumnRequest): Promise<ColumnResponse> =>
    api.post<ColumnResponse>(base(boardId), data).then((r) => r.data),

  update: (boardId: number, columnId: number, data: ColumnRequest): Promise<ColumnResponse> =>
    api.put<ColumnResponse>(`${base(boardId)}/${columnId}`, data).then((r) => r.data),

  remove: (boardId: number, columnId: number): Promise<void> =>
    api.delete(`${base(boardId)}/${columnId}`).then(() => undefined),

  reorder: (boardId: number, columnId: number, data: ColumnReorderRequest): Promise<ColumnResponse> =>
    api.patch<ColumnResponse>(`${base(boardId)}/${columnId}/reorder`, data).then((r) => r.data),
};
