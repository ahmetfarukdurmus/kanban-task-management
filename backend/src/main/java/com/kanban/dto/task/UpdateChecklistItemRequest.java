package com.kanban.dto.task;

import jakarta.validation.constraints.Size;

/**
 * Request payload for updating a checklist item on a task.
 */
public record UpdateChecklistItemRequest(
        @Size(max = 255, message = "Checklist title must not exceed 255 characters")
        String title,

        Boolean isCompleted,

        Long requiredForColumnId
) {}
