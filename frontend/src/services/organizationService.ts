import api from '@/api/axiosClient';
import type { CreateOrganizationRequest, OrganizationDto } from '@/types';

export const organizationService = {
  /**
   * Returns all available organizations (public endpoint for registration dropdown).
   */
  getPublic: (): Promise<OrganizationDto[]> =>
    api.get<OrganizationDto[]>('/organizations/public').then((r) => r.data),

  /**
   * Returns all available organizations.
   */
  getAll: (): Promise<OrganizationDto[]> =>
    api.get<OrganizationDto[]>('/organizations').then((r) => r.data),

  /**
   * Creates a new organization with optional admin assignment (Super Admin only).
   */
  create: (data: CreateOrganizationRequest): Promise<OrganizationDto> =>
    api.post<OrganizationDto>('/organizations', data).then((r) => r.data),
};

export default organizationService;
