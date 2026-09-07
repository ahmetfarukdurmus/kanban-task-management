package com.kanban.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;

/**
 * Dynamic workflow column defined within a {@link TaskType}.
 * Represents a customizable workflow stage (e.g. Analiz, Kodlama, QA Test, Deploy).
 */
@Entity
@Table(name = "task_type_columns")
@Getter @Setter @Builder
@NoArgsConstructor @AllArgsConstructor
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class TaskTypeColumn {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "task_type_id", nullable = false,
                foreignKey = @ForeignKey(name = "fk_task_type_columns_task_type"))
    private TaskType taskType;

    @Column(nullable = false, length = 100)
    private String title;

    @Column(length = 20)
    private String colorHex;

    @Column(nullable = false)
    private Integer position;
}
