package com.kanban.dto.task;

/**
 * DTO for task custom fields.
 */
public record CustomFieldDto(
        Long   id,
        String fieldName,
        String fieldType,
        String fieldValue
) {}
