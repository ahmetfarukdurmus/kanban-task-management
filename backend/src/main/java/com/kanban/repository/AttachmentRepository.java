package com.kanban.repository;

import com.kanban.entity.Attachment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AttachmentRepository extends JpaRepository<Attachment, Long> {

    /**
     * Returns all attachments for the given task, most recently uploaded first.
     *
     * @param taskId the task's primary key
     * @return ordered list of attachments
     */
    List<Attachment> findAllByTaskIdOrderByUploadedAtDesc(Long taskId);
}
