package com.kanban.dto.task;

/**
 * DTO for task custom fields.
 */
public record CustomFieldDto(
        Long    id,
        String  fieldName,
        String  fieldType,
        String  fieldValue,
        Boolean required,
        String  options,
        String  placeholder
) {
    public CustomFieldDto(Long id, String fieldName, String fieldType, String fieldValue) {
        this(id, fieldName, fieldType, fieldValue, null, null, null);
    }
}
