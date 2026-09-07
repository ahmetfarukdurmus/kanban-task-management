package com.kanban.dto.tasktype;

import com.kanban.entity.TransitionRuleType;

/**
 * DTO representing a column transition rule for a task type.
 */
public record TaskTypeTransitionRuleDto(
        Long id,
        Long taskTypeId,
        Long targetColumnId,
        String targetColumnTitle,
        TransitionRuleType ruleType,
        String description
) {}
