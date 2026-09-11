package com.kanban.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * A task card inside a {@link BoardColumn}.
 * Supports dynamic task types, multi-assignees, checklist items, attachments, comments, and custom fields.
 *
 * <p><b>Position algorithm</b>: {@code position} is a zero-based integer.
 * When a task is moved or reordered, only the tasks in the affected range
 * are updated (shift-left / shift-right by 1), keeping DB writes minimal.</p>
 */
@Entity
@Table(name = "tasks")
@Getter @Setter @Builder
@NoArgsConstructor @AllArgsConstructor
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
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

    /** Dynamic task type / template (e.g. Bug, Story, Task, Design). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "task_type_id",
                foreignKey = @ForeignKey(name = "fk_tasks_task_type"))
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "columns", "rules"})
    private TaskType taskType;

    /** Optional due date displayed on the card. */
    private LocalDate dueDate;

    /** Target test due date (required if task type enforces it on QA/Test transition). */
    private LocalDate testDueDate;

    /** Test/Deployment target environment (e.g. DEV, TEST, STAGING, PROD). */
    @Column(length = 50)
    private String targetEnvironment;

    /** Estimated effort / duration (e.g. hours or story points). */
    private Integer estimatedHours;

    /** The user who reported/created the task. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reporter_id",
                foreignKey = @ForeignKey(name = "fk_tasks_reporter"))
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "password", "boards", "authorities", "organizations"})
    private User reporter;

    /**
     * Multi-user assignment for this task (ManyToMany).
     * Join table: {@code task_assignees}.
     */
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "task_assignees",
        joinColumns = @JoinColumn(name = "task_id", foreignKey = @ForeignKey(name = "fk_task_assignees_task")),
        inverseJoinColumns = @JoinColumn(name = "user_id", foreignKey = @ForeignKey(name = "fk_task_assignees_user"))
    )
    @Builder.Default
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "password", "boards", "authorities", "organizations"})
    private Set<User> assignees = new HashSet<>();

    /**
     * Zero-based order within its {@link BoardColumn}.
     * Persisted so Kanban state survives page reloads.
     */
    @Column(nullable = false)
    private Integer position;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "column_id", nullable = false,
                foreignKey = @ForeignKey(name = "fk_tasks_column"))
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "tasks", "board"})
    private BoardColumn column;

    /** Checklist items on this task – cascaded on delete */
    @OneToMany(mappedBy = "task",
               cascade = CascadeType.ALL,
               orphanRemoval = true)
    @OrderBy("id ASC")
    @Builder.Default
    private List<TaskChecklistItem> checklistItems = new ArrayList<>();

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

    // ─── Assignee helper methods for single/multi compatibility ──────────

    public String getAssignee() {
        if (assignees == null || assignees.isEmpty()) {
            return null;
        }
        return assignees.iterator().next().getUsername();
    }

    public void setAssignee(String username) {
        // Helper retained for backward compatibility
    }

    public User getAssignedUser() {
        if (assignees == null || assignees.isEmpty()) {
            return null;
        }
        return assignees.iterator().next();
    }

    public void setAssignedUser(User user) {
        if (this.assignees == null) {
            this.assignees = new HashSet<>();
        }
        if (user != null) {
            this.assignees.clear();
            this.assignees.add(user);
        } else {
            this.assignees.clear();
        }
    }

    // ─── Priority enum ───────────────────────────────────────────────────

    public enum Priority {
        LOW, MEDIUM, HIGH
    }
}
