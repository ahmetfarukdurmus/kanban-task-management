package com.kanban.entity;

import jakarta.persistence.*;
import lombok.*;

/**
 * Dynamic custom field attached to a {@link Task}.
 */
@Entity
@Table(name = "task_custom_fields")
@Getter @Setter @Builder
@NoArgsConstructor @AllArgsConstructor
public class TaskCustomField {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "task_id", nullable = false,
                foreignKey = @ForeignKey(name = "fk_custom_fields_task"))
    private Task task;

    @Column(nullable = false, length = 100)
    private String fieldName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private FieldType fieldType = FieldType.TEXT;

    @Column(columnDefinition = "TEXT")
    private String fieldValue;

    public enum FieldType {
        TEXT, NUMBER, DATE
    }
}
