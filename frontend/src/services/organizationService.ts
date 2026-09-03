import api from '@/api/axiosClient';
import type {
  CreateNewMemberRequest,
  CreateOrganizationRequest,
  OrganizationDto,
  UserSummary,
} from '@/types';

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
   * Deletes an organization and cascades its boards (Super Admin only).
   */
  delete: (id: number): Promise<void> =>
    api.delete<void>(`/organizations/${id}`).then(() => undefined),

  /**
   * Returns all members belonging to an organization.
   */
  getMembers: (orgId: number): Promise<UserSummary[]> =>
    api.get<UserSummary[]>(`/organizations/${orgId}/members`).then((r) => r.data),

  /**
   * Adds existing users to an organization (ManyToMany - Super Admin only).
   */
  addExistingMembers: (orgId: number, userIds: number[]): Promise<void> =>
    api.post<void>(`/organizations/${orgId}/members/existing`, { userIds }).then(() => undefined),

  /**
   * Bulk assigns users to an existing organization (alias / compatibility).
   */
  assignMembers: (organizationId: number, userIds: number[]): Promise<void> =>
    api.post<void>(`/organizations/${organizationId}/members/existing`, { userIds }).then(() => undefined),

  /**
   * Creates a brand new user directly attached to an organization (Super Admin only).
   */
  createNewMember: (orgId: number, data: CreateNewMemberRequest): Promise<UserSummary> =>
    api.post<UserSummary>(`/organizations/${orgId}/members/new`, data).then((r) => r.data),

  /**
   * Removes a user from an organization (Super Admin only).
   */
  removeMember: (orgId: number, userId: number): Promise<void> =>
    api.delete<void>(`/organizations/${orgId}/members/${userId}`).then(() => undefined),
};

export default organizationService;
