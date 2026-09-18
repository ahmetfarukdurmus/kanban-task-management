package com.kanban.dto.search;

/**
 * Board search result item.
 */
public record BoardSearchDto(
        Long id,
        String boardKey,
        String title,
        String description,
        Long organizationId,
        String organizationName,
        int columnCount,
        int taskCount
) {}
