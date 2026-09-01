package com.kanban.service;

import com.kanban.dto.attachment.AttachmentDto;
import com.kanban.entity.Attachment;
import com.kanban.entity.Task;
import com.kanban.entity.User;
import com.kanban.exception.ResourceNotFoundException;
import com.kanban.repository.AttachmentRepository;
import com.kanban.repository.TaskRepository;
import com.kanban.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.UUID;

/**
 * Business logic for the Attachment resource.
 *
 * <h3>Storage strategy</h3>
 * <p>Files are written to the local directory specified by
 * {@code app.upload.dir} (defaults to {@code uploads/} relative to the
 * working directory).  A UUID prefix is prepended to the original file name
 * to avoid collisions.</p>
 *
 * <p>The server exposes the directory as a static resource under
 * {@code /uploads/**} via Spring's {@code ResourceHttpRequestHandler},
 * configured in {@code WebMvcConfig}.</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class AttachmentService {

    private final AttachmentRepository attachmentRepository;
    private final TaskRepository       taskRepository;
    private final SecurityUtils        securityUtils;

    @Value("${app.upload.dir:uploads}")
    private String uploadDir;

    /**
     * Returns all attachments for the given task, most recently uploaded first.
     *
     * @param taskId task identifier
     * @return list of attachment DTOs
     * @throws ResourceNotFoundException if the task does not exist
     */
    @Transactional(readOnly = true)
    public List<AttachmentDto> getAttachments(Long taskId) {
        requireTask(taskId);
        return attachmentRepository.findAllByTaskIdOrderByUploadedAtDesc(taskId)
                .stream()
                .map(this::toDto)
                .toList();
    }

    /**
     * Persists an uploaded file and records the attachment in the database.
     *
     * @param taskId task identifier
     * @param file   the multipart file from the HTTP request
     * @return the created attachment as a DTO
     * @throws ResourceNotFoundException if the task does not exist
     * @throws RuntimeException          if the file cannot be written to disk
     */
    public AttachmentDto uploadAttachment(Long taskId, MultipartFile file) {
        Task task   = requireTask(taskId);
        User uploader = securityUtils.getCurrentUser();

        // Build a unique, safe filename
        String originalName = file.getOriginalFilename() != null
                ? file.getOriginalFilename() : "unknown";
        String safeName    = UUID.randomUUID() + "_" + originalName.replaceAll("[^a-zA-Z0-9._-]", "_");
        String relativePath = "uploads/" + safeName;

        // Write the file to disk
        try {
            Path uploadPath = Paths.get(uploadDir).toAbsolutePath().normalize();
            Files.createDirectories(uploadPath);
            Path targetPath = uploadPath.resolve(safeName);
            Files.copy(file.getInputStream(), targetPath, StandardCopyOption.REPLACE_EXISTING);
            log.info("File saved: {}", targetPath);
        } catch (IOException ex) {
            log.error("Failed to store file '{}': {}", originalName, ex.getMessage());
            throw new RuntimeException("Could not store file. Please try again.", ex);
        }

        // Record the attachment in the database
        Attachment attachment = Attachment.builder()
                .fileName(originalName)
                .fileType(file.getContentType() != null ? file.getContentType() : "application/octet-stream")
                .fileUrl("/" + relativePath)  // server-relative URL; /uploads/** is served as static resource
                .task(task)
                .uploadedBy(uploader)
                .build();

        return toDto(attachmentRepository.save(attachment));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private Task requireTask(Long taskId) {
        return taskRepository.findById(taskId)
                .orElseThrow(() -> ResourceNotFoundException.of("Task", taskId));
    }

    private AttachmentDto toDto(Attachment a) {
        return new AttachmentDto(
                a.getId(),
                a.getFileName(),
                a.getFileType(),
                a.getFileUrl(),
                a.getUploadedAt(),
                a.getUploadedBy().getId(),
                a.getUploadedBy().getUsername(),
                a.getTask().getId());
    }
}
