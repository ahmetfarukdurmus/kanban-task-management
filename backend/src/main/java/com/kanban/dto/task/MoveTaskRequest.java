package com.kanban.dto.task;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

/**
 * Request body for {@code PATCH /api/tasks/{taskId}/move}.
 *
 * <p>Handles both <b>same-column reorder</b> (when {@code targetColumnId} equals
 * the task's current column) and <b>cross-column move</b> (when it differs).</p>
 *
 * @param targetColumnId destination column identifier (may equal source column)
 * @param targetPosition zero-based target index within the destination column;
 *                       values beyond the last index are clamped automatically
 */
public record MoveTaskRequest(

        @NotNull(message = "targetColumnId must not be null")
        Long targetColumnId,

        @Min(value = 0, message = "targetPosition must be >= 0")
        int targetPosition
) {}
