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
   * Creates a new organization with optional admin and member assignments (Super Admin only).
   */
  create: (data: CreateOrganizationRequest): Promise<OrganizationDto> =>
    api.post<OrganizationDto>('/organizations', data).then((r) => r.data),

  /**
   * Bulk assigns users to an existing organization (Super Admin only).
   */
  assignMembers: (organizationId: number, userIds: number[]): Promise<void> =>
    api.post<void>(`/organizations/${organizationId}/members`, { userIds }).then(() => undefined),
};

export default organizationService;
