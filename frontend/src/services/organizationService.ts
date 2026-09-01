import api from '@/api/axiosClient';
import type { OrganizationDto } from '@/types';

export const organizationService = {
  /**
   * Returns all available organizations (e.g. for registration dropdown).
   */
  getAll: (): Promise<OrganizationDto[]> =>
    api.get<OrganizationDto[]>('/organizations').then((r) => r.data),
};

export default organizationService;
