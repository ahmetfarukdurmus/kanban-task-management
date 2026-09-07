package com.kanban.dto.task;

import java.time.Instant;

/**
 * DTO representing a task checklist item.
 */
public record TaskChecklistItemDto(
        Long id,
        Long taskId,
        String title,
        boolean isCompleted,
        Long requiredForColumnId,
        Instant createdAt
) {
    public TaskChecklistItemDto(Long id, Long taskId, String title, boolean isCompleted, Long requiredForColumnId) {
        this(id, taskId, title, isCompleted, requiredForColumnId, null);
    }
}
