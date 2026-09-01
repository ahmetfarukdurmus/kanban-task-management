package com.kanban.controller;

import com.kanban.dto.attachment.AttachmentDto;
import com.kanban.service.AttachmentService;
import lombok.RequiredArgsConstructor;
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
 * GET  /api/tasks/{taskId}/attachments                  – list attachments
 * POST /api/tasks/{taskId}/attachments  (multipart)     – upload a file
 * </pre>
 *
 * <p>Access policy: any authenticated user (ROLE_USER or ROLE_ADMIN) may
 * upload and view attachments.  This is enforced in {@code SecurityConfig}.</p>
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
     *
     * <p>Use {@code Content-Type: multipart/form-data} with a {@code file} field.
     * Maximum upload size is configured in {@code application.yml}
     * ({@code spring.servlet.multipart.max-file-size}).</p>
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
}
