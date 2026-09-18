import api from '@/api/axiosClient';
import type { GlobalSearchResponse, TaskSearchDto } from '@/types';

export const searchService = {
  /**
   * Performs global search across tasks and boards.
   */
  search: (query: string): Promise<GlobalSearchResponse> =>
    api.get<GlobalSearchResponse>('/search', { params: { q: query } }).then((r) => r.data),

  /**
   * Direct task search by key or title.
   */
  searchTasks: (query: string): Promise<TaskSearchDto[]> =>
    api.get<TaskSearchDto[]>('/tasks/search', { params: { q: query } }).then((r) => r.data),
};

export default searchService;
