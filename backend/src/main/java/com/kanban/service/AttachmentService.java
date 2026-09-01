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
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.UUID;

/**
 * Business logic for the Attachment resource.
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
     * Returns the attachment entity for downloading.
     */
    @Transactional(readOnly = true)
    public Attachment getAttachmentEntity(Long taskId, Long attachmentId) {
        requireTask(taskId);
        return attachmentRepository.findById(attachmentId)
                .filter(a -> a.getTask().getId().equals(taskId))
                .orElseThrow(() -> ResourceNotFoundException.of("Attachment", attachmentId));
    }

    /**
     * Loads the attachment file from disk as a Spring Resource.
     */
    public Resource loadFileAsResource(Attachment attachment) {
        try {
            Path uploadPath = Paths.get(uploadDir).toAbsolutePath().normalize();
            String fileName = attachment.getFileUrl()
                    .replace("/api/uploads/", "")
                    .replace("/uploads/", "")
                    .replace("uploads/", "");
            Path filePath = uploadPath.resolve(fileName).normalize();
            Resource resource = new UrlResource(filePath.toUri());
            if (resource.exists() && resource.isReadable()) {
                return resource;
            } else {
                throw new ResourceNotFoundException("File not found on server disk: " + attachment.getFileName());
            }
        } catch (MalformedURLException ex) {
            throw new ResourceNotFoundException("Invalid file path: " + attachment.getFileName());
        }
    }

    /**
     * Persists an uploaded file and records the attachment in the database.
     */
    public AttachmentDto uploadAttachment(Long taskId, MultipartFile file) {
        Task task   = requireTask(taskId);
        User uploader = securityUtils.getCurrentUser();

        // Build a unique, safe filename
        String originalName = file.getOriginalFilename() != null && !file.getOriginalFilename().isBlank()
                ? file.getOriginalFilename() : "file_" + System.currentTimeMillis();
        String safeName     = UUID.randomUUID() + "_" + originalName.replaceAll("[^a-zA-Z0-9._-]", "_");

        // Write the file to disk
        try {
            Path uploadPath = Paths.get(uploadDir).toAbsolutePath().normalize();
            Files.createDirectories(uploadPath);
            Path targetPath = uploadPath.resolve(safeName);
            Files.copy(file.getInputStream(), targetPath, StandardCopyOption.REPLACE_EXISTING);
            log.info("Attachment file saved at: {}", targetPath);
        } catch (IOException ex) {
            log.error("Failed to store file '{}': {}", originalName, ex.getMessage());
            throw new RuntimeException("Could not store file. Please try again.", ex);
        }

        // Record the attachment in the database with /api/uploads/ prefix
        Attachment attachment = Attachment.builder()
                .fileName(originalName)
                .fileType(file.getContentType() != null ? file.getContentType() : "application/octet-stream")
                .fileUrl("/api/uploads/" + safeName)
                .task(task)
                .uploadedBy(uploader)
                .build();

        Attachment saved = attachmentRepository.save(attachment);
        attachmentRepository.flush();
        return toDto(saved);
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
