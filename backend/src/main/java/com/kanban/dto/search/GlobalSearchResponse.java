package com.kanban.dto.search;

import java.util.List;

/**
 * Combined search response containing matched tasks and boards.
 */
public record GlobalSearchResponse(
        List<TaskSearchDto> tasks,
        List<BoardSearchDto> boards
) {
    public static GlobalSearchResponse of(List<TaskSearchDto> tasks, List<BoardSearchDto> boards) {
        return new GlobalSearchResponse(tasks != null ? tasks : List.of(), boards != null ? boards : List.of());
    }
}
