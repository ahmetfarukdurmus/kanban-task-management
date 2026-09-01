package com.kanban.dto.attachment;

import java.time.Instant;

/**
 * Read-only view of a {@link com.kanban.entity.Attachment}.
 *
 * @param id           attachment identifier
 * @param fileName     original file name
 * @param fileType     MIME type (e.g. {@code image/png})
 * @param fileUrl      server-relative URL to download the file
 * @param uploadedAt   ISO-8601 upload timestamp
 * @param uploadedById database id of the uploader
 * @param uploadedByName username of the uploader
 * @param taskId       task this attachment belongs to
 */
public record AttachmentDto(
        Long    id,
        String  fileName,
        String  fileType,
        String  fileUrl,
        Instant uploadedAt,
        Long    uploadedById,
        String  uploadedByName,
        Long    taskId
) {}
