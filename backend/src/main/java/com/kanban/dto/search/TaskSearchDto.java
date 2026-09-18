package com.kanban.dto.search;

import java.util.Set;

/**
 * Task search result item.
 */
public record TaskSearchDto(
        Long id,
        String taskKey,
        String title,
        String priority,
        Long boardId,
        String boardTitle,
        Long columnId,
        String columnName,
        String taskTypeColor,
        Set<String> tags
) {}
