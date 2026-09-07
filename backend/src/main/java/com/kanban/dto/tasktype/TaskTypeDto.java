package com.kanban.dto.tasktype;

import java.time.Instant;
import java.util.List;

/**
 * Response DTO for a {@link com.kanban.entity.TaskType}.
 */
public record TaskTypeDto(
        Long id,
        String name,
        String colorHex,
        Long organizationId,
        String organizationName,
        List<TaskTypeTransitionRuleDto> rules,
        Instant createdAt
) {
    public TaskTypeDto(Long id, String name, String colorHex, Long organizationId, String organizationName, List<TaskTypeTransitionRuleDto> rules) {
        this(id, name, colorHex, organizationId, organizationName, rules, null);
    }
}
