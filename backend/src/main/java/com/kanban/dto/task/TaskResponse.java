package com.kanban.dto.task;

import java.time.LocalDate;
import java.util.List;

/**
 * Response DTO for a {@link com.kanban.entity.Task}.
 *
 * @param id           task identifier
 * @param title        card title
 * @param description  long-form description
 * @param priority     priority label: {@code "LOW"}, {@code "MEDIUM"}, or {@code "HIGH"}
 * @param dueDate      ISO-8601 date or {@code null}
 * @param assignee     free-text assignee name or {@code null}
 * @param position     zero-based order within its column
 * @param columnId     owning column identifier
 * @param customFields dynamic custom fields list
 */
public record TaskResponse(
        Long                 id,
        String               title,
        String               description,
        String               priority,
        LocalDate            dueDate,
        String               assignee,
        int                  position,
        Long                 columnId,
        List<CustomFieldDto> customFields
) {
    public TaskResponse(Long id, String title, String description, String priority, LocalDate dueDate, String assignee, int position, Long columnId) {
        this(id, title, description, priority, dueDate, assignee, position, columnId, List.of());
    }
}
