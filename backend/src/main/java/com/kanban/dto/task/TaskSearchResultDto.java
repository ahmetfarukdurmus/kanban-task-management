package com.kanban.dto.task;

import java.util.Set;

/**
 * Lightweight search result DTO for direct task lookup.
 */
public record TaskSearchResultDto(
        Long id,
        String taskKey,
        String boardKey,
        String title,
        Long boardId,
        String boardTitle,
        String columnName,
        String priority,
        String colorHex,
        Set<String> tags
) {}
