package com.kanban.dto.task;

import com.kanban.entity.Task.Priority;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;

/**
 * Request body for creating or updating a {@link com.kanban.entity.Task}.
 *
 * @param title          card title (required)
 * @param description    long-form description (optional)
 * @param priority       card priority enum: {@code LOW}, {@code MEDIUM}, {@code HIGH}.
 * @param dueDate        ISO-8601 date string for the due date (optional)
 * @param assignee       free-text assignee name (optional, backward compatible)
 * @param assigneeIds    set of user IDs assigned to this task (multi-assignee)
 * @param taskTypeId     dynamic task type / template ID (optional)
 * @param customFields   list of dynamic custom fields (optional)
 * @param checklistItems list of checklist items (optional)
 */
public record TaskRequest(
        @NotBlank(message = "Task title must not be blank")
        @Size(max = 200, message = "Task title must not exceed 200 characters")
        String title,

        String description,

        Priority priority,

        LocalDate dueDate,

        LocalDate testDueDate,

        @Size(max = 50, message = "Target environment must not exceed 50 characters")
        String targetEnvironment,

        Integer estimatedHours,

        Long reporterId,

        String reporter,

        @Size(max = 100, message = "Assignee name must not exceed 100 characters")
        String assignee,

        Set<Long> assigneeIds,

        Long taskTypeId,

        List<CustomFieldDto> customFields,

        List<CreateChecklistItemRequest> checklistItems
) {
    public TaskRequest(String title, String description, Priority priority, LocalDate dueDate, String assignee, Set<Long> assigneeIds, Long taskTypeId, List<CustomFieldDto> customFields, List<CreateChecklistItemRequest> checklistItems) {
        this(title, description, priority, dueDate, null, null, null, null, null, assignee, assigneeIds, taskTypeId, customFields, checklistItems);
    }

    public TaskRequest(String title, String description, Priority priority, LocalDate dueDate, String assignee, List<CustomFieldDto> customFields) {
        this(title, description, priority, dueDate, null, null, null, null, null, assignee, null, null, customFields, null);
    }

    public TaskRequest(String title, String description, Priority priority, LocalDate dueDate, String assignee) {
        this(title, description, priority, dueDate, null, null, null, null, null, assignee, null, null, null, null);
    }
}
