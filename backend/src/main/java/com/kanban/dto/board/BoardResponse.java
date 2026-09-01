package com.kanban.dto.board;

import com.kanban.dto.column.ColumnResponse;

import java.time.Instant;
import java.util.List;

/**
 * Response DTO for a {@link com.kanban.entity.Board}.
 *
 * @param id               board identifier
 * @param name             board display name
 * @param description      optional description
 * @param createdAt        creation timestamp (UTC)
 * @param columns          ordered list of columns
 * @param organizationId   organization identifier
 * @param organizationName organization display name
 */
public record BoardResponse(
        Long                 id,
        String               name,
        String               description,
        Instant              createdAt,
        List<ColumnResponse> columns,
        Long                 organizationId,
        String               organizationName
) {
    public BoardResponse(Long id, String name, String description, Instant createdAt, List<ColumnResponse> columns) {
        this(id, name, description, createdAt, columns, null, null);
    }
}
