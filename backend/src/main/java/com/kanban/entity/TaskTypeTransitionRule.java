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

    /** Optional source board column. If null, rule applies to transition from any column. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_column_id",
                foreignKey = @ForeignKey(name = "fk_transition_rules_source_column"))
    private BoardColumn sourceColumn;

    /** Optional target board column where this rule is enforced. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "target_column_id",
                foreignKey = @ForeignKey(name = "fk_transition_rules_target_column"))
    private BoardColumn targetColumn;

    /** Optional source dynamic workflow column. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_task_type_column_id",
                foreignKey = @ForeignKey(name = "fk_transition_rules_src_tt_column"))
    private TaskTypeColumn sourceTaskTypeColumn;

    /** Optional target dynamic workflow column. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "target_task_type_column_id",
                foreignKey = @ForeignKey(name = "fk_transition_rules_dst_tt_column"))
    private TaskTypeColumn targetTaskTypeColumn;

    /** Source column title cache / fallback (e.g. "Kodlama"). */
    @Column(length = 100)
    private String sourceColumnTitle;

    /** Target column title cache / fallback (e.g. "QA Test"). */
    @Column(length = 100)
    private String targetColumnTitle;

    /** Rule type constraint (CHECKLIST_REQUIRED or ATTACHMENT_REQUIRED). */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private TransitionRuleType ruleType;

    /** Descriptive message / condition requirement (e.g. "Test edildi mi?", "Ekran görüntüsü yüklenmeli"). */
    @Column(length = 255)
    private String description;
}
