package com.kanban.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;

/**
 * Dynamic custom field definition attached to a {@link TaskType}.
 * Specifies the input fields that tasks of this type must or can provide.
 */
@Entity
@Table(name = "task_type_fields")
@Getter @Setter @Builder
@NoArgsConstructor @AllArgsConstructor
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "taskType"})
public class TaskTypeField {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "task_type_id", nullable = false,
                foreignKey = @ForeignKey(name = "fk_task_type_fields_type"))
    private TaskType taskType;

    /** Label / Display name of the field (e.g. "Kaynak IP (Source)", "Hedef URL (Target)"). */
    @Column(nullable = false, length = 100)
    private String fieldName;

    /** Input type (TEXT, NUMBER, DATE, SELECT). */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50, columnDefinition = "VARCHAR(50)")
    @Builder.Default
    private FieldType fieldType = FieldType.TEXT;

    /** Whether this field is mandatory when creating/editing a task of this type. */
    @Column(nullable = false, columnDefinition = "boolean default false")
    @Builder.Default
    private boolean required = false;

    /** Comma-separated options for SELECT field types (e.g. "Inbound, Outbound, Bidirectional"). */
    @Column(columnDefinition = "TEXT")
    private String options;

    /** Optional placeholder / helper hint text for form inputs. */
    @Column(length = 200)
    private String placeholder;

    /** Display order in the task form. */
    @Column(nullable = false, columnDefinition = "int default 0")
    @Builder.Default
    private Integer position = 0;

    public enum FieldType {
        TEXT, NUMBER, DATE, SELECT, CASCADING_SELECT
    }
}
