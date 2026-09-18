import api from '@/api/axiosClient';
import type { GlobalSearchResponse } from '@/types';

export const searchService = {
  /**
   * Performs global search across tasks and boards.
   */
  search: (query: string): Promise<GlobalSearchResponse> =>
    api.get<GlobalSearchResponse>('/search', { params: { q: query } }).then((r) => r.data),
};

export default searchService;
