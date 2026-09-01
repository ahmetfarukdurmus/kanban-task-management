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
   * Sends a multipart/form-data request with a 'file' field and automatic Bearer auth.
   */
  uploadAttachment: (taskId: number, file: File): Promise<AttachmentDto> => {
    const formData = new FormData();
    formData.append('file', file);
    return api
      .post<AttachmentDto>(`/tasks/${taskId}/attachments`, formData, {
        headers: {
          'Content-Type': undefined,
        },
      })
      .then((r) => r.data);
  },

  /**
   * Securely downloads an attachment with JWT Authentication and triggers file download.
   */
  downloadAttachment: async (taskId: number, attachmentId: number, fileName: string): Promise<void> => {
    const response = await api.get(`/tasks/${taskId}/attachments/${attachmentId}/download`, {
      responseType: 'blob',
    });
    const blob = new Blob([response.data]);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  /**
   * Fetches an attachment as a Blob Object URL for authenticated in-browser preview.
   */
  getAttachmentBlobUrl: async (taskId: number, attachmentId: number): Promise<string> => {
    const response = await api.get(`/tasks/${taskId}/attachments/${attachmentId}/download`, {
      responseType: 'blob',
    });
    return window.URL.createObjectURL(response.data);
  },
};

export default attachmentService;
