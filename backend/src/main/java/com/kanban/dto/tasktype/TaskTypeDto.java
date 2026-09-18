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
        String taskPrefix,
        Long organizationId,
        String organizationName,
        Boolean requireTestDate,
        Boolean requireEnvironment,
        List<TaskTypeColumnDto> columns,
        List<TaskTypeTransitionRuleDto> rules,
        List<TaskTypeFieldDto> fields,
        Instant createdAt
) {
    public TaskTypeDto(Long id, String name, String colorHex, String taskPrefix, Long organizationId, String organizationName, List<TaskTypeColumnDto> columns, List<TaskTypeTransitionRuleDto> rules, List<TaskTypeFieldDto> fields) {
        this(id, name, colorHex, taskPrefix, organizationId, organizationName, false, false, columns, rules, fields, null);
    }

    public TaskTypeDto(Long id, String name, String colorHex, Long organizationId, String organizationName, List<TaskTypeColumnDto> columns, List<TaskTypeTransitionRuleDto> rules, List<TaskTypeFieldDto> fields) {
        this(id, name, colorHex, null, organizationId, organizationName, false, false, columns, rules, fields, null);
    }

    public TaskTypeDto(Long id, String name, String colorHex, Long organizationId, String organizationName, List<TaskTypeColumnDto> columns, List<TaskTypeTransitionRuleDto> rules) {
        this(id, name, colorHex, null, organizationId, organizationName, false, false, columns, rules, List.of(), null);
    }

    public TaskTypeDto(Long id, String name, String colorHex, Long organizationId, String organizationName, List<TaskTypeTransitionRuleDto> rules) {
        this(id, name, colorHex, null, organizationId, organizationName, false, false, List.of(), rules, List.of(), null);
    }
}
