package com.kanban.dto.column;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

/**
 * Request body for {@code PATCH /boards/{boardId}/columns/{columnId}/reorder}.
 *
 * @param newPosition zero-based target position within its board.
 *                    Values beyond the last column index are clamped automatically.
 */
public record ColumnReorderRequest(

        @NotNull(message = "newPosition must not be null")
        @Min(value = 0, message = "newPosition must be >= 0")
        Integer newPosition
) {}
