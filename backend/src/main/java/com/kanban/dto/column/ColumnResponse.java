package com.kanban.dto.column;

import com.kanban.dto.task.TaskResponse;

import java.util.List;

/**
 * Response DTO for a {@link com.kanban.entity.BoardColumn}.
 *
 * @param id      column identifier
 * @param title   column display title
 * @param position zero-based display order within its board
 * @param boardId  owning board identifier
 * @param tasks    ordered list of tasks in this column
 */
public record ColumnResponse(
        Long             id,
        String           title,
        int              position,
        Long             boardId,
        List<TaskResponse> tasks
) {}
