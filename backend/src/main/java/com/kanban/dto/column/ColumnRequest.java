package com.kanban.dto.column;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Request body for creating or renaming a {@link com.kanban.entity.BoardColumn}.
 *
 * @param title column display title (e.g. "TODO", "IN PROGRESS")
 */
public record ColumnRequest(

        @NotBlank(message = "Column title must not be blank")
        @Size(max = 80, message = "Column title must not exceed 80 characters")
        String title
) {}
