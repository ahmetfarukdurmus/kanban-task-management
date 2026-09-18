package com.kanban.dto.tasktype;

/**
 * Response DTO representing a dynamic custom field definition on a {@link com.kanban.entity.TaskType}.
 */
public record TaskTypeFieldDto(
        Long id,
        Long taskTypeId,
        String fieldName,
        String fieldType,
        Boolean required,
        String options,
        String placeholder,
        Integer position
) {}
