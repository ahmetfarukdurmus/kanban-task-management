import api from '@/api/axiosClient';
import type { UserSummary } from '@/types';

/**
 * Fetches all registered users sorted alphabetically.
 * Used for the assignee selection dropdown.
 */
export const userService = {
  getAll: (): Promise<UserSummary[]> =>
    api.get<UserSummary[]>('/users').then((r) => r.data),
};

export default userService;
