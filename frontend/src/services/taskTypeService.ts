import api from '@/api/axiosClient';
import type { CreateTaskTypeRequest, TaskTypeDto, TaskTypeTransitionRuleDto, CreateTransitionRuleRequest, UpdateTaskTypeRequest } from '@/types';

export const taskTypeService = {
  getAll: (organizationId?: number): Promise<TaskTypeDto[]> =>
    api.get<TaskTypeDto[]>('/task-types', { params: organizationId ? { organizationId } : undefined })
       .then((r) => r.data),

  getById: (id: number): Promise<TaskTypeDto> =>
    api.get<TaskTypeDto>(`/task-types/${id}`).then((r) => r.data),

  create: (data: CreateTaskTypeRequest): Promise<TaskTypeDto> =>
    api.post<TaskTypeDto>('/task-types', data).then((r) => r.data),

  update: (id: number, data: UpdateTaskTypeRequest): Promise<TaskTypeDto> =>
    api.put<TaskTypeDto>(`/task-types/${id}`, data).then((r) => r.data),

  remove: (id: number): Promise<void> =>
    api.delete(`/task-types/${id}`).then(() => undefined),

  addRule: (taskTypeId: number, data: CreateTransitionRuleRequest): Promise<TaskTypeTransitionRuleDto> =>
    api.post<TaskTypeTransitionRuleDto>(`/task-types/${taskTypeId}/rules`, data).then((r) => r.data),

  removeRule: (taskTypeId: number, ruleId: number): Promise<void> =>
    api.delete(`/task-types/${taskTypeId}/rules/${ruleId}`).then(() => undefined),
};

export default taskTypeService;
