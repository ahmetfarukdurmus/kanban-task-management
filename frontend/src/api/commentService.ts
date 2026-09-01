import api from './axiosClient';
import type { CommentDto } from '@/types';

export const commentService = {
  /**
   * Returns all comments for a task in chronological order (oldest first).
   */
  getComments: (taskId: number): Promise<CommentDto[]> =>
    api.get<CommentDto[]>(`/tasks/${taskId}/comments`).then((r) => r.data),

  /**
   * Posts a new comment on a task.
   * The author is determined by the JWT token on the server side.
   */
  addComment: (taskId: number, content: string): Promise<CommentDto> =>
    api.post<CommentDto>(`/tasks/${taskId}/comments`, { content }).then((r) => r.data),
};
