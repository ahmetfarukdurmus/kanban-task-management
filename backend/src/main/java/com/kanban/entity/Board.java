package com.kanban.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * A Kanban board belonging to an {@link Organization} and owned by a {@link User}.
 * Data isolation: queries filter by organization.
 */
@Entity
@Table(name = "boards")
@Getter @Setter @Builder
@NoArgsConstructor @AllArgsConstructor
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class Board {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    /** Key/prefix for tasks created on this board (e.g. FW, DEV, SEC, PAY, INT). */
    @Column(name = "board_key", length = 10)
    private String boardKey;

    @Column(length = 500)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50, columnDefinition = "VARCHAR(50)")
    @Builder.Default
    private BoardType boardType = BoardType.STANDARD;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
        if (boardKey == null || boardKey.isBlank()) {
            boardKey = getEffectiveBoardKey();
        }
    }

    public String getEffectiveBoardKey() {
        if (taskType != null && taskType.getTaskPrefix() != null && !taskType.getTaskPrefix().isBlank()) {
            return taskType.getTaskPrefix();
        }
        if (boardKey != null && !boardKey.isBlank() && !"BOARD".equalsIgnoreCase(boardKey) && !"TASK".equalsIgnoreCase(boardKey)) {
            return boardKey;
        }
        if (taskType != null && taskType.getName() != null) {
            return com.kanban.service.TaskTypeService.derivePrefix(taskType.getName(), null);
        }
        if (name != null && !name.isBlank()) {
            return com.kanban.service.TaskTypeService.derivePrefix(name, null);
        }
        return "TASK";
    }

    /** Owner of this board. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_id", nullable = false,
                foreignKey = @ForeignKey(name = "fk_boards_owner"))
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "password", "boards", "authorities"})
    private User owner;

    /** Organization / Team this board belongs to – multi-tenancy key. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organization_id",
                foreignKey = @ForeignKey(name = "fk_boards_organization"))
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "members"})
    private Organization organization;

    /** Default TaskType / Workflow linked to this board. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "task_type_id",
                foreignKey = @ForeignKey(name = "fk_boards_task_type"))
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "columns", "rules"})
    private TaskType taskType;

    /** Ordered list of columns on this board. */
    @OneToMany(mappedBy = "board",
               cascade = CascadeType.ALL,
               orphanRemoval = true)
    @OrderBy("position ASC")
    @Builder.Default
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "board"})
    private List<BoardColumn> columns = new ArrayList<>();
}
