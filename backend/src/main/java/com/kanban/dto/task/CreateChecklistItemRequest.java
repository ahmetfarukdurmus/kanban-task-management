package com.kanban.dto.task;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Request payload for creating a checklist item on a task.
 */
public record CreateChecklistItemRequest(
        @NotBlank(message = "Checklist title must not be blank")
        @Size(max = 255, message = "Checklist title must not exceed 255 characters")
        String title,

        Long requiredForColumnId
) {}
