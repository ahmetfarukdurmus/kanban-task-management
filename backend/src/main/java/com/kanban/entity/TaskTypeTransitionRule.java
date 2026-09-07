package com.kanban.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;

/**
 * Column transition rule configured for a specific {@link TaskType} and {@link BoardColumn}.
 * For example: Checklist items must be completed or an attachment must be present before moving to target column.
 */
@Entity
@Table(name = "task_type_transition_rules")
@Getter @Setter @Builder
@NoArgsConstructor @AllArgsConstructor
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class TaskTypeTransitionRule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "task_type_id", nullable = false,
                foreignKey = @ForeignKey(name = "fk_transition_rules_task_type"))
    private TaskType taskType;

    /** Target board column where this rule is enforced. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "target_column_id", nullable = false,
                foreignKey = @ForeignKey(name = "fk_transition_rules_target_column"))
    private BoardColumn targetColumn;

    /** Rule type constraint (CHECKLIST_REQUIRED or ATTACHMENT_REQUIRED). */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private TransitionRuleType ruleType;

    /** Descriptive message / condition requirement (e.g. "Test edildi mi?", "Ekran görüntüsü yüklenmeli"). */
    @Column(length = 255)
    private String description;
}
