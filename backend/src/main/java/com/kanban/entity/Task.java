package com.kanban.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * A task card inside a {@link BoardColumn}.
 *
 * <p><b>Position algorithm</b>: {@code position} is a zero-based integer.
 * When a task is moved or reordered, only the tasks in the affected range
 * are updated (shift-left / shift-right by 1), keeping DB writes minimal.</p>
 */
@Entity
@Table(name = "tasks")
@Getter @Setter @Builder
@NoArgsConstructor @AllArgsConstructor
public class Task {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    @Builder.Default
    private Priority priority = Priority.MEDIUM;

    /** Optional due date displayed on the card. */
    private LocalDate dueDate;

    /**
     * Free-text assignee name (phase 1).
     * In a future phase this will become a {@code ManyToOne} to {@link User}.
     */
    @Column(length = 100)
    private String assignee;

    /**
     * Zero-based order within its {@link BoardColumn}.
     * Persisted so Kanban state survives page reloads.
     */
    @Column(nullable = false)
    private Integer position;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "column_id", nullable = false,
                foreignKey = @ForeignKey(name = "fk_tasks_column"))
    private BoardColumn column;

    /** Comments on this task – cascaded on delete */
    @OneToMany(mappedBy = "task",
               cascade = CascadeType.ALL,
               orphanRemoval = true)
    @OrderBy("createdAt ASC")
    @Builder.Default
    private List<Comment> comments = new ArrayList<>();

    /** Attachments on this task – cascaded on delete */
    @OneToMany(mappedBy = "task",
               cascade = CascadeType.ALL,
               orphanRemoval = true)
    @OrderBy("uploadedAt DESC")
    @Builder.Default
    private List<Attachment> attachments = new ArrayList<>();

    /** Custom fields on this task – cascaded on delete */
    @OneToMany(mappedBy = "task",
               cascade = CascadeType.ALL,
               orphanRemoval = true)
    @OrderBy("id ASC")
    @Builder.Default
    private List<TaskCustomField> customFields = new ArrayList<>();

    // ─── Priority enum ───────────────────────────────────────────────────

    public enum Priority {
        LOW, MEDIUM, HIGH
    }
}
