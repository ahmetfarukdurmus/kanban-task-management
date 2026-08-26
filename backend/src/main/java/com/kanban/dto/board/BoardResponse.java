package com.kanban.dto.board;

import com.kanban.dto.column.ColumnResponse;

import java.time.Instant;
import java.util.List;

/**
 * Response DTO for a {@link com.kanban.entity.Board}.
 *
 * <ul>
 *   <li>Used by {@code GET /boards} – {@code columns} is an empty list.</li>
 *   <li>Used by {@code GET /boards/{id}} – {@code columns} includes all
 *       {@link ColumnResponse} entries, each populated with their tasks.</li>
 * </ul>
 *
 * @param id          board identifier
 * @param name        board display name
 * @param description optional description
 * @param createdAt   creation timestamp (UTC)
 * @param columns     ordered list of columns (empty for list view)
 */
public record BoardResponse(
        Long               id,
        String             name,
        String             description,
        Instant            createdAt,
        List<ColumnResponse> columns
) {}
