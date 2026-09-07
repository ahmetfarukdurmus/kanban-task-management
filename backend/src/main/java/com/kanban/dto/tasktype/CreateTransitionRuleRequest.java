package com.kanban.dto.tasktype;

import com.kanban.entity.TransitionRuleType;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Request payload for creating a column transition rule on a task type.
 */
public record CreateTransitionRuleRequest(
        Long sourceColumnId,

        @NotNull(message = "Target column ID is required")
        Long targetColumnId,

        @NotNull(message = "Rule type is required")
        TransitionRuleType ruleType,

        @Size(max = 255, message = "Description must not exceed 255 characters")
        String description
) {
    public CreateTransitionRuleRequest(Long targetColumnId, TransitionRuleType ruleType, String description) {
        this(null, targetColumnId, ruleType, description);
    }
}
