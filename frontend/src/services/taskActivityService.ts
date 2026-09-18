import api from '@/api/axiosClient';
import type { TaskActivityDto } from '@/types';

export const taskActivityService = {
  /**
   * Returns all activity logs for a task in reverse chronological order (newest first).
   */
  getActivities: (taskId: number): Promise<TaskActivityDto[]> =>
    api.get<TaskActivityDto[]>(`/tasks/${taskId}/activities`).then((r) => r.data),
};

export default taskActivityService;
