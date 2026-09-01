package com.kanban.controller;

import com.kanban.dto.attachment.AttachmentDto;
import com.kanban.entity.Attachment;
import com.kanban.service.AttachmentService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

/**
 * REST controller for Attachment resources, nested under a Task.
 *
 * <pre>
 * GET  /api/tasks/{taskId}/attachments                             – list attachments
 * POST /api/tasks/{taskId}/attachments  (multipart)                – upload a file
 * GET  /api/tasks/{taskId}/attachments/{attachmentId}/download     – download/stream file
 * </pre>
 */
@RestController
@RequestMapping("/tasks/{taskId}/attachments")
@RequiredArgsConstructor
public class AttachmentController {

    private final AttachmentService attachmentService;

    @GetMapping
    public ResponseEntity<List<AttachmentDto>> listAttachments(@PathVariable Long taskId) {
        return ResponseEntity.ok(attachmentService.getAttachments(taskId));
    }

    /**
     * Uploads a file and attaches it to the specified task.
     */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<AttachmentDto> uploadAttachment(
            @PathVariable Long taskId,
            @RequestParam("file") MultipartFile file) {

        if (file.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.status(HttpStatus.CREATED)
                             .body(attachmentService.uploadAttachment(taskId, file));
    }

    /**
     * Downloads or displays an attachment file directly.
     */
    @GetMapping("/{attachmentId}/download")
    public ResponseEntity<Resource> downloadAttachment(
            @PathVariable Long taskId,
            @PathVariable Long attachmentId) {

        Attachment attachment = attachmentService.getAttachmentEntity(taskId, attachmentId);
        Resource resource = attachmentService.loadFileAsResource(attachment);

        String contentType = attachment.getFileType();
        if (contentType == null || contentType.isBlank()) {
            contentType = "application/octet-stream";
        }

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + attachment.getFileName() + "\"")
                .body(resource);
    }
}
