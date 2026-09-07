package com.kanban.dto.tasktype;

import com.kanban.entity.TransitionRuleType;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Request payload for creating a column transition rule on a task type.
 */
public record CreateTransitionRuleRequest(
        Long sourceColumnId,
        String sourceColumnTitle,

        Long targetColumnId,
        String targetColumnTitle,

        @NotNull(message = "Rule type is required")
        TransitionRuleType ruleType,

        @Size(max = 255, message = "Description must not exceed 255 characters")
        String description
) {
    public CreateTransitionRuleRequest(Long targetColumnId, TransitionRuleType ruleType, String description) {
        this(null, null, targetColumnId, null, ruleType, description);
    }

    public CreateTransitionRuleRequest(Long sourceColumnId, Long targetColumnId, TransitionRuleType ruleType, String description) {
        this(sourceColumnId, null, targetColumnId, null, ruleType, description);
    }
}
