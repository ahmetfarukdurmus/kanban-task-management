package com.kanban.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * Checklist item belonging to a specific {@link Task}.
 * Can be flagged as required when transitioning to a specific board column.
 */
@Entity
@Table(name = "task_checklist_items")
@Getter @Setter @Builder
@NoArgsConstructor @AllArgsConstructor
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class TaskChecklistItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "task_id", nullable = false,
                foreignKey = @ForeignKey(name = "fk_checklist_items_task"))
    private Task task;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(name = "is_completed", nullable = false)
    @Builder.Default
    private boolean isCompleted = false;

    /** Optional column ID indicating which column transition requires this checklist item. */
    @Column(name = "required_for_column_id")
    private Long requiredForColumnId;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = Instant.now();
    }
}
