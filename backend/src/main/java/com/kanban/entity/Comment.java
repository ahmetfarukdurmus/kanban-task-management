package com.kanban.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * A comment left by a user on a {@link Task}.
 *
 * <p>Comments are ordered chronologically (ascending {@code createdAt}) by the
 * repository query so the client always receives them in posting order.</p>
 */
@Entity
@Table(name = "comments")
@Getter @Setter @Builder
@NoArgsConstructor @AllArgsConstructor
public class Comment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** The comment body – stored as TEXT to allow rich, multi-line content. */
    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    /** Timestamp set automatically at INSERT time. */
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = Instant.now();
    }

    /** The user who wrote this comment. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "author_id", nullable = false,
                foreignKey = @ForeignKey(name = "fk_comments_author"))
    private User author;

    /** The task this comment belongs to. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "task_id", nullable = false,
                foreignKey = @ForeignKey(name = "fk_comments_task"))
    private Task task;
}
