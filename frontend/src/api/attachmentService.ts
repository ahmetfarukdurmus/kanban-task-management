import api from './axiosClient';
import type { AttachmentDto } from '@/types';

export const attachmentService = {
  /**
   * Returns all attachments for a task (most recently uploaded first).
   */
  getAttachments: (taskId: number): Promise<AttachmentDto[]> =>
    api.get<AttachmentDto[]>(`/tasks/${taskId}/attachments`).then((r) => r.data),

  /**
   * Uploads a file and attaches it to the specified task.
   * Sends a multipart/form-data request with a 'file' field.
   */
  uploadAttachment: (taskId: number, file: File): Promise<AttachmentDto> => {
    const formData = new FormData();
    formData.append('file', file);
    return api
      .post<AttachmentDto>(`/tasks/${taskId}/attachments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },
};
