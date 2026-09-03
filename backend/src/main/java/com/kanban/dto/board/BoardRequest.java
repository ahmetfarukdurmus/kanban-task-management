package com.kanban.dto.board;

import com.kanban.entity.BoardType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Request body for creating or updating a {@link com.kanban.entity.Board}.
 *
 * @param name           board display name (required, max 100 chars)
 * @param description    optional board description (max 500 chars)
 * @param organizationId optional department id (used by Super Admin to assign board to a department)
 * @param boardType      optional board template / workflow type (STANDARD, INTEGRATION, QA_TEST)
 */
public record BoardRequest(
        @NotBlank(message = "Board name must not be blank")
        @Size(max = 100, message = "Board name must not exceed 100 characters")
        String name,

        @Size(max = 500, message = "Description must not exceed 500 characters")
        String description,

        Long organizationId,

        BoardType boardType
) {
    public BoardRequest(String name, String description) {
        this(name, description, null, BoardType.STANDARD);
    }

    public BoardRequest(String name, String description, Long organizationId) {
        this(name, description, organizationId, BoardType.STANDARD);
    }
}
