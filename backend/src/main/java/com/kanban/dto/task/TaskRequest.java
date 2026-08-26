package com.kanban.dto.task;

import com.kanban.entity.Task.Priority;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

/**
 * Request body for creating or updating a {@link com.kanban.entity.Task}.
 *
 * @param title       card title (required)
 * @param description long-form description (optional)
 * @param priority    card priority enum: {@code LOW}, {@code MEDIUM}, {@code HIGH}.
 *                    Defaults to {@code MEDIUM} if omitted.
 * @param dueDate     ISO-8601 date string for the due date (optional)
 * @param assignee    free-text assignee name (optional)
 */
public record TaskRequest(

        @NotBlank(message = "Task title must not be blank")
        @Size(max = 200, message = "Task title must not exceed 200 characters")
        String title,

        String description,

        Priority priority,

        LocalDate dueDate,

        @Size(max = 100, message = "Assignee name must not exceed 100 characters")
        String assignee
) {}
