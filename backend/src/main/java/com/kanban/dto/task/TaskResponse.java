package com.kanban.dto.task;

import com.kanban.dto.user.UserSummaryDto;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;

/**
 * Response DTO for a {@link com.kanban.entity.Task}.
 *
 * @param id             task identifier
 * @param title          card title
 * @param description    long-form description
 * @param priority       priority label: {@code "LOW"}, {@code "MEDIUM"}, or {@code "HIGH"}
 * @param dueDate        ISO-8601 date or {@code null}
 * @param assignee       primary assignee username or {@code null}
 * @param position       zero-based order within its column
 * @param columnId       owning column identifier
 * @param customFields   dynamic custom fields list
 * @param taskTypeId     task type ID or {@code null}
 * @param taskTypeName   task type name or {@code null}
 * @param taskTypeColor  task type color hex or {@code null}
 * @param assigneeIds    set of user IDs assigned
 * @param assignees      list of user summary DTOs for assigned users
 * @param checklistItems list of checklist item DTOs
 */
public record TaskResponse(
        Long                       id,
        String                     title,
        String                     description,
        String                     priority,
        LocalDate                  dueDate,
        String                     assignee,
        int                        position,
        Long                       columnId,
        List<CustomFieldDto>       customFields,
        Long                       taskTypeId,
        String                     taskTypeName,
        String                     taskTypeColor,
        Set<Long>                  assigneeIds,
        List<UserSummaryDto>       assignees,
        List<TaskChecklistItemDto> checklistItems
) {
    public TaskResponse(Long id, String title, String description, String priority, LocalDate dueDate, String assignee, int position, Long columnId, List<CustomFieldDto> customFields) {
        this(id, title, description, priority, dueDate, assignee, position, columnId, customFields, null, null, null, Set.of(), List.of(), List.of());
    }

    public TaskResponse(Long id, String title, String description, String priority, LocalDate dueDate, String assignee, int position, Long columnId) {
        this(id, title, description, priority, dueDate, assignee, position, columnId, List.of(), null, null, null, Set.of(), List.of(), List.of());
    }
}
