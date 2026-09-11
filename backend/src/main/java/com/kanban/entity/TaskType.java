package com.kanban.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Admin-created dynamic task template / type (e.g. Bug, Story, Design).
 * Scoped to an organization for multi-tenant isolation.
 */
@Entity
@Table(name = "task_types")
@Getter @Setter @Builder
@NoArgsConstructor @AllArgsConstructor
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class TaskType {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    /** Hex color code for the badge/tag (e.g. "#EF4444", "#3B82F6"). */
    @Column(length = 20)
    private String colorHex;

    /** Whether test due date is required before transitioning to QA/Test columns. */
    @Column(name = "require_test_date", nullable = false, columnDefinition = "boolean default false")
    @Builder.Default
    private boolean requireTestDate = false;

    /** Whether target environment is required before transitioning to QA/Test columns. */
    @Column(name = "require_environment", nullable = false, columnDefinition = "boolean default false")
    @Builder.Default
    private boolean requireEnvironment = false;

    public Boolean getRequireTestDate() {
        return requireTestDate;
    }

    public Boolean getRequireEnvironment() {
        return requireEnvironment;
    }

    /** Multi-tenant organization this task type belongs to. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organization_id",
                foreignKey = @ForeignKey(name = "fk_task_types_organization"))
    private Organization organization;

    /** Dynamic workflow columns (stages) configured for this task type. */
    @OneToMany(mappedBy = "taskType",
               cascade = CascadeType.ALL,
               orphanRemoval = true)
    @OrderBy("position ASC")
    @Builder.Default
    private List<TaskTypeColumn> columns = new ArrayList<>();

    /** Transition rules enforced for tasks of this type. */
    @OneToMany(mappedBy = "taskType",
               cascade = CascadeType.ALL,
               orphanRemoval = true)
    @Builder.Default
    private List<TaskTypeTransitionRule> rules = new ArrayList<>();

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = Instant.now();
    }
}
