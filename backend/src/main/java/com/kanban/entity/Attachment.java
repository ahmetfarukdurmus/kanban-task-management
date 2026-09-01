package com.kanban.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * A file or image attached to a {@link Task}.
 *
 * <p>Files are stored in the local {@code uploads/} directory on the server.
 * The {@code fileUrl} field holds the publicly accessible URL path
 * (e.g. {@code /uploads/<uuid>_<originalName>}) that clients can use to
 * download the file directly via the static resource handler.</p>
 */
@Entity
@Table(name = "attachments")
@Getter @Setter @Builder
@NoArgsConstructor @AllArgsConstructor
public class Attachment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Original file name as provided by the client. */
    @Column(nullable = false, length = 255)
    private String fileName;

    /** MIME type of the uploaded file (e.g. {@code image/png}, {@code application/pdf}). */
    @Column(nullable = false, length = 100)
    private String fileType;

    /**
     * Server-relative URL to access the file
     * (e.g. {@code /uploads/550e8400-e29b-41d4-a716-446655440000_report.pdf}).
     */
    @Column(nullable = false)
    private String fileUrl;

    /** Timestamp set automatically at INSERT time. */
    @Column(nullable = false, updatable = false)
    private Instant uploadedAt;

    @PrePersist
    protected void onCreate() {
        uploadedAt = Instant.now();
    }

    /** The task this attachment belongs to. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "task_id", nullable = false,
                foreignKey = @ForeignKey(name = "fk_attachments_task"))
    private Task task;

    /** The user who uploaded this file. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "uploaded_by", nullable = false,
                foreignKey = @ForeignKey(name = "fk_attachments_uploader"))
    private User uploadedBy;
}
